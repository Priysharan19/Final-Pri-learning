// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android host descriptor (CP-06)
//
// The deep-frozen, non-configurable `window.__PRI_HOST__` installed at document
// start for the bundled origin only. Capabilities, never OS identity: lifecycle
// (with a hardware Back button), durable storage and device facts (CP-06);
// cloud (configured only when the build carries a cloud origin) and share
// (files, binary, print) over the envelope bridge (CP-07), and billing with
// store "google-play" (CP-08; the server decides entitlement). Ink and photo OCR are deliberately absent: Android writes on the
// shared web canvas, and photos are attached through the system file picker.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.bridge

import org.json.JSONArray
import org.json.JSONObject

object HostDescriptor {
    data class Shell(val version: String, val build: String, val id: String)

    private fun cap(vararg facts: Pair<String, Any>) = JSONObject().put("versions", JSONArray().put(1)).apply {
        for ((k, v) in facts) put(k, v)
    }

    fun json(shell: Shell, release: JSONObject?, cloudConfigured: Boolean = false, extra: Map<String, JSONObject> = emptyMap(), stylusSeen: Boolean = false): JSONObject {
        val capabilities = JSONObject()
            .put("lifecycle", cap("backButton" to true))
            .put("storage", cap("durable" to true))
            .put("device", cap("safeAreaApplied" to true, "stylusSeen" to stylusSeen))
            .put("cloud", cap("transport" to "bridge", "configured" to cloudConfigured))
            .put("share", cap("transport" to "bridge", "binary" to true, "print" to true))
            .put("billing", cap("transport" to "bridge", "store" to "google-play"))
        for ((name, value) in extra) capabilities.put(name, value)
        return JSONObject()
            .put("protocol", Envelope.PROTOCOL)
            .put("bundledAssets", true)
            .put("shell", JSONObject().put("version", shell.version).put("build", shell.build).put("id", shell.id))
            .put("capabilities", capabilities)
            .apply { if (release != null) put("release", release) }
    }

    /** Document-start script: deep-freeze, then define non-writable/non-configurable. */
    fun script(descriptor: JSONObject): String =
        "(function(){var h=$descriptor;function f(o){Object.freeze(o);Object.keys(o).forEach(function(k){var v=o[k];" +
            "if(v&&typeof v==='object'&&!Object.isFrozen(v))f(v);});return o;}" +
            "if(!Object.prototype.hasOwnProperty.call(window,'__PRI_HOST__'))" +
            "Object.defineProperty(window,'__PRI_HOST__',{value:f(h),writable:false,configurable:false,enumerable:false});})();"
}
