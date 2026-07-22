package com.tynan.mathtutor.memory

import android.content.Context
import java.time.LocalDate

/**
 * Cross-session spend totals (AUD, GST-inclusive), one bucket per calendar day.
 * Flushed from the service on every usage event so a crash loses at most one turn.
 */
class SpendTracker(context: Context) {

    private val prefs = context.getSharedPreferences("spend_prefs", Context.MODE_PRIVATE)

    fun add(aud: Double) {
        if (aud <= 0) return
        val key = key(LocalDate.now())
        prefs.edit().putFloat(key, (prefs.getFloat(key, 0f) + aud).toFloat()).apply()
    }

    fun todayAud(): Double = prefs.getFloat(key(LocalDate.now()), 0f).toDouble()

    /** Rolling total over the last 7 days, including today. */
    fun weekAud(): Double {
        val today = LocalDate.now()
        return (0L..6L).sumOf { prefs.getFloat(key(today.minusDays(it)), 0f).toDouble() }
    }

    private fun key(date: LocalDate) = "spend_$date"
}
