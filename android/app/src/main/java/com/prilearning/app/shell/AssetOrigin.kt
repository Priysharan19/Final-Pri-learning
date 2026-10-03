// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · bundled web origin (CP-06)
//
// The shared web build is served from https://appassets.androidplatform.net/
// by WebViewAssetLoader. That origin is the key to every student's IndexedDB
// and localStorage data and must never change (docs/cross-platform §4.4, CP-11).
// BrowserRouter needs an SPA fallback (extensionless paths → index.html), the
// same rule as the Apple LocalSchemeHandler. Anything else that is not in the
// bundle is a local 404 — never a fall-through to the real network host.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.shell

import android.content.res.AssetManager
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.IOException

object AssetOrigin {
    const val DOMAIN = "appassets.androidplatform.net"
    // Spelled out (not interpolated) so the architecture guard can pin it.
    const val ORIGIN = "https://appassets.androidplatform.net"
    const val START_URL = "$ORIGIN/"
    const val WEB_ROOT = "web"

    sealed class Resolved {
        data class Asset(val path: String, val mime: String) : Resolved()
        data object NotFound : Resolved()
    }

    private val MIME = mapOf(
        "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript",
        "css" to "text/css", "json" to "application/json", "webmanifest" to "application/manifest+json",
        "svg" to "image/svg+xml", "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg",
        "webp" to "image/webp", "ico" to "image/x-icon", "woff" to "font/woff", "woff2" to "font/woff2",
        "ttf" to "font/ttf", "wasm" to "application/wasm", "txt" to "text/plain", "map" to "application/json"
    )

    /** Pure mapping from a request path to a bundled asset (unit-tested). */
    fun resolve(rawPath: String): Resolved {
        val path = rawPath.substringBefore('?').substringBefore('#').trimStart('/')
        if (path.split('/').any { it == ".." || it == "." } || path.contains('\\') || path.contains('\u0000')) return Resolved.NotFound
        if (path.isEmpty()) return Resolved.Asset("$WEB_ROOT/index.html", "text/html")
        // The cloud API never lives on the bundled origin: answer it 404 rather
        // than the SPA page, so cloud discovery cannot mistake one for the other.
        if (path == "v1" || path.startsWith("v1/")) return Resolved.NotFound
        val last = path.substringAfterLast('/')
        if (!last.contains('.')) return Resolved.Asset("$WEB_ROOT/index.html", "text/html") // SPA route
        val ext = last.substringAfterLast('.').lowercase()
        val mime = MIME[ext] ?: return Resolved.NotFound
        return Resolved.Asset("$WEB_ROOT/$path", mime)
    }

    // Mirror of server/platform/headers.js contentSecurityPolicy(): scripts are
    // only the hashed Vite chunks served from this origin, style-src keeps
    // 'unsafe-inline' for React style attributes, KaTeX inline layout and the
    // ink guard's injected <style>, images/media may be data: or blob: (canvas
    // exports, photo capture, downloads), fonts are the bundled KaTeX woff2
    // files. connect-src stays 'self': in the native shell the web code never
    // talks to the cloud from the WebView — every /v1 request goes through
    // NativeCloud (priNative.cloud), which owns the session cookies outside the
    // WebView (CP-07). client/test/native-shell-csp-check.mjs reads this list
    // statically and refuses any directive weaker than the server policy.
    private val CSP_DIRECTIVES = listOf(
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    )
    val CONTENT_SECURITY_POLICY: String = CSP_DIRECTIVES.joinToString("; ")

    /** Every bundled response (asset or local 404) carries the server's hardening headers. */
    val SECURITY_HEADERS: Map<String, String> = mapOf(
        "Cache-Control" to "no-cache",
        "X-Content-Type-Options" to "nosniff",
        "Content-Security-Policy" to CONTENT_SECURITY_POLICY,
        "Referrer-Policy" to "no-referrer"
    )

    fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", SECURITY_HEADERS,
        ByteArrayInputStream("not in the Pri bundle".toByteArray()))

    private class BundledWeb(private val assets: AssetManager) : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse {
            return when (val r = resolve(path)) {
                is Resolved.Asset -> try {
                    WebResourceResponse(r.mime, if (r.mime.startsWith("text/") || r.mime.contains("json") || r.mime.contains("javascript")) "utf-8" else null,
                        assets.open(r.path)).apply {
                        responseHeaders = SECURITY_HEADERS
                    }
                } catch (_: IOException) {
                    notFound()
                }
                Resolved.NotFound -> notFound()
            }
        }
    }

    fun loader(assets: AssetManager): WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(DOMAIN)
        .setHttpAllowed(false)
        .addPathHandler("/", BundledWeb(assets))
        .build()
}
