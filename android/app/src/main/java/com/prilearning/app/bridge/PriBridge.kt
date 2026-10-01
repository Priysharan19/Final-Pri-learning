// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priBridge for Android (CP-06)
//
// Origin-scoped WebMessageListener (never addJavascriptInterface): the page's
// `priBridge` object exists only for https://appassets.androidplatform.net,
// and every message must also come from the MAIN frame (document-start scripts
// and listeners reach every matching frame, so this is checked here).
// Replies, events and native→JS requests go back through the frame's
// JavaScriptReplyProxy. Nothing here grants entitlement or holds learning logic.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.bridge

import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.prilearning.app.shell.AssetOrigin
import org.json.JSONObject

class PriBridge(private val webView: WebView, private val descriptor: JSONObject) {
    private companion object { const val TAG = "PriBridge" }
    private val main = Handler(Looper.getMainLooper())
    private var reply: JavaScriptReplyProxy? = null
    private var seq = 0
    private var nextNativeId = 0
    private val pendingNative = HashMap<String, (Envelope.Reply?) -> Unit>()
    var state = "active"
        private set

    /** Installs the host descriptor and the listener. Returns false (fail closed)
     *  when the WebView lacks either feature: the page then runs as a browser. */
    fun install(): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return false
        val origins = setOf(AssetOrigin.ORIGIN)
        WebViewCompat.addDocumentStartJavaScript(webView, HostDescriptor.script(descriptor), origins)
        WebViewCompat.addWebMessageListener(webView, "priBridge", origins) { _, message, sourceOrigin, isMainFrame, proxy ->
            onMessage(message, sourceOrigin, isMainFrame, proxy)
        }
        return true
    }

    /** A new main-frame document starts its own event sequence and reply channel. */
    fun documentStarted() {
        seq = 0
        reply = null
        val waiting = pendingNative.values.toList()
        pendingNative.clear()
        waiting.forEach { it(null) }
    }

    private fun onMessage(message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, proxy: JavaScriptReplyProxy) {
        if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != AssetOrigin.ORIGIN) return
        reply = proxy
        when (val inbound = Envelope.parse(message.data)) {
            is Envelope.Inbound.FromPage -> handle(inbound.request, proxy)
            is Envelope.Inbound.AnswerToNative -> pendingNative.remove(inbound.reply.id)?.invoke(inbound.reply)
            Envelope.Inbound.Invalid -> Unit
        }
    }

    private fun handle(req: Envelope.Request, proxy: JavaScriptReplyProxy) {
        val out = when ("${req.cap}.${req.op}") {
            "host.ready" -> Envelope.ok(req.id)
            "host.diagnostics" -> Envelope.ok(req.id, JSONObject()
                .put("platform", "android")
                .put("os", Build.VERSION.SDK_INT.toString())
                .put("model", if (webView.resources.configuration.smallestScreenWidthDp >= 600) "tablet" else "phone"))
            "storage.status" -> Envelope.ok(req.id, JSONObject().put("durable", true))
            "device.facts" -> Envelope.ok(req.id, JSONObject().put("safeAreaApplied", true).put("stylusSeen", false))
            "lifecycle.state" -> Envelope.ok(req.id, JSONObject().put("state", state))
            else -> if (req.op == "cancel") null else Envelope.fail(req.id, "UNSUPPORTED", "${req.cap}.${req.op} is not supported by this app version.")
        }
        if (out != null) send(proxy, out)
    }

    fun setLifecycle(next: String) {
        if (next == state) return
        state = next
        reply?.let { send(it, Envelope.event("lifecycle.state", seq++, JSONObject().put("state", next))) }
    }

    /**
     * Android Back: ask the page first (it closes sheets/dialogs), with a 300 ms
     * answer window; no page, no answer or "not handled" means the shell decides.
     */
    fun requestBack(unhandled: () -> Unit) {
        val proxy = reply ?: run { Log.i(TAG, "back: no page channel"); return unhandled() }
        val id = "${Envelope.NATIVE_ID_PREFIX}${++nextNativeId}"
        var settled = false
        val finish: (Envelope.Reply?) -> Unit = { answer ->
            if (!settled) {
                settled = true
                val handled = answer?.ok == true && answer.result?.optBoolean("handled", false) == true
                Log.i(TAG, "back: answered=${answer != null} handled=$handled")
                if (!handled) unhandled()
            }
        }
        pendingNative[id] = finish
        send(proxy, Envelope.nativeRequest(id, "lifecycle.backRequested"))
        main.postDelayed({ pendingNative.remove(id); finish(null) }, 300)
    }

    /** Every reply/event goes through here; a proxy only exists after the
     *  WEB_MESSAGE_LISTENER feature check in install() succeeded. */
    private fun send(proxy: JavaScriptReplyProxy, json: String) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) proxy.postMessage(json)
    }
}
