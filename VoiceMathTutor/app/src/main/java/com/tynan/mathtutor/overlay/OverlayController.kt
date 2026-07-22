package com.tynan.mathtutor.overlay

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.WindowManager
import kotlin.math.abs

/**
 * Draggable SYSTEM_ALERT_WINDOW bubble. Tap = ask for help with the current
 * screen. Press-and-hold = push-to-talk (when enabled in settings).
 */
class OverlayController(
    private val context: Context,
    private val onTap: () -> Unit,
    private val onHoldStart: () -> Unit,
    private val onHoldEnd: () -> Unit,
    private val onMenu: () -> Unit = {},
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val bubble = BubbleView(context)
    private val density = context.resources.displayMetrics.density
    private val sizePx = (72 * density).toInt()
    private val params = WindowManager.LayoutParams(
        sizePx, sizePx,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = (16 * density).toInt()
        y = (160 * density).toInt()
    }
    private val mainHandler = Handler(Looper.getMainLooper())
    private var added = false
    private var holding = false
    private var pendingTap: Runnable? = null
    private val holdRunnable = Runnable {
        holding = true
        onHoldStart()
    }

    fun show() {
        mainHandler.post {
            if (added) return@post
            attachTouchListener()
            windowManager.addView(bubble, params)
            added = true
        }
    }

    fun setState(state: BubbleState) {
        mainHandler.post { bubble.state = state }
    }

    fun setMuted(muted: Boolean) {
        mainHandler.post { bubble.muted = muted }
    }

    fun setWatching(watching: Boolean) {
        mainHandler.post { bubble.watching = watching }
    }

    fun setTimerText(text: String?) {
        mainHandler.post { bubble.timerText = text }
    }

    // ---- Quick-action menu (adaptive: radial on phones, list card on tablets) ----

    private var menuView: android.view.View? = null

    fun showMenu(items: List<MenuItem>, onPick: (String) -> Unit) {
        mainHandler.post {
            hideMenu()
            val bounds = windowManager.currentWindowMetrics.bounds
            val isPhone = context.resources.configuration.smallestScreenWidthDp < 600
            val bubbleCx = params.x + sizePx / 2
            val bubbleCy = params.y + sizePx / 2
            val margin = (8 * density).toInt()
            val pick: (String?) -> Unit = { id ->
                hideMenu()
                if (id != null) onPick(id)
            }
            if (isPhone) {
                val radius = 110 * density
                val buttonRadius = 28 * density
                val side = (2 * (radius + buttonRadius) + 12 * density).toInt()
                val wx = (bubbleCx - side / 2).coerceIn(0, (bounds.width() - side).coerceAtLeast(0))
                val wy = (bubbleCy - side / 2).coerceIn(0, (bounds.height() - side).coerceAtLeast(0))
                // Open the arc toward the screen centre so every button stays on-screen.
                val angle = Math.toDegrees(
                    kotlin.math.atan2(
                        (bounds.height() / 2.0 - bubbleCy),
                        (bounds.width() / 2.0 - bubbleCx)
                    )
                ).toFloat()
                addMenuWindow(RadialMenuView(context, items, angle, radius, buttonRadius, pick), wx, wy, side, side)
            } else {
                val view = buildListMenu(context, items, pick)
                view.measure(
                    android.view.View.MeasureSpec.UNSPECIFIED,
                    android.view.View.MeasureSpec.UNSPECIFIED
                )
                val w = view.measuredWidth
                val h = view.measuredHeight
                var wx = params.x + sizePx + margin
                if (wx + w > bounds.width()) wx = (params.x - w - margin).coerceAtLeast(margin)
                val wy = (bubbleCy - h / 2).coerceIn(margin, (bounds.height() - h - margin).coerceAtLeast(margin))
                addMenuWindow(view, wx, wy, w, h)
            }
        }
    }

    private fun addMenuWindow(view: android.view.View, x: Int, y: Int, w: Int, h: Int) {
        val menuParams = WindowManager.LayoutParams(
            w, h,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            this.x = x
            this.y = y
        }
        menuView = view
        windowManager.addView(view, menuParams)
    }

    fun hideMenu() {
        menuView?.let { runCatching { windowManager.removeView(it) } }
        menuView = null
    }

    fun flashResponseDone() {
        mainHandler.post {
            bubble.state = BubbleState.RESPONSE_DONE
            mainHandler.postDelayed({
                if (bubble.state == BubbleState.RESPONSE_DONE) bubble.state = BubbleState.IDLE
            }, 1_200)
        }
    }

    fun hide() {
        mainHandler.post {
            hideMenu()
            if (added) {
                runCatching { windowManager.removeView(bubble) }
                added = false
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachTouchListener() {
        var downRawX = 0f
        var downRawY = 0f
        var startX = 0
        var startY = 0
        var downTime = 0L
        var dragging = false
        // Deliberately stiff: the bubble should not wander while tapping — it takes a
        // clear, intentional drag (~4× the normal threshold) to move it.
        val slop = ViewConfiguration.get(context).scaledTouchSlop * 4

        bubble.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = params.x
                    startY = params.y
                    downTime = SystemClock.elapsedRealtime()
                    dragging = false
                    holding = false
                    mainHandler.postDelayed(holdRunnable, HOLD_DELAY_MS)
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downRawX
                    val dy = event.rawY - downRawY
                    if (dragging || abs(dx) > slop || abs(dy) > slop) {
                        if (!dragging && !holding) mainHandler.removeCallbacks(holdRunnable)
                        dragging = true
                        params.x = startX + dx.toInt()
                        params.y = startY + dy.toInt()
                        windowManager.updateViewLayout(bubble, params)
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    mainHandler.removeCallbacks(holdRunnable)
                    when {
                        holding -> {
                            holding = false
                            onHoldEnd()
                        }

                        dragging -> snapToEdge()

                        SystemClock.elapsedRealtime() - downTime < TAP_MAX_MS -> {
                            // Single tap opens the quick-action menu (fires after the
                            // double-tap window); double-tap asks for the hint/snapshot.
                            val pending = pendingTap
                            if (pending != null) {
                                mainHandler.removeCallbacks(pending)
                                pendingTap = null
                                onTap()
                            } else {
                                val runnable = Runnable {
                                    pendingTap = null
                                    onMenu()
                                }
                                pendingTap = runnable
                                mainHandler.postDelayed(runnable, DOUBLE_TAP_WINDOW_MS)
                            }
                        }
                    }
                    true
                }

                else -> false
            }
        }
    }

    /** After a drag, glide the bubble to the nearer screen edge so it never blocks work. */
    private fun snapToEdge() {
        val screenWidth = windowManager.currentWindowMetrics.bounds.width()
        val margin = (16 * density).toInt()
        val targetX = if (params.x + sizePx / 2 < screenWidth / 2) {
            margin
        } else {
            screenWidth - sizePx - margin
        }
        ValueAnimator.ofInt(params.x, targetX).apply {
            duration = 180
            addUpdateListener { animator ->
                params.x = animator.animatedValue as Int
                if (added) runCatching { windowManager.updateViewLayout(bubble, params) }
            }
            start()
        }
    }

    private companion object {
        const val HOLD_DELAY_MS = 450L
        const val TAP_MAX_MS = 400L
        const val DOUBLE_TAP_WINDOW_MS = 280L
    }
}
