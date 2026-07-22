package com.tynan.mathtutor.memory

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Local history of tutoring sessions — written by the service on session end,
 * displayed in Settings. Never sent to the API, so it costs nothing.
 */
class StudyLog(context: Context) {

    data class Entry(
        val endedAt: String,
        val durationMin: Int,
        val costAud: Double,
        val topic: String,
        val notesAdded: Int,
    )

    private val file = File(context.filesDir, "study_log.json")
    private val lock = Any()

    fun append(entry: Entry) {
        synchronized(lock) {
            val array = loadArray()
            array.put(
                JSONObject()
                    .put("endedAt", entry.endedAt)
                    .put("durationMin", entry.durationMin)
                    .put("costAud", entry.costAud)
                    .put("topic", entry.topic)
                    .put("notesAdded", entry.notesAdded)
            )
            file.writeText(JSONObject().put("sessions", array).toString())
        }
    }

    /** Newest first. */
    fun recent(n: Int = 10): List<Entry> = synchronized(lock) {
        val array = loadArray()
        buildList {
            for (i in array.length() - 1 downTo maxOf(0, array.length() - n)) {
                val obj = array.optJSONObject(i) ?: continue
                add(
                    Entry(
                        endedAt = obj.optString("endedAt"),
                        durationMin = obj.optInt("durationMin"),
                        costAud = obj.optDouble("costAud", 0.0),
                        topic = obj.optString("topic"),
                        notesAdded = obj.optInt("notesAdded"),
                    )
                )
            }
        }
    }

    private fun loadArray(): JSONArray {
        if (!file.exists()) return JSONArray()
        return try {
            JSONObject(file.readText()).optJSONArray("sessions") ?: JSONArray()
        } catch (_: Exception) {
            JSONArray()
        }
    }
}
