// Pri Learning · Play Billing bridge (CP-08) — JVM tests for what the page is
// told: Play response codes in the closed priNative error set, and a purchase
// described by its token/product/state only (the server decides the rest).
package com.prilearning.app

import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.Purchase
import com.prilearning.app.billing.PlayBilling
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayBillingTest {
    private fun code(c: Int) = PlayBilling.failure(BillingResult.newBuilder().setResponseCode(c).setDebugMessage("x").build(), "purchase")

    @Test fun playResponsesMapToTheClosedErrorSet() {
        val closed = setOf("UNSUPPORTED", "BAD_REQUEST", "TIMEOUT", "CANCELLED", "USER_CANCELLED", "PERMISSION_DENIED",
            "UNAVAILABLE", "TOO_LARGE", "PROVIDER_ERROR", "UNVERIFIED", "INTERNAL")
        assertEquals("USER_CANCELLED", code(BillingResponseCode.USER_CANCELED).code)
        assertEquals("UNAVAILABLE", code(BillingResponseCode.SERVICE_UNAVAILABLE).code)
        assertEquals("UNAVAILABLE", code(BillingResponseCode.NETWORK_ERROR).code)
        assertEquals("UNSUPPORTED", code(BillingResponseCode.BILLING_UNAVAILABLE).code)
        assertEquals("PLAY_ITEM_ALREADY_OWNED", code(BillingResponseCode.ITEM_ALREADY_OWNED).providerCode)
        assertEquals("BAD_REQUEST", code(BillingResponseCode.DEVELOPER_ERROR).code)
        for (c in -3..12) assertTrue("code $c → ${code(c).code}", code(c).code in closed)
    }

    @Test fun aPurchaseIsDescribedByTokenProductAndStateOnly() {
        val json = """{"orderId":"GPA.1","packageName":"com.prilearning.app","productIds":["pri_premium"],"purchaseTime":1,
            "purchaseState":0,"purchaseToken":"tok_abc","acknowledged":false,"obfuscatedAccountId":"opaque_account_id_000000"}"""
        val d = PlayBilling.describe(Purchase(json, "sig"))
        assertEquals("tok_abc", d.getString("purchaseToken"))
        assertEquals("pri_premium", d.getString("productId"))
        assertEquals("purchased", d.getString("state"))
        assertFalse(d.getBoolean("acknowledged"))
        assertEquals("opaque_account_id_000000", d.getString("obfuscatedAccountId"))
        assertFalse("no order id, price or signature reaches the page", d.has("orderId") || d.has("signature") || d.has("price"))
        val pending = PlayBilling.describe(Purchase(json.replace("\"purchaseState\":0", "\"purchaseState\":4"), "sig"))
        assertEquals("pending", pending.getString("state"))
    }
}
