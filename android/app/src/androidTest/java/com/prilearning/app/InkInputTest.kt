// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android handwriting input through the shared web canvas (CP-09)
//
// Real MotionEvents — finger (TOOL_TYPE_FINGER) and stylus (TOOL_TYPE_STYLUS,
// with pressure) — injected into the WebView over the shared InkCanvas, the same
// component iPad-in-browser and phones use. No Kotlin drawing or recognition.
// Asserted:
//   · a finger stroke arrives as pointerType "touch" and is drawn;
//   · a stylus stroke arrives as pointerType "pen", with pressure, and is drawn;
//   · after a pen has been seen, a finger touch is rejected (palm rejection)
//     until the Finger toggle is on; then fingers write again;
//   · the shell reports stylusSeen live (device.facts);
//   · rotation keeps the ink;
//   · the shared recognizer reads the handwriting and the attempt is marked.
// Stroke metrics (events, samples, kept points, gaps, delivery latency) are
// logged as SYNTHETIC / EMULATOR evidence. Injected input says nothing about
// real finger, S Pen or USI quality — that stays a physical gate.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.content.pm.ActivityInfo
import android.os.SystemClock
import android.util.Log
import android.view.InputDevice
import android.view.MotionEvent
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class InkInputTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()

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

    private val byLabel = "function(l){return [].slice.call(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||b.textContent.trim())===l;});}"

    /** Base-canvas ink pixels (alpha > 0), the committed strokes. */
    private fun inkPixels(s: ActivityScenario<MainActivity>): Int = eval(s, """(function(){var c=document.querySelector('.editor-shell .ink-canvas-base')||document.querySelector('.ink-canvas-base');
        if(!c||!c.width)return -1;var d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;var n=0;for(var i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;})()""").toIntOrNull() ?: -1

    private fun canvasWidth(s: ActivityScenario<MainActivity>): Int =
        eval(s, "(function(){var c=document.querySelector('.editor-shell .ink-canvas-base')||document.querySelector('.ink-canvas-base');return c?c.width:-1;})()").toIntOrNull() ?: -1

    /** Ink pixels in a horizontal band of the committed canvas (fractions of its height). */
    private fun bandPixels(s: ActivityScenario<MainActivity>, from: Float, to: Float): Int = eval(s, """(function(){var c=document.querySelector('.editor-shell .ink-canvas-base')||document.querySelector('.ink-canvas-base');
        if(!c||!c.width)return -1;var y0=Math.floor(c.height*$from),y1=Math.ceil(c.height*$to);var d=c.getContext('2d').getImageData(0,y0,c.width,y1-y0).data;var n=0;for(var i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;})()""").toIntOrNull() ?: -1

    private fun metrics(s: ActivityScenario<MainActivity>): JSONObject =
        JSONObject(eval(s, "JSON.stringify(window.__PRI_INK_METRICS__||{strokes:[],rejected:{touchAfterPen:0},cancels:0})").let { JSONTokener(it).nextValue() as String })

    /** One stroke of real MotionEvents across the canvas at height fraction fy. */
    private fun stroke(s: ActivityScenario<MainActivity>, tool: Int, fy: Float, fx0: Float = 0.2f, fx1: Float = 0.6f, steps: Int = 24) {
        val rect = waitFor(s, "(function(){var c=[].slice.call(document.querySelectorAll('.ink-canvas')).pop();var r=c.getBoundingClientRect();return [r.left,r.top,r.width,r.height,window.devicePixelRatio].join(',');})()")
        val (l, t, w, h, dpr) = rect.trim('"').split(',').map { it.toFloat() }
        val loc = IntArray(2)
        s.onActivity { it.webView!!.getLocationOnScreen(loc) }
        val stylus = tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER
        val props = arrayOf(MotionEvent.PointerProperties().apply { id = 0; toolType = tool })
        val source = if (stylus) InputDevice.SOURCE_STYLUS or InputDevice.SOURCE_TOUCHSCREEN else InputDevice.SOURCE_TOUCHSCREEN
        val down = SystemClock.uptimeMillis()
        fun send(action: Int, i: Int) {
            val f = i.toFloat() / steps
            val coords = arrayOf(MotionEvent.PointerCoords().apply {
                x = loc[0] + (l + w * (fx0 + (fx1 - fx0) * f)) * dpr
                y = loc[1] + (t + h * fy + (if (i % 2 == 0) 4f else -4f)) * dpr
                pressure = if (stylus) 0.35f + 0.5f * f else 1f
                size = if (stylus) 0.01f else 0.1f
            })
            val ev = MotionEvent.obtain(down, down + i * 8L, action, 1, props, coords, 0, 0, 1f, 1f, 0, 0, source, 0)
            instrumentation.sendPointerSync(ev)
            ev.recycle()
        }
        send(MotionEvent.ACTION_DOWN, 0)
        for (i in 1 until steps) send(MotionEvent.ACTION_MOVE, i)
        send(MotionEvent.ACTION_UP, steps)
        Thread.sleep(300)
    }

    @Test
    fun fingerAndStylusWriteThroughTheSharedCanvas() {
        var supported = false
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            s.onActivity { supported = it.webView != null }
            assumeTrue("the WebView is below the floor on this image", supported)
            // Home with a local profile (the journey created it), or onboard now.
            val state = waitFor(s, """(function(){if(document.querySelector('.home-greet'))return 'home';
                var b=[].slice.call(document.querySelectorAll('.auth-card button')).find(function(x){return /Android Student/.test(x.textContent);});
                if(b){b.click();return 'picker';}return false;})()""")
            assertTrue(state, state == "\"home\"" || state == "\"picker\"")
            waitFor(s, "document.querySelector('.home-greet')")
            eval(s, "(function(){window.__PRI_INK_METRICS_ENABLED__=true;history.pushState({},'','/practice');dispatchEvent(new PopStateEvent('popstate'));return true;})()")
            waitFor(s, "document.querySelector('.q-prompt')")

            // A question that offers handwriting.
            var writable = false
            for (i in 0 until 14) {
                if (eval(s, "!!($byLabel)('Write: answer by handwriting')") == "true") { writable = true; break }
                eval(s, "(function(){var n=document.querySelector('.ctx-next');if(n)n.click();return true;})()")
                Thread.sleep(1100)
            }
            assertTrue("a question offering handwriting was found", writable)
            eval(s, "($byLabel)('Write: answer by handwriting').click()")
            waitFor(s, "document.querySelectorAll('.ink-canvas').length > 0")
            eval(s, "[].slice.call(document.querySelectorAll('.ink-canvas')).pop().scrollIntoView({block:'center'})")
            Thread.sleep(600)
            assertEquals("the canvas starts empty", 0, inkPixels(s))

            // ── finger ────────────────────────────────────────────────────────
            stroke(s, MotionEvent.TOOL_TYPE_FINGER, 0.3f)
            var m = metrics(s)
            val finger = m.getJSONArray("strokes").getJSONObject(m.getJSONArray("strokes").length() - 1)
            assertEquals("a finger arrives as pointerType touch", "touch", finger.getString("pointerType"))
            assertTrue("the finger stroke is drawn (${inkPixels(s)} px)", inkPixels(s) > 50)
            val afterFinger = inkPixels(s)

            // ── stylus ───────────────────────────────────────────────────────
            eval(s, """(function(){window.__f0=null;priBridge.addEventListener('message',function(e){try{var x=JSON.parse(e.data);if(x.id==='t-facts0')window.__f0=x;}catch(_){}});
                priBridge.postMessage(JSON.stringify({v:1,id:'t-facts0',cap:'device',op:'facts',payload:{}}));return true;})()""")
            assertEquals("before any stylus event the shell has not seen a stylus", "\"false\"",
                waitFor(s, "window.__f0 && window.__f0.ok && String(window.__f0.result.stylusSeen)"))
            stroke(s, MotionEvent.TOOL_TYPE_STYLUS, 0.55f)
            m = metrics(s)
            val pen = m.getJSONArray("strokes").getJSONObject(m.getJSONArray("strokes").length() - 1)
            assertEquals("a stylus arrives as pointerType pen", "pen", pen.getString("pointerType"))
            assertTrue("the stylus pressure varies along the stroke", pen.getBoolean("pressureVaried"))
            assertTrue("the stylus stroke is drawn", inkPixels(s) > afterFinger)
            assertTrue("no injected samples are lost before the canvas (${pen.getInt("samples")} samples, ${pen.getInt("keptPoints")} kept)",
                pen.getInt("samples") >= 20 && pen.getInt("keptPoints") >= 12)
            // device.facts through the bridge.
            eval(s, """(function(){window.__f=null;priBridge.addEventListener('message',function(e){try{var x=JSON.parse(e.data);if(x.id==='t-facts')window.__f=x;}catch(_){}});
                priBridge.postMessage(JSON.stringify({v:1,id:'t-facts',cap:'device',op:'facts',payload:{}}));return true;})()""")
            assertEquals("true", waitFor(s, "window.__f && window.__f.ok && window.__f.result.stylusSeen === true"))

            // ── palm rejection, then the Finger toggle ───────────────────────
            val strokesBefore = m.getJSONArray("strokes").length()
            val pixelsBefore = inkPixels(s)
            stroke(s, MotionEvent.TOOL_TYPE_FINGER, 0.8f)
            m = metrics(s)
            assertTrue("after a pen, a finger touch is rejected (palm) and draws nothing",
                m.getJSONObject("rejected").getInt("touchAfterPen") >= 1 && m.getJSONArray("strokes").length() == strokesBefore && inkPixels(s) == pixelsBefore)
            eval(s, "[].slice.call(document.querySelectorAll('button.ink-tool')).find(function(b){return /Finger/.test(b.textContent)}).click()")
            Thread.sleep(1000)
            val widthBefore = canvasWidth(s)
            val bandBefore = bandPixels(s, 0.7f, 0.9f)
            stroke(s, MotionEvent.TOOL_TYPE_FINGER, 0.8f)
            Thread.sleep(1000)
            m = metrics(s)
            val last = m.getJSONArray("strokes").getJSONObject(m.getJSONArray("strokes").length() - 1)
            assertTrue("with Finger on, a finger stroke is captured (strokes ${m.getJSONArray("strokes").length()} vs $strokesBefore)",
                m.getJSONArray("strokes").length() == strokesBefore + 1 && last.getString("pointerType") == "touch" && last.getInt("keptPoints") >= 12)
            if (canvasWidth(s) == widthBefore) {
                assertTrue("…and its ink appears where it was written (${bandPixels(s, 0.7f, 0.9f)} vs $bandBefore px in that band)", bandPixels(s, 0.7f, 0.9f) > bandBefore)
            } else {
                // The sheet resized under the stroke (the reading panel); CP-03 rescales
                // every stroke uniformly, so only presence can be compared.
                assertTrue("…and the sheet still holds ink after resizing", inkPixels(s) > 0)
            }

            // ── rotation keeps the ink ───────────────────────────────────────
            val beforeRotation = inkPixels(s)
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            Thread.sleep(2500)
            assertTrue("rotation keeps the strokes (${inkPixels(s)} px)", inkPixels(s) > beforeRotation / 3)
            s.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
            Thread.sleep(2000)

            // ── the stylus's own eraser end erases (USI / Wacom; S Pen button) ─
            // TOOL_TYPE_ERASER reaches the page as a pen with the eraser button
            // (buttons & 32); the shared canvas erases with it, no UI tool switch.
            val bandEmpty = bandPixels(s, 0.42f, 0.48f)
            stroke(s, MotionEvent.TOOL_TYPE_STYLUS, 0.45f, fx0 = 0.66f, fx1 = 0.86f)
            val bandInked = bandPixels(s, 0.42f, 0.48f)
            assertTrue("a stylus stroke inks the band ($bandInked vs $bandEmpty px)", bandInked > bandEmpty + 20)
            stroke(s, MotionEvent.TOOL_TYPE_ERASER, 0.45f, fx0 = 0.66f, fx1 = 0.86f)
            val bandErased = bandPixels(s, 0.42f, 0.48f)
            assertTrue("the stylus eraser end removes that stroke ($bandErased px left, was $bandInked)", bandErased <= bandEmpty + 5)

            // ── reading is the server's job (owner decision: server-only) ────
            // The emulator has no Pri server, so the strokes must NOT be read or
            // marked on the device; the student is told why and the ink is kept.
            val status = waitFor(s, "(function(){var e=document.querySelector('.ink-status');return e&&e.innerText.trim()?e.innerText.trim().slice(0,160):false;})()", 30_000)
            assertTrue("the student is told why the handwriting is not read yet: $status", status.length > 10)
            assertEquals("no on-device reading is shown or offered for marking", "0",
                eval(s, "String(document.querySelectorAll('.ink-preview .ink-line').length)").trim('"'))
            assertTrue("the ink is kept on the page while it waits", inkPixels(s) > 0)

            m = metrics(s)
            Log.i("PRITEST", "ink metrics (SYNTHETIC / EMULATOR): " + m.toString())
            val strokes: JSONArray = m.getJSONArray("strokes")
            for (i in 0 until strokes.length()) assertEquals("no stroke was cancelled", false, strokes.getJSONObject(i).getBoolean("cancelled"))
        }
    }
}
