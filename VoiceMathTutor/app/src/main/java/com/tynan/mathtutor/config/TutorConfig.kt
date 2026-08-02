package com.tynan.mathtutor.config

import org.json.JSONArray
import org.json.JSONObject

data class TutorSettings(
    val model: String = MODEL_FLAGSHIP,
    val reasoningEffort: String = "high",
    val vadEagerness: String = "low",
    val voice: String = "marin",
    // Mic locked by default: hold the bubble to talk. Turning this off unlocks
    // the hands-free open mic (voice detection).
    val pushToTalk: Boolean = true,
    val softCapAud: Double = 12.0,
    val personalisationEnabled: Boolean = true,
    val currentTopic: String = DEFAULT_TOPIC,
    val tapAction: String = TAP_HINT,
    val watchMode: Boolean = false,
    val watchIntervalSec: Int = 20,
    val courseProfile: String = COURSE_ENGINEERING,
    val appTheme: String = "slate",
    val studioBgColor: Int = 0xFFFFFFFF.toInt(), // Practice Studio paper colour (ARGB)
) {
    companion object {
        const val MODEL_FLAGSHIP = "gpt-realtime-2.1"
        const val MODEL_MINI = "gpt-realtime-2.1-mini"
        const val DEFAULT_TOPIC = "partial fraction decomposition"
        const val TAP_HINT = "hint"
        const val TAP_SNAPSHOT = "snapshot"
        val MODELS = listOf(MODEL_FLAGSHIP, MODEL_MINI)
        val EFFORTS = listOf("minimal", "low", "medium", "high", "xhigh")
        val EAGERNESS = listOf("low", "medium", "high", "auto")
        val VOICES = listOf("marin", "cedar")
        val TAP_ACTIONS = listOf(TAP_HINT, TAP_SNAPSHOT)
        val WATCH_INTERVALS = listOf(10, 20, 40)
        const val COURSE_ENGINEERING = "engineering"
        val COURSES = listOf(COURSE_ENGINEERING, "hsc-advanced", "hsc-ext1", "hsc-ext2")
    }
}

object TutorConfig {

    private fun courseScope(profile: String): String = when (profile) {
        "hsc-advanced" ->
            "The NSW HSC Mathematics Advanced course: functions and graphs, trigonometric " +
                "functions, calculus (differentiation and integration), exponentials & " +
                "logarithms, statistical analysis and financial mathematics."
        "hsc-ext1" ->
            "The NSW HSC Mathematics Extension 1 course: the Advanced content plus further " +
                "calculus, combinatorics, polynomials, vectors, trigonometric identities, " +
                "proof by induction, and the binomial distribution."
        "hsc-ext2" ->
            "The NSW HSC Mathematics Extension 2 course: the nature of proof, complex " +
                "numbers, further calculus and mechanics, alongside Extension 1 content."
        else ->
            "An engineering foundation course spanning equations & complex numbers, " +
                "functions, differentiation and integration; much of the working involves " +
                "fractions, sign handling, factoring and polynomials - watch especially " +
                "for sign flips, illegal cancellations, and factoring slips."
    }

    private fun basePrompt(topic: String, profile: String): String = """
        You are a Socratic voice tutor for the student's mathematics course.
        You speak only - you NEVER read out or dictate final answers, and you never state the
        final result of the student's problem. You guide by asking one focused question at a
        time and giving small hints, at an easy, encouraging pace.

        WHETHER, NOT WHAT: you may tell the student their answer is right or wrong - use the
        check_my_answer tool for that, never your own arithmetic - but you still never say what
        the answer is. "That's it" is fine. "No, it's minus three" is not, even after they have
        got it wrong twice; nudge them to the step instead.

        VOICE: dry, warm, quick. You like this stuff and it shows. A little wit when they get it
        right, and a lightness when they don't - the tone of a good demonstrator who has seen
        this mistake three hundred times and still finds the fix satisfying. Keep it to a phrase;
        a joke that costs them their train of thought is a bad joke. Never sarcastic about a
        wrong answer, never arch about a basic question, and drop the humour entirely if they
        sound tired or frustrated - read the room over the bit.

        SCOPE: ${courseScope(profile)} The student is CURRENTLY WORKING ON:
        $topic. Center examples and hints there for now, but support the whole course.

        WHAT YOU SEE: You periodically receive a screenshot of the student's tablet screen,
        which may include S Pen handwriting in a notes app or a PDF. Read it carefully. Reference
        specific things you see ("I see on the third line you factored the denominator as...").
        If the image is unclear, say so and ask them to zoom or rewrite rather than guessing.

        BEHAVIOUR UNDER SILENCE: The student is usually working silently. Do NOT speak unless the
        student has just spoken to you or the app tells you they tapped for help. Never fill
        silence. Never interrupt. When they do speak, respond concisely.

        METHOD: Diagnose the likely misconception, then ask a leading question or suggest the
        next small step. Praise correct steps. If they're stuck, escalate hints gradually: nudge
        -> strategy -> a worked ANALOGOUS mini-example with different numbers (never their actual
        answer). Comment on workflow ("try writing the setup before substituting").

        REASONING: Reason before responding on multi-step diagnoses; answer simple check-ins
        quickly. Keep spoken replies short and warm. Do not reveal your internal reasoning.
    """.trimIndent()

    private val MEMORY_TOOL_GUIDANCE = """
        MEMORY: You have a save_student_note tool. When you notice a DURABLE fact worth
        remembering across sessions - a recurring misconception, a skill they have clearly
        mastered, a learning preference, or that they have moved to a new topic - call it with
        one concise sentence. Use it sparingly (a few times per session at most), never for
        transcripts or one-off details, and do not announce that you are saving a note.
    """.trimIndent()

    private val WATCH_MODE_GUIDANCE = """
        WATCH MODE: The app periodically sends you a screenshot of the student's working
        together with a silent CHECK request. For a CHECK you must reply in TEXT ONLY with
        exactly "OK" if the visible working is correct, unfinished, or unclear - or
        "ALERT: <one short sentence naming the specific line and the error>" if there is a
        CLEAR mathematical mistake. Never flag half-written steps, style, or anything you
        are not sure about. When the app afterwards asks you to speak about a flagged
        mistake, deliver it as one brief, kind interruption.
    """.trimIndent()

    const val WATCH_CHECK_INSTRUCTIONS =
        "CHECK: Examine the newest screenshot of the student's working. Reply in text " +
            "only with exactly 'OK' or 'ALERT: <one short sentence naming the line and " +
            "the error>'. Do not speak."

    /** Full instructions: base prompt + (when personalised) memory guidance and profile. */
    fun instructions(settings: TutorSettings, memorySummary: String?): String {
        val sb = StringBuilder(
            basePrompt(
                settings.currentTopic.ifBlank { TutorSettings.DEFAULT_TOPIC },
                settings.courseProfile
            )
        )
        if (settings.personalisationEnabled) {
            sb.append("\n\n").append(MEMORY_TOOL_GUIDANCE)
            if (!memorySummary.isNullOrBlank()) {
                sb.append("\n\nWHAT YOU KNOW ABOUT THIS STUDENT (saved in previous sessions, newest first):\n")
                sb.append(memorySummary)
            }
        }
        if (settings.watchMode) {
            sb.append("\n\n").append(WATCH_MODE_GUIDANCE)
        }
        return sb.toString()
    }

    /**
     * Builds the Realtime session object, used both for minting the ephemeral client
     * secret (includeModel = true) and for session.update over the data channel
     * (includeModel = false — the model cannot change mid-session).
     */
    fun sessionObject(
        settings: TutorSettings,
        includeModel: Boolean,
        effortOverride: String? = null,
        memorySummary: String? = null,
    ): JSONObject {
        val turnDetection: Any = if (settings.pushToTalk) {
            JSONObject.NULL
        } else {
            JSONObject()
                .put("type", "semantic_vad")
                .put("eagerness", settings.vadEagerness)
                .put("create_response", true)
                .put("interrupt_response", true)
        }
        val session = JSONObject()
            .put("type", "realtime")
            .put("output_modalities", JSONArray().put("audio"))
            .put("instructions", instructions(settings, memorySummary))
            .put(
                "audio",
                JSONObject()
                    .put("input", JSONObject().put("turn_detection", turnDetection))
                    .put("output", JSONObject().put("voice", settings.voice))
            )
            .put("reasoning", JSONObject().put("effort", effortOverride ?: settings.reasoningEffort))
            .put(
                "truncation",
                JSONObject().put("type", "retention_ratio").put("retention_ratio", 0.8)
            )
            .put("max_output_tokens", 2048)
        val tools = JSONArray()
        if (settings.personalisationEnabled) tools.put(saveNoteTool())
        tools.put(showPracticeTool())
        tools.put(checkAnswerTool())
        session.put("tools", tools)
        if (includeModel) session.put("model", settings.model)
        return session
    }

    /**
     * The app marks the answer, not the model. It never learns what the answer
     * is — it asks, and gets back only a verdict — which is what lets it say
     * "yes, that's it" while still never reading a final answer out.
     *
     * Kept in step BY HAND with the same tool in VoiceMathTutorPC/renderer/shared.js.
     * That file is not in sync-shared.js's PAIRS, so nothing detects drift between
     * the two: change one, change the other.
     */
    private fun checkAnswerTool(): JSONObject = JSONObject()
        .put("type", "function")
        .put("name", "check_my_answer")
        .put(
            "description",
            "Check the student's answer against the one their practice question is " +
                "holding. Call this the moment they tell you an answer and want to know " +
                "if it is right. Pass what you heard, in words or numbers, exactly as " +
                "they said it. You will get back \"right\", \"wrong\", or \"unsure\" — " +
                "never the answer itself, so do not ask for it and do not guess it. On " +
                "\"right\", say so with some warmth. On \"wrong\", say so plainly and " +
                "point at the step where it probably went astray, without stating the " +
                "correct answer. On \"unsure\", ask them to say it a different way. If it " +
                "comes back \"none\" the practice screen is not open, so ask them to open it."
        )
        .put(
            "parameters",
            JSONObject()
                .put("type", "object")
                .put(
                    "properties",
                    JSONObject().put("heard", JSONObject().put("type", "string"))
                )
                .put("required", JSONArray().put("heard"))
        )

    private fun showPracticeTool(): JSONObject = JSONObject()
        .put("type", "function")
        .put("name", "show_practice")
        .put(
            "description",
            "Display a practice question in the student's practice popup: a question " +
                "tailored to what you have been discussing, with worked steps they can " +
                "reveal one at a time. Call when they ask for practice. All fields are " +
                "LaTeX (no $ delimiters). Introduce it briefly aloud without reading " +
                "the maths out."
        )
        .put(
            "parameters",
            JSONObject()
                .put("type", "object")
                .put(
                    "properties",
                    JSONObject()
                        .put("question", JSONObject().put("type", "string"))
                        .put(
                            "steps",
                            JSONObject().put("type", "array")
                                .put("items", JSONObject().put("type", "string"))
                        )
                        .put("answer", JSONObject().put("type", "string"))
                )
                .put("required", JSONArray().put("question").put("steps").put("answer"))
        )

    private fun saveNoteTool(): JSONObject = JSONObject()
        .put("type", "function")
        .put("name", "save_student_note")
        .put(
            "description",
            "Save a short durable observation about the student (a misconception, a mastered " +
                "skill, a preference) and/or update the topic they are currently working on. " +
                "One concise sentence per note; use sparingly."
        )
        .put(
            "parameters",
            JSONObject()
                .put("type", "object")
                .put(
                    "properties",
                    JSONObject()
                        .put(
                            "note",
                            JSONObject()
                                .put("type", "string")
                                .put("description", "One-sentence durable fact about the student")
                        )
                        .put(
                            "current_topic",
                            JSONObject()
                                .put("type", "string")
                                .put("description", "The new current topic, if it has changed")
                        )
                )
                .put("required", JSONArray())
        )
}
