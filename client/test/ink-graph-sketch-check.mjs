// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a sketched graph is read from its strokes, answer-blind
//
// client/src/ink/graphSketch.js, on SYNTHETIC stroke fixtures only (no
// student, device or Pencil evidence): axes and ticks give the scale; the
// curve gives intercepts, turning points and monotone intervals; dashed lines
// give asymptotes; the proposal always needs the student's confirmation; and
// the module never touches a question, an expected answer or a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyStrokes, confirmGraphFeatures, geometryStrokes, labelGroups, parseLines, parsePoints, parseValues, readGraphSketch, showValues, splitSketchRegion, tickValuesFromLabels } from '../src/ink/graphSketch.js';
import { proposeSketch, readSketchLabels } from '../src/ink/graphLabels.js';
import { questionAsksForGraph } from '../src/ink/graphAnswer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── synthetic canvas: origin (300, 300), 40 px per tick ───────────────────────
const O = { x: 300, y: 300 }, U = 40;
const line = (a, b, n = 8) => ({ points: Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n })) });
const axes = () => [line({ x: 60, y: O.y }, { x: 540, y: O.y }), line({ x: O.x, y: 540 }, { x: O.x, y: 60 })];
const ticks = () => [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].flatMap(k => [
  line({ x: O.x + k * U, y: O.y - 5 }, { x: O.x + k * U, y: O.y + 5 }, 2),
  line({ x: O.x - 5, y: O.y - k * U }, { x: O.x + 5, y: O.y - k * U }, 2)
]);
const curve = (f, x0, x1, n = 120, wobble = 0) => ({ points: Array.from({ length: n + 1 }, (_, i) => {
  const x = x0 + (x1 - x0) * i / n;
  return { x: O.x + x * U, y: O.y - f(x) * U + (wobble ? Math.sin(i * 1.7) * wobble : 0) };
}) });
const dashed = (axis, value, from, to) => {
  const out = [];
  for (let t = from; t < to; t += 0.5) out.push(axis === 'x'
    ? line({ x: O.x + value * U, y: O.y - t * U }, { x: O.x + value * U, y: O.y - (t + 0.25) * U }, 2)
    : line({ x: O.x + t * U, y: O.y - value * U }, { x: O.x + (t + 0.25) * U, y: O.y - value * U }, 2));
  return out;
};

// ── the parabola y = (x + 2)(x − 3) / 2 ───────────────────────────────────────
const parab = x => (x + 2) * (x - 3) / 2;
const cls = classifyStrokes([...axes(), ...ticks(), curve(parab, -3, 4)]);
ok(cls.xAxis && cls.yAxis && cls.ticks.length === 20 && cls.curves.length === 1 && cls.dashes.length === 0, 'axes, 20 ticks and one curve are told apart');

const p = readGraphSketch([...axes(), ...ticks(), curve(parab, -3, 4)], { tickValues: { x: 1, y: 1 } });
eq(p.intercepts.x, [-2, 3], 'x-intercepts −2 and 3');
eq(p.intercepts.y, [-3], 'y-intercept −3');
eq(p.turning.map(t => t.kind), ['min'], 'one turning point, a minimum');
ok(Math.abs(p.turning[0].x - 0.5) <= 0.25 && Math.abs(p.turning[0].y + 3.125) <= 0.25, `the minimum is near (0.5, −3.125): ${JSON.stringify(p.turning[0])}`);
eq(p.intervals.map(i => i.direction), ['decreasing', 'increasing'], 'decreasing then increasing');
ok(p.needsConfirmation === true && p.reasons.length === 0, 'a clean sketch with confirmed ticks still needs the student\'s confirmation, with no reasons');

// A hand that wobbles by a few pixels does not invent turning points.
const wob = readGraphSketch([...axes(), ...ticks(), curve(parab, -3, 4, 160, 3)], { tickValues: { x: 1, y: 1 } });
eq(wob.turning.length, 1, 'a wobbly stroke still has one turning point');
eq(wob.intercepts.x, [-2, 3], 'and the same x-intercepts');

// Drawn right to left reads the same.
const rev = curve(parab, -3, 4); rev.points.reverse();
eq(readGraphSketch([...axes(), ...ticks(), rev], { tickValues: { x: 1, y: 1 } }).intercepts.x, [-2, 3], 'a curve drawn right to left reads the same');

// ── a cubic with two turning points ───────────────────────────────────────────
const cubic = x => (x * x * x - 9 * x) / 4;
const c = readGraphSketch([...axes(), ...ticks(), curve(cubic, -4, 4)], { tickValues: { x: 1, y: 1 } });
eq(c.intercepts.x, [-3, 0, 3], 'cubic x-intercepts −3, 0, 3');
eq(c.turning.map(t => t.kind), ['max', 'min'], 'a maximum then a minimum');
eq(c.intervals.map(i => i.direction), ['increasing', 'decreasing', 'increasing'], 'three monotone intervals');

// ── the scale: what a tick is worth ──────────────────────────────────────────
const s = readGraphSketch([...axes(), ...ticks(), curve(parab, -3, 4)], { tickValues: { x: 2, y: 1 } });
eq(s.intercepts.x, [-4, 6], 'with each x tick worth 2 the intercepts double');
const unconfirmed = readGraphSketch([...axes(), ...ticks(), curve(parab, -3, 4)]);
ok(unconfirmed.reasons.some(r => /taken as 1/.test(r)), 'an unconfirmed tick value is said to be taken as 1');
const noTicks = readGraphSketch([...axes(), curve(parab, -3, 4)], { tickValues: { x: 1, y: 1 } });
ok(noTicks.reasons.some(r => /x-axis: its scale is a guess/.test(r)) && noTicks.scale.fromTicks === false, 'no ticks: the scale is said to be a guess');

// ── asymptotes: y = 1/(x − 1) + 2 with dashed x = 1 and y = 2 ─────────────────
const hyp = x => 1 / (x - 1) + 2;
const h = readGraphSketch([...axes(), ...ticks(), curve(hyp, -4, 0.6), curve(hyp, 1.4, 5), ...dashed('x', 1, -4, 5), ...dashed('y', 2, -4, 5)], { tickValues: { x: 1, y: 1 } });
eq(h.asymptotes.slice().sort((a, b) => a.axis.localeCompare(b.axis)), [{ axis: 'x', value: 1 }, { axis: 'y', value: 2 }], 'dashed lines read as x = 1 and y = 2');
eq(h.intercepts.x, [0.5], 'the left branch crosses the x-axis at 0.5');
eq(h.intercepts.y, [1], 'and the y-axis at 1');

// ── labels from the reader are placed on the scale, never interpreted ─────────
const l = readGraphSketch([...axes(), ...ticks(), curve(parab, -3, 4)], { tickValues: { x: 1, y: 1 }, labels: [{ text: 'A', x: O.x + 3 * U, y: O.y }] });
eq(l.labels, [{ text: 'A', x: 3, y: 0 }], 'a label is placed at its graph coordinates');

// ── no axes ───────────────────────────────────────────────────────────────────
const none = readGraphSketch([curve(parab, -3, 4)]);
ok(none.scale === null && none.intercepts.x.length === 0 && /no pair of axes/.test(none.reasons[0]), 'without axes nothing is proposed and the student is told to draw them');

// ── confirmation ──────────────────────────────────────────────────────────────
const conf = confirmGraphFeatures(p, { interceptsX: [-2, 4] });
eq(conf.intercepts, { x: [-2, 4], y: [-3] }, 'the student\'s correction replaces only what they edited');
ok(conf.confirmedByStudent === true, 'the marker receives a confirmed set');
eq(showValues([-2, 3]), '−2, 3', 'values are shown with a true minus');
eq(parseValues('−2, 3'), [-2, 3], 'a typed correction with a true minus parses');
eq(parseValues('-2 3.5'), [-2, 3.5], 'spaces separate too');
eq(parseValues('two'), null, 'words are refused');
eq(parseValues('none'), [], '"none" is an empty list');


// ── a page with written lines AND a graph ─────────────────────────────────────
// Writing sits to the right of the axes box (x > 600); a digit-like squiggle per tick label.
const squiggle = (cx, cy, s = 7) => ({ points: Array.from({ length: 13 }, (_, i) => ({ x: cx + Math.cos(i * 0.9) * s, y: cy + Math.sin(i * 0.9) * s + i * 0.3 })) });
const writingLine = y => ({ points: Array.from({ length: 40 }, (_, i) => ({ x: 640 + i * 6, y: y + Math.sin(i) * 6 })) });
const pageGraph = [...axes(), ...ticks(), curve(parab, -3, 4)];
const tickLabels = [[2, 'x'], [4, 'x'], [2, 'y'], [4, 'y']].map(([k, a]) => (a === 'x' ? squiggle(O.x + k * U, O.y + 18) : squiggle(O.x - 20, O.y - k * U)));
const page = [writingLine(80), ...pageGraph, ...tickLabels, writingLine(160)];
const region = splitSketchRegion(page);
ok(region.writing.length === 2 && region.sketch.length === pageGraph.length + tickLabels.length, `a page splits into 2 written lines and the sketch (${region.writing.length} / ${region.sketch.length})`);
eq(splitSketchRegion([writingLine(80)]).sketch, [], 'a page without axes is all writing');
const groups = labelGroups(region.sketch);
eq(groups.length, 4, 'four label groups are found in the sketch');
eq(geometryStrokes(region.sketch).length, pageGraph.length, 'label writing is kept out of the geometry');
eq(readGraphSketch(region.sketch, { tickValues: { x: 1, y: 1 } }).intercepts.x, [-2, 3], 'the sketch reads the same with its labels on it');

// ── labels: read alone, answer-blind, through the reader ─────────────────────
const sent = [];
const fakeRead = values => async (strokes, opts) => {
  sent.push({ strokes, opts });
  const i = sent.length - 1;
  const v = values[i];
  return v === undefined ? { reason: 'empty' } : { transcription: { lines: [{ text: String(v.text), confidence: v.c ?? 0.95 }] }, readiness: { confidenceFloor: 0.6 } };
};
const order = groups.map(g => (Math.abs(g.y - (O.y + 18)) < 5 ? { a: 'x', k: Math.round((g.x - O.x) / U) } : { a: 'y', k: Math.round((O.y - g.y) / U) }));
const worth = { x: 2, y: 5 };
const read1 = await readSketchLabels(groups, { user: { id: 'u' }, read: fakeRead(order.map(o => ({ text: o.k * worth[o.a] }))) });
ok(read1.labels.length === 4 && read1.unread === 0, 'every label is read');
ok(sent.every(x => Object.keys(x.opts).sort().join() === 'signal,user' && x.strokes.length <= 2), 'each label is sent alone, with only the user and a signal: no question, no answer');
eq(tickValuesFromLabels(region.sketch, read1.labels), { x: 2, y: 5 }, 'the numbers next to ticks say what one tick is worth');
eq(tickValuesFromLabels(region.sketch, read1.labels.slice(0, 1)), { x: null, y: null }, 'one number alone is not enough: ask');
sent.length = 0;
const low = await readSketchLabels(groups, { user: { id: 'u' }, read: fakeRead(order.map(o => ({ text: o.k, c: 0.3 }))) });
ok(low.labels.length === 0 && low.unread === 4, 'labels read below the reader\'s floor are kept as unread');
const refused = await readSketchLabels(groups, { user: { id: 'u' }, read: async () => ({ reason: 'declined' }) });
ok(refused.stopped === 'declined' && refused.unread === 4, 'a declined D17 prompt stops every label read');
sent.length = 0;
const prop = await proposeSketch(region.sketch, { user: { id: 'u' }, read: fakeRead(order.map(o => ({ text: o.k * worth[o.a] }))) });
eq(prop.intercepts.x, [-4, 6], 'the full proposal scales x by the label-read tick value (2)');
ok(prop.scale.tickValue.x === 2 && prop.scale.tickValue.y === 5 && !prop.reasons.some(r => /taken as 1/.test(r)), 'and no longer asks what a tick is worth');
const unreadProp = await proposeSketch(region.sketch, { user: { id: 'u' }, read: async () => ({ reason: 'declined' }) });
ok(unreadProp.reasons.some(r => /not sent to be read/.test(r)) && unreadProp.reasons.some(r => /taken as 1/.test(r)), 'unread labels ask the student instead');

// ── editing turning points and asymptotes ────────────────────────────────────
eq(parsePoints('(0.5, −3), (2,1)'), [{ x: 0.5, y: -3 }, { x: 2, y: 1 }], 'points parse');
eq(parsePoints('(1, 2) junk'), null, 'anything else beside points is refused');
eq(parseLines('x = 1, y = −2'), [{ axis: 'x', value: 1 }, { axis: 'y', value: -2 }], 'asymptote lines parse');
eq(parseLines('z = 3'), null, 'an unknown line is refused');
const conf2 = confirmGraphFeatures(p, { turning: [{ x: 2, y: -3 }], asymptotes: [{ axis: 'x', value: 1 }] });
ok(conf2.turning[0].x === 2 && conf2.asymptotes[0].value === 1, 'turning point and asymptote edits reach the confirmed set');

// ── wiring ───────────────────────────────────────────────────────────────────
const ink = readFileSync(join(ROOT, 'client/src/ink/InkAnswer.jsx'), 'utf8');
ok(/splitSketchRegion\(strokes\)/.test(ink) && /readWithCloud\(lineStrokes/.test(ink) && /proposeSketch\(region\.sketch/.test(ink), 'the ink page reads lines without the sketch, and the sketch as a graph');
ok(/onGraphRef\.current\?\.\(null\)/.test(ink), 'a changed page withdraws what was confirmed');
const card = readFileSync(join(ROOT, 'client/src/components/QuestionCard.jsx'), 'utf8');
ok(/onGraphFeatures=\{setGraphFeatures\}/.test(card) && /graph: graphFeatures \} : \{\}\), scribble/.test(card) && /graph: graphFeatures \} : \{\}\) \}\}/.test(card), 'the question sends the confirmed set with Check and to "What went wrong?"');

// ── only a graph question is read for a sketch (#793 regression) ─────────────
// A single written "4" on a Class 7 "Finding the Unknown" item opened the sketch
// panel and left the server reading stale, so Submit never completed.
ok(!questionAsksForGraph('numeric', 'Find the unknown: x + 9 = 13. What is x?'), 'a numeric Finding-the-Unknown item does not ask for a graph');
ok(!questionAsksForGraph('working', 'Solve x^2 - 5x + 6 = 0.'), 'a solve item does not ask for a graph');
ok(!questionAsksForGraph('numeric', 'The graph shows sales. How many in May?'), 'reading a given graph is not drawing one');
ok(!questionAsksForGraph(undefined, undefined) && !questionAsksForGraph('numeric', ''), 'no prompt, no sketch');
ok(questionAsksForGraph('graph-sketch', 'y = x^2'), 'a graph-sketch item asks for a graph');
ok(questionAsksForGraph('working', 'Sketch the graph of y = x^2 - 4.'), 'a prompt that asks for a sketched graph asks for one');
{
  const ink = readFileSync(join(ROOT, 'client/src/ink/InkAnswer.jsx'), 'utf8');
  ok(/graphAnswer = false/.test(ink), 'InkAnswer reads no sketch unless told the question asks for one');
  ok(ink.includes("(graphAnswer ? loadSketchKit().catch(() => null) : Promise.resolve(null))"), 'the sketch kit loads only for a graph question');
  const card = readFileSync(join(ROOT, 'client/src/components/QuestionCard.jsx'), 'utf8');
  ok(/graphAnswer=\{questionAsksForGraph\(question\.answerType, question\.prompt\)\}/.test(card), 'the card tells InkAnswer whether its question declares a graph answer');
}

// ── answer-blind ──────────────────────────────────────────────────────────────
for (const rel of ['client/src/ink/graphSketch.js', 'client/src/ink/GraphSketchConfirm.jsx', 'client/src/ink/graphLabels.js']) {
  const src = readFileSync(join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(!/\b(answer|expected|solution|mark(s|ing)?|correct)\b/i.test(src.replace(/confirm/gi, '')) && !/import .*(engine|marking|question)/.test(src),
    `${rel} names no answer, expected value, solution or mark and imports no engine`);
}
ok(readGraphSketch.length <= 2, 'the reader takes strokes and reading options only');

if (failures.length) {
  console.error(`GRAPH SKETCH READER: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`GRAPH SKETCH READER: PASS — ${pass}/${pass} checks — synthetic strokes; intercepts, turning points, intervals, asymptotes; always a proposal; answer-blind.`);
