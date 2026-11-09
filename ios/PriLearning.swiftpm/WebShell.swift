// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · WebShell
// Hosts the bundled Pri Learning build in a WKWebView served over a custom
// prilearning:// scheme (so IndexedDB/localStorage persist in the app sandbox).
// Native integrations:
//   • a real PencilKit writing surface over the page's ink area, and Vision
//     handwriting recognition behind it (Ink/) — see InkBridge
//   • StoreKit 2 purchase/restore bridge; Premium remains server-authoritative
//   • native HTTPS cloud bridge that owns account cookies/CSRF outside WebKit
//   • priBridge: the platform-neutral priNative envelope (NativeHostBridge) —
//     handshake, share/print, storage/device facts, app lifecycle events
//   • priShare message handler → iOS share sheet (legacy, migration window)
//   • WKDownload for any blob downloads → share sheet
//   • external http(s) links open in Safari
//   • camera/file inputs work natively for photo attach and imports
// ─────────────────────────────────────────────────────────────────────────────
import SwiftUI
import WebKit

/// Holds the web view and the native ink surface above it. The surface has to
/// be a sibling rather than a subview of the web view: WebKit owns its own
/// view hierarchy, and anything added inside it is at the mercy of the next
/// layout pass.
final class ShellContainerView: UIView {
    var onLayout: (() -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        subviews.first?.frame = bounds
        onLayout?()
    }

    // Rotation, a status bar that appears or the Dynamic Island's region all
    // change the safe area without always changing the bounds.
    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        onLayout?()
    }
}

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalSchemeHandler(), forURLScheme: "prilearning")
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Describe the shell to the web app: the deep-frozen priNative host
        // descriptor (capabilities, no OS identity) plus the legacy flags kept
        // for the migration window. Main frame only — a subframe never learns
        // that native capabilities exist. Billing and cloud fail closed
        // independently when their prerequisite is missing.
        let cloudConfigured = NativeCloudBridge.isConfigured ? "true" : "false"
        let nativeReleaseIdentity = NativeReleaseIdentity.javaScriptLiteral
        let nativeFlag = WKUserScript(
            source: NativeHostBridge.hostScript(cloudConfigured: NativeCloudBridge.isConfigured) + " window.__PRI_NATIVE__ = true; window.__PRI_NATIVE_INK__ = true; window.__PRI_NATIVE_BILLING__ = true; window.__PRI_NATIVE_CLOUD__ = true; window.__PRI_NATIVE_CLOUD_CONFIGURED__ = \(cloudConfigured); window.__PRI_NATIVE_RELEASE_IDENTITY__ = \(nativeReleaseIdentity);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(nativeFlag)
        // Dynamic Type from the first paint: rewrite the page's viewport meta the
        // moment it is parsed, so a large-text student never sees the page laid
        // out at full width and then rescaled. Later text-size or window changes
        // are applied by Coordinator.applyTextSize().
        let launchViewport = Coordinator.viewportContent(width: UIScreen.main.bounds.width,
                                                         category: UIApplication.shared.preferredContentSizeCategory)
        config.userContentController.addUserScript(WKUserScript(
            source: "(function(c){var set=function(m){if(m.getAttribute('content')!==c)m.setAttribute('content',c);};var mo=new MutationObserver(function(){var m=document.querySelector('meta[name=viewport]');if(m){set(m);mo.disconnect();}});mo.observe(document,{childList:true,subtree:true});})('\(launchViewport)');",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        // Safe area from the first paint (#release-blocker 2026-10-20): the web
        // view is full screen with contentInsetAdjustmentBehavior = .never, so
        // WebKit's env(safe-area-inset-*) is 0 here and the page would draw
        // under the status bar and the Dynamic Island. The shell states the
        // real insets as --pri-inset-* on <html>; Coordinator.applySafeArea()
        // keeps them current on rotation and size changes.
        let launchInsets = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow?.safeAreaInsets }.first ?? .zero
        config.userContentController.addUserScript(WKUserScript(
            source: Coordinator.safeAreaScript(launchInsets, viewWidth: UIScreen.main.bounds.width,
                                               category: UIApplication.shared.preferredContentSizeCategory),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        // Reduce Transparency from the first paint: iOS WebKit does not answer
        // prefers-reduced-transparency, so the shell states the setting as a
        // class on <html> (aurora.css keys its opaque fallback on it).
        config.userContentController.addUserScript(WKUserScript(
            source: Coordinator.reduceTransparencyScript(UIAccessibility.isReduceTransparencyEnabled),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        config.userContentController.add(context.coordinator, name: "priBridge")
        config.userContentController.add(context.coordinator, name: "priShare")
        config.userContentController.add(context.coordinator, name: "priInk")
        config.userContentController.add(context.coordinator, name: "priBilling")
        config.userContentController.add(context.coordinator, name: "priCloud")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        // Apple Pencil never scrolls — fingers scroll, the Pencil draws.
        // Keeping the Pencil out of the scroll view's gesture arbitration
        // removes the recognition delay that makes web inking feel laggy.
        webView.scrollView.panGestureRecognizer.allowedTouchTypes =
            [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 10 / 255, green: 10 / 255, blue: 9 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif

        let container = ShellContainerView()
        container.backgroundColor = webView.backgroundColor
        container.addSubview(webView)
        context.coordinator.attachInk(to: webView, in: container)
        context.coordinator.attachBilling(to: webView)
        context.coordinator.attachCloud(to: webView)
        context.coordinator.attachHost(to: webView)
        container.onLayout = { [weak coordinator = context.coordinator, weak container] in
            coordinator?.ink.webViewDidResize()
            coordinator?.applyTextSize()
            if let container { coordinator?.applySafeArea(container.safeAreaInsets) }
        }

        webView.load(URLRequest(url: URL(string: "prilearning://app/")!))
        return container
    }

    func updateUIView(_ view: UIView, context: Context) {}

    /// A WKWebView reports a size of its own; a plain container does not, and
    /// SwiftUI reads that as "wants nothing" and hands it a zero frame. The
    /// shell fills whatever it is offered.
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UIView, context: Context) -> CGSize? {
        proposal.replacingUnspecifiedDimensions()
    }

    static func dismantleUIView(_ view: UIView, coordinator: Coordinator) {
        coordinator.detachInk()
        coordinator.detachBilling()
        coordinator.detachCloud()
        coordinator.detachHost()
        coordinator.detachPageTone()
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
        private var downloadDestination: URL?
        private weak var shellWebView: WKWebView?
        private let billing = StoreKitBillingBridge()
        private let cloud = NativeCloudBridge()
        private let host = NativeHostBridge()

        // ── Native ink ──
        let ink = InkBridge()
        private var scrollObservation: NSKeyValueObservation?
        private var zoomObservation: NSKeyValueObservation?
        private var demoDriver: InkDemoDriver?

        func attachInk(to webView: WKWebView, in container: UIView) {
            shellWebView = webView
            shellContainer = container
            ink.attach(to: webView, in: container)
            // Scrolling is followed from the web view's own offset rather than
            // from messages: the page tells us where the writing area IS, and
            // the offset tells us where it has moved to since, which keeps the
            // surface welded to the paper without a bridge hop per frame.
            scrollObservation = webView.scrollView.observe(\.contentOffset, options: [.initial, .new]) { [weak self] _, _ in
                self?.ink.webViewDidScroll()
            }
            // The page's scale (Dynamic Type through the viewport, pinch) moves the
            // writing area too: re-place the surface whenever WebKit applies a new
            // zoom scale, whenever that happens.
            zoomObservation = webView.scrollView.observe(\.zoomScale, options: [.new]) { [weak self] _, _ in
                self?.ink.webViewDidResize()
            }
            // Debug only: walk the app to a question and write on it, so the
            // native surface can be seen in the real layout.
            if ProcessInfo.processInfo.arguments.contains("--ink-demo") {
                let driver = InkDemoDriver()
                demoDriver = driver
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    driver.start(webView: webView, bridge: self.ink)
                }
            }
        }

        func detachInk() {
            scrollObservation?.invalidate()
            zoomObservation?.invalidate()
            scrollObservation = nil
            zoomObservation = nil
            shellWebView = nil
        }

        func attachBilling(to webView: WKWebView) {
            billing.attach(to: webView)
        }

        func detachBilling() {
            billing.detach()
        }

        func attachCloud(to webView: WKWebView) {
            cloud.attach(to: webView)
        }

        func detachCloud() {
            cloud.detach()
        }

        private var openURLObserver: NSObjectProtocol?
        private var contentSizeObserver: NSObjectProtocol?

        func attachHost(to webView: WKWebView) {
            host.attach(to: webView)
            // Only iPhone runs the page under the status bar (PriLearningApp.swift).
            if UIDevice.current.userInterfaceIdiom == .phone { attachPageTone(to: webView) }
            openURLObserver = NotificationCenter.default.addObserver(forName: .priOpenURL, object: nil, queue: .main) { [weak self] note in
                guard let url = note.object as? URL else { return }
                self?.route(deepLink: url)
            }
            contentSizeObserver = NotificationCenter.default.addObserver(
                forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main
            ) { [weak self, weak webView] _ in
                self?.applyTextSize()
                if let container = webView?.superview { self?.applySafeArea(container.safeAreaInsets) }
            }
            applyTextSize()
            reduceTransparencyObserver = NotificationCenter.default.addObserver(
                forName: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil, queue: .main
            ) { [weak self] _ in self?.applyReduceTransparency() }
            applyReduceTransparency()
        }

        private var reduceTransparencyObserver: NSObjectProtocol?

        /// The device's Reduce Transparency setting as `a11y-reduce-transparency`
        /// on <html>, since iOS WebKit leaves prefers-reduced-transparency unanswered.
        static func reduceTransparencyScript(_ on: Bool) -> String {
            "document.documentElement.classList.toggle('a11y-reduce-transparency', \(on ? "true" : "false"));"
        }

        func applyReduceTransparency() {
            shellWebView?.evaluateJavaScript(Self.reduceTransparencyScript(UIAccessibility.isReduceTransparencyEnabled), completionHandler: nil)
        }

        private var themeColorObservation: NSKeyValueObservation?
        private var becameActiveObserver: NSObjectProtocol?
        private var resignedActiveObserver: NSObjectProtocol?

        /// Reports the tone of the page's paper to ContentView, which sets the
        /// status bar's ink from it. The page states its paper as theme-color
        /// (client/src/lib/theme.js); WebKit exposes it as `themeColor`.
        func attachPageTone(to webView: WKWebView) {
            pinDeviceAppearance(webView)
            watchDeviceAppearance(webView)
            becameActiveObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { [weak self, weak webView] _ in
                guard let self, let webView else { return }
                self.pinDeviceAppearance(webView)
                self.watchDeviceAppearance(webView)
            }
            resignedActiveObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
            ) { [weak self] _ in
                self?.deviceAppearanceWatch?.invalidate()
                self?.deviceAppearanceWatch = nil
            }
            themeColorObservation = webView.observe(\.themeColor, options: [.initial, .new]) { webView, _ in
                var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
                let tone: PageTone? = webView.themeColor?.getRed(&red, green: &green, blue: &blue, alpha: &alpha) == true
                    ? StatusBarAppearance.tone(red: Double(red), green: Double(green), blue: Double(blue))
                    : nil
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: .priPageTone, object: tone?.rawValue)
                }
            }
        }

        /// ContentView's preferredColorScheme would otherwise reach the web view
        /// and answer the page's prefers-color-scheme with the shell's choice: a
        /// profile following the device would then follow the status bar, which
        /// follows the page — a loop that sticks on the first paper. The web
        /// view keeps the device's own appearance (the screen's, which no window
        /// override reaches), refreshed whenever the app becomes active and,
        /// while it is active, by watchDeviceAppearance.
        private func pinDeviceAppearance(_ webView: WKWebView) {
            let device = (webView.window?.windowScene?.screen ?? UIScreen.main).traitCollection.userInterfaceStyle
            if webView.overrideUserInterfaceStyle != device { webView.overrideUserInterfaceStyle = device }
        }

        private var deviceAppearanceWatch: Timer?

        /// Undoes attachPageTone when SwiftUI takes the shell down.
        func detachPageTone() {
            deviceAppearanceWatch?.invalidate()
            deviceAppearanceWatch = nil
            themeColorObservation = nil
            for observer in [becameActiveObserver, resignedActiveObserver].compactMap({ $0 }) {
                NotificationCenter.default.removeObserver(observer)
            }
            becameActiveObserver = nil
            resignedActiveObserver = nil
        }

        /// The device can switch light/dark on its schedule while Pri stays in
        /// the foreground (#533). Nothing in the shell is told: on iPhone,
        /// preferredColorScheme (the status bar's ink) overrides the window
        /// scene's appearance, so neither the scene nor any view in it sees the
        /// device change, and the screen — the one place that does follow the
        /// device — offers no change registration. So while Pri is active the
        /// screen's appearance is looked at once a second and the web view is
        /// re-pinned when it differs. Seen in the iOS 27 simulator: the scene
        /// registration this replaces never fired. Stopped while inactive.
        private func watchDeviceAppearance(_ webView: WKWebView) {
            deviceAppearanceWatch?.invalidate()
            let watch = Timer(timeInterval: 1, repeats: true) { [weak self, weak webView] timer in
                guard let self, let webView else { timer.invalidate(); return }
                self.pinDeviceAppearance(webView)
            }
            watch.tolerance = 0.5
            RunLoop.main.add(watch, forMode: .common)
            deviceAppearanceWatch = watch
        }

        /// Only `https://<signed cloud host>/account-action#…` is accepted, and it
        /// is loaded into the bundled app at the same route. The fragment carries
        /// a one-time token: it is never logged and never becomes a query.
        func route(deepLink url: URL) {
            guard let webView = shellWebView,
                  url.scheme?.lowercased() == "https",
                  let host = url.host?.lowercased(), host == NativeCloudBridge.configuredHost,
                  url.path == "/account-action",
                  url.query == nil,
                  let fragment = url.fragment, !fragment.isEmpty, fragment.count <= 1024,
                  let target = URL(string: "prilearning://app/account-action#\(fragment)") else { return }
            webView.load(URLRequest(url: target))
        }

        /// Text size. The page is laid out in CSS pixels, so the system text
        /// size SCALES THE WHOLE PAGE through the viewport; it is capped so the
        /// CSS viewport never drops below 360 px wide (the narrowest layout the
        /// product is tested at). This is not system Dynamic Type: text does
        /// not reflow at the system's metrics, and on a 402 pt iPhone the
        /// largest accessibility size reaches only about 1.12× (1.5× on iPad).
        /// Do not declare Larger Text / Dynamic Type support for the app
        /// (RELEASE.md §8); the device matrix records what the sizes really
        /// do (docs/release/device-matrix.md, TEXTSIZE cases). Making it real
        /// means the web app's type scale following a text-size token, which
        /// is a product change recorded for the owner, not a shell setting.
        ///
        /// The scale is applied through the viewport (`width = view width ÷
        /// scale`), not `pageZoom`: WKWebView's page zoom magnifies without
        /// reflowing the layout width, so at large text the page was laid out at
        /// the full width and clipped on the right (found by the CP-05
        /// largest-text journey). A narrower viewport makes WebKit reflow the
        /// page to the narrower CSS width and scale it to fit the screen.
        /// The viewport for a window width and text size: the scale is capped so
        /// the CSS viewport never drops below 360 px (on a 402 pt iPhone that is
        /// about 1.12× even at the largest size; up to 1.5× on iPad).
        static func viewportContent(width rawWidth: CGFloat, category: UIContentSizeCategory) -> String {
            let scale: CGFloat
            switch category {
            case .extraSmall, .small, .medium, .large: scale = 1.0
            case .extraLarge: scale = 1.1
            case .extraExtraLarge: scale = 1.2
            case .extraExtraExtraLarge: scale = 1.3
            case .accessibilityMedium: scale = 1.4
            case .accessibilityLarge, .accessibilityExtraLarge, .accessibilityExtraExtraLarge, .accessibilityExtraExtraExtraLarge: scale = 1.5
            default: scale = 1.0
            }
            let width = max(rawWidth, 1)
            let capped = max(1.0, min(scale, width / 360))
            return capped > 1.0
                ? "width=\(Int((width / capped).rounded(.down))), viewport-fit=cover"
                : "width=device-width, initial-scale=1.0, viewport-fit=cover"
        }

        func applyTextSize() {
            guard let webView = shellWebView else { return }
            if abs(webView.pageZoom - 1) > 0.001 { webView.pageZoom = 1 }
            // Only an integer and constant text reach this script.
            let content = Self.viewportContent(width: webView.bounds.width, category: UIApplication.shared.preferredContentSizeCategory)
            webView.evaluateJavaScript(
                "(function(c){var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}if(m.getAttribute('content')!==c)m.setAttribute('content',c);})('\(content)')",
                completionHandler: nil)
        }

        /// The CSS px the page is laid out in per point: below 1 when large
        /// Dynamic Type narrows the viewport (viewportContent above).
        static func cssPerPoint(viewWidth: CGFloat, category: UIContentSizeCategory) -> CGFloat {
            let content = viewportContent(width: viewWidth, category: category)
            guard let range = content.range(of: "width="), !content.hasPrefix("width=device-width"),
                  let css = Double(content[range.upperBound...].prefix { $0.isNumber }), viewWidth > 0 else { return 1 }
            return CGFloat(css) / viewWidth
        }

        /// Sets --pri-inset-top/right/bottom/left on <html>. Only four numbers
        /// reach this script. An inline custom property beats the :root
        /// fallback (env(), which is 0 inside this shell) in theme.css.
        static func safeAreaScript(_ insets: UIEdgeInsets, viewWidth: CGFloat, category: UIContentSizeCategory) -> String {
            let k = cssPerPoint(viewWidth: viewWidth, category: category)
            func px(_ v: CGFloat) -> String { String(format: "%.2fpx", max(0, Double(v * k))) }
            return "(function(t,r,b,l){var s=document.documentElement.style;"
                + "s.setProperty('--pri-inset-top',t);s.setProperty('--pri-inset-right',r);"
                + "s.setProperty('--pri-inset-bottom',b);s.setProperty('--pri-inset-left',l);})"
                + "('\(px(insets.top))','\(px(insets.right))','\(px(insets.bottom))','\(px(insets.left))');"
        }

        private var appliedSafeArea: String?
        func applySafeArea(_ insets: UIEdgeInsets) {
            guard let webView = shellWebView else { return }
            let script = Self.safeAreaScript(insets, viewWidth: webView.bounds.width,
                                             category: UIApplication.shared.preferredContentSizeCategory)
            guard script != appliedSafeArea else { return }
            appliedSafeArea = script
            webView.evaluateJavaScript(script, completionHandler: nil)
        }

        func detachHost() {
            if let openURLObserver { NotificationCenter.default.removeObserver(openURLObserver) }
            if let contentSizeObserver { NotificationCenter.default.removeObserver(contentSizeObserver) }
            if let reduceTransparencyObserver { NotificationCenter.default.removeObserver(reduceTransparencyObserver) }
            reduceTransparencyObserver = nil
            openURLObserver = nil
            contentSizeObserver = nil
            host.detach()
        }

        /// Privileged messages are accepted only from this shell's own web view,
        /// its main frame, and the bundled prilearning://app origin. A subframe,
        /// a remote page or any other origin can never drive ink, StoreKit, the
        /// native cookie jar or the share sheet.
        static func isTrustedSender(_ message: WKScriptMessage, expected webView: WKWebView?) -> Bool {
            guard let webView, message.webView === webView, message.frameInfo.isMainFrame else { return false }
            let origin = message.frameInfo.securityOrigin
            return origin.protocol == "prilearning" && origin.host == "app" && origin.port == 0
        }

        // ── Bridges from the page ──
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard Coordinator.isTrustedSender(message, expected: shellWebView) else { return }
            if message.name == "priBridge" {
                host.handle(message.body)
                return
            }
            if message.name == "priInk" {
                ink.handle(message.body)
                return
            }
            if message.name == "priBilling" {
                billing.handle(message.body)
                return
            }
            if message.name == "priCloud" {
                cloud.handle(message.body)
                return
            }
            guard message.name == "priShare",
                  let body = message.body as? [String: Any],
                  let filename = body["filename"] as? String,
                  let content = body["content"] as? String else { return }
            let safeName = filename
                .components(separatedBy: CharacterSet(charactersIn: "/\\:"))
                .joined(separator: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            do {
                try content.data(using: .utf8)?.write(to: url, options: .atomic)
                presentShareSheet(for: url)
            } catch {
                // Nothing sensible to do beyond not crashing — the web side
                // falls back to its own download path on the next attempt.
            }
        }

        // A new main-frame document starts its own priNative event sequence.
        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            host.documentDidStart()
        }

        private var bridgeSelfCheckRan = false
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Simulator/CI only: prove the bridge contract inside real WebKit.
            applyTextSize()
            appliedSafeArea = nil
            if let container = webView.superview { applySafeArea(container.safeAreaInsets) }
            #if DEBUG
            if BridgeSelfCheck.awaitingContentEnd {
                // A load after the page's WebContent process ended (whoever reloaded it).
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { BridgeSelfCheck.runRecovery(in: webView, ink: self.ink) }
                return
            }
            guard !bridgeSelfCheckRan else { return }
            if BridgeSelfCheck.requested {
                bridgeSelfCheckRan = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { BridgeSelfCheck.run(in: webView, ink: self.ink) }
            } else if JourneySelfCheck.phase != nil {
                bridgeSelfCheckRan = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { JourneySelfCheck.run(in: webView) }
            }
            #endif
        }

        // ── The page's WebContent process ended ──
        // iOS ends the page's WebContent process under memory pressure, and
        // WebKit ends it when it crashes. Without this method WebKit reloaded
        // the page on its own and told the shell nothing: the native PencilKit
        // surface stayed mounted, with the ended page's ink, above the new
        // page, and a second end a few seconds later left a blank screen with
        // no way back but force-quitting (both measured on an iOS 27 simulator
        // by killing the real WebContent process; scripts/native-bridge-
        // selfcheck.mjs now does this on every run). The page is reloaded here:
        // drafts live in its own storage and checked work on Pri's server. The
        // ink surface and any cloud request belonged to the page that ended,
        // so they are dropped first. A page that keeps dying gets a native
        // screen instead of a reload loop: the same policy as Android's
        // onRenderProcessGone (MainActivity.kt, more than 2 within 30 s).
        static let maxContentTerminations = 2
        static let contentTerminationWindow: TimeInterval = 30
        private var contentTerminations: [Date] = []
        private weak var shellContainer: UIView?
        private var stoppedView: UIView?

        /// The terminations still inside the window (this one included), and
        /// whether the page may be reloaded once more.
        static func recovery(after earlier: [Date], at now: Date) -> (recent: [Date], reload: Bool) {
            let recent = earlier.filter { now.timeIntervalSince($0) <= contentTerminationWindow } + [now]
            return (recent, recent.count <= maxContentTerminations)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            ink.pageDidTerminate()
            cloud.cancelAll()
            let (recent, reload) = Self.recovery(after: contentTerminations, at: Date())
            contentTerminations = recent
            #if DEBUG
            BridgeSelfCheck.contentProcessEnded(count: recent.count, reloading: reload, inkMounted: ink.isMounted)
            #endif
            if reload { reloadPage(webView) } else { showStopped(over: webView) }
        }

        private func reloadPage(_ webView: WKWebView) {
            if webView.url != nil {
                webView.reload()
            } else {
                webView.load(URLRequest(url: URL(string: "prilearning://app/")!))
            }
        }

        private func showStopped(over webView: WKWebView) {
            guard stoppedView == nil, let container = shellContainer else { return }
            let label = UILabel()
            // The same words as Android's renderer_crash_body / renderer_crash_retry.
            label.text = "Pri Learning stopped unexpectedly a few times. Your saved work is kept on this device."
            label.numberOfLines = 0
            label.textAlignment = .center
            label.textColor = UIColor(white: 0.88, alpha: 1)
            label.font = .preferredFont(forTextStyle: .body)
            label.adjustsFontForContentSizeCategory = true
            let retry = UIButton(configuration: .bordered(), primaryAction: UIAction(title: "Try again") { [weak self, weak webView] _ in
                guard let self, let webView else { return }
                self.contentTerminations.removeAll()
                self.stoppedView?.removeFromSuperview()
                self.stoppedView = nil
                self.reloadPage(webView)
            })
            retry.accessibilityIdentifier = "pri.contentStopped.retry"
            // The shell is dark whatever the system appearance; a light-mode
            // tint drew the button's title black on a dark fill.
            retry.tintColor = UIColor(white: 0.92, alpha: 1)
            let stack = UIStackView(arrangedSubviews: [label, retry])
            stack.axis = .vertical
            stack.alignment = .center
            stack.spacing = 24
            stack.translatesAutoresizingMaskIntoConstraints = false
            let overlay = UIView(frame: container.bounds)
            overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            overlay.backgroundColor = webView.backgroundColor
            overlay.overrideUserInterfaceStyle = .dark
            overlay.accessibilityIdentifier = "pri.contentStopped"
            overlay.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.centerYAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.centerYAnchor),
                stack.leadingAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.leadingAnchor, constant: 32),
                stack.trailingAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.trailingAnchor, constant: -32),
                retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            ])
            container.addSubview(overlay)
            stoppedView = overlay
            #if DEBUG
            BridgeSelfCheck.contentStoppedShown()
            #endif
        }

        // ── Navigation policy ──
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // No nested browsing context loads anything (#260). The shell CSP's
            // frame-src 'none' refuses fetched frames, but WebKit still builds an
            // about:srcdoc child, and a same-origin child calling
            // parent.webkit.messageHandlers.* is credited to the main frame by
            // the sender gate. Refusing every subframe navigation here closes it
            // natively, whatever the page or the CSP does.
            if let target = navigationAction.targetFrame, !target.isMainFrame {
                decisionHandler(.cancel)
                return
            }
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            if let url = navigationAction.request.url,
               let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                // The app itself is fully local — anything http(s) is an
                // outbound link, which belongs in Safari.
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if !navigationResponse.canShowMIMEType {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        // target="_blank" links (e.g. the printable paper) open in-place.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                if let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                    UIApplication.shared.open(url)
                } else {
                    webView.load(navigationAction.request)
                }
            }
            return nil
        }

        // ── Blob/anchor downloads → temp file → share sheet ──
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        func download(_ download: WKDownload,
                      decideDestinationUsing response: URLResponse,
                      suggestedFilename: String,
                      completionHandler: @escaping (URL?) -> Void) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
            try? FileManager.default.removeItem(at: url)
            downloadDestination = url
            completionHandler(url)
        }

        func downloadDidFinish(_ download: WKDownload) {
            if let url = downloadDestination {
                presentShareSheet(for: url)
                downloadDestination = nil
            }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            downloadDestination = nil
        }

        // ── iOS share sheet (iPad requires a popover anchor) ──
        private func presentShareSheet(for url: URL) {
            DispatchQueue.main.async {
                let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first,
                      let root = scene.keyWindow?.rootViewController else { return }
                var top = root
                while let presented = top.presentedViewController { top = presented }
                let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                if let popover = activity.popoverPresentationController {
                    popover.sourceView = top.view
                    popover.sourceRect = CGRect(x: top.view.bounds.midX, y: 96, width: 1, height: 1)
                    popover.permittedArrowDirections = []
                }
                top.present(activity, animated: true)
            }
        }
    }
}
