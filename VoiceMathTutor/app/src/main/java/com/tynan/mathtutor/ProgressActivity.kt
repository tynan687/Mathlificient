package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Progress bars per topic, what to work on next, and what's gone stale — the
 * same page the desktop app shows, reading the same attempt log through the
 * shared bridge.
 *
 * Its own activity rather than a third pane in the Practice Studio: browsing
 * your progress isn't a "work it on paper" surface, and the Studio's split is
 * already tight enough on a phone.
 */
class ProgressActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "My Progress"
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.allowFileAccess = true
            addJavascriptInterface(FormulaSheetActivity.Bridge(this@ProgressActivity), "Android")
            loadUrl("file:///android_asset/formulas/progress.html")
        }
        // Same inset dance as the formula sheet: targetSdk 35 is edge-to-edge and
        // CSS env(safe-area-inset-*) stays 0 in a WebView, so pad a wrapper here
        // or the heading hides under the status bar.
        val container = FrameLayout(this).apply { addView(webView) }
        setContentView(container)
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }

    /** Coming back from a practice run should show the attempts just recorded. */
    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "typeof refreshProgress === 'function' && refreshProgress()", null
            )
        }
    }
}
