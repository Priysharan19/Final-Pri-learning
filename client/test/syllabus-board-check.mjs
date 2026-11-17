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
import { readFileSync } from 'node:fs';
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

  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (k, v) => i18n.translate(k, v);
    const words = B.NODE_STATES.map(s => t(`board.state.${{ 'not-started': 'notStarted' }[s] || s}`));
    eq(new Set(words).size, B.NODE_STATES.length, `${lang}: a distinct word for every state`);
    const html = draw(view.BoardView, { board: inBoard, india: true, track: 'cbse', courseLabel: 'Class 12 CBSE / NCERT' });
    const tiles = [...html.matchAll(/<button[^>]*class="sb-tile"[^>]*>/g)].map(m => m[0]);
    eq(tiles.length, 8, `${lang}: one tile button per node`);
    ok(tiles.every(tag => /aria-label="[^"]+: [^"]+"/.test(tag) && /data-state="([a-z-]+)"/.test(tag)), `${lang}: every tile has an accessible name`);
    ok(tiles.every(tag => { const st = /data-state="([a-z-]+)"/.exec(tag)[1]; return tag.includes(esc(words[B.NODE_STATES.indexOf(st)])); }), `${lang}: every tile's name carries its state's word, so nothing rests on colour`);
    ok(B.NODE_STATES.every(s => html.includes(`data-legend="${s}"`)) && words.every(w => html.includes(esc(w))), `${lang}: the legend names every state in words`);
    ok(/<section[^>]*data-board-group="c1"/.test(html) && /<h3[^>]*>/.test(html) && html.includes('data-group-summary') && /<ul class="sb-tiles">/.test(html), `${lang}: a list grouped by topic, each with a heading and a summary sentence`);
    const open = draw(view.BoardView, { board: inBoard, india: true, track: 'cbse', courseLabel: 'x', initialOpen: 'c1#5' });
    ok(open.includes('data-board-detail="c1#5"') && open.includes(esc(t('board.practiseThis'))) && open.includes(esc(t('board.ev.gapHeld', { kept: 2, n: 2 }))), `${lang}: a node opens its evidence and Practise this`);
    const nsw = draw(view.BoardView, { board: nswBoard, india: false, courseLabel: t('board.courseLabel', { name: 'Mathematics Advanced', version: '2024', year: 2027 }) });
    ok(nsw.includes(esc(t('board.courseLabel', { name: 'Mathematics Advanced', version: '2024', year: 2027 }))), `${lang}: the NSW board names its course and syllabus version`);
    ok(lang !== 'en' || nsw.includes('Mathematics Advanced (2024 syllabus · first HSC 2027)'), 'en: "Mathematics Advanced (2024 syllabus · first HSC 2027)"');
    ok(!/c\d+-[a-z]/.test(nsw.replace(/data-[a-z-]+="[^"]*"/g, '')) && !/MA[VEX]|MST|ME[12]-/.test(html), `${lang}: neither edition's board carries the other's units`);
    const nswOpen = draw(view.BoardView, { board: nswBoard, india: false, courseLabel: 'x', initialOpen: 'MAV-11-02' });
    ok(nswOpen.includes(esc(t('board.nswWording'))) && nswOpen.includes(esc(t('board.priDotpoints'))), `${lang}: an NSW outcome shows Pri's own dot points and says NESA wording is not reproduced`);
    const prio = draw(view.PrioritiesView, { priorities: B.boardPriorities(nswBoard, B.nswAreas(nswBoard, nswExamBlueprint('nsw-hsc-advanced-2027'))), india: false, paperName: t('board.prio.nswPaper', { name: 'Mathematics Advanced' }) });
    ok(/<ol class="sb-prio-list">/.test(prio) && prio.includes('data-board-stake='), `${lang}: priorities are an ordered list with the marks at stake`);
    ok(prio.includes(esc(t('board.prio.sourceNsw'))), `${lang}: the NSW marks say they are Pri's paper design, not NESA's`);
    const few = draw(view.ReadinessView, { readiness: B.paperReadiness([]) });
    ok(few.includes(esc(t('board.ready.sit'))) && !few.includes('data-ready-line'), `${lang}: below two papers it says "Sit a timed paper to see this." and shows none`);
    const ready = draw(view.ReadinessView, { readiness: B.paperReadiness([1, 2, 3].map(d => ({ id: `p${d}`, title: 'P', finishedAt: T0 + d * DAY, score: 60 + d, total: 100, deadlineAt: 1, markedBy: 'server', full: true }))) });
    ok(ready.includes(esc(t('board.ready.last', { count: 3, n: 3, list: '61/100, 62/100, 63/100' }))) && ready.includes(esc(t('board.ready.why'))), `${lang}: the raw results and why practice can't forecast a mark`);
  }
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

// ── 7. The guard: nothing offers a predicted or scaled mark ─────────────────
const BANNED = /predicted (scaled )?mark|scaled mark|predicted score|predicted band|band prediction|\bATAR\b/i;
for (const file of ['src/i18n/strings.en.js', 'src/i18n/strings.hi.js', 'src/i18n/strings.au.js']) {
  const hits = read(file).split('\n').filter(line => /^\s*'[^']+':/.test(line) && BANNED.test(line));
  eq(hits, [], `${file}: no catalogue string offers a predicted or scaled mark, ATAR or band`);
}
const boardSrc = read('src/progress/SyllabusBoard.jsx');
ok(!/predict|scaled|atar/i.test(boardSrc.replace(/^\s*\/\/.*$/gm, '').replace(/'board\.[a-zA-Z.]+'/g, '')), 'the board component computes and draws no prediction');

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
