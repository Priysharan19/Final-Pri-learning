// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android App Links (parity with the Apple shell's onOpenURL)
//
// Only https://<signed cloud host>/account-action#<fragment> is accepted, and
// it is loaded into the bundled app at the same route — the same rule as
// WebShell.route(deepLink:) on iPad. The fragment carries a one-time token: it
// is never logged and never becomes a query. Anything else is ignored (the
// shell keeps whatever page it has). Verification needs assetlinks.json on the
// production origin, an owner/Play-signing action; until then Android shows
// the link chooser instead of opening the app directly.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.shell

import java.net.URI

object DeepLink {
    const val MAX_FRAGMENT = 1024

    /** The bundled-app URL to load for [link], or null when it is not an accepted link. */
    fun accountActionTarget(link: String?, cloudOrigin: String?): String? {
        if (link.isNullOrEmpty() || cloudOrigin.isNullOrEmpty()) return null
        val uri = try { URI(link) } catch (_: Exception) { return null }
        val origin = try { URI(cloudOrigin) } catch (_: Exception) { return null }
        if (uri.scheme?.lowercase() != "https" || origin.scheme?.lowercase() != "https") return null
        val host = uri.host?.lowercase() ?: return null
        if (host != origin.host?.lowercase() || uri.port != origin.port) return null
        if (uri.rawUserInfo != null || uri.rawQuery != null) return null
        if (uri.rawPath != "/account-action") return null
        val fragment = uri.rawFragment ?: return null
        if (fragment.isEmpty() || fragment.length > MAX_FRAGMENT || fragment.any { it.code !in 0x21..0x7E }) return null
        return "${AssetOrigin.ORIGIN}/account-action#$fragment"
    }
}
