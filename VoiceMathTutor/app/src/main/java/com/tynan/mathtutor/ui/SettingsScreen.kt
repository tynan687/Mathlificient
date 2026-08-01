package com.tynan.mathtutor.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.tynan.mathtutor.config.TutorSettings
import com.tynan.mathtutor.memory.SpendTracker
import com.tynan.mathtutor.memory.StudyLog
import com.tynan.mathtutor.memory.TutorMemory
import com.tynan.mathtutor.service.RealtimeService

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    initialApiKeySet: Boolean,
    initialSettings: TutorSettings,
    tutorMemory: TutorMemory,
    studyLog: StudyLog,
    spendTracker: SpendTracker,
    onSaveApiKey: (String) -> Unit,
    onSettingsChange: (TutorSettings) -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onOpenBatterySettings: () -> Unit,
    onOpenAppInfo: () -> Unit,
    onOpenFormulas: () -> Unit = {},
    onOpenTimer: () -> Unit = {},
    onOpenPractice: () -> Unit = {},
    onOpenProgress: () -> Unit = {},
    onOpenSymbols: () -> Unit = {},
    onToggleBubble: () -> Unit = {},
    bubbleShowing: Boolean = false,
) {
    val uiState by RealtimeService.uiState.collectAsState()
    var apiKeyInput by remember { mutableStateOf("") }
    var apiKeySaved by remember { mutableStateOf(initialApiKeySet) }
    var settings by remember { mutableStateOf(initialSettings) }
    var showMemoryDialog by remember { mutableStateOf(false) }
    var memoryNotes by remember { mutableStateOf(tutorMemory.notes()) }

    // Refresh spend and history whenever the session state changes.
    val todayAud = remember(uiState) { spendTracker.todayAud() }
    val weekAud = remember(uiState) { spendTracker.weekAud() }
    val recentSessions = remember(uiState.running) { studyLog.recent(10) }
    val memoryTokens = remember(uiState, memoryNotes) { tutorMemory.approxTokens() }

    fun update(newSettings: TutorSettings) {
        settings = newSettings
        onSettingsChange(newSettings)
    }

    Column(
        Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text("Mathlificient", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(12.dp))

        // ---- Status ----
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    if (uiState.running) "● ${uiState.status}" else "○ Not running",
                    style = MaterialTheme.typography.titleMedium
                )
                if (uiState.running) {
                    Text("Session cost: A$%.2f (incl. GST)".format(uiState.sessionCostAud))
                    Text("Projected: A$%.2f / hour".format(uiState.projectedHourlyAud))
                    if (uiState.micMuted) Text("Mic muted (unmute from the notification)")
                    if (uiState.watchActive) {
                        Text("Watch mode on — it will speak up if it spots a clear mistake")
                    }
                    if (uiState.budgetGuardTripped) {
                        Text(
                            "Budget guard active — reasoning lowered to medium",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
                Text(
                    "Spend today: A$%.2f · this week: A$%.2f".format(todayAud, weekAud),
                    style = MaterialTheme.typography.bodySmall
                )
                uiState.lastError?.let {
                    Text(
                        "Last error: $it",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
        Spacer(Modifier.height(16.dp))

        // ---- Start / Stop ----
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = onStart, enabled = !uiState.running) { Text("Start tutor") }
            OutlinedButton(onClick = onStop, enabled = uiState.running) { Text("Stop") }
        }
        Spacer(Modifier.height(12.dp))

        // ---- Study tools (work with or without a session) ----
        // FlowRow, not Row: these three need ~437dp and a phone gives ~320dp, so a
        // plain Row pushed "Timer" clean off the screen.
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(onClick = onOpenPractice) { Text("✏️ Practice Studio") }
            OutlinedButton(onClick = onOpenProgress) { Text("📊 Progress") }
            OutlinedButton(onClick = onOpenFormulas) { Text("🧮 Formulas") }
            OutlinedButton(onClick = onOpenSymbols) { Text("∫ Symbols") }
            OutlinedButton(onClick = onOpenTimer) { Text("⏱ Timer") }
            OutlinedButton(onClick = onToggleBubble) {
                Text(if (bubbleShowing) "✕ Hide bubble" else "🫧 Show bubble")
            }
        }
        Text(
            "The bubble is a floating shortcut you can keep on screen while you work " +
                "in another app — tap it for the formula sheet, timer, ambient sound " +
                "and practice. No API key or session needed.",
            style = MaterialTheme.typography.bodySmall,
        )
        Text(
            "Gestures — study bubble: tap = menu · hold = put away. During a tutor " +
                "session: tap = menu · double-tap = hint · hold = talk. Either way, " +
                "a firm drag moves it.",
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(Modifier.height(20.dp))

        // ---- API key ----
        Text("OpenAI API key", style = MaterialTheme.typography.titleMedium)
        if (apiKeySaved) {
            Text(
                "A key is saved (encrypted on-device). Enter a new one to replace it.",
                style = MaterialTheme.typography.bodySmall
            )
        }
        OutlinedTextField(
            value = apiKeyInput,
            onValueChange = { apiKeyInput = it },
            label = { Text("sk-…") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = {
                onSaveApiKey(apiKeyInput)
                apiKeySaved = true
                apiKeyInput = ""
            },
            enabled = apiKeyInput.isNotBlank()
        ) { Text("Save key") }
        Spacer(Modifier.height(20.dp))

        // ---- Personalisation & memory ----
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Personalisation", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "The tutor remembers durable facts about you between sessions " +
                                "(misconceptions, mastered skills, preferences). The profile " +
                                "is capped at ~600 tokens and rides in the cached prompt, so " +
                                "it adds under A$0.01 per hour.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Switch(
                        checked = settings.personalisationEnabled,
                        onCheckedChange = { update(settings.copy(personalisationEnabled = it)) }
                    )
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = settings.currentTopic,
                    onValueChange = { update(settings.copy(currentTopic = it)) },
                    label = { Text("Current topic") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    "The tutor centers hints on this topic and updates it as you progress.",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = {
                    memoryNotes = tutorMemory.notes()
                    showMemoryDialog = true
                }) {
                    Text("View memory (${memoryNotes.size} notes · ~$memoryTokens tokens)")
                }
            }
        }
        Spacer(Modifier.height(20.dp))

        // ---- Tutor settings (apply on next session start) ----
        Text("Tutor settings", style = MaterialTheme.typography.titleMedium)
        Text(
            "Changes apply the next time you press Start.",
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(Modifier.height(8.dp))
        DropdownRow("Course", TutorSettings.COURSES, settings.courseProfile) {
            update(settings.copy(courseProfile = it))
        }
        DropdownRow(
            "App theme",
            com.tynan.mathtutor.ui.AppThemes.ALL.map { it.label },
            com.tynan.mathtutor.ui.AppThemes.byKey(settings.appTheme).label,
        ) { label ->
            val key = com.tynan.mathtutor.ui.AppThemes.ALL
                .firstOrNull { it.label == label }?.key ?: "slate"
            update(settings.copy(appTheme = key))
            com.tynan.mathtutor.ui.ThemeController.set(key)
        }
        DropdownRow("Model", TutorSettings.MODELS, settings.model) {
            update(settings.copy(model = it))
        }
        DropdownRow("Reasoning effort", TutorSettings.EFFORTS, settings.reasoningEffort) {
            update(settings.copy(reasoningEffort = it))
        }
        DropdownRow("VAD eagerness", TutorSettings.EAGERNESS, settings.vadEagerness) {
            update(settings.copy(vadEagerness = it))
        }
        DropdownRow("Voice", TutorSettings.VOICES, settings.voice) {
            update(settings.copy(voice = it))
        }
        DropdownRow("Bubble tap", TutorSettings.TAP_ACTIONS, settings.tapAction) {
            update(settings.copy(tapAction = it))
        }
        Text(
            "hint = tap asks for a spoken hint about your screen · " +
                "snapshot = tap silently shows the tutor your screen (green flash), " +
                "it only speaks when you next talk to it",
            style = MaterialTheme.typography.bodySmall
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.weight(1f)) {
                Text("Push-to-talk (mic locked)")
                Text(
                    "Default: the mic only opens while you hold the bubble. Turn OFF " +
                        "to unlock the hands-free open mic (voice detection).",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Switch(
                checked = settings.pushToTalk,
                onCheckedChange = { update(settings.copy(pushToTalk = it)) }
            )
        }
        Spacer(Modifier.height(12.dp))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Watch mode", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "The tutor checks your screen as you write (only when it " +
                                "changes) and speaks up before a mistake compounds. Checks " +
                                "are silent text verdicts — you only hear it when it spots " +
                                "a clear error. Adds roughly A$1–3/hour while on. Toggle " +
                                "live from the notification's Watch button.",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Switch(
                        checked = settings.watchMode,
                        onCheckedChange = { update(settings.copy(watchMode = it)) }
                    )
                }
                DropdownRow(
                    "Check interval (seconds)",
                    TutorSettings.WATCH_INTERVALS.map { it.toString() },
                    settings.watchIntervalSec.toString()
                ) { update(settings.copy(watchIntervalSec = it.toInt())) }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("Budget guard: A$%.0f / hour (soft cap)".format(settings.softCapAud))
        Slider(
            value = settings.softCapAud.toFloat(),
            onValueChange = { update(settings.copy(softCapAud = it.toDouble())) },
            valueRange = 6f..15f,
            steps = 8
        )
        Spacer(Modifier.height(20.dp))

        // ---- Study log ----
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Study log", style = MaterialTheme.typography.titleMedium)
                if (recentSessions.isEmpty()) {
                    Text(
                        "Your sessions will appear here — date, length, cost, and topic.",
                        style = MaterialTheme.typography.bodySmall
                    )
                } else {
                    recentSessions.forEach { entry ->
                        Text(
                            "%s · %d min · A$%.2f · %s".format(
                                entry.endedAt, entry.durationMin, entry.costAud, entry.topic
                            ) + if (entry.notesAdded > 0) " · ${entry.notesAdded} notes" else "",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(20.dp))

        // ---- Samsung battery ----
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Keep the tutor alive (One UI)", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Samsung aggressively kills background apps. Set this app's battery " +
                        "to Unrestricted, add it to Never-sleeping apps (Settings → Battery " +
                        "→ Background usage limits), and disable \"Put unused apps to sleep\".",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClick = onOpenBatterySettings) { Text("Battery settings") }
                    OutlinedButton(onClick = onOpenAppInfo) { Text("App info") }
                }
            }
        }
        Spacer(Modifier.height(20.dp))

        Text(
            "How to use: start a session, then work in Samsung Notes or your PDF app. " +
                "Speak to the tutor any time, or tap the floating π bubble to have it " +
                "look at your screen and give a hint. It stays silent while you work.",
            style = MaterialTheme.typography.bodySmall
        )
    }

    if (showMemoryDialog) {
        AlertDialog(
            onDismissRequest = { showMemoryDialog = false },
            title = { Text("Tutor memory") },
            text = {
                Column(
                    Modifier
                        .heightIn(max = 400.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (memoryNotes.isEmpty()) {
                        Text("Nothing saved yet. The tutor adds notes as it gets to know you.")
                    } else {
                        // Newest first, keeping original indices for deletion.
                        memoryNotes.withIndex().reversed().forEach { (index, note) ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(note.text, style = MaterialTheme.typography.bodyMedium)
                                    Text(note.date, style = MaterialTheme.typography.bodySmall)
                                }
                                TextButton(onClick = {
                                    tutorMemory.deleteNote(index)
                                    memoryNotes = tutorMemory.notes()
                                }) { Text("Delete") }
                            }
                            HorizontalDivider()
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showMemoryDialog = false }) { Text("Close") }
            },
            dismissButton = {
                if (memoryNotes.isNotEmpty()) {
                    TextButton(onClick = {
                        tutorMemory.clear()
                        memoryNotes = emptyList()
                    }) { Text("Clear all") }
                }
            }
        )
    }
}

@Composable
private fun DropdownRow(
    label: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Text(label, modifier = Modifier.weight(1f))
        Box {
            OutlinedButton(onClick = { expanded = true }) { Text(selected) }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onSelect(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
