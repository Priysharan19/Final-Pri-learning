// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · file exchange rules (CP-07) — pure, JVM-tested.
//
// What a shared file may be called, how big it may be, and which document
// types a web `<input accept>` asks the system picker for.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.io

object FileRules {
    const val MAX_SHARE_BYTES = 6 * 1024 * 1024
    private val MIME = Regex("^[a-z]+/[a-z0-9.+-]+$", RegexOption.IGNORE_CASE)
    private val EXTENSIONS = mapOf(
        "json" to "application/json", "csv" to "text/csv", "txt" to "text/plain", "pdf" to "application/pdf",
        "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "webp" to "image/webp", "heic" to "image/heic",
    )

    /** Same rule as client/src/platform/native/index.js safeFilename + the Apple shell. */
    fun safeFilename(raw: String?): String {
        val cleaned = (raw ?: "").replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "-")
            .trim().trimStart('.').take(120).trim()
        return cleaned.ifEmpty { "pri-export" }
    }

    fun safeMime(raw: String?): String = raw?.takeIf { MIME.matches(it) }?.lowercase() ?: "application/octet-stream"

    /**
     * The MIME types for the system picker from `<input accept>` entries
     * (mime types, wildcards, or .extensions). JSON exports are often labelled
     * application/octet-stream by file providers, so JSON also admits that: the
     * page validates the content of whatever it reads (lib/files.js).
     */
    fun pickerMimeTypes(accept: Array<String>?): Array<String> {
        val out = linkedSetOf<String>()
        for (entry in accept.orEmpty().flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }) {
            when {
                entry.startsWith(".") -> EXTENSIONS[entry.drop(1)]?.let { out += it }
                entry == "image/*" || entry == "video/*" || entry == "audio/*" -> out += entry
                MIME.matches(entry) -> out += entry
            }
        }
        if ("application/json" in out) { out += "application/octet-stream"; out += "text/plain" }
        return if (out.isEmpty()) arrayOf("*/*") else out.toTypedArray()
    }

    fun acceptsImages(types: Array<String>): Boolean = types.any { it == "image/*" || it.startsWith("image/") || it == "*/*" }
}
