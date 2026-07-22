package com.tynan.mathtutor.capture

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.view.WindowManager
import java.io.ByteArrayOutputStream

/**
 * MediaProjection → VirtualDisplay → ImageReader. Holds the most recent frame so a
 * single on-demand capture works even when the screen has been static (a fresh
 * frame is only produced on invalidation, so we keep the last one alive).
 */
class ScreenCaptureManager(private val context: Context) {

    private val handlerThread = HandlerThread("screen-capture").apply { start() }
    private val handler = Handler(handlerThread.looper)

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var heldImage: Image? = null
    private val lock = Any()

    @Volatile
    private var released = false

    fun start(resultCode: Int, resultData: Intent) {
        val mpm = context.getSystemService(MediaProjectionManager::class.java) ?: return
        val projection = mpm.getMediaProjection(resultCode, resultData) ?: return
        mediaProjection = projection
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                release()
            }
        }, handler)

        val bounds = context.getSystemService(WindowManager::class.java)
            .currentWindowMetrics.bounds
        val width = bounds.width()
        val height = bounds.height()
        val density = context.resources.configuration.densityDpi

        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
        reader.setOnImageAvailableListener({ r ->
            val image = try {
                r.acquireLatestImage()
            } catch (_: Exception) {
                null
            } ?: return@setOnImageAvailableListener
            synchronized(lock) {
                if (released) {
                    image.close()
                } else {
                    heldImage?.close()
                    heldImage = image
                }
            }
        }, handler)
        imageReader = reader

        virtualDisplay = projection.createVirtualDisplay(
            "tutor-screen",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            handler
        )
    }

    /**
     * Returns the latest frame as a base64 JPEG (longest side capped), or null if no
     * frame has arrived yet or capture was stopped. 1536px/q80 keeps small book text
     * (Kindle, PDFs) legible to the model; still well under a cent per screenshot.
     */
    fun captureJpegBase64(maxSide: Int = 1536, quality: Int = 80): String? {
        val bitmap = synchronized(lock) { heldImage?.let(::imageToBitmap) } ?: return null
        val scale = maxSide.toFloat() / maxOf(bitmap.width, bitmap.height)
        val scaled = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).toInt().coerceAtLeast(1),
                (bitmap.height * scale).toInt().coerceAtLeast(1),
                true
            )
        } else {
            bitmap
        }
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    private var lastWatchHash = 0

    /**
     * Watch-mode variant: returns null when the screen looks identical to the last
     * watch capture, so a static page costs nothing.
     */
    fun captureIfChangedJpegBase64(maxSide: Int = 1536, quality: Int = 80): String? {
        val b64 = captureJpegBase64(maxSide, quality) ?: return null
        val hash = b64.hashCode()
        if (hash == lastWatchHash) return null
        lastWatchHash = hash
        return b64
    }

    private fun imageToBitmap(image: Image): Bitmap {
        val plane = image.planes[0]
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val paddedWidth = rowStride / pixelStride
        val padded = Bitmap.createBitmap(paddedWidth, image.height, Bitmap.Config.ARGB_8888)
        plane.buffer.rewind()
        padded.copyPixelsFromBuffer(plane.buffer)
        return if (paddedWidth != image.width) {
            Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
        } else {
            padded
        }
    }

    fun release() {
        synchronized(lock) {
            if (released) return
            released = true
            heldImage?.close()
            heldImage = null
        }
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        mediaProjection?.stop()
        mediaProjection = null
        handlerThread.quitSafely()
    }
}
