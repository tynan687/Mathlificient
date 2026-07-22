package com.tynan.mathtutor.memory

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate

/**
 * The tutor's persistent notes about the student — short durable facts saved by
 * the model via the save_student_note tool (or edited manually in Settings).
 *
 * Cost design: the prompt summary is hard-capped at ~600 tokens and rides inside
 * the static system prompt, which is prefix-cached after the first turn — so
 * personalisation adds well under one AU cent per hour of tutoring.
 */
class TutorMemory(context: Context) {

    data class Note(val date: String, val text: String)

    private val file = File(context.filesDir, "tutor_memory.json")
    private val lock = Any()

    /** Oldest-first, as stored. */
    fun notes(): List<Note> = synchronized(lock) { loadNotes() }

    fun addNote(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        synchronized(lock) {
            val notes = loadNotes().toMutableList()
            notes.add(Note(LocalDate.now().toString(), trimmed))
            saveNotes(notes)
        }
    }

    fun deleteNote(index: Int) {
        synchronized(lock) {
            val notes = loadNotes().toMutableList()
            if (index in notes.indices) {
                notes.removeAt(index)
                saveNotes(notes)
            }
        }
    }

    fun clear() {
        synchronized(lock) { saveNotes(emptyList()) }
    }

    /**
     * Newest-first bullet list for the system prompt, truncated at the cap so the
     * oldest facts fall off first once the log grows.
     */
    fun summaryForPrompt(maxChars: Int = MAX_SUMMARY_CHARS): String = synchronized(lock) {
        val sb = StringBuilder()
        for (note in loadNotes().asReversed()) {
            val line = "- [${note.date}] ${note.text}\n"
            if (sb.length + line.length > maxChars) break
            sb.append(line)
        }
        sb.toString().trimEnd()
    }

    /** Rough size estimate (~4 chars/token) for display in Settings. */
    fun approxTokens(): Int = summaryForPrompt().length / 4

    private fun loadNotes(): List<Note> {
        if (!file.exists()) return emptyList()
        return try {
            val array = JSONObject(file.readText()).optJSONArray("notes") ?: JSONArray()
            buildList {
                for (i in 0 until array.length()) {
                    val obj = array.optJSONObject(i) ?: continue
                    add(Note(obj.optString("date"), obj.optString("text")))
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveNotes(notes: List<Note>) {
        val array = JSONArray()
        notes.forEach { array.put(JSONObject().put("date", it.date).put("text", it.text)) }
        file.writeText(JSONObject().put("notes", array).toString())
    }

    companion object {
        const val MAX_SUMMARY_CHARS = 2_400 // ≈600 tokens
    }
}
