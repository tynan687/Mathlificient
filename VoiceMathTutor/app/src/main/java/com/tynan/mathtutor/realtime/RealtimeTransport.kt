package com.tynan.mathtutor.realtime

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Owns the WebRTC peer connection to the OpenAI Realtime API: microphone uplink,
 * TTS downlink (played automatically by the audio device module), and the
 * "oai-events" data channel used for session config, images, and server events.
 */
class RealtimeTransport(
    private val context: Context,
    private val listener: Listener,
) {
    interface Listener {
        fun onEvent(event: JSONObject)
        fun onDataChannelOpen()
        fun onDisconnected(reason: String)
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private var factory: PeerConnectionFactory? = null
    private var audioDeviceModule: JavaAudioDeviceModule? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var localAudioTrack: AudioTrack? = null
    private var dataChannel: DataChannel? = null
    private val iceGatheringComplete = CompletableDeferred<Unit>()

    @Volatile
    private var closed = false

    suspend fun connect(ephemeralKey: String, model: String, micEnabledAtStart: Boolean) {
        withContext(Dispatchers.Default) {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context.applicationContext)
                    .createInitializationOptions()
            )
            // Hardware AEC/NS where the Samsung HAL provides them; WebRTC's software
            // AEC3 covers the rest. Essential for speaker playback + open mic.
            audioDeviceModule = JavaAudioDeviceModule.builder(context.applicationContext)
                .setUseHardwareAcousticEchoCanceler(true)
                .setUseHardwareNoiseSuppressor(true)
                .createAudioDeviceModule()
            factory = PeerConnectionFactory.builder()
                .setAudioDeviceModule(audioDeviceModule)
                .createPeerConnectionFactory()

            val rtcConfig = PeerConnection.RTCConfiguration(emptyList()).apply {
                sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            }
            val pc = factory!!.createPeerConnection(rtcConfig, PeerObserver())
                ?: throw IOException("Failed to create peer connection")
            peerConnection = pc

            val audioConstraints = MediaConstraints().apply {
                mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
            }
            audioSource = factory!!.createAudioSource(audioConstraints)
            localAudioTrack = factory!!.createAudioTrack("mic0", audioSource).apply {
                setEnabled(micEnabledAtStart)
            }
            pc.addTrack(localAudioTrack, listOf("tutor-mic"))

            dataChannel = pc.createDataChannel("oai-events", DataChannel.Init()).apply {
                registerObserver(ChannelObserver())
            }

            val offer = createOffer(pc)
            setDescription { obs -> pc.setLocalDescription(obs, offer) }
            // Non-trickle: wait briefly so the SDP we post carries our ICE candidates.
            withTimeoutOrNull(2_000) { iceGatheringComplete.await() }
            val localSdp = pc.localDescription?.description ?: offer.description

            val answerSdp = postOffer(ephemeralKey, model, localSdp)
            setDescription { obs ->
                pc.setRemoteDescription(
                    obs,
                    SessionDescription(SessionDescription.Type.ANSWER, answerSdp)
                )
            }
        }
    }

    fun sendEvent(event: JSONObject): Boolean {
        val channel = dataChannel ?: return false
        if (channel.state() != DataChannel.State.OPEN) return false
        val bytes = event.toString().toByteArray(StandardCharsets.UTF_8)
        return channel.send(DataChannel.Buffer(ByteBuffer.wrap(bytes), false))
    }

    fun setMicEnabled(enabled: Boolean) {
        localAudioTrack?.setEnabled(enabled)
    }

    fun close() {
        closed = true
        runCatching { dataChannel?.unregisterObserver() }
        runCatching { dataChannel?.close() }
        dataChannel = null
        runCatching { peerConnection?.close() }
        runCatching { peerConnection?.dispose() }
        peerConnection = null
        runCatching { audioSource?.dispose() }
        audioSource = null
        localAudioTrack = null
        runCatching { factory?.dispose() }
        factory = null
        runCatching { audioDeviceModule?.release() }
        audioDeviceModule = null
    }

    private fun postOffer(ephemeralKey: String, model: String, sdp: String): String {
        val request = Request.Builder()
            .url("https://api.openai.com/v1/realtime/calls?model=$model")
            .header("Authorization", "Bearer $ephemeralKey")
            .post(sdp.toRequestBody("application/sdp".toMediaType()))
            .build()
        httpClient.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("SDP exchange failed (${response.code}): $body")
            }
            return body
        }
    }

    private suspend fun createOffer(pc: PeerConnection): SessionDescription =
        suspendCancellableCoroutine { cont ->
            pc.createOffer(object : SdpObserverAdapter() {
                override fun onCreateSuccess(desc: SessionDescription) {
                    cont.resume(desc)
                }

                override fun onCreateFailure(error: String?) {
                    cont.resumeWithException(IOException("createOffer failed: $error"))
                }
            }, MediaConstraints())
        }

    private suspend fun setDescription(apply: (SdpObserver) -> Unit) =
        suspendCancellableCoroutine<Unit> { cont ->
            apply(object : SdpObserverAdapter() {
                override fun onSetSuccess() {
                    cont.resume(Unit)
                }

                override fun onSetFailure(error: String?) {
                    cont.resumeWithException(IOException("setDescription failed: $error"))
                }
            })
        }

    private open class SdpObserverAdapter : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String?) {}
        override fun onSetFailure(error: String?) {}
    }

    private inner class PeerObserver : PeerConnection.Observer {
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
            if (state == PeerConnection.IceGatheringState.COMPLETE) {
                iceGatheringComplete.complete(Unit)
            }
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
            if (closed) return
            when (newState) {
                PeerConnection.PeerConnectionState.FAILED,
                PeerConnection.PeerConnectionState.DISCONNECTED,
                PeerConnection.PeerConnectionState.CLOSED,
                -> listener.onDisconnected("Peer connection $newState")

                else -> Unit
            }
        }

        override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {}
        override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        override fun onIceCandidate(candidate: IceCandidate?) {}
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
        override fun onAddStream(stream: MediaStream?) {}
        override fun onRemoveStream(stream: MediaStream?) {}
        override fun onDataChannel(channel: DataChannel?) {}
        override fun onRenegotiationNeeded() {}
        override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
            // Remote audio plays automatically through the audio device module.
        }
    }

    private inner class ChannelObserver : DataChannel.Observer {
        override fun onBufferedAmountChange(previousAmount: Long) {}

        override fun onStateChange() {
            if (dataChannel?.state() == DataChannel.State.OPEN) {
                listener.onDataChannelOpen()
            }
        }

        override fun onMessage(buffer: DataChannel.Buffer) {
            val bytes = ByteArray(buffer.data.remaining())
            buffer.data.get(bytes)
            val text = String(bytes, StandardCharsets.UTF_8)
            try {
                listener.onEvent(JSONObject(text))
            } catch (e: Exception) {
                Log.w(TAG, "Unparseable event: ${text.take(200)}", e)
            }
        }
    }

    private companion object {
        const val TAG = "RealtimeTransport"
    }
}
