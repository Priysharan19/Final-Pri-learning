// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the product says only what the shipped handwriting path does
//
// Every student surface reads handwriting through the server reader
// (ink/InkAnswer.jsx → ink/cloudReader.js); nothing a student can reach calls
// the retired on-device recogniser. Two pieces of copy outlived that change:
//
//   · Settings offered "Teach it your handwriting (2 min)", a calibration flow
//     that saved personal templates only the retired recogniser read, and
//     then told the student "That's your hand learned" and that the templates
//     "now outrank the built-in shapes". Nothing in the reading path they
//     actually use had changed. That is a false statement to a student.
//   · The privacy notice listed "the model that adapts to your hand" among
//     what stays on the device, and the welcome screen promised "an engine
//     that learns exactly how you write".
//
// This suite pins their removal, in both languages and in the legal text, so
// the claim cannot drift back in with a later copy edit. It reads source: the
// strings catalogues, the Settings page, the welcome copy and the notices.
//
// Usage: node client/test/handwriting-claims-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const flat = catalogue => Object.entries(catalogue).flatMap(([key, value]) =>
  (typeof value === 'string' ? [[key, value]] : Object.values(value || {}).map(v => [key, String(v)])));

// ── 1 · The calibration feature is gone, not hidden ─────────────────────────
ok(!existsSync(join(ROOT, 'client/src/ink/Calibrate.jsx')), 'the calibration component no longer exists');
ok(!existsSync(join(ROOT, 'client/test/cal-smoke.mjs')), 'and neither does the browser flow that exercised it');
const settings = read('client/src/pages/SettingsLegacy.jsx');
ok(!/Calibrate/.test(settings), 'Settings does not import or render a calibration flow');
ok(!/teachHandwriting|templatesLearned|resetHandwriting|personalStats|clearPersonal/.test(settings),
  'Settings offers no teach, template count or reset-learned-handwriting control');
ok(/HandwritingSection/.test(settings) && /settings\.handwriting(Native|Browser)/.test(settings) && /cloudHandwriting/.test(settings),
  'the Handwriting section itself remains: how ink is captured, and the server-reading consent');

// ── 2 · No catalogue string says the engine learns the student's hand ───────
for (const [lang, catalogue] of [['English', en], ['Hindi', hi]]) {
  const keys = Object.keys(catalogue);
  ok(!keys.some(k => k.startsWith('calibrate.')), `${lang}: no calibrate.* string remains`);
  ok(!keys.some(k => ['settings.teachHandwriting', 'settings.templatesLearned', 'settings.templatesNone', 'settings.templatesCount', 'settings.resetHandwriting', 'settings.handwritingCleared'].includes(k)),
    `${lang}: no learned-template Settings string remains`);
}
// The claims, as they were written, in either language. A string that says the
// server READS the student's writing is fine; one that says Pri LEARNS or
// ADAPTS to their hand, or ranks their samples above built-in shapes, is not.
const CLAIM_EN = /learns? (exactly )?how you write|your hand learned|outrank the built-in|adapts? to your hand|teach it your handwriting|learned handwriting|personal templates?/i;
const CLAIM_HI = /सीखता है कि आप|लिखावट सीख|अपनी हैंडराइटिंग सिखा|लिखावट के अनुसार ढल|सीखी हुई हैंडराइटिंग|निजी नमून/;
for (const [key, text] of flat(en)) ok(!CLAIM_EN.test(text), `EN ${key} does not claim the engine learns the student's hand: ${JSON.stringify(text)}`);
for (const [key, text] of flat(hi)) ok(!CLAIM_HI.test(text), `HI ${key} does not claim the engine learns the student's hand: ${JSON.stringify(text)}`);

// ── 3 · The welcome and the notices match ───────────────────────────────────
ok(/deterministic engine/.test(en['login.point3']) && !/learns/.test(en['login.point3']), 'the welcome\'s third point states the deterministic engine, not a learning one');
ok(/नियम-आधारित इंजन/.test(hi['login.point3']) && !/सीखता/.test(hi['login.point3']), 'and so does its Hindi');
const privacy = read('docs/legal/privacy.md').replace(/\s+/g, ' ');
const privacyHi = read('docs/legal/privacy.hi.md').replace(/\s+/g, ' ');
ok(/- Your handwriting strokes\./.test(privacy) && !/adapts to your hand/.test(privacy),
  'the privacy notice lists handwriting strokes on the device, with no adapting model');
ok(/- आपकी हैंडराइटिंग के स्ट्रोक।/.test(privacyHi) && !/लिखावट के अनुसार ढलता/.test(privacyHi),
  'and the Hindi notice says the same');
ok(!/calibration\)/.test(read('docs/i18n.md')), 'docs/i18n.md no longer names a calibration surface');

// ── 3b · No resident handwriting model, no iPad-only wording on every platform ─
// The crash screen once said "your handwriting model" lives in this iPad's
// database: there is no such model (handwriting is read on Pri's server) and
// the same screen ships on web, iPhone and Android. Marks are checked and kept
// by the server, not only on the device.
const MODEL_EN = /handwriting model/i;
const MODEL_HI = /हैंडराइटिंग मॉडल|लिखावट का मॉडल/;
for (const [key, text] of flat(en)) ok(!MODEL_EN.test(text), `EN ${key} does not mention a handwriting model: ${JSON.stringify(text)}`);
for (const [key, text] of flat(hi)) ok(!MODEL_HI.test(text), `HI ${key} does not mention a handwriting model: ${JSON.stringify(text)}`);
// Every student surface ships on all four device classes; "iPad" is allowed
// only in the staff classroom strings (teach.*), which are off in V1.
for (const [lang, catalogue] of [['EN', en], ['HI', hi]]) {
  for (const [key, text] of flat(catalogue)) {
    if (key.startsWith('teach.')) continue;
    ok(!/\biPad\b(?! (?:and|और) )/.test(text) || /iPhone (?:and|और) iPad/.test(text), `${lang} ${key} does not speak to an iPad on every platform: ${JSON.stringify(text)}`);
  }
}
ok(/server/i.test(en['errorScreen.savedWorkSafe']) && /सर्वर/.test(hi['errorScreen.savedWorkSafe']),
  'the crash screen says checked answers are kept on Pri\'s server, in both languages');

// ── 4 · The suite can fail ──────────────────────────────────────────────────
ok(MODEL_EN.test("bookmarks and your handwriting model all live in this device's database") && MODEL_HI.test('और आपका हैंडराइटिंग मॉडल — सब इस डिवाइस के डेटाबेस में'),
  'the model pattern catches the removed crash-screen sentence in both languages');
ok(CLAIM_EN.test("That's your hand learned.") && CLAIM_EN.test('An engine that learns exactly how you write') && CLAIM_EN.test('the model that adapts to your hand'),
  'the English claim pattern catches the three sentences this removes');
ok(CLAIM_HI.test('एक इंजन जो सीखता है कि आप ठीक कैसे लिखते हैं') && CLAIM_HI.test('Pri ने आपकी लिखावट सीख ली।') && CLAIM_HI.test('वह मॉडल जो आपकी अपनी लिखावट के अनुसार ढलता है'),
  'and the Hindi pattern catches theirs');

if (failures.length) {
  console.log(`HANDWRITING CLAIMS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`HANDWRITING CLAIMS: PASS — ${pass}/${pass} checks — no student-facing text says Pri learns or adapts to a hand; the calibration feature is gone from Settings, the catalogues and the privacy notice.`);
