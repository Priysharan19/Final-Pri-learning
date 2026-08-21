// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native writing surface
//
// A real PKCanvasView sitting over the app's writing area. PencilKit owns the
// latency-critical path: system prediction, Metal rendering and Apple Pencil
// sampling remain untouched by recognition or web UI work.
// ─────────────────────────────────────────────────────────────────────────────
import PencilKit
import UIKit

protocol InkSurfaceDelegate: AnyObject {
    func inkSurfaceDidBeginStroke(_ surface: InkSurfaceView)
    func inkSurface(_ surface: InkSurfaceView, didAppend stroke: InkStroke, at index: Int)
    func inkSurfaceDidReplaceStrokes(_ surface: InkSurfaceView)
}

final class InkSurfaceView: UIView, PKCanvasViewDelegate {

    weak var delegate: InkSurfaceDelegate?
    let canvas = PKCanvasView()

    var fingerDrawingEnabled = false { didSet { applyDrawingPolicy() } }

    var inkColor: UIColor = UIColor(red: 0.937, green: 0.925, blue: 0.882, alpha: 1) {
        didSet { applyTool() }
    }
    var penWidth: CGFloat = 4.5 { didSet { applyTool() } }

    enum Tool { case pen, eraser }
    var tool: Tool = .pen { didSet { applyTool() } }

    private var undoStack: [PKDrawing] = []
    private var redoStack: [PKDrawing] = []
    private var cachedStrokes: [InkStroke] = []
    private var suppressChangeEvents = false
    private let historyLimit = 60
    private let pencilTelemetry = InkPencilTelemetryRecognizer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(canvas)
        backgroundColor = .clear
        isOpaque = false

        canvas.delegate = self
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.isScrollEnabled = false
        canvas.bounces = false
        canvas.bouncesZoom = false
        canvas.alwaysBounceHorizontal = false
        canvas.alwaysBounceVertical = false
        canvas.delaysContentTouches = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.showsVerticalScrollIndicator = false
        canvas.showsHorizontalScrollIndicator = false
        canvas.contentInsetAdjustmentBehavior = .never
        canvas.overrideUserInterfaceStyle = .light

        // Passive observer only. PencilKit alone owns visible rendering.
        canvas.addGestureRecognizer(pencilTelemetry)
        pencilTelemetry.nominalWidth = penWidth
        applyTool()
        applyDrawingPolicy()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
        if canvas.contentSize != bounds.size { canvas.contentSize = bounds.size }
    }

    // MARK: - Touch routing

    /// Let PencilKit decide Pencil acceptance through `drawingPolicy`; this
    /// wrapper only passes *definite* finger input through to the WKWebView.
    ///
    /// Earlier code returned nil whenever UIKit had not yet populated
    /// `UIEvent.allTouches`. That can happen during the early hit-test phase and
    /// risks rejecting a real Pencil before PKCanvasView sees it. Unknown/empty
    /// events therefore stay on the canvas; only an event that positively
    /// contains direct finger touches and no Pencil is passed through.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hit = super.hitTest(point, with: event) else { return nil }
        if fingerDrawingEnabled { return hit }

        guard let touches = event?.allTouches, !touches.isEmpty else {
            return hit
        }
        if touches.contains(where: { $0.type == .pencil }) {
            return hit
        }
        if touches.allSatisfy({ $0.type == .direct }) {
            return nil
        }
        return hit
    }

    // MARK: - Tools

    private func applyTool() {
        pencilTelemetry.nominalWidth = penWidth
        switch tool {
        case .pen:
            pencilTelemetry.captureEnabled = true
            canvas.tool = PKInkingTool(.pen, color: inkColor, width: penWidth)
        case .eraser:
            pencilTelemetry.captureEnabled = false
            pencilTelemetry.clearPending()
            canvas.tool = PKEraserTool(.vector)
        }
    }

    private func applyDrawingPolicy() {
        canvas.drawingPolicy = fingerDrawingEnabled ? .anyInput : .pencilOnly
        // Make the drawing recognizer's intent explicit as well as setting the
        // PencilKit policy. This removes finger/Pencil arbitration from the
        // critical path while preserving optional finger-drawing mode.
        let direct = NSNumber(value: UITouch.TouchType.direct.rawValue)
        let pencil = NSNumber(value: UITouch.TouchType.pencil.rawValue)
        canvas.drawingGestureRecognizer.allowedTouchTypes = fingerDrawingEnabled
            ? [direct, pencil]
            : [pencil]
    }

    // MARK: - History / stroke lifecycle

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        // O(1) pen-down callback: abort stale recognition, then let PencilKit run.
        delegate?.inkSurfaceDidBeginStroke(self)
        pushHistory()
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }

        let drawingStrokes = canvasView.drawing.strokes
        if tool == .pen,
           drawingStrokes.count == cachedStrokes.count + 1,
           let last = drawingStrokes.last {
            // Common physical-Pencil path: match the completed coalesced trace
            // against PencilKit's O(1) rendered bounds and avoid walking the
            // B-spline at pen-up. Only simulator/legacy/mismatch paths pay for
            // the deterministic 1.5pt fallback sampling.
            let stroke = pencilTelemetry.takeCompletedStroke(matching: last.renderBounds)
                ?? StrokeCodec.stroke(from: last)
            cachedStrokes.append(stroke)
            delegate?.inkSurface(self, didAppend: stroke, at: cachedStrokes.count - 1)
            return
        }

        resyncCacheAndNotify()
    }

    private func pushHistory() {
        undoStack.append(canvas.drawing)
        if undoStack.count > historyLimit { undoStack.removeFirst() }
        redoStack.removeAll()
    }

    func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(canvas.drawing)
        replaceDrawing(previous)
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(canvas.drawing)
        replaceDrawing(next)
    }

    func clear() {
        guard !canvas.drawing.strokes.isEmpty else {
            cachedStrokes.removeAll(keepingCapacity: true)
            pencilTelemetry.clearPending()
            return
        }
        pushHistory()
        replaceDrawing(PKDrawing(), knownStrokes: [])
    }

    private func replaceDrawing(_ drawing: PKDrawing, knownStrokes: [InkStroke]? = nil) {
        suppressChangeEvents = true
        pencilTelemetry.clearPending()
        canvas.drawing = drawing
        cachedStrokes = knownStrokes ?? StrokeCodec.strokes(from: drawing)
        suppressChangeEvents = false
        delegate?.inkSurfaceDidReplaceStrokes(self)
    }

    private func resyncCacheAndNotify() {
        pencilTelemetry.clearPending()
        cachedStrokes = StrokeCodec.strokes(from: canvas.drawing)
        delegate?.inkSurfaceDidReplaceStrokes(self)
    }

    // MARK: - Strokes

    var strokes: [InkStroke] { cachedStrokes }

    func setStrokes(_ strokes: [InkStroke]) {
        pushHistory()
        replaceDrawing(StrokeCodec.drawing(from: strokes, color: inkColor), knownStrokes: strokes)
    }

    var isEmpty: Bool { cachedStrokes.isEmpty }
}