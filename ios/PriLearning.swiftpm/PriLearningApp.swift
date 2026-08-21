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
        // is known, and reports it to the system log. Off unless asked for.
        if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
            DispatchQueue.global(qos: .userInitiated).async {
                InkGeometrySelfCheck.run()
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
            // The app's page background, extended under the status bar and
            // home indicator so the shell never shows a white flash.
            Color(red: 14 / 255, green: 17 / 255, blue: 23 / 255)
                .ignoresSafeArea()
            WebShell()
        }
        .preferredColorScheme(.dark)
        .persistentSystemOverlays(.hidden)
    }
}
