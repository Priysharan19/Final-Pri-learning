// Pri Learning · navigation policy (CP-06). Only the bundled origin loads in
// the WebView; http(s)/mailto links leave the app; anything else is blocked.
// Mirrors the Apple shell's policy, so no remote page can reach priBridge.
package com.prilearning.app.shell

import android.net.Uri

object NavigationPolicy {
    enum class Decision { LOAD_IN_APP, OPEN_EXTERNALLY, BLOCK }

    fun decide(uri: Uri?): Decision = decide(uri?.scheme, uri?.host)

    fun decide(scheme: String?, host: String?): Decision {
        val s = scheme?.lowercase()
        val h = host?.lowercase()
        if (s == "https" && h == AssetOrigin.DOMAIN) return Decision.LOAD_IN_APP
        if (s == "https" || s == "http" || s == "mailto") return Decision.OPEN_EXTERNALLY
        return Decision.BLOCK
    }
}
