// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Google Play Billing bridge (CP-08)
//
// The Android half of `priNative.billing` for store "google-play". It presents
// Google's purchase sheet and reports what Google returned; it never decides
// entitlement. Every purchase token goes to the server, which re-fetches the
// purchase from the Play Developer API, checks this account's opaque
// obfuscatedAccountId, binds the token to one account and acknowledges it
// (server/platform/googleBilling.js). Nothing here acknowledges or consumes,
// and nothing here unlocks Premium.
//   products   → queryProductDetails (subscription base plans + localized price)
//   purchase   → launchBillingFlow with the server-issued obfuscatedAccountId
//   unfinished → purchased but not yet acknowledged (the server must see them)
//   restore    → every purchased subscription Play still holds for this user
//   finish     → no-op (the server acknowledges)
// Late results (the page stopped waiting, or a purchase completed outside the
// app) are reported as `billing.transactionUpdated` events.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.billing

import android.app.Activity
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject

class PlayBilling(private val activity: Activity, private val emit: (String, JSONObject) -> Unit) {
    sealed class Result {
        data class Ok(val result: JSONObject) : Result()
        data class Failed(val code: String, val message: String, val providerCode: String? = null) : Result()
    }

    companion object {
        private val PRODUCT = Regex("^[a-z0-9][a-z0-9._-]{0,149}$")
        private val BASE_PLAN = Regex("^[a-z0-9][a-z0-9-]{0,62}$")
        private val OBFUSCATED = Regex("^[A-Za-z0-9_-]{22,64}$")

        /** Play's response codes → the closed priNative codes (+ provider code). */
        fun failure(r: BillingResult, what: String): Result.Failed = when (r.responseCode) {
            BillingClient.BillingResponseCode.USER_CANCELED -> Result.Failed("USER_CANCELLED", "The purchase was cancelled.", "PLAY_USER_CANCELED")
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
            BillingClient.BillingResponseCode.NETWORK_ERROR -> Result.Failed("UNAVAILABLE", "Google Play is not reachable right now.", "PLAY_UNAVAILABLE")
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE,
            BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> Result.Failed("UNSUPPORTED", "Google Play Billing is not available on this device.", "PLAY_BILLING_UNAVAILABLE")
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> Result.Failed("UNAVAILABLE", "That subscription is not available.", "PLAY_ITEM_UNAVAILABLE")
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> Result.Failed("PROVIDER_ERROR", "This Google account already has this subscription. Use Restore.", "PLAY_ITEM_ALREADY_OWNED")
            BillingClient.BillingResponseCode.DEVELOPER_ERROR -> Result.Failed("BAD_REQUEST", "Google Play rejected the $what request.", "PLAY_DEVELOPER_ERROR")
            else -> Result.Failed("PROVIDER_ERROR", "Google Play could not complete the $what request.", "PLAY_ERROR_${r.responseCode}")
        }

        fun describe(p: Purchase): JSONObject = JSONObject()
            .put("purchaseToken", p.purchaseToken)
            .put("productIds", JSONArray(p.products))
            .put("productId", p.products.firstOrNull() ?: "")
            .put("state", when (p.purchaseState) { Purchase.PurchaseState.PURCHASED -> "purchased"; Purchase.PurchaseState.PENDING -> "pending"; else -> "unspecified" })
            .put("acknowledged", p.isAcknowledged)
            .put("obfuscatedAccountId", p.accountIdentifiers?.obfuscatedAccountId ?: JSONObject.NULL)
    }

    private var pendingPurchase: ((Result) -> Unit)? = null
    private val waiting = mutableListOf<() -> Unit>()
    private var connecting = false

    private val client: BillingClient = BillingClient.newBuilder(activity)
        .setListener { result, purchases -> onPurchasesUpdated(result, purchases) }
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private fun withClient(fail: (Result) -> Unit, block: () -> Unit) {
        if (client.isReady) return block()
        waiting += block
        if (connecting) return
        connecting = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                activity.runOnUiThread {
                    connecting = false
                    val run = waiting.toList(); waiting.clear()
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) run.forEach { it() }
                    else { val f = failure(result, "connection"); run.forEach { _ -> fail(f) } }
                }
            }
            override fun onBillingServiceDisconnected() { activity.runOnUiThread { connecting = false } }
        })
    }

    private fun productDetails(ids: List<String>, fail: (Result) -> Unit, done: (List<ProductDetails>) -> Unit) {
        val params = QueryProductDetailsParams.newBuilder().setProductList(ids.map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build()
        }).build()
        client.queryProductDetailsAsync(params) { result, details ->
            activity.runOnUiThread {
                if (result.responseCode != BillingClient.BillingResponseCode.OK) fail(failure(result, "product"))
                else done(details.productDetailsList)
            }
        }
    }

    fun products(payload: JSONObject, done: (Result) -> Unit) {
        val ids = (0 until (payload.optJSONArray("productIds")?.length() ?: 0))
            .map { payload.getJSONArray("productIds").optString(it) }.filter { PRODUCT.matches(it) }.distinct().take(12)
        if (ids.isEmpty()) return done(Result.Ok(JSONObject().put("products", JSONArray())))
        withClient(done) {
            productDetails(ids, done) { list ->
                val out = JSONArray()
                for (d in list) for (offer in d.subscriptionOfferDetails.orEmpty()) {
                    if (offer.offerId != null) continue // base plans only; offers are a later, reviewed decision
                    val phase = offer.pricingPhases.pricingPhaseList.lastOrNull() ?: continue
                    if (out.length() >= 24) break
                    out.put(JSONObject().put("id", d.productId).put("basePlanId", offer.basePlanId)
                        .put("title", d.name).put("displayPrice", phase.formattedPrice)
                        .put("billingPeriod", phase.billingPeriod).put("currency", phase.priceCurrencyCode))
                }
                done(Result.Ok(JSONObject().put("products", out)))
            }
        }
    }

    fun purchase(payload: JSONObject, done: (Result) -> Unit) {
        val productId = payload.optString("productId")
        val basePlanId = payload.optString("basePlanId")
        val obfuscated = payload.optString("obfuscatedAccountId")
        if (!PRODUCT.matches(productId) || !BASE_PLAN.matches(basePlanId) || !OBFUSCATED.matches(obfuscated)) {
            return done(Result.Failed("BAD_REQUEST", "The purchase request is invalid."))
        }
        if (pendingPurchase != null) return done(Result.Failed("UNAVAILABLE", "A purchase is already in progress."))
        withClient(done) {
            productDetails(listOf(productId), done) { list ->
                val details = list.firstOrNull { it.productId == productId }
                val offer = details?.subscriptionOfferDetails?.firstOrNull { it.basePlanId == basePlanId && it.offerId == null }
                if (details == null || offer == null) return@productDetails done(Result.Failed("UNAVAILABLE", "That subscription is not available.", "PLAY_ITEM_UNAVAILABLE"))
                val params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details).setOfferToken(offer.offerToken).build()))
                    // The server-issued opaque id: Google echoes it back inside the
                    // purchase, which is how the server binds it to this account.
                    .setObfuscatedAccountId(obfuscated)
                    .build()
                pendingPurchase = done
                val launched = client.launchBillingFlow(activity, params)
                if (launched.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchase = null
                    done(failure(launched, "purchase"))
                }
            }
        }
    }

    private fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        activity.runOnUiThread {
            val waiter = pendingPurchase
            pendingPurchase = null
            when (result.responseCode) {
                BillingClient.BillingResponseCode.OK -> {
                    val list = purchases.orEmpty()
                    val first = list.firstOrNull()
                    val status = when (first?.purchaseState) { Purchase.PurchaseState.PURCHASED -> "purchased"; Purchase.PurchaseState.PENDING -> "pending"; else -> "unspecified" }
                    if (waiter != null && first != null) waiter(Result.Ok(describe(first).put("status", status)))
                    else if (waiter != null) waiter(Result.Failed("PROVIDER_ERROR", "Google Play returned no purchase.", "PLAY_EMPTY_RESULT"))
                    // Everything else (renewal restored, purchase completed after
                    // the page stopped waiting) reaches the page as an event.
                    for (p in if (waiter != null) list.drop(1) else list) emit("billing.transactionUpdated", describe(p))
                }
                BillingClient.BillingResponseCode.USER_CANCELED -> waiter?.invoke(Result.Ok(JSONObject().put("status", "cancelled")))
                else -> waiter?.invoke(failure(result, "purchase"))
            }
        }
    }

    private fun ownedSubscriptions(done: (Result) -> Unit, select: (Purchase) -> Boolean) {
        withClient(done) {
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()) { result, list ->
                activity.runOnUiThread {
                    if (result.responseCode != BillingClient.BillingResponseCode.OK) return@runOnUiThread done(failure(result, "restore"))
                    val out = JSONArray()
                    for (p in list.filter(select).take(100)) out.put(describe(p))
                    done(Result.Ok(JSONObject().put("transactions", out)))
                }
            }
        }
    }

    fun unfinished(done: (Result) -> Unit) = ownedSubscriptions(done) { it.purchaseState == Purchase.PurchaseState.PURCHASED && !it.isAcknowledged }
    fun restore(done: (Result) -> Unit) = ownedSubscriptions(done) { it.purchaseState == Purchase.PurchaseState.PURCHASED }

    fun dispose() {
        pendingPurchase = null
        if (client.isReady) client.endConnection()
    }
}
