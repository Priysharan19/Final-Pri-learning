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
    /// The edges the web page extends under: all of them on iPhone, none on iPad.
    static var edgeToEdge: Edge.Set {
        UIDevice.current.userInterfaceIdiom == .phone ? .all : []
    }

    /// The tone of the page's paper, reported by the web shell from the page's
    /// theme-color (StatusBarAppearance.swift). Nil until the page says.
    @State private var pageTone: PageTone?

    /// The status bar draws on the page only where the page runs under it
    /// (iPhone): there its ink follows Pri's paper, not the device. On iPad
    /// it keeps the device's appearance over the shell's dark backdrop. The web
    /// view itself keeps the device's appearance (WebShell pins it), so a
    /// profile that follows the device still reads the device.
    static func statusBarScheme(for tone: PageTone?, edgeToEdge: Edge.Set = edgeToEdge) -> ColorScheme? {
        guard !edgeToEdge.isEmpty, let tone else { return nil }
        return tone == .dark ? .dark : .light
    }

    var body: some View {
        ZStack {
            Color(red: 14 / 255, green: 17 / 255, blue: 23 / 255)
                .ignoresSafeArea()
            // On iPhone the page runs edge to edge, under the status bar and
            // the home indicator, so the paper (or night) the student chose is
            // what fills those strips instead of this near-black backdrop. The
            // page already has viewport-fit=cover and pads its bars with
            // env(safe-area-inset-*), which are only non-zero when the web view
            // reaches the edges. Only the container region is ignored, so the
            // keyboard still resizes the web view. iPad keeps its current frame.
            WebShell()
                .ignoresSafeArea(.container, edges: Self.edgeToEdge)
        }
        .persistentSystemOverlays(.hidden)
        .preferredColorScheme(Self.statusBarScheme(for: pageTone))
        .onReceive(NotificationCenter.default.publisher(for: .priPageTone)) { note in
            pageTone = (note.object as? String).flatMap(PageTone.init(rawValue:))
        }
        // Universal Links (account actions) reach the shell here. They need
        // the Associated Domains entitlement + apple-app-site-association on
        // the production origin, which are owner/Apple-account actions; until
        // then this path is dormant, and links open the web app in Safari.
        .onOpenURL { url in
            NotificationCenter.default.post(name: .priOpenURL, object: url)
        }
    }
}

extension Notification.Name {
    static let priOpenURL = Notification.Name("pri.openURL")
    /// Posted by the web shell with a PageTone raw value (or nil) whenever the
    /// page's theme-color changes.
    static let priPageTone = Notification.Name("pri.pageTone")
}
