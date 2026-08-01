package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import com.tynan.mathtutor.security.SecureKeyStore
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
