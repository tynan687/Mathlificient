package com.tynan.mathtutor.util

import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager

/**
 * Full display bounds, including the system bars.
 *
 * `WindowManager.currentWindowMetrics` is API 30, and the app supports API 29,
 * so Android 10 falls back to the deprecated `getRealMetrics`. Both report the
 * same thing for a non-Activity context, which is all the callers here need
 * (the overlay bubble, its menu placement, and the screen-capture surface).
 */
@Suppress("DEPRECATION")
fun screenBounds(context: Context): Rect {
    val wm = context.getSystemService(WindowManager::class.java)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        wm.currentWindowMetrics.bounds
    } else {
        val metrics = DisplayMetrics().also { wm.defaultDisplay.getRealMetrics(it) }
        Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
    }
}
