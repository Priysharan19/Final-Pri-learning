// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the account-first entry, shared by the signed-in tests
//
// The app opens nothing without an account (issue #477): the activation gate
// stands in front of the shell until the server confirms the session, the
// age/guardian decision and a first sync. The tests that need the shell
// (InkInputTest, FileExchangeTest, WebViewAccessibilityTest) therefore run
// against the real fixture server (priCloud), AFTER CloudJourneyTest has
// entered through the sign-in card with the server's emailed code
// (android/scripts/run-instrumented.sh orders them so). They never make a
// device-only profile and never sign in any other way.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import androidx.test.platform.app.InstrumentationRegistry
import com.prilearning.app.cloud.CloudConfig
import org.junit.Assert.assertTrue

object AccountFirst {
    /** Home is open and the gate is gone: the server let this device's student in. */
    const val HOME_OPEN = "!!document.querySelector('.home-greet') && !document.querySelector('[data-testid=account-activation-gate]')"

    /** Point the app at the fixture server the runner started (DEBUG builds only). */
    fun useFixtureServer() {
        val origin = InstrumentationRegistry.getArguments().getString("priCloud", "")
        assertTrue("account-first: this test needs the fixture server (priCloud) and a student signed in on the card by CloudJourneyTest", origin.isNotEmpty())
        CloudConfig.debugOverride = origin
    }
}
