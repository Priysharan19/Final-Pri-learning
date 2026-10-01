// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Keystore-encrypted cookie persistence (CP-07)
//
// The cloud cookie jar is written to no-backup app storage encrypted with an
// AES-256-GCM key that lives in the Android Keystore and never leaves it. A
// file that cannot be decrypted (key lost, file tampered or restored from
// elsewhere) is deleted and the device is simply signed out; offline learning
// is unaffected. Backup is disabled for the whole app (AndroidManifest).
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.cloud

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.io.File
import android.security.keystore.KeyPermanentlyInvalidatedException
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureStore(context: Context, name: String = "pri-cloud-jar.bin") {
    private companion object {
        const val TAG = "PriSecureStore"
        const val KEY_ALIAS = "pri.cloud.cookie-jar.v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
        const val MAX_FILE = 256 * 1024
        // One lock for the process: an activity recreated while the previous
        // one's requests are still finishing must not interleave writes.
        private val lock = Any()
    }

    private class Corrupt : Exception()

    private val file = File(context.noBackupFilesDir, name)

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build())
        return gen.generateKey()
    }

    fun read(): String? = synchronized(lock) {
        if (!file.isFile) return null
        try {
            val bytes = file.readBytes()
            if (bytes.size !in (IV_BYTES + 16)..MAX_FILE) throw Corrupt()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, bytes, 0, IV_BYTES))
            String(cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES), Charsets.UTF_8)
        } catch (e: Exception) {
            // Only a file that can never be read again is deleted (tampered,
            // truncated, or its key is gone). A transient Keystore failure —
            // "busy" right after boot, OEM flakiness — keeps the file: this
            // process runs signed out and the next launch reads it normally.
            val permanent = e is Corrupt || e is AEADBadTagException || e is UnrecoverableKeyException ||
                e is KeyPermanentlyInvalidatedException
            Log.w(TAG, "cookie jar unreadable (${e.javaClass.simpleName}); ${if (permanent) "signing this device out" else "keeping it for the next launch"}")
            if (permanent) file.delete()
            null
        }
    }

    fun write(text: String) = synchronized(lock) {
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val sealed = cipher.iv + cipher.doFinal(text.toByteArray(Charsets.UTF_8))
            val tmp = File(file.parentFile, "${file.name}.${System.nanoTime()}.tmp")
            tmp.writeBytes(sealed)
            if (!tmp.renameTo(file)) { file.delete(); tmp.renameTo(file) }
        } catch (e: Exception) {
            Log.w(TAG, "could not persist the cookie jar (${e.javaClass.simpleName})")
        }
    }

    fun clear() = synchronized(lock) { file.delete() }

    /** For tests: the raw bytes on disk (to prove they are not plaintext). */
    fun rawForTest(): ByteArray? = synchronized(lock) { if (file.isFile) file.readBytes() else null }
}
