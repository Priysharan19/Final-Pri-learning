// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink input-routing self-check
//
// Prevents the transparent native overlay from swallowing WKWebView controls
// and proves the PencilKit surface keeps an explicit Pencil-only policy unless
// finger drawing is deliberately enabled.
// ─────────────────────────────────────────────────────────────────────────────
import PencilKit
import UIKit
import WebKit

enum InkInputRoutingSelfCheck {
    @MainActor
    static func run() {
        var failures: [String] = []
        var checks = 0

        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1024, height: 768))
        let container = UIView(frame: webView.frame)
        container.addSubview(webView)

        let bridge = InkBridge()
        bridge.attach(to: webView, in: container)
        bridge.handle([
            "op": "mount",
            "frame": ["x": 60, "y": 220, "w": 880, "h": 380],
            "clip": ["x": 47, "y": 54, "w": 977, "h": 714],
            "scrollX": 0, "scrollY": 0,
            "ink": "#efece1"
        ])

        guard container.subviews.count >= 2 else {
            NSLog("PRIINK input FAIL 0/5: overlay missing")
            return
        }

        let clip = container.subviews[1]
        guard let surface = clip.subviews.first as? InkSurfaceView else {
            NSLog("PRIINK input FAIL 0/5: writing surface missing")
            return
        }

        // In production mode only Pencil is a drawing input. Finger touches in
        // the writing region are intentionally allowed to fall through so the
        // surrounding WKWebView can continue to scroll/navigate naturally.
        bridge.handle(["op": "tool", "tool": "pen", "finger": false])
        check("PencilKit policy is pencilOnly",
              surface.canvas.drawingPolicy == .pencilOnly)

        let pencilRaw = NSNumber(value: UITouch.TouchType.pencil.rawValue)
        check("drawing recognizer explicitly accepts Pencil",
              surface.canvas.drawingGestureRecognizer.allowedTouchTypes == [pencilRaw])

        // Inside clipping rect, above the writing surface: must fall through.
        check("transparent clip space passes through",
              clip.hitTest(CGPoint(x: 20, y: 20), with: nil) == nil)

        // A nil/early UIEvent must not cause the wrapper to reject the real
        // writing child before PencilKit has a chance to classify the touch.
        let point = CGPoint(x: surface.frame.midX, y: surface.frame.midY)
        check("writing surface survives early hit testing",
              clip.hitTest(point, with: nil) != nil)

        bridge.handle(["op": "unmount"])
        check("unmounted overlay cannot intercept input",
              clip.hitTest(CGPoint(x: 20, y: 20), with: nil) == nil)

        if failures.isEmpty {
            NSLog("PRIINK input PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK input FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }
}
