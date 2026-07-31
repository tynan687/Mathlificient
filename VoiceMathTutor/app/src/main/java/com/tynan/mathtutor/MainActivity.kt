package com.tynan.mathtutor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.tynan.mathtutor.memory.SpendTracker
import com.tynan.mathtutor.memory.StudyLog
import com.tynan.mathtutor.memory.TutorMemory
import com.tynan.mathtutor.security.SecureKeyStore
import com.tynan.mathtutor.service.BubbleService
import com.tynan.mathtutor.service.RealtimeService
import com.tynan.mathtutor.ui.SettingsScreen

class MainActivity : ComponentActivity() {

    private lateinit var keyStore: SecureKeyStore

    /** Drives the Show/Hide bubble button; refreshed whenever we come back. */
    private var bubbleShowing by mutableStateOf(false)

    override fun onResume() {
        super.onResume()
        bubbleShowing = BubbleService.running
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.all { it }) {
            startTutorFlow()
        } else {
            toast("Microphone and notification permissions are required")
        }
    }

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            val intent = Intent(this, RealtimeService::class.java).apply {
                action = RealtimeService.ACTION_START
                putExtra(RealtimeService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(RealtimeService.EXTRA_RESULT_DATA, data)
            }
            startForegroundService(intent)
        } else {
            toast("Screen capture declined — tutor not started")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        keyStore = SecureKeyStore(this)
        val tutorMemory = TutorMemory(this)
        val studyLog = StudyLog(this)
        val spendTracker = SpendTracker(this)
        com.tynan.mathtutor.ui.ThemeController.set(keyStore.loadSettings().appTheme)
        setContent {
            val themeKey by com.tynan.mathtutor.ui.ThemeController.current.collectAsState()
            com.tynan.mathtutor.ui.AppTheme(themeKey) {
                SettingsScreen(
                    initialApiKeySet = !keyStore.apiKey.isNullOrBlank(),
                    initialSettings = keyStore.loadSettings(),
                    tutorMemory = tutorMemory,
                    studyLog = studyLog,
                    spendTracker = spendTracker,
                    onSaveApiKey = { key ->
                        keyStore.apiKey = key
                        toast("API key saved securely")
                    },
                    onSettingsChange = { keyStore.saveSettings(it) },
                    onStart = { startTutorFlow() },
                    onStop = { stopService(Intent(this, RealtimeService::class.java)) },
                    onOpenBatterySettings = {
                        startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    },
                    onOpenAppInfo = {
                        startActivity(
                            Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:$packageName")
                            )
                        )
                    },
                    onOpenFormulas = {
                        startActivity(Intent(this, FormulaSheetActivity::class.java))
                    },
                    onOpenTimer = {
                        startActivity(Intent(this, TimerActivity::class.java))
                    },
                    onOpenPractice = {
                        startActivity(Intent(this, PracticeSpaceActivity::class.java))
                    },
                    onToggleBubble = { toggleStudyBubble() },
                    bubbleShowing = bubbleShowing,
                )
            }
        }
    }

    /**
     * The standalone bubble needs only the overlay grant — no API key, no
     * microphone, no screen-capture consent. That's the whole point of it.
     */
    private fun toggleStudyBubble() {
        if (BubbleService.running) {
            BubbleService.stop(this)
            bubbleShowing = false
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            toast("Allow \"Display over other apps\", then tap Show bubble again")
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
            return
        }
        BubbleService.start(this)
        bubbleShowing = true
    }

    /**
     * Permission cascade: runtime permissions → overlay grant → per-session
     * MediaProjection consent (required fresh each session on Android 15).
     */
    private fun startTutorFlow() {
        if (keyStore.apiKey.isNullOrBlank()) {
            toast("Save your OpenAI API key first")
            return
        }
        // POST_NOTIFICATIONS only exists from API 33. On older phones it can never
        // be granted, so including it unconditionally made this check fail forever
        // and the app could never be started at all.
        val wanted = buildList {
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        val missing = wanted.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            toast("Allow \"Display over other apps\", then press Start again")
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
            return
        }
        val mpm = getSystemService(MediaProjectionManager::class.java)
        projectionLauncher.launch(mpm.createScreenCaptureIntent())
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
