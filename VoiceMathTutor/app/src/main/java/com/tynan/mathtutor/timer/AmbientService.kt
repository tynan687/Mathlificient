package com.tynan.mathtutor.timer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.tynan.mathtutor.R
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.math.min
import kotlin.random.Random

/**
 * Offline ambient sound: a seamlessly-looped, locally synthesised noise buffer
 * (white / pink / brown / rain). Runs as a mediaPlayback foreground service so
 * it keeps playing while the student works in Samsung Notes.
 */
class AmbientService : Service() {

    data class AmbientState(
        val playing: Boolean = false,
        val type: String = "rain",
        val volume: Float = 0.35f,
    )

    private var track: AudioTrack? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_PLAY -> {
                val type = intent.getStringExtra(EXTRA_TYPE) ?: "rain"
                val volume = intent.getFloatExtra(EXTRA_VOLUME, 0.35f)
                createChannel()
                startForeground(
                    NOTIFICATION_ID,
                    buildNotification(type),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
                play(type, volume)
            }

            ACTION_VOLUME -> {
                val volume = intent.getFloatExtra(EXTRA_VOLUME, 0.35f)
                track?.setVolume(volume)
                state.value = state.value.copy(volume = volume)
            }
        }
        return START_NOT_STICKY
    }

    private fun play(type: String, volume: Float) {
        stopTrack()
        val sampleRate = 44_100
        val seconds = 6
        val frames = sampleRate * seconds
        val pcm = ShortArray(frames)
        var b0 = 0.0; var b1 = 0.0; var b2 = 0.0
        var brown = 0.0
        var lp = 0.0
        val rng = Random(System.nanoTime())
        for (i in 0 until frames) {
            val white = rng.nextDouble() * 2 - 1
            val sample = when (type) {
                "white" -> white * 0.30
                "pink" -> {
                    b0 = 0.99765 * b0 + white * 0.0990460
                    b1 = 0.96300 * b1 + white * 0.2965164
                    b2 = 0.57000 * b2 + white * 1.0526913
                    (b0 + b1 + b2 + white * 0.1848) * 0.10
                }
                "brown" -> {
                    brown = (brown + 0.02 * white) / 1.02
                    brown * 2.8
                }
                else -> { // rain: lowpassed pink
                    b0 = 0.99765 * b0 + white * 0.0990460
                    b1 = 0.96300 * b1 + white * 0.2965164
                    b2 = 0.57000 * b2 + white * 1.0526913
                    val pink = (b0 + b1 + b2 + white * 0.1848) * 0.11
                    lp += 0.08 * (pink - lp)
                    lp * 2.2
                }
            }
            pcm[i] = (sample.coerceIn(-0.95, 0.95) * Short.MAX_VALUE).toInt().toShort()
        }
        // Crossfade the loop seam so it's inaudible.
        val fade = sampleRate / 5
        for (i in 0 until fade) {
            val mix = i.toFloat() / fade
            pcm[i] = (pcm[i] * mix + pcm[frames - fade + i] * (1 - mix)).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }

        val bytes = frames * 2
        val t = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(bytes)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        t.write(pcm, 0, min(frames, pcm.size))
        t.setLoopPoints(0, frames, -1)
        t.setVolume(volume)
        t.play()
        track = t
        state.value = AmbientState(playing = true, type = type, volume = volume)
    }

    private fun stopTrack() {
        track?.let { runCatching { it.stop(); it.release() } }
        track = null
    }

    private fun createChannel() {
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Ambient sound", NotificationManager.IMPORTANCE_LOW)
        )
    }

    private fun buildNotification(type: String): Notification {
        val stopIntent = PendingIntent.getService(
            this, 11,
            Intent(this, AmbientService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_tutor)
            .setContentTitle("Ambient sound — $type")
            .setContentText("Synthesised locally, fully offline")
            .setOngoing(true)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    override fun onDestroy() {
        stopTrack()
        state.value = AmbientState(playing = false)
        super.onDestroy()
    }

    companion object {
        const val ACTION_PLAY = "com.tynan.mathtutor.AMBIENT_PLAY"
        const val ACTION_STOP = "com.tynan.mathtutor.AMBIENT_STOP"
        const val ACTION_VOLUME = "com.tynan.mathtutor.AMBIENT_VOLUME"
        const val EXTRA_TYPE = "type"
        const val EXTRA_VOLUME = "volume"
        private const val NOTIFICATION_ID = 77
        private const val CHANNEL_ID = "ambient"

        val state = MutableStateFlow(AmbientState())
    }
}
