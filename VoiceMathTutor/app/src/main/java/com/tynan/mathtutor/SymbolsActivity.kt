package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * What every symbol means and how to say it out loud, plus whole expressions
 * broken into the fragments you actually speak.
 *
 * Its own activity rather than a pane in the Practice Studio: this is somewhere
 * you look something up mid-question, not somewhere you work.
 */
class SymbolsActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "Symbols"
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.allowFileAccess = true
            settings.domStorageEnabled = true
            // Some readings are wider than a phone; without zoom the only way to
            // see the end of one is a nested side-scroll that fights the page.
            settings.builtInZoomControls = true
            settings.displayZoomControls = false
            settings.useWideViewPort = true
            addJavascriptInterface(FormulaSheetActivity.Bridge(this@SymbolsActivity), "Android")
            loadUrl("file:///android_asset/formulas/symbols.html")
        }
        // Same inset handling as the formula sheet: targetSdk 35 is edge-to-edge
        // and a WebView reports zero for CSS env(safe-area-inset-*), so the
        // sticky search would otherwise sit under the status bar.
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

    override fun onDestroy() {
        FormulaSheetActivity.Bridge.releaseSpeech()
        super.onDestroy()
    }
}
