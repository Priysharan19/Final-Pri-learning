// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · accessibility smoke in the real Android WebView (CP-10)
//
// The same DOM-level rules the iPhone certification applies, in the shipped
// shell: every visible control has an accessible name, every field a label, the
// document a language, each screen a heading, no positive tabindex, primary
// targets at least 44 CSS px — on Home, Practice, Progress and Settings, at the
// device's own size. Also: the system font scale reaches the page (textZoom is
// left at its default). TalkBack itself stays a physical/manual gate.
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
            s.onActivity { assertEquals("the system font scale reaches the page", 100, it.webView!!.settings.textZoom) }
            val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                if(b){b.click();return 'picker';}return false;})()""")
            assertTrue(state, state == "\"home\"" || state == "\"picker\"")
            waitFor(s, "document.querySelector('.home-greet')")
            for (path in listOf("/", "/practice", "/progress", "/settings")) {
                eval(s, "(function(){history.pushState({},'','$path');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
                Thread.sleep(1500)
                assertEquals("accessibility smoke on $path", "\"clean\"", eval(s, "$audit('$path')"))
            }
        }
    }
}
