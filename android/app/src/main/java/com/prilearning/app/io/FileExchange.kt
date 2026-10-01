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
import android.net.Uri
import android.print.PrintAttributes
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

class FileExchange(private val activity: ComponentActivity) {
    sealed class Result {
        data class Done(val completed: Boolean) : Result()
        data class Failed(val code: String, val message: String) : Result()
    }

    private val authority = "${activity.packageName}.files"
    private var shareDone: ((Result) -> Unit)? = null
    private var chooserCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null

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
        val name = FileRules.safeFilename(payload.optString("filename", ""))
        val mime = FileRules.safeMime(payload.optString("mimeType", ""))
        val bytes: ByteArray = when {
            payload.has("text") -> payload.optString("text").toByteArray(Charsets.UTF_8)
            payload.has("base64") -> try { Base64.decode(payload.optString("base64"), Base64.DEFAULT) }
                catch (_: IllegalArgumentException) { return done(Result.Failed("BAD_REQUEST", "The file content is not valid base64.")) }
            else -> return done(Result.Failed("BAD_REQUEST", "share.file needs text or base64 content."))
        }
        if (bytes.size > FileRules.MAX_SHARE_BYTES) return done(Result.Failed("TOO_LARGE", "That file is too large to share."))
        val dir = File(activity.cacheDir, "share").apply { deleteRecursively(); mkdirs() }
        val file = File(dir, name)
        try { file.writeBytes(bytes) } catch (_: Exception) { return done(Result.Failed("PROVIDER_ERROR", "Could not prepare the file.")) }
        val uri = FileProvider.getUriForFile(activity, authority, file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TITLE, name)
            clipData = ClipData.newRawUri(name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        shareDone = done
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
        try {
            val job = "Pri Learning"
            manager.print(job, webView.createPrintDocumentAdapter(job), PrintAttributes.Builder().build())
            // The system print dialog is now up; Android reports the job's fate
            // to the print spooler, not to the app.
            done(Result.Done(true))
        } catch (_: Exception) {
            done(Result.Failed("PROVIDER_ERROR", "Could not open the print dialog."))
        }
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
            cameraUri = null
            callback.onReceiveValue(null)
            true
        }
    }

    private fun cameraFile() = File(File(activity.cacheDir, "capture").apply { mkdirs() }, "photo.jpg")
    private fun cameraFileHasContent() = cameraFile().let { it.isFile && it.length() > 0 }

    private fun cameraIntent(): Intent? {
        val capture = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (capture.resolveActivity(activity.packageManager) == null) return null
        val file = cameraFile().apply { delete() }
        val uri = FileProvider.getUriForFile(activity, authority, file)
        cameraUri = uri
        return capture.apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            clipData = ClipData.newRawUri("photo", uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}
