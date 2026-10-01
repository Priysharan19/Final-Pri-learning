// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · student journey self-check (`--journey-selfcheck`, CP-04/05)
//
// Drives the real bundled app inside the real WKWebView, the way a student
// moves through it, and logs one PRIJOURNEY line per step for
// scripts/iphone-journey.mjs:
//   launch → onboarding/profile → Home → Practice → a typed attempt that is
//   marked → feedback → next question → native ink (finger-default fact,
//   programmatic strokes through priInk, a reading comes back) → Progress →
//   a persistence marker. `--journey-relaunch` then proves, on a second
//   launch, that the profile and marker survived (IndexedDB/localStorage under
//   the unchanged prilearning://app origin).
// Synthetic simulator evidence. It never stands in for a physical device.
// ─────────────────────────────────────────────────────────────────────────────
#if DEBUG
// Debug/simulator builds only: never compiled into a Release (App Store) build.
import WebKit

enum JourneySelfCheck {
    static var phase: String? {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--journey-relaunch") { return "relaunch" }
        if args.contains("--journey-selfcheck") { return "first" }
        return nil
    }

    private static let helpers = """
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function waitFor(fn, ms = 25000) {
      const t = Date.now();
      while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(120); }
      throw new Error('timed out');
    }
    const q = s => document.querySelector(s);
    const byLabel = l => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === l);
    function setValue(el, v) {
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async function nav(href) {
      const link = await waitFor(() => [...document.querySelectorAll('a[href="' + href + '"]')].find(a => a.offsetParent));
      link.click();
    }
    const steps = {};
    let at = '';
    async function step(name, fn) {
      at = '';
      try { const detail = await fn(); steps[name] = { ok: true, detail: detail === undefined ? '' : String(detail).slice(0, 120) }; }
      catch (e) { steps[name] = { ok: false, detail: (String(e && e.message || e) + ' at ' + at + ' · ' + (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 90)).slice(0, 220) }; }
    }
    """

    private static let firstLaunch = helpers + """
    await step('launch', async () => { await waitFor(() => q('.auth-card') || q('.home-greet') || byLabel('Get Started')); return location.href; });
    await step('onboarding', async () => {
      at = 'get-started'; (await waitFor(() => byLabel('Get Started'))).click();
      at = 'step1'; await waitFor(() => q('[data-onboarding-step="1"]'));
      at = 'student'; (await waitFor(() => byLabel('Student'))).click(); await sleep(150); q('.auth-card .btn-primary').click();
      at = 'step2'; await waitFor(() => q('[data-onboarding-step="2"]'));
      at = 'track'; setValue(await waitFor(() => q('#signup-track')), '10'); await sleep(200); q('.auth-card .btn-primary').click();
      at = 'step3'; await waitFor(() => q('[data-onboarding-step="3"]'));
      at = 'name'; setValue(await waitFor(() => q('#signup-name')), 'Journey Student'); await sleep(200); q('.auth-card .btn-primary').click();
      at = 'step4'; await waitFor(() => q('[data-onboarding-step="4"]')); await sleep(150); q('.auth-card .btn-primary').click();
      at = 'step5'; await waitFor(() => q('[data-onboarding-step="5"]')); await sleep(150); q('.auth-card .btn-primary').click();
      at = 'home'; await waitFor(() => q('.home-greet'));
      return document.documentElement.dataset.ff || '';
    });
    await step('practice', async () => { await nav('/practice'); await waitFor(() => q('.q-prompt')); return 'question shown'; });
    await step('typedAttempt', async () => {
      for (let i = 0; i < 12; i++) {
        const typing = byLabel('Answer by typing');
        if (typing) { typing.click(); await sleep(250); }
        const input = q('.editor-body input.answer-input');
        if (input) {
          setValue(input, '12345'); await sleep(200);
          const submit = [...document.querySelectorAll('.editor-foot .btn-primary')].find(b => b.offsetParent && !b.disabled);
          if (submit) {
            submit.click();
            // Marked: a first wrong answer shows a verdict and offers one more
            // go; a resolved answer shows the redo chip and evaluation.
            await waitFor(() => q('.verdict') || q('.redo-chip') || q('.your-answer'));
            return 'marked after ' + (i + 1) + ' question(s)';
          }
        }
        q('.ctx-next')?.click(); await sleep(900);
      }
      throw new Error('no typed question found');
    });
    await step('feedback', async () => {
      const v = await waitFor(() => q('.verdict') || q('.your-answer'));
      return (v.innerText || '').replace(/\\s+/g, ' ').slice(0, 80);
    });
    await step('nextQuestion', async () => {
      const before = q('.q-prompt')?.textContent || '';
      q('.ctx-next').click();
      await waitFor(() => q('.q-prompt') && q('.q-prompt').textContent !== before);
      return 'advanced';
    });
    await step('nativeInk', async () => {
      const ink = window.__PRI_HOST__?.capabilities?.ink;
      if (!ink) throw new Error('host advertises no ink');
      const facts = 'stylus=' + ink.stylus + ' fingerDefault=' + ink.fingerDefault;
      const handler = window.webkit.messageHandlers.priInk;
      const original = window.__priInkReceive;
      let reading = null;
      window.__priInkReceive = p => { if (p && p.type === 'reading' && p.reqId === 424242) reading = p; if (original) original(p); };
      const line = (x0, y0, x1, y1) => ({ points: Array.from({ length: 12 }, (_, i) => ({ x: x0 + (x1 - x0) * i / 11, y: y0 + (y1 - y0) * i / 11, t: i * 0.01, p: 0.5 })) });
      handler.postMessage({ op: 'mount', frame: { x: 40, y: 200, w: 300, h: 200 }, clip: { x: 0, y: 0, w: 2000, h: 2000 }, scrollX: 0, scrollY: 0, ink: '#efece1' });
      handler.postMessage({ op: 'setStrokes', strokes: [line(100, 60, 100, 160), line(150, 110, 210, 110), line(180, 80, 180, 140)] });
      handler.postMessage({ op: 'recognize', reqId: 424242, overrides: {} });
      try { await waitFor(() => reading, 20000); } finally { window.__priInkReceive = original; handler.postMessage({ op: 'unmount' }); }
      return facts + ' engine=' + (reading.engine || '') + ' text=' + JSON.stringify(reading.text || '');
    });
    await step('progress', async () => { await nav('/progress'); await waitFor(() => location.pathname === '/progress' && q('main')); return 'progress shown'; });
    await step('persistenceMarker', async () => { localStorage.setItem('pri-journey-marker', 'kept'); return 'written'; });
    return JSON.stringify(steps);
    """

    private static let relaunch = helpers + """
    await step('relaunchProfile', async () => {
      await waitFor(() => q('.home-greet') || q('.auth-card'));
      if (!q('.home-greet')) {
        // A profile picker is also proof the profile survived.
        const picker = [...document.querySelectorAll('.auth-card button')].find(b => /Journey Student/.test(b.textContent));
        if (!picker) throw new Error('profile not found after relaunch');
        picker.click(); await waitFor(() => q('.home-greet'));
      }
      return 'profile survived';
    });
    await step('relaunchMarker', async () => {
      if (localStorage.getItem('pri-journey-marker') !== 'kept') throw new Error('marker lost');
      return location.origin;
    });
    return JSON.stringify(steps);
    """

    @MainActor
    static func run(in webView: WKWebView) {
        guard let phase else { return }
        NSLog("PRIJOURNEY started %@", phase)
        let script = phase == "relaunch" ? relaunch : firstLaunch
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                guard let text = value as? String, let data = text.data(using: .utf8),
                      let steps = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else {
                    NSLog("PRIJOURNEY FAIL unreadable result")
                    return
                }
                var failures = 0
                for (name, info) in steps.sorted(by: { $0.key < $1.key }) {
                    let ok = info["ok"] as? Bool == true
                    if !ok { failures += 1 }
                    NSLog("PRIJOURNEY %@ %@ %@", ok ? "ok" : "FAIL", name, info["detail"] as? String ?? "")
                }
                NSLog("PRIJOURNEY summary %@ %d failure(s)", phase, failures)
            case .failure(let error):
                NSLog("PRIJOURNEY FAIL script error %@", String(describing: error))
            }
        }
    }
}

#endif
