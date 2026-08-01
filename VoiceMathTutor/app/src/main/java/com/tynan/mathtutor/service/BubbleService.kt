package com.tynan.mathtutor.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.tynan.mathtutor.FormulaSheetActivity
import com.tynan.mathtutor.PracticeSpaceActivity
import com.tynan.mathtutor.ProgressActivity
import com.tynan.mathtutor.SymbolsActivity
import com.tynan.mathtutor.R
import com.tynan.mathtutor.TimerActivity
import com.tynan.mathtutor.overlay.MenuItem
import com.tynan.mathtutor.overlay.OverlayController
import com.tynan.mathtutor.timer.TimerController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * The bubble on its own — no tutoring session, no API key, no microphone and no
 * screen capture. It exists so the offline tools (formula sheet, focus timer,
 * ambient sound, practice) are one tap away while you work in another app.
 *
 * Deliberately a separate service from [RealtimeService] rather than a mode flag
 * inside it: that service's `settings` field is only initialised on ACTION_START
 * and its "already running" guard keys off the transport, both of which would
 * misbehave here. The two are mutually exclusive — starting a session stops this.
 *
 * Note the foreground service type is `specialUse`, NOT microphone/mediaProjection:
 * on API 34+ those throw SecurityException unless the matching permission or
 * projection token is held, which is exactly what this service does without.
 */
class BubbleService : Service() {

    private var overlay: OverlayController? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (overlay != null) return START_STICKY // already showing

        createChannel()
        startForegroundCompat()

        overlay = OverlayController(
            context = this,
            onTap = {},                    // no hint without a session
            onHoldStart = { stopSelf() },  // hold to put the bubble away
            onHoldEnd = {},
            onMenu = { showMenu() },
            instantMenu = true,
        ).also { it.show() }

        // The timer badge is a plain in-process singleton, so it works here too.
        // Same formatting as the session bubble uses.
        scope.launch {
            TimerController.state.collectLatest { timer ->
                overlay?.setTimerText(
                    if (timer.running) {
                        (if (timer.onBreak) "☕" else "") + "${(timer.remainingSec + 59) / 60}m"
                    } else null
                )
            }
        }
        running = true
        return START_STICKY
    }

    private fun showMenu() {
        overlay?.showMenu(
            listOf(
                MenuItem("formulas", "🧮", "Formula sheet"),
                MenuItem("symbols", "∫", "Symbols"),
                MenuItem("practice", "✏️", "Practice"),
                MenuItem("progress", "📊", "My progress"),
                MenuItem("timer", "⏱", "Focus timer"),
                MenuItem("ambient", "🌧", "Ambient sound"),
                MenuItem("hide", "✕", "Hide bubble"),
            )
        ) { id ->
            when (id) {
                "formulas" -> openActivity(FormulaSheetActivity::class.java)
                "symbols" -> openActivity(SymbolsActivity::class.java)
                "practice" -> openActivity(PracticeSpaceActivity::class.java)
                "progress" -> openActivity(ProgressActivity::class.java)
                "timer" -> openActivity(TimerActivity::class.java)
                "ambient" -> openActivity(TimerActivity::class.java, scrollToAmbient = true)
                "hide" -> stopSelf()
            }
        }
    }

    /** Allowed from the background because the app holds SYSTEM_ALERT_WINDOW. */
    private fun openActivity(cls: Class<*>, scrollToAmbient: Boolean = false) {
        startActivity(
            Intent(this, cls)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .apply { if (scrollToAmbient) putExtra(TimerActivity.EXTRA_SHOW_AMBIENT, true) }
        )
    }

    private fun startForegroundCompat() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createChannel() {
        // Its own channel, not the tutor session's — people mute channels, and
        // muting "bubble" should not silence a live session's controls.
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Study bubble", NotificationManager.IMPORTANCE_LOW)
        )
    }

    private fun buildNotification(): Notification {
        val stopIntent = PendingIntent.getService(
            this, 21,
            Intent(this, BubbleService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_tutor)
            .setContentTitle("Study bubble")
            .setContentText("Tap the bubble for formulas, timer and practice")
            .setOngoing(true)
            .addAction(0, "Hide", stopIntent)
            .build()
    }

    override fun onDestroy() {
        running = false
        scope.cancel()
        overlay?.hide()
        overlay = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "com.tynan.mathtutor.BUBBLE_STOP"
        private const val CHANNEL_ID = "bubble"
        private const val NOTIFICATION_ID = 21

        /** So the UI can show the right toggle label and the session can stand down. */
        @Volatile
        var running: Boolean = false
            private set

        fun start(context: android.content.Context) {
            context.startForegroundService(Intent(context, BubbleService::class.java))
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, BubbleService::class.java))
        }
    }
}
