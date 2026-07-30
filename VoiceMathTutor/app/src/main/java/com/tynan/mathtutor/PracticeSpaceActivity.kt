package com.tynan.mathtutor

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.tynan.mathtutor.ink.InkCanvasView
import com.tynan.mathtutor.security.SecureKeyStore
import com.tynan.mathtutor.ui.AppTheme
import com.tynan.mathtutor.ui.AppThemes
import com.tynan.mathtutor.ui.ThemeController
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * The sit-down practice surface: a generated question up top (WebView, reusing the
 * shared page), and an S Pen ink canvas below to work it by hand. No floating
 * window, no leaving the app.
 */
class PracticeSpaceActivity : ComponentActivity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "Practice Studio"
        val keyStore = SecureKeyStore(this)
        val settings = keyStore.loadSettings()
        ThemeController.set(settings.appTheme)
        val payload = intent.getStringExtra("payload")

        setContent {
            val themeKey by ThemeController.current.collectAsState()
            AppTheme(themeKey) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Studio(
                        topic = settings.currentTopic,
                        payload = payload,
                        initialBg = settings.studioBgColor,
                        onBgChange = { argb ->
                            keyStore.saveSettings(keyStore.loadSettings().copy(studioBgColor = argb))
                        },
                    )
                }
            }
        }
    }
}

// Inks that read well on light vs. dark paper — chosen automatically from the
// background's luminance so strokes are always visible.
private val DARK_INKS = listOf(
    Color(0xFF1E2A44), Color(0xFF1565C0), Color(0xFFC62828), Color(0xFF2E7D32),
)
private val LIGHT_INKS = listOf(
    Color(0xFFF5F5F5), Color(0xFF90CAF9), Color(0xFFEF9A9A), Color(0xFFA5D6A7),
)

private data class Paper(val label: String, val color: Color)
private val PAPERS = listOf(
    Paper("White", Color(0xFFFFFFFF)),
    Paper("Grey", Color(0xFFCBCBCB)),
    Paper("Sepia", Color(0xFFF4ECD8)),
    Paper("Dark", Color(0xFF1C1C1E)),
)

private fun isDarkPaper(c: Color): Boolean = c.luminance() < 0.4f

/** A colour that reads clearly on top of the given paper. */
private fun contentOn(paper: Color): Color =
    if (isDarkPaper(paper)) Color(0xFFF0F0F0) else Color(0xFF1A1A1A)

private fun Color.toHex(): String = String.format("#%06X", 0xFFFFFF and toArgb())

@Composable
private fun Studio(
    topic: String,
    payload: String?,
    initialBg: Int,
    onBgChange: (Int) -> Unit,
) {
    var canvas by remember { mutableStateOf<InkCanvasView?>(null) }
    var web by remember { mutableStateOf<WebView?>(null) }
    var bg by remember { mutableStateOf(Color(initialBg)) }
    var selected by remember { mutableStateOf(0) }
    var showRgb by remember { mutableStateOf(false) }
    val inks = if (isDarkPaper(bg)) LIGHT_INKS else DARK_INKS
    val content = contentOn(bg)                              // toolbar text/icons
    val toolbarBg = lerp(bg, content, 0.07f)                 // subtle separation

    fun paintWeb(view: WebView?, paper: Color) {
        view?.evaluateJavascript(
            "applyPaper('${paper.toHex()}','${contentOn(paper).toHex()}')"
        ) {
            // The recolour lands on the WebView's renderer thread; without an
            // Android-side draw afterwards the old frame can stay on screen
            // (Samsung defers idle WebView frames). Redraw once now and once
            // shortly after the new frame is ready.
            view.postInvalidateOnAnimation()
            view.postDelayed({ view.invalidate() }, 150)
        }
    }

    fun applyBg(c: Color) {
        bg = c
        onBgChange(c.toArgb())
        selected = 0
        canvas?.inkColor = (if (isDarkPaper(c)) LIGHT_INKS else DARK_INKS)[0].toArgb()
        paintWeb(web, c) // theme the question area to match the paper
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(bg),
    ) {
        // Question (reuses the shared practice page + generators).
        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.42f),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.allowFileAccess = true
                    setBackgroundColor(bg.toArgb())
                    addJavascriptInterface(FormulaSheetActivity.Bridge(ctx as ComponentActivity), "Android")
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String?) {
                            view.evaluateJavascript(
                                "setPreferredTopic(${JSONObject.quote(topic)})", null
                            )
                            payload?.let {
                                view.evaluateJavascript("showPractice(${JSONObject.quote(it)})", null)
                            }
                            paintWeb(view, bg) // whole page matches the paper colour
                        }
                    }
                    web = this
                    loadUrl("file:///android_asset/formulas/practice.html")
                }
            },
        )

        // Ink toolbar.
        Row(
            Modifier
                .fillMaxWidth()
                .background(toolbarBg)
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Ink →", style = MaterialTheme.typography.titleMedium, color = content)
            inks.forEachIndexed { i, c ->
                Box(
                    Modifier
                        .size(30.dp)
                        .background(c, CircleShape)
                        .border(
                            width = if (selected == i) 3.dp else 1.dp,
                            color = if (selected == i) content else content.copy(alpha = 0.3f),
                            shape = CircleShape,
                        )
                        .clickable {
                            selected = i
                            canvas?.inkColor = c.toArgb()
                        }
                )
            }
            Box(Modifier.weight(1f))
            OutlinedButton(
                onClick = { canvas?.undo() },
                border = BorderStroke(1.dp, content.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = content),
            ) { Text("Undo") }
            OutlinedButton(
                onClick = { canvas?.clear() },
                border = BorderStroke(1.dp, content.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = content),
            ) { Text("Clear") }
        }

        // Paper (background) toolbar.
        Row(
            Modifier
                .fillMaxWidth()
                .background(toolbarBg)
                .padding(start = 12.dp, end = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Paper →", style = MaterialTheme.typography.titleMedium, color = content)
            PAPERS.forEach { paper ->
                val active = paper.color.toArgb() == bg.toArgb()
                Box(
                    Modifier
                        .size(30.dp)
                        .background(paper.color, CircleShape)
                        .border(
                            width = if (active) 3.dp else 1.dp,
                            color = if (active) content else content.copy(alpha = 0.35f),
                            shape = CircleShape,
                        )
                        .clickable { applyBg(paper.color) }
                )
            }
            Box(Modifier.weight(1f))
            OutlinedButton(
                onClick = { showRgb = true },
                border = BorderStroke(1.dp, content.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = content),
            ) { Text("🎨 RGB") }
        }

        // Handwriting surface.
        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.60f)
                .background(bg),
            factory = { ctx ->
                InkCanvasView(ctx).apply {
                    inkColor = (if (isDarkPaper(bg)) LIGHT_INKS else DARK_INKS)[0].toArgb()
                    canvas = this
                }
            },
        )
    }

    if (showRgb) {
        RgbPickerDialog(
            initial = bg,
            onDismiss = { showRgb = false },
            onPick = { applyBg(it); showRgb = false },
        )
    }
}

/** A dependency-free RGB colour picker: three sliders and a live preview. */
@Composable
private fun RgbPickerDialog(initial: Color, onDismiss: () -> Unit, onPick: (Color) -> Unit) {
    var r by remember { mutableStateOf((initial.red * 255).roundToInt().toFloat()) }
    var g by remember { mutableStateOf((initial.green * 255).roundToInt().toFloat()) }
    var b by remember { mutableStateOf((initial.blue * 255).roundToInt().toFloat()) }
    val preview = Color(r / 255f, g / 255f, b / 255f)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Custom paper colour") },
        text = {
            Column {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .background(preview, RoundedCornerShape(10.dp))
                        .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                            RoundedCornerShape(10.dp))
                )
                ChannelSlider("Red", r, Color(0xFFC62828)) { r = it }
                ChannelSlider("Green", g, Color(0xFF2E7D32)) { g = it }
                ChannelSlider("Blue", b, Color(0xFF1565C0)) { b = it }
                Text(
                    "#%02X%02X%02X".format(r.toInt(), g.toInt(), b.toInt()),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onPick(Color(r / 255f, g / 255f, b / 255f)) }) { Text("Apply") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun ChannelSlider(label: String, value: Float, tint: Color, onChange: (Float) -> Unit) {
    Text("$label  ${value.toInt()}", style = MaterialTheme.typography.bodySmall)
    Slider(
        value = value,
        onValueChange = onChange,
        valueRange = 0f..255f,
        colors = androidx.compose.material3.SliderDefaults.colors(
            thumbColor = tint, activeTrackColor = tint,
        ),
    )
}
