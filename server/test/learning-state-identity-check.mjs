// Pri Learning · learning-state identity and expiry (#689, #690, #691).
//
//   node server/test/learning-state-identity-check.mjs                   → SQLite
//   node server/test/learning-state-identity-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// The real modules — server/platform/contentSeen.js, exams.js markPaper,
// housekeeping.js runHousekeeping — on the real store of either engine, as the
// pri_server role under Row-Level Security on Postgres. Nothing here is a
// source-matched excerpt.
//
//   1. The canonical identity (v2): a multiple-correct item is one identity in
//      every deal of its options and every order of its key; an item is
//      another identity when its alternative, a part's figure, alternative,
//      stem or lists, or the label on its answer box differs; a matching list
//      is one identity in any row order when its labels are distinct. Real
//      composer-built JEE Advanced items and real generator questions, plus
//      the composer's exact shapes where a permutation has to be built by hand.
//   2. The compatibility rule: every legacy key an item was recorded under is
//      still read (history is never reset), looked up exactly (never a family
//      of candidates), honoured as a repeat, and reported as legacy evidence
//      where the legacy key could not have told the item from another. The
//      legacy key is byte for byte what the previous implementation wrote,
//      proved against a verbatim copy of it over real questions. New records
//      are written under the canonical key alone.
//   3. Expiry is monotonic on both engines: a write that commits later with an
//      earlier timestamp never shortens a record, across 100-key chunks, with
//      the real housekeeping sweep run against it; accounts stay isolated.
//   4. The examination path: the real markPaper flags repeats per part, per
//      alternative taken and per whole question from these keys, and carries
//      `repeatEvidence: 'legacy'` only where the rule says so. No mark changes.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { requestedEngine, openTestStore } = await import('./support/engine.mjs');
const {
  IDENTITY_VERSION, contentIdentityOf, legacyContentIdentityOf, legacyIdentityAmbiguous, repeatEvidenceOf,
  seenKeyOf, seenKeysOf, triedKeyOf, triedKeysOf, examItemsOf, opaqueContentHash,
  seenAmong, markSeen, contentSeen, contentSeenEvidence, markContentSeen, contentTried, markContentTried
} = await import('../platform/contentSeen.js');
const { practiceContentKey } = await import('../platform/deliveryCrypto.js');
const { contentHashOf, matchListOf } = await import('../../client/src/engine/contentIdentity.js');
const { loadAllBanks, loadBanksFor, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { composeIndiaPaper } = await import('../../client/src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../../client/src/engine/indiaExams.js');
const { indiaScope } = await import('../../client/src/engine/indiaProduct.js');
const { indiaPyqCells, narrowCells } = await import('../../client/src/engine/indiaExamCells.js');
const { multipartForYear, generateMultipart } = await import('../../client/src/engine/generators/multipart.js');
const { markPaper } = await import('../platform/exams.js');
const { runHousekeeping } = await import('../platform/housekeeping.js');

const engine = requestedEngine();
console.log(`engine: ${engine}`);
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const DAY = 24 * 60 * 60 * 1000;
const SEEN_AGE = 5 * 365 * DAY;
const TRIED_AGE = 90 * DAY;
const ids = items => new Set(items.map(contentIdentityOf));
const legacyIds = items => new Set(items.map(legacyContentIdentityOf));

// Every permutation of a short list.
function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [x, ...rest]));
}
// A multiple-correct item in the composer's exact shape (indiaExamComposer.js
// multiCorrect): the option texts in the given order, the key as the ascending
// indices of the correct texts.
const multi = (options, correctTexts, extra = {}) => ({
  prompt: 'Consider the two problems below.\n\n(I) Find x.\n\n(II) Find y.\n\nWhich of the following statements is/are correct? Select every correct option.',
  answerType: 'multi-mcq', mcqOptions: options,
  answer: { correctIndices: options.map((o, i) => (correctTexts.includes(o) ? i : -1)).filter(i => i >= 0) },
  examItem: 'multi-correct', contentHash: 'deadbeefdeadbeef', ...extra
});
const OPTIONS = ['alpha is 4', 'beta is 9', 'gamma is 16', 'delta is 25'];

await loadAllBanks();

// ══ 1 · the canonical identity ════════════════════════════════════════════════
{
  eq(IDENTITY_VERSION, 2, 'the identity is version 2');
  // #689 — 24 deals of one multiple-correct item preserving the same two correct texts.
  const deals = permutations(OPTIONS).map(options => multi(options, ['alpha is 4', 'gamma is 16']));
  eq(deals.length, 24, 'twenty-four deals of the four options');
  eq(ids(deals).size, 1, 'every deal of a multiple-correct item is one canonical identity');
  eq(new Set(deals.map(seenKeyOf)).size, 1, 'and one seen-key');
  eq(new Set(deals.map(triedKeyOf)).size, 1, 'and one tried-key');
  ok(legacyIds(deals).size > 1, `the version-1 identity split them into ${legacyIds(deals).size} (the defect this replaces)`);
  const base = multi(OPTIONS, ['alpha is 4', 'gamma is 16']);
  const reversedKey = { ...base, answer: { correctIndices: [2, 0] } };
  eq(contentIdentityOf(reversedKey), contentIdentityOf(base), 'listing the correct indices in another order is the same item');
  const duplicatedKey = { ...base, answer: { correctIndices: [0, 2, 0] } };
  eq(contentIdentityOf(duplicatedKey), contentIdentityOf(base), 'a repeated index names no further option');
  // The opposite direction: the same sorted options and the same indices, keyed to a different TEXT set.
  const otherSet = multi(['beta is 9', 'alpha is 4', 'gamma is 16', 'delta is 25'], ['beta is 9', 'gamma is 16']);
  eq(otherSet.answer.correctIndices, [0, 2], '(a second item with the same indices [0, 2] over the same option set)');
  ok(contentIdentityOf(otherSet) !== contentIdentityOf(base), 'keyed to a different set of option texts it is a different identity');
  eq(legacyContentIdentityOf(otherSet), legacyContentIdentityOf(base), '(the version-1 identity could not tell them apart)');
  ok(contentIdentityOf(multi(OPTIONS, ['alpha is 4'])) !== contentIdentityOf(base), 'one correct option against two is a different identity');
  ok(contentIdentityOf(multi(OPTIONS.map(o => o.replace('25', '36')), ['alpha is 4', 'gamma is 16'])) !== contentIdentityOf(base), 'a different option set is a different identity');
  const malformed = { ...base, answer: { correctIndices: [0, 7] } };
  ok(contentIdentityOf(malformed) !== contentIdentityOf(base) && contentIdentityOf(malformed) === contentIdentityOf({ ...malformed }), 'a key that points outside the options is not canonicalised: it stays its raw self, and stable');
  const emptyKey = { ...base, answer: { correctIndices: [] } };
  ok(contentIdentityOf(emptyKey) !== contentIdentityOf(base), 'an empty key is not the same as a two-option key');

  // Real composer-built items: a JEE Advanced paper holds multiple-correct and matrix-match questions.
  const spec = indiaExamPaperSpec({ track: 'jee-advanced', grade: 12, variant: 'standard' });
  const chapters = indiaScope('jee-advanced', 12);
  const pyq = indiaPyqCells('jee-advanced', chapters);
  await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
  let realMulti = null, realMatrix = null;
  for (let seed = 1; seed < 40 && (!realMulti || !realMatrix); seed++) {
    const paper = composeIndiaPaper(spec, { seed, draw: generateQuestion, chapters, pyqCellsFor: (chapter, range) => narrowCells(pyq.get(chapter.id) || [], range) });
    for (const q of paper.questions) {
      const payload = q.payload || q;
      if (!realMulti && payload.answerType === 'multi-mcq' && payload.answer?.correctIndices?.length > 1) realMulti = payload;
      if (!realMatrix && payload.examItem === 'matrix-match' && matchListOf(payload)) realMatrix = payload;
    }
  }
  ok(realMulti && realMatrix, 'a real composed JEE Advanced paper yields a multiple-correct item with two or more correct options, and a matrix-match item');
  const realDeals = permutations(realMulti.mcqOptions).map(options => ({ ...realMulti, mcqOptions: options,
    answer: { ...realMulti.answer, correctIndices: options.map((o, i) => (realMulti.answer.correctIndices.some(c => realMulti.mcqOptions[c] === o) ? i : -1)).filter(i => i >= 0) } }));
  eq([realDeals.length, ids(realDeals).size], [24, 1], 'the real composed multiple-correct item is one identity across all 24 deals of its options');
  ok(legacyIds(realDeals).size > 1, `(version 1 split the real item into ${legacyIds(realDeals).size})`);
  const realOther = { ...realMulti, answer: { correctIndices: [realMulti.mcqOptions.findIndex((_, i) => !realMulti.answer.correctIndices.includes(i))] } };
  ok(contentIdentityOf(realOther) !== contentIdentityOf(realMulti), 'the same real item keyed to a wrong option is another identity');

  // Matching list: the same associations in any row order are one item when the labels are distinct.
  const rowsOf = lists => ({ left: lists.left, right: lists.right });
  const lists = rowsOf(realMatrix.matchList);
  ok(lists.left.length >= 3 && lists.right.length >= 3, `(a real matrix-match item with ${lists.left.length} and ${lists.right.length} rows)`);
  const L = permutations(lists.left.slice(0, 3)).map(rows => [...rows, ...lists.left.slice(3)]);
  const R = permutations(lists.right.slice(0, 3)).map(rows => [...rows, ...lists.right.slice(3)]);
  const rowDeals = L.flatMap(left => R.map(right => ({ ...realMatrix, matchList: { left, right } })));
  eq([rowDeals.length, ids(rowDeals).size], [36, 1], 'thirty-six row orders of one real matrix-match item (labels travelling with their text) are one identity');
  ok(legacyIds(rowDeals).size > 1, `(version 1 split them into ${legacyIds(rowDeals).size})`);
  const relabelled = { ...realMatrix, matchList: { left: lists.left, right: lists.right.map((row, i, all) => ({ ...row, text: all[(i + 1) % all.length].text })) } };
  ok(contentIdentityOf(relabelled) !== contentIdentityOf(realMatrix), 'List-II texts moved under other labels is a different question (the codes mean something else)');
  const dupLabels = { ...realMatrix, matchList: { left: lists.left.map(row => ({ ...row, key: 'P' })), right: lists.right } };
  const dupLabelsSwapped = { ...dupLabels, matchList: { left: [dupLabels.matchList.left[1], dupLabels.matchList.left[0], ...dupLabels.matchList.left.slice(2)], right: lists.right } };
  ok(contentIdentityOf(dupLabels) !== contentIdentityOf(dupLabelsSwapped), 'a side whose labels repeat is not sorted: its rows stay in dealt order (fail closed)');
  eq(contentIdentityOf({ ...realMatrix, matchList: { left: lists.left.map(row => ({ ...row, text: `  ${row.text}  ` })), right: lists.right } }), contentIdentityOf(realMatrix), 'whitespace in a list entry is not a difference');

  // Single multiple-choice: what already held, still holds (practice-repeat-credit-check proves it over HTTP).
  const MCQ = 'c9-euclid-geometry';
  const mcqDeals = [];
  for (let seed = 1; seed < 400 && mcqDeals.length < 6; seed++) {
    const q = generateQuestion(MCQ, 1, seed);
    if (q.answerType !== 'mcq' || (mcqDeals.length && q.prompt !== mcqDeals[0].prompt)) continue;
    if (mcqDeals.some(d => d.contentHash === q.contentHash)) continue;
    mcqDeals.push(q);
  }
  eq([mcqDeals.length, ids(mcqDeals).size, legacyIds(mcqDeals).size], [6, 1, 1], 'six deals of one real multiple-choice question: one identity under both versions');
  const d0 = mcqDeals[0];
  const wrongIndex = [0, 1, 2, 3].find(i => i !== d0.answer.correctIndex);
  ok(contentIdentityOf({ ...d0, answer: { ...d0.answer, correctIndex: wrongIndex } }) !== contentIdentityOf(d0), 'keyed to a different option is a different identity');
  ok(contentIdentityOf({ ...d0, prompt: d0.prompt + ' (ii)' }) !== contentIdentityOf(d0), 'a different prompt is a different identity');
  ok(contentIdentityOf({ ...d0, figure: '<svg data-n="2"/>' }) !== contentIdentityOf(d0), 'a different figure is a different identity');
  eq(contentIdentityOf({ ...d0, figure: '<svg a/>', identityIgnoresFigure: true }), contentIdentityOf({ ...d0, figure: '<svg b/>', identityIgnoresFigure: true }), 'two drawings of a question whose figure does not bear on its answer are one identity');
  ok(contentIdentityOf({ ...d0, figure: '<svg a/>', identityIgnoresFigure: 'true' }) !== contentIdentityOf({ ...d0, figure: '<svg b/>', identityIgnoresFigure: 'true' }), 'and only the generator\'s own `true` leaves the figure out');

  // #690 — every student-visible part of a composed item is in its identity.
  const partA = { key: 'a', marks: 1, prompt: 'Find the circumference, to 1 d.p.', answerType: 'numeric', answer: { value: 18.8 }, figure: '<svg r="3"/>' };
  const partB = { key: 'b', marks: 2, prompt: 'Find the area, to 1 d.p.', answerType: 'numeric', answer: { value: 28.3 } };
  const altA = { key: 'a', marks: 1, prompt: 'Find the diameter.', answerType: 'numeric', answer: { value: 6 } };
  const parent = { multipart: true, title: 'Case study · Circles', stem: 'A circular garden bed has radius 3 m.', parts: [{ ...partA, alt: altA }, partB], totalMarks: 3, subtopic: 'c10-circles', difficulty: 2, examItem: 'case-study' };
  const vary = change => ({ ...parent, parts: parent.parts.map((part, i) => (i === 0 ? change(part) : part)) });
  const differs = (item, name) => ok(contentIdentityOf(item) !== contentIdentityOf(parent), name);
  differs(vary(part => ({ ...part, alt: { ...part.alt, prompt: 'Find the radius in cm.' } })), 'a different alternative prompt on a part is a different identity');
  differs(vary(part => ({ ...part, alt: { ...part.alt, answer: { value: 7 } } })), 'a different alternative answer on a part is a different identity');
  differs(vary(part => ({ ...part, alt: { ...part.alt, figure: '<svg alt/>' } })), 'a figure on the alternative is a different identity');
  differs(vary(part => ({ ...part, figure: '<svg r="5"/>' })), 'a different part figure is a different identity');
  differs(vary(part => ({ ...part, stem: 'Take π = 3.14.' })), 'a stem on a part is a different identity');
  differs(vary(part => ({ ...part, matchList: { left: [{ key: 'P', text: 'r' }], right: [{ key: '1', text: '3' }] } })), 'a list on a part is a different identity');
  differs(vary(part => ({ ...part, answerSuffix: ' m' })), 'a unit on a part\'s answer box is a different identity');
  differs({ ...parent, parts: [parent.parts[0]] }, 'fewer parts is a different identity');
  differs({ ...parent, alt: { prompt: 'Or: find the perimeter.', answerType: 'numeric', answer: { value: 1 } } }, 'an alternative on the item itself is a different identity');
  differs({ ...parent, stem: parent.stem + ' Take π = 22/7.' }, 'a different stem is a different identity');
  eq(contentIdentityOf(JSON.parse(JSON.stringify(parent))), contentIdentityOf(parent), 'the same composed item is one identity');
  for (const item of [parent, vary(part => ({ ...part, alt: { ...part.alt, prompt: 'Find the radius in cm.' } })), vary(part => ({ ...part, figure: '<svg r="5"/>' }))]) {
    ok(typeof contentIdentityOf(item) === 'string', '(each variant has an identity)');
  }
  eq(new Set([parent, vary(part => ({ ...part, alt: { ...part.alt, prompt: 'Find the radius in cm.' } })), vary(part => ({ ...part, figure: '<svg r="5"/>' }))].map(legacyContentIdentityOf)).size, 1,
    '(the version-1 identity could tell none of those apart)');
  const twoPart = { prompt: 'A', answerType: 'multipart', parts: [{ prompt: 'a', answerType: 'mcq', mcqOptions: ['1', '2'], answer: { correctIndex: 0 } }] };
  eq(contentIdentityOf({ ...twoPart, parts: [{ ...twoPart.parts[0], mcqOptions: ['2', '1'], answer: { correctIndex: 1 } }] }), contentIdentityOf(twoPart), 'a part\'s options may still be dealt in any order');
  ok(contentIdentityOf({ ...twoPart, parts: [{ ...twoPart.parts[0], answer: { correctIndex: 1 } }] }) !== contentIdentityOf(twoPart), 'and a part keyed differently is still different content');
  // A real generator multipart item, with its real parts.
  const mp = generateMultipart(multipartForYear(7, 'advanced')[0], 7);
  eq(contentIdentityOf(JSON.parse(JSON.stringify(mp))), contentIdentityOf(mp), 'a real Year 7 multipart item is one identity with itself');
  eq(contentIdentityOf(generateMultipart(mp.multipartId, 7)), contentIdentityOf(mp), 'and with the same item generated again from its seed');
  ok(contentIdentityOf({ ...mp, parts: mp.parts.map((part, i) => (i === 0 ? { ...part, figure: '<svg other/>' } : part)) }) !== contentIdentityOf(mp), 'and another identity when one of its parts gains a figure');

  // The answer-box labels (#690 comments): ₹ against $, m against m², a percentage against a length.
  const labelled = (answerPrefix, answerSuffix) => ({ prompt: 'What is the amount?', answerType: 'numeric', answer: { value: 100 }, contentHash: 'cafecafecafecafe', ...(answerPrefix ? { answerPrefix } : {}), ...(answerSuffix ? { answerSuffix } : {}) });
  for (const [a, b, name] of [[['₹', ''], ['$', ''], 'rupees against dollars before the box'], [['', '₹'], ['', '$'], 'rupees against dollars after it'], [['', 'm'], ['', 'kg'], 'metres against kilograms'],
    [['', 'm'], ['', 'm²'], 'metres against square metres'], [['', '%'], ['', 'm'], 'a percentage against a length'], [['', ''], ['', 'm'], 'no unit against a unit']]) {
    ok(contentIdentityOf(labelled(...a)) !== contentIdentityOf(labelled(...b)), `${name}: different identities`);
    eq(legacyContentIdentityOf(labelled(...a)), legacyContentIdentityOf(labelled(...b)), `(${name}: one version-1 identity)`);
  }
  eq(contentIdentityOf(labelled('', ' m')), contentIdentityOf(labelled('', 'm')), 'the space before a unit is not a difference');

  // Opaque.
  const keysOf = item => [contentIdentityOf(item), ...seenKeysOf(item), ...triedKeysOf(item)].join(' ');
  eq([/^[0-9a-f]{32}$/.test(contentIdentityOf(d0)), /^seen-c2:[0-9a-f]{32}$/.test(seenKeyOf(d0)), /^tried-c2:[0-9a-f]{32}$/.test(triedKeyOf(d0))], [true, true, true], 'the identity and its keys are 32 hex under a versioned prefix');
  eq([keysOf(d0).includes(String(d0.seed) + ':'), keysOf(d0).includes(d0.contentHash), keysOf(d0).includes(d0.contentId), keysOf(d0).includes(d0.prompt.slice(0, 12))], [false, false, false, false], 'no seed, engine hash, content id or prompt text in any key');
  eq([contentIdentityOf(null), contentIdentityOf('x'), seenKeysOf(null), triedKeysOf(undefined), repeatEvidenceOf(d0, new Set())], [null, null, [], [], null], 'nothing is not an item, and nothing known is no repeat');
  eq(examItemsOf(parent).length, 4, 'a composed item discloses itself, its parts and their alternatives');

  // Structured figures (Q2 on #695): an object-valued figure is identity by
  // value, never String(object) === '[object Object]'. The shapes are the
  // repository's own (class9-2026-27-gap-study-pack.js:108,116 and
  // class9-2026-27-congruence-studies.js:57). No question the server issues
  // carries one today; this pins the contract before one does.
  const plot = (Y, extra = {}) => ({ type: 'coordinate-intercepts', points: { O: [0, 0], X: [6, 0], Y }, segments: [['O', 'X'], ['O', 'Y'], ['X', 'Y']], alt: 'Axes triangle', ...extra });
  const area = { prompt: 'Find the area of the shaded triangle.', answerType: 'numeric', answer: { value: 12 } };
  const fig = figure => contentIdentityOf({ ...area, figure });
  ok(fig(plot([0, 4])) !== fig(plot([0, 9])), 'two structured diagrams that differ in one point are two identities (Q2 counterexample)');
  ok(fig({ type: 'triangle', base: 6, height: 4 }) !== fig({ type: 'triangle', base: 8, height: 3 }), 'two triangles of the same area are two identities');
  ok(fig({ type: 'ray-circle', A: [0, 0], B: [10, 0], angleDegrees: 30, radius: 7 }) !== fig({ type: 'ray-circle', A: [0, 0], B: [12, 0], angleDegrees: 30, radius: 8 }), 'the congruence-study ray-circle diagrams are two identities');
  ok(seenKeyOf({ ...area, figure: plot([0, 4]) }) !== seenKeyOf({ ...area, figure: plot([0, 9]) }) && triedKeyOf({ ...area, figure: plot([0, 4]) }) !== triedKeyOf({ ...area, figure: plot([0, 9]) }), 'and their seen and tried keys differ');
  const reordered = { alt: 'Axes triangle', segments: [['O', 'X'], ['O', 'Y'], ['X', 'Y']], points: { Y: [0, 4], X: [6, 0], O: [0, 0] }, type: 'coordinate-intercepts' };
  eq(fig(reordered), fig(plot([0, 4])), 'the same diagram written with its keys in another order is one identity');
  eq(fig(plot([0, 4], { note: undefined })), fig(plot([0, 4])), 'an undefined key is absent, as in JSON');
  eq(fig(plot([0, 4], { alt: 'Axes   triangle ' })), fig(plot([0, 4])), 'whitespace inside a label is normalised, as it is for a string figure');
  ok(fig({ ...plot([0, 4]), segments: [['O', 'Y'], ['O', 'X'], ['X', 'Y']] }) !== fig(plot([0, 4])), 'array order is meaning (segments, coordinates): a reordered list is another diagram');
  ok(fig({ r: 5 }) !== fig({ r: '5' }), 'a number is not the string that prints like it');
  ok(fig({ v: true }) !== fig({ v: 'true' }) && fig({ v: null }) !== fig({ v: 'null' }) && fig({ v: null }) !== fig({ v: '' }), 'nor is a boolean or null');
  ok(fig(['a', 'b']) !== fig('a,b') && fig({ a: 1 }) !== fig('[object Object]') && fig([]) !== fig({}) && fig([]) !== fig(''), 'an array, an object, an empty list and the text that prints like them are four things');
  ok(fig({ a: [1, 2] }) !== fig({ a: [[1, 2]] }) && fig({ a: { b: 1 } }) !== fig({ 'a.b': 1 }), 'nesting is preserved, not flattened');
  eq(fig({ x: -0 }), fig({ x: 0 }), 'minus zero is zero');
  eq(fig('<svg a/>'), contentIdentityOf({ ...area, figure: '  <svg   a/> ' }), 'a string figure keeps its normalised-text identity');
  eq(contentIdentityOf({ ...area, figure: plot([0, 4]), identityIgnoresFigure: true }), contentIdentityOf({ ...area, figure: plot([0, 9]), identityIgnoresFigure: true }), 'identityIgnoresFigure still leaves a structured figure out');
  ok(contentIdentityOf({ ...parent, parts: [{ ...partA, figure: plot([0, 4]) }, partB] }) !== contentIdentityOf({ ...parent, parts: [{ ...partA, figure: plot([0, 9]) }, partB] }), 'a part\'s structured figure is in the identity');
  ok(contentIdentityOf({ ...area, alt: { ...altA, figure: plot([0, 4]) } }) !== contentIdentityOf({ ...area, alt: { ...altA, figure: plot([0, 9]) } }), 'an alternative\'s structured figure is in the identity');
  const cyclic = { type: 'loop' }; cyclic.self = cyclic;
  const deep = Array.from({ length: 40 }).reduce(inner => ({ inner }), { leaf: 1 });
  for (const [name, figure] of [['a function', () => 1], ['a symbol', Symbol('s')], ['a bigint', 10n], ['a Date', new Date(0)], ['a Map', new Map([['a', 1]])], ['a class instance', new (class Shape {})()], ['NaN', { r: NaN }], ['Infinity', { r: Infinity }], ['a symbol key', { [Symbol('k')]: 1 }], ['a cycle', cyclic], ['nesting deeper than 32', deep]]) {
    let refusal = null;
    try { contentIdentityOf({ ...area, figure }); } catch (error) { refusal = error.code; }
    eq(refusal, 'CONTENT_IDENTITY_UNSUPPORTED_FIGURE', `${name} as a figure is refused, never collapsed into a shared key`);
  }
  const shared = [0, 1];
  eq(fig({ a: shared, b: shared }), fig({ a: [0, 1], b: [0, 1] }), 'the same array referenced twice is not a cycle');
  console.log(`  identity: ${count} checks`);
}

// ══ 2 · the compatibility rule for keys written before v2 ═════════════════════
{
  // The previous implementation, verbatim (server/platform/contentSeen.js at
  // a5778a319, blob c5b6736e). The legacy key must be byte for byte what it
  // wrote, or a record written under it would be lost: history reset.
  const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const optionsOf = item => (Array.isArray(item?.mcqOptions) ? item.mcqOptions : []).map(norm);
  function keyedAnswerOfV1(item) {
    const answer = item?.answer ?? null;
    if (item?.answerType === 'mcq' && Array.isArray(item.mcqOptions) && answer && typeof answer === 'object') {
      const index = Number(answer.correctIndex);
      if (Number.isInteger(index) && index >= 0 && index < item.mcqOptions.length) return ['mcq', norm(item.mcqOptions[index])];
    }
    return ['key', answer];
  }
  function identitySubstanceV1(item) {
    const parts = Array.isArray(item.parts)
      ? item.parts.map(part => [norm(part?.prompt), part?.answerType || null, optionsOf(part).sort(), keyedAnswerOfV1(part)])
      : null;
    return JSON.stringify([
      norm(item.stem), norm(item.prompt), item.answerType || null,
      optionsOf(item).sort(), keyedAnswerOfV1(item),
      item.identityIgnoresFigure === true ? '' : norm(item.figure), parts,
      ...(matchListOf(item) ? [matchListOf(item)] : [])
    ]);
  }
  const keyed = value => createHmac('sha256', practiceContentKey()).update(String(value));
  const contentIdentityOfV1 = item => keyed('identity:v1:' + identitySubstanceV1(item)).digest('hex').slice(0, 32);
  function seenKeysOfV1(item) {
    const hashes = new Set([contentHashOf(item)]);
    const stamped = item.contentHash ?? item.contentId ?? item.prompt;
    if (stamped != null && stamped !== '') hashes.add(String(stamped));
    return ['seen-c' + contentIdentityOfV1(item), ...[...hashes].map(hash => 'seen-' + opaqueContentHash(hash))];
  }
  const triedKeyOfV1 = item => 'tried-c' + contentIdentityOfV1(item);

  const corpus = [];
  for (const [generator, difficulty] of [['c8-linear-equations-both-sides', 2], ['c9-euclid-geometry', 1], ['c10-linear-graphs', 3], ['c10-quadratic-roots', 3], ['c11-linear-inequalities', 2], ['y10-stats', 3], ['c10-triangles-current', 1]]) {
    for (let seed = 1; seed <= 12; seed++) { try { corpus.push(generateQuestion(generator, difficulty, seed)); } catch { /* a generator without this rung */ } }
  }
  for (const id of [...multipartForYear(7, 'advanced'), ...multipartForYear(10, 'advanced')].slice(0, 6)) for (const seed of [1, 2]) corpus.push(generateMultipart(id, seed));
  corpus.push(multi(OPTIONS, ['alpha is 4', 'gamma is 16']), { prompt: 'Find the area.', answerType: 'numeric', answer: { value: 12 } }, { prompt: 'Find the area.', answerType: 'numeric', answer: { value: 12 }, answerSuffix: ' cm²' });
  ok(corpus.length > 60, `a corpus of ${corpus.length} real generator questions, multipart items and composed shapes`);
  let exact = 0;
  for (const item of corpus) {
    if (legacyContentIdentityOf(item) === contentIdentityOfV1(item) && JSON.stringify(seenKeysOf(item).slice(1)) === JSON.stringify(seenKeysOfV1(item)) && triedKeysOf(item)[1] === triedKeyOfV1(item)) exact++;
  }
  eq(exact, corpus.length, 'for every item the legacy keys read are exactly the keys the previous implementation wrote: seen under v1, under the engine hash as it stands, under the stamp; tried under v1');
  ok(corpus.every(item => seenKeysOf(item)[0] === seenKeyOf(item) && seenKeysOf(item)[0].startsWith('seen-c2:') && !seenKeysOfV1(item).includes(seenKeysOf(item)[0])), 'and the canonical key is a new key, first in the list, that no previous record carries');

  // Which legacy matches are ambiguous.
  const plain = generateQuestion('c8-linear-equations-both-sides', 2, 5);
  const d0 = corpus.find(q => q.answerType === 'mcq' && q.contentHash);
  eq([legacyIdentityAmbiguous(plain), legacyIdentityAmbiguous(d0)], [false, false], 'a stamped written or multiple-choice question: its legacy key named it exactly');
  eq([legacyIdentityAmbiguous(multi(OPTIONS, ['alpha is 4'])), legacyIdentityAmbiguous({ ...plain, answerSuffix: 'm' }), legacyIdentityAmbiguous({ ...plain, answerPrefix: '₹' }), legacyIdentityAmbiguous({ ...plain, alt: { prompt: 'or', answerType: 'numeric', answer: { value: 1 } } }),
    legacyIdentityAmbiguous({ ...plain, parts: [{ prompt: 'a', answerType: 'numeric', answer: { value: 1 }, figure: '<svg/>' }] }), legacyIdentityAmbiguous({ ...plain, parts: [{ prompt: 'a', answerType: 'numeric', answer: { value: 1 }, alt: { prompt: 'b' } }] }),
    legacyIdentityAmbiguous({ ...plain, parts: [{ prompt: 'a', answerType: 'numeric', answer: { value: 1 }, stem: 's' }] }), legacyIdentityAmbiguous({ ...plain, parts: [{ prompt: 'a', answerType: 'numeric', answer: { value: 1 }, matchList: { left: [{ key: 'P', text: 'x' }], right: [{ key: '1', text: 'y' }] } }] })],
  [true, true, true, true, true, true, true, true], 'a multiple-correct key, a label, an alternative, a part figure, alternative, stem or list: the version-1 key could have been another question\'s');
  eq([legacyIdentityAmbiguous({ ...plain, parts: [{ prompt: 'a', answerType: 'numeric', answer: { value: 1 } }] }), legacyIdentityAmbiguous({ ...plain, contentHash: undefined, contentId: undefined })], [false, false],
    'plain parts, or no stamp, drop nothing from the version-1 projection (the prompt-only alias of an unstamped unit is judged by the key that matched, below)');
  const unstampedPlain = { prompt: plain.prompt, answerType: plain.answerType, answer: plain.answer };
  eq([repeatEvidenceOf(unstampedPlain, new Set(['seen-' + opaqueContentHash(unstampedPlain.prompt)])).ambiguous, repeatEvidenceOf(unstampedPlain, new Set(['seen-c' + legacyContentIdentityOf(unstampedPlain)])).ambiguous],
    [true, false], 'an unstamped unit matched on its prompt alone is ambiguous; matched on its version-1 identity it is exact');

  // Evidence from a set of live keys.
  const known = new Set([seenKeyOf(d0)]);
  eq(repeatEvidenceOf(d0, known), { key: seenKeyOf(d0), legacy: false, ambiguous: false }, 'a canonical match is definite');
  eq(repeatEvidenceOf(d0, new Set(['seen-c' + legacyContentIdentityOf(d0)])), { key: 'seen-c' + legacyContentIdentityOf(d0), legacy: true, ambiguous: false }, 'a version-1 match on a plain item is legacy and definite');
  const m = multi(OPTIONS, ['alpha is 4', 'gamma is 16']);
  eq(repeatEvidenceOf(m, new Set(['seen-c' + legacyContentIdentityOf(m)])), { key: 'seen-c' + legacyContentIdentityOf(m), legacy: true, ambiguous: true }, 'a version-1 match on a multiple-correct item is legacy and ambiguous');
  eq(repeatEvidenceOf(m, new Set([seenKeyOf(m), 'seen-c' + legacyContentIdentityOf(m)])).legacy, false, 'the canonical key wins when both are present');
  eq(repeatEvidenceOf(m, new Set(['seen-c' + legacyContentIdentityOf(multi(OPTIONS, ['alpha is 4']))])), null, 'a legacy key of a different item is not evidence: lookups are exact, never a family');
  console.log(`  compatibility: ${count} checks so far`);
}

// ══ 3 · the records on the real store ═════════════════════════════════════════
const test = await openTestStore(engine, { label: 'learning-state' });
const db = test.store;
const A = 'acct_ls_a', B = 'acct_ls_b', C = 'acct_ls_c';
const T = Date.UTC(2026, 10, 2, 9, 0, 0);
const inScope = (accountId, fn) => db.transaction(fn, { accountScope: accountId });
const rowsOf = async (accountId, like = 'seen-%') => inScope(accountId, () => db.all("SELECT key, created_at, expires_at, response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND key LIKE ? ORDER BY key", [accountId, like]));
const expiryOf = async (accountId, key) => Number((await inScope(accountId, () => db.get("SELECT expires_at FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND key=?", [accountId, key])))?.expires_at ?? NaN);
try {
  for (const [id, email] of [[A, 'ls.a@example.test'], [B, 'ls.b@example.test'], [C, 'ls.c@example.test']]) {
    await db.run('INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)', [id, email, 'Learning State', 'student', T, T]);
  }

  // ── new records carry the canonical key alone; shuffles are the same content; accounts are isolated ──
  const base = multi(OPTIONS, ['alpha is 4', 'gamma is 16']);
  const shuffled = multi(['delta is 25', 'gamma is 16', 'beta is 9', 'alpha is 4'], ['alpha is 4', 'gamma is 16']);
  const otherSet = multi(['beta is 9', 'alpha is 4', 'gamma is 16', 'delta is 25'], ['beta is 9', 'gamma is 16']);
  await inScope(A, () => markContentSeen(db, A, base, T));
  const written = await rowsOf(A);
  eq(written.map(r => r.key), [seenKeyOf(base)], 'marking content seen writes one row, under the canonical key');
  eq([written[0].response_json, Number(written[0].created_at), Number(written[0].expires_at)], ['{}', T, T + SEEN_AGE], 'with no content in it, created now, expiring in five years');

  // Structured figures on the store (Q2 on #695): seeing one diagram does not
  // make a different diagram with the same text seen, on either engine.
  {
    const figured = Y => ({ prompt: 'Find the area of the shaded triangle.', answerType: 'numeric', answer: { value: 12 }, figure: { type: 'coordinate-intercepts', points: { O: [0, 0], X: [6, 0], Y }, alt: 'Axes triangle' } });
    await inScope(C, () => markContentSeen(db, C, figured([0, 4]), T));
    eq(await inScope(C, () => contentSeenEvidence(db, C, figured([0, 9]), T)), null, 'on the store: a different structured diagram with the same text is not seen');
    eq(await inScope(C, () => contentSeenEvidence(db, C, figured([0, 4]), T)), { key: seenKeyOf(figured([0, 4])), legacy: false, ambiguous: false }, 'and the same diagram is, under its canonical key');
    await inScope(C, () => db.run("DELETE FROM idempotency_keys WHERE account_id=? AND scope='practice-content'", [C]));
  }
  eq([await inScope(A, () => contentSeen(db, A, shuffled, T)), await inScope(A, () => contentSeen(db, A, otherSet, T)), await inScope(A, () => contentSeen(db, A, multi(OPTIONS, ['alpha is 4']), T))], [true, false, false],
    'a reshuffled copy is seen; the same options keyed to another text set, or to one option, is not');
  eq(await inScope(B, () => contentSeen(db, B, base, T)), false, 'another account has not seen it');
  eq(await inScope(B, () => contentSeen(db, B, shuffled, T)), false, 'nor its shuffle');
  eq(await inScope(A, () => contentSeenEvidence(db, A, shuffled, T)), { key: seenKeyOf(base), legacy: false, ambiguous: false }, 'and the evidence is the canonical key');
  // Account scope: on Postgres the restrictive RLS policies refuse A's row to a
  // transaction scoped to B even when the statement names A (defence in depth
  // under the handlers' own WHERE account_id = ?); on SQLite the scope is
  // recorded only and the WHERE clause alone does the scoping (store.js).
  eq((await inScope(B, () => seenAmong(db, A, seenKeysOf(base), T))).size, engine === 'postgres' ? 0 : 1,
    engine === 'postgres' ? 'a transaction scoped to another account reads nothing of this one, even when it names it (RLS)' : 'on SQLite the account scope is recorded only: the handler\'s own account id is the whole boundary');
  // Tries follow the content.
  await inScope(A, () => markContentTried(db, A, base, T));
  const tried = await rowsOf(A, 'tried-%');
  eq([tried.map(r => r.key), Number(tried[0].expires_at)], [[triedKeyOf(base)], T + TRIED_AGE], 'a spent try is one row under the canonical tried-key, living ninety days');
  eq([await inScope(A, () => contentTried(db, A, shuffled, T)), await inScope(A, () => contentTried(db, A, otherSet, T)), await inScope(B, () => contentTried(db, B, shuffled, T))], [true, false, false], 'spent on every deal of that content, on no other, for no other account');

  // ── legacy rows: honoured exactly, never widened, reported ────────────────
  const insertLegacy = (accountId, key, at = T) => inScope(accountId, () => db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-content',?,?,?,?,?)", [accountId, key, '{}', 'legacy-row', at, at + SEEN_AGE]));
  const legacyMulti = multi(OPTIONS.map(o => o + '!'), ['alpha is 4!', 'gamma is 16!']);
  await insertLegacy(A, 'seen-c' + legacyContentIdentityOf(legacyMulti));
  eq(await inScope(A, () => contentSeenEvidence(db, A, legacyMulti, T)), { key: 'seen-c' + legacyContentIdentityOf(legacyMulti), legacy: true, ambiguous: true }, 'a multiple-correct item recorded under its version-1 key alone is still seen (history is not reset), as ambiguous legacy evidence');
  const legacyShuffle = multi(['gamma is 16!', 'alpha is 4!', 'delta is 25!', 'beta is 9!'], ['alpha is 4!', 'gamma is 16!']);
  ok(legacyContentIdentityOf(legacyShuffle) !== legacyContentIdentityOf(legacyMulti), '(a deal whose version-1 identity differs)');
  eq(await inScope(A, () => contentSeen(db, A, legacyShuffle, T)), false, 'is not found through it: the legacy lookup is exact, no other index tuple or order is tried');
  const legacyCollision = multi(['beta is 9!', 'alpha is 4!', 'gamma is 16!', 'delta is 25!'], ['beta is 9!', 'gamma is 16!']);
  eq([legacyContentIdentityOf(legacyCollision) === legacyContentIdentityOf(legacyMulti), (await inScope(A, () => contentSeenEvidence(db, A, legacyCollision, T)))?.ambiguous], [true, true],
    'an item the version-1 key cannot tell from the recorded one reads as seen — the row cannot say which it was — and says so: ambiguous legacy evidence');
  const plainQ = generateQuestion('c8-linear-equations-both-sides', 2, 9);
  await insertLegacy(A, 'seen-c' + legacyContentIdentityOf(plainQ));
  eq(await inScope(A, () => contentSeenEvidence(db, A, plainQ, T)), { key: 'seen-c' + legacyContentIdentityOf(plainQ), legacy: true, ambiguous: false }, 'a plain question under its version-1 key is seen, as legacy evidence that is not ambiguous');
  const hashQ = generateQuestion('c8-linear-equations-both-sides', 2, 10);
  await insertLegacy(A, 'seen-' + opaqueContentHash(hashQ.contentHash));
  eq((await inScope(A, () => contentSeenEvidence(db, A, hashQ, T)))?.legacy, true, 'a question recorded under its stamped engine hash alone (before any identity existed) is still seen');
  const unstamped = { prompt: 'Find the circumference of the garden, correct to 1 decimal place.', answerType: 'numeric', answer: { value: 18.8 } };
  await insertLegacy(A, 'seen-' + opaqueContentHash(unstamped.prompt));
  eq(await inScope(A, () => contentSeenEvidence(db, A, { ...unstamped, answer: { value: 31.4 } }, T)), { key: 'seen-' + opaqueContentHash(unstamped.prompt), legacy: true, ambiguous: true }, 'an unstamped part recorded under its prompt alone makes another question with that prompt a repeat — honoured, and reported as ambiguous');
  await inScope(A, () => markContentSeen(db, A, { ...unstamped, answer: { value: 31.4 } }, T));
  eq((await rowsOf(A)).filter(r => r.key === 'seen-' + opaqueContentHash(unstamped.prompt)).length, 1, 'recording it now does not write the prompt alias again (nor any legacy key): only the canonical row is added');
  eq((await rowsOf(A)).some(r => r.key.startsWith('seen-c2:') && r.key === seenKeyOf({ ...unstamped, answer: { value: 31.4 } })), true, '(the canonical row for the new item is there)');
  eq(await inScope(B, () => contentSeen(db, B, legacyMulti, T)), false, 'legacy rows are account-scoped too');
  await insertLegacy(A, 'tried-c' + legacyContentIdentityOf(plainQ));
  eq([await inScope(A, () => contentTried(db, A, plainQ, T)), await inScope(A, () => contentTried(db, A, generateQuestion('c8-linear-equations-both-sides', 2, 11), T))], [true, false], 'a try recorded under the version-1 tried-key alone is still spent, on that content only');

  // ── expiry is monotonic (#691) ─────────────────────────────────────────────
  const k = seenKeyOf({ prompt: 'monotonic', answerType: 'numeric', answer: { value: 1 } });
  await inScope(A, () => markSeen(db, A, [k], T + 10 * DAY));
  await inScope(A, () => markSeen(db, A, [k], T + 1 * DAY));
  eq(await expiryOf(A, k), T + 10 * DAY + SEEN_AGE, 'a write that commits later with an earlier timestamp does not shorten the record');
  await inScope(A, () => markSeen(db, A, [k], T + 20 * DAY));
  eq(await expiryOf(A, k), T + 20 * DAY + SEEN_AGE, 'a later exposure extends it');
  eq(Number((await rowsOf(A)).find(r => r.key === k).created_at), T + 10 * DAY, 'and created_at is the first write');
  // Three writers committing in reverse order, on seen and on tried.
  const k3 = triedKeyOf({ prompt: 'three', answerType: 'numeric', answer: { value: 3 } });
  for (const at of [12, 6, 1]) await inScope(A, () => markSeen(db, A, [k3], T + at * DAY, TRIED_AGE));
  eq(await expiryOf(A, k3), T + 12 * DAY + TRIED_AGE, 'three writes landing in reverse order keep the latest expiry (spent try, ninety days)');
  // Overlapping promises: both statements in flight at once; the earlier-stamped one is issued second.
  const k4 = seenKeyOf({ prompt: 'overlap', answerType: 'numeric', answer: { value: 4 } });
  await Promise.all([inScope(A, () => markSeen(db, A, [k4], T + 9 * DAY)), inScope(A, () => markSeen(db, A, [k4], T + 2 * DAY))]);
  eq(await expiryOf(A, k4), T + 9 * DAY + SEEN_AGE, 'two overlapping writes: the record keeps the later expiry whichever commits last');
  // An expired row comes back to life.
  const k5 = seenKeyOf({ prompt: 'revive', answerType: 'numeric', answer: { value: 5 } });
  await inScope(A, () => db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-content',?,?,?,?,?)", [A, k5, '{}', 'lapsed', T - 2000, T - 1000]));
  eq((await inScope(A, () => seenAmong(db, A, [k5], T))).size, 0, 'an expired record is not a record');
  await inScope(A, () => markSeen(db, A, [k5], T));
  eq([await expiryOf(A, k5), (await inScope(A, () => seenAmong(db, A, [k5], T))).size], [T + SEEN_AGE, 1], 'recording it again renews it');
  // Account isolation of the renewal.
  await inScope(B, () => markSeen(db, B, [k], T + 40 * DAY));
  eq([await expiryOf(A, k), await expiryOf(B, k)], [T + 20 * DAY + SEEN_AGE, T + 40 * DAY + SEEN_AGE], 'another account\'s write of the same key is its own row');

  // 205 keys across the 100-key chunk boundary, written late then early.
  const many = Array.from({ length: 205 }, (_, i) => seenKeyOf({ prompt: `chunk ${i}`, answerType: 'numeric', answer: { value: i } }));
  await inScope(A, () => markSeen(db, A, many, T + 12 * DAY));
  await inScope(A, () => markSeen(db, A, many, T + 1 * DAY));
  const manyRows = await inScope(A, () => db.all("SELECT key, expires_at FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND key IN (" + many.map(() => '?').join(',') + ')', [A, ...many]));
  eq([manyRows.length, manyRows.filter(r => Number(r.expires_at) === T + 12 * DAY + SEEN_AGE).length], [205, 205], 'all 205 keys, across three statements, keep the later expiry');
  eq((await inScope(A, () => seenAmong(db, A, many, T + 12 * DAY + SEEN_AGE - 1))).size, 205, 'all 205 are live a moment before that expiry');
  eq((await inScope(A, () => seenAmong(db, A, many, T + 12 * DAY + SEEN_AGE))).size, 0, 'and none at it');
  eq((await inScope(B, () => seenAmong(db, B, many, T + 1 * DAY))).size, 0, 'none for another account');

  // ── the real housekeeping sweep against those rows ─────────────────────────
  const countOf = async keys => (await inScope(A, () => db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-content' AND key IN (" + keys.map(() => '?').join(',') + ')', [A, ...keys]))).length;
  const first = await runHousekeeping(db, T + 1 * DAY + SEEN_AGE + 1);
  eq([await countOf([k, k4]), await countOf(many), await countOf([k5])], [2, 205, 0], 'housekeeping at the earlier expiry sweeps the record that did expire and none of those a later exposure kept');
  ok(first.idempotencyKeys >= 1, `(it reported ${first.idempotencyKeys} expired key rows)`);
  const second = await runHousekeeping(db, T + 20 * DAY + SEEN_AGE + 1);
  eq([await countOf([k]), await countOf(many), await countOf([k4])], [0, 0, 0], 'and at the later expiry it sweeps them all');
  ok(second.idempotencyKeys >= 206, `(it reported ${second.idempotencyKeys})`);
  eq(await expiryOf(B, k), T + 40 * DAY + SEEN_AGE, 'the other account\'s row, not yet due, is untouched');

  // ══ 4 · the examination path: the real markPaper ══════════════════════════
  const partA = { key: 'a', marks: 1, prompt: 'Find the circumference of the garden, correct to 1 decimal place.', answerType: 'numeric', answer: { value: 18.8 }, figure: '<svg r="3"/>', steps: [] };
  const altA = { key: 'a', marks: 1, prompt: 'Find the diameter of the garden.', answerType: 'numeric', answer: { value: 6 }, steps: [] };
  const partB = { key: 'b', marks: 2, prompt: 'Find the area of the garden, correct to 1 decimal place.', answerType: 'numeric', answer: { value: 28.3 }, steps: [] };
  const caseStudy = { multipart: true, title: 'Case study · Circles', stem: 'A circular garden bed has radius 3 m.', parts: [{ ...partA, alt: altA }, partB], totalMarks: 3, subtopic: 'c10-circles', difficulty: 2, examItem: 'case-study' };
  const single = { ...generateQuestion('c9-euclid-geometry', 1, 3), alt: { ...generateQuestion('c9-euclid-geometry', 1, 4), key: undefined } };
  const paperOf = (id, payloads) => ({
    id, kind: 'india', title: 'Test paper', questions: payloads.map((payload, i) => ({
      id: `${id}-q${i + 1}`, order: i + 1, section: 'A', sectionLabel: 'Section A', item: payload.examItem || 'single',
      chapterId: 'ch-circles', chapterName: 'Circles', generator: 'g', difficulty: 2,
      marking: { correct: payload.totalMarks || 4, incorrect: 0, unanswered: 0, partialPerOption: null }, marks: payload.totalMarks || 4, payload
    }))
  });
  const allRight = (q, given, working, grid) => ({ correct: true, awarded: grid.correct, unanswered: false, feedback: '', partial: null, markingScheme: 'final-answer', outcome: 'correct' });
  const answersFor = (paper, { alt = [] } = {}) => {
    const answers = {};
    for (const sq of paper.questions) {
      if (sq.payload.multipart) for (const part of sq.payload.parts) answers[alt.includes(part.key) && part.alt ? `${sq.id}::${part.key}::or` : `${sq.id}::${part.key}`] = '1';
      else answers[alt.includes('*') && sq.payload.alt ? `${sq.id}::or` : sq.id] = '0';
    }
    return { answers, workings: {}, times: {}, modes: {}, ink: {} };
  };
  // What finalise() does around markPaper: read every key, mark, write the canonical keys.
  const finalise = async (accountId, paper, responses, now) => inScope(accountId, async () => {
    const items = paper.questions.flatMap(sq => examItemsOf(sq.payload));
    const seen = await seenAmong(db, accountId, items.flatMap(seenKeysOf), now);
    const marked = markPaper(paper, responses, { now, totalMs: 1000, seen, mark: allRight });
    await markSeen(db, accountId, items.map(seenKeyOf), now);
    return marked;
  });
  const p1 = paperOf('exam-1', [caseStudy, single, base]);
  const r1 = await finalise(A, p1, answersFor(p1), T + 30 * DAY);
  eq([r1.score, r1.total, r1.detail.map(d => d.repeat ?? false), r1.attempts.filter(a => a.repeat).length], [3 + 4 + 4, 11, [false, false, false], 0], 'a first paper: full marks, nothing on it a repeat');
  eq((await rowsOf(A)).filter(r => r.key.startsWith('seen-c2:')).length >= 7, true, 'finalising it recorded each item, alternative and part under a canonical key');
  eq((await rowsOf(A)).filter(r => !r.key.startsWith('seen-c2:') && Number(r.created_at) === T + 30 * DAY).length, 0, 'and no legacy key');
  // The same paper again, with the multiple-correct item dealt differently.
  const p2 = paperOf('exam-2', [caseStudy, single, shuffled]);
  const r2 = await finalise(A, p2, answersFor(p2), T + 31 * DAY);
  eq([r2.score, r2.total], [r1.score, r1.total], 'marks are what they were: a repeat is marked like new work');
  eq(r2.detail.map(d => d.repeat ?? false), [true, true, true], 'every question is a repeat, the reshuffled multiple-correct item included');
  eq(r2.detail[0].parts.map(part => part.repeat ?? false), [true, true], 'and so is each part');
  eq(r2.detail.some(d => d.repeatEvidence) || r2.detail[0].parts.some(part => part.repeatEvidence) || r2.attempts.some(a => a.repeatEvidence), false, 'none of it on legacy evidence');
  eq(r2.attempts.filter(a => a.repeat).length, r2.attempts.length, 'every attempt says repeat');
  // A paper whose case study offers a different alternative, taken.
  const otherAlt = { ...caseStudy, parts: [{ ...partA, alt: { ...altA, prompt: 'Find the radius of the garden in centimetres.', answer: { value: 300 } } }, partB] };
  const p3 = paperOf('exam-3', [otherAlt, { ...single, alt: { ...single.alt, prompt: single.alt.prompt + ' (another)' } }, otherSet]);
  const r3 = await finalise(A, p3, answersFor(p3, { alt: ['a', '*'] }), T + 32 * DAY);
  eq(r3.detail.map(d => d.repeat ?? false), [false, false, false], 'a different alternative taken, a different alternative beside the question, a different correct set: none is a repeat');
  eq(r3.detail[0].parts.map(part => part.repeat ?? false), [false, true], 'the part answered by its new alternative is new work; the unchanged part is a repeat');
  eq(r3.detail[0].choiceTaken === undefined || r3.detail[0].parts[0].choiceTaken === 'or', true, '(the alternative was the one marked)');
  // The same altered case study, main parts answered: both parts are repeats, so the whole question is.
  const p4 = paperOf('exam-4', [otherAlt]);
  const r4 = await finalise(A, p4, answersFor(p4), T + 33 * DAY);
  eq([r4.detail[0].repeat, r4.detail[0].parts.map(part => part.repeat ?? false), r4.detail[0].repeatEvidence ?? null], [true, [true, true], null], 'with its main parts answered again every part is a repeat and so is the whole, on canonical evidence');
  // Legacy rows on the examination path: honoured, reported where ambiguous.
  const legacyCase = { ...caseStudy, stem: 'A circular pond has radius 3 m.' };
  await inScope(B, () => markSeen(db, B, ['seen-c' + legacyContentIdentityOf(legacyCase)], T));
  const legacySingle = generateQuestion('c9-euclid-geometry', 1, 5);
  await inScope(B, () => markSeen(db, B, ['seen-c' + legacyContentIdentityOf(legacySingle)], T));
  const p5 = paperOf('exam-5', [legacyCase, legacySingle, multi(OPTIONS, ['beta is 9', 'delta is 25'])]);
  const r5 = await finalise(B, p5, answersFor(p5), T + 34 * DAY);
  eq([r5.detail[0].repeat, r5.detail[0].repeatEvidence, r5.detail[0].parts.map(part => part.repeat ?? false)], [true, 'legacy', [false, false]], 'a case study recorded under its version-1 key alone: the whole question is a repeat on legacy evidence (its parts carry figures and alternatives the key did not see); the parts, never recorded, are not');
  eq([r5.detail[1].repeat, r5.detail[1].repeatEvidence ?? null], [true, null], 'a plain multiple-choice question under its version-1 key: a repeat, not ambiguous, so no evidence flag');
  eq([r5.detail[2].repeat ?? false, r5.score], [false, r1.score], 'a multiple-correct item never recorded is new work; marks unchanged throughout');
  const attemptFlags = r5.attempts.map(a => [a.repeat ?? false, a.repeatEvidence ?? null]);
  eq(attemptFlags.filter(([, e]) => e === 'legacy').length, 0, 'per-part attempts of that case study rest on their own keys, so none is flagged legacy');
  eq(attemptFlags.some(([r, e]) => r && e === null), true, '(the plain question\'s attempt is a repeat without the flag)');
  // A third account, whose only records of the parts are version-1 keys (B's finalise above recorded them canonically).
  const p6 = paperOf('exam-6', [legacyCase]);
  await inScope(C, () => markSeen(db, C, caseStudy.parts.map(part => 'seen-c' + legacyContentIdentityOf(part)), T));
  const r6 = await finalise(C, p6, answersFor(p6), T + 35 * DAY);
  eq([r6.detail[0].parts.map(part => [part.repeat ?? false, part.repeatEvidence ?? null])], [[[true, 'legacy'], [true, null]]], 'parts under version-1 keys: the part with a figure is a repeat on ambiguous legacy evidence, the plain part on legacy evidence that is exact');
  eq(r6.attempts.map(a => [a.part, a.repeat ?? false, a.repeatEvidence ?? null]), [['a', true, 'legacy'], ['b', true, null]], 'and their attempts say the same');

  console.log(`LEARNING STATE IDENTITY: PASS — ${count}/${count} checks — the canonical identity keys multiple-correct items by their option texts and covers every alternative, part figure, list and answer-box label; legacy keys are read exactly, never widened, honoured and reported; expiry never shrinks and housekeeping keeps what a later exposure kept, on ${engine}.`);
} finally {
  await test.close();
}
