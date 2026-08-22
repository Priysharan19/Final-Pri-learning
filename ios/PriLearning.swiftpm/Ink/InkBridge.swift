// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink bridge
//
// Joins the native writing surface to the page it sits on. The web app owns
// the layout, the toolbar and everything downstream of a reading — the marker,
// Step Check, drafts, replay — and none of that changes. What changes is that
// the ink and the reading of it are now native.
//
// Position tracking is deliberately split. The page tells the shell where the
// writing area is whenever its LAYOUT changes; scrolling is tracked natively
// from the web view's own scroll offset, so the surface stays welded to the
// paper at display rate instead of chasing messages across the bridge.
// ─────────────────────────────────────────────────────────────────────────────
import UIKit
import WebKit

final class InkBridge: NSObject, InkSurfaceDelegate {

    /// Clips the surface to the visible content area, so ink can never be
    /// drawn over the sticky top bar or the sidebar.
    private let clipView = UIView()
    private let surface = InkSurfaceView()
    private let recognizer = MathInkRecognizer()
    private let recognitionQueue = DispatchQueue(label: "com.prilearning.ink.recognize", qos: .userInitiated)
    private let encodingQueue = DispatchQueue(label: "com.prilearning.ink.encode", qos: .userInitiated)

    private weak var webView: WKWebView?

    /// Every payload the page would receive, for the bridge smoke test. Nil in
    /// the app — the page is the only listener there.
    var onEmit: (([String: Any]) -> Void)?

    /// Where the writing area sat in the viewport when the page last reported,
    /// and what the scroll offset was at that moment.
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

    /// Called from the web view's scroll delegate — the page moved under the
    /// surface, so the surface moves with it.
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
            // A mount is a fresh sheet. Reset the drawing AND its undo/redo
            // baseline so Undo on question B can never resurrect question A.
            // Restored strokes, if any, arrive immediately afterwards through
            // setStrokes and become the new question's baseline.
            surface.resetForNewSheet()
            isMounted = true
            clipView.isHidden = false
            applyLayout()
            emit(["type": "mounted"])

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
        // How far the page has scrolled since it last told us where it was.
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

    /// JavaScript numbers arrive as NSNumber, which bridges to Double, Int or
    /// CGFloat depending on the value — so every one of them is read the same
    /// way rather than guessed at per call site.
    private static func number(_ value: Any?) -> CGFloat {
        (value as? NSNumber).map { CGFloat($0.doubleValue) } ?? 0
    }

    // MARK: - Strokes out

    func inkSurfaceDidChangeStrokes(_ surface: InkSurfaceView) {
        let strokes = surface.strokes
        emit(["type": "strokes", "strokes": strokes.map(\.jsonObject)])
    }

    // MARK: - Recognition

    private func recognize(requestId: Int, overrides: [String: String]) {
        let strokes = surface.strokes
        recognitionQueue.async { [weak self] in
            guard let self else { return }
            let reading = self.recognizer.read(strokes: strokes, overrides: overrides)
            var payload = reading.jsonObject
            payload["type"] = "reading"
            payload["reqId"] = requestId
            DispatchQueue.main.async { self.emit(payload) }
        }
    }

    // MARK: - Messages to the page

    private func emit(_ payload: [String: Any]) {
        onEmit?(payload)
        guard webView != nil else { return }
        // Encoding a page of strokes is not free, and this runs at the end of
        // every stroke. Doing it on the main thread would put that cost between
        // the pen and the next mark, which is the one place it must never be.
        encodingQueue.async { [weak self] in
            guard JSONSerialization.isValidJSONObject(payload),
                  let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
                  var json = String(data: data, encoding: .utf8) else {
                // Nothing the page can do about this, but it must not pass
                // unnoticed: an unencodable payload is a stroke or a reading
                // the student never gets back.
                NSLog("Pri Learning: ink payload could not be encoded (%@)",
                      (payload["type"] as? String ?? "?") as NSString)
                return
            }
            // U+2028/U+2029 are legal in JSON strings and illegal in a
            // JavaScript source literal; unescaped they would make the injected
            // call a syntax error rather than a reading.
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
    /// Accepts the CSS forms the theme actually emits: #rgb, #rrggbb, #rrggbbaa.
    convenience init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix("#") else { return nil }
        text.removeFirst()
        if text.count == 3 {
            text = text.map { "\($0)\($0)" }.joined()
        }
        guard text.count == 6 || text.count == 8, let value = UInt64(text, radix: 16) else { return nil }
        let hasAlpha = text.count == 8
        let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
        let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
        let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
        let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
