// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Android file exchange (CP-07)
//
//   · share.file  — writes the file into the app cache and hands it to the
//                   system share sheet through a FileProvider content:// URI
//                   (read permission granted to the chosen app only);
//   · share.print — the system print dialog for the current page (window.print()
//                   does nothing inside an Android WebView);
//   · <input type=file> — WebChromeClient.onShowFileChooser opens the system
//                   document picker (Storage Access Framework, no storage
//                   permission), plus the camera when the input accepts images.
// Files are opaque here: the page validates whatever it reads, and no file
// content ever reaches Kotlin learning logic (there is none).
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.io

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.net.Uri
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

class FileExchange(private val activity: ComponentActivity) {
    sealed class Result {
        data class Done(val completed: Boolean) : Result()
        data class Failed(val code: String, val message: String) : Result()
    }

    private val authority = "${activity.packageName}.files"
    private var shareDone: ((Result) -> Unit)? = null
    private var chooserCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private val cameraGrants = mutableListOf<String>()
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var activePrint: PrintSession? = null
    private var deferredPrintDestroy: WebView? = null

    /**
     * WebView's print adapter continues to use native WebView state until
     * PrintDocumentAdapter.onFinish(). Destroying the WebView while the system
     * print UI is still rendering can abort the app in Chromium/CheckJNI.
     *
     * Wrap the platform adapter so activity teardown can defer WebView.destroy()
     * until the printing contract's final callback.
     */
    private inner class PrintSession(private val delegate: PrintDocumentAdapter) : PrintDocumentAdapter() {
        override fun onStart() = delegate.onStart()

        override fun onLayout(
            oldAttributes: PrintAttributes?,
            newAttributes: PrintAttributes,
            cancellationSignal: CancellationSignal?,
            callback: LayoutResultCallback,
            extras: Bundle?,
        ) = delegate.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras)

        override fun onWrite(
            pages: Array<out PageRange>,
            destination: ParcelFileDescriptor,
            cancellationSignal: CancellationSignal,
            callback: WriteResultCallback,
        ) = delegate.onWrite(pages, destination, cancellationSignal, callback)

        override fun onFinish() {
            try {
                delegate.onFinish()
            } finally {
                if (activePrint === this) activePrint = null
                deferredPrintDestroy?.let { view ->
                    deferredPrintDestroy = null
                    view.destroy()
                }
            }
        }
    }

    init {
        // Exports and photos of student work do not linger: anything older than
        // an hour from a previous session is removed.
        io.execute { for (dir in listOf("share", "capture")) pruneOlderThan(File(activity.cacheDir, dir), 60 * 60_000L) }
    }

    private fun pruneOlderThan(dir: File, ageMs: Long) {
        val cutoff = System.currentTimeMillis() - ageMs
        dir.listFiles()?.forEach { if (it.lastModified() < cutoff) it.deleteRecursively() }
    }

    // Registered in the constructor, which MainActivity runs in onCreate (before STARTED).
    private val shareLauncher = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r: ActivityResult ->
        val done = shareDone
        shareDone = null
        // Android's share sheet usually reports "cancelled" even after a share;
        // product code does not depend on `completed` (lib/files.js).
        done?.invoke(Result.Done(r.resultCode == Activity.RESULT_OK))
    }

    private val chooserLauncher = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r: ActivityResult ->
        val callback = chooserCallback
        chooserCallback = null
        val camera = cameraUri
        cameraUri = null
        revokeCameraGrants(camera)
        if (callback == null) return@registerForActivityResult
        if (r.resultCode != Activity.RESULT_OK) { callback.onReceiveValue(null); return@registerForActivityResult }
        val data = r.data
        val picked = buildList {
            data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) add(clip.getItemAt(i).uri) }
            if (isEmpty()) data?.data?.let { add(it) }
        }
        val result = when {
            picked.isNotEmpty() -> picked.toTypedArray()
            camera != null && cameraFileHasContent() -> arrayOf(camera)
            else -> null
        }
        callback.onReceiveValue(result)
    }

    fun share(payload: org.json.JSONObject, done: (Result) -> Unit) {
        if (shareDone != null) return done(Result.Failed("UNAVAILABLE", "A share sheet is already open."))
        shareDone = done // reserved now: one sheet at a time, even while the file is being written
        val name = FileRules.safeFilename(payload.optString("filename", ""))
        val mime = FileRules.safeMime(payload.optString("mimeType", ""))
        // Decoding and writing up to 6 MB happens off the UI thread.
        io.execute {
            val prepared: Any = try { prepare(payload, name) } catch (e: Exception) { Result.Failed("PROVIDER_ERROR", "Could not prepare the file.") }
            main.post {
                if (prepared is Result.Failed) { shareDone = null; done(prepared); return@post }
                launchShare(prepared as Uri, name, mime, done)
            }
        }
    }

    /** Writes the file into its own folder under cache/share; returns its content:// URI or a failure. */
    private fun prepare(payload: org.json.JSONObject, name: String): Any {
        val bytes: ByteArray = when {
            payload.has("text") -> payload.optString("text").toByteArray(Charsets.UTF_8)
            payload.has("base64") -> try { Base64.decode(payload.optString("base64"), Base64.DEFAULT) }
                catch (_: IllegalArgumentException) { return Result.Failed("BAD_REQUEST", "The file content is not valid base64.") }
            else -> return Result.Failed("BAD_REQUEST", "share.file needs text or base64 content.")
        }
        if (bytes.size > FileRules.MAX_SHARE_BYTES) return Result.Failed("TOO_LARGE", "That file is too large to share.")
        val root = File(activity.cacheDir, "share")
        pruneOlderThan(root, 60 * 60_000L) // never the folder an app may still be reading
        val dir = File(root, UUID.randomUUID().toString()).apply { mkdirs() }
        val file = File(dir, name)
        file.writeBytes(bytes)
        return FileProvider.getUriForFile(activity, authority, file)
    }

    private fun launchShare(uri: Uri, name: String, mime: String, done: (Result) -> Unit) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TITLE, name)
            clipData = ClipData.newRawUri(name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            shareLauncher.launch(Intent.createChooser(send, name))
        } catch (_: Exception) {
            shareDone = null
            done(Result.Failed("UNAVAILABLE", "No app can receive this file."))
        }
    }

    fun print(webView: WebView, done: (Result) -> Unit) {
        val manager = activity.getSystemService(PrintManager::class.java)
            ?: return done(Result.Failed("UNAVAILABLE", "Printing is not available on this device."))
        if (activePrint != null) return done(Result.Failed("UNAVAILABLE", "A print dialog is already open."))
        try {
            val job = "Pri Learning"
            val session = PrintSession(webView.createPrintDocumentAdapter(job))
            activePrint = session
            manager.print(job, session, PrintAttributes.Builder().build())
            // The system print dialog is now up; Android reports the job's fate
            // to the print spooler, not to the app.
            done(Result.Done(true))
        } catch (_: Exception) {
            activePrint = null
            done(Result.Failed("PROVIDER_ERROR", "Could not open the print dialog."))
        }
    }

    /**
     * Called after MainActivity has detached its WebView. Returns true when
     * destruction is intentionally deferred until the active print adapter's
     * onFinish(), which Android guarantees is the final adapter callback.
     */
    fun deferWebViewDestroyIfPrinting(webView: WebView): Boolean {
        if (activePrint == null) return false
        deferredPrintDestroy = webView
        return true
    }

    /** WebChromeClient.onShowFileChooser. Always answers the callback exactly once. */
    fun showFileChooser(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        chooserCallback?.onReceiveValue(null) // a second picker replaces a stale one
        chooserCallback = callback
        val types = FileRules.pickerMimeTypes(params.acceptTypes)
        val open = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (types.size == 1) types[0] else "*/*"
            if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
        }
        val extras = mutableListOf<Intent>()
        if (FileRules.acceptsImages(types)) cameraIntent()?.let { extras += it }
        val chooser = Intent.createChooser(open, null).apply {
            if (extras.isNotEmpty()) putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toTypedArray())
        }
        return try {
            chooserLauncher.launch(chooser)
            true
        } catch (_: Exception) {
            chooserCallback = null
            revokeCameraGrants(cameraUri)
            cameraUri = null
            callback.onReceiveValue(null)
            true
        }
    }

    fun dispose() { io.shutdown() }

    private fun cameraFile() = File(File(activity.cacheDir, "capture").apply { mkdirs() }, "photo.jpg")
    private fun cameraFileHasContent() = cameraFile().let { it.isFile && it.length() > 0 }

    private fun cameraIntent(): Intent? {
        val capture = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        @Suppress("DEPRECATION")
        val cameras = activity.packageManager.queryIntentActivities(capture, PackageManager.MATCH_DEFAULT_ONLY)
        if (cameras.isEmpty()) return null
        val file = cameraFile().apply { delete() }
        val uri = FileProvider.getUriForFile(activity, authority, file)
        cameraUri = uri
        // A capture intent offered inside a chooser may not carry its grant
        // flags through, so each camera app is granted write access to this one
        // URI explicitly, and the grants are revoked when the picker returns.
        val flags = Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION
        for (info in cameras) {
            val pkg = info.activityInfo.packageName
            activity.grantUriPermission(pkg, uri, flags)
            cameraGrants += pkg
        }
        return capture.apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            clipData = ClipData.newRawUri("photo", uri)
            addFlags(flags)
        }
    }

    private fun revokeCameraGrants(uri: Uri?) {
        if (uri == null) return
        activity.revokeUriPermission(uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        cameraGrants.clear()
    }
}
