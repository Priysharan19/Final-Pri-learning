// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NativeHostBridge (priNative envelope v1, CP-02)
//
// The platform-neutral side of the shell, shared in shape with the Android
// shell: one `priBridge` message handler speaking the versioned envelope in
// docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4.3. It serves the
// handshake, sharing/printing, storage/device facts and app lifecycle events.
// Ink, photo, StoreKit and cloud keep their own handlers during the migration
// window; the host descriptor tells the page which transport each one uses, so
// an operation is never sent twice.
//
// Every message reaching this bridge has already passed the shell's main-frame
// + prilearning://app origin gate in WebShell. Nothing here grants entitlement,
// reads cookies, or carries learning logic.
// ─────────────────────────────────────────────────────────────────────────────
import UIKit
import WebKit

final class NativeHostBridge: NSObject {
    static let protocolVersion = 1
    private static let maxEnvelopeBytes = 8 * 1024 * 1024
    private static let maxShareBytes = 6 * 1024 * 1024

    private weak var webView: WKWebView?
    private var observers: [NSObjectProtocol] = []
    private var seq = 0
    private(set) var state = "active"

    // MARK: Host descriptor

    /// The deep-frozen `window.__PRI_HOST__` installed at document start in the
    /// main frame only. No OS identity: product code must branch on
    /// capabilities, never on the platform.
    static func hostScript(cloudConfigured: Bool) -> String {
        let info = Bundle.main.infoDictionary ?? [:]
        var descriptor: [String: Any] = [
            "protocol": protocolVersion,
            "bundledAssets": true,
            "shell": [
                "version": info["CFBundleShortVersionString"] as? String ?? "",
                "build": info["CFBundleVersion"] as? String ?? "",
                "id": Bundle.main.bundleIdentifier ?? ""
            ],
            "capabilities": [
                "ink": ["versions": [1], "transport": "legacy", "stylus": true, "finger": true],
                "photo": ["versions": [1], "transport": "legacy", "ocr": true],
                "billing": ["versions": [1], "transport": "legacy", "store": "app-store"],
                "cloud": ["versions": [1], "transport": "legacy", "configured": cloudConfigured],
                "share": ["versions": [1], "transport": "bridge", "binary": true, "print": true],
                "files": ["versions": [1], "input": true],
                "lifecycle": ["versions": [1], "backButton": false],
                "storage": ["versions": [1], "durable": true],
                "device": ["versions": [1], "safeAreaApplied": true, "stylusSeen": false]
            ]
        ]
        if let release = NativeReleaseIdentity.object { descriptor["release"] = release }
        let json = (try? JSONSerialization.data(withJSONObject: descriptor, options: [.sortedKeys]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "null"
        return """
        (function(){var h=\(json);if(!h)return;function f(o){Object.freeze(o);Object.keys(o).forEach(function(k){var v=o[k];if(v&&typeof v==='object'&&!Object.isFrozen(v))f(v);});return o;}
        Object.defineProperty(window,'__PRI_HOST__',{value:f(h),writable:false,configurable:false,enumerable:false});})();
        """
    }

    // MARK: Lifecycle

    func attach(to webView: WKWebView) {
        self.webView = webView
        let center = NotificationCenter.default
        let transitions: [(Notification.Name, String)] = [
            (UIApplication.didBecomeActiveNotification, "active"),
            (UIApplication.willResignActiveNotification, "inactive"),
            (UIApplication.didEnterBackgroundNotification, "background"),
            (UIApplication.willEnterForegroundNotification, "inactive")
        ]
        for (name, next) in transitions {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.transition(to: next)
            })
        }
    }

    func detach() {
        observers.forEach(NotificationCenter.default.removeObserver)
        observers.removeAll()
        webView = nil
    }

    /// A new main-frame document starts its own event sequence.
    func documentDidStart() { seq = 0 }

    private func transition(to next: String) {
        guard next != state else { return }
        state = next
        // Going to the background: ask iOS for a short grace period so the page
        // can flush drafts before the process is suspended.
        var task = UIBackgroundTaskIdentifier.invalid
        if next == "background" {
            task = UIApplication.shared.beginBackgroundTask(withName: "pri.lifecycle.flush") {
                if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
            }
        }
        emit("lifecycle.state", ["state": next]) {
            if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
        }
    }

    private func emit(_ event: String, _ payload: [String: Any], completion: (() -> Void)? = nil) {
        let message: [String: Any] = ["v": Self.protocolVersion, "event": event, "seq": seq, "payload": payload]
        seq += 1
        deliver(message, completion: completion)
    }

    // MARK: Requests

    func handle(_ body: Any) {
        guard let envelope = body as? [String: Any],
              envelope["v"] as? Int == Self.protocolVersion,
              let id = envelope["id"] as? String, !id.isEmpty, id.count <= 120, !id.hasPrefix("n:"),
              let cap = envelope["cap"] as? String, let op = envelope["op"] as? String else {
            return // malformed: nothing to answer
        }
        if let data = try? JSONSerialization.data(withJSONObject: envelope), data.count > Self.maxEnvelopeBytes {
            return fail(id, "TOO_LARGE", "Request is too large.")
        }
        let payload = envelope["payload"] as? [String: Any] ?? [:]
        if op == "cancel" { return } // share/print are not cancellable once presented

        switch "\(cap).\(op)" {
        case "host.ready":
            reply(id, [:])
        case "host.diagnostics":
            // Logs/support only; product code never sees OS identity.
            reply(id, ["platform": "ios",
                       "os": UIDevice.current.systemVersion,
                       "model": UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"])
        case "storage.status":
            reply(id, ["durable": true])
        case "device.facts":
            reply(id, ["safeAreaApplied": true, "stylusSeen": false])
        case "lifecycle.state":
            reply(id, ["state": state])
        case "share.file":
            shareFile(id, payload)
        case "share.print":
            printPage(id)
        default:
            fail(id, "UNSUPPORTED", "\(cap).\(op) is not supported by this app version.")
        }
    }

    private func shareFile(_ id: String, _ payload: [String: Any]) {
        let rawName = payload["filename"] as? String ?? "pri-export"
        let name = rawName
            .components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters))
            .joined(separator: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        let filename = String((name.isEmpty ? "pri-export" : name).prefix(120))
        let data: Data?
        if let text = payload["text"] as? String {
            data = text.data(using: .utf8)
        } else if let base64 = payload["base64"] as? String {
            data = Data(base64Encoded: base64)
        } else {
            data = nil
        }
        guard let bytes = data else { return fail(id, "BAD_REQUEST", "share.file needs text or base64 content.") }
        guard bytes.count <= Self.maxShareBytes else { return fail(id, "TOO_LARGE", "That file is too large to share.") }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try? FileManager.default.removeItem(at: url)
            try bytes.write(to: url, options: .atomic)
        } catch {
            return fail(id, "PROVIDER_ERROR", "Could not prepare the file.")
        }
        guard let presenter = Self.topViewController() else { return fail(id, "UNAVAILABLE", "No window to present from.") }
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        activity.completionWithItemsHandler = { [weak self] _, completed, _, _ in
            self?.reply(id, ["completed": completed])
        }
        if let popover = activity.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        presenter.present(activity, animated: true)
    }

    private func printPage(_ id: String) {
        guard let webView, UIPrintInteractionController.isPrintingAvailable else {
            return fail(id, "UNAVAILABLE", "Printing is not available on this device.")
        }
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = "Pri Learning"
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        controller.present(animated: true) { [weak self] _, completed, _ in
            self?.reply(id, ["completed": completed])
        }
    }

    // MARK: Delivery

    private func reply(_ id: String, _ result: [String: Any]) {
        deliver(["v": Self.protocolVersion, "id": id, "ok": true, "result": result])
    }

    private func fail(_ id: String, _ code: String, _ message: String) {
        deliver(["v": Self.protocolVersion, "id": id, "ok": false,
                 "error": ["code": code, "message": message, "retryable": code == "UNAVAILABLE"]])
    }

    private func deliver(_ message: [String: Any], completion: (() -> Void)? = nil) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: data, encoding: .utf8) else { completion?(); return }
        let safe = json
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        let script = "window.__priNativeReceive && window.__priNativeReceive(\(safe));"
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.webView else { completion?(); return }
            webView.evaluateJavaScript(script) { _, _ in completion?() }
        }
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first,
              let root = scene.keyWindow?.rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
