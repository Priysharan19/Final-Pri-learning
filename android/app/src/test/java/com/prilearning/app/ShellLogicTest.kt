// Pri Learning · Android shell logic (CP-06) — JVM unit tests for the pieces
// that decide what loads, what leaves the app, and what the page is told.
package com.prilearning.app

import com.prilearning.app.bridge.Envelope
import com.prilearning.app.bridge.HostDescriptor
import com.prilearning.app.release.ReleaseIdentity
import com.prilearning.app.shell.AssetOrigin
import com.prilearning.app.shell.NavigationPolicy
import com.prilearning.app.shell.WebViewFloor
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShellLogicTest {
    private fun asset(path: String) = AssetOrigin.resolve(path)

    @Test fun originIsTheStableDataIdentity() {
        // Changing this orphans every student's IndexedDB/localStorage (CP-11 pins it too).
        assertEquals("https://appassets.androidplatform.net", AssetOrigin.ORIGIN)
        assertEquals("https://appassets.androidplatform.net/", AssetOrigin.START_URL)
    }

    @Test fun rootAndSpaRoutesServeIndex() {
        for (p in listOf("", "/", "/practice", "/review", "/exams/abc", "/account-action")) {
            assertEquals(AssetOrigin.Resolved.Asset("web/index.html", "text/html"), asset(p))
        }
    }

    @Test fun bundledFilesMapWithMime() {
        assertEquals(AssetOrigin.Resolved.Asset("web/assets/index-abc.js", "text/javascript"), asset("/assets/index-abc.js"))
        assertEquals(AssetOrigin.Resolved.Asset("web/release.json", "application/json"), asset("/release.json?x=1"))
        assertEquals(AssetOrigin.Resolved.Asset("web/icons/icon-192.png", "image/png"), asset("/icons/icon-192.png"))
    }

    @Test fun traversalAndUnknownTypesAreLocal404s() {
        for (p in listOf("/v1/health", "/v1/auth/session", "/v1", "/../secrets.txt", "/assets/../../x.js", "/./index.html", "/a\\b.js", "/file.exe", "/data.bin")) {
            assertEquals(p, AssetOrigin.Resolved.NotFound, asset(p))
        }
    }

    @Test fun onlyTheBundledOriginLoadsInApp() {
        assertEquals(NavigationPolicy.Decision.LOAD_IN_APP, NavigationPolicy.decide("https", "appassets.androidplatform.net"))
        assertEquals(NavigationPolicy.Decision.OPEN_EXTERNALLY, NavigationPolicy.decide("https", "example.com"))
        assertEquals(NavigationPolicy.Decision.OPEN_EXTERNALLY, NavigationPolicy.decide("mailto", null))
        // Any other form of the bundled host would reach the real network host.
        assertEquals(NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide("http", "appassets.androidplatform.net"))
        assertEquals(NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide("https", "appassets.androidplatform.net", port = 8443))
        assertEquals(NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide("https", "APPASSETS.androidplatform.net", userInfo = "u:p"))
        // Only a main-frame navigation the person started may launch another app.
        assertEquals(NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide("https", "example.com", mainFrame = false))
        assertEquals(NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide("mailto", null, gesture = false))
        for (s in listOf("javascript", "file", "content", "intent", "data", null)) {
            assertEquals("$s", NavigationPolicy.Decision.BLOCK, NavigationPolicy.decide(s, "appassets.androidplatform.net"))
        }
    }

    @Test fun webViewFloorMatchesTheBuildTarget() {
        assertTrue(WebViewFloor.isSupported("126.0.6478.71"))
        assertTrue(WebViewFloor.isSupported("91.0.4472.120"))
        assertFalse(WebViewFloor.isSupported("90.0.4430.210"))
        assertFalse(WebViewFloor.isSupported(null))
        assertFalse(WebViewFloor.isSupported("garbage"))
    }

    @Test fun envelopeAcceptsWellFormedRequestsOnly() {
        val ok = Envelope.parse("""{"v":1,"id":"a1","cap":"storage","op":"status","payload":{}}""")
        assertTrue(ok is Envelope.Inbound.FromPage)
        for (bad in listOf(null, "", "nope", """{"v":2,"id":"a","cap":"x","op":"y"}""",
            """{"v":1,"cap":"storage","op":"status"}""", """{"v":1,"id":"a","cap":"Bad Cap","op":"y"}""",
            """{"v":1,"id":"${"x".repeat(121)}","cap":"storage","op":"status"}""",
            """{"v":1,"id":"n:1","cap":"storage","op":"status"}""")) {
            assertEquals("$bad", Envelope.Inbound.Invalid, Envelope.parse(bad))
        }
        val answer = Envelope.parse("""{"v":1,"id":"n:4","ok":true,"result":{"handled":true}}""")
        assertTrue(answer is Envelope.Inbound.AnswerToNative)
        assertTrue((answer as Envelope.Inbound.AnswerToNative).reply.result!!.getBoolean("handled"))
    }

    @Test fun repliesEventsAndRequestsAreV1() {
        assertEquals(true, JSONObject(Envelope.ok("a")).getBoolean("ok"))
        val fail = JSONObject(Envelope.fail("a", "UNSUPPORTED", "no"))
        assertEquals("UNSUPPORTED", fail.getJSONObject("error").getString("code"))
        val ev = JSONObject(Envelope.event("lifecycle.state", 3, JSONObject().put("state", "background")))
        assertEquals(3, ev.getInt("seq")); assertEquals(1, ev.getInt("v"))
        assertTrue(JSONObject(Envelope.nativeRequest("n:1", "lifecycle.backRequested")).getString("id").startsWith("n:"))
    }

    @Test fun hostDescriptorCarriesCapabilitiesNotOsIdentity() {
        val d = HostDescriptor.json(HostDescriptor.Shell("4.0", "1", "com.prilearning.app"), null)
        assertEquals(1, d.getInt("protocol"))
        assertFalse(d.has("platform"))
        assertFalse(d.toString().contains("android", ignoreCase = true))
        val caps = d.getJSONObject("capabilities")
        assertTrue(caps.getJSONObject("lifecycle").getBoolean("backButton"))
        assertTrue(caps.getJSONObject("storage").getBoolean("durable"))
        assertFalse("Android writes on the shared web canvas", caps.has("ink"))
        val script = HostDescriptor.script(d)
        assertTrue(script.contains("writable:false") && script.contains("configurable:false") && script.contains("Object.freeze"))
    }

    @Test fun releaseIdentityIsValidatedNotTrusted() {
        assertNull(ReleaseIdentity.parse(null))
        assertNull(ReleaseIdentity.parse("""{"schemaVersion":2,"releaseSha":"${"a".repeat(40)}"}"""))
        assertNull(ReleaseIdentity.parse("""{"schemaVersion":1,"releaseSha":"short"}"""))
        assertEquals("a".repeat(40), ReleaseIdentity.parse("""{"schemaVersion":1,"releaseSha":"${"a".repeat(40)}"}""")!!.getString("releaseSha"))
    }
}
