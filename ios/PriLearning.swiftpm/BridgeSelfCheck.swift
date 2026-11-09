// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative bridge self-check (`--bridge-selfcheck`, CP-02)
//
// Runs inside the real shell after the bundled app loads and logs one line per
// check, prefixed PRIBRIDGE, for scripts/native-bridge-selfcheck.mjs to read
// on any simulator (iPad or iPhone). It proves, in WebKit itself:
//   · the host descriptor exists, is deep-frozen and cannot be replaced;
//   · it advertises capabilities and carries no OS identity;
//   · a main-frame envelope round-trips through priBridge;
//   · a same-origin SUBFRAME is refused (no reply, ever);
//   · WebShell's navigation policy (and the CSP's frame-src 'none' for
//     fetched frames) keeps a child frame from loading at all, so no child
//     frame can reach the parent's bridge through
//     `parent.webkit.messageHandlers.*` and be credited to the main frame (#260).
//     If a frame does load, the reach-through is attempted and must be refused.
// Synthetic simulator evidence only; it says nothing about physical devices.
// ─────────────────────────────────────────────────────────────────────────────
#if DEBUG
// Debug/simulator builds only: never compiled into a Release (App Store) build.
import WebKit

enum BridgeSelfCheck {

    // Every PRIBRIDGE line goes to the unified log AND to Documents/PRIBRIDGE.log
    // in the app's own container: on the hosted iOS 27 image `log show` returns
    // nothing for the app, and scripts/native-bridge-selfcheck.mjs reads this
    // file first (via `simctl get_app_container`), falling back to the log.
    static let reportURL: URL? = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask).first?
        .appendingPathComponent("PRIBRIDGE.log")

    static func say(_ line: String, reset: Bool = false) {
        NSLog("%@", line)
        guard let url = reportURL, let data = (line + "\n").data(using: .utf8) else { return }
        if !reset, let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: url, options: .atomic)
        }
    }
    static var requested: Bool { ProcessInfo.processInfo.arguments.contains("--bridge-selfcheck") }

    private static let script = """
    const out = {};
    const h = window.__PRI_HOST__;
    out.hostPresent = !!h && h.protocol === 1;
    out.deepFrozen = !!h && Object.isFrozen(h) && Object.isFrozen(h.capabilities) && Object.isFrozen(h.capabilities.share || {});
    try { window.__PRI_HOST__ = { protocol: 99 }; } catch (e) {}
    out.notReplaceable = window.__PRI_HOST__ === h;
    out.noOsIdentity = !!h && !('platform' in h) && !/"ios"|iphone|ipad/i.test(JSON.stringify(h));
    out.capabilities = h ? Object.keys(h.capabilities).sort().join(',') : '';
    const send = (target, id, cap, op) => target.webkit.messageHandlers.priBridge.postMessage({ v: 1, id, cap, op, payload: {} });
    const replies = {};
    const original = window.__priNativeReceive;
    window.__priNativeReceive = msg => { if (msg && msg.id) replies[msg.id] = msg; if (original) original(msg); };
    send(window, 'selfcheck-main', 'storage', 'status');
    // A child frame: WebShell cancels every subframe navigation (#260), so the
    // about:srcdoc document never loads (WebKit does not apply the CSP's
    // frame-src to srcdoc). A CSP violation event or a 1.5 s silence counts.
    const cspBlocked = [];
    const onViolation = e => { if (e.effectiveDirective === 'frame-src' || e.violatedDirective === 'frame-src') cspBlocked.push(e.blockedURI || 'frame'); };
    document.addEventListener('securitypolicyviolation', onViolation);
    const frame = document.createElement('iframe');
    frame.srcdoc = '<!doctype html><title>x</title>';
    document.body.appendChild(frame);
    const loaded = await new Promise(r => {
      const timer = setTimeout(() => r(false), 1500);
      frame.addEventListener('load', () => { clearTimeout(timer); r(true); }, { once: true });
    });
    await new Promise(r => setTimeout(r, 50));
    document.removeEventListener('securitypolicyviolation', onViolation);
    const child = loaded ? frame.contentWindow : null;
    const childHasDocument = !!child && !!frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentDocument.title === 'x';
    out.subframeBlockedByCsp = cspBlocked.length > 0 || !childHasDocument;
    out.subframeHasHost = !!child && !!child.__PRI_HOST__;
    if (childHasDocument) {
      // Direct post from the child's own bridge object (must be refused: not the main frame).
      try { send(child, 'selfcheck-subframe', 'storage', 'status'); out.subframeCouldPost = true; } catch (e) { out.subframeCouldPost = false; }
      // Reach-through: the child invokes the PARENT's bridge object. Through the
      // child realm's own Reflect so the call is made from the child's context.
      try {
        const handler = child.parent.webkit.messageHandlers.priBridge;
        child.Reflect.apply(handler.postMessage, handler, [{ v: 1, id: 'selfcheck-reachthrough', cap: 'storage', op: 'status', payload: {} }]);
        out.subframeReachThroughAttempted = true;
      } catch (e) { out.subframeReachThroughAttempted = false; }
    } else {
      out.subframeCouldPost = false;
      out.subframeReachThroughAttempted = false;
    }
    await new Promise(r => setTimeout(r, 1500));
    window.__priNativeReceive = original;
    frame.remove();
    out.mainRoundTrip = replies['selfcheck-main']?.ok === true && replies['selfcheck-main'].result?.durable === true;
    out.subframeRefused = !replies['selfcheck-subframe'];
    // Passes when no child frame could exist (CSP) or when the reach-through got no reply.
    out.subframeReachThroughRefused = !replies['selfcheck-reachthrough'];
    return JSON.stringify(out);
    """

    @MainActor
    static func run(in webView: WKWebView, ink: InkBridge) {
        say("PRIBRIDGE bridge self-check started", reset: true)
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                guard let text = value as? String,
                      let data = text.data(using: .utf8),
                      let out = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    say("PRIBRIDGE FAIL unreadable self-check result")
                    return
                }
                var failures = 0
                for key in ["hostPresent", "deepFrozen", "notReplaceable", "noOsIdentity", "mainRoundTrip", "subframeRefused", "subframeReachThroughRefused"] {
                    let ok = out[key] as? Bool == true
                    if !ok { failures += 1 }
                    say(String(format: "PRIBRIDGE %@ %@", ok ? "ok" : "FAIL", key))
                }
                // Native ink placement math under a page scale (Dynamic Type through the
                // viewport, or pinch; zoom = pageZoom × scrollView.zoomScale): zoom 1 must
                // equal the pre-zoom layout; zoom 1.5 must scale every coordinate.
                let frame = CGRect(x: 100, y: 200, width: 300, height: 150)
                let clip = CGRect(x: 0, y: 50, width: 800, height: 600)
                let one = InkBridge.placement(frame: frame, clip: clip, reportedOffset: CGPoint(x: 0, y: 40),
                                              contentOffset: CGPoint(x: 0, y: 40), zoom: 1, viewBounds: .zero)
                let zoomed = InkBridge.placement(frame: frame, clip: clip, reportedOffset: CGPoint(x: 0, y: 40),
                                                 contentOffset: CGPoint(x: 0, y: 60), zoom: 1.5, viewBounds: .zero)
                let placementOK =
                    one.clipFrame == clip && one.surfaceCenter == CGPoint(x: 250, y: 225) && one.scale == 1 &&
                    one.surfaceBounds.size == frame.size &&
                    zoomed.clipFrame == CGRect(x: 0, y: 75, width: 1200, height: 900) &&
                    zoomed.surfaceCenter == CGPoint(x: 375, y: 337.5) && zoomed.scale == 1.5 &&
                    zoomed.surfaceBounds.size == frame.size
                if !placementOK { failures += 1 }
                say(String(format: "PRIBRIDGE %@ inkPlacementZoom", placementOK ? "ok" : "FAIL"))
                let subframeHost = out["subframeHasHost"] as? Bool == true
                if subframeHost { failures += 1 }
                say(String(format: "PRIBRIDGE %@ subframeHasNoHost", subframeHost ? "FAIL" : "ok"))
                // Informational: whether the shell CSP stopped the child frame from
                // loading (expected: subframe navigations are cancelled); the gate above is the pass/fail.
                say(String(format: "PRIBRIDGE info subframeBlockedByCsp %@", out["subframeBlockedByCsp"] as? Bool == true ? "true" : "false"))
                say(String(format: "PRIBRIDGE capabilities %@", out["capabilities"] as? String ?? ""))
                say(String(format: "PRIBRIDGE summary %d failure(s)", failures))
                if contentEndRequested { armContentEnd(ink: ink) }
            case .failure(let error):
                say(String(format: "PRIBRIDGE FAIL script error %@", String(describing: error)))
            }
        }
    }

    // ── The page's WebContent process ends (`--bridge-content-end`) ──
    // scripts/native-bridge-selfcheck.mjs ends the real WebContent process from
    // the host (SIGKILL, as iOS's memory pressure does) once the native ink
    // surface is mounted with a stroke on it. Every load after that runs
    // runRecovery: the page is the app again, the bridge answers, and the ink
    // surface of the page that ended is gone. Before WebShell handled
    // webViewWebContentProcessDidTerminate, WebKit reloaded the page on its own
    // and the surface stayed mounted, with the old ink, above the new page.

    static var contentEndRequested: Bool { ProcessInfo.processInfo.arguments.contains("--bridge-content-end") }
    static var awaitingContentEnd = false
    private static var recoveries = 0

    @MainActor
    static func armContentEnd(ink: InkBridge) {
        ink.handle(["op": "mount",
                    "frame": ["x": 40, "y": 160, "width": 600, "height": 300],
                    "clip": ["x": 0, "y": 0, "width": 800, "height": 800],
                    "scrollX": 0, "scrollY": 0])
        ink.handle(["op": "setStrokes",
                    "strokes": [["points": [["x": 10, "y": 10], ["x": 200, "y": 120], ["x": 320, "y": 40]]]]])
        let s = ink.surfaceState
        let ok = s.mounted && s.visible && s.strokes == 1
        say("PRIBRIDGE \(ok ? "ok" : "FAIL") inkMountedBeforeContentEnd")
        awaitingContentEnd = true
        say("PRIBRIDGE ready for content process end")
    }

    static func contentProcessEnded(count: Int, reloading: Bool, inkMounted: Bool) {
        guard requested else { return }
        say("PRIBRIDGE contentProcessEnded n=\(count) action=\(reloading ? "reload" : "stopped") inkMounted=\(inkMounted)")
    }

    static func contentStoppedShown() {
        guard requested else { return }
        say("PRIBRIDGE contentStopped shown")
    }

    private static let recoveryScript = """
    const out = {};
    const h = window.__PRI_HOST__;
    const root = document.getElementById('root');
    out.pageAlive = document.readyState === 'complete' && !!h && h.protocol === 1 && !!root && root.childElementCount > 0;
    let reply = null;
    const original = window.__priNativeReceive;
    window.__priNativeReceive = msg => { if (msg && msg.id === 'recovery-main') reply = msg; if (original) original(msg); };
    window.webkit.messageHandlers.priBridge.postMessage({ v: 1, id: 'recovery-main', cap: 'storage', op: 'status', payload: {} });
    for (let i = 0; i < 30 && !reply; i++) await new Promise(r => setTimeout(r, 100));
    window.__priNativeReceive = original;
    out.bridge = reply?.ok === true;
    return JSON.stringify(out);
    """

    @MainActor
    static func runRecovery(in webView: WKWebView, ink: InkBridge) {
        recoveries += 1
        let n = recoveries
        webView.callAsyncJavaScript(recoveryScript, arguments: [:], in: nil, in: .page) { result in
            var out: [String: Any] = [:]
            if case .success(let value) = result, let text = value as? String, let data = text.data(using: .utf8) {
                out = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            }
            let s = ink.surfaceState
            // The reload policy, as a table: a run of more than 2 ends, each within 30 s of the last, stops reloading.
            let now = Date()
            let policy = WebShell.Coordinator.self
            let policyOK =
                policy.recovery(after: [], at: now) == ([now], true) &&
                policy.recovery(after: [now - 10], at: now).reload &&
                !policy.recovery(after: [now - 10, now - 5], at: now).reload &&
                policy.recovery(after: [now - 40, now - 5], at: now) == ([now - 5, now], true) &&
                // A slow crash loop, each end 20 s after the last, still stops.
                !policy.recovery(after: [now - 40, now - 20], at: now).reload
            let checks: [(String, Bool)] = [
                ("pageAliveAfterContentEnd", out["pageAlive"] as? Bool == true),
                ("bridgeAfterContentEnd", out["bridge"] as? Bool == true),
                ("inkDroppedAfterContentEnd", !s.mounted && !s.visible && s.strokes == 0),
                ("recoveryPolicy", policyOK),
            ]
            var failures = 0
            for (key, ok) in checks {
                if !ok { failures += 1 }
                say("PRIBRIDGE \(ok ? "ok" : "FAIL") \(key) (load \(n))")
            }
            if !s.mounted && !s.visible && s.strokes == 0 {} else {
                say("PRIBRIDGE info ink after load \(n): mounted=\(s.mounted) visible=\(s.visible) strokes=\(s.strokes)")
            }
            say("PRIBRIDGE recovery \(n) summary \(failures) failure(s)")
        }
    }
}

#endif
