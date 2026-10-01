// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android native cloud transport (CP-07)
//
// The Android half of `priNative.cloud.request`: one bounded `/v1` JSON request
// to the single configured origin, with the session kept in the native,
// Keystore-encrypted cookie jar. Mirrors ios/…/NativeCloudBridge.swift:
//   · JavaScript supplies a path and method only — never an origin or headers;
//   · X-Pri-Client: android-native-v1, no Origin / Fetch Metadata (the server's
//     narrow native rule), and the CSRF header copied from the jar for every
//     mutation (CSRF is still enforced server-side);
//   · redirects are never followed (a 3xx is returned as-is, so nothing can
//     bounce the session cookie to another host);
//   · 1 MB request / 2 MB response caps, 32 in flight, cancellation by id, and
//     every in-flight request dropped when the document changes.
// It grants nothing: entitlement and identity are decided by the server.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.cloud

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future

class NativeCloud(
    /** Validated origin (CloudConfig.validateOrigin) or null: cloud is off. */
    val origin: String?,
    private val jar: CookieJar,
    private val persist: (String) -> Unit,
    private val executor: ExecutorService = Executors.newFixedThreadPool(4),
    private val open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
    /** versionCode, sent so the server's compatibility floor can ask for an update (CP-11). */
    private val shellBuild: String? = null,
) {
    /** What a request produced, delivered on the executor thread. */
    sealed class Outcome {
        data class Response(val status: Int, val body: String, val requestId: String?) : Outcome()
        data class Failure(val code: String, val providerCode: String, val message: String) : Outcome()
    }

    private class Call(@Volatile var connection: HttpURLConnection? = null, @Volatile var cancelled: Boolean = false) {
        @Volatile var future: Future<*>? = null
    }

    private val calls = ConcurrentHashMap<String, Call>()
    // Applying Set-Cookie and writing the jar happen under one lock, in order:
    // a logout that lands while another response refreshes the session can never
    // be overwritten on disk by the older snapshot.
    private val persistLock = Any()
    val configured: Boolean get() = origin != null
    val inFlight: Int get() = calls.size

    /**
     * Starts one request. `done` runs exactly once unless the request was
     * cancelled (a cancelled request never answers: JavaScript already stopped
     * waiting). Validation failures answer synchronously.
     */
    fun request(id: String, payload: JSONObject, done: (Outcome) -> Unit) {
        val base = origin ?: return done(Outcome.Failure("UNAVAILABLE", "CLOUD_DISABLED",
            "The Pri cloud is not configured in this build. Offline learning remains available."))
        val path = payload.optString("path", "")
        val method = payload.optString("method", "GET").uppercase()
        if (!CloudConfig.validPath(path) || method !in CloudConfig.METHODS) {
            return done(Outcome.Failure("BAD_REQUEST", "NATIVE_CLOUD_BAD_REQUEST", "The native cloud request is invalid."))
        }
        val body: ByteArray? = if (payload.has("body") && !payload.isNull("body")) {
            val text = payload.opt("body") as? String
                ?: return done(Outcome.Failure("BAD_REQUEST", "NATIVE_CLOUD_BAD_REQUEST", "The request body must be JSON text."))
            text.toByteArray(Charsets.UTF_8)
        } else null
        if (body != null && body.size > CloudConfig.MAX_REQUEST_BYTES) {
            return done(Outcome.Failure("TOO_LARGE", "CLOUD_REQUEST_TOO_LARGE", "The cloud request exceeded the native safety limit."))
        }
        if (method == "GET" && body != null) {
            return done(Outcome.Failure("BAD_REQUEST", "NATIVE_CLOUD_BAD_REQUEST", "A GET request has no body."))
        }
        if (calls.size >= CloudConfig.MAX_IN_FLIGHT) {
            return done(Outcome.Failure("UNAVAILABLE", "CLOUD_BUSY", "Too many cloud requests are in flight."))
        }
        val requestId = payload.optString("requestId", "").takeIf { CloudConfig.safeHeader(it) }
        val idempotency = payload.optString("idempotencyKey", "").takeIf { CloudConfig.safeHeader(it) }
        val call = Call()
        calls.put(id, call)?.let { previous -> previous.cancelled = true; previous.connection?.disconnect() }
        call.future = try {
            executor.submit {
                val outcome = perform(base, path, method, body, requestId, idempotency, call)
                calls.remove(id, call)
                if (!call.cancelled) done(outcome)
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            calls.remove(id, call)
            return done(Outcome.Failure("UNAVAILABLE", "CLOUD_SHUTDOWN", "The cloud transport is shutting down."))
        }
    }

    private fun perform(base: String, path: String, method: String, body: ByteArray?,
                        requestId: String?, idempotency: String?, call: Call): Outcome {
        val url = URL(base + path)
        val https = url.protocol == "https"
        val host = url.host
        var conn: HttpURLConnection? = null
        return try {
            conn = open(url)
            call.connection = conn
            if (call.cancelled) return Outcome.Failure("CANCELLED", "CLOUD_CANCELLED", "cancelled")
            conn.instanceFollowRedirects = false
            conn.useCaches = false
            conn.connectTimeout = 15_000
            conn.readTimeout = 60_000
            conn.requestMethod = method
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("X-Pri-Client", CloudConfig.CLIENT_ID)
            shellBuild?.takeIf { CloudConfig.safeHeader(it) }?.let { conn.setRequestProperty("X-Pri-Shell-Build", it) }
            jar.header(host, path, https)?.let { conn.setRequestProperty("Cookie", it) }
            if (method != "GET") jar.value(host, "pri_csrf")?.let { conn.setRequestProperty("X-Pri-CSRF", it) }
            requestId?.let { conn.setRequestProperty("X-Pri-Request-Id", it) }
            idempotency?.let { conn.setRequestProperty("Idempotency-Key", it) }
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setFixedLengthStreamingMode(body.size)
                conn.outputStream.use { it.write(body) }
            }
            val status = conn.responseCode
            val setCookies = conn.headerFields.entries.filter { it.key.equals("Set-Cookie", ignoreCase = true) }.flatMap { it.value }
            if (setCookies.isNotEmpty()) {
                synchronized(persistLock) {
                    jar.store(host, setCookies)
                    persist(jar.serialize())
                }
            }
            val stream: InputStream? = if (status >= 400) conn.errorStream else conn.inputStream
            val bytes = stream?.use { readCapped(it, CloudConfig.MAX_RESPONSE_BYTES) } ?: ByteArray(0)
            if (bytes.size > CloudConfig.MAX_RESPONSE_BYTES) {
                return Outcome.Failure("TOO_LARGE", "CLOUD_RESPONSE_TOO_LARGE", "The cloud response exceeded the native safety limit.")
            }
            val serverId = conn.getHeaderField("X-Pri-Request-Id")?.takeIf { CloudConfig.safeHeader(it) }
            Outcome.Response(status, String(bytes, Charsets.UTF_8), serverId)
        } catch (e: IOException) {
            if (call.cancelled) Outcome.Failure("CANCELLED", "CLOUD_CANCELLED", "cancelled")
            else Outcome.Failure("UNAVAILABLE", "CLOUD_NETWORK_ERROR", "The cloud service is unavailable.")
        } catch (e: Exception) {
            Outcome.Failure("PROVIDER_ERROR", "CLOUD_BAD_RESPONSE", "The cloud service returned an invalid response.")
        } finally {
            conn?.disconnect()
        }
    }

    private fun readCapped(input: InputStream, cap: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            if (out.size() > cap) break // one byte over is enough to refuse it
        }
        return out.toByteArray()
    }

    fun cancel(id: String) {
        val call = calls.remove(id) ?: return
        call.cancelled = true
        call.future?.cancel(true)
        call.connection?.disconnect()
    }

    /** A new document (reload/navigation) or teardown: nothing may answer the old page. */
    fun cancelAll() {
        for (id in calls.keys.toList()) cancel(id)
    }

    /** Forget the session on this device (Disconnect), whether or not the
     *  server logout succeeded — e.g. while offline. */
    fun forgetSession() {
        synchronized(persistLock) {
            jar.clear()
            persist(jar.serialize())
        }
    }

    fun shutdown() {
        cancelAll()
        executor.shutdownNow()
    }
}
