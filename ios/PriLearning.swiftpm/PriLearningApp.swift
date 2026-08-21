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
        // is known, then runs deterministic alignment, personalization,
        // geometry, provenance, selective-trust, expert-fusion, online-feature,
        // structural-tree/count/refinement and native input-routing checks. Off
        // unless explicitly requested by the simulator validation harness.
        if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
            // Do not run the UIKit/PencilKit routing check concurrently with
            // SwiftUI scene construction. That race can terminate the simulator
            // process before the recognition suite emits its first diagnostic.
            // Run the non-UI evidence suite first, then schedule the one
            // MainActor-only check after the application has finished starting.
            NSLog("PRIINK self-check scheduled")
            DispatchQueue.global(qos: .userInitiated).async {
                NSLog("PRIINK self-check worker started")
                InkSelfCheck.run()
                InkAlignmentSelfCheck.run()
                InkPersonalizationSelfCheck.run()
                InkGeometrySelfCheck.run()
                InkFrontierSelfCheck.run()
                InkAcceptanceSelfCheck.run()
                InkExpertFusionSelfCheck.run()
                InkFeatureTensorSelfCheck.run()
                InkStructuralIntelligenceSelfCheck.run()
                DispatchQueue.main.async {
                    InkInputRoutingSelfCheck.run()
                }
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
