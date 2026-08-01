package com.tynan.mathtutor.memory

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Append-only log of practice attempts, backing the progress screen's bars.
 *
 * There is deliberately no maths in this class. Mastery is computed in
 * assets/formulas/practice-prof.js and recomputed on every read, so the scoring
 * rule stays in exactly one place and stays identical to the desktop app's.
 * Kotlin's whole job is to append a line and hand the file back.
 *
 * Same shape as [StudyLog]: one JSON file in filesDir, guarded by a lock,
 * corrupt content read as empty rather than thrown.
 */
class Proficiency(context: Context) {

    private val file = File(context.filesDir, "proficiency.json")
    private val lock = Any()

    /** The whole log as JSON text, ready to hand straight to the WebView. */
    fun readAll(): String = synchronized(lock) {
        if (!file.exists()) return EMPTY
        val text = file.readText()
        // Cheap sanity check — a half-written file should read as "no history",
        // never crash the progress screen.
        return try {
            JSONObject(text).optJSONArray("attempts") ?: return EMPTY
            text
        } catch (_: Exception) {
            EMPTY
        }
    }

    /** Append one attempt object, given as the JSON the JS side already built. */
    fun append(attemptJson: String) {
        synchronized(lock) {
            val attempt = try {
                JSONObject(attemptJson)
            } catch (_: Exception) {
                return
            }
            if (attempt.optString("skill").isEmpty()) return

            val array = loadArray()
            array.put(attempt)
            // Keep the file bounded: 5000 attempts is years of practice, and the
            // mastery figure is dominated by the recent tail regardless.
            val trimmed = if (array.length() > MAX_ATTEMPTS) {
                JSONArray().apply {
                    for (i in array.length() - MAX_ATTEMPTS until array.length()) put(array.get(i))
                }
            } else {
                array
            }
            file.writeText(
                JSONObject().put("version", 1).put("attempts", trimmed).toString()
            )
        }
    }

    fun reset() {
        synchronized(lock) { file.writeText(EMPTY) }
    }

    private fun loadArray(): JSONArray {
        if (!file.exists()) return JSONArray()
        return try {
            JSONObject(file.readText()).optJSONArray("attempts") ?: JSONArray()
        } catch (_: Exception) {
            JSONArray()
        }
    }

    private companion object {
        const val EMPTY = """{"version":1,"attempts":[]}"""
        const val MAX_ATTEMPTS = 5000
    }
}
