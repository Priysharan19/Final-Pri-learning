// Pri Learning · Android cloud bridge (CP-07) — JVM tests for origin/path
// rules, the cookie jar, file rules, and the real HttpURLConnection transport
// against a local HTTP server (exact headers, CSRF copy, no redirects, caps,
// cancellation). The instrumented test drives the same bridge from the page.
package com.prilearning.app

import com.prilearning.app.cloud.CloudConfig
import com.prilearning.app.cloud.CookieJar
import com.prilearning.app.cloud.NativeCloud
import com.prilearning.app.io.FileRules
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class CloudBridgeTest {
    @Test fun originsAreHttpsOnlyInReleaseAndLocalHttpInDebug() {
        assertEquals("https://api.prilearning.app", CloudConfig.validateOrigin("https://api.prilearning.app/", debug = false))
        assertEquals("https://api.prilearning.app:8443", CloudConfig.validateOrigin(" https://API.prilearning.app:8443 ", debug = false))
        for (bad in listOf(null, "", "http://api.prilearning.app", "https://api.prilearning.app/v1", "https://u:p@api.prilearning.app",
            "https://api.prilearning.app?x=1", "https://api.prilearning.app#f", "ftp://api.prilearning.app", "javascript:alert(1)",
            "http://10.0.2.2:4310")) {
            assertNull("$bad (release)", CloudConfig.validateOrigin(bad, debug = false))
        }
        assertEquals("http://10.0.2.2:4310", CloudConfig.validateOrigin("http://10.0.2.2:4310", debug = true))
        assertEquals("http://127.0.0.1:9", CloudConfig.validateOrigin("http://127.0.0.1:9", debug = true))
        assertNull("debug still refuses cleartext to a real host", CloudConfig.validateOrigin("http://api.prilearning.app", debug = true))
    }

    @Test fun pathsMatchTheWebTransportRule() {
        for (ok in listOf("/v1/health", "/v1/account/me", "/v1/sync/push", "/v1/a_b-c/1")) assertTrue(ok, CloudConfig.validPath(ok))
        for (bad in listOf(null, "", "/v2/x", "/v1/", "/v1/../admin", "/v1/a?x=1", "/v1/a#b", "/v1/a\\b", "//evil.example/v1/x",
            "/v1//x", "/v1/a.b", "https://evil.example/v1/x", "/v1/" + "a".repeat(181), "/v1/a b", "/v1/%2e%2e")) {
            assertFalse("$bad", CloudConfig.validPath(bad))
        }
        assertTrue(CloudConfig.safeHeader("req-123_ABC"))
        for (bad in listOf(null, "", "a b", "a\r\nX-Evil: 1", "é", "x".repeat(161))) assertFalse("$bad", CloudConfig.safeHeader(bad))
    }

    @Test fun cookieJarIsHostOnlySecureAwareAndHonoursLogout() {
        var now = 1_000_000L
        val jar = CookieJar { now }
        jar.store("api.example", listOf(
            "pri_cloud_session=s1; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax",
            "pri_csrf=c1; Path=/; Max-Age=3600; Secure; SameSite=Lax",
            "other=x; Domain=evil.example; Path=/; Max-Age=60",
            "bad name=x; Max-Age=60",
        ))
        assertEquals("pri_cloud_session=s1; pri_csrf=c1", jar.header("api.example", "/v1/account/me", https = true))
        assertNull("Secure cookies never go over cleartext", jar.header("api.example", "/v1/account/me", https = false))
        assertNull("another host gets nothing", jar.header("evil.example", "/v1/x", https = true))
        assertEquals("c1", jar.value("api.example", "pri_csrf"))

        // Survives a restart through serialize/load (persistent cookies only).
        val restored = CookieJar { now }.apply { load(jar.serialize()) }
        assertEquals("pri_cloud_session=s1; pri_csrf=c1", restored.header("api.example", "/v1/x", https = true))

        // The server's logout response (an Expires in 1970) removes both cookies.
        restored.store("api.example", listOf(
            "pri_cloud_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
            "pri_csrf=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax",
        ))
        assertTrue(restored.isEmpty())
        // Max-Age=0 also deletes; and cookies expire on time.
        jar.store("api.example", listOf("pri_csrf=; Max-Age=0"))
        assertNull(jar.value("api.example", "pri_csrf"))
        now += 3_601_000
        assertNull("expired cookies are never sent", jar.header("api.example", "/v1/x", https = true))
        // A corrupt or foreign persisted jar loads as empty.
        assertTrue(CookieJar().apply { load("{nope") }.isEmpty())
        assertTrue(CookieJar().apply { load("""{"v":9,"cookies":[]}""") }.isEmpty())
    }

    @Test fun fileRulesSanitiseNamesAndMapAcceptTypes() {
        assertEquals("pri-backup.json", FileRules.safeFilename("pri-backup.json"))
        assertEquals("-etc-passwd", FileRules.safeFilename("../etc/passwd").let { it })
        assertEquals("pri-export", FileRules.safeFilename("..."))
        assertEquals("a-b-c.json", FileRules.safeFilename("a/b\\c.json"))
        assertEquals(120, FileRules.safeFilename("x".repeat(500)).length)
        assertEquals("application/json", FileRules.safeMime("application/json"))
        assertEquals("application/octet-stream", FileRules.safeMime("text/html; charset=utf-8\r\nX: y"))
        assertArrayEquals(arrayOf("application/json", "application/octet-stream", "text/plain"), FileRules.pickerMimeTypes(arrayOf(".json,application/json")))
        assertArrayEquals(arrayOf("image/*", "application/pdf"), FileRules.pickerMimeTypes(arrayOf("image/*", "application/pdf")))
        assertArrayEquals(arrayOf("text/csv", "text/plain"), FileRules.pickerMimeTypes(arrayOf(".csv,.txt,text/csv,text/plain")))
        assertArrayEquals(arrayOf("*/*"), FileRules.pickerMimeTypes(arrayOf("")))
        assertTrue(FileRules.acceptsImages(arrayOf("image/*", "application/pdf")))
        assertFalse(FileRules.acceptsImages(arrayOf("application/json")))
    }

    // ── the real transport against a local server ─────────────────────────────

    /** A deliberately tiny HTTP/1.1 server (one request per connection). */
    private lateinit var server: ServerSocket
    private val seen = CopyOnWriteArrayList<Map<String, String?>>()
    private val gate = CountDownLatch(1)
    private val pool = java.util.concurrent.Executors.newCachedThreadPool()

    private fun respond(socket: Socket, status: Int, body: String, headers: List<Pair<String, String>> = emptyList()) {
        val bytes = body.toByteArray()
        val head = StringBuilder("HTTP/1.1 $status X\r\nContent-Type: application/json\r\nX-Pri-Request-Id: srv-1\r\nConnection: close\r\nContent-Length: ${bytes.size}\r\n")
        for ((k, v) in headers) head.append("$k: $v\r\n")
        head.append("\r\n")
        socket.getOutputStream().apply { write(head.toString().toByteArray()); write(bytes); flush() }
    }

    private fun handle(socket: Socket) = socket.use {
        val input = socket.getInputStream().buffered()
        fun line(): String { val b = StringBuilder(); while (true) { val c = input.read(); if (c < 0 || c == '\n'.code) break; if (c != '\r'.code) b.append(c.toChar()) }; return b.toString() }
        val (method, target) = line().split(' ').let { it[0] to it[1] }
        val headers = mutableMapOf<String, String>()
        while (true) { val l = line(); if (l.isEmpty()) break; val i = l.indexOf(':'); headers[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim() }
        val length = headers["content-length"]?.toInt() ?: 0
        val body = ByteArray(length).also { var r = 0; while (r < length) { val n = input.read(it, r, length - r); if (n < 0) break; r += n } }
        seen += mapOf(
            "path" to target, "method" to method, "client" to headers["x-pri-client"], "origin" to headers["origin"],
            "fetchSite" to headers["sec-fetch-site"], "cookie" to headers["cookie"], "csrf" to headers["x-pri-csrf"],
            "idem" to headers["idempotency-key"], "rid" to headers["x-pri-request-id"], "body" to String(body),
        )
        when (target) {
            "/v1/account/login" -> respond(socket, 200, """{"account":{"id":"a1"}}""", listOf(
                "Set-Cookie" to "pri_cloud_session=sess; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax",
                "Set-Cookie" to "pri_csrf=tok; Path=/; Max-Age=3600; SameSite=Lax"))
            "/v1/account/logout" -> respond(socket, 200, "{}", listOf(
                "Set-Cookie" to "pri_cloud_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
                "Set-Cookie" to "pri_csrf=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"))
            "/v1/redirect" -> respond(socket, 302, "", listOf("Location" to "http://127.0.0.1:${server.localPort}/steal"))
            "/v1/huge" -> respond(socket, 200, "x".repeat(CloudConfig.MAX_RESPONSE_BYTES + 10))
            "/v1/slow" -> { gate.await(10, TimeUnit.SECONDS); try { respond(socket, 200, "{}") } catch (_: Exception) {} }
            "/v1/missing" -> respond(socket, 404, """{"error":{"code":"NOT_FOUND"}}""")
            else -> respond(socket, 200, """{"ok":true}""")
        }
    }

    @Before fun startServer() {
        server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        pool.execute { while (!server.isClosed) { val s = try { server.accept() } catch (_: Exception) { break }; pool.execute { try { handle(s) } catch (_: Exception) {} } } }
    }

    @After fun stopServer() { gate.countDown(); server.close(); pool.shutdownNow() }

    private fun origin() = "http://127.0.0.1:${server.localPort}"

    private fun call(cloud: NativeCloud, id: String, payload: String): NativeCloud.Outcome {
        var out: NativeCloud.Outcome? = null
        val latch = CountDownLatch(1)
        cloud.request(id, JSONObject(payload)) { out = it; latch.countDown() }
        assertTrue("answered", latch.await(10, TimeUnit.SECONDS))
        return out!!
    }

    @Test fun transportSendsTheNativeIdentityKeepsTheSessionAndCopiesCsrf() {
        val jar = CookieJar()
        val persisted = mutableListOf<String>()
        val cloud = NativeCloud(origin(), jar, persist = { persisted += it })

        val login = call(cloud, "1", """{"path":"/v1/account/login","method":"POST","body":"{\"email\":\"a@b.c\"}","idempotencyKey":"idem-1","requestId":"rid-1"}""")
        assertEquals(NativeCloud.Outcome.Response(200, """{"account":{"id":"a1"}}""", "srv-1"), login)
        val first = seen.last()
        assertEquals("android-native-v1", first["client"])
        assertNull("no Origin: the server's narrow native rule", first["origin"])
        assertNull("no Fetch Metadata", first["fetchSite"])
        assertNull("no CSRF before the server issued one", first["csrf"])
        assertEquals("idem-1", first["idem"]); assertEquals("rid-1", first["rid"])
        assertEquals("""{"email":"a@b.c"}""", first["body"])
        assertTrue("the session was persisted", persisted.last().contains("pri_cloud_session"))

        call(cloud, "2", """{"path":"/v1/account/me","method":"GET"}""")
        assertEquals(setOf("pri_cloud_session=sess", "pri_csrf=tok"), seen.last()["cookie"]!!.split("; ").toSet())
        assertNull("GET carries no CSRF header", seen.last()["csrf"])

        call(cloud, "3", """{"path":"/v1/sync/push","method":"POST","body":"{}"}""")
        assertEquals("every mutation carries the server-issued CSRF token", "tok", seen.last()["csrf"])

        val missing = call(cloud, "4", """{"path":"/v1/missing","method":"GET"}""")
        assertEquals("HTTP errors are answers, handled by cloudTransport", 404, (missing as NativeCloud.Outcome.Response).status)

        call(cloud, "5", """{"path":"/v1/account/logout","method":"POST","body":"{}"}""")
        assertTrue("logout cleared the jar", jar.isEmpty())
        assertFalse(persisted.last().contains("pri_cloud_session"))
        call(cloud, "6", """{"path":"/v1/account/me","method":"GET"}""")
        assertNull("nothing is sent after logout", seen.last()["cookie"])
        cloud.shutdown()
    }

    @Test fun transportRefusesBadRequestsRedirectsOversizeAndHonoursCancel() {
        val cloud = NativeCloud(origin(), CookieJar(), persist = {})
        for (bad in listOf("""{"path":"/v1/../x","method":"GET"}""", """{"path":"/v1/x","method":"PUT"}""",
            """{"path":"https://evil.example/v1/x","method":"GET"}""", """{"path":"/v1/x","method":"GET","body":"{}"}""",
            """{"path":"/v1/x","method":"POST","body":{"not":"text"}}""")) {
            val out = call(cloud, "b", bad)
            assertEquals(bad, "BAD_REQUEST", (out as NativeCloud.Outcome.Failure).code)
        }
        val before = seen.size
        val big = call(cloud, "big", JSONObject().put("path", "/v1/x").put("method", "POST").put("body", "x".repeat(CloudConfig.MAX_REQUEST_BYTES + 1)).toString())
        assertEquals("TOO_LARGE", (big as NativeCloud.Outcome.Failure).code)
        assertEquals("an oversize request never leaves the device", before, seen.size)

        val redirect = call(cloud, "r", """{"path":"/v1/redirect","method":"GET"}""")
        assertEquals("a redirect is returned, never followed", 302, (redirect as NativeCloud.Outcome.Response).status)
        assertTrue(seen.none { it["path"] == "/steal" })

        val huge = call(cloud, "h", """{"path":"/v1/huge","method":"GET"}""")
        assertEquals("CLOUD_RESPONSE_TOO_LARGE", (huge as NativeCloud.Outcome.Failure).providerCode)

        var answered = false
        cloud.request("slow", JSONObject("""{"path":"/v1/slow","method":"GET"}""")) { answered = true }
        Thread.sleep(300)
        assertEquals(1, cloud.inFlight)
        cloud.cancel("slow")
        gate.countDown()
        Thread.sleep(500)
        assertFalse("a cancelled request never answers", answered)
        assertEquals(0, cloud.inFlight)
        cloud.shutdown()
    }

    @Test fun anUnconfiguredBuildFailsClosedWithoutTouchingTheNetwork() {
        val cloud = NativeCloud(null, CookieJar(), persist = {})
        val out = call(cloud, "x", """{"path":"/v1/health","method":"GET"}""")
        assertEquals(NativeCloud.Outcome.Failure("UNAVAILABLE", "CLOUD_DISABLED",
            "The Pri cloud is not configured in this build. Offline learning remains available."), out)
        assertFalse(cloud.configured)
        cloud.shutdown()
    }

    @Test fun theDescriptorAdvertisesCloudAndShareOverTheBridge() {
        val d = com.prilearning.app.bridge.HostDescriptor.json(
            com.prilearning.app.bridge.HostDescriptor.Shell("4.0", "7", "com.prilearning.app"), null, cloudConfigured = true)
        val caps = d.getJSONObject("capabilities")
        assertEquals("bridge", caps.getJSONObject("cloud").getString("transport"))
        assertTrue(caps.getJSONObject("cloud").getBoolean("configured"))
        assertTrue(caps.getJSONObject("share").getBoolean("binary") && caps.getJSONObject("share").getBoolean("print"))
        assertFalse("no billing until CP-08", caps.has("billing"))
        assertFalse("no ink: Android writes on the shared web canvas", caps.has("ink"))
        val off = com.prilearning.app.bridge.HostDescriptor.json(
            com.prilearning.app.bridge.HostDescriptor.Shell("4.0", "7", "com.prilearning.app"), null)
        assertFalse(off.getJSONObject("capabilities").getJSONObject("cloud").getBoolean("configured"))
        val fail = JSONObject(com.prilearning.app.bridge.Envelope.fail("i", "UNAVAILABLE", "m", "CLOUD_NETWORK_ERROR"))
        assertEquals("CLOUD_NETWORK_ERROR", fail.getJSONObject("error").getJSONObject("detail").getString("providerCode"))
    }
}
