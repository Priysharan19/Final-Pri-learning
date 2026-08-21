// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · High-fidelity Apple Pencil telemetry
//
// PencilKit remains the renderer and owns the system low-latency/predicted path.
// This recognizer is intentionally passive: it samples only real coalesced Pencil
// events for recognition/training and is designed to add as little main-thread
// work as possible while the nib is moving.
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
    private let maximumSamplesPerStroke = 4096

    override init(target: Any?, action: Selector?) {
        super.init(target: target, action: action)
        configureForPassivePencilObservation()
    }

    convenience init() { self.init(target: nil, action: nil) }

    required init?(coder: NSCoder) {
        // UIGestureRecognizer's target/action initializer is the designated
        // initializer available to Swift subclasses. This view is never decoded
        // from an archive, but satisfying NSCoder keeps the subclass contract valid.
        super.init(target: nil, action: nil)
        configureForPassivePencilObservation()
    }

    private func configureForPassivePencilObservation() {
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        requiresExclusiveTouchType = false
        allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
        delegate = self
        current.reserveCapacity(320)
        completed.reserveCapacity(completedLimit)
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldReceive touch: UITouch
    ) -> Bool {
        captureEnabled && touch.type == .pencil
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
        current.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
        super.reset()
    }

    func clearPending() {
        current.removeAll(keepingCapacity: true)
        completed.removeAll(keepingCapacity: true)
        strokeStartTimestamp = nil
    }

    func takeCompletedStroke(matching finalBounds: CGRect) -> InkStroke? {
        guard !completed.isEmpty else { return nil }
        let raw = completed.removeFirst()
        guard !raw.isEmpty else { return nil }

        let a = raw.bounds
        let b = finalBounds
        let dx = a.midX - b.midX
        let dy = a.midY - b.midY
        let reference = max(18, hypot(b.width, b.height) * 0.55)
        let expanded = b.insetBy(dx: -max(10, 0.25 * max(b.width, 1)),
                                 dy: -max(10, 0.25 * max(b.height, 1)))
        guard dx * dx + dy * dy <= reference * reference, expanded.intersects(a) else { return nil }
        return raw
    }

    private func appendActualSamples(for touch: UITouch, event: UIEvent) {
        guard current.count < maximumSamplesPerStroke else { return }
        let samples = event.coalescedTouches(for: touch) ?? [touch]
        for sample in samples where sample.type == .pencil {
            if current.count >= maximumSamplesPerStroke { break }
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

        if let last = current.last {
            let dt = abs((last.t ?? 0) - relativeTime)
            let dx = last.x - point.x
            let dy = last.y - point.y
            if dt < 0.000_001 && dx * dx + dy * dy < 0.0001 { return }
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
