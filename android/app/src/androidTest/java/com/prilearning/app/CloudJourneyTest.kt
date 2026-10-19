// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android cloud journey against the real Pri server (CP-07)
//
// Run by android/scripts/run-instrumented.sh after the shell journey, with a
// real server started by scripts/cloud-fixture-server.mjs (emulator →
// host at 10.0.2.2). The methods run in this order, in separate runs, with the
// runner controlling the server (kill, restart) and `am force-stop` between:
// Account-first (issue #477): nothing opens without an account, so every
// method enters through the one sign-in card — email, then the six-digit code
// the server's TEST email adapter issued, read by the oracle relay from the
// server's outbox (GET /email-code; never invented) — and the gate in front of
// the shell lets the student in only once the server has confirmed them.
//   0. cloudSignUpThenDeleteAccount — a NEW address on the card (name, age,
//      agreement, class) → the app; Settings deletes the account with an
//      emailed code (the server's outbox again); the old session is refused;
//   1. cloudSignInAndSync — the fixture (returning) address on the card;
//      Settings shows the account connected, Sync now pushes, and the server
//      marks a typed answer: a wrong answer scores 0 with a try left, the right
//      answer scores full marks, History shows it. The session lives only in
//      the Keystore-encrypted jar (not in the WebView cookie store, not
//      readable by the page, not plaintext on disk);
//   1b. offlineWorkIsKeptUnmarkedAndSyncIsNotOffered (the runner's name) — relaunched with the server
//      stopped, the gate cannot confirm the account: it says "retry", the
//      shell does not open, and the server's record is unchanged. (The old
//      offline-draft walk needs the connection to drop AFTER entry, inside one
//      run; android/scripts/run-instrumented.sh stops the server only between
//      runs, so that walk is not measured here — see the iOS journey.)
//   2. cloudSessionSurvivesProcessDeathThenDisconnectClearsIt — the server is
//      back on the same database; after the process was killed the account is
//      still connected, History still shows the server-marked attempt;
//      Disconnect logs out on the server and the jar no longer holds a session.
// Grading is online-only and server-authoritative (owner decision 2026-10-10,
// ADR-0001): the device never holds the answer of a question it shows. The
// right answer therefore comes from OUTSIDE the page and the app — the
// server's sealed copy of the issued question, read from the throwaway
// fixture database by scripts/journey-oracle.mjs and asked for by this test
// process over the emulator's loopback alias (priOracle / priOracleToken).
// Skipped (not failed) when no server arguments are given. SYNTHETIC / EMULATOR
// evidence against a throwaway server and fixture account.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.util.Log
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.prilearning.app.cloud.CloudConfig
import com.prilearning.app.cloud.CookieJar
import com.prilearning.app.cloud.SecureStore
import org.json.JSONObject
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
        // The value travels in its own eval whose text is never logged, so a
        // timeout message below never carries a fixture password.
        eval(s, "(function(){window.__pv=" + org.json.JSONObject.quote(value) + ";return true;})()")
        waitFor(s, """(function(){var el=document.querySelector('$selector');if(!el)return false;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,window.__pv);window.__pv=null;
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()""")
    }

    private val byText = "function(t){return [].slice.call(document.querySelectorAll('button')).find(function(b){return b.offsetParent&&b.textContent.trim()===t;});}"
    private val stateTag = "(function(){var s=document.querySelector('section[aria-labelledby=\"cloud-account-title\"] .tag');return s?s.textContent.trim():'';})()"

    private val CARD = "document.querySelector('[data-signin-card]')"
    private val GATE = "document.querySelector('[data-testid=account-activation-gate]')"
    private val cardStep = "(function(){var c=document.querySelector('[data-signin-card]');return c?c.getAttribute('data-signup-step'):'';})()"
    private fun click(s: ActivityScenario<MainActivity>, testId: String) =
        waitFor(s, "(function(){var b=document.querySelector('[data-testid=$testId]');if(!b||b.disabled)return false;b.click();return true;})()")

    /**
     * Home, for `email`, through the one sign-in card (landing or the gate's
     * inline card). The code is the one the server's TEST email adapter issued
     * to that address, read by the oracle relay from the server's outbox.
     * Already inside (a profile the gate has let in): Home as it is.
     */
    private fun reachHome(s: ActivityScenario<MainActivity>, email: String = args.getString("priCloudEmail", "")) {
        val state = waitFor(s, "(function(){if(document.querySelector('.home-greet')&&!$GATE)return 'home';" +
            "var f=document.querySelector('#signup-destination');if(f&&!f.disabled)return 'card';return false;})()", 90_000)
        if (state == "\"home\"") return
        assertEquals("no device-only entry is offered", "false", eval(s, "!!document.querySelector('[data-testid=hero-offline]')"))
        setValue(s, "#signup-destination", email); Thread.sleep(200)
        click(s, "signup-send-code")
        waitFor(s, "document.querySelector('#signup-code-0')", 30_000)
        var code = ""
        val end = System.currentTimeMillis() + 30_000
        while (code.isEmpty() && System.currentTimeMillis() < end) {
            code = oracleOrNull("/email-code?to=" + java.net.URLEncoder.encode(email, "UTF-8"))?.optString("code", "") ?: ""
            if (code.isEmpty()) Thread.sleep(500)
        }
        assertTrue("the server sent a six-digit sign-in code to the address", Regex("^\\d{6}$").matches(code))
        setValue(s, "#signup-code-0", code)
        Thread.sleep(1500)
        if (eval(s, cardStep) == "\"code\"") eval(s, "(function(){var v=document.querySelector('[data-testid=signup-verify]');if(v&&!v.disabled)v.click();return true;})()")
        waitFor(s, "!$CARD || $cardStep !== 'code' || !!document.querySelector('[data-testid=signup-error]')", 30_000)
        assertEquals("the card accepted the code", "false", eval(s, "!!document.querySelector('[data-testid=signup-error]')"))
        if (eval(s, cardStep) == "\"age\"") {
            setValue(s, "#signup-flow-name", "Android Student")
            click(s, "signup-age-18"); Thread.sleep(150)
            eval(s, "(function(){var a=document.querySelector('[data-testid=signup-agree]');if(!a.checked)a.click();return true;})()"); Thread.sleep(150)
            click(s, "signup-age-next")
        }
        val inside = "(!!document.querySelector('.home-greet') || !!document.querySelector('.q-prompt')) && !$GATE"
        waitFor(s, "$cardStep === 'class' || ($inside)", 30_000)
        if (eval(s, cardStep) == "\"class\"") { click(s, "signup-class-10"); Thread.sleep(150); click(s, "signup-class-next") }
        // A finished card opens where the student was going — from the landing
        // page that is the first practice question (Login.jsx `intended`,
        // tour-otp-onboarding) — and only once the gate has let the account in.
        waitFor(s, inside, 90_000)
        if (eval(s, "!!document.querySelector('.home-greet')") != "true") {
            eval(s, "(function(){history.pushState({}, '', '/');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
        }
        waitFor(s, "!!document.querySelector('.home-greet') && !$GATE", 90_000)
    }

    private fun openSettings(s: ActivityScenario<MainActivity>) {
        eval(s, "(function(){history.pushState({}, '', '/settings');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
        waitFor(s, "document.querySelector('#cloud-account-title')")
    }

    private fun jarOnDisk(): CookieJar = CookieJar().apply { load(SecureStore(context).read()) }

    // ── The question card, and the oracle outside it ─────────────────────────
    /** A wrong answer no sealed answer is allowed to equal (the oracle is told to avoid it). */
    private val WRONG = "-987654"

    /** Ask the oracle relay (never the page, never the app's bridge) one question. */
    private fun oracle(path: String): JSONObject {
        val base = args.getString("priOracle", "")
        val token = args.getString("priOracleToken", "")
        assertTrue("the sealed-answer oracle is given (priOracle, priOracleToken)", base.isNotEmpty() && token.isNotEmpty())
        val conn = java.net.URL("$base$path").openConnection() as java.net.HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 10_000
        conn.setRequestProperty("X-Pri-Oracle", token)
        return try {
            assertEquals("the oracle answers $path", 200, conn.responseCode)
            JSONObject(conn.inputStream.bufferedReader().readText())
        } finally { conn.disconnect() }
    }

    /** As [oracle], but null when the relay answers anything other than 200 (a code not sent yet). */
    private fun oracleOrNull(path: String): JSONObject? {
        val base = args.getString("priOracle", "")
        val token = args.getString("priOracleToken", "")
        assertTrue("the oracle relay is given (priOracle, priOracleToken)", base.isNotEmpty() && token.isNotEmpty())
        val conn = java.net.URL("$base$path").openConnection() as java.net.HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 10_000
        conn.setRequestProperty("X-Pri-Oracle", token)
        return try { if (conn.responseCode == 200) JSONObject(conn.inputStream.bufferedReader().readText()) else null } finally { conn.disconnect() }
    }

    private fun openPractice(s: ActivityScenario<MainActivity>) {
        eval(s, "(function(){history.pushState({},'','/practice');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
        waitFor(s, "document.querySelector('.q-prompt') && !!${QuestionCardJs.QID}")
        Thread.sleep(500)
    }

    private fun qid(s: ActivityScenario<MainActivity>) = eval(s, QuestionCardJs.QID).trim('"')

    /** The card's own Next control: a different question is on the card afterwards. */
    private fun nextQuestion(s: ActivityScenario<MainActivity>) {
        val before = qid(s)
        waitFor(s, "(function(){var n=document.querySelector('.ctx-next');if(!n)return false;n.click();return true;})()")
        waitFor(s, "(function(){var id=${QuestionCardJs.QID};return !!id && id !== '$before' && !!document.querySelector('.q-prompt');})()")
        Thread.sleep(500)
    }

    /** Open the typed-answer editor if this question has one. */
    private fun typedEditor(s: ActivityScenario<MainActivity>): Boolean {
        eval(s, "(function(){var t=[].slice.call(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'')==='Type: answer by typing';});if(t)t.click();return true;})()")
        Thread.sleep(400)
        return eval(s, "!!document.querySelector('.editor-body input.answer-input')") == "true"
    }

    /** Move on (at most `max` questions) until one takes a typed final answer. */
    private fun openTypedQuestion(s: ActivityScenario<MainActivity>, max: Int = 12, advanceFirst: Boolean = false) {
        if (advanceFirst) nextQuestion(s)
        for (i in 0 until max) {
            if (typedEditor(s)) return
            nextQuestion(s)
        }
        throw AssertionError("no question with a typed answer in $max")
    }

    /** Press Submit and wait for the check it starts to finish; what the card then shows. */
    private fun submitAndWait(s: ActivityScenario<MainActivity>): String {
        waitFor(s, QuestionCardJs.PRESS_SUBMIT, 20_000)
        waitFor(s, QuestionCardJs.CHECK_STARTED, 15_000)
        waitFor(s, QuestionCardJs.CHECK_IDLE, 45_000)
        Thread.sleep(500)
        return eval(s, QuestionCardJs.OUTCOME).trim('"')
    }

    private fun assertUnmarked(s: ActivityScenario<MainActivity>, whenText: String) =
        assertEquals("$whenText: nothing a marker leaves is on the card", "\"\"", eval(s, QuestionCardJs.MARKED_TRACES))

    private fun openHistory(s: ActivityScenario<MainActivity>) {
        eval(s, "(function(){history.pushState({},'','/review');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
        waitFor(s, "location.pathname === '/review' && !!document.querySelector('main')")
        Thread.sleep(1500)
    }

    /** History's verdict for one question, as a screen reader hears it ('missing' when absent). */
    private fun historyVerdict(s: ActivityScenario<MainActivity>, id: String) = eval(s,
        "([].slice.call(document.querySelectorAll('.hist-row[data-question-id=\"$id\"] .hist-verdict .sr-only')).map(function(n){return n.textContent.trim();}).join('+')||'missing')").trim('"')

    /** The server's own record: exactly one completed question, a typed miss (0, one try left) then full marks. */
    private fun assertServerMarkedOnce(whenText: String): String {
        val marked = oracle("/marked")
        val done = marked.getJSONArray("completed")
        assertEquals("$whenText: the server completed exactly one question: $marked", 1, done.length())
        val q = done.getJSONObject(0)
        assertEquals("$whenText: it was answered by typing", "typed", q.optString("inputMode"))
        val grades = q.getJSONArray("grades")
        assertEquals("$whenText: the server gave two grades: $grades", 2, grades.length())
        val miss = grades.getJSONObject(0); val hit = grades.getJSONObject(1)
        assertTrue("$whenText: the wrong answer was marked 0 by the server with one try left: $miss",
            miss.getBoolean("authoritative") && !miss.getBoolean("correct") && !miss.getBoolean("invalid") &&
                miss.getDouble("marksEarned") == 0.0 && !miss.getBoolean("resolved") && miss.getInt("triesLeft") == 1)
        assertTrue("$whenText: the right answer was given full marks by the server: $hit",
            hit.getBoolean("authoritative") && hit.getBoolean("correct") && hit.getBoolean("resolved") &&
                hit.getDouble("marksPossible") > 0.0 && hit.getDouble("marksEarned") == hit.getDouble("marksPossible"))
        return q.getString("serverQuestionId")
    }

    /** What cloudSignInAndSync left for the runs after the process is killed. */
    private val gradedFile get() = java.io.File(context.filesDir, "pri-test-graded-question")

    /** A new account made on the card, then permanently deleted in Settings with an emailed code. */
    @Test
    fun cloudSignUpThenDeleteAccount() {
        val email = args.getString("priCloudNewEmail", "")
        assertTrue("a never-registered fixture address is given", email.isNotEmpty())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s, email)
            openSettings(s)
            waitFor(s, "$stateTag === 'Connected'", 60_000)
            val session = jarOnDisk().value(java.net.URI(origin).host, "pri_cloud_session")
            assertNotNull("the card's account has a session in the jar", session)
            // Positive control: the session is live on the server right now.
            assertEquals("the new account's session is live before deletion", 200, meStatus(session!!))
            setValue(s, "#cloud-delete-phrase", "DELETE")
            click(s, "cloud-delete-send-code")
            waitFor(s, "document.querySelector('#cloud-delete-code-0')", 30_000)
            var code = ""
            val end = System.currentTimeMillis() + 30_000
            while (code.isEmpty() && System.currentTimeMillis() < end) {
                code = oracleOrNull("/email-code?purpose=reauth&to=" + java.net.URLEncoder.encode(email, "UTF-8"))?.optString("code", "") ?: ""
                if (code.isEmpty()) Thread.sleep(500)
            }
            assertTrue("the server emailed a six-digit deletion code", Regex("^\\d{6}$").matches(code))
            setValue(s, "#cloud-delete-code-0", code)
            Thread.sleep(300)
            click(s, "cloud-delete-with-code")
            // Deleted: the panel says so, or the gate takes the screen (the
            // profile no longer belongs to a live account).
            waitFor(s, "/Cloud account deleted/.test(document.body.innerText) || !!$GATE", 30_000)
            // Server-side proof: the session that worked a moment ago is refused.
            assertEquals("the server refuses the deleted account's session", 401, meStatus(session))
        }
    }

    /** Runs while the cloud server is unreachable (the runner passes priCloudOffline). */
    @Test
    fun offlineWorkIsKeptUnmarkedAndSyncIsNotOffered() {
        assumeTrue("run by android/scripts/run-instrumented.sh with the server stopped", args.getString("priCloudOffline", "") == "true")
        val graded = JSONObject(gradedFile.readText())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            // Account-first: opened with the server unreachable, the gate cannot
            // confirm the account, so it says "retry" and the shell stays closed.
            waitFor(s, "$GATE && $GATE.getAttribute('data-activation-status') === 'retry'", 90_000)
            Thread.sleep(3000)
            assertEquals("the shell did not open while the server could not confirm the account", "false",
                eval(s, "!!document.querySelector('.shell') || !!document.querySelector('.home-greet') || !!document.querySelector('.q-prompt')"))
            assertEquals("no device-only entry is offered", "false", eval(s, "!!document.querySelector('[data-testid=hero-offline]')"))
            // …and nothing was lost: the server's own record (its database, read
            // by the oracle while the server is stopped) is unchanged.
            assertEquals("the server's record is unchanged while it is stopped", graded.getString("server"), assertServerMarkedOnce("offline"))
            Log.i("PRITEST", "opened offline: the gate says retry, the shell stays closed, the server's record is unchanged")
        }
    }

    /** The draft opened while the server was stopped, for the run after reconnect. */
    private val offlineDraftFile get() = java.io.File(context.filesDir, "pri-test-offline-draft")

    @Test
    fun cloudSignInAndSync() {
        val email = args.getString("priCloudEmail", "")
        assertTrue("the fixture account address is given", email.isNotEmpty())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s, email)
            assertEquals("the host advertises a configured cloud over the bridge", "true",
                eval(s, "window.__PRI_HOST__.capabilities.cloud.configured === true && window.__PRI_HOST__.capabilities.cloud.transport === 'bridge'"))

            // Signed in on the card (account-first, #477): nothing has been issued
            // or marked for the fixture account yet.
            val before = oracle("/marked")
            assertEquals("the fixture account starts with nothing marked: $before", 0, before.getJSONArray("completed").length())
            openSettings(s)
            waitFor(s, "$stateTag === 'Connected'", 60_000)

            waitFor(s, "(function(){var b=($byText)('Sync now');if(!b||b.disabled)return false;b.click();return true;})()")
            val synced = waitFor(s, "(function(){var t=document.querySelector('section[aria-labelledby=\"cloud-account-title\"]').innerText;var m=t.match(/Sync complete[^\\n]*/);return m?m[0]:false;})()", 60_000)
            assertTrue("the local profile synced to the real server: $synced", synced.contains("Sync complete"))
            val sessionNow = jarOnDisk().value(java.net.URI(origin).host, "pri_cloud_session")!!
            val eventsBefore = serverEventCount(sessionNow)

            // Signed in: the server marks. A wrong answer first, then the right
            // one, on a question whose sealed answer the oracle can state.
            openPractice(s)
            openTypedQuestion(s)
            var escrow: JSONObject? = null
            val passed = mutableListOf<String>()
            for (i in 0 until 12) {
                if (i > 0) nextQuestion(s)
                if (!typedEditor(s)) { passed += "no-typed-answer"; continue }
                val got: String
                if (i == 0) {
                    assertEquals("a signed-in student is not told checking needs an account", "false",
                        eval(s, QuestionCardJs.visible("[data-check-needs-account]")))
                    setValue(s, ".editor-body input.answer-input", WRONG)
                    Thread.sleep(300)
                    assertEquals("no check is running before Submit is pressed", "true", eval(s, QuestionCardJs.CHECK_IDLE))
                    assertUnmarked(s, "before Submit")
                    assertEquals("before Submit the server marked nothing", 0, oracle("/marked").getJSONArray("completed").length())
                    got = submitAndWait(s)
                } else {
                    // An issued question: ask before spending a try on it.
                    val peek = oracle("/answer")
                    if (!peek.optBoolean("supported")) { passed += peek.optString("answerType", peek.optString("reason", "unstatable")); continue }
                    setValue(s, ".editor-body input.answer-input", WRONG)
                    Thread.sleep(300)
                    got = submitAndWait(s)
                }
                assertTrue("the signed-in check was not refused ($got / ${eval(s, QuestionCardJs.REFUSAL)}; passed over: $passed)", got != "refused" && got != "technical")
                // Only now is the question certainly the account's: read its sealed answer.
                val sealed = oracle("/answer")
                if (got != "miss" || !sealed.optBoolean("supported")) { passed += "$got/${sealed.optString("answerType", "unstatable")}"; continue }
                assertEquals("a first miss does not resolve the question", "false|false",
                    eval(s, "!!document.querySelector('.eval-card')") + "|" + eval(s, "!!document.querySelector('.solution-panel')"))
                assertEquals("a second try is offered", "true", eval(s, "(function(){var b=document.querySelector('.editor-body input.answer-input');return !!b&&!b.disabled;})()"))
                Log.i("PRITEST", "server marked the wrong answer on question ${i + 1}" +
                    (if (i == 0) " (the first question opened)" else " (issued to the account)") + "; passed over: $passed")
                escrow = sealed
                break
            }
            assertNotNull("a question with a statable numeric answer was found in 12 (passed over: $passed)", escrow)
            val gradedId = qid(s)
            setValue(s, ".editor-body input.answer-input", escrow!!.getString("text"))
            Thread.sleep(300)
            assertEquals("the right answer is evaluated", "evaluated", submitAndWait(s))
            assertEquals("the evaluation is Correct", "\"correct\"", eval(s, "document.querySelector('.eval-card').getAttribute('data-outcome')"))
            assertEquals("the marks shown are the server's, not 'unavailable'", "false", eval(s, "!!document.querySelector('[data-grade-unavailable]')"))
            val marks = eval(s, QuestionCardJs.FULL_MARKS).trim('"')
            assertTrue("full marks are shown ($marks)", marks.isNotEmpty())
            // What the SERVER holds, whatever the screen said.
            val serverId = assertServerMarkedOnce("after the right answer")
            assertEquals("the completed question is the one whose sealed answer was typed", escrow.getString("serverQuestionId"), serverId)
            openHistory(s)
            assertEquals("History shows the server-marked attempt", "Correct", historyVerdict(s, gradedId))
            gradedFile.writeText(JSONObject().put("id", gradedId).put("server", serverId).toString())
            Log.i("PRITEST", "server marked 0 with a try left, then $marks; History shows Correct")
            // The server recorded the marked attempt as a learning event of its
            // own. Remember the count: nothing typed offline next may add a mark.
            val eventsAfter = serverEventCount(sessionNow)
            assertTrue("the server-marked attempt is a learning event on the server ($eventsAfter, $eventsBefore before)", eventsAfter > eventsBefore)
            eventBaselineFile.writeText(eventsAfter.toString())
            openSettings(s)

            // Google Play billing on an image without the Play Store, against a
            // server with no Google configuration: it answers in the closed error
            // model and never crashes (the server decides entitlement either way).
            eval(s, "(function(){window.__b=null;priBridge.addEventListener('message',function(e){try{var x=JSON.parse(e.data);if(x.id==='t-billing')window.__b=x;}catch(_){}});priBridge.postMessage(JSON.stringify({v:1,id:'t-billing',cap:'billing',op:'products',payload:{productIds:['pri_premium']}}));return true;})()")
            // On an image without the Play Store the request must reach Play Billing
            // and fail closed there (a PLAY_* provider code), not be "unsupported"
            // because billing was never wired into the bridge.
            val billing = waitFor(s, "window.__b && (window.__b.ok ? 'ok' : (window.__b.error.code + ':' + ((window.__b.error.detail||{}).providerCode||'')))", 30_000)
            assertTrue("Play Billing was reached and failed closed: $billing",
                Regex("^\"(UNSUPPORTED|UNAVAILABLE|PROVIDER_ERROR):PLAY_[A-Z0-9_]+\"$").matches(billing))

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

    /**
     * How many learning events the server holds for the signed-in account, read
     * through the real pull route (GET /v1/sync/pull/:cursor) with the device's
     * session cookie, following hasMore pages. The server is the authority on
     * what reached it; the panel's "Sync complete" line only reports one push.
     */
    private fun serverEventCount(session: String): Int {
        var cursor = 0L
        var count = 0
        for (page in 0 until 50) {
            val conn = java.net.URL("$origin/v1/sync/pull/$cursor").openConnection() as java.net.HttpURLConnection
            conn.setRequestProperty("X-Pri-Client", "android-native-v1")
            conn.setRequestProperty("Cookie", "pri_cloud_session=$session")
            val body = try {
                assertEquals("the pull route answers the device session", 200, conn.responseCode)
                conn.inputStream.bufferedReader().readText()
            } finally { conn.disconnect() }
            val json = org.json.JSONObject(body)
            count += json.getJSONArray("events").length()
            cursor = json.getLong("cursor")
            if (!json.optBoolean("hasMore", false)) break
        }
        return count
    }

    /** Server-side event count recorded by cloudSignInAndSync, read back after the process was killed. */
    private val eventBaselineFile get() = java.io.File(context.filesDir, "pri-test-events-after-signin")

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
            // Reconnected (the same server came back). Nothing typed offline was
            // ever marked, so reconnecting has no mark to deliver: the server's
            // record is still exactly the one attempt it marked itself, and it
            // lost none of what it held.
            waitFor(s, "(function(){var b=($byText)('Sync now');if(!b||b.disabled)return false;b.click();return true;})()")
            waitFor(s, "(function(){var t=document.querySelector('section[aria-labelledby=\"cloud-account-title\"]').innerText;var m=t.match(/Sync complete[^\\n]*/);return m?m[0]:false;})()", 60_000)
            val graded = JSONObject(gradedFile.readText())
            assertEquals("after reconnect the server still holds exactly the attempt it marked", graded.getString("server"), assertServerMarkedOnce("after reconnect"))
            val onServer = serverEventCount(session)
            val baseline = eventBaselineFile.readText().trim().toInt()
            assertTrue("the server lost nothing across the restart (holds $onServer learning event(s), $baseline after it marked)", onServer >= baseline)
            // After the process death, History still shows the server-marked
            // attempt, and the draft typed offline was not turned into one.
            openHistory(s)
            assertEquals("History shows the server-marked attempt after relaunch", "Correct", historyVerdict(s, graded.getString("id")))
            // The offline phase runs only when the runner started the server
            // itself (it has to stop it); without it there is no draft to check.
            offlineDraftFile.takeIf { it.exists() }?.readText()?.trim()?.let {
                assertEquals("the offline draft is still not in History", "missing", historyVerdict(s, it))
            }
            openSettings(s)
            waitFor(s, "$stateTag === 'Connected'")
            eval(s, "($byText)('Disconnect').click()")
            // Signed out, the gate takes the screen again (account-first), or the panel says so.
            waitFor(s, "$stateTag === 'Not connected' || !!$GATE")
            val end = System.currentTimeMillis() + 5_000
            while (jarOnDisk().value(host, "pri_cloud_session") != null && System.currentTimeMillis() < end) Thread.sleep(100)
            assertEquals("Disconnect cleared the device's session", null, jarOnDisk().value(host, "pri_cloud_session"))
            assertEquals("…and revoked it on the server (the old cookie is refused)", 401, meStatus(session))
        }
    }
}
