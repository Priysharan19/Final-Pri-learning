// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · student journey self-check (`--journey-selfcheck`, CP-04/05)
//
// Drives the real bundled app inside the real WKWebView, the way a student
// moves through it, and logs one PRIJOURNEY line per step for
// scripts/iphone-journey.mjs.
//
// The app is account-first (issue #477): the landing screen is one sign-in
// card (email → the six-digit code in the same card → for a new address
// name, age, class) and an activation gate stands in front of every route
// until the server has confirmed the session, the age/guardian decision and
// a first sync. There is no device-only entry. Grading is online-only and
// server-authoritative (owner decision 2026-10-10, ADR-0001). So:
//
//   · `--journey-selfcheck` — a fresh install with NO server: the app opens to
//     the card (or the gate), and nothing opens without an account — no
//     shell, no Practice behind a deep link, nothing drafted or marked.
//     `--journey-relaunch` proves the same after a relaunch.
//
//   · `--journey-marking` — a real local Pri server (PRI_CLOUD_ORIGIN, DEBUG
//     builds only) whose handwriting reader is a SYNTHETIC stand-in. A new
//     student enters through the card: the email code is the one the
//     server's TEST email adapter issued, handed over by the test process
//     from the server's outbox (never invented, never in the page until the
//     student types it). Then the server marks the work: wrong → 0 with a
//     try left, right → full marks; a handwritten page is read by the
//     server, corrected by the student and marked. The right answer never
//     comes from the page: the test process reads the server's sealed copy
//     of the issued question and hands it over through the oracle
//     directory. `--journey-marking-relaunch` finds the results in History.
//
//   · `--journey-offline-draft` — a fresh install and a second new address
//     entered through the card; once a question is open,
//     the test process stops the server (asked through the oracle). The
//     question is then an offline draft: typed work, strokes on the real
//     PencilKit surface (sealed in IndexedDB with one truthful save status)
//     and a photo are kept, the card says before any work that it cannot be
//     marked and offers no Submit and no Show solution. `--journey-offline-
//     relaunch` (server still down): the gate says "retry", the shell does
//     not open, and the draft is still on the device.
//
// Simulator evidence with programmatic strokes and a synthetic reader. It
// never stands in for a physical device, an Apple Pencil or a real provider.
// ─────────────────────────────────────────────────────────────────────────────
#if DEBUG
// Debug/simulator builds only: never compiled into a Release (App Store) build.
import WebKit

enum JourneySelfCheck {
    static var phase: String? {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--journey-marking-relaunch") { return "markingRelaunch" }
        if args.contains("--journey-marking") { return "marking" }
        if args.contains("--journey-offline-draft") { return "offlineDraft" }
        if args.contains("--journey-offline-relaunch") { return "offlineRelaunch" }
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

    // What a question card can be asked, shared by both marking legs.
    private static let cardHelpers = #"""
    const vis = el => !!el && el.getClientRects().length > 0;
    const allVis = s => [...document.querySelectorAll(s)].filter(vis);
    const seen = s => allVis(s).map(e => e.innerText).join(' ').replace(/\s+/g, ' ').trim();
    const qid = () => { const el = q('.qpage[data-question-id]'); return el ? el.getAttribute('data-question-id') : ''; };
    const answerBox = () => q('.editor-body input.answer-input');
    const workingBox = () => q('.editor-body [data-working-area] textarea');
    const primaryBtn = () => q('.ws-actions .ws-actions-btns .btn-primary');
    // Submit is the primary control only while the question can be marked: on
    // an unmarkable question (an offline draft) the primary is the replace
    // action, and there is no Submit and no Show solution at all.
    const submitBtn = () => q('.ws-actions .ws-actions-btns .btn-primary:not([data-primary-action])');
    const replaceBtn = () => allVis('.ws-actions .ws-actions-btns .btn-primary[data-primary-action="replace"]')[0] || null;
    const unmarkableKind = () => { const el = allVis('[data-check-unmarkable]')[0]; return el ? el.getAttribute('data-check-unmarkable') : null; };
    // What the card of an offline draft must offer, and must not.
    function assertDraftCard(when) {
      if (unmarkableKind() !== 'draft') throw new Error(when + ': the card does not say this is an offline draft (' + unmarkableKind() + ')');
      const said = seen('[data-check-unmarkable]');
      if (!/without a connection/i.test(said) || !/cannot be marked/i.test(said) || /already finished|finished elsewhere|another tab/i.test(said)) throw new Error(when + ': the draft notice reads: ' + said.slice(0, 120));
      if (submitBtn()) throw new Error(when + ': a draft offers Submit');
      if (allVis('.ws-actions button').some(b => /solution/i.test(b.textContent))) throw new Error(when + ': a draft offers a solution');
      if (!replaceBtn() || allVis('.ws-actions .btn-primary').length !== 1) throw new Error(when + ': the one action is not "try for a markable question": ' + JSON.stringify(allVis('.ws-actions button').map(b => b.textContent.trim())));
      if (allVis('[data-check-needs-account]').length || allVis('.qpage [data-check-sign-in]').length) throw new Error(when + ': a draft offers a sign-in that cannot make it markable');
      return said;
    }
    const WRONG = '-987654';
    const WORKING = '2 + 2 = 4\n3 + 3 = 6';
    const cardMode = () => { const c = q('.qpage'); return c ? c.getAttribute('data-mode') : null; };
    // A card restoring saved ink turns itself to Write a moment after it
    // mounts, so a mode is open only once it has stayed open.
    async function openMode(label, mode) {
      for (let i = 0; i < 8; i++) {
        if (cardMode() !== mode) { (await waitFor(() => byLabel(label))).click(); await sleep(400); }
        if (cardMode() !== mode) continue;
        await sleep(700);
        if (cardMode() === mode) return;
      }
      throw new Error('the card would not stay in ' + mode + ' mode');
    }
    const typeMode = () => openMode('Type: answer by typing', 'type');
    const writeMode = () => openMode('Write: answer by handwriting', 'write');
    const photoMode = () => openMode('Photo: answer with a photo of your working', 'photo');
    async function route(path) { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); await sleep(400); }
    // Account-first (issue #477): what stands in front of the app when it
    // has not let a student in. Never the old device-only entry.
    const GATE = '[data-testid=account-activation-gate]';
    const CARD = '[data-signin-card]';
    const gateStatus = () => { const g = q(GATE); return g ? g.getAttribute('data-activation-status') : null; };
    const cardStep = () => { const c = q(CARD); return c ? c.getAttribute('data-signup-step') : null; };
    const shellOpen = () => !!(q('.shell') || q('.home-greet'));
    function assertHeld(when) {
      if (shellOpen()) throw new Error(when + ': the shell opened without an account');
      if (q('[data-testid=hero-offline]') || q('[data-onboarding-step]')) throw new Error(when + ': a device-only entry is offered');
      if (q('.q-prompt') || q('.qpage')) throw new Error(when + ': a question is on screen without an account');
      if (!q(CARD) && !q(GATE)) throw new Error(when + ': neither the sign-in card nor the gate is on screen');
      return (q(GATE) ? 'gate=' + gateStatus() : 'card=' + cardStep());
    }
    // Everything a marker, and only a marker, puts on a question card.
    function markedTraces() {
      const out = [];
      const marks = [['evaluation', '.eval-card'], ['marks', '.eval-marks'], ['verdict', '.verdict-bad'],
        ['solution', '.solution-panel, .solution-block, .eval-expected'], ['yourAnswer', '.your-answer'],
        ['redo', '.redo-chip'], ['misconception', '.diagnosis-named, .diagnosis-card']];
      for (const [name, sel] of marks) if (allVis(sel).length) out.push(name);
      if (/\bXP\b/.test(seen('.qpage'))) out.push('xp');
      if ((q('.qpage') || { getAttribute() {} }).getAttribute('data-phase') === 'resolved') out.push('resolved');
      return out;
    }
    function assertUnmarked(when) { const t = markedTraces(); if (t.length) throw new Error(when + ': a marker left ' + t.join(',')); }
    // The next question, by the card's own Next control.
    async function nextQuestion() {
      const before = qid();
      (await waitFor(() => q('.ctx-next'))).click();
      await waitFor(() => qid() && qid() !== before && q('.q-prompt'), 40000);
      await sleep(500);
    }
    // A question that takes a typed final answer, typed working, ink and a photo.
    // One chapter is pinned so every run meets the same kind of question: a
    // numeric final answer whose working the marker can follow.
    const CHAPTER = '/practice?subtopic=c10-pair-linear-equations';
    async function openTypedQuestion(max = 30) {
      await route(CHAPTER); await waitFor(() => q('.q-prompt') && qid(), 40000); await sleep(500);
      for (let i = 0; i < max; i++) {
        const typing = byLabel('Type: answer by typing');
        if (typing && byLabel('Write: answer by handwriting') && byLabel('Photo: answer with a photo of your working')) {
          typing.click(); await sleep(350);
          if (answerBox() && q('.editor-body [data-working-area]')) return i + 1;
        }
        await nextQuestion();
      }
      throw new Error('no question with a typed answer and working in ' + max);
    }
    async function typeWorking(text) {
      const toggle = q('.editor-body [data-working-area] .btn-disclose');
      if (toggle && toggle.getAttribute('aria-expanded') !== 'true') { toggle.click(); await sleep(250); }
      setValue(await waitFor(workingBox), text);
    }
    async function shownWorking() {
      const toggle = q('.editor-body [data-working-area] .btn-disclose');
      if (toggle && toggle.getAttribute('aria-expanded') !== 'true') { toggle.click(); await sleep(250); }
      return (workingBox() || {}).value;
    }
    // The sealed ink draft, read straight from IndexedDB (the row is
    // ciphertext; its key `${profileId}:${questionId}` is the fact).
    const inkDraft = id => new Promise(done => {
      const open = indexedDB.open('pri-learning');
      open.onerror = () => done('unopened');
      open.onsuccess = () => {
        const db = open.result; let req;
        try { req = db.transaction('inkDrafts').objectStore('inkDrafts').getAllKeys(); } catch (e) { db.close(); return done('no-store'); }
        req.onsuccess = () => { db.close(); done(req.result.some(k => String(k).endsWith(':' + id)) ? 'kept' : 'absent'); };
        req.onerror = () => { db.close(); done('error'); };
      };
    });
    // The save claim on screen, wherever the card makes it.
    function saveClaim() {
      const shown = seen('.qpage .status-line, .qpage .ink-status, .qpage [data-ink-account-recovery] p');
      const notSaved = /\bnot saved\b/i.test(shown);
      const saved = /\bsaved on this device\b|\b(?:is|are) saved\b/i.test(shown.replace(/\bnot saved on this device\b/ig, ''));
      return { shown, saved, notSaved };
    }
    // Count what the native surface reports back while `work` runs.
    async function nativeStrokeEcho(work, want, ms = 20000) {
      // The page installs its own receiver when the ink module first loads,
      // which may be after this starts listening: keep whichever it sets.
      let receiver = window.__priInkReceive, echoed = -1;
      const tap = p => { if (p && p.type === 'strokes') echoed = (p.strokes || []).length; if (receiver) receiver(p); };
      Object.defineProperty(window, '__priInkReceive', { configurable: true, get: () => tap, set: v => { receiver = v; } });
      try {
        await work();
        try { await waitFor(() => echoed === want, ms); } catch (e) { throw new Error('native surface reported ' + echoed + ' stroke(s), wanted ' + want); }
        return echoed;
      } finally { Object.defineProperty(window, '__priInkReceive', { configurable: true, writable: true, enumerable: true, value: receiver }); }
    }
    const STROKES = (() => {
      const line = (x0, y0, x1, y1) => ({ points: Array.from({ length: 12 }, (_, i) => ({ x: x0 + (x1 - x0) * i / 11, y: y0 + (y1 - y0) * i / 11, t: i * 0.01, p: 0.5 })) });
      return [line(100, 60, 100, 160), line(150, 110, 210, 110), line(180, 80, 180, 140)];
    })();
    // Programmatic strokes on the REAL PencilKit surface the card mounted (a
    // simulator has no Pencil). The surface reports them back through priInk
    // exactly as it reports a pen-up, and the card saves what it was told.
    async function writeOnNativeSurface() {
      const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.priInk;
      if (!handler) throw new Error('no native ink surface');
      await waitFor(() => vis(q('.ink-answer .ink-wrap')));
      await sleep(900);   // the surface mounts as a fresh sheet
      return nativeStrokeEcho(async () => handler.postMessage({ op: 'setStrokes', strokes: STROKES }), STROKES.length);
    }
    // Until the card says "saved" with a sealed row behind it. A "saved" claim
    // without that row, or "saved" beside "not saved", fails at once.
    async function inkSavedTruthfully(id) {
      let last = null;
      for (let i = 0; i < 100; i++) {
        const claim = saveClaim(); const row = await inkDraft(id);
        last = { ...claim, row };
        if (claim.saved && claim.notSaved) throw new Error('saved and not saved together: ' + claim.shown);
        if (claim.saved && row !== 'kept') throw new Error('claimed saved with no sealed row (' + row + '): ' + claim.shown);
        if (claim.saved && row === 'kept') return last;
        await sleep(150);
      }
      throw new Error('never saved: ' + JSON.stringify(last));
    }
    const refusalKind = () => { const el = allVis('[data-check-refusal]')[0]; return el ? el.getAttribute('data-check-refusal') : null; };
    const busyNow = () => { const p = primaryBtn(); const s = q('.ws-actions .status-line'); return (p && p.getAttribute('aria-busy') === 'true') || (s && s.getAttribute('data-state') === 'working'); };
    // Run a control and wait for the check it starts to finish. What is on the
    // card afterwards is that check's answer, not something left from before.
    async function checked(press, ms = 45000) {
      let ran = false;
      const watch = new MutationObserver(() => { if (busyNow()) ran = true; });
      watch.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
      try {
        await press();
        try { await waitFor(() => ran || busyNow(), 15000); } catch (e) { throw new Error('the control started no check'); }
        try { await waitFor(() => !busyNow(), ms); } catch (e) { throw new Error('the check never finished'); }
        await sleep(500);
      } finally { watch.disconnect(); }
      return (q('.eval-card') && 'evaluated') || (refusalKind() && 'refused') || (q('.verdict-technical') && 'technical') ||
        (q('.verdict-unsure') && 'unreadable') || (q('.verdict-bad') && 'miss') || (q('.ws-check') && 'confirm') || 'nothing';
    }
    const pressSubmit = async () => { (await waitFor(() => { const p = submitBtn(); return p && !p.disabled && p; }, 20000)).click(); };
    const revealBtn = () => allVis('.ws-actions .ws-actions-btns button').find(b => /^Show solution/.test(b.textContent.trim()));
    // Show solution is armed by one press and confirmed by the next.
    const pressReveal = async () => { (await waitFor(revealBtn)).click(); await sleep(450); const again = revealBtn(); if (again) again.click(); };
    """#

    // Leg 1 · a fresh install and no server: nothing opens without an account.
    private static let firstLaunch = helpers + cardHelpers + #"""
    await step('launch', async () => {
      await waitFor(() => q(CARD) || q(GATE) || shellOpen(), 40000);
      await sleep(1500);   // the gate's first check settles
      return assertHeld('launch') + ' at ' + location.pathname;
    });
    await step('noEntryWithoutAccount', async () => {
      // With no server the card cannot send a code (its field is disabled and
      // it says so) or the gate cannot reach the server ("retry"). Either way
      // there is nothing to press that opens the app.
      const field = q('#signup-destination');
      const said = q(GATE) ? gateStatus() : (field && field.disabled ? 'card field disabled' : 'card field enabled');
      if (q(GATE) && !['retry', 'checking', 'signin'].includes(gateStatus())) throw new Error('the gate reads ' + gateStatus());
      if (field && !field.disabled && !q(GATE)) {
        // A field that is open must still not open the app: the send fails.
        setValue(field, 'nobody@example.test'); await sleep(200);
        const send = q('[data-testid=signup-send-code]');
        if (send && !send.disabled) { send.click(); await sleep(4000); }
        if (cardStep() === 'code') throw new Error('a code step opened with no server');
      }
      await sleep(3000);
      return assertHeld('waited') + '; ' + said;
    });
    await step('deepLinkHeld', async () => {
      const seenAt = [];
      for (const path of ['/practice?subtopic=c10-pair-linear-equations', '/progress', '/review', '/settings']) {
        at = path; await route(path); await sleep(1200);
        seenAt.push(path.split('?')[0] + ':' + assertHeld(path));
      }
      return seenAt.join(' ');
    });
    await step('nothingMarked', async () => {
      assertUnmarked('no account');
      if (document.querySelectorAll('.hist-row').length) throw new Error('History rows exist without an account');
      const drafts = Object.keys(localStorage).filter(k => k.startsWith('pri.draft.'));
      if (drafts.length) throw new Error(drafts.length + ' draft(s) were stored without an account');
      return 'no marks, no History, no drafts';
    });
    await step('persistenceMarker', async () => { localStorage.setItem('pri-journey-marker', 'kept'); return 'written'; });
    return JSON.stringify(steps);
    """#

    private static let relaunch = helpers + cardHelpers + #"""
    await step('relaunchStillHeld', async () => {
      await waitFor(() => q(CARD) || q(GATE) || shellOpen(), 40000);
      await sleep(2500);
      return assertHeld('relaunch');
    });
    await step('relaunchMarker', async () => {
      if (localStorage.getItem('pri-journey-marker') !== 'kept') throw new Error('marker lost');
      return location.origin;
    });
    return JSON.stringify(steps);
    """#

    // ── The signed-in leg: a real local server marks the work ────────────────
    // `oracle` asks the TEST PROCESS (never the page, never the app) for the
    // server's sealed copy of the question this account was last issued.
    private static let oracleHelpers = #"""
    let asked = 0;
    async function oracle(payload) {
      const n = ++asked;
      window.__priJourneyReply = null;
      window.__priJourneyAsk = { n, ...payload };
      try { return await waitFor(() => { const r = window.__priJourneyReply; return r && r.n === n && r; }, 60000); }
      catch (e) { throw new Error('the test oracle did not answer'); }
    }
    const graded = [];
    // Enter through the one sign-in card, the way a student does. The code is
    // the one the server's TEST email adapter issued to this address, handed
    // over by the test process from the server's outbox — never invented.
    async function cardOnboard(address) {
      at = 'card'; await waitFor(() => q(CARD) || shellOpen(), 40000);
      if (shellOpen()) throw new Error('the shell was already open on a fresh install');
      at = 'email'; const field = await waitFor(() => { const f = q('#signup-destination'); return f && !f.disabled && f; }, 40000);
      setValue(field, address); await sleep(200);
      (await waitFor(() => { const b = q('[data-testid=signup-send-code]'); return b && !b.disabled && b; })).click();
      at = 'code step'; await waitFor(() => q('#signup-code-0'), 30000);
      at = 'code'; const sent = await oracle({ kind: 'emailCode', to: address });
      if (!/^\d{6}$/.test(sent.code || '')) throw new Error('the server sent no six-digit code: ' + (sent.reason || 'none'));
      setValue(q('#signup-code-0'), sent.code);
      await sleep(1500);
      if (cardStep() === 'code') { const v = q('[data-testid=signup-verify]'); if (v && !v.disabled) v.click(); }
      at = 'verified'; await waitFor(() => !q(CARD) || cardStep() !== 'code' || q('[data-testid=signup-error]'), 30000);
      if (q('[data-testid=signup-error]')) throw new Error('the card refused: ' + seen('[data-testid=signup-error]'));
      const fresh = cardStep() === 'age';
      if (fresh) {
        at = 'about'; setValue(q('#signup-flow-name'), 'Journey Student');
        (await waitFor(() => q('[data-testid=signup-age-18]'))).click(); await sleep(150);
        const agree = q('[data-testid=signup-agree]'); if (!agree.checked) agree.click(); await sleep(150);
        q('[data-testid=signup-age-next]').click();
      }
      at = 'class'; await waitFor(() => cardStep() === 'class' || shellOpen(), 30000);
      if (cardStep() === 'class') {
        (await waitFor(() => q('[data-testid=signup-class-10]'))).click(); await sleep(150);
        (await waitFor(() => { const b = q('[data-testid=signup-class-next]'); return b && !b.disabled && b; })).click();
      }
      // The gate lets the student in; the shell may open on Home or straight
      // on Practice. Either way the journey continues from Home.
      at = 'gate'; await waitFor(() => (q('.shell') || q('.home-greet')) && !q(GATE), 90000);
      if (!q('.home-greet')) { at = 'home'; await route('/'); await waitFor(() => q('.home-greet'), 30000); }
      return (fresh ? 'new account' : 'returning account') + ' entered through the card with the code the server sent';
    }
    async function signedInHome() {
      await waitFor(() => q('.home-greet') || q(GATE), 60000);
      if (!q('.home-greet')) await waitFor(() => q('.home-greet') && !q(GATE), 60000);
    }
    const fullMarks = () => { const m = seen('.eval-marks').match(/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?) marks?/); return m && m[1] === m[2] && Number(m[2]) > 0 ? m[0] : null; };
    """#

    private static let marking = helpers + cardHelpers + oracleHelpers + #"""
    await step('cardOnboarding', async () => cardOnboard(email));
    await step('firstQuestion', async () => {
      await nav('/practice'); await waitFor(() => q('.q-prompt') && qid(), 40000);
      const n = await openTypedQuestion();
      if (allVis('[data-check-needs-account]').length) throw new Error('a signed-in student is told checking needs an account');
      if (unmarkableKind()) throw new Error('the question says it cannot be marked (' + unmarkableKind() + ')');
      setValue(answerBox(), WRONG); await typeWorking(WORKING);
      await sleep(500);
      assertUnmarked('before any check');
      return 'question ' + n + ' of the pinned chapter, signed in, markable; nothing marked before a check';
    });
    // A wrong answer then the right one, on a question whose sealed answer the
    // oracle can state. The first candidate is the first question opened.
    let typedEscrow = null, typedLocal = '';
    await step('typedWrongZero', async () => {
      const passed = [];
      for (let i = 0; i < 12; i++) {
        at = 'question ' + (i + 1) + ' (passed over: ' + passed.join(',') + ')';
        if (i > 0) {
          await nextQuestion();
          const typing = byLabel('Type: answer by typing'); if (typing) { typing.click(); await sleep(350); }
          if (!answerBox()) { passed.push('no-typed-answer'); continue; }
          const peek = await oracle({ kind: 'answer' });
          if (!peek.supported) { passed.push(peek.answerType || peek.reason || 'unstatable'); continue; }
          setValue(answerBox(), WRONG);
        }
        const got = await checked(pressSubmit);
        if (got === 'refused' || got === 'technical') throw new Error('the signed-in check was refused (' + (refusalKind() || 'technical') + '): ' + seen('.verdict').slice(0, 110));
        const escrow = await oracle({ kind: 'answer' });
        if (got !== 'miss' || !escrow.supported) { passed.push(got + '/' + (escrow.answerType || 'unstatable')); continue; }   // unreadable for this answer type, or no statable answer
        if (q('.eval-card') || q('.solution-panel')) throw new Error('a first miss resolved the question');
        if (!answerBox() || answerBox().disabled) throw new Error('no second try offered');
        typedEscrow = escrow; typedLocal = qid();
        return 'server marked the wrong answer: "' + seen('.verdict .verdict-title') + '", question still open' + (i === 0 ? ' (the first question opened)' : ' (issued question ' + (i + 1) + ')');
      }
      throw new Error('no question with a statable numeric answer in 12: ' + passed.join(','));
    });
    await step('typedCorrectFull', async () => {
      if (!typedEscrow) throw new Error('no question was left open by a server-marked miss');
      setValue(answerBox(), typedEscrow.text); await sleep(300);
      const got = await checked(pressSubmit);
      if (got !== 'evaluated') throw new Error('expected an evaluation, got ' + got + ': ' + seen('.verdict').slice(0, 100));
      const card = q('.eval-card');
      if (card.getAttribute('data-outcome') !== 'correct') throw new Error('outcome ' + card.getAttribute('data-outcome'));
      if (q('[data-grade-unavailable]') || !fullMarks()) throw new Error('marks shown: ' + JSON.stringify(seen('.eval-marks')));
      graded.push({ id: typedLocal, server: typedEscrow.serverQuestionId, mode: 'typed' });
      return 'server marked the right answer: ' + fullMarks();
    });
    let inkEscrow = null;
    await step('inkServerReading', async () => {
      const passed = [];
      // Smart practice across the syllabus: the pinned chapter turns to
      // multiple choice once its typed question is answered correctly.
      at = 'practice'; await route('/practice'); await waitFor(() => q('.q-prompt') && qid(), 40000); await sleep(500);
      for (let i = 0; i < 12; i++) {
        at = 'question ' + (i + 1) + ' (passed over: ' + passed.join(',') + ')';
        await nextQuestion();
        if (!byLabel('Write: answer by handwriting')) { passed.push('no-write-tab'); continue; }
        const escrow = await oracle({ kind: 'answer' });
        if (!escrow.supported) { passed.push(escrow.answerType || escrow.reason || 'unstatable'); continue; }
        const id = qid();
        at = 'write'; await writeMode();
        const echoed = await writeOnNativeSurface();
        at = 'saved'; await inkSavedTruthfully(id);
        // Reading is asked for (owner decision): writing and saving send nothing.
        at = 'unread'; await sleep(1500);
        if (q('.ink-preview .ink-line')) throw new Error('the page was read without Read my answer being pressed');
        at = 'read'; (await waitFor(() => q('[data-ink-read]'), 20000)).click();
        at = 'reading'; await waitFor(() => q('.ink-preview .ink-line'), 60000);
        const lines = [...document.querySelectorAll('.ink-preview .ink-line')].map(n => ({ text: n.getAttribute('data-text'), low: n.classList.contains('ink-line-low') }));
        if (lines.length !== 1 || lines[0].text !== escrow.readerText) throw new Error('transcript ' + JSON.stringify(lines) + ', the stand-in reader answered ' + JSON.stringify(escrow.readerText));
        if (!lines[0].low || !q('.ink-line .ink-correct-btn')) throw new Error('a doubtful line is not editable');
        assertUnmarked('reading');
        inkEscrow = escrow; graded.push({ id, server: escrow.serverQuestionId, mode: 'ink' });
        return echoed + ' strokes read by the server (synthetic reader): transcript ' + JSON.stringify(lines[0].text) + ', doubtful, editable';
      }
      throw new Error('no handwriting question with a statable numeric answer in 12: ' + passed.join(','));
    });
    await step('inkCorrectedMarked', async () => {
      if (!inkEscrow) throw new Error('no server reading to correct');
      at = 'correct'; q('.ink-line .ink-correct-btn').click();
      setValue(await waitFor(() => q('.ink-line form.ink-correct input')), inkEscrow.text); await sleep(200);
      q('.ink-line form.ink-correct button[type=submit]').click();
      await waitFor(() => { const l = q('.ink-line[data-corrected="true"]'); return l && l.getAttribute('data-text') === inkEscrow.text; });
      at = 'submit';
      let got = null;
      for (let press = 0; press < 3 && got !== 'evaluated'; press++) {
        got = await checked(pressSubmit);
        if (got !== 'confirm') break;
      }
      if (got !== 'evaluated') throw new Error('expected an evaluation, got ' + got + ': ' + seen('.verdict, .ws-check').slice(0, 110));
      if (q('.eval-card').getAttribute('data-outcome') !== 'correct' || !fullMarks()) throw new Error('outcome ' + q('.eval-card').getAttribute('data-outcome') + ' marks ' + JSON.stringify(seen('.eval-marks')));
      return 'corrected transcript marked by the server: ' + fullMarks();
    });
    const historyVerdicts = async ids => {
      await route('/review');
      await waitFor(() => location.pathname === '/review' && q('.hist-row'), 30000);
      await sleep(800);
      return ids.map(id => [...document.querySelectorAll('.hist-row[data-question-id="' + id + '"] .hist-verdict .sr-only')].map(n => n.textContent.trim()).join('+') || 'missing');
    };
    await step('historyRecorded', async () => {
      if (graded.length !== 2) throw new Error('only ' + graded.length + ' question(s) were marked');
      localStorage.setItem('pri-journey-graded', JSON.stringify(graded));
      const verdicts = await historyVerdicts(graded.map(g => g.id));
      if (verdicts.join() !== 'Correct,Correct') throw new Error('History shows ' + verdicts.join());
      return 'History: typed Correct, handwritten Correct ' + JSON.stringify(graded.map(g => g.server));
    });
    return JSON.stringify(steps);
    """#

    private static let markingRelaunch = helpers + cardHelpers + oracleHelpers + #"""
    await step('historyAfterRelaunch', async () => {
      at = 'gate'; await signedInHome();
      const graded = JSON.parse(localStorage.getItem('pri-journey-graded') || '[]');
      if (graded.length !== 2) throw new Error('the marking launch recorded ' + graded.length + ' result(s)');
      at = 'history'; await route('/review');
      await waitFor(() => location.pathname === '/review' && q('.hist-row'), 30000);
      await sleep(800);
      const verdicts = graded.map(g => [...document.querySelectorAll('.hist-row[data-question-id="' + g.id + '"] .hist-verdict .sr-only')].map(n => n.textContent.trim()).join('+') || 'missing');
      if (verdicts.join() !== 'Correct,Correct') throw new Error('after relaunch History shows ' + verdicts.join());
      return 'both server-marked results in History after relaunch';
    });
    return JSON.stringify(steps);
    """#

    // Signed in, then the connection goes: the work stays on the device as an
    // offline draft that says it cannot be marked. The test process stops the
    // server when the page asks (the oracle relay), never at a fixed time.
    private static let offlineDraft = helpers + cardHelpers + oracleHelpers + #"""
    let onlineId = '';
    // Typed working where the draft card offers it ('' where it does not).
    let draftWorking = '';
    await step('offlineAfterEntry', async () => {
      // Its own fresh install and address, entered through the card: the
      // marking leg's profile has spent much of the day's free questions.
      at = 'card'; await cardOnboard(newEmail);
      // A question card is opened while the server is up (the pinned chapter);
      // only then does the connection go, as it would for a student.
      at = 'online question'; await route(CHAPTER); await waitFor(() => q('.q-prompt') && qid(), 40000); await sleep(800);
      onlineId = qid();
      at = 'server stop'; const r = await oracle({ kind: 'goOffline' });
      if (!r.offline) throw new Error('the test process could not stop the server: ' + (r.reason || 'unknown'));
      await sleep(1500);
      if (!shellOpen() || q(GATE)) throw new Error('a dropped connection closed the shell');
      return 'entered and opened question ' + onlineId + ' with the server up; the server is now stopped and the shell stays open';
    });
    await step('practice', async () => {
      // Offline: say what the card shows when no question arrives.
      const state = () => 'prompt=' + !!q('.q-prompt') + ' qid=' + (qid() || '-') + ' mode=' + cardMode() + ' unmarkable=' + unmarkableKind() +
        ' tabs=' + [byLabel('Type: answer by typing'), byLabel('Write: answer by handwriting'), byLabel('Photo: answer with a photo of your working')].map(b => b ? 1 : 0).join('') +
        ' main="' + seen('main').slice(90, 330) + '"';
      let n;
      try {
        // Next on the open card, offline: the app can only offer a draft of its own.
        if (!q('.q-prompt') || !qid()) throw new Error('the question opened online is gone');
        at = 'next offline';
        // Each Next spends one of the day's free questions (the cap is 20), so
        // the search is short and says what each card lacked.
        const lacked = [];
        for (n = 1; ; n++) {
          await nextQuestion();
          const typing = byLabel('Type: answer by typing');
          const tabs = [typing, byLabel('Write: answer by handwriting'), byLabel('Photo: answer with a photo of your working')].map(b => b ? 1 : 0).join('');
          if (tabs === '111') {
            typing.click(); await sleep(600);
            // An offline draft offers a typed answer; typed working is shown
            // only where the card has it (drafts observed have none).
            if (answerBox()) { draftWorking = q('.editor-body [data-working-area]') ? WORKING : ''; break; }
          }
          lacked.push(tabs + '/' + (answerBox() ? 'a' : '-') + (q('.editor-body [data-working-area]') ? 'w' : '-') + '/' + cardMode());
          if (n >= 8) throw new Error('no offline question with a typed answer in 8: ' + lacked.join(' '));
        }
      } catch (e) { throw new Error(String(e && e.message || e) + ' at ' + at + ' · ' + state()); }
      assertUnmarked('opening');
      // Said before any work goes in: with no server this copy cannot be marked.
      at = 'draft notice'; await waitFor(() => unmarkableKind());
      assertDraftCard('opening');
      if (replaceBtn().textContent.trim() !== 'Try for a markable question' || q('[data-check-replace-confirm]')) throw new Error('before any work the action reads: ' + replaceBtn().textContent.trim());
      return 'offline Next ' + n + ' from the online card takes a typed answer' + (draftWorking ? ', working' : ' (no working box)') + ', ink and a photo; said to be an unmarkable draft before any work';
    });
    // Ink first, on an untouched card: the one save status is then about the
    // ink alone, so it can be held to the sealed row strictly.
    await step('nativeInk', async () => {
      const ink = window.__PRI_HOST__?.capabilities?.ink;
      if (!ink) throw new Error('host advertises no ink');
      const facts = 'stylus=' + ink.stylus + ' fingerDefault=' + ink.fingerDefault;
      const id = qid();
      at = 'blank'; await writeMode();
      await waitFor(() => vis(q('.ink-answer .ink-wrap')));
      const blank = { ...saveClaim(), row: await inkDraft(id) };
      if (blank.saved || blank.notSaved || blank.row === 'kept') throw new Error('before any stroke: ' + JSON.stringify(blank));
      at = 'strokes'; const echoed = await writeOnNativeSurface();
      at = 'saved'; const truth = await inkSavedTruthfully(id);
      // Read by nobody: this device has no server, and the on-device
      // recogniser is not in the marking path.
      await sleep(1600);
      if (q('.ink-preview') || q('.ink-line')) throw new Error('a reading appeared with no server');
      assertUnmarked('writing');
      return facts + ' captured=' + echoed + ' strokes, sealed draft ' + truth.row + ', status "' + truth.shown.slice(0, 40) + '"';
    });
    await step('typedDraft', async () => {
      const id = qid();
      at = 'answer'; await typeMode(); setValue(await waitFor(answerBox), '12345');
      if (draftWorking) { at = 'working'; await typeWorking(draftWorking); }
      // The typed draft itself, as stored, under this question.
      at = 'stored'; await waitFor(() => {
        const key = Object.keys(localStorage).find(k => k.endsWith('.question.' + id));
        const data = key && (JSON.parse(localStorage.getItem(key)) || {}).data;
        return data && data.typed === '12345' && (data.working || '') === draftWorking;
      }, 15000);
      at = 'status'; try { await waitFor(() => { const c = saveClaim(); return c.saved && !c.notSaved; }, 10000); }
      catch (e) { throw new Error('typed work stored but the status reads: ' + saveClaim().shown); }
      assertUnmarked('typing');
      return 'answer ' + (draftWorking ? 'and working ' : '(the draft card offers no working box) ') + 'stored on this device; status "' + seen('.ws-actions .status-line').slice(0, 30) + '"';
    });
    await step('photoDraft', async () => {
      // The product reads photos only on the server (ADR-0001). Attach one and
      // prove the device neither reads nor marks it: the native Vision bridge
      // is never asked, and no transcript appears.
      let nativeReads = 0;
      const original = window.__priPhotoReceive;
      window.__priPhotoReceive = p => { nativeReads += 1; if (original) original(p); };
      const t0 = Date.now();
      // When the thumbnail does not come, say what the attach pipeline shows
      // instead of the page header: the card's mode, whether the attach block,
      // its placeholder and an <img> exist, the status text, the page's
      // visibility and the time spent — so a failure names its sub-step
      // (three runs in October 2026 said only "timed out at thumbnail").
      const where = () => 'mode=' + cardMode() + ' attach=' + (q('.photo-attach') ? 'yes' : 'no') + ' thumb=' + (q('.photo-attach .photo-thumb') ? 'yes' : 'no') +
        ' img=' + (q('.photo-attach .photo-thumb img') ? (vis(q('.photo-attach .photo-thumb img')) ? 'visible' : 'hidden') : 'none') +
        ' status="' + seen('.photo-attach [role=status]').slice(0, 60) + '" visibility=' + document.visibilityState + ' after ' + (Date.now() - t0) + ' ms';
      try {
        at = 'mode'; await photoMode();
        let input = await waitFor(() => q('.editor-body input[type=file]'));
        at = 'canvas'; const c = document.createElement('canvas'); c.width = 900; c.height = 220;
        const g = c.getContext('2d');
        if (!g) throw new Error('the test canvas has no 2d context (' + where() + ')');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#000'; g.font = 'bold 96px Helvetica, Arial, sans-serif'; g.fillText('2x + 3 = 11', 40, 145);
        // A canvas with no backing store encodes to null: that would have made
        // an empty, unopenable File and shown as a missing thumbnail.
        at = 'blob'; const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        if (!blob || !blob.size) throw new Error('the test canvas encoded ' + (blob ? 'an empty' : 'no') + ' PNG, so no picture was attached (' + where() + ')');
        // The card may have re-rendered while the picture was encoded: attach
        // to the input that is on the page now, never to a detached one.
        at = 'input'; if (!input.isConnected) input = q('.editor-body input[type=file]');
        if (!input || !input.isConnected) throw new Error('the file input left the page while the picture was encoded (' + where() + ')');
        const files = new DataTransfer(); files.items.add(new File([blob], 'working.png', { type: 'image/png' }));
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        at = 'thumbnail';
        try { await waitFor(() => vis(q('.photo-attach .photo-thumb img')), 20000); }
        catch (e) { throw new Error('no thumbnail for a ' + blob.size + '-byte PNG: ' + where()); }
        const shown = Date.now() - t0;
        at = 'unread'; let said;
        try { said = await waitFor(() => !/reading your work/i.test(seen('.photo-attach [role=status]')) && seen('.photo-attach [role=status] .verdict-body'), 30000); }
        catch (e) { throw new Error('the status never settled: ' + where()); }
        if (q('[data-photo-correct-transcript]')) throw new Error('a photo transcript appeared with no server');
        await sleep(800);
        if (nativeReads) throw new Error('the on-device photo reader answered ' + nativeReads + ' time(s)');
        if (submitBtn()) throw new Error('an unread photo can be submitted');
        assertUnmarked('photo');
        return 'attached (thumbnail in ' + shown + ' ms), not read on device: "' + said.slice(0, 60) + '"';
      } finally { window.__priPhotoReceive = original; }
    });
    await step('noCheckOffered', async () => {
      at = 'type'; await typeMode();
      if ((answerBox() || {}).value !== '12345') throw new Error('typed answer lost across modes: ' + (answerBox() || {}).value);
      // No server ever issued this question: it can never be marked, so with
      // an answer, working, ink and a photo on the page there is still no
      // Submit and no Show solution to be refused.
      at = 'offers'; const said = assertDraftCard('with work on the page');
      if (revealBtn()) throw new Error('Show solution is offered on a draft');
      if (refusalKind()) throw new Error('a check was refused that nobody asked for: ' + refusalKind());
      assertUnmarked('draft with work');
      return 'no Submit, no Show solution: "' + said.slice(0, 70) + '"';
    });
    await step('replaceKeepsWork', async () => {
      const id = qid();
      // With work on the page the first press only asks.
      at = 'ask'; replaceBtn().click();
      await waitFor(() => vis(q('[data-check-replace-confirm]')));
      if (replaceBtn().textContent.trim() !== 'Leave this one and get a new question' || !vis(q('.ws-actions [data-check-replace-cancel]'))) throw new Error('asked, the actions read: ' + JSON.stringify(allVis('.ws-actions button').map(b => b.textContent.trim())));
      if (qid() !== id || (answerBox() || {}).value !== '12345') throw new Error('asking changed the card');
      // Confirmed: a markable question is asked for FIRST. With no server none
      // can be opened, and then nothing here changes.
      at = 'confirm'; replaceBtn().click();
      await waitFor(() => !busyNow() && !q('[data-check-replace-confirm]') && vis(q('[data-check-replace-note]')), 60000);
      const note = seen('[data-check-replace-note]');
      if (!/could not be opened/i.test(note) || !/nothing here has changed/i.test(note)) throw new Error('the note reads: ' + note.slice(0, 120));
      at = 'kept';
      if (qid() !== id) throw new Error('a different question is on the card: ' + qid() + ' (was ' + id + ')');
      if ((answerBox() || {}).value !== '12345') throw new Error('typed answer lost: ' + JSON.stringify((answerBox() || {}).value));
      if (draftWorking && await shownWorking() !== draftWorking) throw new Error('typed working lost');
      if (await inkDraft(id) !== 'kept') throw new Error('sealed ink draft lost');
      if (refusalKind()) throw new Error('a check was refused: ' + refusalKind());
      assertDraftCard('after a declined replace');
      assertUnmarked('declined replace');
      return 'asked first; with no server nothing changed: same question, answer, working and ink kept; "' + note.slice(0, 50) + '"';
    });
    await step('nothingRecorded', async () => {
      const id = qid();
      localStorage.setItem('pri-journey-draft', JSON.stringify({ id, answer: (answerBox() || {}).value || '', working: draftWorking }));
      at = 'history'; await route('/review');
      await waitFor(() => location.pathname === '/review' && q('main'));
      await sleep(1500);
      // The draft must not be in History.
      const rows = document.querySelectorAll('.hist-row[data-question-id="' + id + '"]').length;
      if (rows) throw new Error(rows + ' attempt(s) recorded for the offline draft');
      return 'History holds no attempt for the draft (' + document.querySelectorAll('.hist-row').length + ' row(s) in all)';
    });
    await step('offlineProgress', async () => {
      at = 'home'; await route('/'); await waitFor(() => location.pathname === '/' && q('.home-greet'));
      const link = () => [...document.querySelectorAll('a[href="/progress"]')].find(a => a.offsetParent);
      if (!link()) { q('.mobilenav button[aria-expanded]')?.click(); await waitFor(link); }
      link().click();
      await waitFor(() => location.pathname === '/progress' && q('main'));
      return 'progress shown offline';
    });
    await step('offlinePersistenceMarker', async () => { localStorage.setItem('pri-journey-marker', 'kept'); return 'written'; });

    return JSON.stringify(steps);
    """#

    // Relaunched while the server is still down: the gate cannot confirm the
    // account, so nothing opens — and nothing on the device was lost.
    private static let offlineRelaunch = helpers + cardHelpers + #"""
    await step('offlineRelaunchHeld', async () => {
      await waitFor(() => q(GATE) || shellOpen(), 40000);
      await waitFor(() => gateStatus() === 'retry' || shellOpen(), 60000);
      if (shellOpen()) throw new Error('the shell opened while the server could not confirm the account');
      return assertHeld('offline relaunch');
    });
    await step('offlineDraftOnDisk', async () => {
      const draft = JSON.parse(localStorage.getItem('pri-journey-draft') || 'null');
      if (!draft || !draft.id) throw new Error('the offline launch recorded no draft');
      const key = Object.keys(localStorage).find(k => k.endsWith('.question.' + draft.id));
      const data = key && (JSON.parse(localStorage.getItem(key)) || {}).data;
      if (!data || data.typed !== '12345' || (data.working || '') !== (draft.working || '')) throw new Error('typed draft lost: ' + JSON.stringify(data || null).slice(0, 80));
      if (await inkDraft(draft.id) !== 'kept') throw new Error('sealed ink draft lost');
      return 'typed answer, working and the sealed ink draft are still on the device';
    });
    return JSON.stringify(steps);
    """#

    // Shared by the cloud phases: Home with the journey's profile, then Settings.
    private static let cloudHelpers = helpers + """
    // Account-first (#477): Home is reached only by a student the gate has
    // let in — these phases run on the install the marking leg signed in.
    async function home() {
      try { await waitFor(() => q('.home-greet') && !q('[data-testid=account-activation-gate]'), 90000); }
      catch (e) {
        const g = q('[data-testid=account-activation-gate]');
        throw new Error('Home did not open: ' + (g ? 'the gate reads ' + g.getAttribute('data-activation-status') : q('[data-signin-card]') ? 'the sign-in card is shown (no account on this install)' : 'nothing recognisable'));
      }
    }
    async function settings() {
      history.pushState({}, '', '/settings'); dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => q('#cloud-account-title'));
    }
    const stateTag = () => (q('section[aria-labelledby="cloud-account-title"] .tag') || {}).textContent?.trim() || '';
    const byText = t => [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim() === t);
    // The account panel is briefly busy after sign-in or sync; a click on a
    // disabled button is silently ignored, so wait until it is enabled.
    const enabled = t => { const b = byText(t); return b && !b.disabled ? b : null; };
    const submit = () => { const b = q('#cloud-email')?.form?.querySelector('button[type=submit]'); return b && !b.disabled ? b : null; };
    """

    // The account phases (--cloud): Settings and the card on one page, and the
    // oracle relay for the codes the server's TEST email adapter issued.

    // A NEW address enters through the card (no password, no device-only
    // profile), then deletes the account in Settings with an emailed code.
    private static let cloudSignUp = cloudHelpers + cardHelpers + oracleHelpers + #"""
    await step('cloudSignUp', async () => {
      const said = await cardOnboard(newEmail);
      at = 'settings'; await settings();
      at = 'state'; await waitFor(() => stateTag() === 'Connected', 60000);
      return said + '; Settings reads Connected';
    });
    await step('cloudDeleteAccount', async () => {
      at = 'phrase'; setValue(await waitFor(() => q('#cloud-delete-phrase')), 'DELETE'); await sleep(150);
      at = 'send'; (await waitFor(() => { const b = q('[data-testid=cloud-delete-send-code]'); return b && !b.disabled && b; })).click();
      at = 'code box'; await waitFor(() => q('#cloud-delete-code-0'), 30000);
      at = 'code'; const sent = await oracle({ kind: 'emailCode', to: newEmail, purpose: 'reauth' });
      if (!/^\d{6}$/.test(sent.code || '')) throw new Error('the server sent no six-digit deletion code');
      setValue(q('#cloud-delete-code-0'), sent.code); await sleep(300);
      at = 'delete'; (await waitFor(() => { const b = q('[data-testid=cloud-delete-with-code]'); return b && !b.disabled && b; })).click();
      at = 'deleted'; await waitFor(() => /Cloud account deleted/.test(document.body.innerText) || q(GATE), 30000);
      return 'deleted with the emailed code; ' + (q(GATE) ? 'the gate took the screen (' + gateStatus() + ')' : 'the panel says so');
    });
    return JSON.stringify(steps);
    """#

    // The fixture (returning) address on the card, then Sync now.
    private static let cloud = cloudHelpers + cardHelpers + oracleHelpers + #"""
    await step('cloudSignIn', async () => {
      const said = await cardOnboard(email);
      at = 'settings'; await settings();
      at = 'connected'; await waitFor(() => stateTag() === 'Connected', 60000);
      return said + '; connected';
    });
    await step('cloudSync', async () => {
      (await waitFor(() => enabled('Sync now'), 60000)).click();
      const done = await waitFor(() => { const t = q('section[aria-labelledby="cloud-account-title"]').innerText; const m = t.match(/Sync complete[^\n]*/); return m && m[0]; }, 60000);
      await sleep(800);
      // Syncing must not drop a connected account back to "sign in" or "checking".
      if (stateTag() !== 'Connected') throw new Error('after sync the account reads ' + stateTag());
      return done;
    });
    return JSON.stringify(steps);
    """#

    // Opened while the cloud server is unreachable: account-first, the gate
    // cannot confirm the account, so it says "retry" and the shell stays shut.
    private static let offline = cloudHelpers + cardHelpers + oracleHelpers + #"""
    await step('offlineGateHolds', async () => {
      await waitFor(() => q(GATE) || shellOpen(), 40000);
      await waitFor(() => gateStatus() === 'retry' || shellOpen(), 60000);
      await sleep(2000);
      return assertHeld('opened offline');
    });
    return JSON.stringify(steps);
    """#

    // Backgrounded by another app and brought back: the page saw the
    // lifecycle, the unsent typed answer was already in the draft store when
    // the app went away, and it is still on the card and on disk afterwards.
    // (The flush of a still-pending write on hide is pinned deterministically
    // by client/test/background-draft-flush-check.mjs.)
    // The runner switches apps when THIS page asks for it (the relay below),
    // not at a fixed time: on a loaded runner a fixed-time switch could land
    // after the wait had already given up (#528).
    private static let background = cloudHelpers + """
    await step('backgroundDraftKept', async () => {
      await home();
      const log = [];
      document.addEventListener('visibilitychange', () => log.push(document.visibilityState));
      // The shell's own lifecycle events (priBridge envelope), alongside the
      // page's visibility — either proves the app went away and came back.
      // `leaving` (set once the answer is typed) reads the draft store the
      // first time the page hears it is going away — after the store's own
      // handler for that same signal has run.
      let leaving = null;
      const prior = window.__priNativeReceive;
      window.__priNativeReceive = m => {
        let state = null;
        try { if (m && m.event === 'lifecycle.state') { state = m.payload?.state; log.push(state === 'background' ? 'hidden' : state === 'active' ? 'visible' : 'inactive'); } } catch (e) {}
        if (prior) prior(m);
        if (leaving && (state === 'inactive' || state === 'background')) leaving();
      };
      history.pushState({}, '', '/practice'); dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => q('.q-prompt'));
      let input = null;
      for (let i = 0; i < 12 && !input; i++) {
        const t = byLabel('Type: answer by typing'); if (t) { t.click(); await sleep(250); }
        input = q('.editor-body input.answer-input');
        if (!input) { q('.ctx-next')?.click(); await sleep(900); }
      }
      if (!input) throw new Error('no typed question');
      const id = (q('.qpage[data-question-id]') || {}).getAttribute?.('data-question-id') || '';
      if (!id) throw new Error('no question id');
      // What the draft store holds for this question, read from disk.
      const onDisk = () => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('pri.draft.') && k.endsWith('.question.' + id)) {
            try { return JSON.parse(localStorage.getItem(k)).data?.typed ?? null; } catch (e) { return 'unreadable'; }
          }
        }
        return null;
      };
      setValue(input, 'x+42');
      // Registered after the first keystroke, so after the draft store's own
      // listener: this sees what was on disk once the page was hidden.
      let atHide = 'never told it was leaving';
      leaving = () => { if (leaving) { atHide = onDisk(); leaving = null; } };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && leaving) leaving(); });
      // Ask the runner to switch to another app and back, and wait for it.
      at = 'runner';
      window.__priJourneyReply = null;
      window.__priJourneyAsk = { n: 1, kind: 'background' };
      // The runner answers once it has brought the app back; on a loaded
      // machine `simctl launch` alone can take minutes, so the page waits on
      // that answer (bounded by the runner's own deadline), then for the
      // lifecycle it must have produced.
      try {
        at = 'runner';
        try { await waitFor(() => window.__priJourneyReply, 300000); }
        catch (e) { throw new Error('the runner never answered'); }
        if (!window.__priJourneyReply.switched) throw new Error('the runner could not switch apps: ' + window.__priJourneyReply.reason);
        at = 'lifecycle';
        try { await waitFor(() => log.includes('hidden') && log[log.length - 1] === 'visible' && document.visibilityState === 'visible', 30000); }
        catch (e) { throw new Error('no background and return seen after the switch (' + window.__priJourneyReply.ms + ' ms); lifecycle ' + (log.join('>') || 'none')); }
      } finally { window.__priNativeReceive = prior; }
      at = 'draft';
      const kept = (q('.editor-body input.answer-input') || {}).value;
      if (kept !== 'x+42') throw new Error('draft lost on screen: ' + kept);
      if (atHide !== 'x+42') throw new Error('draft not on disk when the app went away: ' + atHide);
      const disk = onDisk();
      if (disk !== 'x+42') throw new Error('draft lost on disk after resume: ' + disk);
      return 'lifecycle ' + log.join('>') + '; draft on disk as it left, on screen and disk after resume';
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
      await waitFor(() => stateTag() === 'Connected', 60000);
      return 'connected after relaunch';
    });
    await step('cloudReconnectSync', async () => {
      (await waitFor(() => enabled('Sync now'), 60000)).click();
      const done = await waitFor(() => { const t = q('section[aria-labelledby="cloud-account-title"]').innerText; const m = t.match(/Sync complete[^\\n]*/); return m && m[0]; }, 60000);
      await sleep(800);
      // Syncing must not drop a connected account back to "sign in" or "checking".
      if (stateTag() !== 'Connected') throw new Error('after sync the account reads ' + stateTag());
      return done;
    });
    await step('cloudDisconnect', async () => {
      (await waitFor(() => enabled('Disconnect'), 60000)).click();
      // Account-first: signed out, the gate takes the screen again (or the panel says so).
      const gate = () => q('[data-testid=account-activation-gate]');
      await waitFor(() => stateTag() === 'Not connected' || gate(), 20000);
      return gate() ? 'disconnected; the gate reads ' + gate().getAttribute('data-activation-status') : 'disconnected';
    });
    return JSON.stringify(steps);
    """

    // Run with the largest accessibility text size set on the simulator: the
    // shell scales the page (through the viewport) and nothing may scroll sideways.
    private static let dynamicType = cloudHelpers + """
    const overflow = () => Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth);
    await step('dynamicTypeZoom', async () => {
      await home();
      // The largest size scales the page: a CSS viewport narrower than the
      // screen (never below 360), shown at the matching scale.
      const scale = window.visualViewport ? visualViewport.scale : 1;
      const viewWidth = Math.round(innerWidth * scale);            // the web view, in points
      const expected = Math.floor(viewWidth / Math.min(1.5, viewWidth / 360));
      const desc = 'cssWidth=' + innerWidth + ' expected=' + expected + ' scale=' + scale.toFixed(3) + ' view=' + viewWidth + 'pt';
      if (!(scale > 1.05)) throw new Error('the page is not scaled: ' + desc);
      if (Math.abs(innerWidth - expected) > 2) throw new Error('the scale is not the capped Dynamic Type scale: ' + desc);
      return desc;
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
          const over = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; };
          // The innermost elements that cross the edge, not their stretched ancestors.
          const wide = [...document.querySelectorAll('body *')].filter(el => over(el) && ![...el.children].some(over))
            .map(el => [el, el.getBoundingClientRect()]).slice(0, 5)
            .map(([el, r]) => el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ').slice(0, 2).join('.') + '@' + Math.round(r.left) + '-' + Math.round(r.right) + (getComputedStyle(el).width ? ' w=' + getComputedStyle(el).width : ''));
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
        case "marking": script = marking
        case "markingRelaunch": script = markingRelaunch
        case "offlineDraft": script = offlineDraft
        case "offlineRelaunch": script = offlineRelaunch
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
        let pump = startOracle(in: webView, directory: env["PRI_JOURNEY_ORACLE_DIR"])
        webView.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
            pump?.invalidate()
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

    /// The oracle relay. The journey script leaves a question for the TEST
    /// PROCESS in `window.__priJourneyAsk`; it is written to
    /// `<directory>/ask-<n>.json`, and the harness's `reply-<n>.json` is handed
    /// back as `window.__priJourneyReply`. The app answers nothing itself and
    /// the page never learns an answer from the device. Simulator journeys
    /// only: the directory is on the Mac running the test.
    @MainActor
    private static func startOracle(in webView: WKWebView, directory: String?) -> Timer? {
        guard let directory, !directory.isEmpty else { return nil }
        let base = URL(fileURLWithPath: directory, isDirectory: true)
        var waiting = Set<Int>()
        let take = "(() => { const a = window.__priJourneyAsk; if (!a || a.taken) return null; a.taken = true; return JSON.stringify(a); })()"
        return Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak webView] _ in
            guard let webView else { return }
            webView.evaluateJavaScript(take) { value, _ in
                guard let text = value as? String, let data = text.data(using: .utf8),
                      let ask = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let n = ask["n"] as? Int else { return }
                try? data.write(to: base.appendingPathComponent("ask-\(n).json"), options: .atomic)
                waiting.insert(n)
            }
            for n in waiting {
                guard let reply = try? String(contentsOf: base.appendingPathComponent("reply-\(n).json"), encoding: .utf8) else { continue }
                waiting.remove(n)
                webView.callAsyncJavaScript("window.__priJourneyReply = JSON.parse(reply);", arguments: ["reply": reply], in: nil, in: .page, completionHandler: nil)
            }
        }
    }
}

#endif
