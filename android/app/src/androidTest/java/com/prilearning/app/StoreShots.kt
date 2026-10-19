// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Play store screenshots from the real journey (opt-in)
//
// Only when the runner passes -e priShots 1 (android/scripts/run-instrumented.sh
// with PRI_STORE_SHOTS=1). The journey tests call shot() at the screens the
// listing shows. The PNGs are written to the app's external files dir and
// pulled into docs/release/store/play/screenshots/<device>/. EMULATOR captures
// against the local fixture server and a synthetic account: never a physical
// device and never a real student.
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

import android.graphics.Bitmap
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File

object StoreShots {
    private val enabled get() = InstrumentationRegistry.getArguments().getString("priShots", "") == "1"

    fun shot(name: String) {
        if (!enabled) return
        Thread.sleep(800) // let transitions and fonts settle
        val i = InstrumentationRegistry.getInstrumentation()
        val shot = i.uiAutomation.takeScreenshot() ?: return
        val dir = File(i.targetContext.getExternalFilesDir(null), "store-shots").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
