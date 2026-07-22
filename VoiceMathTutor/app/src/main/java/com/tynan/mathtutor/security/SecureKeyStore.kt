package com.tynan.mathtutor.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.tynan.mathtutor.config.TutorSettings

/**
 * Stores the OpenAI API key (and tutor settings) in EncryptedSharedPreferences
 * backed by an AES-256-GCM Android Keystore master key. The key never leaves the
 * device and is used only to mint short-lived ephemeral client secrets.
 */
class SecureKeyStore(context: Context) {

    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context.applicationContext,
            "tutor_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var apiKey: String?
        get() = prefs.getString(KEY_API, null)
        set(value) {
            prefs.edit().putString(KEY_API, value?.trim()).apply()
        }

    fun loadSettings(): TutorSettings = TutorSettings(
        model = prefs.getString(KEY_MODEL, null) ?: TutorSettings.MODEL_FLAGSHIP,
        reasoningEffort = prefs.getString(KEY_EFFORT, null) ?: "high",
        vadEagerness = prefs.getString(KEY_EAGERNESS, null) ?: "low",
        voice = prefs.getString(KEY_VOICE, null) ?: "marin",
        pushToTalk = prefs.getBoolean(KEY_PTT, false),
        softCapAud = prefs.getFloat(KEY_SOFT_CAP, 12f).toDouble(),
        personalisationEnabled = prefs.getBoolean(KEY_PERSONALISATION, true),
        currentTopic = prefs.getString(KEY_TOPIC, null) ?: TutorSettings.DEFAULT_TOPIC,
        tapAction = prefs.getString(KEY_TAP_ACTION, null) ?: TutorSettings.TAP_HINT,
        watchMode = prefs.getBoolean(KEY_WATCH_MODE, false),
        watchIntervalSec = prefs.getInt(KEY_WATCH_INTERVAL, 20),
        courseProfile = prefs.getString(KEY_COURSE, null) ?: TutorSettings.COURSE_ENGINEERING,
        appTheme = prefs.getString(KEY_APP_THEME, null) ?: "slate",
        studioBgColor = prefs.getInt(KEY_STUDIO_BG, 0xFFFFFFFF.toInt()),
    )

    fun saveSettings(settings: TutorSettings) {
        prefs.edit()
            .putString(KEY_MODEL, settings.model)
            .putString(KEY_EFFORT, settings.reasoningEffort)
            .putString(KEY_EAGERNESS, settings.vadEagerness)
            .putString(KEY_VOICE, settings.voice)
            .putBoolean(KEY_PTT, settings.pushToTalk)
            .putFloat(KEY_SOFT_CAP, settings.softCapAud.toFloat())
            .putBoolean(KEY_PERSONALISATION, settings.personalisationEnabled)
            .putString(KEY_TOPIC, settings.currentTopic)
            .putString(KEY_TAP_ACTION, settings.tapAction)
            .putBoolean(KEY_WATCH_MODE, settings.watchMode)
            .putInt(KEY_WATCH_INTERVAL, settings.watchIntervalSec)
            .putString(KEY_COURSE, settings.courseProfile)
            .putString(KEY_APP_THEME, settings.appTheme)
            .putInt(KEY_STUDIO_BG, settings.studioBgColor)
            .apply()
    }

    private companion object {
        const val KEY_API = "openai_api_key"
        const val KEY_MODEL = "model"
        const val KEY_EFFORT = "reasoning_effort"
        const val KEY_EAGERNESS = "vad_eagerness"
        const val KEY_VOICE = "voice"
        const val KEY_PTT = "push_to_talk"
        const val KEY_SOFT_CAP = "soft_cap_aud"
        const val KEY_PERSONALISATION = "personalisation_enabled"
        const val KEY_TOPIC = "current_topic"
        const val KEY_TAP_ACTION = "tap_action"
        const val KEY_WATCH_MODE = "watch_mode"
        const val KEY_WATCH_INTERVAL = "watch_interval_sec"
        const val KEY_COURSE = "course_profile"
        const val KEY_APP_THEME = "app_theme"
        const val KEY_STUDIO_BG = "studio_bg_color"
    }
}
