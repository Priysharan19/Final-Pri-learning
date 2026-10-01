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
