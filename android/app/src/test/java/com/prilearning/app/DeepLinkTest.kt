package com.prilearning.app

import com.prilearning.app.shell.DeepLink
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeepLinkTest {
    private val cloud = "https://api.prilearning.example"

    @Test fun accountActionOnTheCloudHostOpensTheBundledRoute() {
        assertEquals("https://appassets.androidplatform.net/account-action#token=abc.DEF-1",
            DeepLink.accountActionTarget("https://api.prilearning.example/account-action#token=abc.DEF-1", cloud))
        assertEquals("host case is ignored", "https://appassets.androidplatform.net/account-action#t=1",
            DeepLink.accountActionTarget("https://API.Prilearning.example/account-action#t=1", cloud))
    }

    @Test fun everythingElseIsRefused() {
        val refused = listOf(
            "http://api.prilearning.example/account-action#t=1",          // not https
            "https://evil.example/account-action#t=1",                     // another host
            "https://api.prilearning.example.evil.example/account-action#t=1",
            "https://api.prilearning.example:8443/account-action#t=1",     // another port
            "https://user@api.prilearning.example/account-action#t=1",     // userinfo
            "https://api.prilearning.example/account-action?t=1",          // query, no fragment
            "https://api.prilearning.example/account-action?x=1#t=1",      // token must never meet a query
            "https://api.prilearning.example/account-action#",             // empty fragment
            "https://api.prilearning.example/account-action/x#t=1",        // other path
            "https://api.prilearning.example/#t=1",
            "https://api.prilearning.example/account-action#" + "a".repeat(1025),
            "not a url",
            "",
        )
        for (link in refused) assertNull(link, DeepLink.accountActionTarget(link, cloud))
    }

    @Test fun noCloudOriginMeansNoLinks() {
        assertNull(DeepLink.accountActionTarget("https://api.prilearning.example/account-action#t=1", ""))
        assertNull(DeepLink.accountActionTarget("https://api.prilearning.example/account-action#t=1", null))
        assertNull(DeepLink.accountActionTarget(null, cloud))
    }
}
