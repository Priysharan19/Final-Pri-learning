// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · student journey self-check (`--journey-selfcheck`, CP-04/05)
//
// Drives the real bundled app inside the real WKWebView, the way a student
// moves through it, and logs one PRIJOURNEY line per step for
// scripts/iphone-journey.mjs.
//
// Grading is online-only and server-authoritative (owner decision 2026-10-10,
// ADR-0001). The journey therefore has two legs:
//
//   · `--journey-selfcheck` — a device with NO server. Onboarding → Practice →
//     a typed answer and working → strokes on the real PencilKit surface (the
//     native bridge captures them, the page seals them in IndexedDB and the
//     one save status follows that readback) → a photo attached. Submit and
//     Show solution are REFUSED on the card; no verdict, marks or solution
//     exist. `--journey-relaunch` proves the profile, the question, the typed
//     work and the strokes survived the relaunch.
//
//   · `--journey-marking` — a real local Pri server (PRI_CLOUD_ORIGIN, DEBUG
//     builds only) whose handwriting reader is a SYNTHETIC stand-in. A
//     signed-out student is shown a server-prepared question, is refused a
//     check until they sign in ON the card, and is then marked by the server:
//     wrong → 0 with a try left, right → full marks; a handwritten page is
//     read by the server, corrected by the student and marked. The right
//     answer never comes from the page: the test process reads the server's
//     sealed copy of the issued question and hands it over through the
//     oracle directory. `--journey-marking-relaunch` finds the results in
//     History.
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
    async function onboard() {
      at = 'explicit-offline'; (await waitFor(() => q('[data-testid=hero-offline]'))).click();
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
    const pressSubmit = async () => { (await waitFor(() => { const p = primaryBtn(); return p && !p.disabled && p; }, 20000)).click(); };
    const revealBtn = () => allVis('.ws-actions .ws-actions-btns button').find(b => /^Show solution/.test(b.textContent.trim()));
    // Show solution is armed by one press and confirmed by the next.
    const pressReveal = async () => { (await waitFor(revealBtn)).click(); await sleep(450); const again = revealBtn(); if (again) again.click(); };
    """#

    private static let firstLaunch = helpers + cardHelpers + #"""
    await step('launch', async () => { await waitFor(() => q('[data-testid=hero-offline]') || q('.auth-card') || q('.home-greet')); return location.href; });
    await step('onboarding', onboard);
    await step('practice', async () => {
      await nav('/practice'); await waitFor(() => q('.q-prompt'));
      const n = await openTypedQuestion();
      assertUnmarked('opening');
      return 'question shown; question ' + n + ' of the pinned chapter takes a typed answer, working, ink and a photo';
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
      at = 'working'; await typeWorking(WORKING);
      // The typed draft itself, as stored: both fields, under this question.
      at = 'stored'; await waitFor(() => {
        const key = Object.keys(localStorage).find(k => k.endsWith('.question.' + id));
        const data = key && (JSON.parse(localStorage.getItem(key)) || {}).data;
        return data && data.typed === '12345' && data.working === WORKING;
      }, 15000);
      at = 'status'; try { await waitFor(() => { const c = saveClaim(); return c.saved && !c.notSaved; }, 10000); }
      catch (e) { throw new Error('typed work stored but the status reads: ' + saveClaim().shown); }
      assertUnmarked('typing');
      return 'answer and working stored on this device; status "' + seen('.ws-actions .status-line').slice(0, 30) + '"';
    });
    await step('photoDraft', async () => {
      // The product reads photos only on the server (ADR-0001). Attach one and
      // prove the device neither reads nor marks it: the native Vision bridge
      // is never asked, and no transcript appears.
      let nativeReads = 0;
      const original = window.__priPhotoReceive;
      window.__priPhotoReceive = p => { nativeReads += 1; if (original) original(p); };
      try {
        at = 'mode'; await photoMode();
        const input = await waitFor(() => q('.editor-body input[type=file]'));
        const c = document.createElement('canvas'); c.width = 900; c.height = 220;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#000'; g.font = 'bold 96px Helvetica, Arial, sans-serif'; g.fillText('2x + 3 = 11', 40, 145);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const files = new DataTransfer(); files.items.add(new File([blob], 'working.png', { type: 'image/png' }));
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        at = 'thumbnail'; await waitFor(() => vis(q('.photo-attach .photo-thumb img')), 20000);
        at = 'unread'; const said = await waitFor(() => !/reading your work/i.test(seen('.photo-attach [role=status]')) && seen('.photo-attach [role=status] .verdict-body'), 30000);
        if (q('[data-photo-correct-transcript]')) throw new Error('a photo transcript appeared with no server');
        await sleep(800);
        if (nativeReads) throw new Error('the on-device photo reader answered ' + nativeReads + ' time(s)');
        if (primaryBtn() && !primaryBtn().disabled && !answerBox()) throw new Error('an unread photo can be submitted');
        assertUnmarked('photo');
        return 'attached, not read on device: "' + said.slice(0, 70) + '"';
      } finally { window.__priPhotoReceive = original; }
    });
    await step('checkRefused', async () => {
      at = 'type'; await typeMode();
      if ((answerBox() || {}).value !== '12345') throw new Error('typed answer lost across modes: ' + (answerBox() || {}).value);
      at = 'submit'; const got = await checked(pressSubmit);
      // No server ever issued this question: it can never be marked.
      if (got !== 'refused' || refusalKind() !== 'new-question') throw new Error('Submit was not refused as an offline draft (' + got + '/' + refusalKind() + '): ' + seen('.verdict').slice(0, 110));
      assertUnmarked('submit');
      return 'Submit refused: "' + seen('.verdict .verdict-title') + '"; no verdict, marks or solution';
    });
    await step('solutionRefused', async () => {
      const got = await checked(pressReveal);
      if (got !== 'refused' || refusalKind() !== 'new-question') throw new Error('Show solution was not refused as an offline draft (' + got + '/' + refusalKind() + '): ' + seen('.verdict').slice(0, 110));
      assertUnmarked('show solution');
      return 'Show solution refused: "' + seen('.verdict .verdict-title') + '"; no solution shown';
    });
    await step('nothingRecorded', async () => {
      const id = qid();
      localStorage.setItem('pri-journey-draft', JSON.stringify({ id, answer: (answerBox() || {}).value || '' }));
      at = 'history'; await route('/review');
      await waitFor(() => location.pathname === '/review' && q('main'));
      await sleep(1500);
      const rows = document.querySelectorAll('.hist-row').length;
      if (rows) throw new Error(rows + ' attempt(s) recorded with no server');
      return 'History holds no attempt';
    });
    await step('progress', async () => {
      at = 'home'; await route('/'); await waitFor(() => location.pathname === '/' && q('.home-greet'));
      const link = () => [...document.querySelectorAll('a[href="/progress"]')].find(a => a.offsetParent);
      if (!link()) { q('.mobilenav button[aria-expanded]')?.click(); await waitFor(link); }
      link().click();
      await waitFor(() => location.pathname === '/progress' && q('main'));
      return 'progress shown';
    });
    await step('persistenceMarker', async () => { localStorage.setItem('pri-journey-marker', 'kept'); return 'written'; });
    return JSON.stringify(steps);
    """#

    private static let relaunch = helpers + cardHelpers + #"""
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
    await step('relaunchDraftKept', async () => {
      const draft = JSON.parse(localStorage.getItem('pri-journey-draft') || 'null');
      if (!draft || !draft.id) throw new Error('the first launch recorded no draft');
      // The sealed ink draft is restored onto a fresh native sheet, and the
      // surface reports the same three strokes back. Listening starts before
      // Practice opens: a card holding saved ink opens in Write by itself.
      at = 'ink'; if (await inkDraft(draft.id) !== 'kept') throw new Error('sealed ink draft lost');
      const echoed = await nativeStrokeEcho(async () => {
        at = 'practice'; await nav('/practice'); await waitFor(() => q('.q-prompt') && qid(), 40000);
        if (qid() !== draft.id) throw new Error('a different question came back: ' + qid() + ' (was ' + draft.id + ')');
        at = 'write'; await writeMode();
      }, STROKES.length, 30000);
      at = 'saved'; await inkSavedTruthfully(draft.id);
      at = 'typed'; await typeMode();
      await waitFor(answerBox);
      if (answerBox().value !== '12345') throw new Error('typed answer lost: ' + JSON.stringify(answerBox().value));
      const working = await shownWorking();
      if (working !== WORKING) throw new Error('typed working lost: ' + JSON.stringify(working));
      assertUnmarked('relaunch');
      // Observed, not required: an attached photo is held by the open card
      // only (drafts.js keeps answers and working, never images).
      at = 'photo'; await photoMode();
      const photo = vis(q('.photo-attach .photo-thumb')) ? 'kept' : 'not kept (not a draft)';
      return 'same question, typed answer, working and ' + echoed + ' strokes restored; unmarked; photo ' + photo;
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
    const fullMarks = () => { const m = seen('.eval-marks').match(/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?) marks?/); return m && m[1] === m[2] && Number(m[2]) > 0 ? m[0] : null; };
    """#

    private static let marking = helpers + cardHelpers + oracleHelpers + #"""
    await step('onlineOnboarding', async () => {
      await waitFor(() => q('[data-testid=hero-offline]') || q('.auth-card') || q('.home-greet'));
      await onboard();
      return 'profile created, signed out, server reachable';
    });
    await step('preparedQuestion', async () => {
      await nav('/practice'); await waitFor(() => q('.q-prompt') && qid(), 40000);
      const n = await openTypedQuestion();
      at = 'notice'; await waitFor(() => vis(q('[data-check-needs-account]')));
      assertUnmarked('signed out');
      return 'question ' + n + ' shown signed out; the card says checking needs an account';
    });
    let firstId = '';
    await step('signedOutRefusal', async () => {
      firstId = qid();
      setValue(answerBox(), WRONG); await typeWorking(WORKING);
      await sleep(500);
      at = 'submit'; const got = await checked(pressSubmit);
      if (got !== 'refused' || refusalKind() !== 'sign-in') throw new Error('expected the in-card sign-in, got ' + got + '/' + refusalKind() + ': ' + seen('.verdict').slice(0, 100));
      assertUnmarked('signed out submit');
      at = 'reveal'; const shown = await checked(pressReveal);
      if (shown !== 'refused' || refusalKind() !== 'sign-in') throw new Error('Show solution was not refused with the sign-in (' + shown + '/' + refusalKind() + ')');
      assertUnmarked('signed out reveal');
      return 'Submit and Show solution refused with the in-card sign-in; nothing marked';
    });
    await step('signInOnCard', async () => {
      window.__priJourneySamePage = 'kept';
      at = 'open'; (await waitFor(() => allVis('[data-check-sign-in]').find(b => !b.disabled))).click();
      at = 'panel'; await waitFor(() => q('section[aria-labelledby="cloud-account-title"]'), 30000);
      const panel = () => q('section[aria-labelledby="cloud-account-title"]');
      const signIn = [...panel().querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign in');
      if (signIn) { signIn.click(); await sleep(200); }
      setValue(await waitFor(() => q('#cloud-email')), email);
      setValue(q('#cloud-password'), password); await sleep(200);
      at = 'submit'; (await waitFor(() => { const b = q('#cloud-email')?.form?.querySelector('button[type=submit]'); return b && !b.disabled ? b : null; })).click();
      at = 'linked'; await waitFor(() => !refusalKind() && !q('[data-check-needs-account]') && !q('#cloud-email'), 60000);
      if (location.pathname !== '/practice' || window.__priJourneySamePage !== 'kept') throw new Error('the student left the question: ' + location.pathname);
      if (qid() !== firstId) throw new Error('a different question after sign-in');
      if ((answerBox() || {}).value !== WRONG) throw new Error('typed answer lost in sign-in: ' + (answerBox() || {}).value);
      if (await shownWorking() !== WORKING) throw new Error('typed working lost in sign-in');
      assertUnmarked('sign-in alone');
      return 'signed in on the card; same question, answer and working kept; nothing marked yet';
    });
    // A wrong answer then the right one, on a question whose sealed answer the
    // oracle can state. The first candidate is the question prepared signed out.
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
        if (i === 0 && !escrow.fromPrepared) throw new Error('the server did not bind the prepared question');
        if (got !== 'miss' || !escrow.supported) { passed.push(got + '/' + (escrow.answerType || 'unstatable')); continue; }   // unreadable for this answer type, or no statable answer
        if (q('.eval-card') || q('.solution-panel')) throw new Error('a first miss resolved the question');
        if (!answerBox() || answerBox().disabled) throw new Error('no second try offered');
        typedEscrow = escrow; typedLocal = qid();
        return 'server marked the wrong answer: "' + seen('.verdict .verdict-title') + '", question still open' + (i === 0 ? ' (the question prepared signed out)' : ' (issued question ' + (i + 1) + ')');
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

    private static let markingRelaunch = helpers + cardHelpers + #"""
    await step('historyAfterRelaunch', async () => {
      await waitFor(() => q('.home-greet') || q('.auth-card'));
      if (!q('.home-greet')) {
        const picker = [...document.querySelectorAll('.auth-card button')].find(b => /Journey Student/.test(b.textContent));
        if (!picker) throw new Error('profile not found after relaunch');
        picker.click(); await waitFor(() => q('.home-greet'));
      }
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
    // The account panel is briefly busy after sign-in or sync; a click on a
    // disabled button is silently ignored, so wait until it is enabled.
    const enabled = t => { const b = byText(t); return b && !b.disabled ? b : null; };
    const submit = () => { const b = q('#cloud-email')?.form?.querySelector('button[type=submit]'); return b && !b.disabled ? b : null; };
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
      (await waitFor(submit)).click();
      at = 'connected'; await waitFor(() => stateTag() === 'Connected', 60000);
      return 'connected';
    });
    await step('cloudSync', async () => {
      (await waitFor(() => enabled('Sync now'), 60000)).click();
      const done = await waitFor(() => { const t = q('section[aria-labelledby="cloud-account-title"]').innerText; const m = t.match(/Sync complete[^\\n]*/); return m && m[0]; }, 60000);
      await sleep(800);
      // Syncing must not drop a connected account back to "sign in" or "checking".
      if (stateTag() !== 'Connected') throw new Error('after sync the account reads ' + stateTag());
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
      (await waitFor(submit)).click();
    };
    await step('cloudSignUp', async () => {
      at = 'home'; await home(); await settings();
      at = 'state'; await waitFor(() => stateTag() === 'Not connected');
      (await waitFor(() => enabled('Create account'))).click();
      setValue(await waitFor(() => q('#cloud-name')), 'Journey Adult');
      setValue(q('#cloud-email'), newEmail); setValue(q('#cloud-password'), newPassword);
      const boxes = [...q('#cloud-email').form.querySelectorAll('input[type=checkbox]')];
      for (const b of boxes) if (!b.checked) { b.click(); await sleep(120); }
      (await waitFor(submit)).click();
      at = 'connected'; await waitFor(() => stateTag() === 'Connected', 60000);
      return stateTag();
    });
    await step('cloudLogin', async () => {
      // Log out and sign the new account back in through the form.
      (await waitFor(() => enabled('Disconnect'), 60000)).click();
      await waitFor(() => stateTag() === 'Not connected', 20000);
      await signIn(newEmail, newPassword);
      await waitFor(() => stateTag() === 'Connected', 60000);
      return 'signed back in as the new account';
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
        const t = byLabel('Type: answer by typing'); if (t) { t.click(); await sleep(250); }
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
      await waitFor(() => stateTag() === 'Not connected', 20000);
      return 'disconnected';
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
