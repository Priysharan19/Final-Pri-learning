// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative bridge self-check (`--bridge-selfcheck`, CP-02)
//
// Runs inside the real shell after the bundled app loads and logs one line per
// check, prefixed PRIBRIDGE, for scripts/native-bridge-selfcheck.mjs to read
// on any simulator (iPad or iPhone). It proves, in WebKit itself:
//   · the host descriptor exists, is deep-frozen and cannot be replaced;
//   · it advertises capabilities and carries no OS identity;
//   · a main-frame envelope round-trips through priBridge;
//   · a same-origin SUBFRAME is refused (no reply, ever).
// Synthetic simulator evidence only; it says nothing about physical devices.
// ─────────────────────────────────────────────────────────────────────────────
#if DEBUG
// Debug/simulator builds only: never compiled into a Release (App Store) build.
import WebKit

enum BridgeSelfCheck {
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
    const frame = document.createElement('iframe');
    frame.srcdoc = '<!doctype html><title>x</title>';
    document.body.appendChild(frame);
    await new Promise(r => frame.addEventListener('load', r, { once: true }));
    out.subframeHasHost = !!frame.contentWindow.__PRI_HOST__;
    try { send(frame.contentWindow, 'selfcheck-subframe', 'storage', 'status'); out.subframeCouldPost = true; } catch (e) { out.subframeCouldPost = false; }
    await new Promise(r => setTimeout(r, 1500));
    window.__priNativeReceive = original;
    frame.remove();
    out.mainRoundTrip = replies['selfcheck-main']?.ok === true && replies['selfcheck-main'].result?.durable === true;
    out.subframeRefused = !replies['selfcheck-subframe'];
    return JSON.stringify(out);
    """

    @MainActor
    static func run(in webView: WKWebView) {
        NSLog("PRIBRIDGE bridge self-check started")
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                guard let text = value as? String,
                      let data = text.data(using: .utf8),
                      let out = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    NSLog("PRIBRIDGE FAIL unreadable self-check result")
                    return
                }
                var failures = 0
                for key in ["hostPresent", "deepFrozen", "notReplaceable", "noOsIdentity", "mainRoundTrip", "subframeRefused"] {
                    let ok = out[key] as? Bool == true
                    if !ok { failures += 1 }
                    NSLog("PRIBRIDGE %@ %@", ok ? "ok" : "FAIL", key)
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
                NSLog("PRIBRIDGE %@ inkPlacementZoom", placementOK ? "ok" : "FAIL")
                let subframeHost = out["subframeHasHost"] as? Bool == true
                if subframeHost { failures += 1 }
                NSLog("PRIBRIDGE %@ subframeHasNoHost", subframeHost ? "FAIL" : "ok")
                NSLog("PRIBRIDGE capabilities %@", out["capabilities"] as? String ?? "")
                NSLog("PRIBRIDGE summary %d failure(s)", failures)
            case .failure(let error):
                NSLog("PRIBRIDGE FAIL script error %@", String(describing: error))
            }
        }
    }
}

#endif
