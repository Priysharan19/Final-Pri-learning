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
import android.util.Log
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.prilearning.app.auth.SmsCode
import com.prilearning.app.billing.PlayBilling
import com.prilearning.app.cloud.NativeCloud
import com.prilearning.app.io.FileExchange
import com.prilearning.app.shell.AssetOrigin
import org.json.JSONObject

class PriBridge(
    private val webView: WebView,
    private val descriptor: JSONObject,
    /** Called on the UI thread whenever the page's declared Back state changes. */
    private val onBackWantedChanged: (Boolean) -> Unit = {},
    private val cloud: NativeCloud? = null,
    private val files: FileExchange? = null,
    private val billing: PlayBilling? = null,
    private val sms: SmsCode? = null,
) {
    private companion object { const val TAG = "PriBridge" }
    private var reply: JavaScriptReplyProxy? = null
    private var seq = 0
    var backWanted = false
        private set
    /** A stylus or eraser pointer has actually been seen in this process. */
    @Volatile var stylusSeen = false
        private set
    /** An input device advertises stylus input (some panels do with no pen attached). */
    @Volatile var stylusCapable = false

    fun noteStylus() { stylusSeen = true }
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

    private fun onMessage(message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, proxy: JavaScriptReplyProxy) {
        if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != AssetOrigin.ORIGIN) return
        // Each main-frame document has its own reply proxy. The first message on
        // a new one starts that document's event sequence and Back state; doing
        // it here (not in onPageStarted, whose timing relative to the new
        // document's first messages is not guaranteed) can never lose a
        // declaration the new document already made.
        if (proxy !== reply) {
            // Nothing in flight for the previous document may answer this one.
            cloud?.cancelAll()
            sms?.cancel()
            reply = proxy
            seq = 0
            setBackWanted(false)
        }
        when (val inbound = Envelope.parse(message.data)) {
            is Envelope.Inbound.FromPage -> handle(inbound.request, proxy)
            is Envelope.Inbound.AnswerToNative -> Unit // no native→JS requests are in flight on Android today
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
            "device.facts" -> Envelope.ok(req.id, JSONObject().put("safeAreaApplied", true).put("stylusSeen", stylusSeen).put("stylusCapable", stylusCapable))
            "lifecycle.state" -> Envelope.ok(req.id, JSONObject().put("state", state))
            "lifecycle.setBackHandled" -> {
                setBackWanted(req.payload.optBoolean("handled", false))
                Envelope.ok(req.id)
            }
            "cloud.request" -> {
                val c = cloud ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "cloud.request is not supported by this app version."))
                c.request(req.id, req.payload) { outcome -> answerLater(proxy, cloudReply(req.id, outcome)) }
                null
            }
            "cloud.cancel" -> { cloud?.cancel(req.payload.optString("target", "")); null }
            "cloud.forgetSession" -> {
                val c = cloud ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "cloud.forgetSession is not supported by this app version."))
                c.cancelAll()
                c.forgetSession()
                Envelope.ok(req.id)
            }
            "share.file" -> {
                val f = files ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "share.file is not supported by this app version."))
                f.share(req.payload) { r -> answerLater(proxy, fileReply(req.id, r)) }
                null
            }
            "share.print" -> {
                val f = files ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "share.print is not supported by this app version."))
                f.print(webView) { r -> answerLater(proxy, fileReply(req.id, r)) }
                null
            }
            // A one-time sign-in code from one SMS the person agrees to share (SMS User Consent).
            "otp.smsCode" -> {
                val s = sms ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "otp.smsCode is not supported by this app version."))
                s.request { r -> answerLater(proxy, when (r) {
                    is SmsCode.Result.Code -> Envelope.ok(req.id, JSONObject().put("code", r.code))
                    is SmsCode.Result.Failed -> Envelope.fail(req.id, r.code, r.message)
                }) }
                null
            }
            "otp.cancel" -> { sms?.cancel(); null }
            "billing.products", "billing.purchase", "billing.unfinished", "billing.restore", "billing.finish" -> {
                val b = billing ?: return send(proxy, Envelope.fail(req.id, "UNSUPPORTED", "Billing is not supported by this app version."))
                val answer: (PlayBilling.Result) -> Unit = { r -> answerLater(proxy, billingReply(req.id, r)) }
                when (req.op) {
                    "products" -> b.products(req.payload, answer)
                    "purchase" -> b.purchase(req.payload, answer)
                    "unfinished" -> b.unfinished(answer)
                    "restore" -> b.restore(answer)
                    // The server acknowledges verified purchases; there is nothing to finish here.
                    else -> answer(PlayBilling.Result.Ok(JSONObject()))
                }
                null
            }
            else -> if (req.op == "cancel") null else Envelope.fail(req.id, "UNSUPPORTED", "${req.cap}.${req.op} is not supported by this app version.")
        }
        if (out != null) send(proxy, out)
    }

    private fun billingReply(id: String, r: PlayBilling.Result): String = when (r) {
        is PlayBilling.Result.Ok -> Envelope.ok(id, r.result)
        is PlayBilling.Result.Failed -> Envelope.fail(id, r.code, r.message, r.providerCode)
    }

    /** A one-way event to the current document (e.g. billing.transactionUpdated). */
    fun emitEvent(name: String, payload: JSONObject) {
        webView.post { reply?.let { send(it, Envelope.event(name, seq++, payload)) } }
    }

    private fun cloudReply(id: String, outcome: NativeCloud.Outcome): String = when (outcome) {
        is NativeCloud.Outcome.Response -> Envelope.ok(id, JSONObject().put("status", outcome.status).put("body", outcome.body)
            .apply { if (outcome.requestId != null) put("requestId", outcome.requestId) })
        is NativeCloud.Outcome.Failure -> Envelope.fail(id, outcome.code, outcome.message, outcome.providerCode)
    }

    private fun fileReply(id: String, r: FileExchange.Result): String = when (r) {
        is FileExchange.Result.Done -> Envelope.ok(id, JSONObject().put("completed", r.completed))
        is FileExchange.Result.Failed -> Envelope.fail(id, r.code, r.message)
    }

    /** Async answers hop to the UI thread and reach only the document that asked. */
    private fun answerLater(proxy: JavaScriptReplyProxy, json: String) {
        webView.post { if (proxy === reply) send(proxy, json) }
    }

    private fun setBackWanted(wanted: Boolean) {
        if (wanted == backWanted) return
        backWanted = wanted
        onBackWantedChanged(wanted)
    }

    fun setLifecycle(next: String) {
        if (next == state) return
        state = next
        reply?.let { send(it, Envelope.event("lifecycle.state", seq++, JSONObject().put("state", next))) }
    }

    /**
     * Android Back, delivered only while the page has declared it wants Back
     * (`lifecycle.setBackHandled`: a sheet/dialog is open, or it has in-app
     * history). The activity keeps its Back callback enabled exactly while that
     * is true, so otherwise the system default runs (predictive back-to-home,
     * task moved to the background). Returns false when there is no live
     * channel to hand it to, so the caller can fall back to the default.
     */
    fun deliverBack(): Boolean {
        val proxy = reply
        Log.i(TAG, "back: pageWants=$backWanted channel=${proxy != null}")
        if (!backWanted || proxy == null) return false
        send(proxy, Envelope.event("lifecycle.back", seq++, JSONObject()))
        return true
    }

    /** Every reply/event goes through here; a proxy only exists after the
     *  WEB_MESSAGE_LISTENER feature check in install() succeeded. */
    private fun send(proxy: JavaScriptReplyProxy, json: String) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) proxy.postMessage(json)
    }
}
