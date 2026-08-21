// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native writing surface
//
// A real PKCanvasView sitting over the app's writing area. PencilKit is the
// ink engine Notes is built on: Metal-rendered, fed by the system's predicted
// touches, drawn on the low-latency display path. A canvas element inside a
// web view cannot reach that — its pointer events arrive in the web content
// process after the compositor has already run — which is why the ink here is
// native and everything around it is not.
//
// The surface is transparent, so the ruled paper, the teacher's ✓ and ✗ marks
// and the margin notes drawn by the page below all show through under the ink.
//
// Apple Pencil writes. Fingers fall through to the web page and scroll unless
// the student explicitly enables finger drawing from the toolbar.
// ─────────────────────────────────────────────────────────────────────────────
import PencilKit
import UIKit

protocol InkSurfaceDelegate: AnyObject {
    /// Ordinary pen input appends one final stroke. Keeping this incremental is
    /// what prevents a long page from being re-sampled and re-serialized every
    /// time the Pencil comes off the glass.
    func inkSurface(_ surface: InkSurfaceView, didAppend stroke: InkStroke, at index: Int)
    /// Erase/undo/redo/restore can change arbitrary indexes, so those operations
    /// deliberately publish a full snapshot.
    func inkSurfaceDidReplaceStrokes(_ surface: InkSurfaceView)
}

final class InkSurfaceView: UIView, PKCanvasViewDelegate {

    weak var delegate: InkSurfaceDelegate?

    let canvas = PKCanvasView()

    /// Explicit "let me draw with a finger too" from the toolbar.
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

    /// Passive high-fidelity observation of the same Pencil stream PencilKit
    /// renders. It records real coalesced touches only; predicted samples stay
    /// in the rendering path and never enter recognition/training evidence.
    private let pencilTelemetry = InkPencilTelemetryRecognizer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(canvas)
        backgroundColor = .clear
        isOpaque = false

        canvas.delegate = self
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // The canvas is a scroll view; here it is a fixed sheet of paper. The
        // page underneath does the scrolling.
        canvas.isScrollEnabled = false
        canvas.bounces = false
        canvas.bouncesZoom = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.showsVerticalScrollIndicator = false
        canvas.showsHorizontalScrollIndicator = false
        canvas.contentInsetAdjustmentBehavior = .never
        // PencilKit adapts ink colours for dark mode — it assumes a drawing was
        // authored on white paper and darkens light strokes so they stay
        // readable. Here the paper is already near-black and the pen colour is
        // the one the theme wants shown, so that adaptation only washes it out.
        // Pinning the canvas to the light style turns it off; the canvas itself
        // is transparent, so nothing else about it changes.
        canvas.overrideUserInterfaceStyle = .light

        // This recognizer cannot prevent or cancel PencilKit's own gestures; it
        // only observes the same hardware samples for the recognition stream.
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

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hit = super.hitTest(point, with: event) else { return nil }
        if fingerDrawingEnabled { return hit }
        // The overlay must not win a finger touch just because it visually sits
        // above WKWebView. A Pencil touch stays native; everything else falls
        // through so the page's scroll view owns it from the first interaction,
        // not only after a Pencil has previously been seen.
        let touches = event?.allTouches ?? []
        return touches.contains(where: { $0.type == .pencil }) ? hit : nil
    }

    // MARK: - Tools

    private func applyTool() {
        pencilTelemetry.nominalWidth = penWidth
        switch tool {
        case .pen:
            pencilTelemetry.captureEnabled = true
            // PencilKit keeps the device's pressure/azimuth/altitude and system
            // prediction in the rendered PKStroke. We only choose the nominal
            // pen width here; no custom smoothing is inserted in front of it.
            canvas.tool = PKInkingTool(.pen, color: inkColor, width: penWidth)
        case .eraser:
            // Whole strokes, matching how the app's eraser has always behaved.
            // Eraser Pencil touches are not handwriting evidence and are never
            // allowed into the telemetry queue.
            pencilTelemetry.captureEnabled = false
            pencilTelemetry.clearPending()
            canvas.tool = PKEraserTool(.vector)
        }
    }

    private func applyDrawingPolicy() {
        canvas.drawingPolicy = fingerDrawingEnabled ? .anyInput : .pencilOnly
    }

    // MARK: - History

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        pushHistory()
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }

        // Pen input is append-only in the normal case. Use the actual coalesced
        // Pencil samples when they geometrically match the PKStroke that just
        // finished; fall back to deterministic PencilKit spline sampling on
        // simulator/legacy paths where raw telemetry was unavailable.
        let drawingStrokes = canvasView.drawing.strokes
        if tool == .pen,
           drawingStrokes.count == cachedStrokes.count + 1,
           let last = drawingStrokes.last {
            let fallback = StrokeCodec.stroke(from: last)
            let stroke = pencilTelemetry.takeCompletedStroke(matching: fallback.bounds) ?? fallback
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
        // A destructive PencilKit operation changes arbitrary stroke identity;
        // discard any unpaired telemetry rather than risk cross-stroke ownership.
        pencilTelemetry.clearPending()
        cachedStrokes = StrokeCodec.strokes(from: canvas.drawing)
        delegate?.inkSurfaceDidReplaceStrokes(self)
    }

    // MARK: - Strokes

    /// O(1) with respect to PencilKit conversion: the expensive spline sampling
    /// is done once when a stroke finishes, not again for every recognition.
    var strokes: [InkStroke] { cachedStrokes }

    func setStrokes(_ strokes: [InkStroke]) {
        pushHistory()
        replaceDrawing(StrokeCodec.drawing(from: strokes, color: inkColor), knownStrokes: strokes)
    }

    var isEmpty: Bool { cachedStrokes.isEmpty }
}
