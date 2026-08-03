package com.tynan.mathtutor.service

import android.content.Context
import android.webkit.WebView
import org.json.JSONObject

/**
 * Run a practice page's marker for one `check_my_answer` and post the verdict back.
 *
 * The service has no route into a WebView, so it publishes the question on
 * `RealtimeService.uiState.pendingCheck` and whichever practice screen is in
 * front picks it up. There are two such screens — the full-screen studio and the
 * dialog popup — and they need identical behaviour here, so the round trip lives
 * in one place rather than being written twice.
 *
 * The answer never leaves the page. It marks the attempt itself and hands back a
 * verdict, which is what lets the tutor say "yes, that's it" while still never
 * reading a final answer out.
 */
object CheckAnswerBridge {

    /** What to send when the page could not give us a usable verdict. */
    private const val NOT_READY =
        """{"verdict":"unsure","reason":"the practice screen was not ready"}"""

    /**
     * Mark `pending` in `view` and deliver the result.
     *
     * `working` is asked for its image only when the verdict is "wrong" — a
     * correct answer needs no diagnosis and a picture of a blank page is a wasted
     * one. The studio passes its ink canvas; the popup has none and passes nothing.
     */
    fun answer(
        context: Context,
        view: WebView,
        pending: RealtimeService.PendingCheck,
        working: () -> String? = { null },
    ) {
        // Guarded, because the page may not have finished loading: a bare call on
        // a page without the marker yields the STRING "null", which is not blank
        // and would reach the model as a null instead of a verdict.
        view.evaluateJavascript(
            "typeof window.__checkAnswer === 'function'" +
                " ? window.__checkAnswer(${JSONObject.quote(pending.heard)}) : null"
        ) { result ->
            val verdict = normalise(result)
            val ink = if (verdictOf(verdict) == "wrong") {
                try { working() } catch (_: Exception) { null }
            } else {
                null
            }
            RealtimeService.deliverCheck(context, pending.callId, verdict, ink)
        }
    }

    /**
     * `evaluateJavascript` hands the value back as JSON text, so an object arrives
     * ready to forward — but anything else must not be forwarded verbatim. A tool
     * output of `null` is valid JSON and useless to the model; saying "unsure"
     * costs a clarifying question and is honest.
     */
    fun normalise(result: String?): String {
        val obj = try { JSONObject(result ?: "") } catch (_: Exception) { null }
        return if (obj != null && obj.has("verdict")) result!! else NOT_READY
    }

    private fun verdictOf(json: String): String =
        try { JSONObject(json).optString("verdict") } catch (_: Exception) { "" }
}
