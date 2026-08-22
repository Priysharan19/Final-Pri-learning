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
            DispatchQueue.global(qos: .userInitiated).async { InkSelfCheck.run() }
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
            // Keep the shell background dark so there is no white launch/resize
            // flash while the bundled web app paints. Do not force the entire
            // UIKit/SwiftUI hierarchy into dark appearance: the product owns
            // its own theme and native controls should remain compatible with
            // the user's system accessibility/appearance settings.
            Color(red: 14 / 255, green: 17 / 255, blue: 23 / 255)
                .ignoresSafeArea()
            WebShell()
        }
        .persistentSystemOverlays(.hidden)
    }
}
