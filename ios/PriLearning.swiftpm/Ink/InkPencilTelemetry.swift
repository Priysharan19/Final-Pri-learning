// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · High-fidelity Apple Pencil telemetry
//
// PencilKit is still the renderer: it owns the system's low-latency predicted
// path and makes writing feel like Notes. Recognition, however, benefits from
// the ACTUAL touch samples that produced that path. UIKit exposes additional
// coalesced samples between delivered events; these preserve timing, pressure
// and orientation that distance-resampling a final PKStroke can blur away.
//
// Predicted touches are intentionally NEVER read here. They are temporary UI
// guesses and must not enter recognition, personalization or training data.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import UIKit
import UIKit.UIGestureRecognizerSubclass

final class InkPencilTelemetryRecognizer: UIGestureRecognizer, UIGestureRecognizerDelegate {
    var captureEnabled = true
    var nominalWidth: CGFloat = 4.5

    private var current: [InkPoint] = []
    private var strokeStartTimestamp: TimeInterval?
    private var completed: [InkStroke] = []
    private let completedLimit = 4

    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        requiresExclusiveTouchType = false
        delegate = self
    }

    convenience init() { self.init(target: nil, action: nil) }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        requiresExclusiveTouchType = false
        delegate = self
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool { true }

    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard captureEnabled,
              let pencil = touches.first(where: { $0.type == .pencil }) else {
            state = .failed
            return
        }
        current.removeAll(keepingCapacity: true)
        strokeStartTimestamp = pencil.timestamp
        appendActualSamples(for: pencil, event: event)
        state = .began
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard captureEnabled,
              let pencil = touches.first(where: { $0.type == .pencil }) else { return }
        appendActualSamples(for: pencil, event: event)
        if state == .began || state == .changed { state = .changed }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        guard captureEnabled,
              let pencil = touches.first(where: { $0.type == .pencil }) else {
            state = .cancelled
            return
        }
        appendActualSamples(for: pencil, event: event)
        finishCurrent()
        state = .ended
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        current.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
        state = .cancelled
    }

    override func reset() {
        // Completed traces live in a separate queue and survive UIKit resetting
        // the recognizer after `.ended`; only the in-flight state is cleared.
        current.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
        super.reset()
    }

    func clearPending() {
        current.removeAll(keepingCapacity: true)
        completed.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
    }

    /// Returns the oldest completed raw Pencil trace if it geometrically agrees
    /// with the PKStroke PencilKit just finalized. The agreement guard prevents
    /// a stale eraser/gesture trace from ever being attached to the wrong mark.
    func takeCompletedStroke(matching finalBounds: CGRect) -> InkStroke? {
        guard !completed.isEmpty else { return nil }
        let raw = completed.removeFirst()
        guard !raw.isEmpty else { return nil }

        let a = raw.bounds
        let b = finalBounds
        let centreDistance = hypot(a.midX - b.midX, a.midY - b.midY)
        let reference = max(18, hypot(b.width, b.height) * 0.55)
        let expanded = b.insetBy(dx: -max(10, 0.25 * max(b.width, 1)),
                                 dy: -max(10, 0.25 * max(b.height, 1)))
        guard centreDistance <= reference, expanded.intersects(a) else { return nil }
        return raw
    }

    private func appendActualSamples(for touch: UITouch, event: UIEvent) {
        // coalescedTouches are real historical hardware samples. We explicitly
        // do not call predictedTouches(for:), because predictions are allowed
        // to be wrong and are replaced by real samples on subsequent events.
        let samples = event.coalescedTouches(for: touch) ?? [touch]
        for sample in samples where sample.type == .pencil {
            append(sample)
        }
    }

    private func append(_ touch: UITouch) {
        guard let view else { return }
        let location = touch.location(in: view)
        let start = strokeStartTimestamp ?? touch.timestamp
        if strokeStartTimestamp == nil { strokeStartTimestamp = start }
        let relativeTime = max(0, touch.timestamp - start)
        let normalizedForce: CGFloat
        if touch.maximumPossibleForce > 0 {
            normalizedForce = min(1, max(0, touch.force / touch.maximumPossibleForce))
        } else {
            normalizedForce = min(1, max(0, touch.force))
        }

        let point = InkPoint(
            x: location.x,
            y: location.y,
            w: max(1, nominalWidth),
            t: relativeTime,
            force: normalizedForce,
            azimuth: touch.azimuthAngle(in: view),
            altitude: touch.altitudeAngle
        )

        if let last = current.last,
           abs((last.t ?? 0) - relativeTime) < 0.000_001,
           hypot(last.x - point.x, last.y - point.y) < 0.01 {
            return
        }
        current.append(point)
    }

    private func finishCurrent() {
        guard !current.isEmpty else { return }
        completed.append(InkStroke(points: current))
        if completed.count > completedLimit {
            completed.removeFirst(completed.count - completedLimit)
        }
        current.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
    }
}
