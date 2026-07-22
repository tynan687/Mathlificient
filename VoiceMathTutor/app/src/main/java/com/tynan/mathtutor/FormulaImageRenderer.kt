package com.tynan.mathtutor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

/**
 * Renders a LaTeX string to a tightly-cropped white-background PNG in an offscreen
 * WebView (KaTeX), and returns a FileProvider URI — for pasting/sharing into
 * Samsung Notes (annotate with the S Pen) or any share target. Shared by the
 * formula sheet and the practice screens.
 */
object FormulaImageRenderer {

    fun render(context: Context, latex: String, done: (Uri) -> Unit) {
        val renderer = WebView(context)
        renderer.settings.javaScriptEnabled = true
        renderer.settings.allowFileAccess = true
        val escaped = JSONObject.quote(latex)
        val html = """
            <html><head><meta charset="utf-8">
            <link rel="stylesheet" href="katex/katex.min.css">
            <style>body{margin:0;padding:28px;background:#ffffff}#t{font-size:44px;color:#000}</style>
            </head><body><div id="t"></div>
            <script src="katex/katex.min.js"></script>
            <script>katex.render($escaped, document.getElementById('t'),
              {throwOnError:false, displayMode:true});</script>
            </body></html>
        """.trimIndent()
        val width = 1400
        val height = 700
        renderer.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                view.postDelayed({
                    view.measure(
                        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
                    )
                    view.layout(0, 0, width, height)
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(Color.WHITE)
                    view.draw(canvas)
                    val cropped = cropToContent(bitmap)
                    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
                    val file = File(dir, "formula.png")
                    file.outputStream().use { cropped.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    val uri = FileProvider.getUriForFile(
                        context, "com.tynan.mathtutor.fileprovider", file
                    )
                    renderer.destroy()
                    done(uri)
                }, 400)
            }
        }
        renderer.loadDataWithBaseURL(
            "file:///android_asset/formulas/", html, "text/html", "utf-8", null
        )
    }

    /** Crop white margins, keeping a comfortable padding. */
    private fun cropToContent(bitmap: Bitmap): Bitmap {
        val w = bitmap.width
        val h = bitmap.height
        var minX = w; var minY = h; var maxX = 0; var maxY = 0
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        for (y in 0 until h) {
            for (x in 0 until w) {
                val p = pixels[y * w + x]
                if (p != -1 && (p ushr 24) != 0) {
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                }
            }
        }
        if (minX >= maxX || minY >= maxY) return bitmap
        val pad = 28
        val left = (minX - pad).coerceAtLeast(0)
        val top = (minY - pad).coerceAtLeast(0)
        val right = (maxX + pad).coerceAtMost(w - 1)
        val bottom = (maxY + pad).coerceAtMost(h - 1)
        return Bitmap.createBitmap(bitmap, left, top, right - left + 1, bottom - top + 1)
    }
}
