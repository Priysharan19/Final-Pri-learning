// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native iPad app entry
// SwiftUI shell around the Pri Learning engine. The whole product — the maths
// engine, marker, handwriting recogniser, adaptive model and IndexedDB store —
// ships inside this app bundle and runs in an embedded, offline web runtime.
// The shell adds the native layer: full-screen app, iOS share sheet for
// exports, camera access for photo attach, and sandboxed persistent storage.
// ─────────────────────────────────────────────────────────────────────────────
import SwiftUI

@main
struct PriLearningApp: App {
    init() {
        if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
            // Structural geometry must pass before any downstream recogniser is
            // allowed to produce a score. If an exponent/limit becomes another
            // line, or if real Pencil ink disappears from the visible reading,
            // OCR accuracy is irrelevant because the maths was already damaged.
            InkSegmentationRegression.assertProductionInvariants()
            DispatchQueue.global(qos: .userInitiated).async {
                InkCompletenessRecovery.assertNoDisappearedInkInvariant()
                InkSelfCheck.run()
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        ZStack {
            Color(red: 14 / 255, green: 17 / 255, blue: 23 / 255)
                .ignoresSafeArea()
            WebShell()
        }
        .preferredColorScheme(.dark)
        .persistentSystemOverlays(.hidden)
    }
}
