// Pri Learning · minimum WebView (CP-06). The shared build targets chrome91;
// an older Android System WebView would render a blank page, so the shell shows
// an update screen instead (docs/cross-platform/ANDROID_ARCHITECTURE.md §1).
package com.prilearning.app.shell

object WebViewFloor {
    const val MIN_CHROMIUM_MAJOR = 91

    /** "126.0.6478.71" → 126; unparseable → null. */
    fun majorOf(versionName: String?): Int? = versionName?.trim()?.substringBefore('.')?.toIntOrNull()

    fun isSupported(versionName: String?): Boolean = (majorOf(versionName) ?: 0) >= MIN_CHROMIUM_MAJOR
}
