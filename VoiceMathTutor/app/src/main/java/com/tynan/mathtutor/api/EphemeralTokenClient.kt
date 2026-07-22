package com.tynan.mathtutor.api

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Mints a short-lived ephemeral client secret for the Realtime API from the
 * user's standard API key. Call immediately before creating the WebRTC offer —
 * the token expires roughly a minute after minting.
 */
object EphemeralTokenClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun mint(apiKey: String, sessionConfig: JSONObject): String {
        val body = JSONObject().put("session", sessionConfig)
        val request = Request.Builder()
            .url("https://api.openai.com/v1/realtime/client_secrets")
            .header("Authorization", "Bearer $apiKey")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("client_secrets failed (${response.code}): $responseBody")
            }
            val json = JSONObject(responseBody)
            return json.optString("value").ifEmpty {
                json.optJSONObject("client_secret")?.optString("value")
                    ?: throw IOException("No client secret in response")
            }
        }
    }
}
