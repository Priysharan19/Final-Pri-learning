// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink bridge
//
// Joins the native writing surface to the page it sits on. The web app owns
// layout, toolbar and downstream marking. Native exposes TWO recognisers:
//   foundationRecognize — Pri's bundled Core ML foundation model, when present;
//   recognize           — the mature native Vision/geometry emergency reader.
// The web layer decides fallback order explicitly.
// ─────────────────────────────────────────────────────────────────────────────
import UIKit
import WebKit

/// The clipping region is deliberately larger than the actual Pencil surface so
/// ink can be clipped against scroll containers. A plain UIView here would eat
/// every finger tap inside that large transparent rectangle — including toolbar
/// buttons sitting above/beside the paper. Return nil when the clip view itself
/// wins hit-testing so those touches continue to the WKWebView underneath. A hit
/// on the InkSurfaceView/PKCanvasView is still returned normally.
private final class InkClipView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}

final class InkBridge: NSObject, InkSurfaceDelegate {

    private let clipView = InkClipView()
    private let surface = InkSurfaceView()
    private let foundationRecognizer = InkFoundationPageRecognizer()
    private let recognizer = MathInkRecognizer()
    private let recognitionQueue = DispatchQueue(label: "com.prilearning.ink.recognize", qos: .userInitiated)
    private let encodingQueue = DispatchQueue(label: "com.prilearning.ink.encode", qos: .userInitiated)
    private let revisionLock = NSLock()
    private var strokeRevision: UInt64 = 0

    private weak var webView: WKWebView?

    var onEmit: (([String: Any]) -> Void)?

    private var reportedFrame: CGRect = .zero
    private var reportedClip: CGRect = .zero
    private var reportedOffset: CGPoint = .zero
    private(set) var isMounted = false

    func attach(to webView: WKWebView, in container: UIView) {
        self.webView = webView
        clipView.clipsToBounds = true
        clipView.backgroundColor = .clear
        clipView.isHidden = true
        surface.delegate = self
        clipView.addSubview(surface)
        container.addSubview(clipView)
    }

    func webViewDidScroll() { applyLayout() }
    func webViewDidResize() { applyLayout() }

    // MARK: - Messages from the page

    func handle(_ body: Any) {
        guard let message = body as? [String: Any],
              let op = message["op"] as? String else { return }

        switch op {
        case "mount":
            applyAppearance(message)
            updateGeometry(message)
            surface.clear()
            isMounted = true
            clipView.isHidden = false
            applyLayout()
            emit(["type": "mounted", "foundationAvailable": foundationRecognizer.isAvailable])

        case "layout":
            guard isMounted else { return }
            updateGeometry(message)
            applyLayout()

        case "unmount":
            isMounted = false
            clipView.isHidden = true

        case "appearance":
            applyAppearance(message)

        case "tool":
            if let tool = message["tool"] as? String {
                surface.tool = (tool == "eraser") ? .eraser : .pen
            }
            if let finger = message["finger"] as? Bool {
                surface.fingerDrawingEnabled = finger
            }

        case "enabled":
            surface.isUserInteractionEnabled = (message["enabled"] as? Bool) ?? true

        case "undo":  surface.undo()
        case "redo":  surface.redo()
        case "clear": surface.clear()

        case "setStrokes":
            let raw = message["strokes"] as? [Any] ?? []
            surface.setStrokes(raw.compactMap(InkStroke.init(json:)))

        case "foundationRecognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            foundationRecognize(requestId: requestId, overrides: overrides)

        case "recognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            recognize(requestId: requestId, overrides: overrides)

        default:
            break
        }
    }

    // MARK: - Geometry

    private func updateGeometry(_ message: [String: Any]) {
        if let frame = message["frame"] as? [String: Any] { reportedFrame = Self.rect(frame) }
        if let clip = message["clip"] as? [String: Any] { reportedClip = Self.rect(clip) }
        reportedOffset = CGPoint(x: Self.number(message["scrollX"]), y: Self.number(message["scrollY"]))
    }

    private func applyLayout() {
        guard isMounted, let webView else { return }
        let delta = CGPoint(
            x: webView.scrollView.contentOffset.x - reportedOffset.x,
            y: webView.scrollView.contentOffset.y - reportedOffset.y
        )
        let clip = reportedClip.isEmpty ? webView.bounds : reportedClip
        clipView.frame = clip
        surface.frame = CGRect(
            x: reportedFrame.minX - delta.x - clip.minX,
            y: reportedFrame.minY - delta.y - clip.minY,
            width: reportedFrame.width,
            height: reportedFrame.height
        )
    }

    private func applyAppearance(_ message: [String: Any]) {
        if let hex = message["ink"] as? String, let color = UIColor(hex: hex) {
            surface.inkColor = color
        }
        if let width = message["penWidth"] as? Double {
            surface.penWidth = CGFloat(width)
        }
    }

    private static func rect(_ dict: [String: Any]) -> CGRect {
        CGRect(x: number(dict["x"]), y: number(dict["y"]),
               width: number(dict["w"]), height: number(dict["h"]))
    }

    private static func number(_ value: Any?) -> CGFloat {
        (value as? NSNumber).map { CGFloat($0.doubleValue) } ?? 0
    }

    // MARK: - Strokes out

    func inkSurfaceDidChangeStrokes(_ surface: InkSurfaceView) {
        revisionLock.lock()
        strokeRevision &+= 1
        revisionLock.unlock()
        recognizer.cancelActiveVision()
        let strokes = surface.strokes
        emit(["type": "strokes", "strokes": strokes.map(\.jsonObject)])
    }

    private func revisionSnapshot() -> UInt64 {
        revisionLock.lock(); defer { revisionLock.unlock() }
        return strokeRevision
    }

    private func revisionIsCurrent(_ revision: UInt64) -> Bool {
        revisionLock.lock(); defer { revisionLock.unlock() }
        return revision == strokeRevision
    }

    private func emptyReadingPayload(requestId: Int, engine: String) -> [String: Any] {
        var payload = Reading(lines: [], text: "", minConfidence: 0, margin: 0, weakest: nil).jsonObject
        payload["type"] = "reading"
        payload["reqId"] = requestId
        payload["engine"] = engine
        return payload
    }

    // MARK: - Recognition

    private func foundationRecognize(requestId: Int, overrides: [String: String]) {
        let strokes = surface.strokes
        let revision = revisionSnapshot()
        recognitionQueue.async { [weak self] in
            guard let self else { return }
            guard self.revisionIsCurrent(revision) else {
                let payload = self.emptyReadingPayload(requestId: requestId, engine: "pri-foundation-stale")
                DispatchQueue.main.async { self.emit(payload) }
                return
            }
            let foundation = self.foundationRecognizer.read(strokes: strokes, overrides: overrides)
                ?? Reading(lines: [], text: "", minConfidence: 0, margin: 0, weakest: nil)
            guard self.revisionIsCurrent(revision) else {
                let payload = self.emptyReadingPayload(requestId: requestId, engine: "pri-foundation-stale")
                DispatchQueue.main.async { self.emit(payload) }
                return
            }

#if DEBUG
            // Foundation is one opinion. Do not secretly run the expensive native
            // rescue here as well: the web arbiter requests that reader exactly
            // once when independent opinions disagree. This avoids duplicate
            // whole-page Vision work on physical iPad.
            var payload = foundation.jsonObject
            payload["type"] = "reading"
            payload["reqId"] = requestId
            payload["foundationAvailable"] = self.foundationRecognizer.isAvailable
            payload["debugModelTest"] = true
            if self.foundationRecognizer.isAvailable && !foundation.text.isEmpty {
                payload["engine"] = "pri-foundation-debug"
            } else {
                payload["engine"] = self.foundationRecognizer.isAvailable
                    ? "pri-foundation-no-reading-debug"
                    : "pri-foundation-unavailable-debug"
            }
            DispatchQueue.main.async { self.emit(payload) }
#else
            var payload = foundation.jsonObject
            payload["type"] = "reading"
            payload["reqId"] = requestId
            payload["engine"] = "pri-foundation"
            payload["available"] = self.foundationRecognizer.isAvailable
            DispatchQueue.main.async { self.emit(payload) }
#endif
        }
    }

    private func recognize(requestId: Int, overrides: [String: String]) {
        let strokes = surface.strokes
        let revision = revisionSnapshot()
        recognitionQueue.async { [weak self] in
            guard let self else { return }
            guard self.revisionIsCurrent(revision) else {
                let payload = self.emptyReadingPayload(requestId: requestId, engine: "native-rescue-stale")
                DispatchQueue.main.async { self.emit(payload) }
                return
            }
            let reading = self.recognizer.readWithGlyphConsensus(strokes: strokes, overrides: overrides)
            guard self.revisionIsCurrent(revision) else {
                let payload = self.emptyReadingPayload(requestId: requestId, engine: "native-rescue-stale")
                DispatchQueue.main.async { self.emit(payload) }
                return
            }
            var payload = reading.jsonObject
            payload["type"] = "reading"
            payload["reqId"] = requestId
            payload["engine"] = "native-rescue"
            DispatchQueue.main.async { self.emit(payload) }
        }
    }

    // MARK: - Messages to the page

    private func emit(_ payload: [String: Any]) {
        onEmit?(payload)
        guard webView != nil else { return }
        encodingQueue.async { [weak self] in
            guard JSONSerialization.isValidJSONObject(payload),
                  let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
                  var json = String(data: data, encoding: .utf8) else {
                NSLog("Pri Learning: ink payload could not be encoded (%@)",
                      (payload["type"] as? String ?? "?") as NSString)
                return
            }
            json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                       .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
            DispatchQueue.main.async {
                self?.webView?.evaluateJavaScript(
                    "window.__priInkReceive && window.__priInkReceive(\(json));")
            }
        }
    }
}

// MARK: - Colour

extension UIColor {
    convenience init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix("#") else { return nil }
        text.removeFirst()
        if text.count == 3 { text = text.map { "\($0)\($0)" }.joined() }
        guard text.count == 6 || text.count == 8,
              let value = UInt64(text, radix: 16) else { return nil }
        let hasAlpha = text.count == 8
        let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
        let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
        let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
        let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
