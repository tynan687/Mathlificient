package com.tynan.mathtutor.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.View
import android.view.animation.LinearInterpolator
import androidx.core.graphics.ColorUtils
import kotlin.math.sin

enum class BubbleState { LOADING, IDLE, LISTENING, THINKING, SEARCHING, TALKING, RESPONSE_DONE, ERROR }

/**
 * The chat-head. Draws a π glyph on a colored disc with a per-state animation:
 * rotating arc (loading/thinking/searching), expanding ripple (listening),
 * waveform wiggle (talking), bright ring flash (response done).
 */
class BubbleView(context: Context) : View(context) {

    var state: BubbleState = BubbleState.LOADING
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    var muted: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    var watching: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    var timerText: String? = null
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    private var phase = 0f
    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 1400
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener {
            phase = it.animatedValue as Float
            invalidate()
        }
    }

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        strokeCap = Paint.Cap.ROUND
    }
    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        animator.start()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val radius = minOf(cx, cy) * 0.62f
        val color = colorFor(state)

        val breathe = if (state == BubbleState.IDLE) 1f + 0.04f * sin(phase * TWO_PI) else 1f
        fillPaint.color = color
        canvas.drawCircle(cx, cy, radius * breathe, fillPaint)

        when (state) {
            BubbleState.LOADING, BubbleState.THINKING, BubbleState.SEARCHING -> {
                ringPaint.color = ColorUtils.setAlphaComponent(Color.WHITE, 230)
                val r = radius + 10f
                canvas.drawArc(cx - r, cy - r, cx + r, cy + r, phase * 360f, 100f, false, ringPaint)
            }

            BubbleState.LISTENING -> {
                val r = radius * (1f + 0.45f * phase)
                ringPaint.color = ColorUtils.setAlphaComponent(color, ((1f - phase) * 200).toInt())
                canvas.drawCircle(cx, cy, r, ringPaint)
            }

            BubbleState.TALKING -> {
                barPaint.color = Color.WHITE
                barPaint.strokeWidth = radius * 0.16f
                val bars = 4
                for (i in 0 until bars) {
                    val x = cx + (i - (bars - 1) / 2f) * radius * 0.42f
                    val h = radius * (0.28f + 0.32f *
                        (0.5f + 0.5f * sin(TWO_PI * (phase * 2 + i * 0.27f))))
                    canvas.drawLine(x, cy - h, x, cy + h, barPaint)
                }
            }

            BubbleState.RESPONSE_DONE -> {
                ringPaint.color = Color.WHITE
                canvas.drawCircle(cx, cy, radius + 8f, ringPaint)
            }

            else -> Unit
        }

        if (state != BubbleState.TALKING) {
            glyphPaint.textSize = radius
            val baseline = cy - (glyphPaint.ascent() + glyphPaint.descent()) / 2f
            canvas.drawText("π", cx, baseline, glyphPaint)
        }

        if (watching) {
            fillPaint.color = Color.WHITE
            canvas.drawCircle(cx + radius * 0.75f, cy - radius * 0.75f, radius * 0.16f, fillPaint)
        }

        timerText?.let { text ->
            glyphPaint.textSize = radius * 0.42f
            val tw = glyphPaint.measureText(text)
            val pillH = radius * 0.56f
            val pillW = tw + pillH
            val top = cy + radius * 0.72f
            fillPaint.color = ColorUtils.setAlphaComponent(Color.BLACK, 170)
            canvas.drawRoundRect(
                cx - pillW / 2f, top, cx + pillW / 2f, top + pillH,
                pillH / 2f, pillH / 2f, fillPaint
            )
            val baseline = top + pillH / 2f - (glyphPaint.ascent() + glyphPaint.descent()) / 2f
            canvas.drawText(text, cx, baseline, glyphPaint)
            glyphPaint.textSize = radius
        }

        if (muted) {
            fillPaint.color = ColorUtils.setAlphaComponent(Color.BLACK, 100)
            canvas.drawCircle(cx, cy, radius * breathe, fillPaint)
            ringPaint.color = Color.WHITE
            val d = radius * 0.7f
            canvas.drawLine(cx - d, cy - d, cx + d, cy + d, ringPaint)
        }
    }

    private fun colorFor(state: BubbleState): Int = when (state) {
        BubbleState.LOADING -> 0xFF8E8E93.toInt()
        BubbleState.IDLE -> 0xFF4F7DF7.toInt()
        BubbleState.LISTENING -> 0xFF2FB65D.toInt()
        BubbleState.THINKING -> 0xFF8E5CF7.toInt()
        BubbleState.SEARCHING -> 0xFFF0A322.toInt()
        BubbleState.TALKING -> 0xFF4F7DF7.toInt()
        BubbleState.RESPONSE_DONE -> 0xFF2FB65D.toInt()
        BubbleState.ERROR -> 0xFFE5484D.toInt()
    }

    private companion object {
        const val TWO_PI = (2 * Math.PI).toFloat()
    }
}
