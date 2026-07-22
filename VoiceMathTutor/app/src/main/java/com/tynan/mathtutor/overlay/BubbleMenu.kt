package com.tynan.mathtutor.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

data class MenuItem(val id: String, val glyph: String, val label: String)

/**
 * Phone-style circular quick-action menu: icon buttons on an arc around the
 * bubble, opening toward the screen centre so it always fits.
 */
@SuppressLint("ViewConstructor")
class RadialMenuView(
    context: Context,
    private val items: List<MenuItem>,
    private val centerAngleDeg: Float,
    private val radius: Float,
    private val buttonRadius: Float,
    private val onPick: (String?) -> Unit,
) : View(context) {

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xF01E2A44.toInt() }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        color = Color.WHITE
    }
    private val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = buttonRadius * 0.95f
    }

    private data class Slot(val x: Float, val y: Float, val item: MenuItem)

    private var slots: List<Slot> = emptyList()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val cx = w / 2f
        val cy = h / 2f
        val step = 44f
        val start = centerAngleDeg - step * (items.size - 1) / 2f
        slots = items.mapIndexed { index, item ->
            val a = Math.toRadians((start + step * index).toDouble())
            Slot(cx + radius * cos(a).toFloat(), cy + radius * sin(a).toFloat(), item)
        }
    }

    override fun onDraw(canvas: Canvas) {
        for (slot in slots) {
            canvas.drawCircle(slot.x, slot.y, buttonRadius, bgPaint)
            canvas.drawCircle(slot.x, slot.y, buttonRadius, ringPaint)
            val baseline = slot.y - (glyphPaint.ascent() + glyphPaint.descent()) / 2f
            canvas.drawText(slot.item.glyph, slot.x, baseline, glyphPaint)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_OUTSIDE -> {
                onPick(null)
                return true
            }
            MotionEvent.ACTION_UP -> {
                val hit = slots.firstOrNull {
                    hypot(event.x - it.x, event.y - it.y) <= buttonRadius * 1.25f
                }
                onPick(hit?.item?.id)
                return true
            }
        }
        return true
    }
}

/** Tablet-style compact list menu (icon + label rows). */
@SuppressLint("ClickableViewAccessibility")
fun buildListMenu(
    context: Context,
    items: List<MenuItem>,
    onPick: (String?) -> Unit,
): LinearLayout {
    val density = context.resources.displayMetrics.density
    val container = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        background = GradientDrawable().apply {
            cornerRadius = 14 * density
            setColor(0xF01E2A44.toInt())
        }
        val pad = (6 * density).toInt()
        setPadding(pad, pad, pad, pad)
    }
    for (item in items) {
        val row = TextView(context).apply {
            text = "${item.glyph}  ${item.label}"
            setTextColor(Color.WHITE)
            textSize = 15f
            gravity = Gravity.CENTER_VERTICAL
            val padH = (14 * density).toInt()
            val padV = (10 * density).toInt()
            setPadding(padH, padV, padH, padV)
            setOnClickListener { onPick(item.id) }
        }
        container.addView(row)
    }
    container.setOnTouchListener { _, event ->
        if (event.actionMasked == MotionEvent.ACTION_OUTSIDE) {
            onPick(null)
            true
        } else {
            false
        }
    }
    return container
}
