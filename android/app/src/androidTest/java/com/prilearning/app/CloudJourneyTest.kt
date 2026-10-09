// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android cloud journey against the real Pri server (CP-07)
//
// Run by android/scripts/run-instrumented.sh after the shell journey, with a
// real server started by scripts/cloud-fixture-server.mjs (emulator →
// host at 10.0.2.2). The methods run in this order, in separate runs, with the
// runner controlling the server (kill, restart) and `am force-stop` between:
//   0. cloudSignUpThenDeleteAccount;
//   1. cloudSignInAndSync — signed out with the server reachable, the student
//      is shown a server-PREPARED question and Submit is refused on the card
//      with the sign-in; then the real Settings UI signs in through the native
//      bridge (page → priBridge → HttpURLConnection → server), Sync now pushes
//      the local profile, and the server marks a typed answer: a wrong answer
//      scores 0 with a try left, the right answer scores full marks, History
//      shows it. The session lives only in the Keystore-encrypted jar (not in
//      the WebView cookie store, not readable by the page, not plaintext on
//      disk);
//   1b. offlineWorkIsKeptUnmarkedAndSyncIsNotOffered — with the server
//      stopped, a question opened on the device is a draft: the card says
//      before any work that it cannot be marked and offers no Submit or Show
//      solution; what is typed is kept, asking for a markable question changes
//      nothing while none can be opened, nothing is marked or recorded, and
//      Sync is not offered;
//   2. cloudSessionSurvivesProcessDeathThenDisconnectClearsIt — the server is
//      back on the same database; after the process was killed the account is
//      still connected, History still shows the server-marked attempt, the
//      server marked nothing that was typed offline; Disconnect logs out on
//      the server and the jar no longer holds a session.
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

    /** This fixture tests legacy Settings cloud routes from a device-only profile.
     * The normal student welcome stays account-first; never restore Get Started. */
    private fun reachHome(s: ActivityScenario<MainActivity>) {
        val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
            var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
            if(b){b.click();return 'picker';}
            var g=document.querySelector('[data-testid=hero-offline]');if(g)return 'onboarding';return false;})()""")
        if (state == "\"onboarding\"") {
            eval(s, "document.querySelector('[data-testid=hero-offline]').click()")
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

    /** Sign up through Settings, sign in, then permanently delete the account. */
    @Test
    fun cloudSignUpThenDeleteAccount() {
        val email = args.getString("priCloudNewEmail", "")
        val password = args.getString("priCloudNewPassword", "")
        assertTrue("a never-registered fixture credential is given", email.isNotEmpty() && password.isNotEmpty())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s)
            openSettings(s)
            assertEquals("\"Not connected\"", waitFor(s, stateTag))
            eval(s, "($byText)('Create account').click()")
            setValue(s, "#cloud-name", "Android Adult")
            setValue(s, "#cloud-email", email)
            setValue(s, "#cloud-password", password)
            eval(s, "(function(){[].slice.call(document.querySelector('#cloud-email').form.querySelectorAll('input[type=checkbox]')).forEach(function(b){if(!b.checked)b.click();});return true;})()")
            Thread.sleep(300)
            eval(s, "document.querySelector('#cloud-email').form.querySelector('button[type=submit]').click()")
            // Registration creates a session: signing up connects the account.
            waitFor(s, "$stateTag === 'Connected'")
            // Positive control: the account can sign in on the server right now.
            assertEquals("the new account can sign in before deletion", 200, loginStatus(email, password))
            setValue(s, "#cloud-delete-password", password)
            setValue(s, "#cloud-delete-phrase", "DELETE")
            Thread.sleep(300)
            eval(s, "document.querySelector('#cloud-delete-phrase').form.querySelector('button[type=submit]').click()")
            waitFor(s, "/Cloud account deleted/.test(document.body.innerText) && $stateTag === 'Not connected'")
            // Server-side proof: the same credentials that worked a moment ago are refused.
            assertEquals("the server refuses the deleted account", 401, loginStatus(email, password))
        }
    }

    private fun loginStatus(email: String, password: String): Int {
        val conn = java.net.URL("$origin/v1/account/login").openConnection() as java.net.HttpURLConnection
        conn.requestMethod = "POST"; conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json"); conn.setRequestProperty("X-Pri-Client", "android-native-v1")
        conn.outputStream.use { it.write(org.json.JSONObject().put("email", email).put("password", password).toString().toByteArray()) }
        return try { conn.responseCode } finally { conn.disconnect() }
    }

    /** Runs while the cloud server is unreachable (the runner passes priCloudOffline). */
    @Test
    fun offlineWorkIsKeptUnmarkedAndSyncIsNotOffered() {
        assumeTrue("run by android/scripts/run-instrumented.sh with the server stopped", args.getString("priCloudOffline", "") == "true")
        val graded = JSONObject(gradedFile.readText())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s)
            openPractice(s)
            // A question opened now was never the server's: the device shows one
            // of its own as a draft to work on. It can be typed into and is kept,
            // but it can never be marked — not now, and not after reconnecting.
            openTypedQuestion(s, advanceFirst = true)
            val draftId = qid(s)
            assertTrue("the offline question is not the one the server marked", draftId.isNotEmpty() && draftId != graded.getString("id"))
            // Said before any work goes in, and with no Submit or Show solution
            // that could only be refused: the one action is to try for a
            // markable question.
            assertEquals("the card names the question an offline draft", "\"draft\"", waitFor(s, QuestionCardJs.UNMARKABLE))
            val draftSays = eval(s, QuestionCardJs.UNMARKABLE_SAYS)
            assertTrue("the notice says it was opened without a connection and cannot be marked: $draftSays",
                Regex("without a connection", RegexOption.IGNORE_CASE).containsMatchIn(draftSays) &&
                    Regex("cannot be marked", RegexOption.IGNORE_CASE).containsMatchIn(draftSays))
            assertEquals("a draft offers no Submit and no Show solution", "\"replace|1|no-solution\"|false|false",
                eval(s, QuestionCardJs.OFFERS) + "|" + eval(s, QuestionCardJs.PRESS_SUBMIT) + "|" + eval(s, QuestionCardJs.PRESS_REVEAL))
            setValue(s, ".editor-body input.answer-input", "7")
            assertEquals("the typed answer is stored on this device", "\"7\"", waitFor(s, QuestionCardJs.storedTyped(draftId), 15_000))
            assertUnmarked(s, "typing offline")
            assertEquals("typing adds no Submit and no Show solution", "\"replace|1|no-solution\"|false|false",
                eval(s, QuestionCardJs.OFFERS) + "|" + eval(s, QuestionCardJs.PRESS_SUBMIT) + "|" + eval(s, QuestionCardJs.PRESS_REVEAL))
            // With work on the page the first press only asks; confirmed while
            // the server is unreachable, no markable question can be opened and
            // nothing changes.
            waitFor(s, QuestionCardJs.PRESS_REPLACE)
            waitFor(s, QuestionCardJs.visible("[data-check-replace-confirm]"))
            assertEquals("asking changed nothing", "$draftId|\"7\"", qid(s) + "|" + eval(s, QuestionCardJs.TYPED))
            waitFor(s, QuestionCardJs.PRESS_REPLACE)
            waitFor(s, QuestionCardJs.REPLACE_DECLINED, 90_000)
            val noteSays = eval(s, QuestionCardJs.REPLACE_NOTE_SAYS)
            assertTrue("the card says a markable question could not be opened and that nothing has changed: $noteSays",
                Regex("could not be opened", RegexOption.IGNORE_CASE).containsMatchIn(noteSays) &&
                    Regex("nothing here has changed", RegexOption.IGNORE_CASE).containsMatchIn(noteSays))
            assertEquals("the same question is still on the card", draftId, qid(s))
            assertEquals("no check was made, so none was refused", "false", eval(s, QuestionCardJs.REFUSAL))
            assertEquals("no retry that cannot succeed is offered", "false", eval(s, QuestionCardJs.visible("[data-check-retry]")))
            assertUnmarked(s, "a declined replace offline")
            assertEquals("the typed answer is still on the card", "\"7\"", eval(s, QuestionCardJs.TYPED))
            assertEquals("…and still stored on this device", "\"7\"", eval(s, QuestionCardJs.storedTyped(draftId)))
            // Nothing was recorded: History holds the server-marked attempt and no other.
            openHistory(s)
            assertEquals("the offline draft is not in History", "missing", historyVerdict(s, draftId))
            assertEquals("the server-marked attempt is still in History", "Correct", historyVerdict(s, graded.getString("id")))
            // …and the server's own record is unchanged (its database is read by the oracle).
            assertEquals("the server's record is unchanged while it is stopped", graded.getString("server"), assertServerMarkedOnce("offline"))
            offlineDraftFile.writeText(draftId)
            openSettings(s)
            waitFor(s, "$stateTag === 'Linked · offline'", 60_000)
            assertEquals("true", waitFor(s, "!!document.querySelector('[data-cloud-offline]')"))
            assertEquals("Sync is not offered while offline", "true",
                eval(s, "(function(){var b=($byText)('Sync now');return !b||b.disabled;})()"))
        }
    }

    /** The draft opened while the server was stopped, for the run after reconnect. */
    private val offlineDraftFile get() = java.io.File(context.filesDir, "pri-test-offline-draft")

    @Test
    fun cloudSignInAndSync() {
        val email = args.getString("priCloudEmail", "")
        val password = args.getString("priCloudPassword", "")
        assertTrue("fixture account arguments are present", email.isNotEmpty() && password.isNotEmpty())
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            reachHome(s)
            assertEquals("the host advertises a configured cloud over the bridge", "true",
                eval(s, "window.__PRI_HOST__.capabilities.cloud.configured === true && window.__PRI_HOST__.capabilities.cloud.transport === 'bridge'"))

            // Signed out with the server reachable: the question is the server's
            // (prepared), and checking it needs an account.
            val before = oracle("/marked")
            assertEquals("the fixture account starts with nothing issued or marked: $before", "0/0/0",
                "${before.getInt("issued")}/${before.getInt("prepared")}/${before.getJSONArray("completed").length()}")
            openPractice(s)
            // Practice restores the question that was open last, which may be a
            // draft the shell journey opened with no server (never markable).
            // A question opened NOW, with the server reachable, is the server's.
            openTypedQuestion(s, advanceFirst = true)
            val preparedId = qid(s)
            assertEquals("the card says checking needs an account", "true", waitFor(s, QuestionCardJs.visible("[data-check-needs-account]")))
            setValue(s, ".editor-body input.answer-input", WRONG)
            assertEquals("Submit is refused signed out", "refused", submitAndWait(s))
            assertEquals("the refusal is the in-card sign-in", "\"sign-in\"", eval(s, QuestionCardJs.REFUSAL))
            assertEquals("the refusal offers the sign-in on the card", "true", eval(s, QuestionCardJs.visible(".verdict [data-check-sign-in]")))
            assertUnmarked(s, "signed-out Submit")
            assertEquals("the typed answer is kept through the refusal", "\"$WRONG\"", eval(s, QuestionCardJs.TYPED))
            assertEquals("signed out, the server issued and marked nothing for the account", 0, oracle("/marked").getInt("issued"))

            openSettings(s)
            assertEquals("\"Not connected\"", waitFor(s, stateTag))
            eval(s, "($byText)('Sign in').click()")
            setValue(s, "#cloud-email", email)
            setValue(s, "#cloud-password", password)
            eval(s, "document.querySelector('#cloud-email').form.querySelector('button[type=submit]').click()")
            waitFor(s, "$stateTag === 'Connected'")


            waitFor(s, "(function(){var b=($byText)('Sync now');if(!b||b.disabled)return false;b.click();return true;})()")
            val synced = waitFor(s, "(function(){var t=document.querySelector('section[aria-labelledby=\"cloud-account-title\"]').innerText;var m=t.match(/Sync complete[^\\n]*/);return m?m[0]:false;})()", 60_000)
            assertTrue("the local profile synced to the real server: $synced", synced.contains("Sync complete"))
            val sessionNow = jarOnDisk().value(java.net.URI(origin).host, "pri_cloud_session")!!
            val eventsBefore = serverEventCount(sessionNow)

            // Signed in: the server marks. A wrong answer first, then the right
            // one, on a question whose sealed answer the oracle can state.
            //
            // The first candidate is the question prepared signed out. Its
            // Submit was refused for want of an account, not dropped: the card
            // HOLDS that one submission (practiceRecovery holdPendingSubmission)
            // and sends nothing by itself. Coming back to the card signed in,
            // the answer typed signed out is back in the editor and the server
            // has still marked nothing; only the student's own Submit sends it,
            // under the same key. The server then binds the prepared question
            // to the account and marks that answer exactly once.
            openPractice(s)
            assertEquals("Practice comes back to the question prepared signed out", preparedId, qid(s))
            var escrow: JSONObject? = null
            val passed = mutableListOf<String>()
            for (i in 0 until 12) {
                if (i > 0) nextQuestion(s)
                if (!typedEditor(s)) { passed += "no-typed-answer"; continue }
                val got: String
                if (i == 0) {
                    assertEquals("the answer typed signed out is still on the card", "\"$WRONG\"", waitFor(s, QuestionCardJs.TYPED))
                    // Signed in now: the card no longer asks for an account…
                    assertEquals("signed in, the card no longer says checking needs an account", "true",
                        waitFor(s, "!${QuestionCardJs.visible("[data-check-needs-account]")}"))
                    // …and the held submission was NOT sent for the student.
                    assertEquals("no check is running before Submit is pressed", "true", eval(s, QuestionCardJs.CHECK_IDLE))
                    assertUnmarked(s, "back on the held question signed in, before Submit")
                    assertEquals("no verdict of any kind is on the card before Submit", "false|false|false",
                        eval(s, "!!document.querySelector('.verdict-bad')") + "|" + eval(s, "!!document.querySelector('.verdict-technical')") + "|" + eval(s, "!!document.querySelector('.verdict-unsure')"))
                    val held = oracle("/marked")
                    assertEquals("before Submit the server issued, bound and marked nothing for the account: $held", "0/0/0",
                        "${held.getInt("issued")}/${held.getInt("prepared")}/${held.getJSONArray("completed").length()}")
                    // The student's own press sends it (a second, automatic
                    // delivery would spend the second try and fail the
                    // one-try-left and two-grades assertions below).
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
                if (i == 0) {
                    assertTrue("the server bound the question it prepared signed out to the account: $sealed", sealed.optBoolean("fromPrepared"))
                    assertEquals("exactly one prepared question was bound", 1, oracle("/marked").getInt("prepared"))
                }
                if (got != "miss" || !sealed.optBoolean("supported")) { passed += "$got/${sealed.optString("answerType", "unstatable")}"; continue }
                assertEquals("a first miss does not resolve the question", "false|false",
                    eval(s, "!!document.querySelector('.eval-card')") + "|" + eval(s, "!!document.querySelector('.solution-panel')"))
                assertEquals("a second try is offered", "true", eval(s, "(function(){var b=document.querySelector('.editor-body input.answer-input');return !!b&&!b.disabled;})()"))
                Log.i("PRITEST", "server marked the wrong answer on question ${i + 1}" +
                    (if (i == 0) " (prepared signed out, bound to the account at check time)" else " (issued to the account)") + "; passed over: $passed")
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
            waitFor(s, "$stateTag === 'Not connected'")
            val end = System.currentTimeMillis() + 5_000
            while (jarOnDisk().value(host, "pri_cloud_session") != null && System.currentTimeMillis() < end) Thread.sleep(100)
            assertEquals("Disconnect cleared the device's session", null, jarOnDisk().value(host, "pri_cloud_session"))
            assertEquals("…and revoked it on the server (the old cookie is refused)", 401, meStatus(session))
        }
    }
}
