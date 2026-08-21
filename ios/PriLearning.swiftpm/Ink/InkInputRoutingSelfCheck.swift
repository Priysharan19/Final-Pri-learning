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
            NSLog("PRIINK input FAIL 0/6: overlay missing")
            return
        }

        let clip = container.subviews[1]
        guard let surface = clip.subviews.first as? InkSurfaceView else {
            NSLog("PRIINK input FAIL 0/6: writing surface missing")
            return
        }

        bridge.handle(["op": "tool", "tool": "pen", "finger": false])
        check("PencilKit policy is pencilOnly",
              surface.canvas.drawingPolicy == .pencilOnly)

        let pencilRaw = NSNumber(value: UITouch.TouchType.pencil.rawValue)
        check("drawing recognizer explicitly accepts Pencil",
              surface.canvas.drawingGestureRecognizer.allowedTouchTypes == [pencilRaw])

        // The native sibling should occupy only the visible handwriting region,
        // not the much larger clipping/page region reported by the web app.
        check("overlay frame is limited to visible writing bounds",
              abs(clip.frame.minX - 60) < 1
                && abs(clip.frame.minY - 220) < 1
                && abs(clip.frame.width - 880) < 1
                && abs(clip.frame.height - 380) < 1)

        // A point far above the writing rectangle must resolve entirely outside
        // the native overlay subtree, leaving the WKWebView free to handle it.
        let outside = container.hitTest(CGPoint(x: 20, y: 20), with: nil)
        check("web controls outside writing area stay outside native overlay",
              outside !== clip && !(outside?.isDescendant(of: clip) ?? false))

        // A nil/early UIEvent must not cause the wrapper to reject the real
        // writing child before PencilKit has a chance to classify the touch.
        let point = CGPoint(x: surface.frame.midX, y: surface.frame.midY)
        check("writing surface survives early hit testing",
              clip.hitTest(point, with: nil) != nil)

        bridge.handle(["op": "unmount"])
        check("unmounted overlay cannot intercept input",
              clip.isHidden && clip.frame.isEmpty)

        if failures.isEmpty {
            NSLog("PRIINK input PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK input FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }
}
