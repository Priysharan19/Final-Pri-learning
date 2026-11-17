// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the syllabus board, its priorities and paper readiness
// (engine/syllabusBoard.js, progress/SyllabusBoard.jsx). All records SYNTHETIC.
//
//   1. each node state follows from a hand-worked fixture;
//   2. NSW answers reach an outcome only through the crosswalk's dot point map;
//   3. the board's node count for every NSW course equals the curriculum model,
//      and the generated catalogue is exactly what the model gives today;
//   4. priority ranking is deterministic, and marks at stake are a range;
//   5. readiness refuses below two server-marked papers and never counts a
//      paper the server did not mark;
//   6. no state rests on colour: every state has its own glyph shape and word,
//      every tile an accessible name with the word, in English and Hindi;
//   7. no catalogue string anywhere offers a predicted/scaled mark or ATAR;
//   8. edition isolation: an India board holds no NSW code, an NSW board no
//      India chapter, and each course only its own syllabus's codes;
//   9. dark by default: a production build has the board off.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const B = await import('../src/engine/syllabusBoard.js');
const { NSW_BOARD_COURSES, NSW_DOTPOINT_OUTCOMES } = await import('../src/engine/nswBoardCatalogue.js');
const { nswExamBlueprint } = await import('../src/engine/nswExams.js');
const { indiaExamBlueprint } = await import('../src/engine/indiaExams.js');
const model = await import('../src/engine/curriculum-nsw/index.js');
const { render: renderCatalogue } = await import('../../tools/nsw-board-catalogue.mjs');

const DAY = 86_400_000;
const T0 = Date.parse('2026-11-01T06:00:00Z');
const NOW = T0 + 30 * DAY;
let seq = 0;
const at = (dp, correct, day, extra = {}) => ({ createdAt: T0 + day * DAY + (++seq) * 1000, subtopic: 'x', generator: 'g1', correct: correct ? 1 : 0, support: 'independent', mode: 'practice', dotpoints: [dp], ...extra });

// ── 1. States from fixtures (India shape: node id = `${chapter}#${ordinal}`) ─
const chapters = [{ id: 'c1', name: 'Chapter one', dotpoints: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }];
const groups = B.indiaBoardGroups(chapters);
{
  const fixture = [
    // c1#0: nothing → not-started
    at('c1#1', false, 0), at('c1#1', false, 0), // seen
    at('c1#2', true, 0, { support: 'supported' }), at('c1#2', true, 0, { support: 'supported' }), at('c1#2', true, 0, { hintsUsed: 1, support: undefined }), // assisted
    at('c1#3', true, 0), at('c1#3', true, 0), // thin: 2 independent < floor 3
    at('c1#4', true, 0), at('c1#4', true, 0), at('c1#4', true, 0), at('c1#4', false, 0), // independent, never re-checked
    at('c1#5', true, 0), at('c1#5', true, 0), at('c1#5', true, 0), at('c1#5', true, 3), at('c1#5', true, 6), // retained: 2 delayed trials, both kept
    ...Array.from({ length: 8 }, (_, i) => at('c1#6', true, 0, { support: 'supported', n: i })), at('c1#6', true, 0), at('c1#6', true, 0), // 2 of 10 own → mostly helped
    at('c1#7', true, 0), at('c1#7', true, 0), at('c1#7', true, 0), at('c1#7', false, 3), at('c1#7', false, 6) // slipped after a gap → recheck
  ];
  const board = B.syllabusBoard(groups, fixture, { now: NOW });
  const states = board.groups[0].nodes.map(n => n.state);
  eq(states, ['not-started', 'seen', 'assisted', 'thin', 'independent', 'retained', 'assisted', 'recheck'], 'each node state follows from its fixture');
  eq(board.tally, { 'not-started': 1, seen: 1, assisted: 2, thin: 1, recheck: 1, independent: 1, retained: 1, total: 8 }, 'the board tally');
  // Later wrong answers outrank earlier right ones (review finding 1).
  const later = B.syllabusBoard(groups, [at('c1#0', true, 0), at('c1#0', true, 0), at('c1#0', true, 0), ...Array.from({ length: 10 }, () => at('c1#0', false, 8))], { now: NOW });
  eq(later.groups[0].nodes[0].state, 'recheck', '3 right then 10 wrong is "slipped", never "shown on your own"');
  const n5 = board.groups[0].nodes[5].evidence;
  eq([n5.answered, n5.independentRight, n5.helpedRight, n5.delayed, n5.delayedKept], [5, 5, 0, 2, 2], 'a retained node carries its counts: 5 answered, 5 own, 2 of 2 kept after a gap');
  eq(board.groups[0].nodes[7].evidence.retention, 'slipping', 'a node that slipped after a gap says so in its evidence');
  eq(board.groups[0].nodes[0].evidence, null, 'a node with no evidence has none, not zeros');
  // Not evidence: games, repeats, custom questions.
  const noise = B.syllabusBoard(groups, [at('c1#0', true, 0, { mode: 'rush' }), at('c1#0', true, 0, { repeat: true }), at('c1#0', true, 0, { subtopic: 'custom' })], { now: NOW });
  eq(noise.groups[0].nodes[0].state, 'not-started', 'games, repeats and custom questions put nothing on the board');
  eq(B.stateOf(null), 'not-started', 'no topic entry is not-started');
}

// ── 2. NSW credit goes only through the crosswalk map ───────────────────────
{
  const adv = B.nswBoardGroups(NSW_BOARD_COURSES.advanced);
  const located = NSW_DOTPOINT_OUTCOMES;
  eq(B.nodeIdsOf({ dotpoints: ['y11-functions.1'] }, { located }), [...located['y11-functions.1']], 'a Pri dot point credits exactly the outcomes it was located at');
  eq(B.nodeIdsOf({ dotpoints: [] }, { located }), [], 'an answer with no dot point credits no outcome');
  eq(B.nodeIdsOf({ dotpoints: ['no-such.1', 'constructor', '__proto__'] }, { located }), [], 'an unknown or inherited id credits nothing');
  const board = B.syllabusBoard(adv, [
    ...[0, 0, 0].map(d => at('y11-functions.1', true, d)),
    at('y7-integers.1', true, 0), at('y7-integers.1', true, 0), at('y7-integers.1', true, 0)
  ], { located, now: NOW });
  const touched = board.groups.flatMap(g => g.nodes).filter(n => n.state !== 'not-started').map(n => n.id);
  // Breadth (review finding 2): an outcome with many kinds of question is not shown by one of them.
  const sourcesOfCode = code => Object.entries(located).filter(([, cs]) => cs.includes(code)).map(([id]) => id);
  const wide = adv.flatMap(g => g.nodes).map(n => [n.id, sourcesOfCode(n.id)]).sort((a, b) => b[1].length - a[1].length)[0];
  ok(wide[1].length >= 4, `the widest Advanced outcome (${wide[0]}) has ${wide[1].length} kinds of question`);
  const narrow = B.syllabusBoard(adv, [0, 0, 0].map(d => at(wide[1][0], true, d)), { located, now: NOW }).groups.flatMap(g => g.nodes).find(n => n.id === wide[0]);
  eq([narrow.state, narrow.breadth], ['thin', { shown: 1, total: wide[1].length }], 'three answers on one kind of question leave a wide outcome "not enough evidence yet"');
  const half = Math.ceil(wide[1].length / 2);
  const broad = B.syllabusBoard(adv, wide[1].slice(0, half).flatMap(dp => [at(dp, true, 0)]).concat([at(wide[1][0], true, 0), at(wide[1][0], true, 0)]), { located, now: NOW }).groups.flatMap(g => g.nodes).find(n => n.id === wide[0]);
  eq(broad.state, 'independent', 'right on its own across half its kinds of question: shown on your own');
  // One answer that lands on two outcomes is one answer on each, never two on either.
  const multi = Object.entries(located).find(([, cs]) => cs.length > 1 && cs.every(c => adv.some(g => g.nodes.some(n => n.id === c))));
  if (multi) {
    const mb = B.syllabusBoard(adv, [at(multi[0], true, 0)], { located, now: NOW }).groups.flatMap(g => g.nodes);
    ok(multi[1].every(c => mb.find(n => n.id === c).evidence.answered === 1), `a dot point on ${multi[1].join(' and ')} counts once on each`);
  } else ok(true, 'no Advanced dot point lands on two Advanced outcomes');
  eq(touched, [...located['y11-functions.1']].filter(c => c.startsWith('MAV')), 'only the Advanced outcome is lit; a Stage 4 answer lights nothing on the Advanced board');
}

// ── 3. Node counts equal the curriculum model; the catalogue is current ─────
{
  const codes = key => B.nodesOf(B.nswBoardGroups(NSW_BOARD_COURSES[key])).map(n => n.id);
  const of = s => model.outcomesOf(s).map(o => o.code);
  eq(codes('advanced').length, of(model.NSW_MATHEMATICS_ADVANCED_2024).length, 'Advanced: one node per 2024 outcome');
  eq(codes('advanced'), of(model.NSW_MATHEMATICS_ADVANCED_2024), 'Advanced: the same codes, in syllabus order');
  eq(codes('extension-1'), of(model.NSW_MATHEMATICS_EXTENSION1_2024), 'Extension 1: one node per 2024 outcome');
  eq(codes('extension-2'), of(model.NSW_MATHEMATICS_EXTENSION2_2024), 'Extension 2: one node per 2024 outcome');
  const std = model.outcomesOf(model.NSW_MATHEMATICS_STANDARD_2024);
  eq(codes('standard-1'), std.filter(o => !o.course || o.course === 'Standard 1').map(o => o.code), 'Standard 1: the common Year 11 outcomes and its own Year 12 ones');
  eq(codes('standard-2'), std.filter(o => !o.course || o.course === 'Standard 2').map(o => o.code), 'Standard 2: likewise');
  eq([...new Set([...codes('standard-1'), ...codes('standard-2')])].sort(), std.map(o => o.code).sort(), 'Standard 1 and 2 together are every Standard outcome');
  const k10 = model.outcomesOf(model.NSW_MATHEMATICS_K10_2022);
  eq(codes('k10-stage4').length + codes('k10-stage5').length, k10.length, 'K–10: Stage 4 and Stage 5 together are every outcome');
  eq(renderCatalogue(), read('src/engine/nswBoardCatalogue.js'), 'the generated catalogue matches the model and the server today (node tools/nsw-board-catalogue.mjs)');
  ok(!read('src/engine/nswBoardCatalogue.js').includes('curriculum-nsw'), 'the device copy never names the model module');
  for (const [key, c] of Object.entries(NSW_BOARD_COURSES)) {
    for (const g of c.groups) for (const o of g.outcomes) {
      if (o.practise) ok((located => located.some(([id, cs]) => id === `${o.practise[0]}.${o.practise[1] + 1}` && cs.includes(o.code)))(Object.entries(NSW_DOTPOINT_OUTCOMES)), `${key} ${o.code}: "Practise this" opens a dot point located at this outcome`);
    }
  }
  const adv = NSW_BOARD_COURSES.advanced;
  eq([adv.version, adv.firstHsc], ['2024', 2027], 'the Advanced board is the 2024 syllabus, first HSC 2027');
}

// ── 4. Priorities: deterministic, a range, no prediction ────────────────────
{
  const adv = B.nswBoardGroups(NSW_BOARD_COURSES.advanced);
  const board = B.syllabusBoard(adv, [
    ...[0, 0, 0, 3, 6].map(d => at('y11-functions.1', true, d)),
    at('y12-integration.1', true, 0), at('y12-integration.1', true, 0)
  ], { located: NSW_DOTPOINT_OUTCOMES, now: NOW });
  const bp = nswExamBlueprint('nsw-hsc-advanced-2027');
  const areas = B.nswAreas(board, bp);
  eq(areas.paperMarks, 100, 'the Advanced paper is out of 100');
  eq(areas.areas.reduce((n, a) => n + a.marks, 0), 100, 'every blueprint mark lands in exactly one focus area');
  const one = B.boardPriorities(board, areas);
  const two = B.boardPriorities(board, { ...areas, areas: [...areas.areas].reverse() });
  eq(two, one, 'the ranking does not depend on input order');
  eq(B.boardPriorities(board, areas), one, 'the same record gives the same ranking');
  ok(one.items.length <= 4 && one.items.every(i => B.ACTIONS.includes(i.action)), 'at most four items, each with an action');
  ok(one.items.every(i => i.stake === null || (Number.isInteger(i.stake.low) && Number.isInteger(i.stake.high) && i.stake.low <= i.stake.high && i.stake.high <= i.marks)), 'each area stake is a whole-mark range within the area\'s marks');
  ok(one.stake.low <= one.stake.high && one.stake.high <= 100, 'the paper stake is a range within the paper');
  for (let k = 1; k < one.items.length; k++) {
    const a = one.items[k - 1], b = one.items[k];
    ok((a.stake?.high ?? -1) >= (b.stake?.high ?? -1) || (a.gap > 0 && b.gap === 0), `item ${k}: ranked by marks at stake`);
  }
  ok(one.items.every(i => i.questions >= 3 && i.questions <= 10 && i.minutes === i.questions * B.MINUTES_PER_QUESTION), 'question counts are bounded and time is estimated per question');
  ok(!one.items.some(i => 'predicted' in i || 'score' in i), 'no item carries a predicted figure');
  // Exact per-outcome marks (review finding 3): Working with functions is MAV-11-01 and MAV-11-02.
  {
    const wf = areas.areas.find(a => a.nodeIds.includes('MAV-11-01'));
    const m1 = wf.nodeMarks['MAV-11-01'], m2 = wf.nodeMarks['MAV-11-02'];
    const shown = B.syllabusBoard(adv, [], { now: NOW });
    for (const g of shown.groups) for (const n of g.nodes) if (n.id === 'MAV-11-01') n.state = 'independent';
    const item = B.boardPriorities(shown, B.nswAreas(shown, bp), { limit: 99 }).items.find(i => i.id === wf.id);
    eq(item.stake, { low: m2, high: m2 }, `only MAV-11-01 (${m1} marks) shown: exactly MAV-11-02's ${m2} marks are at stake`);
  }
  // Tie-break by id when everything else is equal.
  const tied = B.boardPriorities(board, { areas: [{ id: 'b', name: 'B', marks: 10, nodeIds: ['MAV-12-03'] }, { id: 'a', name: 'A', marks: 10, nodeIds: ['MAV-12-04'] }], paperMarks: 20 });
  eq(tied.items.map(i => i.id), ['a', 'b'], 'equal areas are ordered by id');
  // Action types.
  const g = [{ id: 'g', name: 'G', nodes: [{ id: 'n1' }, { id: 'n2' }] }];
  const act = (s1, s2) => B.boardPriorities({ groups: [{ ...g[0], nodes: [{ id: 'n1', state: s1 }, { id: 'n2', state: s2 }] }] }, { areas: [{ id: 'g', name: 'G', marks: 8, nodeIds: ['n1', 'n2'] }], paperMarks: 8 }).items[0];
  eq(act('not-started', 'seen').action, 'learn', 'nothing shown yet → Learn');
  eq(act('assisted', 'independent').action, 'consolidate', 'with help → Consolidate');
  eq(act('independent', 'retained').action, 'retain', 'shown but not yet held after a gap → Retain');
  eq(act('retained', 'retained').action, 'extend', 'all held → Extend');
  eq(act('not-started', 'thin').stake, { low: 4, high: 8 }, 'thin evidence widens the range: 4 marks surely not shown, up to 8');
  eq(act('retained', 'independent').stake, { low: 0, high: 0 }, 'independent evidence puts no marks at stake');
  // India: CBSE units carry the published weightage.
  const inGroups = B.indiaBoardGroups([{ id: 'c12-matrices', name: 'Matrices', dotpoints: ['a', 'b'] }, { id: 'c12-determinants', name: 'Determinants', dotpoints: ['c'] }]);
  const inBoard = B.syllabusBoard(inGroups, [], { now: NOW });
  const ia = B.indiaAreas(inBoard, indiaExamBlueprint({ track: 'cbse', grade: 12 }));
  eq(ia.areas.map(a => [a.id, a.marks, a.nodeIds.length]), [['algebra', 10, 3]], 'India: the Algebra unit (10 marks) spans its chapters\' dot points');
  eq(B.boardPriorities(inBoard, ia).items[0].stake, { low: 10, high: 10 }, 'India: nothing shown yet → all 10 unit marks at stake');
  eq(B.indiaAreas(inBoard, null).paperMarks, null, 'no blueprint (JEE, Olympiad): no marks claimed');
  eq(B.nswAreas(B.syllabusBoard(B.nswBoardGroups(NSW_BOARD_COURSES['k10-stage5']), [], { now: NOW }), null).paperMarks, null, 'Years 7–10: no exam, no marks');
}

// ── 3b. The focus-area link tables (Pri's teaching maps) ─────────────────────
{
  const { NSW_FOCUS_LINKS, autoLayout } = await import('../src/engine/nswFocusLinks.js');
  eq(Object.keys(NSW_FOCUS_LINKS).sort(), ['advanced', 'extension-1', 'k10-stage4', 'k10-stage5', 'standard-2'], 'link tables for Advanced, Extension 1, Standard 2 and Stages 4 and 5');
  for (const [key, table] of Object.entries(NSW_FOCUS_LINKS)) {
    const ids = NSW_BOARD_COURSES[key].groups.map(g => g.id);
    eq(Object.keys(table.layout).sort(), [...ids].sort(), `${key}: the map places exactly the course's ${ids.length} focus areas`);
    ok(table.links.every(([a, b]) => ids.includes(a) && ids.includes(b) && a !== b), `${key}: every link joins two of the course's focus areas`);
    eq(new Set(table.links.map(l => l.join('>'))).size, table.links.length, `${key}: no link is listed twice`);
    // No cycle: an order exists in which every area comes after what it builds on.
    const into = new Map(ids.map(id => [id, table.links.filter(([, b]) => b === id).map(([a]) => a)]));
    const done = new Set(); let progress = true;
    while (progress) { progress = false; for (const id of ids) if (!done.has(id) && into.get(id).every(a => done.has(a))) { done.add(id); progress = true; } }
    eq(done.size, ids.length, `${key}: the links have no cycle`);
    // Generated layouts: strictly left to right. Advanced is the approved hand layout, whose
    // Integral → Applications of calculus link runs down its last column: never right to left.
    ok(table.links.every(([a, b]) => (key === 'advanced' ? table.layout[a][0] <= table.layout[b][0] : table.layout[a][0] < table.layout[b][0])),
      `${key}: every link runs ${key === 'advanced' ? 'left to right or down a column' : 'left to right'} (an area never sits left of what it builds on)`);
    eq(new Set(Object.values(table.layout).map(c => c.join(','))).size, ids.length, `${key}: no two areas share a place`);
    ok(Object.values(table.layout).every(([c, r]) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0), `${key}: whole, non-negative columns and rows`);
  }
  // autoLayout: deterministic, and it refuses a cycle or an unknown area.
  const L = [['a', 'b'], ['b', 'c'], ['a', 'c']];
  eq(autoLayout(['a', 'b', 'c'], L), autoLayout(['a', 'b', 'c'], L), 'the layout is the same every time');
  eq(autoLayout(['a', 'b', 'c'], L).c[0], 2, 'an area goes one column past the longest chain into it');
  let threw = ''; try { autoLayout(['a', 'b'], [['a', 'b'], ['b', 'a']]); } catch (e) { threw = e.message; }
  ok(/cycle/.test(threw), 'a cyclic table is refused');
  threw = ''; try { autoLayout(['a'], [['a', 'zz']]); } catch (e) { threw = e.message; }
  ok(/unknown/.test(threw), 'a link to an unknown area is refused');
}

// ── 4b. hsc-forecast's ranges (PR #1003 API), the area roll-up ──────────────
{
  const adv = B.syllabusBoard(B.nswBoardGroups(NSW_BOARD_COURSES.advanced), [], { now: NOW });
  const codes = B.nodesOf(adv.groups).map(n => n.id);
  const ranges = Object.fromEntries(codes.map((c, i) => [c, { low: 0.03, mid: 0.05, high: 0.08 + (i === 0 ? 0.01 : 0) }]));
  const meta = { paperMarks: 100, disclaimer: 'Not a prediction of the actual questions, a mark or a band.' };
  const fc = { topicWeightRanges: c => (c === 'advanced' ? ranges : {}), forecastMeta: c => ({ ...meta, course: c }) };
  const fa = B.forecastAreas(adv, fc, 'advanced');
  eq([fa.source, fa.paperMarks, fa.disclaimer], ['forecast', 100, meta.disclaimer], 'forecast areas carry the source, paper marks and disclaimer');
  const wf = B.boardPriorities(adv, fa, { limit: 99 }).items.find(i => i.id === 'working-with-functions-y11');
  eq(wf.stake, { low: 6, high: 17 }, 'nothing shown: the stake is the outcomes\' low–high marks summed and rounded outwards (3+3 to 9+8)');
  eq(B.forecastAreas(adv, { topicWeights: () => ({}), forecastMeta: () => meta }, 'advanced'), null, 'without topicWeightRanges there is no forecast stake (never a point figure)');
  eq(B.forecastAreas(adv, fc, 'standard-2'), null, 'no forecast for a course hsc-forecast does not cover');
  eq(B.forecastAreas(adv, null, 'advanced'), null, 'no module (#1003 not in this build): the blueprint fallback applies');
  eq(B.forecastAreas(adv, { topicWeightRanges: () => ({ 'MAV-11-01': { low: 0.5, high: 0.2 } }), forecastMeta: () => meta }, 'advanced'), null, 'a malformed range is not used');
  eq(B.FORECAST_COURSE, { advanced: 'advanced', 'extension-1': 'extension1' }, 'board course keys map to hsc-forecast course names');
  // Bounded by the paper (review of the real #1003 ranges, whose highs sum past 1).
  const wide = Object.fromEntries(codes.map(c => [c, { low: 0.02, mid: 0.055, high: 0.09 }]));
  const fw = B.forecastAreas(adv, { topicWeightRanges: () => wide, forecastMeta: () => meta }, 'advanced');
  const pw = B.boardPriorities(adv, fw, { limit: 99 });
  eq(pw.stake, { low: 100, high: 100 }, 'nothing shown: exactly the paper\'s 100 marks are at stake, never more');
  ok(pw.items.every(i => i.stake.high <= 100 && i.stake.low <= i.stake.high), 'no area claims more marks than the paper');
  eq(B.setBounds(['a'], { a: { low: 10, high: 60 }, b: { low: 50, high: 80 } }, 100), { low: 20, high: 50 }, 'a set holds at least what the others cannot, at most what they leave');
  // The real module, when hsc-forecast (#1003) is in this tree.
  if (existsSync(fileURLToPath(new URL('../src/engine/hsc/hscPriorities.js', import.meta.url)))) {
    const real = await import('../src/engine/hsc/hscPriorities.js');
    for (const key of ['advanced', 'extension-1']) {
      const b = B.syllabusBoard(B.nswBoardGroups(NSW_BOARD_COURSES[key]), [], { now: NOW });
      const ranges = real.topicWeightRanges(B.FORECAST_COURSE[key]);
      eq(Object.keys(ranges).sort(), B.nodesOf(b.groups).map(n => n.id).sort(), `${key}: hsc-forecast ranges cover exactly the board's outcomes`);
      const pr = B.boardPriorities(b, B.forecastAreas(b, real, key));
      eq(pr.stake, { low: real.forecastMeta(B.FORECAST_COURSE[key]).paperMarks, high: real.forecastMeta(B.FORECAST_COURSE[key]).paperMarks }, `${key}: nothing shown puts exactly the paper's marks at stake`);
    }
  } else ok(true, 'hsc-forecast (#1003) is not in this tree; its fixture shape is tested above');
  // Area roll-up: shown on your own only when every outcome is.
  eq(B.groupState([{ state: 'retained' }, { state: 'independent' }]), 'independent', 'an area is as strong as its weakest outcome');
  eq(B.groupState([{ state: 'retained' }, { state: 'not-started' }]), 'thin', 'an untouched outcome keeps the area from reading as shown, without calling it not started (review finding 2)');
  eq(B.groupState([{ state: 'seen' }, { state: 'not-started' }]), 'seen', 'a partly tried area reads as its weakest tried outcome');
  // A forecast that misses an outcome is not used (it would count that outcome as 0 marks).
  const partial = Object.fromEntries(codes.slice(1).map(c => [c, { low: 0.03, mid: 0.05, high: 0.08 }]));
  eq(B.forecastAreas(adv, { topicWeightRanges: () => partial, forecastMeta: () => meta }, 'advanced'), null, 'a forecast without a range for every outcome falls back to the blueprint');
  eq(B.forecastAreas(adv, { topicWeightRanges: () => ({ ...ranges, 'MAV-99-99': { low: 0, mid: 0, high: 0.01 } }), forecastMeta: () => meta }, 'advanced'), null, 'a forecast with an outcome the board lacks is not used');
  const low = Object.fromEntries(codes.map(c => [c, { low: 0.01, mid: 0.02, high: 0.03 }]));
  eq(B.forecastAreas(adv, { topicWeightRanges: () => low, forecastMeta: () => meta }, 'advanced'), null, 'ranges whose highs cannot reach the paper are not used (the bounds rest on it)');
  eq(B.setBounds(['a'], { a: { low: 1, high: 4 } }, NaN), { low: 1, high: 4 }, 'without a paper total, only the set\'s own lows and highs');
  // The reason never says "none shown" when some are (review finding 1).
  const mixedArea = { groups: [{ id: 'g', name: 'G', nodes: ['not-started', 'not-started', 'independent', 'retained'].map((s, i) => ({ id: `n${i}`, state: s })) }] };
  eq(B.boardPriorities(mixedArea, { areas: [{ id: 'g', name: 'G', marks: 8, nodeIds: ['n0', 'n1', 'n2', 'n3'] }], paperMarks: 8 }).items[0].why, { key: 'learnPart', own: 2, n: 4 }, '2 untouched, 1 own, 1 held: "2 of 4 shown on your own", not "none shown"');
  eq(B.groupState([{ state: 'not-started' }, { state: 'not-started' }]), 'not-started', 'an untouched area is not started');
  eq(B.groupState([{ state: 'independent' }, { state: 'recheck' }]), 'recheck', 'a slipped outcome shows on its area');
}

// ── 5. Readiness: refuses below two server-marked papers ────────────────────
{
  const paper = (id, score, total, day, extra = {}) => ({ id, title: `Paper ${id}`, finishedAt: T0 + day * DAY, score, total, deadlineAt: T0 + day * DAY, markedBy: 'server', provisional: false, pending: false, full: true, ...extra });
  eq(B.paperReadiness([]), { status: 'too-few', count: 0, needed: 2 }, 'no papers: refused, two needed');
  eq(B.paperReadiness([paper('a', 61, 100, 1)]), { status: 'too-few', count: 1, needed: 1 }, 'one paper: refused, one more needed');
  const notServer = [paper('a', 61, 100, 1), paper('b', 70, 100, 2, { markedBy: 'backup' }), paper('c', 70, 100, 3, { markedBy: 'earlier-version' }),
    paper('d', 70, 100, 4, { provisional: true }), paper('e', 70, 100, 5, { pending: true }), paper('f', 120, 100, 6), paper('g', null, 100, 7)];
  eq(B.paperReadiness(notServer).status, 'too-few', 'backups, device-marked, provisional, pending and malformed papers never count');
  const r = B.paperReadiness([paper('c', 72, 100, 9), paper('z', 40, 100, 1), paper('a', 61, 100, 3), paper('b', 68, 100, 6)]);
  eq(r.status, 'ready', 'two or more server-marked papers: shown');
  eq(r.papers.map(p => `${p.score}/${p.total}`), ['61/100', '68/100', '72/100'], 'the last three, oldest first');
  eq([r.trend, r.spread.low.score, r.spread.high.score, r.count], ['up', 61, 72, 4], 'trend up; the spread is of these papers');
  eq(B.paperReadiness([paper('a', 70, 100, 1), paper('b', 72, 100, 2)]).trend, 'level', 'a two-mark change reads as about level');
  eq(B.paperReadiness([paper('a', 70, 100, 1), paper('b', 30, 50, 2, { full: false })]).sameConditions, false, 'different totals or coverage are flagged');
  eq(B.paperReadiness([paper('a', 70, 100, 1), paper('b', 30, 50, 2, { deadlineAt: null })]).status, 'too-few', 'an untimed paper is not counted');
  eq(B.paperReadiness([paper('a', 70, 100, 1, { course: 'advanced' }), paper('b', 50, 70, 2, { course: 'extension-1' })], { course: 'advanced' }).status, 'too-few', 'another course\'s paper is not this board\'s evidence');
  eq(B.paperReadiness([paper('a', 70, 100, 1, { course: 'advanced' }), paper('b', 72, 100, 2)], { course: 'advanced' }).status, 'ready', 'a paper with no course recorded still counts');
  eq(B.paperReadiness([paper('a', 64, 100, 1), paper('b', 69, 100, 2)]).trend, 'up', '64 → 69 out of 100 is the 5-point edge: up, not level');
  ok(!('predicted' in r) && !('band' in r), 'readiness carries no predicted figure or band');
  const withSec = B.paperReadiness([paper('a', 61, 100, 1, { sections: [{ id: 'I', label: 'Section I', marks: 10, awarded: 7 }, { id: 'II', label: 'Section II', marks: 90, awarded: 54 }] }), paper('b', 68, 100, 2, { sections: [{ id: 'I', marks: 10, awarded: 9 }, { id: 'II', marks: 90, awarded: 60 }] })]);
  eq(withSec.papers[0].sections.map(x => `${x.awarded}/${x.marks}`), ['7/10', '54/90'], 'sections that add up to the paper are shown');
  eq(withSec.papers[1].sections, null, 'sections that do not add up to the paper\'s own result are dropped, never shown');
}

// ── 6–8. Rendering (both languages), the guard, isolation ───────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { MemoryRouter } = await import('react-router-dom');
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const view = await server.ssrLoadModule('/src/progress/SyllabusBoard.jsx');
  const { AppCtx } = await server.ssrLoadModule('/src/App.jsx');
  const noop = () => {};
  const appValue = { user: { id: 'p1', name: 'Test', year: 12, course: 'in', role: 'student' }, celebrate: noop, refreshUser: noop, refreshDue: noop, refreshRecent: noop, toast: noop };
  const draw = (C, props) => renderToStaticMarkup(React.createElement(AppCtx.Provider, { value: appValue }, React.createElement(MemoryRouter, null, React.createElement(C, props))));
  const fixture = [at('c1#1', false, 0), at('c1#2', true, 0, { support: 'supported' }), at('c1#3', true, 0), ...[0, 0, 0].map(d => at('c1#4', true, d)), ...[0, 0, 0, 3, 6].map(d => at('c1#5', true, d))];
  const inBoard = B.syllabusBoard(groups, fixture, { now: NOW });
  const nswBoard = B.syllabusBoard(B.nswBoardGroups(NSW_BOARD_COURSES.advanced), [...[0, 0, 0].map(d => at('y11-functions.1', true, d))], { located: NSW_DOTPOINT_OUTCOMES, now: NOW });

  // Each glyph is a different shape.
  const glyphs = B.NODE_STATES.map(s => renderToStaticMarkup(React.createElement(view.StateGlyph, { state: s })).replace(/data-glyph="[^"]+"/, ''));
  eq(new Set(glyphs).size, B.NODE_STATES.length, 'every state has its own glyph shape');

  const { NSW_FOCUS_LINKS } = await server.ssrLoadModule('/src/engine/nswFocusLinks.js');
  const advLinks = NSW_FOCUS_LINKS.advanced;
  const nswPrio = B.boardPriorities(nswBoard, B.nswAreas(nswBoard, nswExamBlueprint('nsw-hsc-advanced-2027')));
  const inPrio = B.boardPriorities(inBoard, B.indiaAreas(inBoard, null));
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (k, v) => i18n.translate(k, v);
    // Every state present in an area is named in its sentence, so the parts add up to the total.
    const sentence = view.groupSummary({ 'not-started': 1, seen: 1, assisted: 1, thin: 1, recheck: 1, independent: 1, retained: 1, total: 7 }, t);
    eq(sentence.split(' · ').length, 7, `${lang}: an area sentence names every state it holds, slipped included`);
    ok(sentence.includes(t('board.sum.recheck', { n: 1 })), `${lang}: slipped points are spoken in the area sentence`);
    const words = B.NODE_STATES.map(s => t(`board.state.${{ 'not-started': 'notStarted' }[s] || s}`));
    eq(new Set(words).size, B.NODE_STATES.length, `${lang}: a distinct word for every state`);

    // India: no link table, so the list is the view — a listbox moved by the arrow keys.
    const html = draw(view.BoardView, { board: inBoard, priorities: inPrio, india: true, track: 'cbse', courseLabel: 'Class 12 CBSE / NCERT', source: 'none' });
    ok(/role="listbox"[^>]*tabindex="0"/i.test(html) && /aria-activedescendant="sb-opt-c1"/.test(html), `${lang}: the list is a focusable listbox with an active option`);
    const opts = [...html.matchAll(/<div[^>]*role="option"[^>]*>[\s\S]*?<\/div>/g)].map(m => m[0]);
    eq(opts.length, 1, `${lang}: one option per chapter`);
    ok(opts.every(o => /data-state="([a-z-]+)"/.test(o) && o.includes(esc(words[B.NODE_STATES.indexOf(/data-state="([a-z-]+)"/.exec(o)[1])]))), `${lang}: every option carries its state as a word`);
    ok(!html.includes('data-board-map'), `${lang}: no map is drawn without Pri's link table`);
    ok(B.NODE_STATES.every(s => html.includes(`data-legend="${s}"`)) && words.every(w => html.includes(esc(w))), `${lang}: the legend names every state in words`);
    const nodesShown = [...html.matchAll(/<li data-node="(c1#\d)" data-state="([a-z-]+)"/g)].map(m => [m[1], m[2]]);
    eq(nodesShown.length, 8, `${lang}: the chapter's detail lists every learning outcome`);
    ok(nodesShown.every(([id, st]) => inBoard.groups[0].nodes.find(n => n.id === id).state === st), `${lang}: each outcome shows its own state`);
    ok(html.includes('data-group-summary') && html.includes(esc(t('board.practiseThis'))), `${lang}: the area has its summary sentence and Practise this`);

    // NSW Advanced: the map, with Pri's links, and the same areas as a list.
    const nsw = draw(view.BoardView, { board: nswBoard, priorities: nswPrio, links: advLinks, india: false, courseLabel: t('board.courseLabel', { name: 'Mathematics Advanced', version: '2024', year: 2027 }), source: 'blueprint-nsw', paperName: 'x' });
    ok(nsw.includes('data-board-map') && /<canvas[^>]*role="img"[^>]*aria-label="[^"]+"/.test(nsw), `${lang}: the Advanced map is a canvas with a spoken label`);
    ok(/aria-pressed="true"[^>]*>[^<]*<\/button><button[^>]*aria-pressed="false"/.test(nsw), `${lang}: the Map/List toggle says which is on`);
    ok(nsw.includes(esc(t('board.courseLabel', { name: 'Mathematics Advanced', version: '2024', year: 2027 }))), `${lang}: the NSW board names its course and syllabus version`);
    ok(lang !== 'en' || nsw.includes('Mathematics Advanced (2024 syllabus · first HSC 2027)'), 'en: "Mathematics Advanced (2024 syllabus · first HSC 2027)"');
    ok(nsw.includes(esc(t('board.linksNote'))), `${lang}: the links are labelled as Pri's own teaching map`);
    const nswList = draw(view.BoardView, { board: nswBoard, priorities: nswPrio, links: null, india: false, courseLabel: 'x', source: 'blueprint-nsw' });
    const groupsShown = [...nswList.matchAll(/role="group" aria-label="([^"]+)"/g)].map(m => m[1]);
    eq(groupsShown, [t('common.yearNumber', { n: 11 }), t('common.yearNumber', { n: 12 })], `${lang}: the NSW list is grouped by Year 11 and Year 12`);
    eq([...nswList.matchAll(/role="option"/g)].length, 14, `${lang}: 14 focus areas in the Advanced list`);
    ok(!/c\d+-[a-z]/.test(nsw.replace(/data-[a-z-]+="[^"]*"/g, '').replace(/id="[^"]*"/g, '')) && !/MA[VEX]-|MST-|ME[12]-/.test(html), `${lang}: neither edition's board carries the other's units`);
    // An NSW area: each outcome's code and Pri's own description, never NESA's wording.
    const open = draw(view.BoardView, { board: nswBoard, priorities: nswPrio, links: null, india: false, courseLabel: 'x', initialSelected: 'working-with-functions-y11', source: 'blueprint-nsw' });
    ok(open.includes('MAV-11-01') && open.includes('MAV-11-02') && open.includes(esc(t('board.priPractises'))), `${lang}: an NSW area lists its outcome codes with what Pri practises there`);
    ok(open.includes(esc(t('board.nswWording'))), `${lang}: it says NESA's wording is not reproduced`);

    // What to work on: cards, the reason in words, marks at stake as a range, the source said.
    const prio = draw(view.PrioritiesView, { priorities: nswPrio, source: 'blueprint-nsw', paperName: t('board.prio.nswPaper', { name: 'Mathematics Advanced' }) });
    ok(/<ol class="sb-cards">/.test(prio) && prio.includes('data-board-stake=') && /class="sb-card-why"/.test(prio), `${lang}: priorities are cards with the reason and the marks at stake`);
    ok(prio.includes(esc(t('board.prio.sourceNsw'))), `${lang}: blueprint marks say they are Pri's paper design, not NESA's`);
    const fc = draw(view.PrioritiesView, { priorities: nswPrio, source: 'forecast', disclaimer: 'FORECAST-DISCLAIMER' });
    ok(fc.includes('FORECAST-DISCLAIMER') && fc.includes(esc(t('board.prio.sourceForecast'))) && !fc.includes(esc(t('board.prio.sourceNsw'))), `${lang}: forecast marks say so in this language, with hsc-forecast's own disclaimer`);
    ok(draw(view.PrioritiesView, { priorities: nswPrio, source: 'forecast', disclaimer: '' }).includes(esc(t('board.prio.sourceForecast'))), `${lang}: the source is said even when the disclaimer is empty`);
    // "Practise this" follows the card (review finding 3).
    const card = { id: 'g', practise: { subtopic: 'card-target', dotpoint: 4 } };
    const area = { id: 'g', name: 'G', state: 'recheck', year: 12, nodes: [{ id: 'MAV-12-04', code: 'MAV-12-04', state: 'not-started', practise: { subtopic: 'other', dotpoint: 0 } }] };
    const AD = draw(view.AreaDetail, { area, india: false, priority: card });
    ok(AD.includes('data-board-practise'), `${lang}: a priority area offers Practise this`);
    eq(view.practiseTarget(area, card), card.practise, `${lang}: it goes to the card's own target, not the area's first untouched outcome`);
    eq(view.practiseTarget(area, null), { subtopic: 'other', dotpoint: 0 }, `${lang}: without a card, the weakest outcome with practice`);
    eq(view.practiseTarget({ nodes: [{ state: 'retained', practise: { subtopic: 'y', dotpoint: 0 } }] }, null), null, `${lang}: never an outcome already held after a gap`);
    const held = draw(view.AreaDetail, { area: { ...area, state: 'retained', nodes: [{ id: 'x', code: 'MAV-12-04', state: 'retained', practise: { subtopic: 'y', dotpoint: 0 } }] }, india: false });
    ok(!held.includes('data-board-practise') && held.includes(esc(t('board.noPractice'))), `${lang}: an area held after a gap, and not a priority, sends nobody back to it`);

    // Exam readiness.
    const few = draw(view.ReadinessView, { readiness: B.paperReadiness([]), edition: 'nsw' });
    ok(few.includes(esc(t('board.ready.sit'))) && !few.includes('data-ready-line') && few.includes('data-board-honesty'), `${lang}: below two papers it says "Sit a timed paper to see this.", shows none, and keeps the honesty box`);
    const papers = [[61, 7, 54], [68, 8, 60], [72, 8, 64]].map(([s, s1, s2], d) => ({ id: `p${d}`, title: 'P', finishedAt: T0 + d * DAY, score: s, total: 100, deadlineAt: 1, durationMin: 180, readingMin: 10, markedBy: 'server', full: true,
      sections: [{ id: 'I', label: 'Section I', marks: 10, awarded: s1 }, { id: 'II', label: 'Section II', marks: 90, awarded: s2 }] }));
    const ready = draw(view.ReadinessView, { readiness: B.paperReadiness(papers), edition: 'nsw', courseName: 'Mathematics Advanced' });
    ok(ready.includes(esc(t('board.ready.last', { count: 3, n: 3, list: '61/100, 68/100, 72/100' }))), `${lang}: the raw results, in words`);
    ok(/<svg class="sb-chart"[^>]*role="img"/.test(ready) && (ready.match(/class="sb-pt( on)?"/g) || []).length === 3, `${lang}: three papers on the chart`);
    ok(ready.includes('data-section="I"') && ready.includes('8 / 10') && ready.includes('64 / 90'), `${lang}: the last paper's Section I and II marks`);
    ok(ready.includes(esc(t('board.ready.delta', { d: '+4', paper: t('board.ready.paperN', { n: 2 }) }))), `${lang}: the change on the previous paper`);
    ok(ready.includes(esc(t('board.ready.whyNsw'))) && ready.includes(esc(t('board.ready.whyTitleNsw'))), `${lang}: the honesty box`);
    const inReady = draw(view.ReadinessView, { readiness: B.paperReadiness(papers), edition: 'in' });
    ok(inReady.includes(esc(t('board.ready.whyIn'))) && !inReady.includes('NESA') && !inReady.includes('UAC'), `${lang}: Priyabhata's box speaks of its own board, not NESA or UAC`);
    const mixed = draw(view.ReadinessView, { readiness: B.paperReadiness([{ ...papers[0], total: 80, score: 50, sections: null }, papers[1]]), edition: 'nsw' });
    ok(!mixed.includes('class="sb-chart"'), `${lang}: papers out of different totals are not drawn on one scale`);
  }
  // The corrected copy (CTO review): NESA aligns HSC marks to bands; UAC scales the ATAR separately.
  await i18n.setLanguage('en');
  const box = i18n.translate('board.ready.whyNsw');
  ok(/NESA aligns HSC marks to performance bands/.test(box) && /ATAR is scaled separately by UAC/.test(box), 'en: NESA aligns marks to bands and UAC scales the ATAR — not the other way round');
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

// ── 7. The guard: nothing offers a predicted or scaled mark ─────────────────
const BANNED = /predicted (scaled )?mark|scaled mark|predicted score|predicted band|band prediction|\bATAR\b/i;
for (const file of ['src/i18n/strings.en.js', 'src/i18n/strings.hi.js', 'src/i18n/strings.au.js']) {
  // The honesty box names the ATAR only to say UAC scales it: that exact clause is
  // removed from that one key before the whole guard runs on the rest of the line.
  const ATAR_CLAUSE = /the ATAR is scaled separately by UAC|ATAR को UAC अलग से स्केल करता है/;
  const hits = read(file).split('\n')
    .map(line => (/^\s*'board\.ready\.whyNsw':/.test(line) ? line.replace(ATAR_CLAUSE, '') : line))
    .filter(line => /^\s*'[^']+':/.test(line) && BANNED.test(line));
  eq(hits, [], `${file}: no catalogue string offers a predicted or scaled mark, ATAR or band`);
}
const boardSrc = read('src/progress/SyllabusBoard.jsx');
ok(!/predict|scaled|atar/i.test(boardSrc.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'board\.[a-zA-Z.]+'/g, '')), 'the board component computes and draws no prediction');
// The clause itself is checked, so it cannot drift into a claim.
ok(/'board\.ready\.whyNsw': '[^']*the ATAR is scaled separately by UAC, so no single predicted number would be honest/.test(read('src/i18n/strings.en.js')), 'en: the ATAR is named only to say no single predicted number would be honest');

// ── 7b. No NESA wording anywhere in the client or the build (CTO review) ─────
// NESA syllabus text is Crown copyright and not licensed to Pri (research §5.7).
// The board shows outcome CODES with Pri's own descriptions. These are the
// forms of NESA's outcome and content statements Pri deliberately avoids: the
// "A student:" stem and the verb phrases NESA outcomes open with. Pri holds no
// copy of the licensed text, so this is a phrasing guard, not a comparison
// against it; a hit means someone pasted outcome wording in.
const NESA_FORMS = [
  // ("A student uses …" alone is not banned: question prompts say it.)
  /\bA student:/,
  /\buses algebraic and graphical techniques to solve\b/i, /\bapplies calculus techniques to model and solve problems\b/i,
  /\bselects and uses appropriate (?:technology|strategies)\b/i, /\bcommunicates using mathematical language, notation\b/i,
  /\bsolves problems involving (?:the )?(?:use of )?(?:simple|basic)? ?(?:functions|calculus|probability)\b/i,
  /\bconstructs arguments to prove and justify results\b/i
];
function walkSrc(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkSrc(p, out); else if (/\.(m?js|jsx|css|html|json)$/.test(name)) out.push(p);
  }
  return out;
}
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const nesaHits = walkSrc(SRC).flatMap(f => NESA_FORMS.filter(rx => rx.test(readFileSync(f, 'utf8'))).map(rx => `${f.slice(SRC.length + 1)} ~ ${rx}`));
eq(nesaHits, [], 'no NESA outcome or content wording in client/src');
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
if (existsSync(DIST)) {
  const distHits = walkSrc(DIST).flatMap(f => NESA_FORMS.filter(rx => rx.test(readFileSync(f, 'utf8'))).map(rx => `${f.slice(DIST.length + 1)} ~ ${rx}`));
  eq(distHits, [], 'no NESA outcome or content wording in the built client');
} else ok(true, 'no build to scan (the build check runs where one exists)');
// The descriptions the board shows are Pri's own dot points, never a NESA statement.
for (const code of ['MAV-11-01', 'MAV-12-05', 'ME1-12-02']) {
  ok(!/^A student/.test(B.nodesOf(B.nswBoardGroups(NSW_BOARD_COURSES.advanced)).find(n => n.id === code)?.label || ''), `${code}: its label is the focus-area name, not an outcome statement`);
}

// ── 8. Isolation in the wiring ──────────────────────────────────────────────
{
  const be = read('src/local/backend.js');
  const route = be.slice(be.indexOf("'GET /progress/board'"), be.indexOf("'GET /badges'"));
  ok(/if \(!india\) return \{ course: 'nsw', attempts, papers \};/.test(route), 'the NSW board gets no India chapters');
  ok(/indiaScope\(trackId, p\.year\)/.test(route) && /cleanIndiaTrack\(p\.indiaTrack, p\.year\)/.test(route), 'the India board is the profile\'s own track and class');
  ok(!/answerGiven|answer:|solution/.test(route), 'no answer or solution leaves the route');
  const { nswCoursesFor } = await (async () => {
    // nswCoursesFor is plain JS inside the .jsx module: read it by its rule instead of loading React here.
    const fn = /export function nswCoursesFor\(user\) \{([\s\S]*?)\n\}/.exec(boardSrc)[1];
    return { nswCoursesFor: new Function('user', fn) };
  })();
  for (const [user, want] of [[{ year: 7 }, ['k10-stage4']], [{ year: 10 }, ['k10-stage5']], [{ year: 12, pathway: 'advanced' }, ['advanced']], [{ year: 11, pathway: 'standard' }, ['standard-2', 'standard-1']], [{ year: 12, pathway: 'ext1' }, ['extension-1', 'advanced']], [{ year: 12, pathway: 'ext2' }, ['extension-2', 'extension-1']]]) {
    eq(nswCoursesFor(user), want, `NSW courses for ${JSON.stringify(user)}`);
  }
  ok(/featureEnabled\('syllabusBoard'\) && <SyllabusBoard user=\{user\} india=\{false\} \/>/.test(read('src/pages/ProgressAustralia.jsx')), 'Prithagoras Progress draws the NSW board, behind its flag');
  ok(/featureEnabled\('syllabusBoard'\) && <SyllabusBoard user=\{user\} india /.test(read('src/pages/IndiaProgress.jsx')), 'Priyabhata Progress draws the India board, behind its flag');
}

// ── 9. Dark by default ──────────────────────────────────────────────────────
{
  const { featureStates, PENDING_FEATURE_FLAGS } = await import('../vite.config.js');
  ok(PENDING_FEATURE_FLAGS.includes('SYLLABUS_BOARD'), 'SYLLABUS_BOARD is a pending build flag');
  ok(featureStates('build', {}).syllabusBoard === false, 'a production build without PRI_FEATURE_SYLLABUS_BOARD has the board off');
  ok(featureStates('build', { PRI_FEATURE_SYLLABUS_BOARD: '1' }).syllabusBoard === true, 'PRI_FEATURE_SYLLABUS_BOARD=1 turns it on');
}

if (failures.length) {
  console.error(`SYLLABUS BOARD: FAIL — ${failures.length} of ${pass + failures.length}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`SYLLABUS BOARD: PASS — ${pass}/${pass} checks`);
