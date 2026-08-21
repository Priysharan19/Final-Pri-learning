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
        // Scores the native reading pipeline against expressions whose answer
        // is known, then runs deterministic trace-alignment, personalization,
        // geometry and frontier-representation checks. Off unless asked for.
        if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
            DispatchQueue.global(qos: .userInitiated).async {
                InkSelfCheck.run()
                InkAlignmentSelfCheck.run()
                InkPersonalizationSelfCheck.run()
                InkGeometrySelfCheck.run()
                InkFrontierSelfCheck.run()
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
