// Pri Learning · navigation policy (CP-06). Only the exact bundled origin
// (https, no port, no userinfo) loads in the WebView. Any other form of the
// bundled host is blocked, since the asset loader would not serve it and it
// would reach the real network host. http(s)/mailto links leave the app only
// for a main-frame navigation the person started (a gesture); scripted
// redirects and subframes never launch another app. Everything else is blocked.
// Mirrors the Apple shell's policy, so no remote page can reach priBridge.
package com.prilearning.app.shell

import android.net.Uri

object NavigationPolicy {
    enum class Decision { LOAD_IN_APP, OPEN_EXTERNALLY, BLOCK }

    fun decide(uri: Uri?, mainFrame: Boolean, gesture: Boolean): Decision =
        decide(uri?.scheme, uri?.host, uri?.port ?: -1, uri?.userInfo, mainFrame, gesture)

    fun decide(
        scheme: String?,
        host: String?,
        port: Int = -1,
        userInfo: String? = null,
        mainFrame: Boolean = true,
        gesture: Boolean = true,
    ): Decision {
        val s = scheme?.lowercase()
        val h = host?.lowercase()
        if (h == AssetOrigin.DOMAIN) {
            return if (s == "https" && port == -1 && userInfo == null) Decision.LOAD_IN_APP else Decision.BLOCK
        }
        if (s == "https" || s == "http" || s == "mailto") {
            return if (mainFrame && gesture) Decision.OPEN_EXTERNALLY else Decision.BLOCK
        }
        return Decision.BLOCK
    }

    /** A request for the bundled host the asset loader will not serve (another
     *  port, userinfo, http). It must be answered locally, never by the network. */
    fun isUnservedBundledHost(uri: Uri?): Boolean =
        uri?.host?.lowercase() == AssetOrigin.DOMAIN &&
            !(uri.scheme?.lowercase() == "https" && uri.port == -1 && uri.userInfo == null)
}
