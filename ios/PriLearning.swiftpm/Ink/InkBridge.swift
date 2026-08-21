// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink bridge
//
// Native PencilKit owns the latency-critical rendering path. Recognition and
// JSON work are intentionally scheduled behind it: handwriting mutations cancel
// stale work immediately and Vision is not allowed to start until the Pencil has
// been quiet for a short window.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation
import os
import UIKit
import WebKit

private final class InkRecognitionToken {
    private let lock = NSLock()
    private var cancelled = false

    func cancel() {
        lock.lock(); cancelled = true; lock.unlock()
    }

    var isCancelled: Bool {
        lock.lock(); defer { lock.unlock() }
        return cancelled
    }
}

/// Transparent clipping container for the native canvas.
///
/// UIKit's default hit testing may return a transparent UIView itself even when
/// the point is not inside any interactive child. Only real descendants are
/// allowed to become hit-test targets; empty transparent space passes straight
/// through to the WKWebView. `applyLayout()` also constrains this view's physical
/// frame to the visible handwriting rectangle, so passthrough is a second line
/// of defence rather than the only thing protecting web controls.
private final class InkPassthroughClipView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}

final class InkBridge: NSObject, InkSurfaceDelegate {

    private let clipView = InkPassthroughClipView()
    private let surface = InkSurfaceView()
    private let recognizer = MathInkRecognizer()
    private let personalization = InkPersonalizationStore.shared
    private let recognitionQueue = DispatchQueue(label: "com.prilearning.ink.recognize", qos: .utility)
    private let encodingQueue = DispatchQueue(label: "com.prilearning.ink.encode", qos: .utility)
    private let performanceLog = OSLog(subsystem: "com.prilearning.app", category: "InkPerformance")

    private weak var webView: WKWebView?
    private var recognitionToken: InkRecognitionToken?
    private var lastReading: Reading?
    private var learnedCorrectionKeys: Set<String> = []

    private var lastInkMutationNanos: UInt64 = 0
    private static let recognitionQuietNanos: UInt64 = 380_000_000

    var onEmit: (([String: Any]) -> Void)?

    private var reportedFrame: CGRect = .zero
    private var reportedClip: CGRect = .zero
    private var reportedOffset: CGPoint = .zero
    private(set) var isMounted = false

    func attach(to webView: WKWebView, in container: UIView) {
        self.webView = webView
        clipView.clipsToBounds = true
        clipView.backgroundColor = .clear
        clipView.isOpaque = false
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
            cancelRecognition()
            lastReading = nil
            learnedCorrectionKeys.removeAll()
            applyAppearance(message)
            updateGeometry(message)
            surface.clear()
            markInkMutation()
            isMounted = true
            clipView.isHidden = false
            applyLayout()
            emit(["type": "mounted"])

        case "layout":
            guard isMounted else { return }
            updateGeometry(message)
            applyLayout()

        case "unmount":
            cancelRecognition()
            lastReading = nil
            learnedCorrectionKeys.removeAll()
            isMounted = false
            clipView.isHidden = true
            clipView.frame = .zero
            surface.frame = .zero

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
            let profile = message["profile"] as? String
            recognize(requestId: requestId, overrides: overrides, profile: profile)

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
        let viewportClip = reportedClip.isEmpty ? webView.bounds : reportedClip
        let movedFrame = reportedFrame.offsetBy(dx: -delta.x, dy: -delta.y)
        let visible = movedFrame.intersection(viewportClip)

        guard !visible.isNull, !visible.isEmpty,
              visible.width.isFinite, visible.height.isFinite else {
            clipView.frame = .zero
            surface.frame = .zero
            return
        }

        // The native view now physically occupies only the visible handwriting
        // area. The full PencilKit surface remains positioned relative to that
        // clipped window so partially scrolled handwriting stays geometrically
        // aligned without placing a transparent view over unrelated controls.
        clipView.frame = visible
        surface.frame = CGRect(
            x: movedFrame.minX - visible.minX,
            y: movedFrame.minY - visible.minY,
            width: movedFrame.width,
            height: movedFrame.height
        )
    }

    private func applyAppearance(_ message: [String: Any]) {
        if let hex = message["ink"] as? String, let color = UIColor(hex: hex) {
            surface.inkColor = color
        }
        if let width = message["penWidth"] as? Double {
            surface.penWidth = min(8, max(1.5, CGFloat(width)))
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

    private func markInkMutation() {
        lastInkMutationNanos = DispatchTime.now().uptimeNanoseconds
        recognitionToken?.cancel()
        recognizer.cancelActiveVision()
    }

    func inkSurfaceDidBeginStroke(_ surface: InkSurfaceView) {
        markInkMutation()
    }

    func inkSurface(_ surface: InkSurfaceView, didAppend stroke: InkStroke, at index: Int) {
        markInkMutation()
        emitStrokeDelta(stroke, at: index)
    }

    func inkSurfaceDidReplaceStrokes(_ surface: InkSurfaceView) {
        markInkMutation()
        emitStrokeSnapshot(surface.strokes)
    }

    private func emitStrokeDelta(_ stroke: InkStroke, at index: Int) {
        if let onEmit {
            onEmit(["type": "strokeDelta", "index": index, "stroke": stroke.jsonObject])
        }
        guard webView != nil else { return }
        encodingQueue.async { [weak self] in
            self?.encodeAndDeliver(["type": "strokeDelta", "index": index, "stroke": stroke.jsonObject])
        }
    }

    private func emitStrokeSnapshot(_ strokes: [InkStroke]) {
        if let onEmit {
            onEmit(["type": "strokes", "strokes": strokes.map(\.jsonObject)])
        }
        guard webView != nil else { return }
        encodingQueue.async { [weak self] in
            self?.encodeAndDeliver(["type": "strokes", "strokes": strokes.map(\.jsonObject)])
        }
    }

    // MARK: - Recognition / personalization

    private func cancelRecognition() {
        recognitionToken?.cancel()
        recognizer.cancelActiveVision()
        recognitionToken = nil
    }

    private func learnExplicitCorrections(
        profile: String?,
        overrides: [String: String],
        reading: Reading?,
        strokes: [InkStroke]
    ) {
        guard let profile, !profile.isEmpty, let reading else { return }
        let symbols = reading.lines.flatMap(\.symbols)
        for (id, intended) in overrides {
            guard let original = symbols.first(where: { $0.id == id }),
                  original.symbol != intended,
                  !original.approximate,
                  !original.strokeIndexes.isEmpty else { continue }
            let signature = "\(profile)|\(id)|\(intended)|\(original.strokeIndexes.map(String.init).joined(separator: ","))"
            guard !learnedCorrectionKeys.contains(signature) else { continue }
            let members = original.strokeIndexes.compactMap {
                strokes.indices.contains($0) ? strokes[$0] : nil
            }
            guard !members.isEmpty else { continue }
            personalization.learn(profile: profile, symbol: intended, strokes: members)
            learnedCorrectionKeys.insert(signature)
        }
    }

    private func personalOverrides(
        profile: String?,
        for reading: Reading,
        strokes: [InkStroke],
        userOverrides: [String: String]
    ) -> [String: String] {
        guard let profile, !profile.isEmpty else { return userOverrides }
        var merged = userOverrides
        for symbol in reading.lines.flatMap(\.symbols) {
            guard merged[symbol.id] == nil,
                  !symbol.approximate,
                  symbol.confidence < 0.86,
                  !symbol.strokeIndexes.isEmpty else { continue }
            let members = symbol.strokeIndexes.compactMap {
                strokes.indices.contains($0) ? strokes[$0] : nil
            }
            guard !members.isEmpty,
                  let suggestion = personalization.suggestion(
                    profile: profile,
                    for: members,
                    current: symbol.symbol,
                    alternatives: symbol.alternatives.map(\.symbol),
                    globalConfidence: symbol.confidence
                  ),
                  suggestion.symbol != symbol.symbol,
                  suggestion.confidence >= max(0.64, symbol.confidence + 0.04)
            else { continue }
            merged[symbol.id] = suggestion.symbol
            if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
                NSLog("PRIINK personal %@ %@→%@ conf=%.2f d=%.3f margin=%.3f",
                      profile as NSString, symbol.symbol as NSString, suggestion.symbol as NSString,
                      suggestion.confidence, suggestion.distance, suggestion.margin)
            }
        }
        return merged
    }

    private func recognize(requestId: Int, overrides: [String: String], profile: String?) {
        let strokes = surface.strokes
        learnExplicitCorrections(profile: profile, overrides: overrides,
                                 reading: lastReading, strokes: strokes)

        recognitionToken?.cancel()
        recognizer.cancelActiveVision()
        let token = InkRecognitionToken()
        recognitionToken = token
        let signpostID = OSSignpostID(log: performanceLog)

        let now = DispatchTime.now().uptimeNanoseconds
        let quietDeadline = lastInkMutationNanos &+ Self.recognitionQuietNanos
        let delayNanos = quietDeadline > now ? quietDeadline - now : 0
        let deadline = DispatchTime.now() + .nanoseconds(Int(min(delayNanos, UInt64(Int.max))))

        recognitionQueue.asyncAfter(deadline: deadline) { [weak self] in
            guard let self, !token.isCancelled else { return }
            autoreleasepool {
                let started = DispatchTime.now().uptimeNanoseconds
                os_signpost(.begin, log: self.performanceLog, name: "InkRecognition",
                            signpostID: signpostID, "%{public}d strokes", strokes.count)

                let first = self.recognizer.read(strokes: strokes, overrides: overrides)
                guard !token.isCancelled else {
                    os_signpost(.end, log: self.performanceLog, name: "InkRecognition", signpostID: signpostID)
                    return
                }
                let personalized = self.personalOverrides(
                    profile: profile, for: first, strokes: strokes, userOverrides: overrides
                )
                let reading = personalized == overrides
                    ? first
                    : self.recognizer.read(strokes: strokes, overrides: personalized)

                os_signpost(.end, log: self.performanceLog, name: "InkRecognition", signpostID: signpostID)
                guard !token.isCancelled else { return }

                let elapsedMs = Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000
                var payload = reading.jsonObject(strokes: strokes)
                payload["type"] = "reading"
                payload["reqId"] = requestId
                payload["recognitionQuietMs"] = Double(Self.recognitionQuietNanos) / 1_000_000
                DispatchQueue.main.async { [weak self] in
                    guard let self, !token.isCancelled, self.isMounted else { return }
                    self.lastReading = reading
                    if ProcessInfo.processInfo.arguments.contains("--ink-selfcheck") {
                        NSLog("PRIINK perf recognition req=%d strokes=%d %.1fms", requestId, strokes.count, elapsedMs)
                    }
                    self.emit(payload)
                    if self.recognitionToken === token { self.recognitionToken = nil }
                }
            }
        }
    }

    // MARK: - Messages to the page

    private func emit(_ payload: [String: Any]) {
        onEmit?(payload)
        guard webView != nil else { return }
        encodingQueue.async { [weak self] in self?.encodeAndDeliver(payload) }
    }

    private func encodeAndDeliver(_ payload: [String: Any]) {
        let signpostID = OSSignpostID(log: performanceLog)
        os_signpost(.begin, log: performanceLog, name: "InkBridgeEncode", signpostID: signpostID)
        defer { os_signpost(.end, log: performanceLog, name: "InkBridgeEncode", signpostID: signpostID) }

        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              var json = String(data: data, encoding: .utf8) else {
            NSLog("Pri Learning: ink payload could not be encoded (%@)",
                  (payload["type"] as? String ?? "?") as NSString)
            return
        }
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(
                "window.__priInkReceive && window.__priInkReceive(\(json));")
        }
    }
}

extension UIColor {
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
