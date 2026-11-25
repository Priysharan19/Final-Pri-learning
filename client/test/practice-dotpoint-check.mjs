// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the syllabus dot point picker on the practice page
//
// What it pins, with no browser (the journey is tour-nsw-practice-dotpoint.js):
//   LIST     the control lists exactly the dot points of the topic that an issued
//            question stands behind, in syllabus order, plus "All dot points";
//   URL      choosing one sets `dotpoint=<n>` (clearing removes it) and keeps
//            every other filter; the request the page makes is the one the home
//            links already send (`practiceRequestFromQuery`);
//   NARROWS  the dot point really changes what is issued: 40 questions drawn
//            with the dot point and 40 without, per dot point of every issued
//            topic, compared by which dot point each question belongs to;
//   TRUTH    a label is worn only by a question delivered from that dot point;
//   WIRING   chip, header, empty state, live region, no new route, both languages.
// SYNTHETIC: generated questions only.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const SRC = new URL('../src/', import.meta.url).href;
const { chapterRowOf, dotpointChoices, readDotpointParam, withDotpoint } = await import(`${SRC}lib/practiceDotpoints.js`);
const { practiceRequestFromQuery, practiceHref } = await import(`${SRC}lib/practiceLinks.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { SUBTOPICS, dotpointsFor } = await import(`${SRC}engine/curriculum.js`);
const { nswIssuedForms, nswIssuedLevels, nswExactLevels } = await import(`${SRC}engine/nswOffer.js`);
await loadAllBanks();

// ── LIST ────────────────────────────────────────────────────────────────────
const dp = (i, generated = true) => ({ id: `t.${i + 1}`, text: `Dot point ${i + 1}`, generated });
const row = { id: 't', name: 'T', dotpoints: [dp(0), dp(1, false), dp(2), dp(3)] };
const curriculum = { years: [{ year: 11, subtopics: [{ id: 'other', dotpoints: [] }] }], streams: [{ year: 12, subtopics: [row] }] };
eq(chapterRowOf(curriculum, 't'), row, 'the chapter row is found in the streams as well as the years');
eq(chapterRowOf(curriculum, 'nope'), null, 'an unknown chapter has no row');
eq(chapterRowOf(null, 't'), null, 'no curriculum, no row');
eq(dotpointChoices(row).map(c => c.ordinal), [0, 2, 3], 'only dot points an issued question stands behind are offered, in syllabus order');
eq(dotpointChoices(row).map(c => c.text), ['Dot point 1', 'Dot point 3', 'Dot point 4'], 'labels are the home page labels');
eq(dotpointChoices({ dotpoints: [] }), [], 'a chapter without dot points has no picker');
eq(dotpointChoices(null), [], 'a missing chapter has no picker');

// The real catalogue: every chapter's choices are exactly its issued dot points, in order.
let checkedChapters = 0;
for (const s of SUBTOPICS) {
  const issued = dotpointsFor(s.id).filter(d => nswIssuedForms(s.id, d.forms).length > 0);
  const asRow = { id: s.id, dotpoints: dotpointsFor(s.id).map(d => ({ id: d.id, text: d.text, generated: nswIssuedForms(s.id, d.forms).length > 0 })) };
  eq(dotpointChoices(asRow).map(c => c.id), issued.map(d => d.id), `${s.id}: the control lists exactly the issued dot points`);
  eq(dotpointChoices(asRow).map(c => c.text), issued.map(d => d.text), `${s.id}: with the same labels`);
  checkedChapters++;
}
ok(checkedChapters > 40, `${checkedChapters} catalogue chapters checked`);

// ── URL and request ─────────────────────────────────────────────────────────
const params = new URLSearchParams('subtopic=y12-diff&difficulty=3&track=x');
eq(withDotpoint(params, 2).toString(), 'subtopic=y12-diff&difficulty=3&track=x&dotpoint=2', 'choosing sets dotpoint and keeps the other filters');
eq(withDotpoint(new URLSearchParams('subtopic=a&dotpoint=1&difficulty=2'), null).toString(), 'subtopic=a&difficulty=2', 'All removes dotpoint and keeps the others');
eq(withDotpoint(new URLSearchParams('subtopic=a&dotpoint=1'), 0).get('dotpoint'), '0', 'the first dot point is 0, not "none"');
eq(params.toString(), 'subtopic=y12-diff&difficulty=3&track=x', 'the current params are never mutated');
const sent = practiceRequestFromQuery(withDotpoint(new URLSearchParams('subtopic=y12-diff&difficulty=2'), 1));
eq(sent, { mode: 'topic', subtopic: 'y12-diff', track: undefined, dotpoint: 1, difficulty: 2, pyqOnly: undefined }, 'the page asks the way the home links ask');
eq(practiceRequestFromQuery(new URLSearchParams(practiceHref({ subtopic: 'y12-diff', dotpoint: 0 }).split('?')[1])).dotpoint, 0, 'a home link and the picker agree on dot point 0');
eq(readDotpointParam(row, null), null, 'no dotpoint in the URL, nothing active');
eq(readDotpointParam(row, '2').choice.text, 'Dot point 3', 'the URL names the dot point by its position in the list');
eq(readDotpointParam(row, '1'), { missing: true, ordinal: 1 }, 'a dot point with no issued question is never active');
eq(readDotpointParam(row, '9'), { missing: true, ordinal: null }, 'a dot point that does not exist is never active');
eq(readDotpointParam(row, 'x'), { missing: true, ordinal: null }, 'a non-numeric value is never active');

// ── NARROWS: 40 questions with and without the dot point ────────────────────
// Every dot point of every Year 11 and 12 topic the server issues (the topics the Australian edition
// offers), at every level an issued form exists, drawn 40 times each way.
//   exact   the bank pins the question to the dot point (dotpointExact): the label may be worn
//   shared  the cell exercises the dot point with siblings: it belongs, but is not pinned to it
//   leak    the question belongs to a different dot point: NOT narrowed
// The seven leaks below are the GENERATOR's: asked for a dot point, a cell can still draw a sibling's form.
// The server no longer issues them (server/platform/practice.js seekQuestion passes over a question that does not
// carry the requested dot point; the ISSUED section below pins that map as empty); the generator list can only shrink.
const DRAWS = 40;
const draw = (sub, d, arg) => Array.from({ length: DRAWS }, (_, i) => generateQuestion(sub, d, 104729 * (i + 1) + 7, arg));
const credited = q => (Array.isArray(q.dotpoints) && q.dotpoints.length ? q.dotpoints : q.dotpoint ? [q.dotpoint] : []);
const KNOWN_LEAKS = {
  'y12-financial.1@D1': 28, 'y12-financial.2@D1': 12, 'me11-poly.3@D4': 21, 'me11-functions.2@D2': 35,
  'me11-comb.3@D4': 5, 'me12-induction.1@D4': 23, 'me12-induction.3@D4': 26,
  'y12-diff.1@D2': 36, 'y12-diff.2@D3': 36
};
// y12-diff D2 and D3 (Years 11-12 step-mark pass, 24 Nov 2026): three forms were added so the approved scheme can pay two-mark chain rule questions and a
// draft can pay three-mark product and quotient rule ones. Each declares its own dot point on the question (chain rule at D2, product rule at D3), and the
// picker still draws a cell's forms at random, so asked for the product rule at D2 it now returns a chain rule question 4 times in 40 (36 belong), and asked
// for the quotient rule at D3 a product rule question 4 times in 40 (36 belong). Two recorded leak cells, each a sibling dot point of the same topic;
// the question says which dot point it is on, so nothing wears a wrong label.
// me12-induction D4: 11 -> 23 and 25 -> 26 of 40 draws belong to the asked dot point (the leak SHRINKS: 29 -> 17 and 15 -> 14 draws
// on a sibling's dot point). Cause: the Extension 1 bank-variety forms (CONTENT_VERSION 2026.11.46) joined that cell declaring no
// dot point, so they are credited to the cell's own dot points (series and structure) and the divisibility-only forms of
// au-forms-gaps-g-nsw.js are a smaller share of the draw. No new leak cell was added.
let topics = 0, cells = 0, exact = 0, shared = 0, belongs = 0, total = 0;
// Baseline: a topic asked at its first issued level with no dot point, against each of its dot points asked at that level.
let pairs = 0, pairsReachedWithout = 0, pairsOnTargetWithout = 0, pairsOnTargetWith = 0;
const leaks = {};
const sample = [];
for (const s of SUBTOPICS) {
  if (s.year < 11 || !nswIssuedLevels(s.id).length) continue;
  const issued = dotpointsFor(s.id).filter(d => nswIssuedForms(s.id, d.forms).length > 0);
  if (!issued.length) continue;
  topics++;
  const L0 = nswIssuedLevels(s.id)[0];
  const baseline = draw(s.id, L0, undefined);
  for (const d of issued) {
    const asked = draw(s.id, L0, d.id);
    const onWithout = baseline.filter(q => credited(q).includes(d.id)).length;
    const onWith = asked.filter(q => credited(q).includes(d.id)).length;
    pairs++; pairsOnTargetWithout += onWithout; pairsOnTargetWith += onWith;
    if (onWithout > 0) pairsReachedWithout++;
    if (s.id === 'y12-diff') sample.push(`${d.id} at D${L0}: ${onWith}/${DRAWS} with the dot point, ${onWithout}/${DRAWS} without`);
    for (const level of nswIssuedForms(s.id, d.forms)) {
      const withDp = draw(s.id, level, d.id);
      const inDp = withDp.filter(q => credited(q).includes(d.id)).length;
      const pinned = withDp.filter(q => q.dotpointExact === true && q.dotpoint === d.id).length;
      cells++; total += DRAWS; belongs += inDp; exact += pinned;
      if (pinned === 0) shared++;
      for (const q of withDp) if (q.dotpointExact === true) assert.ok(q.dotpoint === d.id && q.subtopic === s.id, `${d.id}: a question that says it is exact is on that dot point`);
      if (inDp < DRAWS) leaks[`${d.id}@D${level}`] = inDp;
    }
  }
}
ok(topics > 15 && cells > 60, `${topics} topics and ${cells} dot point cells drawn`);
eq(leaks, KNOWN_LEAKS, 'the only cells where the dot point does not narrow are the recorded ones');
eq(belongs, total - Object.values(KNOWN_LEAKS).reduce((a, k) => a + (DRAWS - k), 0), `with dotpoint=<n>: ${belongs}/${total} questions belong to that dot point`);
ok(pairsOnTargetWith > pairsOnTargetWithout * 1.5, `asked at one level, ${pairsOnTargetWith} of ${pairs * DRAWS} draws land on the chosen dot point with the parameter and ${pairsOnTargetWithout} without it`);
ok(pairsReachedWithout < pairs, `without the parameter ${pairs - pairsReachedWithout} of ${pairs} dot points never appear in 40 questions at the topic's first level`);
ok(exact > total / 2, `${exact}/${total} are pinned to the dot point by the bank; ${shared} of ${cells} cells share it with a sibling dot point`);
// ── ISSUED: the same cells, drawn through the server's own picker ───────────
// What a student is actually dealt is chooseQuestion's seek, not a bare generateQuestion: it draws seeds until one
// carries the requested dot point. Every cell above (the seven generator leaks included) must come back entirely on
// the dot point. A new leak in the picker fails here.
// The author's question bank is part of what a dot point request is answered with on this edition (and some offered levels are the bank's alone).
process.env.PRI_EDITION = 'prithagoras';
const { ensureQbank } = await import('../../server/platform/qbankPack.js');
const { chooseQuestion, ensureBanks } = await import('../../server/platform/practice.js');
const { bankPolicy } = await import('../../server/platform/editionBanks.js');
await ensureBanks();
await ensureQbank(process.env, { strict: true });
const banks = bankPolicy('prithagoras'); // the edition that issues these cells
const lcg = a => () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a; };
const issuedLeaks = {};
let issuedCells = 0, issuedTotal = 0, issuedOn = 0;
for (const s of SUBTOPICS) {
  if (s.year < 11 || !nswIssuedLevels(s.id).length) continue;
  // Only the levels at which a dot point's own questions are served are offered for it (nswDotpointExact.js; the exhaustive check is
  // server/test/practice-dotpoint-exact-check.mjs). A level it shares with a sibling is refused, never answered with the sibling.
  for (const d of dotpointsFor(s.id).filter(x => nswIssuedForms(s.id, nswExactLevels(s.id, x.id)).length > 0)) {
    for (const level of nswIssuedForms(s.id, nswExactLevels(s.id, d.id))) {
      const next = lcg(level * 7919 + 13);
      let on = 0;
      for (let i = 0; i < DRAWS; i++) {
        const { q } = chooseQuestion({ generator: s.id, difficulty: level, mode: 'practice', avoid: new Set(), dotpoint: d.id, trap: null, written: false, band: null },
          null, { draw: () => next() % 0x80000000, banks });
        if (credited(q).includes(d.id)) on++;
      }
      issuedCells++; issuedTotal += DRAWS; issuedOn += on;
      if (on < DRAWS) issuedLeaks[`${d.id}@D${level}`] = on;
    }
  }
}
// The offered cells, counted: 263 = 132 levels at which a content review READ the generator's questions and found them on the dot point
// (tools/nsw-dotpoint-content-review.json, Years 11 and 12) + 131 levels that only the author's bank (or a question that names its own dot
// point) answers. It was `cells` (every cell the registry table names, 381) before the review: the table alone proved nothing, so the cells it
// names that the review found mixed are no longer offered.
eq(issuedCells, 263, 'the issued section covers exactly the offered cells');
eq(issuedLeaks, {}, 'issued through the server, a requested dot point never returns another one in any cell');
eq(issuedOn, issuedTotal, `${issuedOn}/${issuedTotal} issued questions belong to the dot point asked for`);
console.log(`  issued through the server: ${issuedOn}/${issuedTotal} on the dot point across ${issuedCells} cells; leaks ${JSON.stringify(issuedLeaks)}`);

const diff = dotpointsFor('y12-diff').filter(d => nswIssuedForms('y12-diff', nswExactLevels('y12-diff', d.id)).length);
ok(diff.length >= 2, 'y12-diff offers more than one dot point');
const seen = new Set(diff.map(d => draw('y12-diff', nswIssuedForms('y12-diff', nswExactLevels('y12-diff', d.id))[0], d.id).map(q => q.dotpoint).join('|')));
eq(seen.size, diff.length, 'each dot point of y12-diff issues questions of its own, never another one');
console.log(`  40-draw comparison (y12-diff): ${sample.join(' · ')}`);
console.log(`  all offered topics: ${belongs}/${total} draws belong to the dot point across every issued level (${exact} pinned, ${shared} of ${cells} cells shared); leaks ${JSON.stringify(leaks)}`);
console.log(`  topic baseline, 40 draws each way at the first issued level: on the chosen dot point ${pairsOnTargetWith}/${pairs * DRAWS} with, ${pairsOnTargetWithout}/${pairs * DRAWS} without; ${pairs - pairsReachedWithout}/${pairs} dot points never seen without`);

// ── WIRING ──────────────────────────────────────────────────────────────────
const base = read('../src/pages/PracticeBase.jsx');
const picker = read('../src/components/DotpointPicker.jsx');
const en = read('../src/i18n/strings.en.js');
const hi = read('../src/i18n/strings.hi.js');
const css = read('../src/workspace.css');
ok(/<select id=\{id\} className="input"/.test(picker) && /<label className="label" htmlFor=\{id\}>/.test(picker), 'a real select with a label bound to it');
ok(/value="">\{t\('practice\.dotpointAll'\)\}/.test(picker), 'All dot points is the first option');
ok(/useAnnounce\(\)/.test(base) && /\{dotpointRegion\}/.test(base) && /announceDotpoint\(next \?/.test(base), 'the change goes through the app\'s live region');
ok(/data-dotpoint-chip/.test(picker) && /data-dotpoint-clear/.test(picker) && /dotpointRemove/.test(picker), 'a removable chip with a labelled clear button');
ok(/<DotpointPicker row=\{chapterRow\} value=\{dotpoint\} onChange=\{chooseDotpoint\} \/>/.test(base) && /setParams\(withDotpoint\(params, ordinal\)\)/.test(base), 'the page hands the picker the URL value and writes the URL back');
ok(/<DotpointChip phone active=\{activeDotpoint\}/.test(base), 'on a phone the chip sits in the existing filter row');
ok(/api\.get\('\/curriculum'\)/.test(base) && !/server\.|app\.(get|post)/.test(picker), 'it reads the existing curriculum reply and adds no route');
ok(/data-served-dotpoint/.test(base) && /serve\.dotpoint === activeDotpoint\.id/.test(base), 'the header names a dot point only when the question was delivered from it');
ok(/data-dotpoint-all/.test(base) && /difficultyGap\.dotpoint && showAllDotpoints/.test(base), 'the empty states offer All dot points');
// a refused dot-point request is the "not offered" state on every edition, and the picker's empty state (with its All dot points
// action) is what the student sees: never a different question, never a generic error
{
  const { isContentEmpty } = await import(`${SRC}lib/contentServe.js`);
  const backend = read('../src/local/backend.js');
  ok(isContentEmpty('PRACTICE_NOT_OFFERED'), 'practiceNotOffered() (409 PRACTICE_NOT_OFFERED) is a content-empty state');
  const gates = backend.match(/\(nsw \|\| dotpoint\) && SERVER_BANK_REFUSALS\.has\(cause\?\.code\)\) throw practiceNotOffered\(\)/g) || [];
  eq(gates.length, 2, 'both the issue path and the prepared path refuse a dot-point request on every edition, not only NSW');
  ok(!/if \(nsw && SERVER_BANK_REFUSALS/.test(backend), 'no path refuses only for NSW');
  ok(/error && !capped && isContentEmpty\(errorCode\)[\s\S]{0,600}showAllDotpoints && <button[^>]*data-dotpoint-all/.test(base), 'the empty state renders the All dot points action for a content-empty error');
}
ok(!/curriculum-nsw/.test(picker + read('../src/lib/practiceDotpoints.js') + base), 'no NSW curriculum module is imported');
ok(/\.dp-pick-row select \{[^}]*min-width: 0/.test(css) && /\.dp-chip \{[^}]*max-width/.test(css), 'select and chip shrink instead of scrolling sideways');
ok(!/gradient|box-shadow|border-left/.test((css.match(/\.dp-[^{]*\{[^}]*\}/g) || []).join('')), 'no new decoration');
const keys = ['dotpointLabel', 'dotpointAll', 'dotpointChip', 'dotpointRemove', 'dotpointAnnounce', 'dotpointAnnounceAll', 'dotpointNone'].map(k => `practice.${k}`);
for (const k of keys) {
  for (const [name, src] of [['English', en], ['Hindi', hi]]) {
    const m = src.match(new RegExp(`'${k.replace('.', '\\.')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    ok(m && m[1].length > 0, `${k} is in ${name}`);
    ok(!/[—–]/.test(m[1]), `${k} (${name}) has no dash punctuation`);
  }
}
const ph = k => [...(en.match(new RegExp(`'${k.replace('.', '\\.')}':\\s*'([^']*)'`))?.[1] || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
for (const k of keys) eq([...(hi.match(new RegExp(`'${k.replace('.', '\\.')}':\\s*'([^']*)'`))?.[1] || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(), ph(k), `${k}: the same placeholders in both languages`);

console.log(`PRACTICE DOT POINT PICKER: PASS — ${n} checks`);
