// Pri Learning · bundled release identity (CP-06). The shell reads the same
// release.json the web build emits; it never keeps a second SHA/version constant.
package com.prilearning.app.release

import android.content.res.AssetManager
import org.json.JSONObject

object ReleaseIdentity {
    private val SHA = Regex("^[0-9a-f]{40}$")

    fun parse(text: String?): JSONObject? = try {
        val json = JSONObject(text ?: return null)
        if (json.optInt("schemaVersion") == 1 && SHA.matches(json.optString("releaseSha"))) json else null
    } catch (_: Exception) { null }

    fun read(assets: AssetManager): JSONObject? = try {
        assets.open("web/release.json").bufferedReader().use { parse(it.readText()) }
    } catch (_: Exception) { null }
}
