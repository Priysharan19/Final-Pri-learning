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
        if args.contains("--journey-cloud-signup") { return "cloudSignUp" }
        if args.contains("--journey-offline") { return "offline" }
        if args.contains("--journey-background") { return "background" }
        if args.contains("--journey-a11y") { return "a11y" }
        if args.contains("--journey-cloud-relaunch") { return "cloudRelaunch" }
        if args.contains("--journey-cloud") { return "cloud" }
        if args.contains("--journey-dynamic-type") { return "dynamicType" }
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
    await step('nativePhoto', async () => {
      // Native, offline photo reading (Vision) on a rendered line of maths. The
      // reader is answer-blind: it only ever sees the picture.
      const handler = window.webkit.messageHandlers.priPhoto;
      if (!handler) throw new Error('no native photo reader');
      const c = document.createElement('canvas'); c.width = 900; c.height = 220;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#000'; g.font = 'bold 96px Helvetica, Arial, sans-serif'; g.fillText('2x + 3 = 11', 40, 145);
      const original = window.__priPhotoReceive;
      let got = null;
      window.__priPhotoReceive = p => { if (p && p.reqId === 777001) got = p; if (original) original(p); };
      try {
        handler.postMessage({ reqId: 777001, dataURL: c.toDataURL('image/png') });
        await waitFor(() => got, 20000);
      } finally { window.__priPhotoReceive = original; }
      if (!got.ok) throw new Error('reader failed: ' + (got.error || ''));
      if (!/11/.test(got.text || '')) throw new Error('read ' + JSON.stringify(got.text || ''));
      return 'engine=' + got.engine + ' text=' + JSON.stringify(got.text);
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

    // Shared by the cloud phases: Home with the journey's profile, then Settings.
    private static let cloudHelpers = helpers + """
    async function home() {
      await waitFor(() => q('.home-greet') || q('.auth-card'));
      if (!q('.home-greet')) {
        const picker = [...document.querySelectorAll('.auth-card button')].find(b => /Journey Student/.test(b.textContent));
        if (!picker) throw new Error('profile not found');
        picker.click(); await waitFor(() => q('.home-greet'));
      }
    }
    async function settings() {
      history.pushState({}, '', '/settings'); dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => q('#cloud-account-title'));
    }
    const stateTag = () => (q('section[aria-labelledby="cloud-account-title"] .tag') || {}).textContent?.trim() || '';
    const byText = t => [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim() === t);
    """

    // Sign in through the real Settings UI against a real Pri server (the
    // DEBUG-only PRI_CLOUD_ORIGIN override), then Sync now.
    private static let cloud = cloudHelpers + """
    await step('cloudSignIn', async () => {
      at = 'home'; await home();
      at = 'settings'; await settings();
      at = 'state'; await waitFor(() => stateTag() === 'Not connected');
      byText('Sign in')?.click();
      setValue(await waitFor(() => q('#cloud-email')), email);
      setValue(q('#cloud-password'), password);
      await sleep(150);
      q('#cloud-email').form.querySelector('button[type=submit]').click();
      at = 'connected'; await waitFor(() => stateTag() === 'Connected', 30000);
      return 'connected';
    });
    await step('cloudSync', async () => {
      (await waitFor(() => byText('Sync now'))).click();
      const done = await waitFor(() => { const t = q('section[aria-labelledby="cloud-account-title"]').innerText; const m = t.match(/Sync complete[^\\n]*/); return m && m[0]; }, 60000);
      return done;
    });
    return JSON.stringify(steps);
    """

    // Sign up through Settings, sign in, then permanently delete the account
    // (password + typed DELETE). Uses a fresh, never-registered email.
    private static let cloudSignUp = cloudHelpers + """
    const signIn = async (e, p) => {
      byText('Sign in')?.click();
      setValue(await waitFor(() => q('#cloud-email')), e); setValue(q('#cloud-password'), p); await sleep(150);
      q('#cloud-email').form.querySelector('button[type=submit]').click();
    };
    await step('cloudSignUp', async () => {
      at = 'home'; await home(); await settings();
      at = 'state'; await waitFor(() => stateTag() === 'Not connected');
      (await waitFor(() => byText('Create account'))).click();
      setValue(await waitFor(() => q('#cloud-name')), 'Journey Adult');
      setValue(q('#cloud-email'), newEmail); setValue(q('#cloud-password'), newPassword);
      const boxes = [...q('#cloud-email').form.querySelectorAll('input[type=checkbox]')];
      for (const b of boxes) if (!b.checked) { b.click(); await sleep(120); }
      q('#cloud-email').form.querySelector('button[type=submit]').click();
      at = 'linked'; await waitFor(() => /Linked|Connected/.test(stateTag()), 30000);
      return stateTag();
    });
    await step('cloudLogin', async () => {
      if (stateTag() !== 'Connected') {
        (await waitFor(() => byText('Disconnect'))).click();
        await waitFor(() => stateTag() === 'Not connected', 20000);
        await signIn(newEmail, newPassword);
        await waitFor(() => stateTag() === 'Connected', 30000);
      }
      return 'connected as the new account';
    });
    await step('cloudDeleteAccount', async () => {
      setValue(await waitFor(() => q('#cloud-delete-password')), newPassword);
      setValue(q('#cloud-delete-phrase'), 'DELETE'); await sleep(150);
      q('#cloud-delete-phrase').form.querySelector('button[type=submit]').click();
      await waitFor(() => /Cloud account deleted/.test(document.body.innerText) && stateTag() === 'Not connected', 30000);
      return 'deleted; offline profile kept';
    });
    return JSON.stringify(steps);
    """

    // The cloud server is unreachable: learning still works and Sync fails
    // safely, keeping the local work.
    private static let offline = cloudHelpers + """
    await step('offlinePractice', async () => {
      await home();
      history.pushState({}, '', '/practice'); dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => q('.q-prompt'));
      return 'practice works offline';
    });
    await step('offlineSyncSafe', async () => {
      await settings();
      // Unreachable is "offline", not "sign in again", and work stays local.
      await waitFor(() => stateTag() === 'Linked · offline', 60000);
      const note = await waitFor(() => q('[data-cloud-offline]'));
      const sync = byText('Sync now');
      if (sync && !sync.disabled) throw new Error('Sync offered while offline');
      return stateTag() + ' · ' + (note.innerText || '').slice(0, 60);
    });
    return JSON.stringify(steps);
    """

    // Backgrounded by another app and brought back: the page saw the
    // lifecycle and an unsent typed answer is still there.
    private static let background = cloudHelpers + """
    await step('backgroundDraftKept', async () => {
      await home();
      const log = [];
      document.addEventListener('visibilitychange', () => log.push(document.visibilityState));
      // The shell's own lifecycle events (priBridge envelope), alongside the
      // page's visibility — either proves the app went away and came back.
      const prior = window.__priNativeReceive;
      window.__priNativeReceive = m => {
        try { if (m && m.event === 'lifecycle.state') log.push(m.payload?.state === 'background' ? 'hidden' : m.payload?.state === 'active' ? 'visible' : 'inactive'); } catch (e) {}
        if (prior) prior(m);
      };
      history.pushState({}, '', '/practice'); dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => q('.q-prompt'));
      let input = null;
      for (let i = 0; i < 12 && !input; i++) {
        const t = byLabel('Answer by typing'); if (t) { t.click(); await sleep(250); }
        input = q('.editor-body input.answer-input');
        if (!input) { q('.ctx-next')?.click(); await sleep(900); }
      }
      if (!input) throw new Error('no typed question');
      setValue(input, 'x+42');
      // The runner now switches to another app and back (it allows ~20 s for setup).
      try { await waitFor(() => log.includes('hidden') && log[log.length - 1] === 'visible', 90000); }
      finally { window.__priNativeReceive = prior; }
      const kept = (q('.editor-body input.answer-input') || {}).value;
      if (kept !== 'x+42') throw new Error('draft lost: ' + kept);
      return 'lifecycle ' + log.join('>') + ', draft kept';
    });
    return JSON.stringify(steps);
    """

    // DOM-level accessibility smoke inside the real WKWebView: names, labels,
    // language, headings, tab order and touch-target size. VoiceOver itself
    // remains a physical gate.
    private static let a11y = cloudHelpers + """
    const visible = el => !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const nameOf = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('alt') || el.value || '').trim()
      || (el.getAttribute('aria-labelledby') || '').split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    function audit(where) {
      const problems = [];
      if (!document.documentElement.lang) problems.push('no lang');
      for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
        if (visible(el) && !nameOf(el)) problems.push(where + ': unnamed ' + el.tagName + '.' + el.className);
      }
      for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
        if (!visible(el)) continue;
        const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.closest('label');
        if (!labelled) problems.push(where + ': unlabelled ' + (el.id || el.name || el.type));
      }
      for (const el of document.querySelectorAll('[tabindex]')) if (Number(el.getAttribute('tabindex')) > 0) problems.push(where + ': positive tabindex');
      for (const el of document.querySelectorAll('img')) if (visible(el) && !el.hasAttribute('alt')) problems.push(where + ': img without alt');
      if (!document.querySelector('h1, h2, [role=heading]')) problems.push(where + ': no heading');
      for (const el of document.querySelectorAll('.btn, .mobilenav button, .mobilenav a')) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 43.5 && r.width > 0) problems.push(where + ': small target ' + Math.round(r.height) + 'px ' + nameOf(el).slice(0, 20));
      }
      return problems;
    }
    await step('a11yAudit', async () => {
      await home();
      const all = [];
      for (const path of ['/', '/practice', '/progress', '/settings']) {
        history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate'));
        await sleep(1000);
        all.push(...audit(path));
      }
      if (all.length) throw new Error(all.slice(0, 6).join(' | '));
      return '4 screens: names, labels, lang, headings, tab order, 44px targets';
    });
    return JSON.stringify(steps);
    """

    // After a relaunch (and the server coming back) the session is still
    // there and syncs again; Disconnect logs out and forgets it.
    private static let cloudRelaunch = cloudHelpers + """
    await step('cloudSessionKept', async () => {
      await home(); await settings();
      await waitFor(() => stateTag() === 'Connected', 30000);
      return 'connected after relaunch';
    });
    await step('cloudReconnectSync', async () => {
      (await waitFor(() => byText('Sync now'))).click();
      const done = await waitFor(() => { const t = q('section[aria-labelledby="cloud-account-title"]').innerText; const m = t.match(/Sync complete[^\\n]*/); return m && m[0]; }, 60000);
      return done;
    });
    await step('cloudDisconnect', async () => {
      (await waitFor(() => byText('Disconnect'))).click();
      await waitFor(() => stateTag() === 'Not connected', 20000);
      return 'disconnected';
    });
    return JSON.stringify(steps);
    """

    // Run with the largest accessibility text size set on the simulator: the
    // shell scales the page (pageZoom) and nothing may scroll sideways.
    private static let dynamicType = cloudHelpers + """
    const overflow = () => Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth);
    await step('dynamicTypeZoom', async () => {
      await home();
      const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return 'cssWidth=' + window.innerWidth + ' screen=' + screen.width + ' rootFont=' + base;
    });
    await step('dynamicTypeNoOverflow', async () => {
      const seen = [];
      for (const path of ['/', '/practice', '/progress', '/settings']) {
        history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate'));
        await sleep(900);
        const o = overflow();
        seen.push(path + ':' + o);
        if (o > 1) {
          // Name the widest offenders so the failure is actionable.
          const wide = [...document.querySelectorAll('body *')].map(el => [el, el.getBoundingClientRect()])
            .filter(([el, r]) => r.right > window.innerWidth + 1 && r.width > 0)
            .sort((a, b) => b[1].right - a[1].right).slice(0, 4)
            .map(([el, r]) => el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ').slice(0, 2).join('.') + '@' + Math.round(r.right));
          throw new Error('horizontal overflow ' + seen.join(' ') + ' offenders ' + wide.join(' '));
        }
      }
      return seen.join(' ');
    });
    return JSON.stringify(steps);
    """

    @MainActor
    static func run(in webView: WKWebView) {
        guard let phase else { return }
        NSLog("PRIJOURNEY started %@", phase)
        let script: String
        switch phase {
        case "relaunch": script = relaunch
        case "cloud": script = cloud
        case "cloudRelaunch": script = cloudRelaunch
        case "dynamicType": script = dynamicType
        case "cloudSignUp": script = cloudSignUp
        case "offline": script = offline
        case "background": script = background
        case "a11y": script = a11y
        default: script = firstLaunch
        }
        let env = ProcessInfo.processInfo.environment
        let arguments: [String: Any] = [
            "email": env["PRI_JOURNEY_EMAIL"] ?? "",
            "password": env["PRI_JOURNEY_PASSWORD"] ?? "",
            "newEmail": env["PRI_JOURNEY_NEW_EMAIL"] ?? "",
            "newPassword": env["PRI_JOURNEY_NEW_PASSWORD"] ?? ""
        ]
        webView.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
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
