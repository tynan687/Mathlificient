package com.tynan.mathtutor.realtime

import android.os.SystemClock
import com.tynan.mathtutor.config.TutorSettings
import org.json.JSONObject

/**
 * Tallies real spend from the `usage` object of each `response.done` event and
 * projects an hourly rate in AUD (GST-inclusive) so the service can downshift
 * reasoning effort before the budget cap is threatened.
 */
class CostMeter(model: String) {

    // USD per single token (published per-1M rates / 1e6), July 2026.
    private data class Rates(
        val audioIn: Double, val audioInCached: Double, val audioOut: Double,
        val textIn: Double, val textInCached: Double, val textOut: Double,
        val imageIn: Double, val imageInCached: Double,
    )

    private val rates = if (model.contains("mini")) {
        Rates(10.0e-6, 0.30e-6, 20.0e-6, 0.60e-6, 0.06e-6, 2.40e-6, 0.80e-6, 0.08e-6)
    } else {
        Rates(32.0e-6, 0.40e-6, 64.0e-6, 4.00e-6, 0.40e-6, 24.0e-6, 5.00e-6, 0.50e-6)
    }

    private val startMs = SystemClock.elapsedRealtime()

    var totalUsd = 0.0
        private set

    fun addUsage(usage: JSONObject) {
        val input = usage.optJSONObject("input_token_details") ?: JSONObject()
        val cached = input.optJSONObject("cached_tokens_details") ?: JSONObject()
        val output = usage.optJSONObject("output_token_details") ?: JSONObject()

        val cachedText = cached.optInt("text_tokens")
        val cachedAudio = cached.optInt("audio_tokens")
        val cachedImage = cached.optInt("image_tokens")
        val freshText = (input.optInt("text_tokens") - cachedText).coerceAtLeast(0)
        val freshAudio = (input.optInt("audio_tokens") - cachedAudio).coerceAtLeast(0)
        val freshImage = (input.optInt("image_tokens") - cachedImage).coerceAtLeast(0)

        totalUsd += freshText * rates.textIn +
            freshAudio * rates.audioIn +
            freshImage * rates.imageIn +
            cachedText * rates.textInCached +
            cachedAudio * rates.audioInCached +
            cachedImage * rates.imageInCached +
            output.optInt("text_tokens") * rates.textOut +
            output.optInt("audio_tokens") * rates.audioOut
    }

    /** Session total in AUD, GST-inclusive. */
    fun totalAud(): Double = totalUsd * AUD_PER_USD * GST_MULTIPLIER

    /**
     * Projected hourly spend in AUD. Elapsed time is floored at five minutes so a
     * chatty first few turns don't produce an absurd early projection.
     */
    fun projectedHourlyAud(): Double {
        val elapsedHours = (SystemClock.elapsedRealtime() - startMs) / 3_600_000.0
        return totalAud() / maxOf(elapsedHours, 5.0 / 60.0)
    }

    companion object {
        // AUD/USD 0.6982 (17 Jul 2026) → 1 USD ≈ 1.4323 AUD; OpenAI adds 10% GST for AU.
        private const val AUD_PER_USD = 1.0 / 0.6982
        private const val GST_MULTIPLIER = 1.10

        fun forSettings(settings: TutorSettings) = CostMeter(settings.model)
    }
}
