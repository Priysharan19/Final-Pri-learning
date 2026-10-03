// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one-time sign-in code from SMS (Android parity with iOS)
//
// On iPad/iPhone the keyboard offers the code from Messages because the first
// code box carries autocomplete="one-time-code". Android Chrome has WebOTP for
// the same job, but an Android WebView does not expose OTPCredential. This
// fills that gap with Google's SMS User Consent API:
//   · no SMS permission: the system shows the person ONE message and asks
//     whether Pri may read it; nothing is read without that tap;
//   · only while the page is waiting for a code (otp.smsCode), at most 5 min;
//   · only the digits leave this file — never the message, sender or number;
//   · the code is a suggestion: the page fills the boxes and the server still
//     verifies it. Nothing here signs anyone in.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app.auth

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsCode(private val activity: ComponentActivity) {
    sealed class Result {
        data class Code(val code: String) : Result()
        data class Failed(val code: String, val message: String) : Result()
    }

    companion object {
        const val LENGTH = 6
        private val CODE = Regex("(?<![0-9])[0-9]{$LENGTH}(?![0-9])")

        /** The first standalone six-digit run in [message], or null. Pure, unit-tested. */
        fun extract(message: String?): String? = message?.let { CODE.find(it)?.value }
    }

    private var pending: ((Result) -> Unit)? = null
    private var receiver: BroadcastReceiver? = null

    // Registered in the constructor, which MainActivity runs in onCreate (before STARTED).
    private val consent = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val message = if (r.resultCode == Activity.RESULT_OK) r.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE) else null
        val code = extract(message)
        finish(if (code != null) Result.Code(code)
            else Result.Failed(if (r.resultCode == Activity.RESULT_OK) "PROVIDER_ERROR" else "USER_CANCELLED", "No code was taken from the message."))
    }

    /** Waits for one SMS (the system asks the person first). A new request replaces an older one. */
    fun request(done: (Result) -> Unit) {
        finish(Result.Failed("CANCELLED", "A newer code request replaced this one."))
        pending = done
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
                val extras = intent.extras ?: return
                @Suppress("DEPRECATION")
                val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
                when (status.statusCode) {
                    CommonStatusCodes.SUCCESS -> {
                        val ask: Intent? = if (Build.VERSION.SDK_INT >= 33)
                            extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT, Intent::class.java)
                        else @Suppress("DEPRECATION") extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT)
                        // Only Play services' own consent screen may be launched from this
                        // extra, and it may not carry URI grants (intent redirection guard).
                        val target = ask?.resolveActivity(activity.packageManager)?.packageName
                        val grants = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        if (ask == null || target != "com.google.android.gms" || (ask.flags and grants) != 0) {
                            finish(Result.Failed("UNAVAILABLE", "The message could not be offered.")); return
                        }
                        try { consent.launch(ask) } catch (_: Exception) { finish(Result.Failed("UNAVAILABLE", "The message could not be offered.")) }
                    }
                    CommonStatusCodes.TIMEOUT -> finish(Result.Failed("TIMEOUT", "No message arrived."))
                    else -> finish(Result.Failed("UNAVAILABLE", "Reading the message is not available."))
                }
            }
        }
        receiver = r
        try {
            // Exported with the Play services sender permission: only Play services can deliver it.
            ContextCompat.registerReceiver(activity, r, IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
                SmsRetriever.SEND_PERMISSION, null, ContextCompat.RECEIVER_EXPORTED)
            SmsRetriever.getClient(activity).startSmsUserConsent(null)
                .addOnFailureListener { finish(Result.Failed("UNAVAILABLE", "Reading the message is not available on this device.")) }
        } catch (_: Exception) {
            finish(Result.Failed("UNAVAILABLE", "Reading the message is not available on this device."))
        }
    }

    /** The page stopped waiting (code typed, sheet closed, page changed). */
    fun cancel() = finish(Result.Failed("CANCELLED", "The page stopped waiting for a code."))

    private fun finish(result: Result) {
        receiver?.let { try { activity.unregisterReceiver(it) } catch (_: Exception) {} }
        receiver = null
        val done = pending
        pending = null
        done?.invoke(result)
    }
}
