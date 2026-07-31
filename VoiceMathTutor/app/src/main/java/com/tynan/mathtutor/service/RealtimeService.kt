package com.tynan.mathtutor.service

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import android.os.Build
import androidx.core.content.IntentCompat
import com.tynan.mathtutor.FormulaSheetActivity
import com.tynan.mathtutor.MainActivity
import com.tynan.mathtutor.R
import com.tynan.mathtutor.TimerActivity
import com.tynan.mathtutor.overlay.MenuItem
import com.tynan.mathtutor.timer.TimerController
import com.tynan.mathtutor.api.EphemeralTokenClient
import com.tynan.mathtutor.capture.ScreenCaptureManager
import com.tynan.mathtutor.config.TutorConfig
import com.tynan.mathtutor.config.TutorSettings
import com.tynan.mathtutor.memory.SpendTracker
import com.tynan.mathtutor.memory.StudyLog
import com.tynan.mathtutor.memory.TutorMemory
import com.tynan.mathtutor.overlay.BubbleState
import com.tynan.mathtutor.overlay.OverlayController
import com.tynan.mathtutor.realtime.CostMeter
import com.tynan.mathtutor.realtime.RealtimeTransport
import com.tynan.mathtutor.security.SecureKeyStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Foreground service (microphone|mediaProjection) that owns the whole tutoring
 * session: WebRTC transport, screen capture, overlay bubble, cost meter, tutor
 * memory, and reconnection.
 */
class RealtimeService : Service(), RealtimeTransport.Listener {

    data class TutorUiState(
        val running: Boolean = false,
        val status: String = "Not running",
        val sessionCostAud: Double = 0.0,
        val projectedHourlyAud: Double = 0.0,
        val budgetGuardTripped: Boolean = false,
        val micMuted: Boolean = false,
        val watchActive: Boolean = false,
        val lastError: String? = null,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var keyStore: SecureKeyStore
    private lateinit var settings: TutorSettings
    private var transport: RealtimeTransport? = null
    private var overlay: OverlayController? = null
    private var capture: ScreenCaptureManager? = null
    private var costMeter: CostMeter? = null
    private var tutorMemory: TutorMemory? = null
    private var studyLog: StudyLog? = null
    private var spendTracker: SpendTracker? = null
    private var audioManager: AudioManager? = null
    private var deviceCallback: AudioDeviceCallback? = null
    private var sessionStartMs = 0L
    private var notesSavedThisSession = 0
    private var lastFlushedAud = 0.0
    private var micMuted = false
    private var pendingToolResponse = false
    private var queuedResponse: JSONObject? = null
    private var watchJob: Job? = null
    private var watchActive = false
    private var responseActive = false
    private var userSpeaking = false
    private var pttHolding = false
    private var awaitingCheckVerdict = false
    private var expectWatchImageId = false
    private var lastWatchImageId: String? = null
    private var lastAutoCaptureMs = 0L
    private var downshifted = false
    private var stopping = false
    private var reconnectAttempts = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopSelf()

            ACTION_TOGGLE_MUTE -> toggleMute()

            ACTION_TOGGLE_WATCH -> toggleWatch()

            ACTION_START -> {
                if (transport != null) return START_NOT_STICKY // already running
                // A session brings its own bubble, so stand the standalone one
                // down first — otherwise the user ends up with two.
                if (BubbleService.running) BubbleService.stop(this)
                keyStore = SecureKeyStore(this)
                settings = keyStore.loadSettings()
                createNotificationChannel()
                // FOREGROUND_SERVICE_TYPE_MICROPHONE is API 30, and types only
                // became mandatory at 34 — so on Android 10 start without one
                // rather than handing the platform a constant it doesn't know.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    startForeground(
                        NOTIFICATION_ID,
                        buildNotification("Starting…"),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                    )
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification("Starting…"))
                }
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                // The typed getParcelableExtra overload is API 33; IntentCompat
                // picks the right one instead of throwing on older phones.
                val resultData = IntentCompat.getParcelableExtra(
                    intent, EXTRA_RESULT_DATA, Intent::class.java
                )
                if (resultCode != Activity.RESULT_OK || resultData == null) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startSession(resultCode, resultData)
            }
        }
        return START_NOT_STICKY
    }

    private fun startSession(resultCode: Int, resultData: Intent) {
        stopping = false
        downshifted = false
        micMuted = false
        notesSavedThisSession = 0
        lastFlushedAud = 0.0
        sessionStartMs = SystemClock.elapsedRealtime()
        costMeter = CostMeter.forSettings(settings)
        tutorMemory = TutorMemory(this)
        studyLog = StudyLog(this)
        spendTracker = SpendTracker(this)
        capture = ScreenCaptureManager(this).also { it.start(resultCode, resultData) }
        watchActive = settings.watchMode
        overlay = OverlayController(
            context = this,
            onTap = {
                if (settings.tapAction == TutorSettings.TAP_SNAPSHOT) {
                    sendSilentSnapshot()
                } else {
                    requestHelpWithScreen()
                }
            },
            onHoldStart = {
                if (settings.pushToTalk) {
                    pttHolding = true
                    enterCommunicationMode() // engages the headset mic for the hold
                    transport?.setMicEnabled(true)
                    overlay?.setState(BubbleState.LISTENING)
                }
            },
            onHoldEnd = { if (settings.pushToTalk) endPushToTalkTurn() },
            onMenu = { showBubbleMenu() },
        ).also {
            it.show()
            it.setState(BubbleState.LOADING)
        }
        scope.launch {
            TimerController.state.collect { timer ->
                overlay?.setTimerText(
                    if (timer.running) {
                        (if (timer.onBreak) "☕" else "") + "${(timer.remainingSec + 59) / 60}m"
                    } else null
                )
            }
        }
        configureAudio()
        uiState.value = TutorUiState(running = true, status = "Connecting…")
        connect()
    }

    private fun connect() {
        scope.launch {
            try {
                val apiKey = keyStore.apiKey
                    ?: throw IllegalStateException("No API key configured")
                val token = withContext(Dispatchers.IO) {
                    EphemeralTokenClient.mint(
                        apiKey,
                        TutorConfig.sessionObject(
                            settings,
                            includeModel = true,
                            memorySummary = memorySummaryOrNull()
                        )
                    )
                }
                val t = RealtimeTransport(this@RealtimeService, this@RealtimeService)
                transport = t
                t.connect(token, settings.model, micEnabledAtStart = !settings.pushToTalk)
                reconnectAttempts = 0
            } catch (e: Exception) {
                Log.e(TAG, "connect failed", e)
                uiState.update { it.copy(status = "Connection failed", lastError = e.message) }
                overlay?.setState(BubbleState.ERROR)
                scheduleReconnect()
            }
        }
    }

    private fun memorySummaryOrNull(): String? {
        if (!settings.personalisationEnabled) return null
        return tutorMemory?.summaryForPrompt()?.ifBlank { null }
    }

    // ---- RealtimeTransport.Listener -------------------------------------------------

    override fun onDataChannelOpen() {
        transport?.sendEvent(
            JSONObject()
                .put("type", "session.update")
                .put(
                    "session",
                    TutorConfig.sessionObject(
                        settings,
                        includeModel = false,
                        effortOverride = if (downshifted) "medium" else null,
                        memorySummary = memorySummaryOrNull()
                    )
                )
        )
        scope.launch {
            overlay?.setState(BubbleState.IDLE)
            uiState.update { it.copy(status = "Listening — silent until you speak") }
            updateNotification("Tutor active — tap the bubble for help")
            startWatchLoopIfNeeded()
        }
    }

    override fun onEvent(event: JSONObject) {
        scope.launch { handleEvent(event) }
    }

    override fun onDisconnected(reason: String) {
        scope.launch {
            if (stopping) return@launch
            Log.w(TAG, "Disconnected: $reason")
            uiState.update { it.copy(status = "Disconnected", lastError = reason) }
            overlay?.setState(BubbleState.ERROR)
            scheduleReconnect()
        }
    }

    // ---- Event handling -------------------------------------------------------------

    private fun handleEvent(event: JSONObject) {
        when (event.optString("type")) {
            "input_audio_buffer.speech_started" -> {
                userSpeaking = true
                overlay?.setState(BubbleState.LISTENING)
                maybeAutoCaptureScreen()
            }

            "input_audio_buffer.speech_stopped" -> {
                userSpeaking = false
                overlay?.setState(BubbleState.THINKING)
            }

            "conversation.item.created" -> {
                if (expectWatchImageId) {
                    val item = event.optJSONObject("item")
                    val firstContent = item?.optJSONArray("content")?.optJSONObject(0)
                    if (item?.optString("role") == "user" &&
                        firstContent?.optString("type") == "input_image"
                    ) {
                        lastWatchImageId = item.optString("id").ifBlank { null }
                        expectWatchImageId = false
                    }
                }
            }

            "response.created" -> {
                responseActive = true
                // Silent watch checks shouldn't animate the bubble.
                if (!awaitingCheckVerdict) overlay?.setState(BubbleState.THINKING)
            }

            "response.output_item.added" -> {
                if (event.optJSONObject("item")?.optString("type") == "function_call") {
                    overlay?.setState(BubbleState.SEARCHING)
                }
            }

            "response.output_item.done" -> {
                val item = event.optJSONObject("item")
                if (item?.optString("type") == "function_call") {
                    when (item.optString("name")) {
                        "save_student_note" -> handleSaveNote(item)
                        "show_practice" -> handleShowPractice(item)
                    }
                }
            }

            "output_audio_buffer.started" -> overlay?.setState(BubbleState.TALKING)

            "output_audio_buffer.stopped" -> {
                overlay?.setState(BubbleState.IDLE)
                // Safety net: never leave call-quality mode lingering in PTT mode.
                if (settings.pushToTalk) exitCommunicationMode()
            }

            "response.done" -> {
                responseActive = false
                event.optJSONObject("response")?.optJSONObject("usage")?.let { onUsage(it) }
                // Fire exactly one follow-up response (two response.creates errors):
                // a check-alert, else a queued tool follow-up, else a queued user action.
                val wasCheck = awaitingCheckVerdict
                var next: JSONObject? = null
                if (wasCheck) {
                    awaitingCheckVerdict = false
                    next = checkVerdictResponse(event.optJSONObject("response"))
                }
                if (next == null && pendingToolResponse) {
                    next = JSONObject().put("type", "response.create")
                }
                if (next == null && queuedResponse != null) next = queuedResponse
                pendingToolResponse = false
                queuedResponse = null
                if (next != null) {
                    transport?.sendEvent(next)
                    overlay?.setState(BubbleState.THINKING)
                } else if (!wasCheck) {
                    overlay?.flashResponseDone()
                }
            }

            "error" -> {
                val message = event.optJSONObject("error")?.optString("message")
                    ?: event.toString()
                Log.w(TAG, "Realtime error: $message")
                uiState.update { it.copy(lastError = message) }
            }
        }
    }

    /** The model saved a durable fact about the student and/or moved to a new topic. */
    private fun handleSaveNote(item: JSONObject) {
        val callId = item.optString("call_id")
        val args = try {
            JSONObject(item.optString("arguments").ifEmpty { "{}" })
        } catch (_: Exception) {
            JSONObject()
        }
        val note = args.optString("note")
        val topic = args.optString("current_topic")
        if (note.isNotBlank()) {
            tutorMemory?.addNote(note)
            notesSavedThisSession++
        }
        if (topic.isNotBlank()) {
            settings = settings.copy(currentTopic = topic)
            keyStore.saveSettings(settings)
        }
        transport?.sendEvent(
            JSONObject().put("type", "conversation.item.create").put(
                "item",
                JSONObject()
                    .put("type", "function_call_output")
                    .put("call_id", callId)
                    .put("output", "{\"saved\":true}")
            )
        )
        // The model should finish its spoken turn after the tool result, but a new
        // response can only start once the current one is done — queue it.
        pendingToolResponse = true
    }

    private fun onUsage(usage: JSONObject) {
        val meter = costMeter ?: return
        meter.addUsage(usage)
        val total = meter.totalAud()
        val projected = meter.projectedHourlyAud()
        uiState.update { it.copy(sessionCostAud = total, projectedHourlyAud = projected) }
        val delta = total - lastFlushedAud
        if (delta > 0) {
            spendTracker?.add(delta)
            lastFlushedAud = total
        }
        updateNotification(
            "Session A$%.2f · projected A$%.2f/hr".format(total, projected)
        )
        if (!downshifted && projected > settings.softCapAud) {
            downshifted = true
            transport?.sendEvent(
                JSONObject()
                    .put("type", "session.update")
                    .put(
                        "session",
                        TutorConfig.sessionObject(
                            settings,
                            includeModel = false,
                            effortOverride = "medium",
                            memorySummary = memorySummaryOrNull()
                        )
                    )
            )
            uiState.update { it.copy(budgetGuardTripped = true) }
            updateNotification("Budget guard: reasoning lowered to medium")
        }
    }

    // ---- Actions --------------------------------------------------------------------

    /**
     * Start a response now, or queue it if one is already streaming — sending a
     * second response.create mid-stream is an API error. [responseObj] is the inner
     * "response" object (instructions etc.), or null for a plain response.create.
     */
    private fun startOrQueueResponse(responseObj: JSONObject?) {
        val evt = JSONObject().put("type", "response.create")
        if (responseObj != null) evt.put("response", responseObj)
        if (responseActive) {
            queuedResponse = evt
        } else {
            transport?.sendEvent(evt)
            overlay?.setState(BubbleState.THINKING)
        }
    }

    private fun requestHelpWithScreen() {
        val t = transport ?: return
        overlay?.setState(BubbleState.THINKING)
        scope.launch {
            val b64 = withContext(Dispatchers.Default) { capture?.captureJpegBase64() }
            if (b64 != null) {
                t.sendEvent(imageItemEvent(b64))
                lastAutoCaptureMs = SystemClock.elapsedRealtime()
            }
            startOrQueueResponse(
                JSONObject().put(
                    "instructions",
                    "The student tapped the help bubble and shared their screen. " +
                        "Look at the latest screenshot and give one concise Socratic " +
                        "hint about the step they appear stuck on. Do not state the " +
                        "final answer."
                )
            )
        }
    }

    /** Bubble tap in snapshot mode: push the screen into context, no spoken reply. */
    private fun sendSilentSnapshot() {
        val t = transport ?: return
        scope.launch {
            val b64 = withContext(Dispatchers.Default) { capture?.captureJpegBase64() }
            if (b64 != null) {
                t.sendEvent(imageItemEvent(b64))
                lastAutoCaptureMs = SystemClock.elapsedRealtime()
                overlay?.flashResponseDone() // green flash = captured
            }
        }
    }

    /** On speech start, attach a fresh screenshot (throttled) so the reply can see the page. */
    private fun maybeAutoCaptureScreen() {
        val t = transport ?: return
        // Don't capture our own practice/formula/timer UI when it's on top.
        if (com.tynan.mathtutor.TutorApp.ownUiForeground()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastAutoCaptureMs < AUTO_CAPTURE_MIN_INTERVAL_MS) return
        lastAutoCaptureMs = now
        scope.launch {
            val b64 = withContext(Dispatchers.Default) { capture?.captureJpegBase64() }
            if (b64 != null) t.sendEvent(imageItemEvent(b64))
        }
    }

    private fun endPushToTalkTurn() {
        val t = transport ?: return
        pttHolding = false
        t.setMicEnabled(false)
        exitCommunicationMode() // back to full-quality music; reply streams in normal mode
        overlay?.setState(BubbleState.THINKING)
        scope.launch {
            val b64 = withContext(Dispatchers.Default) { capture?.captureJpegBase64() }
            if (b64 != null) t.sendEvent(imageItemEvent(b64))
            t.sendEvent(JSONObject().put("type", "input_audio_buffer.commit"))
            startOrQueueResponse(null)
        }
    }

    // ---- Watch mode -----------------------------------------------------------------

    private fun startWatchLoopIfNeeded() {
        watchJob?.cancel()
        watchJob = null
        if (watchActive) {
            watchJob = scope.launch {
                while (true) {
                    delay(settings.watchIntervalSec * 1_000L)
                    runWatchCheck()
                }
            }
        }
        applyWatchState()
    }

    private suspend fun runWatchCheck() {
        val t = transport ?: return
        if (responseActive || userSpeaking || micMuted || pttHolding || awaitingCheckVerdict) return
        // Skip while our own screens are on top — don't check our own UI.
        if (com.tynan.mathtutor.TutorApp.ownUiForeground()) return
        val b64 = withContext(Dispatchers.Default) {
            capture?.captureIfChangedJpegBase64()
        } ?: return
        // Keep the context lean: only the newest watch screenshot stays server-side.
        lastWatchImageId?.let { id ->
            t.sendEvent(JSONObject().put("type", "conversation.item.delete").put("item_id", id))
            lastWatchImageId = null
        }
        expectWatchImageId = true
        t.sendEvent(imageItemEvent(b64))
        awaitingCheckVerdict = true
        t.sendEvent(
            JSONObject().put("type", "response.create").put(
                "response",
                JSONObject()
                    .put("output_modalities", JSONArray().put("text"))
                    .put("instructions", TutorConfig.WATCH_CHECK_INSTRUCTIONS)
                    .put("max_output_tokens", 60)
            )
        )
    }

    /** A silent check came back — return a spoken response only for a clear mistake. */
    private fun checkVerdictResponse(response: JSONObject?): JSONObject? {
        val verdict = extractOutputText(response ?: return null)
        if (!verdict.contains("ALERT", ignoreCase = true)) return null
        return JSONObject().put("type", "response.create").put(
            "response",
            JSONObject().put(
                "instructions",
                "You just flagged a mistake in the student's working: \"$verdict\". " +
                    "Interrupt briefly and kindly: name the specific line and ask one " +
                    "question that helps them see the error themselves. Do not state " +
                    "the corrected result."
            )
        )
    }

    private fun extractOutputText(response: JSONObject): String {
        val output = response.optJSONArray("output") ?: return ""
        val sb = StringBuilder()
        for (i in 0 until output.length()) {
            val content = output.optJSONObject(i)?.optJSONArray("content") ?: continue
            for (j in 0 until content.length()) {
                val text = content.optJSONObject(j)?.optString("text").orEmpty()
                if (text.isNotBlank()) sb.append(text).append(' ')
            }
        }
        return sb.toString().trim()
    }

    private fun toggleWatch() {
        if (transport == null) return
        watchActive = !watchActive
        startWatchLoopIfNeeded()
        updateNotification(
            if (watchActive) "Watching your working — I'll speak up on a clear mistake"
            else "Tutor active — tap the bubble for help"
        )
    }

    private fun applyWatchState() {
        overlay?.setWatching(watchActive)
        uiState.update { it.copy(watchActive = watchActive) }
    }

    // ---- Quick-action menu ------------------------------------------------------------

    private fun showBubbleMenu() {
        overlay?.showMenu(menuItems()) { id -> onMenuAction(id) }
    }

    private fun menuItems(): List<MenuItem> = listOf(
        MenuItem("hint", "💡", "Ask about screen"),
        MenuItem("snapshot", "📷", "Silent snapshot"),
        MenuItem("practice", "✏️", "Practice problem"),
        MenuItem("mute", if (micMuted) "🎙" else "🔇", if (micMuted) "Unmute" else "Mute"),
        MenuItem("watch", "👁", if (watchActive) "Watching ✓" else "Watch"),
        MenuItem("formulas", "🧮", "Formula sheet"),
        MenuItem("timer", "⏱", "Focus timer"),
        MenuItem("ambient", "🌧", "Ambient sound"),
    )

    private fun onMenuAction(id: String) {
        when (id) {
            "hint" -> requestHelpWithScreen()
            "snapshot" -> sendSilentSnapshot()
            "practice" -> {
                // Full S Pen studio opens immediately (offline generator, matched to
                // the current topic); the tutor's tailored question also arrives via
                // show_practice → the floating popup, so a live session isn't disruptive.
                openActivity(com.tynan.mathtutor.PracticeSpaceActivity::class.java)
                requestPractice()
            }
            "mute" -> toggleMute()
            "watch" -> toggleWatch()
            "formulas" -> openActivity(FormulaSheetActivity::class.java)
            "timer" -> openActivity(TimerActivity::class.java)
            "ambient" -> openActivity(TimerActivity::class.java)
        }
    }

    /** Send the standard {"shown":true} tool output and queue the spoken follow-up. */
    private fun sendShownToolOutput(callId: String) {
        transport?.sendEvent(
            JSONObject().put("type", "conversation.item.create").put(
                "item",
                JSONObject()
                    .put("type", "function_call_output")
                    .put("call_id", callId)
                    .put("output", "{\"shown\":true}")
            )
        )
        pendingToolResponse = true
    }

    private fun handleShowPractice(item: JSONObject) {
        val args = try {
            JSONObject(item.optString("arguments").ifEmpty { "{}" })
        } catch (_: Exception) {
            JSONObject()
        }
        if (args.has("question")) {
            startActivity(
                Intent(this, com.tynan.mathtutor.PracticeActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    .putExtra("payload", args.toString())
            )
        }
        sendShownToolOutput(item.optString("call_id"))
    }

    /** Ask the tutor for a practice question tailored to the conversation. */
    private fun requestPractice() {
        val t = transport ?: return
        overlay?.setState(BubbleState.THINKING)
        scope.launch {
            val b64 = withContext(Dispatchers.Default) { capture?.captureJpegBase64() }
            if (b64 != null) t.sendEvent(imageItemEvent(b64))
            startOrQueueResponse(
                JSONObject().put(
                    "instructions",
                    "The student wants a practice question. Write ONE question " +
                        "tailored to what you have been discussing (see the latest " +
                        "screenshot), with worked steps and the answer, and call " +
                        "show_practice with it. Briefly introduce it aloud - do not " +
                        "read the maths out, and do not solve their actual problem."
                )
            )
        }
    }

    private fun openActivity(cls: Class<*>) {
        // Allowed from the background because the app holds SYSTEM_ALERT_WINDOW.
        startActivity(Intent(this, cls).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Mute toggle from the notification. Only meaningful when VAD has the mic open. */
    private fun toggleMute() {
        if (transport == null || !::settings.isInitialized || settings.pushToTalk) return
        micMuted = !micMuted
        transport?.setMicEnabled(!micMuted)
        overlay?.setMuted(micMuted)
        uiState.update { it.copy(micMuted = micMuted) }
        updateNotification(
            if (micMuted) "Muted — the tutor can't hear you"
            else "Tutor active — tap the bubble for help"
        )
    }

    private fun imageItemEvent(base64Jpeg: String): JSONObject =
        JSONObject().put("type", "conversation.item.create").put(
            "item",
            JSONObject()
                .put("type", "message")
                .put("role", "user")
                .put(
                    "content",
                    JSONArray().put(
                        JSONObject()
                            .put("type", "input_image")
                            .put("detail", "high")
                            .put("image_url", "data:image/jpeg;base64,$base64Jpeg")
                    )
                )
        )

    // ---- Audio ----------------------------------------------------------------------

    private fun configureAudio() {
        val am = getSystemService(AudioManager::class.java) ?: return
        audioManager = am
        // Deliberately no audio-focus request: the tutor mixes over whatever the
        // student is playing (music keeps going) instead of pausing or ducking it.
        // Tutor volume rides the call-volume slider; music stays on media volume.
        //
        // VAD mode keeps the mic open all session, so echo-cancelling communication
        // mode stays on throughout. In push-to-talk mode the mic only opens while
        // the bubble is held, so we stay in normal mode (full-quality music over
        // A2DP, tutor replies mixed in at full quality too) and hop into
        // communication mode only for the duration of the hold.
        if (!settings.pushToTalk) enterCommunicationMode()
        deviceCallback = object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = reroute()
            override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = reroute()
        }.also { am.registerAudioDeviceCallback(it, Handler(Looper.getMainLooper())) }
    }

    private fun enterCommunicationMode() {
        val am = audioManager ?: return
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        applyPreferredRoute(am)
    }

    private fun exitCommunicationMode() {
        val am = audioManager ?: return
        if (canRouteCommunication) runCatching { am.clearCommunicationDevice() }
        am.mode = AudioManager.MODE_NORMAL
    }

    private fun reroute() {
        val am = audioManager ?: return
        if (am.mode == AudioManager.MODE_IN_COMMUNICATION) applyPreferredRoute(am)
    }

    /**
     * Headphones when connected (wired/USB/Bluetooth), otherwise the speaker.
     *
     * The whole communication-device API is API 31. Below that the app simply
     * doesn't steer the route and lets Android pick — voice still works, it just
     * won't actively prefer a headset. Deliberately not reimplemented with the
     * old SCO/speakerphone calls: that path is fiddly, easy to leave in a bad
     * state, and not worth it for the phones it would cover.
     */
    private fun applyPreferredRoute(am: AudioManager) {
        if (!canRouteCommunication) return
        val devices = am.availableCommunicationDevices
        val target = devices.firstOrNull { it.type in HEADPHONE_TYPES }
            ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        target?.let { runCatching { am.setCommunicationDevice(it) } }
    }

    private val canRouteCommunication: Boolean
        get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    // ---- Reconnection ---------------------------------------------------------------

    private fun scheduleReconnect() {
        if (stopping) return
        if (reconnectAttempts >= MAX_RECONNECTS) {
            updateNotification("Disconnected — open the app and press Start to resume")
            return
        }
        reconnectAttempts++
        scope.launch {
            delay(1_500L * reconnectAttempts)
            transport?.close()
            transport = null
            overlay?.setState(BubbleState.LOADING)
            connect()
        }
    }

    // ---- Notification ---------------------------------------------------------------

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Tutor session", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, RealtimeService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val openIntent = PendingIntent.getActivity(
            this, 2,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_tutor)
            .setContentTitle("Mathlificient")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(0, "Stop", stopIntent)
        if (::settings.isInitialized && !settings.pushToTalk) {
            val muteIntent = PendingIntent.getService(
                this, 3,
                Intent(this, RealtimeService::class.java).setAction(ACTION_TOGGLE_MUTE),
                PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(0, if (micMuted) "Unmute" else "Mute", muteIntent)
        }
        val watchIntent = PendingIntent.getService(
            this, 4,
            Intent(this, RealtimeService::class.java).setAction(ACTION_TOGGLE_WATCH),
            PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(0, if (watchActive) "Watching ✓" else "Watch", watchIntent)
        return builder.build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification(text))
    }

    // ---- Teardown -------------------------------------------------------------------

    override fun onDestroy() {
        stopping = true
        appendStudyLogEntry()
        scope.cancel()
        transport?.close()
        transport = null
        capture?.release()
        capture = null
        overlay?.hide()
        overlay = null
        audioManager?.let { am ->
            deviceCallback?.let(am::unregisterAudioDeviceCallback)
            if (canRouteCommunication) am.clearCommunicationDevice()
            am.mode = AudioManager.MODE_NORMAL
        }
        uiState.value = TutorUiState()
        super.onDestroy()
    }

    private fun appendStudyLogEntry() {
        val meter = costMeter ?: return
        val log = studyLog ?: return
        runCatching {
            log.append(
                StudyLog.Entry(
                    endedAt = LocalDateTime.now()
                        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")),
                    durationMin = ((SystemClock.elapsedRealtime() - sessionStartMs) / 60_000L)
                        .toInt(),
                    costAud = meter.totalAud(),
                    topic = settings.currentTopic,
                    notesAdded = notesSavedThisSession,
                )
            )
        }
        costMeter = null
    }

    companion object {
        const val ACTION_START = "com.tynan.mathtutor.START"
        const val ACTION_STOP = "com.tynan.mathtutor.STOP"
        const val ACTION_TOGGLE_MUTE = "com.tynan.mathtutor.TOGGLE_MUTE"
        const val ACTION_TOGGLE_WATCH = "com.tynan.mathtutor.TOGGLE_WATCH"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        private const val NOTIFICATION_ID = 42
        private const val CHANNEL_ID = "tutor"
        private const val AUTO_CAPTURE_MIN_INTERVAL_MS = 10_000L
        private const val MAX_RECONNECTS = 3
        private const val TAG = "RealtimeService"

        private val HEADPHONE_TYPES = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
        )

        val uiState = MutableStateFlow(TutorUiState())
    }
}
