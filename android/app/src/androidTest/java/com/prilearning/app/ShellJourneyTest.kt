// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android shell journey on an emulator (CP-06)
//
// Drives the real shell and the real bundled product: boot on the stable
// origin, the capability handshake, onboarding into a local profile, profile
// persistence across a full relaunch, SPA routing + history Back, Back closing
// an open sheet first, rotation keeping an in-progress typed answer, blocked
// schemes never navigating away, and the bundled release identity.
// SYNTHETIC / EMULATOR evidence — never a physical-device result.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.content.pm.ActivityInfo
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ShellJourneyTest {

    private fun eval(scenario: ActivityScenario<MainActivity>, js: String): String {
        var out = "null"
        val latch = CountDownLatch(1)
        scenario.onActivity { act ->
            val wv: WebView = act.webView ?: run { latch.countDown(); return@onActivity }
            wv.evaluateJavascript("(function(){try{var r=($js);if(r&&r.nodeType)r=true;return JSON.stringify(r);}catch(e){return JSON.stringify('ERR '+e.message);}})()") { v ->
                out = (JSONTokener(v ?: "null").nextValue() as? String) ?: "null"
                latch.countDown()
            }
        }
        latch.await(10, TimeUnit.SECONDS)
        return out
    }

    private fun waitFor(scenario: ActivityScenario<MainActivity>, js: String, timeoutMs: Long = 45_000): String {
        val end = System.currentTimeMillis() + timeoutMs
        var last = "null"
        while (System.currentTimeMillis() < end) {
            last = eval(scenario, js)
            if (last != "null" && last != "false" && last != "\"\"" && !last.startsWith("\"ERR")) return last
            Thread.sleep(250)
        }
        throw AssertionError("timed out waiting for: $js (last=$last)")
    }

    private fun click(scenario: ActivityScenario<MainActivity>, js: String) {
        waitFor(scenario, "(function(){var el=($js);if(!el)return false;el.click();return true;})()")
    }

    private fun setValue(scenario: ActivityScenario<MainActivity>, selector: String, value: String) {
        waitFor(scenario, """(function(){var el=document.querySelector('$selector');if(!el)return false;
            var proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto,'value').set.call(el,'$value');
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()""")
    }

    private val byLabel = "function(l){return [].slice.call(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||b.textContent.trim())===l;});}"

    @Test
    fun theSharedProductRunsInTheShellWithPersistentLocalState() {
        // connectedAndroidTest installs the app fresh, so this is a first launch.
        // Below the WebView floor (e.g. an Android 8 image with its factory
        // WebView) the correct behaviour is the fail-closed update screen, not a
        // half-working app. Assert that branch honestly and stop.
        var floorBlocked = false
        ActivityScenario.launch(MainActivity::class.java).use { probe ->
            probe.onActivity { act -> floorBlocked = act.webView == null }
        }
        if (floorBlocked) {
            val pkg = androidx.webkit.WebViewCompat.getCurrentWebViewPackage(
                InstrumentationRegistry.getInstrumentation().targetContext)
            assertTrue("update screen shown only when the WebView is genuinely below the floor or lacks features: ${pkg?.versionName}",
                !com.prilearning.app.shell.WebViewFloor.isSupported(pkg?.versionName) ||
                    !androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER))
            Log.i("PRITEST", "WebView below floor (${pkg?.versionName}): fail-closed update screen verified")
            return
        }

        ActivityScenario.launch(MainActivity::class.java).use { s ->
            // ── boot on the stable origin with the capability handshake ───────────
            Log.i("PRITEST", "boot on the stable origin with the capability handshake")
            assertEquals("\"https://appassets.androidplatform.net\"", waitFor(s, "(($byLabel)('Get Started') || document.querySelector('.home-greet')) && location.origin"))
            assertEquals("true", eval(s, "!!window.__PRI_HOST__ && Object.isFrozen(window.__PRI_HOST__) && window.__PRI_HOST__.capabilities.lifecycle.backButton === true"))
            assertEquals("false", eval(s, "'platform' in window.__PRI_HOST__ || 'ink' in window.__PRI_HOST__.capabilities"))
            assertEquals("true", eval(s, "/^[0-9a-f]{40}$/.test((window.__PRI_HOST__.release||{}).releaseSha||'')"))
            assertEquals("false", eval(s, "!!navigator.serviceWorker && !!navigator.serviceWorker.controller"))

            // ── onboarding into a local profile ──────────────────────────────────

            Log.i("PRITEST", "onboarding into a local profile")
            click(s, "($byLabel)('Get Started')")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"1\"]')")
            click(s, "($byLabel)('Student')"); click(s, "document.querySelector('.auth-card .btn-primary')")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"2\"]')")
            setValue(s, "#signup-track", "10"); click(s, "document.querySelector('.auth-card .btn-primary')")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"3\"]')")
            setValue(s, "#signup-name", "Android Student"); click(s, "document.querySelector('.auth-card .btn-primary')")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"4\"]')"); click(s, "document.querySelector('.auth-card .btn-primary')")
            waitFor(s, "document.querySelector('[data-onboarding-step=\"5\"]')"); click(s, "document.querySelector('.auth-card .btn-primary')")
            waitFor(s, "document.querySelector('.home-greet')")
            eval(s, "localStorage.setItem('pri-android-marker','kept')")
            Thread.sleep(2000) // let WebView flush storage before the process is torn down
        }

        // ── a full relaunch keeps the profile (IndexedDB) and localStorage ─────────

        Log.i("PRITEST", "a full relaunch keeps the profile (IndexedDB) and localStorage")
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                if(b){b.click();return 'picker';}return false;})()""")
            assertTrue(state, state == "\"home\"" || state == "\"picker\"")
            waitFor(s, "document.querySelector('.home-greet')")
            assertEquals("\"kept\"", eval(s, "localStorage.getItem('pri-android-marker')"))

            // ── SPA routing through the bundled origin, and history Back ─────────

            Log.i("PRITEST", "SPA routing through the bundled origin, and history Back")
            click(s, "[].slice.call(document.querySelectorAll('a[href=\"/practice\"]')).find(function(a){return a.offsetParent;})")
            waitFor(s, "document.querySelector('.q-prompt') && location.pathname === '/practice'")

            // ── Back closes an open sheet before it navigates ────────────────────

            Log.i("PRITEST", "Back closes an open sheet before it navigates")
            val compact = eval(s, "document.documentElement.dataset.ff === 'compact'")
            if (compact == "true") {
                click(s, "document.querySelector('.mobilenav button[aria-expanded]')")
                waitFor(s, "document.querySelector('.mnav-sheet')")
                s.onActivity { it.onBackPressedDispatcher.onBackPressed() }
                waitFor(s, "!document.querySelector('.mnav-sheet') && location.pathname === '/practice'")
            }
            s.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            waitFor(s, "location.pathname === '/'")

            // ── rotation keeps an in-progress typed answer (no recreation) ───────

            Log.i("PRITEST", "rotation keeps an in-progress typed answer (no recreation)")
            click(s, "[].slice.call(document.querySelectorAll('a[href=\"/practice\"]')).find(function(a){return a.offsetParent;})")
            waitFor(s, "document.querySelector('.q-prompt')")
            var typed = false
            for (i in 0 until 12) {
                eval(s, "(function(){var t=($byLabel)('Answer by typing');if(t)t.click();return true;})()")
                Thread.sleep(400)
                if (eval(s, "!!document.querySelector('.editor-body input.answer-input')") == "true") { typed = true; break }
                eval(s, "(function(){var n=document.querySelector('.ctx-next');if(n)n.click();return true;})()")
                Thread.sleep(900)
            }
            assertTrue("a question with a typed answer was found", typed)
            setValue(s, ".editor-body input.answer-input", "x+7")
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            Thread.sleep(2500)
            assertEquals("\"x+7\"", eval(s, "(document.querySelector('.editor-body input.answer-input')||{}).value"))
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
            Thread.sleep(1500)

            // ── schemes outside the policy never navigate the app away ───────────

            Log.i("PRITEST", "schemes outside the policy never navigate the app away")
            eval(s, "(function(){var a=document.createElement('a');a.href='intent://evil#Intent;end';document.body.appendChild(a);a.click();return true;})()")
            Thread.sleep(800)
            assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
        }
    }
}
