// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android cloud configuration (CP-07)
//
// Pure rules shared by the bridge and its JVM tests: which origin the shell
// may talk to, and which requests JavaScript may ask it to make. JavaScript
// never supplies a destination origin; it supplies a `/v1/…` path only, the
// same contract as the Apple NativeCloudBridge and client/src/platform/cloudTransport.js.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.cloud

import java.net.URI

object CloudConfig {
    const val CLIENT_ID = "android-native-v1"
    const val MAX_REQUEST_BYTES = 1 * 1024 * 1024
    const val MAX_RESPONSE_BYTES = 2 * 1024 * 1024
    const val MAX_IN_FLIGHT = 32
    val METHODS = setOf("GET", "POST", "PATCH", "DELETE")
    // Identical to cloudTransport.js PATH: no query, fragment, dots or escapes.
    private val PATH = Regex("^/v1/[A-Za-z0-9/_-]{1,180}$")
    private val LOCAL_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2", "::1", "[::1]")

    /** Debug/test builds only (the caller checks BuildConfig.DEBUG). */
    @Volatile var debugOverride: String? = null

    /**
     * An origin with no path, query, fragment or userinfo. Release builds accept
     * HTTPS only; debug builds also accept http to the emulator host/loopback.
     * Returns the normalised origin (scheme://host[:port]) or null (cloud off).
     */
    fun validateOrigin(raw: String?, debug: Boolean): String? {
        val text = raw?.trim().orEmpty()
        if (text.isEmpty()) return null
        val uri = try { URI(text) } catch (_: Exception) { return null }
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host?.lowercase() ?: return null
        if (uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null) return null
        if (!(uri.rawPath.isNullOrEmpty() || uri.rawPath == "/")) return null
        val local = host in LOCAL_HOSTS
        if (!(scheme == "https" || (debug && scheme == "http" && local))) return null
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://$host$port"
    }

    fun validPath(path: String?): Boolean = path != null && PATH.matches(path) && !path.contains("//")

    /** Visible ASCII only, bounded: nothing that could split or smuggle a header. */
    fun safeHeader(value: String?): Boolean =
        value != null && value.isNotEmpty() && value.length <= 160 && value.all { it.code in 0x21..0x7E }
}
