package com.tynan.mathtutor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.tynan.mathtutor.memory.SpendTracker
import com.tynan.mathtutor.memory.StudyLog
import com.tynan.mathtutor.memory.TutorMemory
import com.tynan.mathtutor.security.SecureKeyStore
import com.tynan.mathtutor.service.RealtimeService
import com.tynan.mathtutor.ui.SettingsScreen

class MainActivity : ComponentActivity() {

    private lateinit var keyStore: SecureKeyStore

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
                )
            }
        }
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
        val missing = listOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.POST_NOTIFICATIONS
        ).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
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
