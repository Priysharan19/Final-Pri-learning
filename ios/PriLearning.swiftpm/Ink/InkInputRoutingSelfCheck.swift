// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink input-routing self-check
//
// Prevents the transparent native overlay from swallowing WKWebView controls.
// The clip view may cover most of the page for clipping, but only the actual
// writing child is allowed to become a hit-test target.
// ─────────────────────────────────────────────────────────────────────────────
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
        // Finger mode lets a nil UIEvent exercise the actual writing child in
        // this deterministic test. Production remains pencilOnly by default.
        bridge.handle(["op": "tool", "tool": "pen", "finger": true])

        guard container.subviews.count >= 2 else {
            NSLog("PRIINK input FAIL 0/3: overlay missing")
            return
        }

        let clip = container.subviews[1]
        let surface = clip.subviews.first

        // Inside clipping rect, above the writing surface: must fall through.
        check("transparent clip space passes through",
              clip.hitTest(CGPoint(x: 20, y: 20), with: nil) == nil)

        // Inside the actual writing surface: a descendant must own the touch.
        if let surface {
            let point = CGPoint(x: surface.frame.midX, y: surface.frame.midY)
            check("writing surface remains interactive",
                  clip.hitTest(point, with: nil) != nil)
        } else {
            check("writing surface remains interactive", false)
        }

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
