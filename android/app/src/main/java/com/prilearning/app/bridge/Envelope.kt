// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative envelope v1 on Android (CP-06)
//
// The Kotlin half of docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4.3.
// Pure (org.json only) so it is unit-tested on the JVM. Every inbound message
// is untrusted: anything malformed, oversized, of another protocol, or using a
// native-only id is dropped without a reply.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.bridge

import org.json.JSONObject

object Envelope {
    const val PROTOCOL = 1
    const val MAX_ENVELOPE_CHARS = 8 * 1024 * 1024
    const val NATIVE_ID_PREFIX = "n:"
    private val CAP = Regex("^[a-z][a-z0-9]{1,23}$")
    private val OP = Regex("^[a-zA-Z][a-zA-Z0-9.]{0,47}$")

    data class Request(val id: String, val cap: String, val op: String, val payload: JSONObject)
    data class Reply(val id: String, val ok: Boolean, val result: JSONObject?, val error: JSONObject?)

    sealed class Inbound {
        data class FromPage(val request: Request) : Inbound()
        data class AnswerToNative(val reply: Reply) : Inbound()
        data object Invalid : Inbound()
    }

    fun parse(raw: String?): Inbound {
        if (raw == null || raw.length > MAX_ENVELOPE_CHARS) return Inbound.Invalid
        val json = try { JSONObject(raw) } catch (_: Exception) { return Inbound.Invalid }
        if (json.optInt("v", -1) != PROTOCOL) return Inbound.Invalid
        val id = json.optString("id", "")
        if (id.isEmpty() || id.length > 120) return Inbound.Invalid
        if (id.startsWith(NATIVE_ID_PREFIX)) {
            if (!json.has("ok")) return Inbound.Invalid
            return Inbound.AnswerToNative(Reply(id, json.optBoolean("ok", false), json.optJSONObject("result"), json.optJSONObject("error")))
        }
        val cap = json.optString("cap", "")
        val op = json.optString("op", "")
        if (!CAP.matches(cap) || !OP.matches(op)) return Inbound.Invalid
        return Inbound.FromPage(Request(id, cap, op, json.optJSONObject("payload") ?: JSONObject()))
    }

    fun ok(id: String, result: JSONObject = JSONObject()): String =
        JSONObject().put("v", PROTOCOL).put("id", id).put("ok", true).put("result", result).toString()

    /** A failure in the closed priNative code set; a provider-specific code
     *  (e.g. CLOUD_NETWORK_ERROR) travels as error.detail.providerCode. */
    fun fail(id: String, code: String, message: String, providerCode: String? = null): String =
        JSONObject().put("v", PROTOCOL).put("id", id).put("ok", false)
            .put("error", JSONObject().put("code", code).put("message", message).put("retryable", code == "UNAVAILABLE" || code == "TIMEOUT")
                .apply { if (providerCode != null) put("detail", JSONObject().put("providerCode", providerCode)) }).toString()

    fun event(event: String, seq: Int, payload: JSONObject): String =
        JSONObject().put("v", PROTOCOL).put("event", event).put("seq", seq).put("payload", payload).toString()

    fun nativeRequest(id: String, req: String, payload: JSONObject = JSONObject()): String =
        JSONObject().put("v", PROTOCOL).put("id", id).put("req", req).put("payload", payload).toString()
}
