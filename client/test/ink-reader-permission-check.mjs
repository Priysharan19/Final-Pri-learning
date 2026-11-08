// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · D17: permission before anything is read
//
// Owner default D17 (docs/release/V1_DECISIONS_2026-11-01.md): a one-time
// prompt naming OpenAI appears before the first handwriting read or photo.
// Nothing leaves the device until the student accepts, and declining keeps
// them on typed answers.
//
// This suite holds that in the code, deterministically and with no network:
//
//   1. The record: per profile, per wording version, fails closed.
//   2. The ask: only a press of "accept" is acceptance; no prompt to ask with,
//      a decline, a dismissal or a throwing prompt is not. One prompt at a time.
//   3. The three senders — readWithCloud (ink), readPhotoWithCloud (a photo of
//      working) and identifyQuestionPhoto (a photo of a question) — touch
//      nothing (no rasteriser, no status probe, no transport) until accepted.
//   4. What the student is told after declining or closing the prompt.
//   5. The prompt names OpenAI in every language, is mounted in the app shell,
//      is a labelled modal dialog, and is asked before "Reading…" is shown.
//
// Synthetic evidence only: fake transports, no browser, no provider.
// The browser flow (phone and tablet, finger, decline then type, accept then
// transcript, confirm and grade) is client/test/tour-reader-permission.js.
//
// Usage: node client/test/ink-reader-permission-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  READER_PERMISSION, READER_PERMISSION_STORAGE_KEY, READER_PERMISSION_VERSION, PROMPT_ANSWER, READ_KINDS,
  askReaderPermission, forgetReaderPermission, notPermittedOutcome, readerPermission, readerPermissionPending,
  recordReaderPermission, setReaderPermissionPrompt
} from '../src/ink/readerPermission.js';
import { readerBlock, readPhotoWithCloud, readWithCloud } from '../src/ink/cloudReader.js';
import { identifyQuestionPhoto, PHOTO_STATES } from '../src/lib/questionPhoto.js';
import { modalCoversInk, OFFSCREEN_CLIP } from '../src/ink/native.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    raw: map
  };
}
const throwingStorage = {
  getItem: () => { throw new Error('SecurityError: storage is disabled'); },
  setItem: () => { throw new Error('SecurityError: storage is disabled'); }
};

// ── 1 · The record ───────────────────────────────────────────────────────────
{
  const store = memoryStorage();
  const asha = { id: 'asha-1' };
  const ravi = { id: 'ravi-2' };
  ok(Number.isInteger(READER_PERMISSION_VERSION) && READER_PERMISSION_VERSION >= 1, 'the wording has a whole-number version');
  eq(readerPermission(asha, { storage: store }), READER_PERMISSION.UNASKED, 'a profile that was never asked has not accepted');
  recordReaderPermission(asha, READER_PERMISSION.ACCEPTED, { storage: store, now: Date.parse('2026-11-08T10:00:00Z') });
  eq(readerPermission(asha, { storage: store }), READER_PERMISSION.ACCEPTED, 'an accept is kept');
  eq(readerPermission(ravi, { storage: store }), READER_PERMISSION.UNASKED, 'one profile accepting is not another profile accepting (a shared family tablet)');
  const stored = JSON.parse(store.getItem(READER_PERMISSION_STORAGE_KEY));
  eq(stored['p:asha-1'], { choice: 'accepted', version: READER_PERMISSION_VERSION, at: '2026-11-08T10:00:00.000Z' }, 'the record says what was chosen, for which wording and when');

  // An answer to older wording is no answer to this one.
  const older = memoryStorage();
  older.setItem(READER_PERMISSION_STORAGE_KEY, JSON.stringify({ 'p:old-3': { choice: 'accepted', version: READER_PERMISSION_VERSION - 1, at: '2026-11-01T00:00:00Z' } }));
  eq(readerPermission({ id: 'old-3' }, { storage: older }), READER_PERMISSION.UNASKED, 'an accept of an earlier wording version is not an accept of this one: the student is asked again');
  const odd = memoryStorage();
  odd.setItem(READER_PERMISSION_STORAGE_KEY, JSON.stringify({ 'p:odd-4': { choice: 'yes please', version: READER_PERMISSION_VERSION } }));
  eq(readerPermission({ id: 'odd-4' }, { storage: odd }), READER_PERMISSION.UNASKED, 'a record that is neither accepted nor declined is not acceptance');
  const garbage = memoryStorage();
  garbage.setItem(READER_PERMISSION_STORAGE_KEY, '{not json');
  eq(readerPermission({ id: 'g-5' }, { storage: garbage }), READER_PERMISSION.UNASKED, 'unreadable storage is not acceptance');
  const listy = memoryStorage();
  listy.setItem(READER_PERMISSION_STORAGE_KEY, JSON.stringify([{ choice: 'accepted' }]));
  eq(readerPermission({ id: 'l-6' }, { storage: listy }), READER_PERMISSION.UNASKED, 'a record of the wrong shape is not acceptance');

  // Storage that throws (a private window): this session's answer, nothing more.
  eq(readerPermission({ id: 'priv-7' }, { storage: throwingStorage }), READER_PERMISSION.UNASKED, 'storage that throws reads as never asked');
  recordReaderPermission({ id: 'priv-7' }, READER_PERMISSION.ACCEPTED, { storage: throwingStorage });
  eq(readerPermission({ id: 'priv-7' }, { storage: throwingStorage }), READER_PERMISSION.ACCEPTED, 'and an accept pressed in that session still holds for the session');

  recordReaderPermission(ravi, READER_PERMISSION.DECLINED, { storage: store });
  eq(readerPermission(ravi, { storage: store }), READER_PERMISSION.DECLINED, 'a decline is kept');
  forgetReaderPermission(asha, { storage: store });
  eq(readerPermission(asha, { storage: store }), READER_PERMISSION.UNASKED, 'a forgotten profile is asked again');
  let threw = false;
  try { recordReaderPermission(asha, 'maybe', { storage: store }); } catch { threw = true; }
  ok(threw, 'only accepted or declined can be recorded');
}

// ── 2 · The ask ─────────────────────────────────────────────────────────────
{
  const store = memoryStorage();
  const user = { id: 'ask-1' };
  setReaderPermissionPrompt(null);
  eq(await askReaderPermission(user, { storage: store }), PROMPT_ANSWER.UNAVAILABLE, 'with no prompt on screen to ask with, the answer is "unavailable" — never consent');
  eq(readerPermission(user, { storage: store }), READER_PERMISSION.UNASKED, 'and nothing is recorded');

  let shown = 0;
  let kinds = [];
  const answering = value => async ({ kind }) => { shown += 1; kinds.push(kind); return value; };
  eq(await askReaderPermission(user, { storage: store, ask: answering(PROMPT_ANSWER.DISMISSED), kind: 'photo' }), PROMPT_ANSWER.DISMISSED, 'closing the prompt answers "dismissed"');
  eq(readerPermission(user, { storage: store }), READER_PERMISSION.UNASKED, 'and records nothing: the next read asks again');
  eq(await askReaderPermission(user, { storage: store, ask: async () => { throw new Error('the sheet failed to render'); } }), PROMPT_ANSWER.DISMISSED, 'a prompt that throws is a dismissal, not consent');
  eq(await askReaderPermission(user, { storage: store, ask: async () => 'sure' }), PROMPT_ANSWER.DISMISSED, 'an answer that is not one of the three is a dismissal');
  eq(await askReaderPermission(user, { storage: store, ask: answering(PROMPT_ANSWER.DECLINED) }), PROMPT_ANSWER.DECLINED, 'a decline answers "declined"');
  eq(readerPermission(user, { storage: store }), READER_PERMISSION.DECLINED, 'and is recorded');
  shown = 0;
  eq(await askReaderPermission(user, { storage: store, ask: answering(PROMPT_ANSWER.ACCEPTED), kind: 'nonsense' }), PROMPT_ANSWER.ACCEPTED,
    'a student who declined is asked again on the next read they ask for (after turning reading back on), and may accept');
  eq(shown, 1, 'that took one prompt');
  eq(kinds.at(-1), 'ink', 'an unknown kind is asked about as handwriting');
  eq(READ_KINDS, ['ink', 'photo', 'question-photo'], 'three kinds of read are asked about');
  shown = 0;
  eq(await askReaderPermission(user, { storage: store, ask: answering(PROMPT_ANSWER.DECLINED) }), PROMPT_ANSWER.ACCEPTED, 'once accepted, the read goes ahead without asking');
  eq(shown, 0, 'and no prompt is shown again — it is one-time');

  // One prompt at a time.
  const other = { id: 'ask-2' };
  let release;
  let opened = 0;
  setReaderPermissionPrompt(() => { opened += 1; return new Promise(r => { release = r; }); });
  const first = askReaderPermission(other, { storage: store, kind: 'photo' });
  await Promise.resolve();
  ok(readerPermissionPending(), 'while the prompt is open it is known to be open');
  const second = askReaderPermission(other, { storage: store, kind: 'photo' });
  release(PROMPT_ANSWER.ACCEPTED);
  eq([await first, await second], [PROMPT_ANSWER.ACCEPTED, PROMPT_ANSWER.ACCEPTED], 'a second ask while the prompt is open waits for the same answer');
  eq(opened, 1, 'and never stacks a second sheet (a multi-page PDF asks once)');
  ok(!readerPermissionPending(), 'the prompt is closed after the answer');
  const stop = setReaderPermissionPrompt(async () => PROMPT_ANSWER.ACCEPTED);
  const stopStale = setReaderPermissionPrompt(async () => PROMPT_ANSWER.ACCEPTED);
  stop();
  eq(await askReaderPermission({ id: 'ask-3' }, { storage: store }), PROMPT_ANSWER.ACCEPTED, 'unregistering a prompt that was already replaced leaves the current one');
  stopStale();
  eq(await askReaderPermission({ id: 'ask-4' }, { storage: store }), PROMPT_ANSWER.UNAVAILABLE, 'unregistering the current prompt leaves none: nobody can be asked');
  eq(notPermittedOutcome(PROMPT_ANSWER.DECLINED), { reason: 'declined', permission: 'declined' }, 'a declined read reports "declined"');
  eq(notPermittedOutcome(PROMPT_ANSWER.UNAVAILABLE), { reason: 'not-permitted', permission: 'unavailable' }, 'any other unanswered read reports "not-permitted"');
}

// ── 3 · Nothing leaves before acceptance ────────────────────────────────────
const there = () => true;
const STROKES = [{ points: [{ x: 10, y: 10, t: 0 }, { x: 40, y: 40, t: 16 }] }];
const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';
function senders() {
  const touched = { raster: 0, readiness: 0, transcribe: 0, prepare: 0, identify: 0 };
  return {
    touched,
    rasterize: () => { touched.raster += 1; return { dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, bytes: 3 }; },
    prepare: async () => { touched.prepare += 1; return { dataUrl: 'data:image/jpeg;base64,BBBB', width: 10, height: 10, bytes: 3, quality: 0.8 }; },
    readiness: async () => { touched.readiness += 1; return { usable: true, state: 'ready', confidenceFloor: 0.8 }; },
    transport: {
      transcribeHandwriting: async () => { touched.transcribe += 1; return { transcription: { lines: [{ text: 'x=2', confidence: 0.97 }], text: 'x=2', confidence: 0.97, engine: 'cloud:test' } }; },
      identifyQuestionPhoto: async () => { touched.identify += 1; return { identification: { isMathsQuestion: true, readable: true, questionText: 'Solve 2x = 4.', candidates: [] } }; }
    }
  };
}
const nothingTouched = t => Object.values(t).every(n => n === 0);
for (const answer of [PROMPT_ANSWER.DECLINED, PROMPT_ANSWER.DISMISSED, PROMPT_ANSWER.UNAVAILABLE]) {
  const s = senders();
  const user = { id: `no-${answer}`, cloudHandwriting: true, cloudLinked: true };
  const permission = async () => answer;
  const ink = await readWithCloud(STROKES, { user, available: there, rasterize: s.rasterize, readiness: s.readiness, transport: s.transport, permission });
  const photo = await readPhotoWithCloud(PHOTO, { user, available: there, prepare: s.prepare, readiness: s.readiness, transport: s.transport, permission });
  const question = await identifyQuestionPhoto(PHOTO, { user, online: there, available: there, prepare: s.prepare, transport: s.transport, permission });
  ok(nothingTouched(s.touched), `${answer}: nothing is drawn, probed or sent — ${JSON.stringify(s.touched)}`);
  const reason = answer === PROMPT_ANSWER.DECLINED ? 'declined' : 'not-permitted';
  eq([ink.reason, photo.reason, question.state], [reason, reason, reason], `${answer}: ink, a photo of working and a photo of a question each report "${reason}"`);
  ok(PHOTO_STATES.includes(question.state) && question.candidates.length === 0, `${answer}: a question photo that was not sent proposes nothing`);
}
{
  const s = senders();
  const asked = [];
  const user = { id: 'yes-1', cloudHandwriting: true, cloudLinked: true };
  const permission = async (who, { kind }) => { asked.push([who.id, kind]); return PROMPT_ANSWER.ACCEPTED; };
  const ink = await readWithCloud(STROKES, { user, available: there, rasterize: s.rasterize, readiness: s.readiness, transport: s.transport, permission });
  const photo = await readPhotoWithCloud(PHOTO, { user, available: there, prepare: s.prepare, readiness: s.readiness, transport: s.transport, permission });
  const question = await identifyQuestionPhoto(PHOTO, { user, online: there, available: there, prepare: s.prepare, transport: s.transport, permission });
  eq(s.touched, { raster: 1, readiness: 2, transcribe: 2, prepare: 2, identify: 1 }, 'accepted: each read is drawn, probed and sent exactly once');
  eq([ink.transcription?.text, photo.transcription?.text, question.state], ['x=2', 'x=2', 'no-match'], 'and each comes back as it would have before D17');
  eq(asked, [['yes-1', 'ink'], ['yes-1', 'photo'], ['yes-1', 'question-photo']], 'each sender asks for the profile reading, naming what it reads');
}
{
  // The order inside a sender: a read that is off never asks; one that is on asks first.
  const s = senders();
  let asked = 0;
  const permission = async () => { asked += 1; return PROMPT_ANSWER.ACCEPTED; };
  const off = await readWithCloud(STROKES, { user: { id: 'off-1', cloudHandwriting: false }, available: there, rasterize: s.rasterize, readiness: s.readiness, transport: s.transport, permission });
  eq([off.reason, asked], ['disabled', 0], 'with reading turned off in Settings, the student is not asked at all');
  const offline = await identifyQuestionPhoto(PHOTO, { user: { id: 'off-2' }, online: () => false, available: there, prepare: s.prepare, transport: s.transport, permission });
  eq([offline.state, asked], ['offline', 0], 'offline, a question photo is not asked about: it could not be sent anyway');
  const src = read('client/src/ink/cloudReader.js');
  for (const fn of ['readWithCloud', 'readPhotoWithCloud']) {
    const body = src.slice(src.indexOf(`export async function ${fn}(`));
    const gate = body.indexOf('await permission(');
    ok(gate > 0 && gate < body.indexOf('await readiness(') && gate < body.indexOf('transcribeOnce('), `${fn} asks before its status probe and before anything is sent`);
  }
  const qp = read('client/src/lib/questionPhoto.js');
  const qbody = qp.slice(qp.indexOf('export async function identifyQuestionPhoto('));
  ok(qbody.indexOf('await permission(') > 0 && qbody.indexOf('await permission(') < qbody.indexOf('prepare(dataUrl)') && qbody.indexOf('await permission(') < qbody.indexOf('transport.identifyQuestionPhoto('),
    'identifyQuestionPhoto asks before the photo is prepared or sent');
  ok(/permission = askReaderPermission/.test(qbody.slice(0, 600)) && (src.match(/permission = askReaderPermission/g) || []).length === 2,
    'every sender defaults to the real prompt; only a test passes its own');
}

// ── 4 · What the student is told ────────────────────────────────────────────
{
  const user = { id: 'told-1', cloudLinked: true };
  const declined = readerBlock(user, { outcome: { reason: 'declined' }, online: there, available: there });
  eq([declined.kind, declined.action, declined.key, declined.inkKey], ['declined', 'settings', 'verdict.photoReadingDeclined', 'ink.waitingDeclined'],
    'after a decline: typing is the way on, and Settings is where reading is turned back on');
  const unasked = readerBlock(user, { outcome: { reason: 'not-permitted' }, online: there, available: there });
  eq([unasked.kind, unasked.key, unasked.inkKey, unasked.manualRetry], ['not-permitted', 'verdict.photoReadingNotPermitted', 'ink.waitingNotPermitted', true],
    'after a closed prompt: nothing was sent, and asking again is one press away');
  const off = readerBlock({ ...user, cloudHandwriting: false }, { outcome: { reason: 'declined' }, online: there, available: there });
  eq(off.kind, 'turned-off', 'once the decline has turned reading off in Settings, every screen says it is turned off');
  for (const key of ['ink.waitingDeclined', 'verdict.photoReadingDeclined', 'snap.declined']) {
    ok(/OpenAI/.test(en[key]) && /Settings → Handwriting/.test(en[key]), `${key} names OpenAI and the way back`);
  }
  for (const key of ['ink.waitingNotPermitted', 'verdict.photoReadingNotPermitted', 'snap.notPermitted']) {
    ok(/needs your permission first/.test(en[key]) && /wasn’t sent/.test(en[key]), `${key} says nothing was sent and permission is needed first`);
  }
  const page = read('client/src/pages/PractisePhoto.jsx');
  for (const state of PHOTO_STATES.filter(s => s !== 'ok')) {
    ok(new RegExp(`['"]?${state}['"]?\\s*:\\s*'snap\\.`).test(page), `the photo-practise page says something of its own for "${state}"`);
  }
}

// ── 5 · The prompt itself ───────────────────────────────────────────────────
{
  const keys = Object.keys(en).filter(k => k.startsWith('readerPermission.'));
  eq(keys.sort(), ['readerPermission.accept', 'readerPermission.choice', 'readerPermission.close', 'readerPermission.decline', 'readerPermission.keep',
    'readerPermission.leadInk', 'readerPermission.leadPhoto', 'readerPermission.leadQuestionPhoto', 'readerPermission.marks', 'readerPermission.title',
    'readerPermission.what'].sort(), 'the prompt is eleven catalogue strings, all in one place');
  for (const k of ['readerPermission.leadInk', 'readerPermission.leadPhoto', 'readerPermission.leadQuestionPhoto']) {
    ok(/\bOpenAI\b/.test(en[k]), `${k} names OpenAI (D17)`);
    ok(/\bOpenAI\b/.test(hi[k] || ''), `${k} names OpenAI in Hindi too`);
  }
  for (const k of [...keys, 'ink.waitingDeclined', 'ink.waitingNotPermitted', 'verdict.photoReadingDeclined', 'verdict.photoReadingNotPermitted', 'snap.declined', 'snap.notPermitted']) {
    ok(typeof hi[k] === 'string' && hi[k].trim() && hi[k] !== en[k], `${k} has a Hindi draft`);
  }
  ok(/Nothing is sent until you choose/.test(en['readerPermission.choice']) && /type every answer/.test(en['readerPermission.choice']), 'the prompt says nothing is sent until the student chooses, and that typing is the alternative');
  ok(/never the AI/.test(en['readerPermission.marks']), 'the prompt says the AI never sets a mark');
  ok(/30 days/.test(en['readerPermission.keep']) && /does not keep the picture/.test(en['readerPermission.keep']), 'the prompt states retention as docs/privacy/data-retention.md §4 does');
  ok(!/never leaves|not stored by OpenAI|accurate|guarantee/i.test(keys.map(k => en[k]).join(' ')), 'the prompt makes no claim the code cannot keep');

  const host = read('client/src/ink/ReaderPermission.jsx');
  ok(/setReaderPermissionPrompt\(/.test(host), 'the sheet registers itself as the prompt');
  ok(/role="dialog"/.test(host) && /aria-modal="true"/.test(host) && /aria-labelledby="reader-permission-title"/.test(host) && /aria-describedby="reader-permission-body"/.test(host),
    'it is a labelled, described modal dialog');
  ok(/className="sheet reader-permission"/.test(host) && /className="sheet-scrim"/.test(host) && /className="sheet-actions"/.test(host),
    'it is the shared sheet: a bottom sheet with full-width buttons on a phone, a dialog on a tablet');
  ok(/data-reader-permission="accept"/.test(host) && /data-reader-permission="decline"/.test(host) && /data-reader-permission="dismiss"/.test(host), 'accept, decline and close are each one control');
  ok(/e\.key === 'Escape'/.test(host) && /e\.key !== 'Tab'/.test(host), 'Escape closes it without choosing, and Tab stays inside it');
  ok(/api\.patch\('\/me', \{ cloudHandwriting: false \}\)/.test(host), 'declining turns server reading off in Settings, so the way back is the Settings switch');
  const app = read('client/src/App.jsx');
  const shell = app.slice(app.lastIndexOf('<AppCtx.Provider value={ctx}>'));
  ok(/import ReaderPermissionHost from '\.\/ink\/ReaderPermission\.jsx';/.test(app) && /<ReaderPermissionHost \/>/.test(shell), 'the app shell mounts the prompt, where every read happens');
  const ink = read('client/src/ink/InkAnswer.jsx');
  const readNow = ink.slice(ink.indexOf('const readNow = useCallback('));
  ok(readNow.indexOf('askReaderPermission(') > 0 && readNow.indexOf('askReaderPermission(') < readNow.indexOf("setStatus({ kind: 'reading' })"),
    'InkAnswer asks before it says "Reading…"');
  ok(readNow.indexOf('const strokes = strokesRef.current;') > readNow.indexOf('askReaderPermission('), 'and reads the page as it stands after the answer, not as it stood when the prompt opened');
}

// ── 6 · The native surface steps out of the prompt's way ────────────────────
// On iPhone and iPad the PencilKit surface is a native view ABOVE the web
// page: a web dialog would sit under the student's ink and, with finger
// drawing on, under their finger. While a modal dialog is open the surface is
// clipped to a 1×1 rect outside the view (an EMPTY clip means "the whole view"
// to InkBridge.placement), and it is laid out again when the prompt opens or
// closes.
{
  const inkOutside = { closest: () => null };
  const inkInside = { closest: sel => (sel === '[aria-modal="true"]' ? {} : null) };
  const withModal = { querySelector: sel => (sel === '[aria-modal="true"]' ? {} : null) };
  const withoutModal = { querySelector: () => null };
  ok(modalCoversInk(inkOutside, withModal) === true, 'a modal dialog open over the writing area covers the native ink');
  ok(modalCoversInk(inkOutside, withoutModal) === false, 'with no modal dialog open the native ink is where the page says');
  ok(modalCoversInk(inkInside, withModal) === false, 'a writing area inside the dialog itself is not covered by it');
  ok(modalCoversInk(inkOutside, null) === false, 'outside a browser nothing is covered');
  ok(OFFSCREEN_CLIP.w > 0 && OFFSCREEN_CLIP.h > 0 && OFFSCREEN_CLIP.x + OFFSCREEN_CLIP.w <= 0 && OFFSCREEN_CLIP.y + OFFSCREEN_CLIP.h <= 0,
    'the clip is not empty (an empty clip is the whole view to the shell) and lies wholly outside the view');
  const bridge = read('ios/PriLearning.swiftpm/Ink/InkBridge.swift');
  ok(/let clipPts = clip\.isEmpty \? viewBounds :/.test(bridge), 'the shell still reads an empty clip as the whole view — which is why the clip is 1×1, not 0×0');
  const nativeSrc = read('client/src/ink/native.js');
  ok(/clip: modalCoversInk\(element\) \? \{ \.\.\.OFFSCREEN_CLIP \}/.test(nativeSrc), 'every mount and layout the page reports uses that clip while a modal is open');
  const canvas = read('client/src/ink/NativeInkCanvas.jsx');
  const host = read('client/src/ink/ReaderPermission.jsx');
  ok(/addEventListener\(MODAL_EVENT, schedule\)/.test(canvas) && /removeEventListener\(MODAL_EVENT, schedule\)/.test(canvas), 'the native canvas lays itself out again when a modal opens or closes');
  ok(/dispatchEvent\(new Event\(MODAL_EVENT\)\)/.test(host) && /\}, \[open\]\);/.test(host), 'the prompt says so each time it opens and closes');
}

if (failures.length) {
  console.error(`READER PERMISSION (D17): FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`READER PERMISSION (D17): PASS — ${pass}/${pass} checks — asked once per profile and wording, nothing drawn, probed or sent before an accept, declining keeps typed answers, OpenAI named in English and Hindi.`);
