package com.tynan.mathtutor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import android.content.Intent
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.ui.platform.LocalContext
import com.tynan.mathtutor.timer.AmbientService
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tynan.mathtutor.timer.TimerController

class TimerActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        com.tynan.mathtutor.ui.ThemeController.set(
            com.tynan.mathtutor.security.SecureKeyStore(this).loadSettings().appTheme
        )
        setContent {
            val themeKey by com.tynan.mathtutor.ui.ThemeController.current.collectAsState()
            com.tynan.mathtutor.ui.AppTheme(themeKey) { TimerScreen() }
        }
    }
}

@Composable
private fun TimerScreen() {
    val state by TimerController.state.collectAsState()
    var goal by remember { mutableStateOf(state.goal) }
    var focusMin by remember { mutableStateOf(state.focusMin.toString()) }
    var breakMin by remember { mutableStateOf(state.breakMin.toString()) }

    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Focus timer", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(6.dp))
        Text(
            if (state.onBreak) "Break — stretch, look away" else "Focus block",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "%d:%02d".format(state.remainingSec / 60, state.remainingSec % 60),
            fontSize = 72.sp,
        )
        if (state.goal.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text("Goal: ${state.goal}", style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (state.running) {
                Button(onClick = { TimerController.pause() }) { Text("Pause") }
            } else {
                Button(onClick = {
                    TimerController.configure(
                        focusMin.toIntOrNull() ?: 25,
                        breakMin.toIntOrNull() ?: 5,
                        goal,
                    )
                    TimerController.start()
                }) { Text("Start") }
            }
            OutlinedButton(onClick = { TimerController.reset() }) { Text("Reset") }
        }
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = goal,
            onValueChange = { goal = it },
            label = { Text("This block's goal (optional)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        Row {
            OutlinedTextField(
                value = focusMin,
                onValueChange = { focusMin = it },
                label = { Text("Focus (min)") },
                singleLine = true,
                modifier = Modifier.width(140.dp),
            )
            Spacer(Modifier.width(12.dp))
            OutlinedTextField(
                value = breakMin,
                onValueChange = { breakMin = it },
                label = { Text("Break (min)") },
                singleLine = true,
                modifier = Modifier.width(140.dp),
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            "While a tutor session is running, the bubble shows the minutes left.",
            style = MaterialTheme.typography.bodySmall,
        )

        Spacer(Modifier.height(28.dp))
        AmbientSection()
    }
}

@Composable
private fun AmbientSection() {
    val context = LocalContext.current
    val ambient by AmbientService.state.collectAsState()

    fun send(action: String, type: String? = null, volume: Float? = null) {
        val intent = Intent(context, AmbientService::class.java).setAction(action)
        type?.let { intent.putExtra(AmbientService.EXTRA_TYPE, it) }
        volume?.let { intent.putExtra(AmbientService.EXTRA_VOLUME, it) }
        if (action == AmbientService.ACTION_PLAY) context.startForegroundService(intent)
        else context.startService(intent)
    }

    Text("Ambient sound", style = MaterialTheme.typography.titleMedium)
    Text(
        "Synthesised on-device — fully offline. Keeps playing while you work in " +
            "your notes app.",
        style = MaterialTheme.typography.bodySmall,
    )
    Spacer(Modifier.height(10.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((type, label) in listOf(
            "rain" to "🌧 Rain", "brown" to "🌊 Deep",
            "pink" to "🍃 Soft", "white" to "🌬 White",
        )) {
            val selected = ambient.playing && ambient.type == type
            if (selected) {
                Button(onClick = { send(AmbientService.ACTION_STOP) }) { Text(label) }
            } else {
                OutlinedButton(onClick = {
                    send(AmbientService.ACTION_PLAY, type = type, volume = ambient.volume)
                }) { Text(label) }
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("🔉")
        Slider(
            value = ambient.volume,
            onValueChange = { v ->
                AmbientService.state.value = ambient.copy(volume = v)
                if (ambient.playing) send(AmbientService.ACTION_VOLUME, volume = v)
            },
            valueRange = 0.05f..1f,
            modifier = Modifier.width(260.dp),
        )
        Text("🔊")
    }
}
