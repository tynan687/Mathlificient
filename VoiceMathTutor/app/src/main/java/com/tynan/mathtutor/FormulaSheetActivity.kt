package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.tynan.mathtutor.memory.Proficiency
import java.util.Locale

/**
 * The 182-formula interactive sheet — same data file and KaTeX assets as the
 * desktop app, in a WebView. Copy LaTeX (→ Word's equation editor) or copy/share
 * a rendered PNG (→ Samsung Notes, for S Pen work).
 */
class FormulaSheetActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "Formula Sheet"
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.allowFileAccess = true
            // Some identities are wider than a phone. Without zoom the only way
            // to read them is side-scrolling a nested scroller that fights the
            // card's tap handler.
            settings.builtInZoomControls = true
            settings.displayZoomControls = false
            settings.useWideViewPort = true
            addJavascriptInterface(Bridge(this@FormulaSheetActivity), "Android")
            loadUrl("file:///android_asset/formulas/formulas.html")
        }
        // targetSdk 35 forces edge-to-edge, and CSS env(safe-area-inset-*) stays 0
        // in an Android WebView unless the window opts into cutout mode — so pad
        // on this side, or the sticky search sits under the status bar and the
        // last card under the navigation bar. The padding goes on a wrapper:
        // WebView doesn't reliably inset its own viewport.
        val container = FrameLayout(this).apply { addView(webView) }
        setContentView(container)
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }

    /**
     * Shared JS bridge for the formula sheet, practice and progress pages —
     * every WebView activity installs this same class, so a method added here
     * is available everywhere.
     *
     * Note these run on the WebView's JavaBridge thread, not the UI thread:
     * file work is fine as-is, anything touching views needs runOnUiThread.
     */
    class Bridge(private val activity: ComponentActivity) {

        private val proficiency by lazy { Proficiency(activity) }

        // ---- Proficiency (see memory/Proficiency.kt — no maths on this side) ----

        @JavascriptInterface
        fun profAll(): String = proficiency.readAll()

        @JavascriptInterface
        fun profAppend(attemptJson: String) = proficiency.append(attemptJson)

        @JavascriptInterface
        fun profReset() = proficiency.reset()

        /** "Practise this" from the progress screen. */
        @JavascriptInterface
        fun openSkill(skillId: String) {
            activity.runOnUiThread {
                activity.startActivity(
                    Intent(activity, PracticeSpaceActivity::class.java)
                        .putExtra("focusSkill", skillId)
                )
            }
        }

        /** The 12-question placement check that seeds a fresh progress screen. */
        @JavascriptInterface
        fun openPlacement() {
            activity.runOnUiThread {
                activity.startActivity(
                    Intent(activity, PracticeSpaceActivity::class.java)
                        .putExtra("placement", true)
                )
            }
        }
        @JavascriptInterface
        fun copyText(text: String) {
            activity.runOnUiThread {
                activity.getSystemService(ClipboardManager::class.java)
                    .setPrimaryClip(ClipData.newPlainText("formula", text))
                Toast.makeText(activity, "Copied — in Word: Insert → Equation, then paste",
                    Toast.LENGTH_LONG).show()
            }
        }

        @JavascriptInterface
        fun copyImage(latex: String) {
            activity.runOnUiThread {
                FormulaImageRenderer.render(activity, latex) { uri ->
                    activity.getSystemService(ClipboardManager::class.java)
                        .setPrimaryClip(ClipData.newUri(activity.contentResolver, "formula", uri))
                    Toast.makeText(activity, "Image copied — paste into Samsung Notes",
                        Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun shareImage(latex: String) {
            activity.runOnUiThread {
                FormulaImageRenderer.render(activity, latex) { uri ->
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(Intent.createChooser(intent, "Share formula"))
                }
            }
        }

        @JavascriptInterface
        fun closeWindow() {
            activity.runOnUiThread { activity.finish() }
        }

        /**
         * Say a line of maths out loud, for the symbols reference.
         *
         * Android's own TextToSpeech rather than the WebView's Web Speech API:
         * that one can be silently mute inside a WebView depending on the
         * system WebView build, and a button that does nothing is worse than no
         * button. The page only shows the speaker where this method exists, and
         * the written "say it" line is always on screen regardless.
         */
        @JavascriptInterface
        fun speak(text: String) {
            if (text.isBlank()) return
            activity.runOnUiThread { speakOnUiThread(activity, text) }
        }

        companion object {
            // One engine for the process, created on first use. Starting it is
            // slow enough to be visible, so it is kept alive between taps and
            // shut down when the symbols screen closes.
            private var tts: TextToSpeech? = null
            private var ready = false
            private val queued = ArrayDeque<String>()

            private fun speakOnUiThread(context: Context, text: String) {
                val engine = tts
                if (engine != null && ready) {
                    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sym")
                    return
                }
                queued.addLast(text)
                if (engine != null) return // still starting up; it will drain below
                tts = TextToSpeech(context.applicationContext) { status ->
                    ready = status == TextToSpeech.SUCCESS
                    if (!ready) { queued.clear(); return@TextToSpeech }
                    tts?.language = Locale.UK
                    // Maths read at full speed is hard to follow.
                    tts?.setSpeechRate(0.9f)
                    while (queued.isNotEmpty()) {
                        tts?.speak(queued.removeFirst(), TextToSpeech.QUEUE_ADD, null, "sym")
                    }
                }
            }

            /** Called when the symbols screen goes away. */
            fun releaseSpeech() {
                tts?.stop()
                tts?.shutdown()
                tts = null
                ready = false
                queued.clear()
            }
        }
    }
}
