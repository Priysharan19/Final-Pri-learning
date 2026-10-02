// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android host descriptor (CP-06)
//
// The deep-frozen, non-configurable `window.__PRI_HOST__` installed at document
// start for the bundled origin only. Capabilities, never OS identity. CP-06
// advertises lifecycle (with a hardware Back button), durable storage and
// device facts; cloud/photo/share/files arrive in CP-07 and billing in CP-08.
// Ink is deliberately absent: Android writes on the shared web canvas.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.bridge

import org.json.JSONArray
import org.json.JSONObject

object HostDescriptor {
    data class Shell(val version: String, val build: String, val id: String)

    private fun cap(vararg facts: Pair<String, Any>) = JSONObject().put("versions", JSONArray().put(1)).apply {
        for ((k, v) in facts) put(k, v)
    }

    fun json(shell: Shell, release: JSONObject?, extra: Map<String, JSONObject> = emptyMap()): JSONObject {
        val capabilities = JSONObject()
            .put("lifecycle", cap("backButton" to true))
            .put("storage", cap("durable" to true))
            .put("device", cap("safeAreaApplied" to true, "stylusSeen" to false))
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
