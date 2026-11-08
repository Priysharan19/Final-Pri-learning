// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging journey's practice steps (4–9, the guardian's
// withdrawal, and the `full` profile's isolation and free-cap probes).
//
// Every step drives the real UI a student uses, against whatever origin the
// harness was given (staging; or, through tools/staging-journey-local.mjs
// only, the in-process platform). Nothing here knows an answer in advance:
// the engine's key is learnt only the way a student learns it — the server
// reveals its worked solution when a question resolves — and "the same
// question again" from History is how that key is then answered. Reading
// stays answer-blind: the reader is sent a picture of SYNTHETIC ink or a
// SYNTHETIC photo, never the question or its key, and a reading never sets a
// mark — the server's deterministic engine marks the text the student
// confirmed.
//
// The functions take the harness context `h` built in staging-journey-proof.mjs
// (step, check, finish, shot, api, contexts, the mailbox and its link reader,
// the paid-read ledger) and return nothing; each records its own step.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { writeLines } from './acceptance/simulated-ink.mjs';
import { simulatedPhotoPng } from './acceptance/synthetic-png.mjs';

export const SURELY_WRONG = Object.freeze(['-987654', '-987653']);
// Class 10 (the adult signs up in Class 10): numeric answers, mostly whole.
export const TYPED_TOPIC = 'c10-arithmetic-progressions';
// The #723 form: a ₹-priced prompt whose box counts rupees in a scale word.
// (Class VII large numbers, dot point 1 at D3: c7-place-value-systems-reasoning.)
export const RUPEE_TOPIC = 'subtopic=c7-large-numbers-current&dotpoint=0&difficulty=3';
const SUBMIT = /^\/v1\/practice\/[^/]+\/submit$/;
const PAID_READ = /^\/v1\/(?:handwriting\/transcribe|practice\/[^/]+\/recognize|question-photo\/identify)$/;
const READER = /^\/v1\/(?:handwriting(?:\/|$)|practice\/[^/]+\/recognize$|question-photo\/)/;

/** A request that buys a reading from the paid provider (a Submit that carries its picture is counted from its reply). */
export const isPaidReadRequest = (method, path) => method === 'POST' && PAID_READ.test(path);
/** Any request to the reader's routes, a status probe included (D17: none before the student accepts). */
export const isReaderRequest = path => READER.test(path);
/** Text the SYNTHETIC ink glyph set can write as a number. */
export const writable = text => /^-?\d{1,5}$/.test(String(text ?? '').trim());
/** A number to draw that is NOT the target, so correcting the transcript is a real edit. */
export const otherWritable = target => ['11', '12', '14'].find(c => c !== String(target ?? '').trim());

/**
 * The ₹ amount a croreMillion prompt asks for, from the prompt text alone
 * (what the student reads): { amount, unit } or null for any other prompt.
 */
export function rupeeAmountOf(prompt) {
  const p = String(prompt || '').replace(/\s+/g, ' ');
  const fmt = n => String(Number(n.toFixed(1)));
  let m = /earned ₹ ?(\d+) million .*in crores/i.exec(p);
  if (m) return { amount: fmt(Number(m[1]) / 10), unit: 'crore' };
  m = /is ₹ ?(\d+) crore (\d+) lakh.*in millions/i.exec(p);
  if (m) return { amount: fmt((100 * Number(m[1]) + Number(m[2])) / 10), unit: 'million' };
  m = /collected ₹ ?(\d+) lakh.*in millions/i.exec(p);
  if (m) return { amount: fmt(Number(m[1]) / 10), unit: 'million' };
  return null;
}

/**
 * SYNTHETIC ink for `lines` (tools/acceptance/simulated-ink.mjs), scaled into
 * a canvas box, as absolute viewport points: [[{x,y},…],…], one per stroke.
 */
export function inkPlan(lines, box, { seed = 20261109, margin = 28 } = {}) {
  const { strokes } = writeLines(lines, { seed, size: 64, lineGap: 110, x0: 0, y0: 0 });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of strokes) for (const p of st) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const w = Math.max(1, maxX - minX), hgt = Math.max(1, maxY - minY);
  const scale = Math.min((box.width - 2 * margin) / w, (box.height - 2 * margin) * 0.6 / hgt, 1.1);
  const ox = box.x + margin, oy = box.y + margin;
  return strokes.map(st => st.map(p => ({ x: Math.round((ox + (p.x - minX) * scale) * 10) / 10, y: Math.round((oy + (p.y - minY) * scale) * 10) / 10 })));
}

// ── page helpers ─────────────────────────────────────────────────────────────

const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
/** What a student reads in an element: KaTeX's hidden MathML copy is left out. */
const seen = (page, selector) => page.evaluate(sel => {
  const el = document.querySelector(sel);
  if (!el) return '';
  const copy = el.cloneNode(true);
  copy.querySelectorAll('.katex-mathml, .sr-only').forEach(n => n.remove());
  return copy.textContent;
}, selector).then(flat).catch(() => '');
const quiet = page => page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id').catch(() => null);

async function openPractice(h, page, query) {
  await quiet(page);
  await page.goto(`${h.origin}/practice?${query}`, { waitUntil: 'domcontentloaded' });
  return page.locator('.qpage[data-question-id] .q-prompt').first().waitFor({ timeout: 45000 }).then(() => true, () => false);
}

async function nextQuestion(page) {
  const leaving = await shownId(page);
  await page.locator('.ctx-next').first().click();
  await page.waitForFunction(id => {
    const el = document.querySelector('.qpage[data-question-id]');
    return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
  }, leaving, { timeout: 30000 });
  await quiet(page);
}

/** The typed answer box, when this question has exactly one (after choosing Type). */
async function typedBox(page) {
  const tab = page.getByRole('button', { name: /answer by typing/i });
  if (await tab.count()) await tab.first().click().catch(() => {});
  await page.waitForTimeout(300);
  const box = page.locator('.editor-body input.answer-input');
  return (await box.count()) === 1 ? box : null;
}

/** Skip (Next) until a question with one typed box is on the card. */
async function findTyped(page, { tries = 6, want = async () => true } = {}) {
  for (let i = 0; i <= tries; i++) {
    const box = await typedBox(page);
    if (box && await want(page)) return box;
    if (i < tries) await nextQuestion(page);
  }
  return null;
}

async function pressSubmit(page) {
  // A reading the student must confirm first turns the press into "Check this
  // reading first"; their "Confirm reading" is then the submit.
  const ask = page.getByRole('button', { name: 'Check this reading first' });
  if (await ask.count()) {
    await ask.first().click();
    await page.getByRole('button', { name: 'Confirm reading' }).first().click();
    return;
  }
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 20000 });
  await page.locator('.ws-actions .btn-primary').last().click();
}

/** Do `action` and return the server's reply to the Submit it causes. */
async function gradeOf(page, action, timeout = 45000) {
  const waiting = page.waitForResponse(r => SUBMIT.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout });
  await action();
  const r = await waiting.catch(() => null);
  if (!r) return null;
  let body = null;
  try { body = r.request().postDataJSON(); } catch { body = null; }
  return { path: new URL(r.url()).pathname, status: r.status(), body, json: await r.json().catch(() => null) };
}

/** The card's verdict after a Submit: the result card, or a pinned verdict for an open try. */
const verdictShown = page => page.locator('.eval-card, .verdict[data-verdict-of], [data-check-refusal]').first().waitFor({ timeout: 30000 }).then(() => true, () => false);

/** "Same question" from History: the server re-issues the question it holds, as a repeat. */
async function repeatFromHistory(h, page, prompt) {
  await quiet(page);
  await page.goto(`${h.origin}/history`, { waitUntil: 'domcontentloaded' });
  if (!await page.locator('.hist-row').first().waitFor({ timeout: 30000 }).then(() => true, () => false)) return { ok: false, why: 'History shows no rows' };
  const rows = page.locator('.hist-row');
  const n = await rows.count();
  let row = null;
  const want = flat(prompt).slice(0, 40);
  for (let i = 0; i < n && !row; i++) {
    const text = flat(await rows.nth(i).locator('.hist-main').evaluate(el => { const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml, .sr-only').forEach(x => x.remove()); return c.textContent; }).catch(() => ''));
    if (want && text.includes(want.slice(0, 30))) row = rows.nth(i);
  }
  row = row || rows.first();
  await row.locator('.hist-main').click();
  const same = row.getByRole('button', { name: 'Same question' });
  if (!await same.waitFor({ timeout: 15000 }).then(() => true, () => false)) return { ok: false, why: 'the History row offers no "Same question"' };
  const issued = page.waitForResponse(r => /\/v1\/practice\/[^/]+\/repeat$/.test(new URL(r.url()).pathname), { timeout: 30000 }).catch(() => null);
  await same.click();
  const reply = await issued;
  await page.locator('.qpage[data-question-id] .q-prompt').first().waitFor({ timeout: 30000 }).catch(() => {});
  await quiet(page);
  const again = await seen(page, '.q-prompt');
  return { ok: reply?.status() === 201 && flat(again).slice(0, 40) === want, status: reply?.status() ?? null, prompt: again };
}

/** History rows as a student sees them: prompt (visual text) and verdict. */
async function historyRows(h, page, { reload = false } = {}) {
  await quiet(page);
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
  else await page.goto(`${h.origin}/history`, { waitUntil: 'domcontentloaded' });
  await page.locator('.hist-row').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.locator('.hist-row').evaluateAll(rows => rows.map(r => {
    const main = r.querySelector('.hist-main');
    const c = main ? main.cloneNode(true) : null;
    c?.querySelectorAll('.katex-mathml, .sr-only, .in-led-tm').forEach(x => x.remove());
    const q = c?.querySelector('.in-led-q, .hist-q') || c;
    return {
      prompt: (q?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      verdict: (r.querySelector('.in-led-res > .sr-only, .hist-verdict .sr-only')?.textContent || '').trim()
    };
  }));
}
/** Attempt rows this device's account sync restored from the server ('<pid>:remote:<event>'), read back from IndexedDB. */
const restoredAttempts = page => page.evaluate(() => new Promise(done => {
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done(0);
  open.onsuccess = () => {
    const db = open.result;
    try {
      const req = db.transaction('attempts').objectStore('attempts').getAll();
      req.onsuccess = () => { db.close(); done(req.result.filter(r => String(r.id).includes(':remote:')).length); };
      req.onerror = () => { db.close(); done(0); };
    } catch { db.close(); done(0); }
  };
})).catch(() => 0);
const verdictCounts = rows => rows.reduce((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] || 0) + 1 }), {});
const sameRows = (a, b) => JSON.stringify([...a].map(r => `${r.verdict}|${r.prompt}`).sort()) === JSON.stringify([...b].map(r => `${r.verdict}|${r.prompt}`).sort());

/** Sign a fresh browser in by email code (a new address is asked its name, age and class). */
export async function codeSignIn(h, size, label, email, { name = 'Staging Proof', age = 18, cls = 10, s = null } = {}) {
  const C = await h.newContext(size, label);
  await C.page.goto(h.origin + '/', { waitUntil: 'domcontentloaded' });
  const card = C.page.locator('[data-signin-card="page"]');
  if (!await card.waitFor({ timeout: 45000 }).then(() => true, () => false)) return { ...C, signedIn: false, why: 'no sign-in card' };
  await h.codeCooldown(email);
  const t0 = Date.now();
  await card.locator('#signup-destination').fill(email);
  await card.getByTestId('signup-send-code').click();
  if (!await card.locator('#signup-code-0').waitFor({ timeout: 20000 }).then(() => true, () => false)) return { ...C, signedIn: false, why: 'the card never showed the code boxes' };
  const code = await h.waitCode(s || h.current(), email, 'sign-in', t0);
  if (!code) return { ...C, signedIn: false, why: 'no code reached the inbox' };
  await h.typeCode(C.page, 'signup-code', code);
  const age18 = card.locator('#signup-flow-name');
  const step = await Promise.race([
    age18.waitFor({ timeout: 30000 }).then(() => 'age', () => null),
    card.getByTestId(`signup-class-${cls}`).waitFor({ timeout: 30000 }).then(() => 'class', () => null),
    C.page.locator('.shell').waitFor({ timeout: 30000 }).then(() => 'shell', () => null)
  ]);
  if (step === 'age') {
    await age18.fill(name);
    await card.getByTestId(`signup-age-${age}`).click();
    if (await card.getByTestId('signup-agree').count()) await card.getByTestId('signup-agree').check();
    await card.getByTestId('signup-age-next').click();
  }
  if (step !== 'shell' && await card.getByTestId(`signup-class-${cls}`).waitFor({ timeout: 30000 }).then(() => true, () => false)) {
    await card.getByTestId(`signup-class-${cls}`).click(); await card.getByTestId('signup-class-next').click();
  }
  const shell = await C.page.locator('.shell').waitFor({ timeout: 60000 }).then(() => true, () => false);
  const id = await h.signedInAs(C.page);
  return { ...C, signedIn: shell && !!id, id, newAccount: step === 'age' };
}

// ── step 5 · a typed answer, the server's mark, fairness against its key ────

export async function stepTypedMark(h, A, account) {
  const s = h.begin('5', 'Server-issued question, typed answer, server mark with criteria; fairness against the engine\'s own key as the product reveals it (and the #723 ₹/crore form)');
  const { page } = A;
  const opened = await openPractice(h, page, `subtopic=${TYPED_TOPIC}`);
  const box = opened ? await findTyped(page) : null;
  if (!h.check(s, 'Practice serves a server-issued question with one box to type in', !!box)) { await h.shot(s, page, 'no-typed-question'); return h.finish(s, 'FAIL'); }
  const prompt = await seen(page, '.q-prompt');
  s.notes.push(`question: "${prompt.slice(0, 160)}"`);

  // First try: a surely wrong answer. An open try says wrong, and nothing more.
  await box.fill(SURELY_WRONG[0]);
  const g1 = await gradeOf(page, () => pressSubmit(page));
  await verdictShown(page);
  await h.shot(s, page, 'first-try-wrong');
  h.check(s, 'first wrong try: the server marks it (authoritative), not correct, the question still open, and no solution or key in its reply',
    g1?.status === 200 && g1.json?.authoritative === true && g1.json.correct === false && g1.json.resolved === false && !g1.json.solution,
    JSON.stringify({ status: g1?.status, correct: g1?.json?.correct, resolved: g1?.json?.resolved, solution: !!g1?.json?.solution }));
  h.check(s, 'the card shows no solution or result card while the question is open', await page.locator('.eval-card, .solution-panel').count() === 0);

  // Second try: wrong again. The question resolves and the server reveals its key.
  const box2 = page.locator('.editor-body input.answer-input');
  await box2.fill(SURELY_WRONG[1]);
  const g2 = await gradeOf(page, () => pressSubmit(page));
  await page.locator('.eval-card').first().waitFor({ timeout: 30000 }).catch(() => {});
  await h.shot(s, page, 'resolved-wrong-solution');
  const sol = g2?.json?.solution || {};
  const key = flat(sol.answerText);
  const cardText = await seen(page, '.qpage');
  h.check(s, 'second wrong try: resolved, incorrect, fewer marks than possible, with the worked solution and the server\'s marking criteria',
    g2?.status === 200 && g2.json?.authoritative === true && g2.json.resolved === true && g2.json.correct === false &&
      Number(g2.json.marksEarned) < Number(g2.json.marksPossible) && !!key && Array.isArray(sol.criteria) && sol.criteria.length > 0,
    JSON.stringify({ marks: [g2?.json?.marksEarned, g2?.json?.marksPossible], key, criteria: (sol.criteria || []).map(c => c.text).slice(0, 4) }));
  h.check(s, 'the card shows the result ("incorrect"), the marks, and the engine\'s answer as the server revealed it',
    await page.locator('.eval-card[data-outcome="incorrect"]').count() === 1 && /\d+\s*\/\s*\d+\s*marks?/i.test(cardText) && !!key && cardText.replace(/\s/g, '').includes(key.replace(/\s/g, '')),
    `key "${key}"; card ${cardText.slice(0, 300)}`);
  const criteriaShown = (sol.criteria || []).filter(c => cardText.includes(flat(c.text).slice(0, 24))).length;
  h.check(s, 'criterion feedback: the card states the server\'s marking criteria', criteriaShown > 0, `${criteriaShown}/${(sol.criteria || []).length} criteria on the card`);
  h.check(s, 'fairness: the revealed key is not either wrong answer that was refused', !!key && !SURELY_WRONG.includes(key), key);
  if (g2?.json?.resolved) h.marked({ context: A.label, questionId: g2.json.questionId, attemptId: g2.json.attemptId, correct: false, prompt, mode: 'typed' });

  // The same question again (History), answered with the revealed key: full marks.
  const rep = await repeatFromHistory(h, page, prompt);
  h.check(s, '"Same question" from History: the server re-issues it (201) and the same question is on the card', rep.ok, JSON.stringify(rep).slice(0, 300));
  let g3 = null;
  if (rep.ok) {
    const b3 = await typedBox(page);
    if (b3) {
      await b3.fill(key);
      g3 = await gradeOf(page, () => pressSubmit(page));
      await page.locator('.eval-card').first().waitFor({ timeout: 30000 }).catch(() => {});
      await h.shot(s, page, 'repeat-key-full-marks');
    }
    h.check(s, 'fairness: the engine\'s own revealed key, typed into the same question, is marked correct with full marks (a repeat, so no new credit)',
      g3?.status === 200 && g3.json?.authoritative === true && g3.json.correct === true && g3.json.resolved === true && g3.json.marksEarned === g3.json.marksPossible && g3.json.repeat === true,
      JSON.stringify({ sent: key, status: g3?.status, correct: g3?.json?.correct, marks: [g3?.json?.marksEarned, g3?.json?.marksPossible], repeat: g3?.json?.repeat }));
    if (g3?.json?.resolved) h.marked({ context: A.label, questionId: g3.json.questionId, attemptId: g3.json.attemptId, correct: g3.json.correct === true, prompt, mode: 'typed' });
  }
  h.run.key = key ? { key, prompt, writable: writable(key) } : null;

  // The #723 form, recorded as a note: "₹<amount>" typed on a ₹-priced scale-word box.
  await rupeeProbe(h, s, page);
  return h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL');
}

async function rupeeProbe(h, s, page) {
  const opened = await openPractice(h, page, RUPEE_TOPIC);
  let found = null;
  const seenPrompts = [];
  for (let i = 0; opened && i < 5 && !found; i++) {
    const box = await typedBox(page);
    const prompt = await seen(page, '.q-prompt');
    seenPrompts.push(prompt.slice(0, 60));
    const want = box ? rupeeAmountOf(prompt) : null;
    if (want) { found = { box, prompt, ...want }; break; }
    if (i < 4) await nextQuestion(page).catch(() => {});
  }
  if (!found) {
    s.notes.push(`#723 probe: no ₹-priced crore/lakh/million question came up in ${seenPrompts.length} question(s) of ${RUPEE_TOPIC}${opened ? '' : ' (the chapter did not open)'}; not attempted. Seen: ${JSON.stringify(seenPrompts)}`);
    return;
  }
  const typed = `₹${found.amount}`;
  await found.box.fill(typed);
  const g = await gradeOf(page, () => pressSubmit(page));
  await verdictShown(page);
  await h.shot(s, page, 'rupee-probe');
  if (g?.json?.resolved) h.marked({ context: 'phone', questionId: g.json.questionId, attemptId: g.json.attemptId, correct: g.json.correct === true, prompt: found.prompt, mode: 'typed' });
  const said = flat(await page.locator('.verdict, .eval-card, [data-check-refusal]').first().innerText().catch(() => ''));
  s.notes.push(`#723 probe (a note, not a pass/fail claim): on "${found.prompt.slice(0, 120)}" (box in ${found.unit}s) the right amount typed as "${typed}" was answered ${g?.status} ` +
    `${g?.json?.error?.code || ''} correct=${g?.json?.correct} resolved=${g?.json?.resolved} marks=${g?.json?.marksEarned ?? '–'}/${g?.json?.marksPossible ?? '–'}; the card said "${said.slice(0, 160)}"`);
}

// ── step 6 · handwriting through the real reader (SYNTHETIC ink) ────────────

export async function stepHandwriting(h, A, account) {
  const s = h.begin('6', 'Handwritten answer through the real reader (SYNTHETIC ink): D17 prompt first, transcript corrected and confirmed, receipt bound to the edit, idempotent replay');
  s.notes.push(`SYNTHETIC ink: pen strokes from tools/acceptance/simulated-ink.mjs replayed as pointer events on the canvas. Not a person's writing, not a Pencil, not a device.${h.local ? ' LOCAL RUN: the reader is the in-process SYNTHETIC stand-in (it returns the text the harness drew and never looks at the picture) — not real-reader evidence.' : ''}`);
  const { page } = A;
  const target = h.run.key?.writable ? h.run.key.key : null;
  const opened = target ? (await repeatFromHistory(h, page, h.run.key.prompt)).ok : await openPractice(h, page, `subtopic=${TYPED_TOPIC}`);
  const want = target ?? '42';
  if (!target) s.notes.push('no writable key from step 5: the corrected answer is "42" and its mark is recorded, not asserted correct');
  const write = page.getByRole('button', { name: /answer by handwriting/i });
  if (opened && await write.count()) await write.first().click();
  const canvas = page.locator('.ink-canvas-live').first();
  if (!h.check(s, 'the question offers Write, with a live ink canvas', opened && await canvas.waitFor({ timeout: 30000 }).then(() => true, () => false))) { await h.shot(s, page, 'no-canvas'); return h.finish(s, 'FAIL'); }
  await canvas.scrollIntoViewIfNeeded().catch(() => {});
  const box = await canvas.boundingBox();
  const drawn = otherWritable(want);
  h.local?.script({ text: drawn, confidence: 0.97 });

  // Writing sends nothing.
  const mark = h.readerRequests().length;
  for (const stroke of inkPlan([drawn], box)) {
    await page.mouse.move(stroke[0].x, stroke[0].y);
    await page.mouse.down();
    for (const p of stroke.slice(1)) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
  }
  await page.waitForTimeout(1500);
  await h.shot(s, page, 'synthetic-ink');
  h.check(s, `writing sends nothing: 0 reader requests while SYNTHETIC ink of "${drawn}" is drawn`, h.readerRequests().length === mark, `${h.readerRequests().length - mark} request(s)`);
  const read = page.locator('[data-ink-read]').first();
  if (!h.check(s, '"Read my answer" is offered for the written page', await read.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false),
    await seen(page, '.ink-status-line'))) { await h.shot(s, page, 'no-read-button'); return h.finish(s, 'FAIL'); }
  if (!h.readBudgetLeft()) { s.blocked.push(`the run's paid-read budget (${h.profile.paidReads}) is spent`); return h.finish(s, 'BLOCKED'); }

  // D17: the first read asks first, naming OpenAI; nothing leaves before Yes.
  await read.click();
  const sheet = page.locator('[data-reader-permission-sheet]');
  const asked = await sheet.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
  if (asked) {
    await page.waitForTimeout(1200);
    const text = flat(await sheet.innerText().catch(() => ''));
    await h.shot(s, page, 'd17-prompt');
    h.check(s, 'D17: the first "Read my answer" opens a one-time prompt that names OpenAI', /OpenAI/.test(text), text.slice(0, 200));
    h.check(s, 'D17: nothing is sent to the reader while the prompt is open (0 requests to /v1/handwriting*, /recognize)', h.readerRequests().length === mark,
      JSON.stringify(h.readerRequests().slice(mark).map(r => `${r.method} ${r.path}`)));
    await page.locator('[data-reader-permission="accept"]').click();
  } else {
    const sent = h.readerRequests().slice(mark);
    h.check(s, 'D17: a one-time prompt naming OpenAI appears before the first read, and nothing is sent until it is accepted', false,
      `no prompt within 8 s; ${sent.length} reader request(s) went out: ${JSON.stringify(sent.map(r => `${r.method} ${r.path}`))}`);
    s.defects.push({ what: 'the first handwriting read is sent to the reader with no D17 prompt (owner default D17: a one-time prompt naming OpenAI before the first read or photo; nothing leaves the device until it is accepted)',
      where: 'client/src/ink/InkAnswer.jsx readNow → cloudReader.js (the D17 prompt, client/src/ink/ReaderPermission.jsx, is on PR #737 task/l4-ink-gates-native, not on this build)',
      repro: 'a verified student opens a written-answer question, chooses Write, writes, presses "Read my answer": the picture is sent at once', lane: 'L4 (handwriting; PR #737)' });
  }
  const lines = await page.locator('.ink-line').first().waitFor({ timeout: 45000 }).then(() => page.locator('.ink-line').evaluateAll(n => n.map(x => x.getAttribute('data-text') || '')), () => []);
  const readsAfter = h.readerRequests().slice(mark).filter(r => isPaidReadRequest(r.method, r.path));
  h.check(s, `the reader returned a transcript for the SYNTHETIC ink, after one press: ${readsAfter.length} paid read request(s)`, lines.length > 0 && readsAfter.length === 1,
    `transcript ${JSON.stringify(lines)}`);
  s.notes.push(`the ${h.local ? 'SYNTHETIC stand-in' : 'real'} reader read SYNTHETIC ink of "${drawn}" as ${JSON.stringify(lines)}`);
  if (!lines.length) { await h.shot(s, page, 'no-reading'); return h.finish(s, 'FAIL'); }

  // The student corrects the transcript explicitly, then confirms it.
  await page.locator('.ink-line').first().locator('.ink-correct-btn').click();
  await page.locator('form.ink-correct input').fill(want);
  await page.locator('form.ink-correct button[type="submit"]').click();
  await page.waitForTimeout(800);
  const first = page.locator('.ink-line').first();
  h.check(s, `the transcript is corrected by the student: line 1 now reads "${want}" and is marked corrected`,
    await first.getAttribute('data-text') === want && await first.getAttribute('data-corrected') === 'true',
    JSON.stringify({ text: await first.getAttribute('data-text'), corrected: await first.getAttribute('data-corrected') }));
  const finalField = page.locator('[data-ink-final-answer]');
  if (await finalField.count() && await finalField.isVisible().catch(() => false) && (await finalField.inputValue()) !== want) await finalField.fill(want);
  await h.shot(s, page, 'transcript-corrected');
  const g = await gradeOf(page, () => pressSubmit(page));
  await page.locator('.eval-card, .verdict[data-verdict-of]').first().waitFor({ timeout: 30000 }).catch(() => {});
  await h.shot(s, page, 'handwritten-marked');
  h.check(s, 'the server marks the CONFIRMED text: Submit sends the corrected answer, and the reply is authoritative',
    g?.status === 200 && g.json?.authoritative === true && (g.body ? String(g.body.answer).trim() === want && g.body.mode === 'ink' : true),
    JSON.stringify({ status: g?.status, sent: g?.body?.answer ?? '(body not exposed by this engine)', mode: g?.body?.mode, correct: g?.json?.correct }));
  h.check(s, 'the reading receipt is bound to the edit: the server reports the answer as corrected by the student, with a receipt',
    g?.json?.reading?.corrected === true && typeof g.json.reading.receipt === 'string' && g.json.reading.receipt.length > 8,
    JSON.stringify(g?.json?.reading || null));
  if (h.local && g?.json?.reading?.receipt) {
    const proof = h.local.platform.recognitionProof(account.id, g.json.reading.receipt);
    h.check(s, 'LOCAL desk check (in-process database, not available on staging): the stored receipt holds the edited text, correctedByStudent, and points to the provider\'s receipt',
      proof?.text === want && proof.correctedByStudent === true && !!proof.parentReceipt, JSON.stringify(proof));
  }
  if (target) {
    h.check(s, 'a handwritten answer of the engine\'s own key is marked correct, full marks', g?.json?.correct === true && g.json.marksEarned === g.json.marksPossible,
      JSON.stringify([g?.json?.marksEarned, g?.json?.marksPossible]));
  }
  if (g?.json?.resolved) h.marked({ context: A.label, questionId: g.json.questionId, attemptId: g.json.attemptId, correct: g.json.correct === true, prompt: h.run.key?.prompt || '', mode: 'ink' });

  // Replaying the same submission returns the same attempt, and marks nothing new.
  const body = g?.body || h.lastSubmitBody(g?.path);
  if (body && g?.path) {
    const paidBefore = h.paidReads();
    const again = await h.api(page, 'POST', g.path, body);
    h.check(s, 'idempotency: the same submission sent again returns the same attempt (same attemptId and submissionId), and buys no read',
      again.status === 200 && again.data?.attemptId === g.json?.attemptId && again.data?.submissionId === g.json?.submissionId && h.paidReads() === paidBefore,
      JSON.stringify({ status: again.status, attempt: [again.data?.attemptId === g.json?.attemptId, again.data?.submissionId === g.json?.submissionId], reads: h.paidReads() - paidBefore }));
  } else {
    h.check(s, 'idempotency: the same submission sent again returns the same attempt', false, 'the Submit request body could not be read back from this engine to replay it');
  }
  return h.finish(s, s.checks.every(c => c.ok) ? 'SYNTHETIC-PASS' : 'FAIL');
}

// ── step 7 · a photo answer through the real reader (SYNTHETIC photo) ───────

export async function stepPhoto(h, A, account) {
  const s = h.begin('7', 'Photo answer through the real reader (SYNTHETIC photo): attach, read, confirm, server mark');
  const target = h.run.key?.writable ? h.run.key.key : null;
  const want = target ?? '42';
  const png = simulatedPhotoPng([want]);
  s.notes.push(`SYNTHETIC photo: a ${png.width}×${png.height} PNG of "${want}" drawn by tools/acceptance/synthetic-png.mjs (ballpoint on ruled paper). Not a camera, not a student's page.${h.local ? ' LOCAL RUN: the reader is the in-process SYNTHETIC stand-in — not real-reader evidence.' : ''}`);
  const { page } = A;
  const opened = target ? (await repeatFromHistory(h, page, h.run.key.prompt)).ok : await openPractice(h, page, `subtopic=${TYPED_TOPIC}`);
  const photo = page.getByRole('button', { name: /answer with a photo/i });
  if (opened && await photo.count()) await photo.first().click();
  const input = page.locator('.editor-body input[type="file"]').first();
  if (!h.check(s, 'the question offers Photo, with a file input', opened && await input.waitFor({ state: 'attached', timeout: 30000 }).then(() => true, () => false))) { await h.shot(s, page, 'no-photo'); return h.finish(s, 'FAIL'); }
  const mark = h.readerRequests().length;
  await input.setInputFiles({ name: 'synthetic-photo.png', mimeType: 'image/png', buffer: png.png });
  const readMine = page.locator('[data-photo-read]').first();
  const offered = await readMine.waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(1200);
  await h.shot(s, page, 'photo-attached');
  h.check(s, 'attaching is not reading: 0 reader requests, and "Read my photo" is offered', offered && h.readerRequests().length === mark, `${h.readerRequests().length - mark} request(s)`);
  if (!offered) return h.finish(s, 'FAIL');
  if (!h.readBudgetLeft()) { s.blocked.push(`the run's paid-read budget (${h.profile.paidReads}) is spent`); return h.finish(s, 'BLOCKED'); }
  h.local?.script({ text: want, confidence: 0.9 });
  await readMine.click();
  const sheet = page.locator('[data-reader-permission-sheet]');
  if (await sheet.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) {
    h.check(s, 'D17: nothing is sent while the prompt is open', h.readerRequests().length === mark);
    s.notes.push('the D17 prompt was shown again for the photo (it was already accepted for handwriting on this profile)');
    await page.locator('[data-reader-permission="accept"]').click();
  }
  const linesShown = await page.locator('[data-photo-lines]').first().waitFor({ timeout: 45000 }).then(() => true, () => false);
  const lines = await page.locator('[data-photo-line] input').evaluateAll(n => n.map(x => x.value)).catch(() => []);
  const paid = h.readerRequests().slice(mark).filter(r => isPaidReadRequest(r.method, r.path)).length;
  h.check(s, `the photo is read once, into an editable transcript: ${paid} paid read request(s)`, linesShown && lines.length > 0 && paid === 1, JSON.stringify(lines));
  s.notes.push(`the ${h.local ? 'SYNTHETIC stand-in' : 'real'} reader read the SYNTHETIC photo of "${want}" as ${JSON.stringify(lines)}`);
  const answer = page.locator('[data-final-answer]').first();
  const proposed = await answer.inputValue().catch(() => null);
  s.notes.push(`the answer field proposed "${proposed}" from the reading`);
  if (proposed !== want) await answer.fill(want);
  await page.waitForTimeout(500);
  h.check(s, `the student confirms the answer "${want}" in the answer field before Submit`, (await answer.inputValue().catch(() => null)) === want);
  await h.shot(s, page, 'photo-read-confirmed');
  const g = await gradeOf(page, () => pressSubmit(page));
  await page.locator('.eval-card, .verdict[data-verdict-of]').first().waitFor({ timeout: 30000 }).catch(() => {});
  await h.shot(s, page, 'photo-marked');
  h.check(s, 'Submit sends the confirmed answer in Photo mode and the server marks it (authoritative), with the reading\'s receipt',
    g?.status === 200 && g.json?.authoritative === true && (g.body ? g.body.mode === 'photo' && String(g.body.answer).trim() === want : true) && typeof g.json?.reading?.receipt === 'string',
    JSON.stringify({ status: g?.status, mode: g?.body?.mode, sent: g?.body?.answer, reading: g?.json?.reading }));
  h.check(s, 'Submit buys no second read (the reading the student was shown is reused)', g?.json?.reading?.reused !== false, JSON.stringify(g?.json?.reading));
  if (target) h.check(s, 'a photographed answer of the engine\'s own key is marked correct, full marks', g?.json?.correct === true && g.json.marksEarned === g.json.marksPossible, JSON.stringify([g?.json?.marksEarned, g?.json?.marksPossible]));
  if (g?.json?.resolved) h.marked({ context: A.label, questionId: g.json.questionId, attemptId: g.json.attemptId, correct: g.json.correct === true, prompt: h.run.key?.prompt || '', mode: 'photo' });
  return h.finish(s, s.checks.every(c => c.ok) ? 'SYNTHETIC-PASS' : 'FAIL');
}

// ── step 9 · offline mid-answer ──────────────────────────────────────────────

export async function stepOffline(h, A, account) {
  const s = h.begin('9', 'Offline mid-answer: nothing marked offline, the student told so, the draft kept; reconnected, marked exactly once');
  const { page, ctx } = A;
  const target = h.run.key?.key || null;
  const opened = target ? (await repeatFromHistory(h, page, h.run.key.prompt)).ok : await openPractice(h, page, `subtopic=${TYPED_TOPIC}`);
  const box = opened ? await typedBox(page) : null;
  if (!h.check(s, 'a server-issued question with a box to type in', !!box)) return h.finish(s, 'FAIL');
  const answer = target ?? SURELY_WRONG[0];
  await box.fill(answer);
  await page.waitForTimeout(1500);
  // Every /v1/practice exchange from here on is this question's.
  const startIdx = h.exchanges().length;
  const submits = () => h.exchanges().slice(startIdx).filter(e => SUBMIT.test(e.path));
  const before = 0;
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline'))).catch(() => {});
  try {
    await pressSubmit(page);
    await page.locator('[data-check-refusal]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const said = flat(await page.locator('.verdict').first().innerText().catch(() => ''));
    await h.shot(s, page, 'offline-submit');
    const refusal = await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal').catch(() => null);
    h.check(s, 'offline, nothing is marked: no result card, no marks, and no Submit reached the server', await page.locator('.eval-card, .eval-marks').count() === 0 && submits().length === before,
      `${submits().length - before} answered submit(s)`);
    h.check(s, 'the student is told it has not been checked and why (no connection), with a way to try again', refusal === 'reconnect' && /not been checked/i.test(said) && /reach|connect|offline/i.test(said),
      `${refusal}: "${said.slice(0, 200)}"`);
    s.notes.push(`offline, the card says: "${said.slice(0, 240)}"`);
    h.check(s, 'the draft is kept: the typed answer is still in the box', await page.locator('.editor-body input.answer-input').first().inputValue().catch(() => null) === answer);
  } finally {
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {});
  }
  await page.waitForTimeout(1000);
  const retry = page.locator('.verdict [data-check-retry], [data-check-retry]').first();
  const g = await gradeOf(page, async () => { if (await retry.count()) await retry.click(); else await pressSubmit(page); });
  await page.locator('.eval-card, .verdict[data-verdict-of]').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);   // anything still queued from the offline press would land now
  await h.shot(s, page, 'reconnected-marked');
  const answered = submits().filter(e => e.status === 200 && e.path === g?.path);
  h.check(s, 'back online, Try again is marked by the server — the same answer', g?.status === 200 && g.json?.authoritative === true && (g.body ? String(g.body.answer) === answer : true),
    JSON.stringify({ status: g?.status, correct: g?.json?.correct, sent: g?.body?.answer }));
  h.check(s, 'marked exactly once: one answered Submit, one submission key', answered.length === 1 && new Set(answered.map(e => e.request?.submissionId)).size === 1,
    `${answered.length} answered submit(s)`);
  if (target) h.check(s, 'the key typed before going offline is marked correct, full marks', g?.json?.correct === true && g.json.marksEarned === g.json.marksPossible);
  if (g?.json?.resolved) h.marked({ context: A.label, questionId: g.json.questionId, attemptId: g.json.attemptId, correct: g.json.correct === true, prompt: h.run.key?.prompt || '', mode: 'typed' });
  return h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL');
}

// ── steps 4 and 8 · a second browser, the same account, the same History ────

export async function stepSecondBrowser(h, A, account) {
  const s = h.begin('4', 'Account-bound sync and recovery: a second browser (Chromium) signs in to the same account and holds the same marked History');
  const B = await codeSignIn(h, h.SIZES[1], 'tablet-B', account.email, { s });
  h.check(s, 'a second browser, in the other engine (Chromium tablet), signs in to the same account by email code', B.signedIn && B.id === account.id, B.why || `${B.id === account.id}`);
  if (!B.signedIn) { await B.ctx.close().catch(() => {}); return { s: h.finish(s, 'FAIL'), B: null }; }
  const marked = h.run.marked.length;
  // What the account sync restored into the second device's own store (a readback, not a UI claim).
  let restored = 0;
  for (let i = 0; i < 40 && restored < marked; i++) { restored = await restoredAttempts(B.page); if (restored < marked) await B.page.waitForTimeout(500); }
  h.check(s, `account sync restores the ${marked} server-marked attempts into the second device (IndexedDB readback: ${restored})`, restored >= marked, `${restored} restored attempt row(s)`);
  const rowsA = await historyRows(h, A.page);
  const rowsB = await historyRows(h, B.page);
  await h.shot(s, B.page, 'second-browser-history');
  h.check(s, `the first browser's History lists every attempt the server marked (${marked})`, rowsA.length === marked, JSON.stringify(verdictCounts(rowsA)));
  const same = h.check(s, 'the second browser\'s History, from the account alone, holds the same attempts with the same verdicts', rowsB.length === rowsA.length && sameRows(rowsA, rowsB),
    `A ${JSON.stringify(verdictCounts(rowsA))} · B ${JSON.stringify(verdictCounts(rowsB))}`);
  if (!same && restored >= marked && rowsB.length === 0) {
    s.defects.push({ what: `a second device signed in to the same account restores the ${marked} server-marked attempts (its progress) but its History is empty ("Nothing here yet"): History lists only the device's own question rows, and the sync restore writes attempts, ratings, reviews and activity but no question row (the server's graded-attempt event carries no prompt)`,
      where: 'client/src/local/backend.js POST /history/list (reads the questions store) · client/src/platform/cloudSyncRestore.js applyPracticeEvent (writes no question row)',
      repro: 'mark questions on one device; sign in to the same account on another browser; open History (Review)', lane: 'L2 (sync/restore) with L3 (History)' });
  }
  h.run.historyRows = { A: rowsA, B: rowsB };
  return { s: h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL'), B };
}

export async function stepHistory(h, A, B) {
  const s = h.begin('8', 'History and persistence: after a reload, both browsers still show every marked attempt');
  if (!B) { s.blocked.push('the second browser did not sign in (step 4)'); return h.finish(s, 'BLOCKED'); }
  const rowsA = await historyRows(h, A.page, { reload: true });
  const rowsB = await historyRows(h, B.page, { reload: true });
  await h.shot(s, A.page, 'history-after-reload-A');
  await h.shot(s, B.page, 'history-after-reload-B');
  const marked = h.run.marked.length;
  h.check(s, `after a reload, the first browser (WebKit) still lists all ${marked} marked attempts`, rowsA.length === marked, JSON.stringify(verdictCounts(rowsA)));
  h.check(s, 'after a reload, the second browser (Chromium) lists the same attempts with the same verdicts', sameRows(rowsA, rowsB), `A ${JSON.stringify(verdictCounts(rowsA))} · B ${JSON.stringify(verdictCounts(rowsB))}`);
  const right = h.run.marked.filter(m => m.correct).length;
  h.check(s, `the verdicts are the server's: ${right} correct, ${marked - right} incorrect`, (verdictCounts(rowsA).Correct || 0) === right, JSON.stringify(verdictCounts(rowsA)));
  return h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL');
}

// ── step 3, continued · the guardian withdraws; the child is refused ────────

export async function guardianWithdraw(h, s, { K, parentAddress, requestedAt, approvedAt }) {
  // After approving by code, is the parent sent a withdrawal link to keep?
  const keep = await h.links.waitForLink(parentAddress, 'guardian-withdraw', approvedAt, h.local ? 3000 : 45000).catch(err => ({ link: null, error: String(err?.message || err).slice(0, 120) }));
  const kept = h.check(s, 'after approving by code, the parent is sent a withdrawal link they can keep ("withdraw at any time … from the link in our email")', !!keep.link, keep.error || (keep.link ? '' : 'no "keep this email" message reached the parent'));
  if (!kept) {
    s.defects.push({ what: 'a parent who approves by the emailed CODE is never sent the long-lived withdrawal link; their only withdrawal bearer is the 1-hour consent link, which housekeeping deletes once it expires, and the in-app withdrawal is by SMS, which is off (D3) — so after about an hour an email parent cannot withdraw, contrary to the notice ("You can withdraw at any time … from the link in our email")',
      where: 'server/platform/otp.js POST /otp/guardian/approve (confirmConsent with no guardian-withdraw token; compare accounts.js POST /guardian/confirm, which queues one) · housekeeping.js deletes expired guardian-consent tokens',
      repro: 'a 13-year-old signs up by email code, names a parent email; the parent approves on /guardian/consent with the code; no "keep this email" withdrawal mail is queued', lane: 'L2 (account/consent)' });
  }
  const source = keep.link ? keep : await h.links.waitForLink(parentAddress, 'guardian-consent', requestedAt, h.local ? 3000 : 120000).catch(() => ({ link: null }));
  if (!h.check(s, 'the parent has a link that withdraws consent (the kept link, else the consent link from the request)', !!source.link)) return false;
  const G = await h.newContext(h.SIZES[0], 'phone-parent-withdraw');
  await G.page.goto(source.link, { waitUntil: 'domcontentloaded' });
  const kind = keep.link ? 'guardian-withdraw' : 'guardian-consent';
  const button = kind === 'guardian-withdraw' ? G.page.locator('[data-guardian-withdraw]') : G.page.getByRole('button', { name: /No, keep it on their device/i });
  const offered = await button.first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  await h.shot(s, G.page, 'parent-withdraw-page');
  if (offered) await button.first().click();
  const done = await G.page.locator('[role="status"]').filter({ hasText: /Nothing syncs|withdrawn|Nothing of theirs/i }).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
  await h.shot(s, G.page, 'parent-withdrew');
  h.check(s, `the parent withdraws on their own device from the ${kind === 'guardian-withdraw' ? 'kept withdrawal' : 'consent'} link, and is told it is done`, offered && done,
    flat(await G.page.locator('main').innerText().catch(() => '')).slice(0, 200));
  await G.ctx.close();
  const state = await h.api(K.page, 'GET', '/v1/account/guardian/state');
  h.check(s, 'the server records the consent as withdrawn', state.data?.state === 'withdrawn' && state.data?.blockerCode === 'GUARDIAN_CONSENT_WITHDRAWN', JSON.stringify(h.redact(state.data)));
  const issue = await h.api(K.page, 'POST', '/v1/practice/issue', { generator: 'c8-rational-numbers', difficulty: 1, curriculum: 'in' });
  h.check(s, 'the child\'s next practice question is refused (403 GUARDIAN_CONSENT_WITHDRAWN)', issue.status === 403 && issue.data?.error?.code === 'GUARDIAN_CONSENT_WITHDRAWN', `${issue.status} ${issue.data?.error?.code}`);
  await K.page.goto(`${h.origin}/practice`, { waitUntil: 'domcontentloaded' });
  await K.page.waitForTimeout(6000);
  const text = flat(await K.page.locator('body').innerText().catch(() => '')).slice(0, 400);
  await h.shot(s, K.page, 'child-after-withdrawal');
  const prompt = await K.page.locator('.qpage[data-question-id] .q-prompt').count();
  h.check(s, 'the child opening Practice gets no question and is told a parent withdrew permission', prompt === 0 && /withdr|parent|guardian/i.test(text), text.slice(0, 240));
  return true;
}

// ── 12 · full only: another account cannot reach this account's question ───

export async function stepIsolation(h, other, owner, s) {
  const target = h.run.marked.find(m => m.questionId)?.questionId;
  if (!target || !other?.signedIn) { s.blocked.push(!target ? 'account A has no server question id (steps 5–9)' : 'account B did not sign in'); return h.finish(s, 'BLOCKED'); }
  h.check(s, 'account B is a different verified account', other.id && other.id !== owner.id);
  const probes = [
    ['submit', `/v1/practice/${target}/submit`, { submissionId: randomUUID(), answer: '1', mode: 'typed' }],
    ['repeat', `/v1/practice/${target}/repeat`, {}],
    ['reveal', `/v1/practice/${target}/reveal`, {}],
    ['hint', `/v1/practice/${target}/hint`, { rung: 'nudge' }]
  ];
  for (const [name, path, body] of probes) {
    const r = await h.api(other.page, 'POST', path, body);
    h.check(s, `B ${name} on A's question → 404 QUESTION_NOT_FOUND (indistinguishable from an id that never existed)`, r.status === 404 && r.data?.error?.code === 'QUESTION_NOT_FOUND', `${r.status} ${r.data?.error?.code}`);
  }
  return h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL');
}

// ── 13 · full only: the free plan's daily cap is the server's ───────────────

export async function stepFreeCap(h, other) {
  const s = h.begin('13', 'Free practice cap (full): the server refuses the question past the free day, and Practice says so');
  if (!other?.signedIn) { s.blocked.push('account B did not sign in'); return h.finish(s, 'BLOCKED'); }
  const issued = h.exchanges().filter(e => e.context === other.label && e.path === '/v1/practice/issue' && e.status === 201 && e.request?.generator);
  const generator = issued.at(-1)?.request?.generator || 'c10-ap-sum-reasoning';
  let refusal = null; let n = 0;
  for (; n < 30 && !refusal; n++) {
    const r = await h.api(other.page, 'POST', '/v1/practice/issue', { generator, difficulty: 2, curriculum: 'in', mode: 'practice', account: other.id });
    if (r.status === 402) refusal = r;
    else if (r.status !== 201) { s.notes.push(`issue ${n + 1} answered ${r.status} ${r.data?.error?.code || ''}`); break; }
  }
  const e = refusal?.data?.error || {};
  h.check(s, `the server refuses past the free day with its own code, count and reset (after ${n} issue(s) here)`, e.code === 'FREE_CAP_REACHED' && e.used === e.limit && Number(e.resetAt) > Date.now(),
    JSON.stringify({ code: e.code, used: e.used, limit: e.limit, timeZone: e.timeZone }));
  s.notes.push(`the free day is ${e.limit} questions (D19 says 20), reset in ${e.timeZone || '?'}`);
  await other.page.goto(`${h.origin}/practice`, { waitUntil: 'domcontentloaded' });
  const notice = other.page.locator('.card[role="status"]').filter({ hasText: /free questions/i });
  // A question already issued today (the one the app opened on) is resumed, as
  // it should be: it was counted when it was issued. Next asks for one more.
  const resumed = await Promise.race([
    other.page.locator('.qpage[data-question-id] .q-prompt').first().waitFor({ timeout: 30000 }).then(() => true, () => false),
    notice.first().waitFor({ timeout: 30000 }).then(() => false, () => false)
  ]);
  if (resumed) {
    s.notes.push('Practice first resumed the question already issued today (counted when issued); Next asks for the next one');
    await other.page.locator('.ctx-next').first().click();
  }
  const shown = await notice.first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  const text = flat(await notice.first().innerText().catch(() => ''));
  await h.shot(s, other.page, 'free-cap');
  h.check(s, 'Practice shows the cap screen — what ran out and when it comes back — with no question on it', shown && /midnight/i.test(text) && await other.page.locator('.q-prompt').count() === 0, text.slice(0, 200));
  return h.finish(s, s.checks.every(c => c.ok) ? 'PASS' : 'FAIL');
}
