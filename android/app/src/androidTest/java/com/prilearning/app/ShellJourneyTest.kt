// Pri Learning · Android WebView first-run boundary (CP-06).
//
// The bundled app now requires verified email OTP, authoritative age/guardian
// checks and initial sync before Home. Offline/device-only profile creation is
// forbidden. The real-server, grading, draft and device-session suites live in
// CloudJourneyTest; this smoke test checks the native shell and fail-closed
// account-first entry without inventing a session or bypassing consent.
//
// Runs once, survives actual 'am force-stop', then checks account gating again.
// Android emulator evidence, not a physical device certification.
package com.prilearning.app

import android.app.Instrumentation
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ShellJourneyTest {
    private val instrumentation: Instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val expect: String get() = InstrumentationRegistry.getArguments().getString("priExpect", "any")

    private fun eval(s: ActivityScenario<MainActivity>, js: String): String {
        var out = "null"
        val latch = CountDownLatch(1)
        s.onActivity { act ->
            val web: WebView = act.webView ?: run { latch.countDown(); return@onActivity }
            web.evaluateJavascript(
                "(function(){try{var r=($js);if(r&&r.nodeType)r=true;return JSON.stringify(r);}catch(e){return JSON.stringify('ERR '+e.message);}})()"
            ) { value ->
                out = (JSONTokener(value ?: "null").nextValue() as? String) ?: "null"
                latch.countDown()
            }
        }
        latch.await(10, TimeUnit.SECONDS)
        return out
    }

    private fun waitFor(s: ActivityScenario<MainActivity>, js: String, timeoutMs: Long = 40_000): String {
        val end = System.currentTimeMillis() + timeoutMs
        var last = "null"
        while (System.currentTimeMillis() < end) {
            last = eval(s, js)
            if (last != "null" && last != "false" && last != "\"\"" && !last.startsWith("\"ERR")) return last
            Thread.sleep(250)
        }
        throw AssertionError("timed out waiting for: $js (last=$last)")
    }

    private fun click(s: ActivityScenario<MainActivity>, js: String) {
        waitFor(s, "(function(){var el=($js);if(!el)return false;el.click();return true;})()")
    }

    private fun belowFloor(): Boolean {
        var blocked = false
        ActivityScenario.launch(MainActivity::class.java).use { probe ->
            probe.onActivity { act -> blocked = act.webView == null }
        }
        return blocked
    }

    private fun texts(v: View, result: MutableList<String> = mutableListOf()): List<String> {
        if (v is TextView) result += v.text.toString()
        if (v is ViewGroup) for (i in 0 until v.childCount) texts(v.getChildAt(i), result)
        return result
    }

    private fun tapElement(s: ActivityScenario<MainActivity>, selector: String) {
        val js = """(function(){var e=document.querySelector('$selector');if(!e)return false;var r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,window.devicePixelRatio].join(',');})()"""
        val parts = waitFor(s, js).trim('"').split(',').map { it.toFloat() }
        val position = IntArray(2)
        s.onActivity { it.webView!!.getLocationOnScreen(position) }
        val x = position[0] + parts[0] * parts[2]
        val y = position[1] + parts[1] * parts[2]
        val t = SystemClock.uptimeMillis()
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x, y, 0))
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t + 65, MotionEvent.ACTION_UP, x, y, 0))
    }

    @Test
    fun journey() {
        if (belowFloor()) {
            assertTrue("the supported-product image must not show the WebView floor", expect != "product")
            val pkg = androidx.webkit.WebViewCompat.getCurrentWebViewPackage(instrumentation.targetContext)
            assertTrue(
                "unsupported WebView shows the update screen: ${pkg?.versionName}",
                !com.prilearning.app.shell.WebViewFloor.isSupported(pkg?.versionName) ||
                    !androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER)
            )
            ActivityScenario.launch(MainActivity::class.java).use { s ->
                s.onActivity { activity ->
                    val shown = texts(activity.window.decorView)
                    assertTrue(shown.contains(activity.getString(R.string.webview_update_title)))
                    assertTrue(shown.contains(activity.getString(R.string.webview_update_button)))
                }
            }
            return
        }
        assertTrue("floor image must not open a supported WebView", expect != "floor")

        ActivityScenario.launch(MainActivity::class.java).use { s ->
            assertEquals(
                "\"https://appassets.androidplatform.net\"",
                waitFor(s, """document.querySelector('[data-testid="hero-create-account"]') && location.origin""")
            )
            assertEquals("true", eval(s, "!!window.__PRI_HOST__ && Object.isFrozen(window.__PRI_HOST__) && window.__PRI_HOST__.capabilities.lifecycle.backButton === true"))
            assertEquals("false", eval(s, "'platform' in window.__PRI_HOST__ || 'ink' in window.__PRI_HOST__.capabilities"))
            assertEquals("true", eval(s, "/^[0-9a-f]{40}$/.test((window.__PRI_HOST__.release||{}).releaseSha||'')"))
            assertEquals("false", eval(s, "!!navigator.serviceWorker && !!navigator.serviceWorker.controller"))
            assertEquals("false", eval(s, "!!document.querySelector('.shell')"))
            assertEquals("false", eval(s, "!!document.querySelector('.home-greet')"))

            // New users must start on email verification, not an old device-only
            // profile path. There is intentionally no synthetic auth bypass.
            click(s, """document.querySelector('[data-testid="hero-create-account"]')""")
            waitFor(s, """document.querySelector('[data-signup-step="method"]') && document.querySelector('#signup-destination')""")
            assertEquals("false", eval(s, "!!document.querySelector('.shell')"))
            assertEquals("false", eval(s, "!!document.querySelector('[data-testid=hero-offline]')"))
            assertEquals("true", eval(s, "!!document.querySelector('[data-testid=signup-send-code]')"))

            // Native WebView must preserve its storage across the real process
            // death that the runner sends between journey and relaunch.
            eval(s, "localStorage.setItem('pri-android-onboarding-probe','saved')")
            assertEquals("\"saved\"", eval(s, "localStorage.getItem('pri-android-onboarding-probe')"))

            // Navigation attempted by untrusted page JS cannot take the user to
            // an external site or create an authenticated in-app session.
            eval(s, """(function(){var a=document.createElement('a');a.href='intent://evil#Intent;end';document.body.appendChild(a);a.click();a.remove();return true;})()""")
            Thread.sleep(500)
            assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
            assertEquals("false", eval(s, "!!document.querySelector('.shell')"))

            val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_VIEW).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                addDataScheme("https")
            }, null, true)
            try {
                eval(s, "location.href='https://example.com/scripted'")
                Thread.sleep(800)
                assertEquals("scripted redirects must not open an external app", 0, monitor.hits)
                assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
                eval(s, """(function(){var a=document.createElement('a');a.id='pri-ext';a.href='https://example.com/tapped';a.textContent='external';a.style.cssText='position:fixed;left:40px;top:160px;width:220px;height:90px;display:block;z-index:2147483647;background:white';document.body.appendChild(a);return true;})()""")
                tapElement(s, "#pri-ext")
                val end = System.currentTimeMillis() + 8000
                while (monitor.hits < 1 && System.currentTimeMillis() < end) Thread.sleep(100)
                assertEquals("a real tap opens an external link once", 1, monitor.hits)
                assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
            } finally {
                instrumentation.removeMonitor(monitor)
            }
        }
    }

    @Test
    fun relaunchAfterProcessDeath() {
        assumeTrue("the floor test has no WebView data", !belowFloor())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            assertEquals(
                "\"https://appassets.androidplatform.net\"",
                waitFor(s, """document.querySelector('[data-testid="hero-create-account"]') && location.origin""")
            )
            assertEquals("native WebView storage survives process death", "\"saved\"",
                eval(s, "localStorage.getItem('pri-android-onboarding-probe')"))
            assertEquals("an unverified user remains locked out after process death", "false",
                eval(s, "!!document.querySelector('.shell')"))
            assertEquals("unverified user still has no Home", "false",
                eval(s, "!!document.querySelector('.home-greet')"))
            click(s, """document.querySelector('[data-testid="hero-create-account"]')""")
            waitFor(s, """document.querySelector('[data-signup-step="method"]') && document.querySelector('#signup-destination')""")
            assertEquals("false", eval(s, "!!document.querySelector('.shell')"))
        }
    }
}
