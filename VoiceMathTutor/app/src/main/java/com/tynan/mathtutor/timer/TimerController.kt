package com.tynan.mathtutor.timer

import android.media.AudioManager
import android.media.ToneGenerator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Pomodoro focus timer. Singleton so it survives across activities and the
 * bubble badge can observe it during tutoring sessions.
 */
object TimerController {

    data class TimerState(
        val running: Boolean = false,
        val onBreak: Boolean = false,
        val remainingSec: Int = 25 * 60,
        val focusMin: Int = 25,
        val breakMin: Int = 5,
        val goal: String = "",
    )

    val state = MutableStateFlow(TimerState())

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var job: Job? = null

    fun start() {
        if (job != null) return
        state.update { it.copy(running = true) }
        job = scope.launch {
            while (true) {
                delay(1_000)
                tick()
            }
        }
    }

    fun pause() {
        job?.cancel()
        job = null
        state.update { it.copy(running = false) }
    }

    fun reset() {
        pause()
        state.update { it.copy(onBreak = false, remainingSec = it.focusMin * 60) }
    }

    fun configure(focusMin: Int, breakMin: Int, goal: String) {
        state.update { s ->
            val focus = focusMin.coerceIn(1, 120)
            val brk = breakMin.coerceIn(1, 60)
            s.copy(
                focusMin = focus,
                breakMin = brk,
                goal = goal,
                remainingSec = if (!s.running && !s.onBreak) focus * 60 else s.remainingSec,
            )
        }
    }

    private fun tick() {
        state.update { s ->
            if (s.remainingSec > 1) {
                s.copy(remainingSec = s.remainingSec - 1)
            } else {
                beep()
                if (s.onBreak) s.copy(onBreak = false, remainingSec = s.focusMin * 60)
                else s.copy(onBreak = true, remainingSec = s.breakMin * 60)
            }
        }
    }

    private fun beep() {
        try {
            ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
                .startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
        } catch (_: Exception) {
            // no tone available — silent phase change
        }
    }
}
