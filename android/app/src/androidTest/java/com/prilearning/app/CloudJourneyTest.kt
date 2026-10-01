// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android cloud journey against the real Pri server (CP-07)
//
// Run by android/scripts/run-instrumented.sh after the shell journey, with a
// real server started by android/scripts/cloud-fixture-server.mjs (emulator →
// host at 10.0.2.2). Two runs with `am force-stop` between them:
//   1. cloudSignInAndSync — the real Settings UI signs in through the native
//      bridge (page → priBridge → HttpURLConnection → server), Sync now pushes
//      the local profile, the session lives only in the Keystore-encrypted jar
//      (not in the WebView cookie store, not readable by the page, not
//      plaintext on disk);
//   2. cloudSessionSurvivesProcessDeathThenDisconnectClearsIt — after the
//      process was killed the account is still connected; Disconnect logs out
//      on the server and the jar no longer holds a session.
// Skipped (not failed) when no server arguments are given. SYNTHETIC / EMULATOR
// evidence against a throwaway server and fixture account.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.prilearning.app.cloud.CloudConfig
import com.prilearning.app.cloud.CookieJar
import com.prilearning.app.cloud.SecureStore
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class CloudJourneyTest {
    private val args get() = InstrumentationRegistry.getArguments()
    private val origin get() = args.getString("priCloud", "")
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Before fun configure() {
        assumeTrue("no cloud server given (priCloud)", origin.isNotEmpty())
        CloudConfig.debugOverride = origin
    }

    private fun eval(s: ActivityScenario<MainActivity>, js: String): String {
        var out = "null"
        val latch = CountDownLatch(1)
        s.onActivity { act ->
            val wv: WebView = act.webView ?: run { latch.countDown(); return@onActivity }
            wv.evaluateJavascript("(function(){try{var r=($js);if(r&&r.nodeType)r=true;return JSON.stringify(r);}catch(e){return JSON.stringify('ERR '+e.message);}})()") { v ->
                out = (JSONTokener(v ?: "null").nextValue() as? String) ?: "null"
                latch.countDown()
            }
        }
        latch.await(10, TimeUnit.SECONDS)
        return out
    }

    private fun waitFor(s: ActivityScenario<MainActivity>, js: String, timeoutMs: Long = 45_000): String {
        val end = System.currentTimeMillis() + timeoutMs
        var last = "null"
        while (System.currentTimeMillis() < end) {
            last = eval(s, js)
            if (last != "null" && last != "false" && last != "\"\"" && !last.startsWith("\"ERR")) return last
            Thread.sleep(250)
        }
        throw AssertionError("timed out waiting for: $js (last=$last)")
    }

    private fun setValue(s: ActivityScenario<MainActivity>, selector: String, value: String) {
        val quoted = org.json.JSONObject.quote(value)
        waitFor(s, """(function(){var el=document.querySelector('$selector');if(!el)return false;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,$quoted);
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()""")
    }

    private val byText = "function(t){return [].slice.call(document.querySelectorAll('button')).find(function(b){return b.offsetParent&&b.textContent.trim()===t;});}"
    private val stateTag = "(function(){var s=document.querySelector('section[aria-labelledby=\"cloud-account-title\"] .tag');return s?s.textContent.trim():'';})()"

    /** Home with the local profile from the shell journey (or onboarding if run alone). */
    private fun reachHome(s: ActivityScenario<MainActivity>) {
        val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
            var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
            if(b){b.click();return 'picker';}
            var g=($byText)('Get Started');if(g)return 'onboarding';return false;})()""")
        if (state == "\"onboarding\"") {
            eval(s, "($byText)('Get Started').click()")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"1\"]')")
            eval(s, "($byText)('Student').click()"); Thread.sleep(150); eval(s, "document.querySelector('.auth-card .btn-primary').click()")
            waitFor(s, "document.querySelector('#signup-track')")
            waitFor(s, """(function(){var el=document.querySelector('#signup-track');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'10');
                el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()"""); Thread.sleep(200)
            eval(s, "document.querySelector('.auth-card .btn-primary').click()")
            setValue(s, "#signup-name", "Android Student"); Thread.sleep(200); eval(s, "document.querySelector('.auth-card .btn-primary').click()")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"4\"]')"); eval(s, "document.querySelector('.auth-card .btn-primary').click()")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"5\"]')"); eval(s, "document.querySelector('.auth-card .btn-primary').click()")
        }
        waitFor(s, "document.querySelector('.home-greet')")
    }

    private fun openSettings(s: ActivityScenario<MainActivity>) {
        eval(s, "(function(){history.pushState({}, '', '/settings');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
        waitFor(s, "document.querySelector('#cloud-account-title')")
    }

    private fun jarOnDisk(): CookieJar = CookieJar().apply { load(SecureStore(context).read()) }

    @Test
    fun cloudSignInAndSync() {
        val email = args.getString("priCloudEmail", "")
        val password = args.getString("priCloudPassword", "")
        assertTrue("fixture account arguments are present", email.isNotEmpty() && password.isNotEmpty())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s)
            assertEquals("the host advertises a configured cloud over the bridge", "true",
                eval(s, "window.__PRI_HOST__.capabilities.cloud.configured === true && window.__PRI_HOST__.capabilities.cloud.transport === 'bridge'"))
            openSettings(s)
            assertEquals("\"Not connected\"", waitFor(s, stateTag))
            eval(s, "($byText)('Sign in').click()")
            setValue(s, "#cloud-email", email)
            setValue(s, "#cloud-password", password)
            eval(s, "document.querySelector('#cloud-email').form.querySelector('button[type=submit]').click()")
            waitFor(s, "$stateTag === 'Connected'")

            eval(s, "($byText)('Sync now').click()")
            val synced = waitFor(s, "(function(){var t=document.querySelector('section[aria-labelledby=\"cloud-account-title\"]').innerText;var m=t.match(/Sync complete[^\\n]*/);return m?m[0]:false;})()", 60_000)
            assertTrue("the local profile synced to the real server: $synced", synced.contains("Sync complete"))

            // The session is native-only: persisted encrypted, never plaintext.
            val raw = SecureStore(context).rawForTest()
            assertNotNull("the jar was persisted", raw)
            assertFalse("the persisted jar is not plaintext", String(raw!!, Charsets.ISO_8859_1).contains("pri_cloud_session"))
            val host = java.net.URI(origin).host
            assertNotNull("the decrypted jar holds the session", jarOnDisk().value(host, "pri_cloud_session"))
            Thread.sleep(1500) // let IndexedDB flush the account link before the process is killed
        }
    }

    /** Runs after `am force-stop` killed the process cloudSignInAndSync ran in. */
    /** GET /v1/account/me from the test with a given session cookie. */
    private fun meStatus(session: String): Int {
        val conn = java.net.URL("$origin/v1/account/me").openConnection() as java.net.HttpURLConnection
        conn.setRequestProperty("X-Pri-Client", "android-native-v1")
        conn.setRequestProperty("Cookie", "pri_cloud_session=$session")
        return try { conn.responseCode } finally { conn.disconnect() }
    }

    @Test
    fun cloudSessionSurvivesProcessDeathThenDisconnectClearsIt() {
        val host = java.net.URI(origin).host
        val session = jarOnDisk().value(host, "pri_cloud_session")
        assertNotNull("the session is on disk before launch", session)
        assertEquals("the persisted session is live on the server", 200, meStatus(session!!))
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s)
            openSettings(s)
            waitFor(s, "$stateTag === 'Connected'")
            eval(s, "($byText)('Disconnect').click()")
            waitFor(s, "$stateTag === 'Not connected'")
            val end = System.currentTimeMillis() + 5_000
            while (jarOnDisk().value(host, "pri_cloud_session") != null && System.currentTimeMillis() < end) Thread.sleep(100)
            assertEquals("Disconnect cleared the device's session", null, jarOnDisk().value(host, "pri_cloud_session"))
            assertEquals("…and revoked it on the server (the old cookie is refused)", 401, meStatus(session))
        }
    }
}
