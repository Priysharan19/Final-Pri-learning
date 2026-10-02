// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android file exchange through the real bridge (CP-07)
//
// Drives share.file, <input type=file> (document picker and camera offer) and
// share.print from the page, intercepting only the system chooser (an
// ActivityMonitor answers it the way the person would) so the test can see the
// exact intents the shell sends:
//   · an export reaches the share sheet as a FileProvider URI whose content is
//     the page's bytes;
//   · a JSON file input asks the document picker for JSON, and the picked file
//     reaches the page's <input>;
//   · an image input also offers the camera, with EXTRA_OUTPUT a FileProvider
//     URI the camera app was explicitly granted write access to; a "captured"
//     photo reaches the page;
//   · print opens the system print dialog (reply completed: true).
// It does not drive a real camera app or printer — those stay physical checks.
// SYNTHETIC / EMULATOR evidence.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.MediaStore
import android.view.KeyEvent
import android.view.MotionEvent
import android.webkit.WebView
import androidx.core.content.FileProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class FileExchangeTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext

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

    private fun waitFor(s: ActivityScenario<MainActivity>, js: String, timeoutMs: Long = 30_000): String {
        val end = System.currentTimeMillis() + timeoutMs
        var last = "null"
        while (System.currentTimeMillis() < end) {
            last = eval(s, js)
            if (last != "null" && last != "false" && last != "\"\"" && !last.startsWith("\"ERR")) return last
            Thread.sleep(200)
        }
        throw AssertionError("timed out waiting for: $js (last=$last)")
    }

    private fun tap(s: ActivityScenario<MainActivity>, selector: String) {
        val rect = waitFor(s, "(function(){var r=document.querySelector('$selector').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,window.devicePixelRatio].join(',');})()")
        val (cx, cy, dpr) = rect.trim('"').split(',').map { it.toFloat() }
        val loc = IntArray(2)
        s.onActivity { it.webView!!.getLocationOnScreen(loc) }
        val t = SystemClock.uptimeMillis()
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, loc[0] + cx * dpr, loc[1] + cy * dpr, 0))
        instrumentation.sendPointerSync(MotionEvent.obtain(t, t + 60, MotionEvent.ACTION_UP, loc[0] + cx * dpr, loc[1] + cy * dpr, 0))
    }

    /** Answers the system chooser like a person would, and remembers what was asked. */
    private class ChooserMonitor(private val answer: (Intent) -> Instrumentation.ActivityResult) : Instrumentation.ActivityMonitor() {
        @Volatile var asked: Intent? = null
        override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
            if (intent.action != Intent.ACTION_CHOOSER) return null
            asked = intent
            return answer(intent)
        }
    }

    private fun <T> withChooser(answer: (Intent) -> Instrumentation.ActivityResult, block: (ChooserMonitor) -> T): T {
        val monitor = ChooserMonitor(answer)
        instrumentation.addMonitor(monitor)
        try { return block(monitor) } finally { instrumentation.removeMonitor(monitor) }
    }

    private fun awaitAsked(m: ChooserMonitor): Intent {
        val end = System.currentTimeMillis() + 10_000
        while (m.asked == null && System.currentTimeMillis() < end) Thread.sleep(100)
        return m.asked ?: throw AssertionError("the system chooser was never opened")
    }

    @Suppress("DEPRECATION")
    private inline fun <reified T> Intent.extra(name: String): T? =
        if (Build.VERSION.SDK_INT >= 33) getParcelableExtra(name, T::class.java) else getParcelableExtra(name) as? T

    /** A raw envelope from the page, its reply kept in window.__priReplies. */
    private fun postEnvelope(s: ActivityScenario<MainActivity>, id: String, cap: String, op: String, payload: JSONObject) {
        val env = JSONObject().put("v", 1).put("id", id).put("cap", cap).put("op", op).put("payload", payload).toString()
        eval(s, """(function(){window.__priReplies=window.__priReplies||{};
            if(!window.__priTap){window.__priTap=true;priBridge.addEventListener('message',function(e){try{var m=JSON.parse(e.data);if(m.id)window.__priReplies[m.id]=m;}catch(_){}});}
            priBridge.postMessage(${JSONObject.quote(env)});return true;})()""")
    }

    @Test
    fun shareFilePickerCameraAndPrint() {
        var supported = false
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            s.onActivity { supported = it.webView != null }
            assumeTrue("the WebView is below the floor on this image", supported)
            waitFor(s, "!!window.priBridge && document.readyState === 'complete'")

            // ── share.file → ACTION_SEND with a FileProvider URI holding the bytes ──
            withChooser({ Instrumentation.ActivityResult(Activity.RESULT_OK, null) }) { m ->
                postEnvelope(s, "t-share", "share", "file", JSONObject().put("filename", "../pri backup.json").put("mimeType", "application/json").put("text", "{\"hello\":\"pri\"}"))
                val send = awaitAsked(m).extra<Intent>(Intent.EXTRA_INTENT)
                assertNotNull("the chooser wraps a share intent", send)
                assertEquals(Intent.ACTION_SEND, send!!.action)
                assertEquals("application/json", send.type)
                val uri = send.extra<Uri>(Intent.EXTRA_STREAM)!!
                assertEquals("content", uri.scheme)
                assertEquals("${context.packageName}.files", uri.authority)
                assertTrue("only the chosen app gets read access", send.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
                assertTrue("the name is sanitised (no traversal)", uri.lastPathSegment!!.endsWith("pri backup.json") && !uri.toString().contains(".."))
                assertEquals("{\"hello\":\"pri\"}", context.contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) })
                assertEquals("true", waitFor(s, "window.__priReplies['t-share'] && window.__priReplies['t-share'].ok === true && window.__priReplies['t-share'].result.completed === true"))
            }

            // ── <input type=file accept=json> → document picker → the page reads the file ──
            val picked = File(File(context.cacheDir, "share/test-pick").apply { mkdirs() }, "picked.json").apply { writeText("{\"picked\":true}") }
            val pickedUri = FileProvider.getUriForFile(context, "${context.packageName}.files", picked)
            eval(s, """(function(){var i=document.createElement('input');i.type='file';i.id='pri-json';i.accept='.json,application/json';
                i.style.cssText='position:fixed;left:30px;top:150px;width:240px;height:80px;z-index:2147483647;opacity:1';
                i.addEventListener('change',function(){var f=i.files[0];if(!f){window.__picked='none';return;}var r=new FileReader();r.onload=function(){window.__picked=f.name+'|'+r.result;};r.readAsText(f);});
                document.body.appendChild(i);return true;})()""")
            withChooser({ Instrumentation.ActivityResult(Activity.RESULT_OK, Intent().setData(pickedUri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }) { m ->
                tap(s, "#pri-json")
                val open = awaitAsked(m).extra<Intent>(Intent.EXTRA_INTENT)!!
                assertEquals(Intent.ACTION_OPEN_DOCUMENT, open.action)
                val types = open.getStringArrayExtra(Intent.EXTRA_MIME_TYPES)?.toList() ?: listOf(open.type)
                assertTrue("the picker is asked for JSON: $types", "application/json" in types)
                assertEquals("a JSON input offers no camera", null, awaitAsked(m).getParcelableArrayExtra(Intent.EXTRA_INITIAL_INTENTS))
                assertEquals("\"picked.json|{\\\"picked\\\":true}\"", waitFor(s, "window.__picked"))
            }

            // ── <input accept=image/*> also offers the camera, granted write to one URI ──
            eval(s, """(function(){var i=document.createElement('input');i.type='file';i.id='pri-photo';i.accept='image/*,application/pdf';
                i.style.cssText='position:fixed;left:30px;top:260px;width:240px;height:80px;z-index:2147483647;opacity:1';
                i.addEventListener('change',function(){var f=i.files[0];window.__photo=f?(f.name+'|'+f.size):'none';});
                document.body.appendChild(i);return true;})()""")
            @Suppress("DEPRECATION")
            val cameras = context.packageManager.queryIntentActivities(Intent(MediaStore.ACTION_IMAGE_CAPTURE), PackageManager.MATCH_DEFAULT_ONLY)
            val granted: MutableList<Boolean> = java.util.Collections.synchronizedList(mutableListOf())
            withChooser({ chooser ->
                // Play the camera app: write the photo where the shell asked, then return OK.
                @Suppress("DEPRECATION")
                val capture = (chooser.getParcelableArrayExtra(Intent.EXTRA_INITIAL_INTENTS)?.firstOrNull() as? Intent)
                val out = capture?.extra<Uri>(MediaStore.EXTRA_OUTPUT)
                if (out != null) {
                    // While the picker is up, every camera app holds write access to exactly this URI.
                    for (info in cameras) {
                        val uid = context.packageManager.getApplicationInfo(info.activityInfo.packageName, 0).uid
                        granted += context.checkUriPermission(out, -1, uid, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == PackageManager.PERMISSION_GRANTED
                    }
                    context.contentResolver.openOutputStream(out)!!.use { it.write(ByteArray(2048) { 7 }) }
                }
                Instrumentation.ActivityResult(Activity.RESULT_OK, null)
            }) { m ->
                tap(s, "#pri-photo")
                val chooser = awaitAsked(m)
                val open = chooser.extra<Intent>(Intent.EXTRA_INTENT)!!
                val types = open.getStringArrayExtra(Intent.EXTRA_MIME_TYPES)?.toList() ?: listOf(open.type)
                assertTrue("images and PDFs: $types", "image/*" in types && "application/pdf" in types)
                if (cameras.isEmpty()) {
                    assertEquals("no camera app, no camera offer", null, chooser.getParcelableArrayExtra(Intent.EXTRA_INITIAL_INTENTS))
                } else {
                    @Suppress("DEPRECATION")
                    val capture = chooser.getParcelableArrayExtra(Intent.EXTRA_INITIAL_INTENTS)!!.first() as Intent
                    assertEquals(MediaStore.ACTION_IMAGE_CAPTURE, capture.action)
                    val out = capture.extra<Uri>(MediaStore.EXTRA_OUTPUT)!!
                    assertEquals("${context.packageName}.files", out.authority)
                    // The monitor's result callback (which checks the grants) can run just
                    // after the chooser is observed; wait for it rather than racing it.
                    val until = System.currentTimeMillis() + 10_000
                    while (granted.size < cameras.size && System.currentTimeMillis() < until) Thread.sleep(100)
                    assertTrue("each camera app was granted write access to the capture URI: $granted", granted.size == cameras.size && granted.all { it })
                    assertEquals("\"photo.jpg|2048\"", waitFor(s, "window.__photo"))
                }
            }

            // ── share.print → the system print dialog ──
            postEnvelope(s, "t-print", "share", "print", JSONObject())
            assertEquals("true", waitFor(s, "window.__priReplies['t-print'] && window.__priReplies['t-print'].ok === true && window.__priReplies['t-print'].result.completed === true"))
            Thread.sleep(1500)
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK) // dismiss the print dialog
        }
    }
}
