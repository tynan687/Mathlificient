package com.tynan.mathtutor.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Classical, customisable theming. Four warm palettes with serif display type and
 * generously rounded, tonally-raised cards — a softer, more "considered" look than
 * bare Material defaults.
 */
object AppThemes {
    data class Palette(
        val key: String,
        val label: String,
        val primary: Color,
        val secondary: Color,
        val background: Color,
        val surface: Color,
        val surfaceVariant: Color,
        val onSurface: Color,
        // Hex strings handed to the WebView pages so they match the native chrome.
        val webBg: String,
        val webFg: String,
        val webCard: String,
        val webAccent: String,
    )

    val SLATE = Palette(
        key = "slate", label = "Slate",
        primary = Color(0xFF4F7DF7), secondary = Color(0xFF5C6BC0),
        background = Color(0xFFF3F5FB), surface = Color(0xFFFFFFFF),
        surfaceVariant = Color(0xFFE6EBF7), onSurface = Color(0xFF1E2A44),
        webBg = "#f3f5fb", webFg = "#1e2a44", webCard = "#ffffff", webAccent = "#4f7df7",
    )
    val PARCHMENT = Palette(
        key = "parchment", label = "Parchment",
        primary = Color(0xFFA0703C), secondary = Color(0xFF8C6D46),
        background = Color(0xFFF4ECD8), surface = Color(0xFFFBF5E6),
        surfaceVariant = Color(0xFFEADFC2), onSurface = Color(0xFF4A3826),
        webBg = "#f4ecd8", webFg = "#4a3826", webCard = "#fbf5e6", webAccent = "#a0703c",
    )
    val FOREST = Palette(
        key = "forest", label = "Forest",
        primary = Color(0xFF2E7D5B), secondary = Color(0xFF4B8B6E),
        background = Color(0xFFF0F4EF), surface = Color(0xFFFCFEFB),
        surfaceVariant = Color(0xFFDDE8DA), onSurface = Color(0xFF1F3A2E),
        webBg = "#f0f4ef", webFg = "#1f3a2e", webCard = "#fcfefb", webAccent = "#2e7d5b",
    )
    val PLUM = Palette(
        key = "plum", label = "Plum",
        primary = Color(0xFF8E4585), secondary = Color(0xFFB76E79),
        background = Color(0xFFF6F0F5), surface = Color(0xFFFFFBFE),
        surfaceVariant = Color(0xFFEBDCE8), onSurface = Color(0xFF3A2138),
        webBg = "#f6f0f5", webFg = "#3a2138", webCard = "#fffbfe", webAccent = "#8e4585",
    )

    val ALL = listOf(SLATE, PARCHMENT, FOREST, PLUM)
    val KEYS = ALL.map { it.key }

    fun byKey(key: String?): Palette = ALL.firstOrNull { it.key == key } ?: SLATE
}

/** Current theme key, seeded from settings; a change re-themes every screen live. */
object ThemeController {
    val current = MutableStateFlow(AppThemes.SLATE.key)
    fun set(key: String) { current.value = key }
}

private val serif = FontFamily.Serif

private val classicalType = Typography(
    headlineMedium = androidx.compose.ui.text.TextStyle(
        fontFamily = serif, fontWeight = FontWeight.SemiBold, fontSize = 26.sp
    ),
    titleLarge = androidx.compose.ui.text.TextStyle(
        fontFamily = serif, fontWeight = FontWeight.SemiBold, fontSize = 20.sp
    ),
    titleMedium = androidx.compose.ui.text.TextStyle(
        fontFamily = serif, fontWeight = FontWeight.Medium, fontSize = 17.sp
    ),
)

private val classicalShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
)

@Composable
fun AppTheme(paletteKey: String, content: @Composable () -> Unit) {
    val p = AppThemes.byKey(paletteKey)
    val scheme = lightColorScheme(
        primary = p.primary,
        onPrimary = Color.White,
        secondary = p.secondary,
        background = p.background,
        onBackground = p.onSurface,
        surface = p.surface,
        onSurface = p.onSurface,
        surfaceVariant = p.surfaceVariant,
        onSurfaceVariant = p.onSurface,
    )
    MaterialTheme(
        colorScheme = scheme,
        typography = classicalType,
        shapes = classicalShapes,
        content = content,
    )
}
