// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android shell journey on an emulator (CP-06)
//
// Drives the real shell and the real bundled product in two instrumentation
// runs (android/scripts/run-instrumented.sh), with `am force-stop` between them:
//   1. journey — boot on the stable origin, the capability handshake,
//      onboarding into a local profile, SPA routing + history Back, Back
//      closing an open sheet first, rotation keeping an in-progress typed
//      answer, the typed answer kept as a draft on the device; an offline
//      draft says before any work that it cannot be marked and offers neither
//      Submit nor Show solution — its one action, "Try for a markable
//      question", asks first when there is work on the page and, with no
//      server to open one, changes nothing; nothing is marked or recorded
//      (grading is online-only and server-authoritative: owner decision
//      2026-10-10, ADR-0001 — this run has no server), blocked schemes,
//      external links opening only from a real tap, and Back on the landing
//      entry leaving the app;
//   2. relaunch — after the process was killed, the profile (IndexedDB),
//      localStorage and the draft question with its typed answer survived,
//      still said to be unmarkable.
// The `priExpect` argument says which branch the image must take: `floor` (a
// WebView below the floor must show the fail-closed update screen) or
// `product` (the full journey). SYNTHETIC / EMULATOR evidence — never a
// physical-device result.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.app.Instrumentation
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.lifecycle.Lifecycle
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
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
        val where = runCatching { eval(scenario, "location.pathname+' '+JSON.stringify(history.state)") }.getOrDefault("?")
        throw AssertionError("timed out waiting for: $js (last=$last; page at $where)")
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

    private val ANSWERED = """(function(){var c=[].slice.call(document.querySelectorAll('.card')).find(function(x){var l=x.querySelector('.sc-label');return l&&/questions answered/i.test(l.textContent);});if(!c)return false;return String(parseInt((c.querySelector('.big')||{}).textContent||'NaN',10));})()"""

    private val byLabel = "function(l){return [].slice.call(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||b.textContent.trim())===l;});}"

    private val instrumentation: Instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val expect: String get() = InstrumentationRegistry.getArguments().getString("priExpect", "any")

    private fun belowFloor(): Boolean {
        var blocked = false
        ActivityScenario.launch(MainActivity::class.java).use { probe -> probe.onActivity { act -> blocked = act.webView == null } }
        return blocked
    }

    private fun texts(v: View, out: MutableList<String> = mutableListOf()): List<String> {
        if (v is TextView) out += v.text.toString()
        if (v is ViewGroup) for (i in 0 until v.childCount) texts(v.getChildAt(i), out)
        return out
    }

    /** A real touch on an element (WebView gestures, unlike element.click()). */
    private fun tapElement(s: ActivityScenario<MainActivity>, selector: String) {
        val rect = waitFor(s, "(function(){var r=document.querySelector('$selector').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,window.devicePixelRatio].join(',');})()")
        val (cx, cy, dpr) = rect.trim('"').split(',').map { it.toFloat() }
        val loc = IntArray(2)
        s.onActivity { it.webView!!.getLocationOnScreen(loc) }
        val x = loc[0] + cx * dpr
        val y = loc[1] + cy * dpr
        val t = SystemClock.uptimeMillis()
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x, y, 0))
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t + 60, MotionEvent.ACTION_UP, x, y, 0))
    }

    /** Reach Progress the way a student does: the visible nav link, or the
     *  compact "More" sheet. (A synthetic history.pushState bypasses the router's
     *  history index, which made Back depend on timing — not a product path.) */
    private fun openProgress(s: ActivityScenario<MainActivity>) {
        val link = "[].slice.call(document.querySelectorAll('a[href=\"/progress\"]')).find(function(a){return a.offsetParent;})"
        if (eval(s, "!!($link)") != "true") {
            // Practice is thinking mode (#264): no rail and no bottom bar, so there
            // is no Progress link to reach from it. Leave the way a student does —
            // the bar's exit control, a PUSH of Home — and continue from Home. The
            // bottom bar is still in the DOM there but display:none, so clicking
            // its sheet button would open nothing visible and wait out the clock.
            if (eval(s, "!!(document.querySelector('.ws-exit')||{}).offsetParent") == "true") {
                click(s, "document.querySelector('.ws-exit')")
                waitFor(s, "location.pathname === '/' && !!document.querySelector('.home-greet')")
            }
            if (eval(s, "!!($link)") != "true") {
                click(s, "document.querySelector('.mobilenav button[aria-expanded]')")
                waitFor(s, "!!($link)")
            }
        }
        click(s, link)
        waitFor(s, "location.pathname === '/progress'")
    }

    /** The bar's Next control, and then a different question on the card (a
     *  condition, not a pause: what is read next belongs to the new question). */
    private fun skipToAnotherQuestion(s: ActivityScenario<MainActivity>) {
        val before = eval(s, QuestionCardJs.QID).trim('"')
        click(s, "document.querySelector('.ctx-next')")
        waitFor(s, "(function(){var id=${QuestionCardJs.QID};return !!id && id !== '$before' && !!document.querySelector('.q-prompt');})()")
    }

    private fun backWanted(s: ActivityScenario<MainActivity>): Boolean {
        var wanted = false
        s.onActivity { wanted = it.bridge?.backWanted == true }
        return wanted
    }

    private fun awaitBackWanted(s: ActivityScenario<MainActivity>, want: Boolean) {
        val end = System.currentTimeMillis() + 10_000
        while (System.currentTimeMillis() < end) { if (backWanted(s) == want) return; Thread.sleep(100) }
        throw AssertionError("page never declared backWanted=$want")
    }

    private fun pressBack() = instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)

    @Test
    fun journey() {
        // The test APK install is fresh, so this is a first launch.
        if (belowFloor()) {
            assertTrue("this image was expected to run the product, but the shell showed the floor screen", expect != "product")
            val pkg = androidx.webkit.WebViewCompat.getCurrentWebViewPackage(instrumentation.targetContext)
            assertTrue("update screen shown only when the WebView is genuinely below the floor or lacks features: ${pkg?.versionName}",
                !com.prilearning.app.shell.WebViewFloor.isSupported(pkg?.versionName) ||
                    !androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER))
            ActivityScenario.launch(MainActivity::class.java).use { s ->
                s.onActivity { act ->
                    val shown = texts(act.window.decorView)
                    assertTrue("the update title is on screen: $shown", shown.contains(act.getString(R.string.webview_update_title)))
                    assertTrue("the update button is on screen: $shown", shown.contains(act.getString(R.string.webview_update_button)))
                }
            }
            Log.i("PRITEST", "WebView below floor (${pkg?.versionName}): fail-closed update screen verified")
            return
        }
        assertTrue("this image was expected to show the floor screen, but the WebView is supported", expect != "floor")

        ActivityScenario.launch(MainActivity::class.java).use { s ->
            Log.i("PRITEST", "boot on the stable origin with the capability handshake")
            assertEquals("\"https://appassets.androidplatform.net\"", waitFor(s, "(document.querySelector('[data-testid=\"hero-offline\"]') || document.querySelector('.home-greet')) && location.origin"))
            assertEquals("true", eval(s, "!!window.__PRI_HOST__ && Object.isFrozen(window.__PRI_HOST__) && window.__PRI_HOST__.capabilities.lifecycle.backButton === true"))
            assertEquals("false", eval(s, "'platform' in window.__PRI_HOST__ || 'ink' in window.__PRI_HOST__.capabilities"))
            assertEquals("true", eval(s, "/^[0-9a-f]{40}$/.test((window.__PRI_HOST__.release||{}).releaseSha||'')"))
            assertEquals("false", eval(s, "!!navigator.serviceWorker && !!navigator.serviceWorker.controller"))

            Log.i("PRITEST", "onboarding into a local profile")
            click(s, "document.querySelector('[data-testid=\"hero-offline\"]')")
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
            // Progress before any attempt: nothing answered yet.
            openProgress(s)
            assertEquals("a new profile has answered nothing", "\"0\"", waitFor(s, ANSWERED))
            awaitBackWanted(s, true)
            pressBack()
            waitFor(s, "location.pathname === '/' && document.querySelector('.home-greet')")

            // Practice is thinking mode (#264): its own top bar, no bottom bar and
            // no sheet. The sheet that Back must close first lives on Home.
            Log.i("PRITEST", "Back closes an open sheet before it navigates")
            if (eval(s, "document.documentElement.dataset.ff === 'compact'") == "true") {
                click(s, "document.querySelector('.mobilenav button[aria-expanded]')")
                waitFor(s, "document.querySelector('.mnav-sheet')")
                awaitBackWanted(s, true)
                pressBack()
                waitFor(s, "!document.querySelector('.mnav-sheet') && location.pathname === '/' && !!document.querySelector('.home-greet')")
            }

            Log.i("PRITEST", "SPA routing through the bundled origin, and history Back")
            val landingDepth = eval(s, "(history.state && history.state.idx) || 0")
            click(s, "[].slice.call(document.querySelectorAll('a[href=\"/practice\"]')).find(function(a){return a.offsetParent;})")
            waitFor(s, "document.querySelector('.q-prompt') && location.pathname === '/practice'")
            assertEquals("Practice shows its own bar, not the bottom navigation", "true",
                eval(s, "!!document.querySelector('.ws-bar') && !(function(n){return n && n.offsetParent;})(document.querySelector('.mobilenav'))"))
            awaitBackWanted(s, true)
            pressBack()
            // The router must have rendered Home, not just the URL changed: a Link
            // tapped while React still shows the old page is treated as a same-page
            // REPLACE, which would overwrite the Home entry (Back would then leave the app).
            waitFor(s, "location.pathname === '/' && !!document.querySelector('.home-greet') && !document.querySelector('.q-prompt')")

            Log.i("PRITEST", "rotation keeps an in-progress typed answer (no recreation)")
            click(s, "[].slice.call(document.querySelectorAll('a[href=\"/practice\"]')).find(function(a){return a.offsetParent;})")
            waitFor(s, "document.querySelector('.q-prompt')")
            assertEquals("Practice is its own history entry after Home (Back returns Home)", "true",
                eval(s, "!!history.state && history.state.idx > 0"))
            var typed = false
            for (i in 0 until 12) {
                eval(s, "(function(){var t=($byLabel)('Type: answer by typing');if(t)t.click();return true;})()")
                Thread.sleep(400)
                if (eval(s, "!!document.querySelector('.editor-body input.answer-input')") == "true") { typed = true; break }
                skipToAnotherQuestion(s)
            }
            assertTrue("a question with a typed answer was found", typed)

            // Grading is online-only and server-authoritative (owner decision
            // 2026-10-10, ADR-0001). This build has no server, so the question on
            // the card is an offline draft, and the card says so BEFORE any work
            // goes in: it cannot be marked, and it offers no Submit or Show
            // solution that could only be refused.
            Log.i("PRITEST", "an offline draft says before any work that it cannot be marked, and offers no Submit or Show solution")
            val firstId = waitFor(s, QuestionCardJs.QID).trim('"')
            assertEquals("the card names the question an offline draft", "\"draft\"", waitFor(s, QuestionCardJs.UNMARKABLE))
            val draftSays = eval(s, QuestionCardJs.UNMARKABLE_SAYS)
            assertTrue("the notice says why and what follows — opened without a connection, cannot be marked: $draftSays",
                Regex("without a connection", RegexOption.IGNORE_CASE).containsMatchIn(draftSays) &&
                    Regex("cannot be marked", RegexOption.IGNORE_CASE).containsMatchIn(draftSays) &&
                    !Regex("already finished|finished elsewhere|another tab", RegexOption.IGNORE_CASE).containsMatchIn(draftSays))
            assertEquals("the one action is to try for a markable question: one primary control, no solution control",
                "\"replace|1|no-solution\"", eval(s, QuestionCardJs.OFFERS))
            assertEquals("the primary control reads as that action", "\"Try for a markable question\"", eval(s, QuestionCardJs.PRIMARY_LABEL))
            assertEquals("there is no Submit to press", "false", eval(s, QuestionCardJs.PRESS_SUBMIT))
            assertEquals("there is no Show solution to press", "false", eval(s, QuestionCardJs.PRESS_REVEAL))
            // QuestionCard's accountNeeded excludes an unmarkable question: an
            // account could not make a draft markable, so no sign-in is offered.
            assertEquals("a draft is not told that checking needs an account", "false", eval(s, QuestionCardJs.visible("[data-check-needs-account]")))
            assertEquals("a draft offers no sign-in: signing in cannot make it markable", "false", eval(s, QuestionCardJs.visible(".qpage [data-check-sign-in]")))
            assertEquals("nothing asks to confirm before any work", "false|false",
                eval(s, QuestionCardJs.visible("[data-check-replace-confirm]")) + "|" + eval(s, QuestionCardJs.visible("[data-check-replace-cancel]")))
            assertEquals("the draft opens unmarked and unrefused", "\"\"|false", eval(s, QuestionCardJs.MARKED_TRACES) + "|" + eval(s, QuestionCardJs.REFUSAL))

            setValue(s, ".editor-body input.answer-input", "7")
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            Thread.sleep(2500)
            assertEquals("\"7\"", eval(s, "(document.querySelector('.editor-body input.answer-input')||{}).value"))
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
            Thread.sleep(1500)

            Log.i("PRITEST", "a typed answer is kept as a draft on this device")
            assertEquals("the question did not change under the typing or the rotation", "\"$firstId\"", eval(s, QuestionCardJs.QID))
            assertEquals("the typed answer is stored on this device under its question", "\"7\"",
                waitFor(s, QuestionCardJs.storedTyped(firstId), 15_000))
            assertEquals("nothing is marked by typing", "\"\"", eval(s, QuestionCardJs.MARKED_TRACES))
            assertEquals("with work on the page there is still no Submit and no Show solution", "\"replace|1|no-solution\"|false|false",
                eval(s, QuestionCardJs.OFFERS) + "|" + eval(s, QuestionCardJs.PRESS_SUBMIT) + "|" + eval(s, QuestionCardJs.PRESS_REVEAL))

            // With work on the page, asking for a markable question takes a
            // second, deliberate press: the first only asks.
            Log.i("PRITEST", "the first press of \"Try for a markable question\" asks before it costs the typed work")
            waitFor(s, QuestionCardJs.PRESS_REPLACE)
            waitFor(s, QuestionCardJs.visible("[data-check-replace-confirm]"))
            assertEquals("the primary control now names what a second press does", "\"Leave this one and get a new question\"", eval(s, QuestionCardJs.PRIMARY_LABEL))
            assertEquals("keeping the work is offered beside it", "true", eval(s, QuestionCardJs.visible(".ws-actions [data-check-replace-cancel]")))
            assertEquals("asking changed nothing: same question, same answer, nothing marked", "\"$firstId\"|\"7\"|\"\"",
                eval(s, QuestionCardJs.QID) + "|" + eval(s, QuestionCardJs.TYPED) + "|" + eval(s, QuestionCardJs.MARKED_TRACES))
            // "Keep working on this one" withdraws the question, not the work.
            waitFor(s, QuestionCardJs.PRESS_REPLACE_CANCEL)
            waitFor(s, "(!${QuestionCardJs.visible("[data-check-replace-confirm]")} && !${QuestionCardJs.visible("[data-check-replace-cancel]")})")
            assertEquals("keeping the work restores the card as it was", "\"Try for a markable question\"|\"$firstId\"|\"7\"",
                eval(s, QuestionCardJs.PRIMARY_LABEL) + "|" + eval(s, QuestionCardJs.QID) + "|" + eval(s, QuestionCardJs.TYPED))

            // Confirmed, the card asks for a markable question FIRST. This build
            // has no server, so none can be opened — and then nothing changes.
            Log.i("PRITEST", "confirmed with no server, nothing changes: same question, typed answer kept, and the card says so")
            waitFor(s, QuestionCardJs.PRESS_REPLACE)
            waitFor(s, QuestionCardJs.visible("[data-check-replace-confirm]"))
            waitFor(s, QuestionCardJs.PRESS_REPLACE)
            waitFor(s, QuestionCardJs.REPLACE_DECLINED, 60_000)
            val noteSays = eval(s, QuestionCardJs.REPLACE_NOTE_SAYS)
            assertTrue("the card says a markable question could not be opened and that nothing has changed: $noteSays",
                Regex("could not be opened", RegexOption.IGNORE_CASE).containsMatchIn(noteSays) &&
                    Regex("nothing here has changed", RegexOption.IGNORE_CASE).containsMatchIn(noteSays))
            assertEquals("the same question is still on the card", "\"$firstId\"", eval(s, QuestionCardJs.QID))
            assertEquals("the typed answer is still on the card", "\"7\"", eval(s, QuestionCardJs.TYPED))
            assertEquals("…and still stored on this device", "\"7\"", eval(s, QuestionCardJs.storedTyped(firstId)))
            assertEquals("a declined replace marks and reveals nothing", "\"\"", eval(s, QuestionCardJs.MARKED_TRACES))
            assertEquals("no check was made, so none was refused", "false", eval(s, QuestionCardJs.REFUSAL))
            assertEquals("no retry that cannot succeed is offered", "false", eval(s, QuestionCardJs.visible("[data-check-retry]")))
            assertEquals("no sign-in is offered: signing in cannot make a draft markable", "false", eval(s, QuestionCardJs.visible(".qpage [data-check-sign-in]")))
            assertEquals("the card still says it is a draft, and its one action is unchanged", "\"draft\"|\"replace|1|no-solution\"|\"Try for a markable question\"",
                eval(s, QuestionCardJs.UNMARKABLE) + "|" + eval(s, QuestionCardJs.OFFERS) + "|" + eval(s, QuestionCardJs.PRIMARY_LABEL))

            // Next: the same element is replaced by a new question (by identity of
            // the rendered node, not prompt text, which can repeat). The bar's Next
            // control is the one way to another question while no markable one can
            // be opened; it skips to another draft.
            Log.i("PRITEST", "the bar's Next opens another question; a draft typed there is kept")
            assertEquals("a Next control is offered", "true", eval(s, "!!document.querySelector('.ctx-next')"))
            eval(s, "(function(){window.__q=document.querySelector('.q-prompt');document.querySelector('.ctx-next').click();return true;})()")
            waitFor(s, "document.querySelector('.q-prompt') && document.querySelector('.q-prompt') !== window.__q && !document.querySelector('.verdict')")
            waitFor(s, "(function(){var id=${QuestionCardJs.QID};return !!id && id !== '$firstId';})()")
            assertEquals("the note about the last question does not follow to the new one", "false|false",
                eval(s, QuestionCardJs.visible("[data-check-replace-note]")) + "|" + eval(s, QuestionCardJs.visible("[data-check-replace-confirm]")))
            var draftTyped = false
            for (i in 0 until 12) {
                eval(s, "(function(){var t=($byLabel)('Type: answer by typing');if(t)t.click();return true;})()")
                Thread.sleep(400)
                if (eval(s, "!!document.querySelector('.editor-body input.answer-input')") == "true") { draftTyped = true; break }
                skipToAnotherQuestion(s)
            }
            assertTrue("a second question with a typed answer was found", draftTyped)
            val draftId = waitFor(s, QuestionCardJs.QID).trim('"')
            assertTrue("the draft is a different question from the first one", draftId.isNotEmpty() && draftId != firstId)
            setValue(s, ".editor-body input.answer-input", "42")
            assertEquals("the new draft is stored on this device", "\"42\"", waitFor(s, QuestionCardJs.storedTyped(draftId), 15_000))
            assertEquals("the new question opens unmarked and unrefused", "\"\"|false", eval(s, QuestionCardJs.MARKED_TRACES) + "|" + eval(s, QuestionCardJs.REFUSAL))
            assertEquals("…and is a draft too, with the same one action", "\"draft\"|\"replace|1|no-solution\"",
                eval(s, QuestionCardJs.UNMARKABLE) + "|" + eval(s, QuestionCardJs.OFFERS))
            // Left for relaunchAfterProcessDeath: which question, and what was typed.
            eval(s, "localStorage.setItem('pri-android-draft', JSON.stringify({id:'$draftId',answer:'42'}))")
            openProgress(s)
            // Nothing was marked, so nothing was answered: Progress counts only
            // what Pri's server has marked.
            assertEquals("Progress counts no attempt: a draft records nothing", "\"0\"", waitFor(s, ANSWERED))
            // The real Back key walks the app's own history. Practice has no
            // Progress link (thinking mode), so openProgress left it through the
            // bar's exit (a PUSH of Home): Home(0) → Practice(1) → Home(2) →
            // Progress(3), and Back must walk Progress → Home → Practice → Home.
            awaitBackWanted(s, true)
            pressBack()
            waitFor(s, "location.pathname === '/' && !!history.state && history.state.idx === 2 && !!document.querySelector('.home-greet')")
            Thread.sleep(400)
            awaitBackWanted(s, true)
            pressBack()
            // Settle on Practice (its own history entry) before the next press, as
            // a person's next Back comes after the page has appeared.
            waitFor(s, "location.pathname === '/practice' && !!history.state && history.state.idx === 1 && !!document.querySelector('.q-prompt')")
            Thread.sleep(400)
            awaitBackWanted(s, true)
            pressBack()
            // The router must have rendered Home, not just the URL changed: a Link
            // tapped while React still shows the old page is treated as a same-page
            // REPLACE, which would overwrite the Home entry (Back would then leave the app).
            waitFor(s, "location.pathname === '/' && !!document.querySelector('.home-greet') && !document.querySelector('.q-prompt')")

            Log.i("PRITEST", "schemes outside the policy never navigate the app away")
            eval(s, "(function(){var a=document.createElement('a');a.href='intent://evil#Intent;end';document.body.appendChild(a);a.click();return true;})()")
            Thread.sleep(800)
            assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))

            Log.i("PRITEST", "external links open outside the WebView only from a real tap")
            val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_VIEW).apply {
                addCategory(Intent.CATEGORY_BROWSABLE); addDataScheme("https")
            }, null, true)
            try {
                eval(s, "(function(){location.href='https://example.com/scripted';return true;})()")
                Thread.sleep(1200)
                assertEquals("a scripted redirect launches nothing", 0, monitor.hits)
                assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
                eval(s, """(function(){var a=document.createElement('a');a.id='pri-ext';a.href='https://example.com/tapped';a.textContent='external';
                    a.style.cssText='position:fixed;left:40px;top:160px;width:220px;height:90px;display:block;z-index:2147483647;background:#c33';
                    document.body.appendChild(a);return true;})()""")
                tapElement(s, "#pri-ext")
                val end = System.currentTimeMillis() + 8_000
                while (monitor.hits < 1 && System.currentTimeMillis() < end) Thread.sleep(100)
                assertEquals("a tapped external link leaves the app exactly once", 1, monitor.hits)
                assertEquals("\"https://appassets.androidplatform.net\"", eval(s, "location.origin"))
                eval(s, "(function(){var a=document.getElementById('pri-ext');if(a)a.remove();return true;})()")
            } finally {
                instrumentation.removeMonitor(monitor)
            }

            Log.i("PRITEST", "Back on the landing entry leaves the app (landing depth $landingDepth)")
            assertEquals("back on the landing entry", "0", eval(s, "location.pathname === '/' ? ((history.state && history.state.idx) || 0) : 'at ' + location.pathname"))
            awaitBackWanted(s, false)
            Thread.sleep(2000) // let WebView flush storage before the process is killed by the next step
            pressBack()
            val end = System.currentTimeMillis() + 8_000
            while (s.state == Lifecycle.State.RESUMED && System.currentTimeMillis() < end) Thread.sleep(100)
            assertTrue("Back at home leaves the app (state ${s.state})", s.state != Lifecycle.State.RESUMED)
        }
    }

    /** Runs after `am force-stop` killed the process the journey ran in. */
    @Test
    fun relaunchAfterProcessDeath() {
        assumeTrue("the journey ran (product branch)", !belowFloor())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                if(b){b.click();return 'picker';}return false;})()""")
            assertTrue(state, state == "\"home\"" || state == "\"picker\"")
            waitFor(s, "document.querySelector('.home-greet')")
            assertEquals("\"kept\"", eval(s, "localStorage.getItem('pri-android-marker')"))
            Log.i("PRITEST", "after process death the profile and localStorage survived")

            // The draft left on the card before the process was killed: the same
            // question comes back with what was typed, still unmarked.
            val draftId = waitFor(s, "(function(){var d=JSON.parse(localStorage.getItem('pri-android-draft')||'null');return d&&d.id;})()").trim('"')
            click(s, "[].slice.call(document.querySelectorAll('a[href=\"/practice\"]')).find(function(a){return a.offsetParent;})")
            waitFor(s, "document.querySelector('.q-prompt') && location.pathname === '/practice' && !!${QuestionCardJs.QID}")
            assertEquals("the same question came back after process death", "\"$draftId\"", eval(s, QuestionCardJs.QID))
            waitFor(s, "(function(){if(document.querySelector('.editor-body input.answer-input'))return true;var t=[].slice.call(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'')==='Type: answer by typing';});if(t)t.click();return false;})()")
            assertEquals("the typed draft survived process death", "\"42\"", waitFor(s, QuestionCardJs.TYPED))
            assertEquals("the restored draft is unmarked", "\"\"", eval(s, QuestionCardJs.MARKED_TRACES))
            assertEquals("…and no check was made for it", "false", eval(s, QuestionCardJs.REFUSAL))
            assertEquals("it is still said to be a draft that cannot be marked, with no Submit or Show solution", "\"draft\"|\"replace|1|no-solution\"",
                waitFor(s, QuestionCardJs.UNMARKABLE) + "|" + eval(s, QuestionCardJs.OFFERS))
            Log.i("PRITEST", "after process death the draft question and its typed answer survived, unmarked")
        }
    }
}
