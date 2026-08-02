package com.tynan.mathtutor.ink

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.util.Base64
import android.util.TypedValue
import android.view.MotionEvent
import android.view.View
import java.io.ByteArrayOutputStream
import kotlin.math.hypot

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
 *
 * On top of that:
 *  - Holding the S Pen side button (or using a dedicated eraser end) rubs out
 *    whole strokes as the pen passes over them; the toolbar can set [eraserMode]
 *    to do the same with whatever pointer is drawing.
 *  - The paper is a large virtual sheet: two fingers pinch to zoom (0.25x–4x)
 *    and drag to pan, so zooming out gives more solving space. Strokes are kept
 *    in world coordinates; [resetView] snaps back to 1:1.
 */
class InkCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private class Stroke(val color: Int, val width: Float, val path: Path) {
        val points = ArrayList<Float>() // x,y pairs in world coords, for erasing
    }

    private val strokes = ArrayList<Stroke>()
    private var active: Stroke? = null
    private var activePointerId = MotionEvent.INVALID_POINTER_ID
    private var activeIsEraser = false
    private var lastX = 0f // world coords of the last stroke point
    private var lastY = 0f

    /** Set once a stylus is seen; from then on finger input is ignored. */
    private var stylusSeen = false

    /** null = automatic (recommended), true/false = force pen-only on/off. */
    var palmRejectOverride: Boolean? = null

    var inkColor: Int = 0xFF1E2A44.toInt()

    /** Toolbar eraser: accepted pointers erase strokes instead of inking. */
    var eraserMode = false

    /** Notified when the zoom/pan changes; `true` while not at the 1:1 origin. */
    var onViewChanged: ((transformed: Boolean) -> Unit)? = null

    // ---- View transform (pinch zoom / two-finger pan) --------------------------------

    private var viewScale = 1f
    private var viewOffsetX = 0f
    private var viewOffsetY = 0f

    private var gestureMode = false
    private var gestureId1 = MotionEvent.INVALID_POINTER_ID
    private var gestureId2 = MotionEvent.INVALID_POINTER_ID
    private var prev1X = 0f; private var prev1Y = 0f
    private var prev2X = 0f; private var prev2Y = 0f

    /** After a pinch ends, the leftover finger must not start drawing. */
    private var blockDrawingUntilAllUp = false

    private fun toWorldX(sx: Float) = (sx - viewOffsetX) / viewScale
    private fun toWorldY(sy: Float) = (sy - viewOffsetY) / viewScale

    private fun isTransformed() =
        viewScale != 1f || viewOffsetX != 0f || viewOffsetY != 0f

    private fun notifyView() = onViewChanged?.invoke(isTransformed())

    fun resetView() {
        viewScale = 1f
        viewOffsetX = 0f
        viewOffsetY = 0f
        invalidate()
        notifyView()
    }

    /** Contact patches wider than this are a palm or forearm, not a fingertip. */
    private val maxTouchMajorPx = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_MM, 14f, resources.displayMetrics
    )

    /** Screen-space eraser radius; divided by the zoom scale for world hit-tests. */
    private val eraserRadiusPx = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, 12f, resources.displayMetrics
    )

    // Feedback circle while erasing (screen coords).
    private var eraserIndicatorX = 0f
    private var eraserIndicatorY = 0f
    private var showEraserIndicator = false

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }
    private val eraserPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
        color = 0x88888888.toInt()
    }

    override fun onDraw(canvas: Canvas) {
        canvas.save()
        canvas.translate(viewOffsetX, viewOffsetY)
        canvas.scale(viewScale, viewScale)
        for (stroke in strokes) {
            paint.color = stroke.color
            paint.strokeWidth = stroke.width
            canvas.drawPath(stroke.path, paint)
        }
        canvas.restore()
        if (showEraserIndicator) {
            canvas.drawCircle(eraserIndicatorX, eraserIndicatorY, eraserRadiusPx, eraserPaint)
        }
    }

    // ---- Input acceptance ----------------------------------------------------------

    private fun penOnly(): Boolean = palmRejectOverride ?: stylusSeen

    private fun isStylus(event: MotionEvent, index: Int): Boolean {
        val type = event.getToolType(index)
        return type == MotionEvent.TOOL_TYPE_STYLUS || type == MotionEvent.TOOL_TYPE_ERASER
    }

    private fun isFingerSized(event: MotionEvent, index: Int): Boolean =
        !isStylus(event, index) && event.getTouchMajor(index) <= maxTouchMajorPx

    /** Is this pointer asking to erase right now (pen button held / eraser end / toolbar)? */
    private fun wantsErase(event: MotionEvent, index: Int): Boolean {
        if (eraserMode) return true
        if (event.getToolType(index) == MotionEvent.TOOL_TYPE_ERASER) return true
        return isStylus(event, index) &&
            (event.buttonState and MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
    }

    /** Should this pointer be allowed to start (or take over) a stroke? */
    private fun accepts(event: MotionEvent, index: Int): Boolean {
        if (blockDrawingUntilAllUp) return false
        if (isStylus(event, index)) return true
        if (penOnly()) return false                       // pen is in charge: no fingers
        return event.getTouchMajor(index) <= maxTouchMajorPx // reject palm-sized blobs
    }

    // ---- Strokes ---------------------------------------------------------------------

    private fun beginStroke(event: MotionEvent, index: Int) {
        val x = toWorldX(event.getX(index))
        val y = toWorldY(event.getY(index))
        val pressure = event.getPressure(index).coerceIn(0.2f, 1.5f)
        activePointerId = event.getPointerId(index)
        activeIsEraser = false
        // Width divided by scale so a stroke drawn while zoomed looks the same
        // thickness on screen as everything drawn at 1:1.
        active = Stroke(inkColor, (3f + pressure * 4f) / viewScale, Path().apply { moveTo(x, y) })
        active!!.points.add(x); active!!.points.add(y)
        strokes.add(active!!)
        lastX = x
        lastY = y
    }

    private fun endStroke(worldX: Float, worldY: Float) {
        active?.let {
            it.path.lineTo(worldX, worldY)
            it.points.add(worldX); it.points.add(worldY)
        }
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
        activeIsEraser = false
    }

    /** Discard an in-progress stroke entirely (e.g. a pen takes over from a finger). */
    private fun abandonStroke() {
        active?.let { strokes.remove(it) }
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
        activeIsEraser = false
    }

    /** Quadratic smoothing between the last point and the midpoint. */
    private fun addPoint(stroke: Stroke, x: Float, y: Float) {
        val midX = (lastX + x) / 2
        val midY = (lastY + y) / 2
        stroke.path.quadTo(lastX, lastY, midX, midY)
        stroke.points.add(x); stroke.points.add(y)
        lastX = x
        lastY = y
    }

    // ---- Erasing ---------------------------------------------------------------------

    private fun beginErase(event: MotionEvent, index: Int) {
        activePointerId = event.getPointerId(index)
        activeIsEraser = true
        active = null
        eraseAt(event.getX(index), event.getY(index))
    }

    /** Remove every stroke that comes within the eraser radius of this screen point. */
    private fun eraseAt(sx: Float, sy: Float): Boolean {
        val wx = toWorldX(sx)
        val wy = toWorldY(sy)
        val radius = eraserRadiusPx / viewScale
        var removed = false
        val it = strokes.iterator()
        outer@ while (it.hasNext()) {
            val stroke = it.next()
            val reach = radius + stroke.width / 2
            val pts = stroke.points
            var i = 0
            while (i < pts.size) {
                if (hypot(pts[i] - wx, pts[i + 1] - wy) <= reach) {
                    it.remove()
                    removed = true
                    continue@outer
                }
                i += 2
            }
        }
        eraserIndicatorX = sx
        eraserIndicatorY = sy
        showEraserIndicator = true
        return removed
    }

    private fun stopErasing() {
        showEraserIndicator = false
        activePointerId = MotionEvent.INVALID_POINTER_ID
        activeIsEraser = false
    }

    // ---- Pinch zoom / pan --------------------------------------------------------------

    /** Try to enter gesture mode using two finger-sized pointers. */
    private fun maybeStartGesture(event: MotionEvent): Boolean {
        if (active != null && !activeStrokeIsFinger) return false // stylus stroke wins
        var id1 = MotionEvent.INVALID_POINTER_ID
        var id2 = MotionEvent.INVALID_POINTER_ID
        for (i in 0 until event.pointerCount) {
            if (!isFingerSized(event, i)) continue
            if (id1 == MotionEvent.INVALID_POINTER_ID) id1 = event.getPointerId(i)
            else { id2 = event.getPointerId(i); break }
        }
        if (id2 == MotionEvent.INVALID_POINTER_ID) return false
        abandonStroke() // a finger stroke in progress becomes a navigation gesture
        gestureMode = true
        gestureId1 = id1
        gestureId2 = id2
        val i1 = event.findPointerIndex(id1)
        val i2 = event.findPointerIndex(id2)
        prev1X = event.getX(i1); prev1Y = event.getY(i1)
        prev2X = event.getX(i2); prev2Y = event.getY(i2)
        return true
    }

    /** True while the active stroke is drawn by a finger (not a stylus). */
    private var activeStrokeIsFinger = false

    private fun moveGesture(event: MotionEvent) {
        val i1 = event.findPointerIndex(gestureId1)
        val i2 = event.findPointerIndex(gestureId2)
        if (i1 < 0 || i2 < 0) return
        val x1 = event.getX(i1); val y1 = event.getY(i1)
        val x2 = event.getX(i2); val y2 = event.getY(i2)
        val prevDist = hypot(prev1X - prev2X, prev1Y - prev2Y).coerceAtLeast(1f)
        val newDist = hypot(x1 - x2, y1 - y2).coerceAtLeast(1f)
        val prevFocalX = (prev1X + prev2X) / 2
        val prevFocalY = (prev1Y + prev2Y) / 2
        val focalX = (x1 + x2) / 2
        val focalY = (y1 + y2) / 2

        val newScale = (viewScale * newDist / prevDist).coerceIn(0.25f, 4f)
        // Keep the world point under the (previous) focal point pinned to the new
        // focal point — this makes zoom anchor at the fingers and pan for free.
        val worldFocalX = (prevFocalX - viewOffsetX) / viewScale
        val worldFocalY = (prevFocalY - viewOffsetY) / viewScale
        viewOffsetX = focalX - worldFocalX * newScale
        viewOffsetY = focalY - worldFocalY * newScale
        viewScale = newScale

        prev1X = x1; prev1Y = y1
        prev2X = x2; prev2Y = y2
        invalidate()
        notifyView()
    }

    private fun endGesture() {
        gestureMode = false
        gestureId1 = MotionEvent.INVALID_POINTER_ID
        gestureId2 = MotionEvent.INVALID_POINTER_ID
        blockDrawingUntilAllUp = true // the leftover finger must not draw
    }

    // ---- Event handling ----------------------------------------------------------------

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                requestUnbufferedDispatch(event) // lower latency while drawing
                blockDrawingUntilAllUp = false
                if (isStylus(event, 0)) stylusSeen = true
                if (!accepts(event, 0)) return true
                if (wantsErase(event, 0)) {
                    beginErase(event, 0)
                } else {
                    beginStroke(event, 0)
                    activeStrokeIsFinger = !isStylus(event, 0)
                }
                invalidate()
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                if (isStylus(event, index)) {
                    stylusSeen = true
                    if (gestureMode) endGesture()
                    // Pen wins: drop whatever a finger/palm was drawing and follow it.
                    if (activePointerId != event.getPointerId(index)) {
                        abandonStroke()
                        if (wantsErase(event, index)) beginErase(event, index)
                        else {
                            beginStroke(event, index)
                            activeStrokeIsFinger = false
                        }
                        invalidate()
                    }
                } else if (!gestureMode && !activeIsEraser) {
                    // Two fingers = pinch zoom / pan (never drawing). A palm-sized
                    // blob still can't trigger it, and a stylus stroke blocks it.
                    maybeStartGesture(event)
                }
                // Anything else landing mid-stroke is ignored — this is the fix
                // for the long straight line.
            }

            MotionEvent.ACTION_MOVE -> {
                if (gestureMode) {
                    moveGesture(event)
                    return true
                }
                val index = event.findPointerIndex(activePointerId)
                if (index < 0) return true // our pointer is gone; ignore other pointers

                if (activeIsEraser) {
                    // Button released mid-drag → go back to inking from here.
                    if (!wantsErase(event, index)) {
                        stopErasing()
                        beginStroke(event, index)
                        activeStrokeIsFinger = !isStylus(event, index)
                        invalidate()
                        return true
                    }
                    var removed = false
                    for (h in 0 until event.historySize) {
                        if (eraseAt(event.getHistoricalX(index, h),
                                event.getHistoricalY(index, h))) removed = true
                    }
                    if (eraseAt(event.getX(index), event.getY(index))) removed = true
                    invalidate() // indicator moved even if nothing was removed
                    return true
                }

                val stroke = active ?: return true
                // Button pressed mid-stroke → the line drawn so far stays, erasing starts.
                if (wantsErase(event, index)) {
                    endStroke(toWorldX(event.getX(index)), toWorldY(event.getY(index)))
                    beginErase(event, index)
                    invalidate()
                    return true
                }
                // Replay batched samples for a smoother line, then the current point.
                for (h in 0 until event.historySize) {
                    addPoint(
                        stroke,
                        toWorldX(event.getHistoricalX(index, h)),
                        toWorldY(event.getHistoricalY(index, h)),
                    )
                }
                addPoint(stroke, toWorldX(event.getX(index)), toWorldY(event.getY(index)))
                invalidate()
            }

            MotionEvent.ACTION_POINTER_UP -> {
                val index = event.actionIndex
                val id = event.getPointerId(index)
                if (gestureMode && (id == gestureId1 || id == gestureId2)) {
                    endGesture()
                } else if (id == activePointerId) {
                    if (activeIsEraser) stopErasing()
                    else endStroke(toWorldX(event.getX(index)), toWorldY(event.getY(index)))
                    invalidate()
                }
            }

            MotionEvent.ACTION_UP -> {
                if (gestureMode) endGesture()
                blockDrawingUntilAllUp = false
                if (activeIsEraser) {
                    stopErasing()
                    invalidate()
                } else if (active != null) {
                    val index = event.findPointerIndex(activePointerId)
                    if (index >= 0) endStroke(toWorldX(event.getX(index)), toWorldY(event.getY(index)))
                    else endStroke(lastX, lastY)
                    invalidate()
                }
            }

            MotionEvent.ACTION_CANCEL -> {
                if (gestureMode) endGesture()
                blockDrawingUntilAllUp = false
                if (activeIsEraser) stopErasing()
                else if (active != null) endStroke(lastX, lastY)
                invalidate()
            }
        }
        return true
    }

    fun undo() {
        if (strokes.isNotEmpty()) {
            if (active === strokes.last()) {
                active = null
                activePointerId = MotionEvent.INVALID_POINTER_ID
                activeIsEraser = false
            }
            strokes.removeAt(strokes.size - 1)
            invalidate()
        }
    }

    fun clear() {
        strokes.clear()
        active = null
        activePointerId = MotionEvent.INVALID_POINTER_ID
        activeIsEraser = false
        invalidate()
    }

    /**
     * The working, as a base64 JPEG the tutor can look at, or null if nothing has
     * been drawn — an image of a blank page is a wasted image, and a tutor
     * describing one it cannot see is worse than it saying there is nothing there.
     *
     * The paper is drawn FIRST. This view renders transparent (its colour comes
     * from the Compose parent's background), so without it a JPEG flattens to
     * black and dark ink on black is invisible.
     *
     * Format matches ScreenCaptureManager.captureJpegBase64 — 1536px longest side,
     * quality 80 — so the session's image-cost estimate stays honest whichever
     * source a frame came from.
     */
    fun exportJpegBase64(paper: Int, maxSide: Int = 1536, quality: Int = 80): String? {
        if (strokes.isEmpty()) return null
        if (width <= 0 || height <= 0) return null
        val full = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        Canvas(full).also { c ->
            c.drawColor(paper)
            draw(c)
        }
        val longest = maxOf(full.width, full.height)
        val out = if (longest > maxSide) {
            val scale = maxSide.toFloat() / longest
            Bitmap.createScaledBitmap(
                full, (full.width * scale).toInt(), (full.height * scale).toInt(), true
            )
        } else {
            full
        }
        return ByteArrayOutputStream().use { bytes ->
            out.compress(Bitmap.CompressFormat.JPEG, quality, bytes)
            Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
        }
    }
}
