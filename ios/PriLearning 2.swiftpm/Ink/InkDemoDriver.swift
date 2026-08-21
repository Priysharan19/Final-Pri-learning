// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink demo driver  (debug only — --ink-demo)
//
// Walks the real app to a real question in ✎ Write mode and puts ink on the
// real writing surface, so the native canvas can be seen where it actually
// lives: over the page's ruled paper, inside the real layout, with the real
// reading panel underneath it reporting what it read.
//
// The bridge smoke test proves the surface mounts, positions and reads. This
// proves it does so in the app rather than in a test harness — the one thing a
// simulator without an Apple Pencil can still show.
// ─────────────────────────────────────────────────────────────────────────────
import UIKit
import WebKit

final class InkDemoDriver {

    private weak var webView: WKWebView?
    private weak var bridge: InkBridge?
    private var timer: Timer?
    private var step = 0
    private var ticks = 0
    private var ticksOnStep = 0
    private var inkPlaced = false

    /// Helpers the steps below are written against.
    private static let helpers = """
    window.__priTapText = (pattern) => {
      const rx = new RegExp(pattern, 'i');
      const candidates = document.querySelectorAll('button, a, .linklike, [role=button]');
      for (const el of candidates) {
        if (el.offsetParent === null) continue;
        if (!rx.test((el.textContent || '').trim())) continue;
        el.click();
        return true;
      }
      return false;
    };
    window.__priTapSelector = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.click();
      return true;
    };
    """

    private static let steps = [
        "window.__priTapText('Get Started')",
        "window.__priTapText('Try the demo')",
        "window.__priTapText('Smart practice|Start reviewing|Practice')",
        #"window.__priTapSelector("[aria-label='Answer by handwriting']")"#
    ]

    func start(webView: WKWebView, bridge: InkBridge) {
        self.webView = webView
        self.bridge = bridge
        timer = Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func tick() {
        guard let webView else { return }
        ticks += 1
        // A minute is far longer than the walk takes; past that something is
        // wrong and continuing would only fill the log.
        if ticks > 100 { timer?.invalidate(); return }

        if step >= Self.steps.count {
            placeInk()
            return
        }

        // A step whose button is not on screen is a step that does not apply —
        // a profile already unlocked skips the welcome screen entirely — so
        // each one is given a while and then passed over rather than blocking
        // the walk behind it.
        ticksOnStep += 1
        if ticksOnStep > 10 {
            NSLog("PRIINK demo step %d skipped", step)
            step += 1
            ticksOnStep = 0
            return
        }

        let script = Self.helpers + "\n" + Self.steps[step] + ";"
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            guard let self else { return }
            if (result as? Bool) == true {
                NSLog("PRIINK demo step %d done", self.step)
                self.step += 1
                self.ticksOnStep = 0
            }
        }
    }

    private func placeInk() {
        guard !inkPlaced, let bridge, bridge.isMounted else { return }
        inkPlaced = true
        let strokes = InkSelfCheck.demoStrokes()
        NSLog("PRIINK demo writing %d strokes onto the mounted surface", strokes.count)
        bridge.handle(["op": "setStrokes", "strokes": strokes.map(\.jsonObject)])
        timer?.invalidate()
    }
}
