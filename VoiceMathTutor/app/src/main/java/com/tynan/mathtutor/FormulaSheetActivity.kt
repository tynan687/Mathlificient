package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

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

    /** Shared JS bridge for the formula sheet and practice pages. */
    class Bridge(private val activity: ComponentActivity) {
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
    }
}
