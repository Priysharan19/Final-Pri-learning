// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · accessibility smoke in the real Android WebView (CP-10)
//
// The same DOM-level rules the iPhone certification applies, in the shipped
// shell: every visible control has an accessible name, every field a label, the
// document a language, each screen a heading, no positive tabindex, primary
// targets at least 44 CSS px — on Home, Practice, Progress and Settings, at the
// device's own size, each audited once its own landmark has rendered. And the
// system font size reaches the page: text is measurably larger at 1.3×.
// Nothing clips horizontally: phone portrait and tablet landscape, at 1.0× and
// 1.3× font scale, no screen scrolls sideways and no visible control or heading
// is cut by the viewport edge (content inside its own horizontal scroller is
// exempt). TalkBack itself stays a physical/manual gate.
// SYNTHETIC / EMULATOR evidence.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

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
class WebViewAccessibilityTest {
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

    private val audit = """(function(where){
      var visible=function(el){return !!(el.offsetParent||el.getClientRects().length)&&getComputedStyle(el).visibility!=='hidden';};
      var nameOf=function(el){var n=(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||el.getAttribute('alt')||el.value||'').trim();
        if(!n&&el.getAttribute('aria-labelledby'))n=el.getAttribute('aria-labelledby').split(/\s+/).map(function(id){var x=document.getElementById(id);return x?x.textContent:'';}).join(' ').trim();return n;};
      var p=[];if(!document.documentElement.lang)p.push('no lang');
      [].slice.call(document.querySelectorAll('button, a[href], [role=button]')).forEach(function(el){if(visible(el)&&!nameOf(el))p.push(where+': unnamed '+el.tagName+'.'+el.className);});
      [].slice.call(document.querySelectorAll('input:not([type=hidden]), select, textarea')).forEach(function(el){if(!visible(el))return;
        var l=el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||(el.id&&document.querySelector('label[for="'+el.id+'"]'))||el.closest('label');if(!l)p.push(where+': unlabelled '+(el.id||el.name||el.type));});
      [].slice.call(document.querySelectorAll('[tabindex]')).forEach(function(el){if(Number(el.getAttribute('tabindex'))>0)p.push(where+': positive tabindex');});
      [].slice.call(document.querySelectorAll('img')).forEach(function(el){if(visible(el)&&!el.hasAttribute('alt'))p.push(where+': img without alt');});
      if(!document.querySelector('h1, h2, [role=heading]'))p.push(where+': no heading');
      [].slice.call(document.querySelectorAll('.btn, .mobilenav button, .mobilenav a')).forEach(function(el){if(!visible(el))return;var r=el.getBoundingClientRect();if(r.width>0&&r.height<43.5)p.push(where+': small target '+Math.round(r.height)+'px '+nameOf(el).slice(0,20));});
      return p.join(' | ')||'clean';})"""

    @Test
    fun theProductPassesTheAccessibilitySmokeInTheShell() {
        var supported = false
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            s.onActivity { supported = it.webView != null }
            assumeTrue("the WebView is below the floor on this image", supported)
            val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                if(b){b.click();return 'picker';}return false;})()""")
            assertTrue(state, state == "\"home\"" || state == "\"picker\"")
            waitFor(s, "document.querySelector('.home-greet')")
            // Each screen is audited only once its own landmark has rendered.
            for ((path, landmark) in listOf("/" to ".home-greet", "/practice" to ".q-prompt", "/progress" to ".card .sc-label", "/settings" to "#cloud-account-title")) {
                eval(s, "(function(){history.pushState({},'','$path');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
                waitFor(s, "location.pathname === '$path' && !!document.querySelector('$landmark')")
                Thread.sleep(400)
                assertEquals("accessibility smoke on $path", "\"clean\"", eval(s, "$audit('$path')"))
            }
        }
    }

    /** The system font size reaches the page: at 1.3× the same text is measurably larger. */
    @Test
    fun theSystemFontScaleReachesThePage() {
        val ui = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().uiAutomation
        fun fontScale(v: String) { ui.executeShellCommand("settings put system font_scale $v").close(); Thread.sleep(1500) }
        fun greetHeight(): Float {
            var h = -1f
            ActivityScenario.launch(MainActivity::class.java).use { s ->
                var ok = false
                s.onActivity { ok = it.webView != null }
                assumeTrue("the WebView is below the floor on this image", ok)
                val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                    var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                    if(b){b.click();return 'picker';}return false;})()""")
                assertTrue(state, state == "\"home\"" || state == "\"picker\"")
                // A paragraph of fixed text, measured in CSS px.
                h = waitFor(s, "(function(){var p=document.createElement('p');p.id='pri-fs';p.style.cssText='position:absolute;left:0;top:0;width:200px;margin:0';p.textContent='Pri Learning measures the system font size here.';document.body.appendChild(p);var r=p.getBoundingClientRect().height;p.remove();return String(r);})()").trim('"').toFloat()
            }
            return h
        }
        try {
            fontScale("1.0")
            val base = greetHeight()
            fontScale("1.3")
            val large = greetHeight()
            assertTrue("text at system font scale 1.3 is larger than at 1.0 ($large vs $base CSS px)", large > base * 1.15)
        } finally {
            fontScale("1.0")
        }
    }

    private val clipAudit = """(function(where){
      var p=[],w=window.innerWidth;
      if(document.documentElement.scrollWidth>w+1)p.push(where+': page is '+document.documentElement.scrollWidth+'px wide in a '+w+'px viewport');
      var scroller=function(el){for(var a=el.parentElement;a&&a!==document.body;a=a.parentElement){var o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll')return true;}return false;};
      [].slice.call(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, h1, h2, h3, [role=button], [role=heading]')).forEach(function(el){
        if(!(el.offsetParent||el.getClientRects().length)||getComputedStyle(el).visibility==='hidden')return;
        var r=el.getBoundingClientRect();if(r.width===0||r.height===0||scroller(el))return;
        if(r.left<-1||r.right>w+1)p.push(where+': '+el.tagName.toLowerCase()+' '+(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,24)+' spans '+Math.round(r.left)+'..'+Math.round(r.right));});
      return p.join(' | ')||'clean';})"""

    /** Phone portrait / tablet landscape, at 1.0× and 1.3× font scale: no screen clips sideways. */
    @Test
    fun noScreenClipsHorizontally() {
        val ui = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().uiAutomation
        fun sh(c: String) = ui.executeShellCommand(c).close()
        val tablet = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.resources.configuration.smallestScreenWidthDp >= 600
        fun get(k: String): String = ui.executeShellCommand("settings get system $k").let { fd ->
            android.os.ParcelFileDescriptor.AutoCloseInputStream(fd).bufferedReader().readText().trim() }
        val saved = listOf("font_scale", "accelerometer_rotation", "user_rotation").associateWith { get(it) }
        // Natural orientation: portrait on a phone, landscape on pixel_tablet.
        sh("settings put system accelerometer_rotation 0"); sh("settings put system user_rotation 0")
        try {
            for (scale in listOf("1.0", "1.3")) {
                sh("settings put system font_scale $scale"); Thread.sleep(1500)
                ActivityScenario.launch(MainActivity::class.java).use { s ->
                    var ok = false
                    s.onActivity { ok = it.webView != null }
                    assumeTrue("the WebView is below the floor on this image", ok)
                    val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                        var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                        if(b){b.click();return 'picker';}return false;})()""")
                    assertTrue(state, state == "\"home\"" || state == "\"picker\"")
                    waitFor(s, "document.querySelector('.home-greet')")
                    val landscape = eval(s, "window.innerWidth > window.innerHeight")
                    assertEquals(if (tablet) "the tablet runs landscape" else "the phone runs portrait", if (tablet) "true" else "false", landscape)
                    for ((path, landmark) in listOf("/" to ".home-greet", "/practice" to ".q-prompt", "/progress" to ".card .sc-label", "/review" to "h1, h2", "/settings" to "#cloud-account-title")) {
                        eval(s, "(function(){history.pushState({},'','$path');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
                        waitFor(s, "location.pathname === '$path' && !!document.querySelector('$landmark')")
                        Thread.sleep(400)
                        assertEquals("horizontal clipping on $path at font scale $scale (${if (tablet) "tablet landscape" else "phone portrait"})", "\"clean\"", eval(s, "$clipAudit('$path')"))
                    }
                }
            }
        } finally {
            for ((k, v) in saved) if (v.isNotEmpty() && v != "null") sh("settings put system $k $v") else sh("settings delete system $k")
        }
    }
}
