package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.tynan.mathtutor.security.SecureKeyStore
import com.tynan.mathtutor.service.CheckAnswerBridge
import com.tynan.mathtutor.service.RealtimeService
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Small floating practice popup (dialog-themed) over whatever the student is
 * working in — used when the tutor pushes a question mid-session so it doesn't
 * yank them out of their notes. For sit-down practice, PracticeSpaceActivity is
 * the full S Pen studio.
 */
class PracticeActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "Practice"
        setFinishOnTouchOutside(true)
        val dm = resources.displayMetrics
        val width = (dm.widthPixels * 0.86f).toInt().coerceAtMost((520 * dm.density).toInt())
        val height = (dm.heightPixels * 0.72f).toInt().coerceAtMost((640 * dm.density).toInt())

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.allowFileAccess = true
            // Off by default in a WebView. The practice page remembers the
            // answering mode in localStorage — a UI preference, not part of the
            // study record, so it doesn't belong in SecureKeyStore.
            settings.domStorageEnabled = true
            addJavascriptInterface(
                FormulaSheetActivity.Bridge(this@PracticeActivity), "Android"
            )
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) {
                    // This popup shares practice.html with the full-screen studio,
                    // but it's capped at 520x640dp — the quiz bar and summary card
                    // would turn a glanceable prompt into a scrolling mess. The
                    // page's `.mini` rules hide them; grading stays, since marking
                    // a tutor-pushed question is exactly what this popup is for.
                    view.evaluateJavascript("document.body.classList.add('mini')", null)
                    val topic = SecureKeyStore(this@PracticeActivity).loadSettings().currentTopic
                    view.evaluateJavascript("setPreferredTopic(${JSONObject.quote(topic)})", null)
                    injectPayload(view, intent)
                }
            }
            loadUrl("file:///android_asset/formulas/practice.html")
        }
        setContentView(webView, ViewGroup.LayoutParams(width, height))
        watchForTutorChecks()
    }

    /**
     * Answer the tutor's `check_my_answer` while this popup is the screen in front.
     *
     * `show_practice` opens THIS activity, so this is what a student is looking at
     * when the tutor pushes them a question — and it is the screen most likely to
     * be up when the tutor then asks whether they got it right. Only the studio
     * watched for that, so the call sat unanswered until it timed out and the
     * model told the student to open the practice screen they were already on.
     *
     * RESUMED, not STARTED: this activity is dialog-themed, so the studio behind
     * it stays STARTED. Both screens hold their own question, so exactly one of
     * them must answer, and it has to be the one in front.
     *
     * No ink canvas here, so there is no working to send with a wrong verdict —
     * that is the studio's job.
     */
    private fun watchForTutorChecks() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                RealtimeService.uiState
                    .map { it.pendingCheck }
                    // uiState changes for unrelated reasons — mute, watch, errors —
                    // and re-marking the same call on every one of them is waste.
                    .distinctUntilChanged()
                    .collect { pending ->
                        if (pending != null) {
                            CheckAnswerBridge.answer(applicationContext, webView, pending)
                        }
                    }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        injectPayload(webView, intent) // singleTop: reuse this instance, swap the question
    }

    private fun injectPayload(view: WebView, intent: Intent?) {
        intent?.getStringExtra("payload")?.let { payload ->
            view.evaluateJavascript("showPractice(${JSONObject.quote(payload)})", null)
        }
    }
}
