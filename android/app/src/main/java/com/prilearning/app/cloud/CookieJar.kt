// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native cloud cookie jar (CP-07)
//
// Holds the cloud session and CSRF cookies outside the WebView: the page never
// sees them (the session cookie is HttpOnly on the server anyway), and the
// WebView's own cookie store never holds a cloud session. Cookies are
// host-only for the single configured origin, Secure cookies go only over
// HTTPS, and a Set-Cookie that expires a cookie (logout) removes it. Pure JVM
// so it is unit-tested; persistence (encrypted) lives in SecureStore.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.cloud

import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class CookieJar(private val now: () -> Long = System::currentTimeMillis) {
    data class Cookie(
        val name: String,
        val value: String,
        val host: String,
        val path: String,
        val expiresAt: Long?, // null: a session cookie, dropped with the process
        val secure: Boolean,
    )

    private companion object {
        const val MAX_COOKIES = 40
        const val MAX_VALUE = 4096
        val NAME = Regex("^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$")
    }

    private val cookies = LinkedHashMap<String, Cookie>()

    /** One parsed Set-Cookie. A parser of our own (not java.net.HttpCookie,
     *  whose Expires handling differs between the JVM and Android). */
    data class SetCookie(val name: String, val value: String, val path: String?, val domain: String?,
                         val maxAge: Long?, val expires: Long?, val secure: Boolean)

    fun parse(header: String): SetCookie? {
        val parts = header.split(';')
        val nv = parts.first()
        val eq = nv.indexOf('=')
        if (eq <= 0) return null
        val name = nv.substring(0, eq).trim()
        val value = nv.substring(eq + 1).trim().removeSurrounding("\"")
        var path: String? = null; var domain: String? = null; var maxAge: Long? = null; var expires: Long? = null; var secure = false
        for (attr in parts.drop(1)) {
            val i = attr.indexOf('=')
            val k = (if (i < 0) attr else attr.substring(0, i)).trim().lowercase()
            val v = if (i < 0) "" else attr.substring(i + 1).trim()
            when (k) {
                "path" -> path = v
                "domain" -> domain = v
                "max-age" -> maxAge = v.toLongOrNull()
                "expires" -> expires = httpDate(v)
                "secure" -> secure = true
            }
        }
        return SetCookie(name, value, path, domain, maxAge, expires, secure)
    }

    private fun httpDate(v: String): Long? {
        for (pattern in listOf("EEE, dd MMM yyyy HH:mm:ss zzz", "EEE, dd-MMM-yyyy HH:mm:ss zzz", "EEE, dd-MMM-yy HH:mm:ss zzz")) {
            try {
                val f = SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("GMT"); isLenient = false }
                return f.parse(v)?.time
            } catch (_: Exception) { /* next pattern */ }
        }
        return null
    }

    @Synchronized
    fun store(host: String, setCookieHeaders: List<String>) {
        val h = host.lowercase()
        for (header in setCookieHeaders) {
            val c = parse(header) ?: continue
            if (!NAME.matches(c.name) || c.value.length > MAX_VALUE) continue
            // Host-only: a Domain attribute is honoured only when it names this host.
            val domain = c.domain?.trimStart('.')?.lowercase()
            if (!domain.isNullOrEmpty() && domain != h) continue
            val path = c.path?.takeIf { it.startsWith("/") } ?: "/"
            val key = "$h|$path|${c.name}"
            // Max-Age wins over Expires (RFC 6265 §5.3). Zero/negative or a past
            // date deletes the cookie: that is how the server logs a device out.
            val expiresAt = when {
                c.maxAge != null -> now() + c.maxAge * 1000
                c.expires != null -> c.expires
                else -> null
            }
            cookies.remove(key)
            if (expiresAt != null && expiresAt <= now()) continue
            cookies[key] = Cookie(c.name, c.value, h, path, expiresAt, c.secure)
            while (cookies.size > MAX_COOKIES) cookies.remove(cookies.keys.first())
        }
    }

    private fun purgeExpired() {
        val t = now()
        cookies.values.removeAll { it.expiresAt != null && it.expiresAt <= t }
    }

    /** The Cookie request header for a request to host+path, or null. */
    @Synchronized
    fun header(host: String, path: String, https: Boolean): String? {
        purgeExpired()
        val h = host.lowercase()
        val matching = cookies.values.filter { c ->
            c.host == h && (!c.secure || https) &&
                (path == c.path || path.startsWith(if (c.path.endsWith("/")) c.path else c.path + "/"))
        }.sortedByDescending { it.path.length }
        return if (matching.isEmpty()) null else matching.joinToString("; ") { "${it.name}=${it.value}" }
    }

    @Synchronized
    fun value(host: String, name: String): String? {
        purgeExpired()
        return cookies.values.firstOrNull { it.host == host.lowercase() && it.name == name }?.value
    }

    @Synchronized
    fun clear() = cookies.clear()

    @Synchronized
    fun isEmpty(): Boolean { purgeExpired(); return cookies.isEmpty() }

    /** Persistent cookies only, as JSON (encrypted by SecureStore before disk). */
    @Synchronized
    fun serialize(): String {
        purgeExpired()
        val list = JSONArray()
        for (c in cookies.values) {
            if (c.expiresAt == null) continue
            list.put(JSONObject().put("n", c.name).put("v", c.value).put("h", c.host).put("p", c.path)
                .put("e", c.expiresAt).put("s", c.secure))
        }
        return JSONObject().put("v", 1).put("cookies", list).toString()
    }

    @Synchronized
    fun load(json: String?) {
        cookies.clear()
        if (json.isNullOrEmpty()) return
        val root = try { JSONObject(json) } catch (_: Exception) { return }
        if (root.optInt("v") != 1) return
        val list = root.optJSONArray("cookies") ?: return
        for (i in 0 until minOf(list.length(), MAX_COOKIES)) {
            val o = list.optJSONObject(i) ?: continue
            val name = o.optString("n"); val value = o.optString("v")
            if (!NAME.matches(name) || value.length > MAX_VALUE) continue
            val c = Cookie(name, value, o.optString("h").lowercase(), o.optString("p", "/"), o.optLong("e"), o.optBoolean("s"))
            cookies["${c.host}|${c.path}|${c.name}"] = c
        }
        purgeExpired()
    }
}
