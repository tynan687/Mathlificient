package com.tynan.mathtutor.ink

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.util.TypedValue
import android.view.MotionEvent
import android.view.View

/**
 * Handwriting surface for the S Pen (and finger on devices without one).
 *
 * Palm rejection matters here: resting a hand on the glass while writing used to
 * hijack the in-progress stroke and draw a long straight line to the palm. Two
 * rules prevent that:
 *  1. A stroke is bound to ONE pointer id and always reads that pointer's
 *     coordinates — never whatever happens to be at index 0.
 *  2. Once a stylus has been seen, finger/palm touches are ignored entirely
 *     (what Samsung Notes does); oversized contact patches are rejected too.
 */
class InkCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private class Stroke(val color: Int, val width: Float, val path: Path)

    private val strokes = ArrayList<Stroke>()
    private var active: Stroke? = null
    private var activePointerId = MotionEvent.INVALID_POINTER_ID
    private var lastX = 0f
    private var lastY = 0f

    /** Set once a stylus is seen; from then on finger input is ignored. */
    private var stylusSeen = false

    /** null = automatic (recommended), true/false = force pen-only on/off. */
    var palmRejectOverride: Boolean? = null

    var inkColor: Int = 0xFF1E2A44.toInt()

    /** Contact patches wider than this are a palm or forearm, not a fingertip. */
    private val maxTouchMajorPx = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_MM, 14f, resources.displayMetrics
    )

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    override fun onDraw(canvas: Canvas) {
        for (stroke in strokes) {
            paint.color = stroke.color
            paint.strokeWidth = stroke.width
            canvas.drawPath(stroke.path, paint)
        }
    }

    // ---- Input acceptance ----------------------------------------------------------

    private fun penOnly(): Boolean = palmRejectOverride ?: stylusSeen

    private fun isStylus(event: MotionEvent, index: Int): Boolean {
        val type = event.getToolType(index)
        return type == MotionEvent.TOOL_TYPE_STYLUS || type == MotionEvent.TOOL_TYPE_ERASER
    }

    /** Should this pointer be allowed to start (or take over) a stroke? */
    private fun accepts(event: MotionEvent, index: Int): Boolean {
        if (isStylus(event, index)) return true
        if (penOnly()) return false                       // pen is in charge: no fingers
        return event.getTouchMajor(index) <= maxTouchMajorPx // reject palm-sized blobs
    }

    private fun beginStroke(event: MotionEvent, index: Int) {
        val x = event.getX(index)
        val y = event.getY(index)
        val pressure = event.getPressure(index).coerceIn(0.2f, 1.5f)
        activePointerId = event.getPointerId(index)
        active = Stroke(inkColor, 3f + pressure * 4f, Path().apply { moveTo(x, y) })
        strokes.add(active!!)
        lastX = x
        lastY = y
    }

    private fun endStroke(finalX: Float, finalY: Float) {
        active?.path?.lineTo(finalX, finalY)
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
    }

    /** Discard an in-progress stroke entirely (e.g. a pen takes over from a finger). */
    private fun abandonStroke() {
        active?.let { strokes.remove(it) }
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                requestUnbufferedDispatch(event) // lower latency while drawing
                if (isStylus(event, 0)) stylusSeen = true
                if (event.getToolType(0) == MotionEvent.TOOL_TYPE_ERASER) {
                    undo() // S Pen side button erases instead of drawing
                    return true
                }
                if (!accepts(event, 0)) return true
                beginStroke(event, 0)
                invalidate()
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                if (isStylus(event, index)) {
                    stylusSeen = true
                    // Pen wins: drop whatever a finger/palm was drawing and follow it.
                    if (activePointerId != event.getPointerId(index)) {
                        abandonStroke()
                        beginStroke(event, index)
                        invalidate()
                    }
                }
                // A finger or palm landing mid-stroke is ignored — this is the fix
                // for the long straight line.
            }

            MotionEvent.ACTION_MOVE -> {
                if (active == null) return true
                val index = event.findPointerIndex(activePointerId)
                if (index < 0) return true // our pointer is gone; ignore other pointers
                val stroke = active ?: return true
                // Replay batched samples for a smoother line, then the current point.
                for (h in 0 until event.historySize) {
                    addPoint(stroke, event.getHistoricalX(index, h), event.getHistoricalY(index, h))
                }
                addPoint(stroke, event.getX(index), event.getY(index))
                invalidate()
            }

            MotionEvent.ACTION_POINTER_UP -> {
                val index = event.actionIndex
                if (event.getPointerId(index) == activePointerId) {
                    endStroke(event.getX(index), event.getY(index))
                    invalidate()
                }
            }

            MotionEvent.ACTION_UP -> {
                val index = event.findPointerIndex(activePointerId)
                if (active != null) {
                    if (index >= 0) endStroke(event.getX(index), event.getY(index))
                    else endStroke(lastX, lastY)
                    invalidate()
                }
            }

            MotionEvent.ACTION_CANCEL -> {
                if (active != null) {
                    endStroke(lastX, lastY)
                    invalidate()
                }
            }
        }
        return true
    }

    /** Quadratic smoothing between the last point and the midpoint. */
    private fun addPoint(stroke: Stroke, x: Float, y: Float) {
        val midX = (lastX + x) / 2
        val midY = (lastY + y) / 2
        stroke.path.quadTo(lastX, lastY, midX, midY)
        lastX = x
        lastY = y
    }

    fun undo() {
        if (strokes.isNotEmpty()) {
            if (active === strokes.last()) {
                active = null
                activePointerId = MotionEvent.INVALID_POINTER_ID
            }
            strokes.removeAt(strokes.size - 1)
            invalidate()
        }
    }

    fun clear() {
        strokes.clear()
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
        invalidate()
    }
}
