package com.tynan.mathtutor.ink

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/**
 * A simple, responsive handwriting surface for the S Pen (and finger). Keeps a
 * list of coloured strokes so undo/clear are cheap; stroke width tracks stylus
 * pressure so it feels like a pen.
 */
class InkCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private class Stroke(val color: Int, val path: Path)

    private val strokes = ArrayList<Stroke>()
    private var active: Stroke? = null
    private var lastX = 0f
    private var lastY = 0f

    var inkColor: Int = 0xFF1E2A44.toInt()

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
        strokeWidth = 5f
    }

    override fun onDraw(canvas: Canvas) {
        // Paper tint that reads well in both light and sepia themes.
        for (stroke in strokes) {
            paint.color = stroke.color
            canvas.drawPath(stroke.path, paint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val pressure = event.pressure.coerceIn(0.2f, 1.5f)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val path = Path().apply { moveTo(event.x, event.y) }
                active = Stroke(inkColor, path)
                strokes.add(active!!)
                lastX = event.x
                lastY = event.y
                paint.strokeWidth = 3f + pressure * 4f
            }

            MotionEvent.ACTION_MOVE -> {
                active?.let { s ->
                    // Quadratic smoothing between the last point and the midpoint.
                    val midX = (lastX + event.x) / 2
                    val midY = (lastY + event.y) / 2
                    s.path.quadTo(lastX, lastY, midX, midY)
                    lastX = event.x
                    lastY = event.y
                }
                invalidate()
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                active?.path?.lineTo(event.x, event.y)
                active = null
                invalidate()
            }
        }
        return true
    }

    fun undo() {
        if (strokes.isNotEmpty()) {
            strokes.removeAt(strokes.size - 1)
            invalidate()
        }
    }

    fun clear() {
        strokes.clear()
        invalidate()
    }
}
