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
// Fingers still scroll. A touch that is not a Pencil is refused by hitTest and
// falls through to the web view underneath — the same rule the app has always
// had (once a Pencil has been seen, fingers scroll and the Pencil writes),
// only now enforced where the touch actually arrives.
// ─────────────────────────────────────────────────────────────────────────────
import PencilKit
import UIKit

protocol InkSurfaceDelegate: AnyObject {
    func inkSurfaceDidChangeStrokes(_ surface: InkSurfaceView)
}

final class InkSurfaceView: UIView, PKCanvasViewDelegate {

    weak var delegate: InkSurfaceDelegate?

    let canvas = PKCanvasView()

    /// Once a Pencil has written, fingers go back to scrolling the page.
    private(set) var pencilSeen = false
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
    private var suppressChangeEvents = false
    private let historyLimit = 60

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
        applyTool()
        applyDrawingPolicy()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
        canvas.contentSize = bounds.size
    }

    // MARK: - Touch routing

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hit = super.hitTest(point, with: event) else { return nil }
        let touches = event?.allTouches ?? []
        if touches.contains(where: { $0.type == .pencil }) {
            if !pencilSeen {
                pencilSeen = true
                applyDrawingPolicy()
            }
            return hit
        }
        // Before any Pencil has been seen the app is being used with a finger
        // (or a trackpad), so a finger writes. After that it scrolls, unless
        // the student has asked for both.
        if fingerDrawingEnabled || !pencilSeen { return hit }
        return nil
    }

    // MARK: - Tools

    private func applyTool() {
        switch tool {
        case .pen:
            canvas.tool = PKInkingTool(.pen, color: inkColor, width: penWidth)
        case .eraser:
            // Whole strokes, matching how the app's eraser has always behaved.
            canvas.tool = PKEraserTool(.vector)
        }
    }

    private func applyDrawingPolicy() {
        canvas.drawingPolicy = (fingerDrawingEnabled || !pencilSeen) ? .anyInput : .pencilOnly
    }

    // MARK: - History

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        pushHistory()
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }
        delegate?.inkSurfaceDidChangeStrokes(self)
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
        guard !canvas.drawing.strokes.isEmpty else { return }
        pushHistory()
        replaceDrawing(PKDrawing())
    }

    private func replaceDrawing(_ drawing: PKDrawing) {
        suppressChangeEvents = true
        canvas.drawing = drawing
        suppressChangeEvents = false
        delegate?.inkSurfaceDidChangeStrokes(self)
    }

    // MARK: - Strokes

    var strokes: [InkStroke] { StrokeCodec.strokes(from: canvas.drawing) }

    func setStrokes(_ strokes: [InkStroke]) {
        pushHistory()
        replaceDrawing(StrokeCodec.drawing(from: strokes, color: inkColor))
    }

    var isEmpty: Bool { canvas.drawing.strokes.isEmpty }
}
