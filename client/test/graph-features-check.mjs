// Graph-sketch marking by feature comparison.
// 1. The engine's derived features agree with features worked out by hand
//    (written here independently, from the algebra, not from the engine).
// 2. False-positive sweep: every feature of every function is perturbed
//    (moved past tolerance, dropped, duplicated, an extra one added, its kind
//    or type flipped); no perturbed feature may earn its mark.
// Run: node client/test/graph-features-check.mjs   [SYNTHETIC: direct engine]
import { checkAnswer } from '../src/engine/checker.js';
import { markResponse } from '../../server/platform/markerOps.js';
import { deriveFeatures, compareFeatures, markGraphSketch, FEATURE_KEYS } from '../src/engine/graphFeatures.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass += 1; else { fail += 1; console.error('FAIL', label); } };
const I = Infinity;
const ALL = Object.fromEntries(FEATURE_KEYS.map(k => [k, 1]));

// ── Hand-worked answers (the student's correct feature sets) ──
const CATALOGUE = [
  ['(x-1)*(x+2)*(x-3)', { intercepts: { x: [-2, 1, 3], y: 6 },
    turning: [{ x: (2 - Math.sqrt(19)) / 3, y: NaN, kind: 'max' }, { x: (2 + Math.sqrt(19)) / 3, y: NaN, kind: 'min' }],
    asymptotes: { vertical: [], horizontal: [], oblique: [] }, symmetry: 'none', discontinuities: [],
    intervals: { increasing: [[-I, (2 - Math.sqrt(19)) / 3], [(2 + Math.sqrt(19)) / 3, I]], decreasing: [[(2 - Math.sqrt(19)) / 3, (2 + Math.sqrt(19)) / 3]] } }],
  ['x^2-4*x+3', { intercepts: { x: [1, 3], y: 3 }, turning: [{ x: 2, y: -1, kind: 'min' }], asymptotes: { vertical: [], horizontal: [], oblique: [] },
    symmetry: 'none', discontinuities: [], intervals: { increasing: [[2, I]], decreasing: [[-I, 2]] } }],
  ['(x-1)^2*(x+2)', { intercepts: { x: [-2, 1], y: 2 }, turning: [{ x: -1, y: 4, kind: 'max' }, { x: 1, y: 0, kind: 'min' }],
    asymptotes: { vertical: [], horizontal: [], oblique: [] }, symmetry: 'none', discontinuities: [], intervals: { increasing: [[-I, -1], [1, I]], decreasing: [[-1, 1]] } }],
  ['x^3', { intercepts: { x: [0], y: 0 }, turning: [], asymptotes: { vertical: [], horizontal: [], oblique: [] }, symmetry: 'odd', discontinuities: [],
    intervals: { increasing: [[-I, I]], decreasing: [] } }],
  ['1/x', { intercepts: { x: [], y: null }, turning: [], asymptotes: { vertical: [0], horizontal: [0], oblique: [] }, symmetry: 'odd', discontinuities: [],
    intervals: { increasing: [], decreasing: [[-I, 0], [0, I]] } }],
  ['1/x^2', { intercepts: { x: [], y: null }, turning: [], asymptotes: { vertical: [0], horizontal: [0], oblique: [] }, symmetry: 'even', discontinuities: [],
    intervals: { increasing: [[-I, 0]], decreasing: [[0, I]] } }],
  ['x/(x^2-4)', { intercepts: { x: [0], y: 0 }, turning: [], asymptotes: { vertical: [-2, 2], horizontal: [0], oblique: [] }, symmetry: 'odd', discontinuities: [],
    intervals: { increasing: [], decreasing: [[-I, -2], [-2, 2], [2, I]] } }],
  ['(2*x+1)/(x-3)', { intercepts: { x: [-0.5], y: -1 / 3 }, turning: [], asymptotes: { vertical: [3], horizontal: [2], oblique: [] }, symmetry: 'none', discontinuities: [],
    intervals: { increasing: [], decreasing: [[-I, 3], [3, I]] } }],
  ['(x^2+1)/x', { intercepts: { x: [], y: null }, turning: [{ x: -1, y: -2, kind: 'max' }, { x: 1, y: 2, kind: 'min' }],
    asymptotes: { vertical: [0], horizontal: [], oblique: [{ m: 1, c: 0 }] }, symmetry: 'odd', discontinuities: [],
    intervals: { increasing: [[-I, -1], [1, I]], decreasing: [[-1, 0], [0, 1]] } }],
  ['(x^2-1)/(x-1)', { intercepts: { x: [-1], y: 1 }, turning: [], asymptotes: { vertical: [], horizontal: [], oblique: [] /* it IS the line y = x + 1, with a hole */ }, symmetry: 'none',
    discontinuities: [1], intervals: { increasing: [[-I, 1], [1, I]], decreasing: [] } }],
  ['x^2/(x^2+1)', { intercepts: { x: [0], y: 0 }, turning: [{ x: 0, y: 0, kind: 'min' }], asymptotes: { vertical: [], horizontal: [1], oblique: [] },
    symmetry: 'even', discontinuities: [], intervals: { increasing: [[0, I]], decreasing: [[-I, 0]] } }],
  ['e^(-x^2)', { intercepts: { x: [], y: 1 }, turning: [{ x: 0, y: 1, kind: 'max' }], asymptotes: { vertical: [], horizontal: [0], oblique: [] },
    symmetry: 'even', discontinuities: [], intervals: { increasing: [[-I, 0]], decreasing: [[0, I]] } }],
  ['2^x', { intercepts: { x: [], y: 1 }, turning: [], asymptotes: { vertical: [], horizontal: [0], oblique: [] }, symmetry: 'none', discontinuities: [],
    intervals: { increasing: [[-I, I]], decreasing: [] } }],
  ['ln(x)', { intercepts: { x: [1], y: null }, turning: [], asymptotes: { vertical: [0], horizontal: [], oblique: [] }, symmetry: 'none', discontinuities: [],
    intervals: { increasing: [[0, I]], decreasing: [] } }],
  ['sqrt(x)', { intercepts: { x: [0], y: 0 }, turning: [], asymptotes: { vertical: [], horizontal: [], oblique: [] }, symmetry: 'none', discontinuities: [],
    intervals: { increasing: [[0, I]], decreasing: [] } }],
  ['sqrt(4-x^2)', { intercepts: { x: [-2, 2], y: 2 }, turning: [{ x: 0, y: 2, kind: 'max' }], asymptotes: { vertical: [], horizontal: [], oblique: [] },
    symmetry: 'even', discontinuities: [], intervals: { increasing: [[-2, 0]], decreasing: [[0, 2]] } }],
  ['abs(x)', { intercepts: { x: [0], y: 0 }, turning: [{ x: 0, y: 0, kind: 'min' }], asymptotes: { vertical: [], horizontal: [], oblique: [] },
    symmetry: 'even', discontinuities: [], intervals: { increasing: [[0, I]], decreasing: [[-I, 0]] } }],
  ['x^4-2*x^2', { intercepts: { x: [-Math.SQRT2, 0, Math.SQRT2], y: 0 }, turning: [{ x: -1, y: -1, kind: 'min' }, { x: 0, y: 0, kind: 'max' }, { x: 1, y: -1, kind: 'min' }],
    asymptotes: { vertical: [], horizontal: [], oblique: [] }, symmetry: 'even', discontinuities: [], intervals: { increasing: [[-1, 0], [1, I]], decreasing: [[-I, -1], [0, 1]] } }],
  ['x*ln(x)', { intercepts: { x: [1], y: null }, turning: [{ x: Math.exp(-1), y: -Math.exp(-1), kind: 'min' }], asymptotes: { vertical: [], horizontal: [], oblique: [] },
    symmetry: 'none', discontinuities: [], intervals: { increasing: [[Math.exp(-1), I]], decreasing: [[0, Math.exp(-1)]] } }]
];
const fx = { '(x-1)*(x+2)*(x-3)': x => (x - 1) * (x + 2) * (x - 3) };
for (const [expr, ans] of CATALOGUE) for (const t of ans.turning) if (Number.isNaN(t.y)) t.y = fx[expr](t.x);

// ── Group 1: derived features agree with the hand-worked ones ──
for (const [expression, answer] of CATALOGUE) {
  const expected = deriveFeatures({ expression });
  ok(expected.review.length === 0, `${expression}: nothing sent to review (${expected.review})`);
  const r = compareFeatures(expected, answer, ALL);
  const missed = Object.entries(r.features).filter(([, f]) => f.status !== 'credited').map(([k]) => k);
  ok(r.awarded === r.possible && r.possible === FEATURE_KEYS.length, `${expression}: hand-worked set earns every mark (missed ${missed})`);
}

// ── Group 2: contract edges ──
const cubic = deriveFeatures({ expression: 'x^2-4*x+3' });
ok(compareFeatures(cubic, {}, ALL).awarded === 0, 'empty set earns nothing');
ok(Object.values(compareFeatures(cubic, {}, ALL).features).every(f => f.status === 'not-supplied'), 'empty set → not-supplied');
ok(compareFeatures(cubic, null, ALL).awarded === 0, 'null set earns nothing');
ok(compareFeatures(cubic, { intercepts: { x: ['1', '3'] } }, { xIntercepts: 2 }).awarded === 2, 'numeric strings read');
ok(compareFeatures(cubic, { intercepts: { x: ['one', 3] } }, { xIntercepts: 2 }).awarded === 0, 'unreadable value earns nothing');
ok(compareFeatures(cubic, { intercepts: { x: [1.08, 2.92] } }, { xIntercepts: 1 }).awarded === 1, 'within tolerance 0.1');
ok(compareFeatures(cubic, { intercepts: { x: [1.2, 3] } }, { xIntercepts: 1 }).awarded === 0, 'past tolerance');
ok(compareFeatures(cubic, { intercepts: { x: [1, 3] } }, { xIntercepts: -5 }).awarded === 0, 'a negative scheme mark never subtracts');
ok(compareFeatures(deriveFeatures({ expression: '1/x' }), { intervals: { increasing: [], decreasing: [['-inf', 0], [0, 'inf']] } }, { intervals: 1 }).awarded === 1, "'-inf'/'inf' read");
ok(compareFeatures(deriveFeatures({ expression: '1/x' }), { intervals: { decreasing: [[-I, I]], increasing: [] } }, { intervals: 1 }).awarded === 0, '1/x "decreasing everywhere" earns nothing');
const tanReview = deriveFeatures({ expression: 'tan(x)', from: -40, to: 40 });
ok(tanReview.review.includes('vertical') && tanReview.review.includes('xIntercepts'), 'too many features in the window → review');
const tr = compareFeatures(tanReview, { asymptotes: { vertical: tanReview.asymptotes.vertical } }, { vertical: 2 });
ok(tr.awarded === 0 && tr.features.vertical.status === 'needs-review' && tr.needsReview, 'needs-review earns nothing even with the right answer');
const bad = markGraphSketch({ expression: 'x+', from: 0, to: 1 }, {}, { xIntercepts: 1, turning: 2 });
ok(bad.awarded === 0 && bad.needsReview && bad.possible === 3, 'unparseable function → review, nothing awarded');
ok(markGraphSketch({ expression: 'x', from: 1, to: 1 }, {}, { xIntercepts: 1 }).needsReview, 'empty window → review');
const near = deriveFeatures({ expression: '(x-0.02)/x' });
ok(near.review.includes('xIntercepts') && near.review.includes('vertical'), 'root on top of an asymptote → review');

// ── Group 2b: the practice box and the examination pipeline ──
const quad = CATALOGUE.find(([e]) => e === 'x^2-4*x+3')[1];
const gq = { answerType: 'graph-sketch', answer: { graph: { spec: { expression: 'x^2-4*x+3' }, scheme: { xIntercepts: 1, yIntercept: 1, turning: 2 } } } };
ok(checkAnswer(gq, JSON.stringify(quad)).correct === true, 'practice: right features → right');
ok(checkAnswer(gq, quad).correct === true, 'practice: object form');
ok(checkAnswer(gq, JSON.stringify({ ...quad, turning: [{ x: 2, y: -1, kind: 'max' }] })).correct === false, 'practice: wrong kind → wrong');
ok(checkAnswer(gq, '{not json').invalid === true, 'practice: unreadable → invalid');
ok(checkAnswer(gq, '[1,2]').invalid === true, 'practice: an array is not a feature set');
ok(checkAnswer(gq, '').correct === false, 'practice: blank');
const tq = { answerType: 'graph-sketch', answer: { graph: { spec: { expression: 'tan(x)', from: -40, to: 40 }, scheme: { vertical: 1 } } } };
const tqr = checkAnswer(tq, JSON.stringify({ asymptotes: { vertical: tanReview.asymptotes.vertical } }));
ok(tqr.correct === false && tqr.needsReview === true, 'practice: review is never right automatically');
const GRID = { correct: 4, incorrect: 0, unanswered: 0 };
const ex = markResponse(gq, JSON.stringify(quad), '', GRID);
ok(ex.awarded === 4 && ex.correct && ex.markingScheme === 'graph-features', 'exam: full');
const exP = markResponse(gq, JSON.stringify({ intercepts: quad.intercepts }), 'working', GRID);
ok(exP.awarded === 2 && !exP.correct && exP.outcome === 'partial', 'exam: intercepts only → 2 of 4');
const exR = markResponse(tq, JSON.stringify({ asymptotes: { vertical: tanReview.asymptotes.vertical } }), '', GRID);
ok(exR.awarded === 0 && exR.needsReview === true && !exR.correct, 'exam: review earns nothing automatically');
ok(markResponse(gq, '{bad', '', GRID).awarded === 0, 'exam: unreadable earns nothing');
ok(markResponse({ answerType: 'graph-sketch', answer: {} }, JSON.stringify(quad), '', GRID).awarded === 0, 'exam: no spec earns nothing');

// ── Group 3: false-positive sweep ──
const clone = v => JSON.parse(JSON.stringify(v, (k, x) => (x === Infinity ? 'inf' : x === -Infinity ? '-inf' : x)));
function perturbations(ans) {
  const out = [];
  const nums = (path, get, set) => {
    const list = get(ans);
    if (!Array.isArray(list)) return;
    list.forEach((v, i) => {
      for (const dx of [0.3, -0.3]) { const a = clone(ans); const l = get(a); l[i] = typeof l[i] === 'number' ? l[i] + dx : l[i]; out.push([path, a]); }
      { const a = clone(ans); get(a).splice(i, 1); out.push([path, a]); }
      { const a = clone(ans); get(a).push(get(a)[i]); out.push([path, a]); }
    });
    for (const extra of [-7.5, 0.5, 6.5]) { const a = clone(ans); get(a).push(extra); out.push([path, a]); }
  };
  nums('xIntercepts', a => a.intercepts.x);
  nums('vertical', a => a.asymptotes.vertical);
  nums('horizontal', a => a.asymptotes.horizontal);
  nums('discontinuities', a => a.discontinuities);
  { const a = clone(ans); a.intercepts.y = ans.intercepts.y === null ? 0 : ans.intercepts.y + 0.5; out.push(['yIntercept', a]); }
  if (ans.intercepts.y !== null) { const a = clone(ans); a.intercepts.y = null; out.push(['yIntercept', a]); }
  ans.turning.forEach((t, i) => {
    for (const mod of [x => { x.x += 0.3; }, x => { x.y += 0.5 + 0.1 * Math.abs(x.y); }, x => { x.kind = x.kind === 'max' ? 'min' : 'max'; }]) {
      const a = clone(ans); mod(a.turning[i]); out.push(['turning', a]);
    }
    { const a = clone(ans); a.turning.splice(i, 1); out.push(['turning', a]); }
  });
  { const a = clone(ans); a.turning.push({ x: 7.25, y: 1, kind: 'max' }); out.push(['turning', a]); }
  ans.asymptotes.oblique.forEach((o, i) => {
    for (const mod of [x => { x.m += 0.5; }, x => { x.c += 0.5; }]) { const a = clone(ans); mod(a.asymptotes.oblique[i]); out.push(['oblique', a]); }
    { const a = clone(ans); a.asymptotes.oblique = []; out.push(['oblique', a]); }
  });
  { const a = clone(ans); a.asymptotes.oblique.push({ m: 2, c: 3 }); out.push(['oblique', a]); }
  for (const s of ['even', 'odd', 'none'].filter(s => s !== ans.symmetry)) { const a = clone(ans); a.symmetry = s; out.push(['symmetry', a]); }
  for (const dir of ['increasing', 'decreasing']) {
    ans.intervals[dir].forEach((iv, i) => {
      for (const end of [0, 1]) if (Number.isFinite(iv[end])) { const a = clone(ans); a.intervals[dir][i][end] += 0.3; out.push(['intervals', a]); }
      { const a = clone(ans); a.intervals[dir].splice(i, 1); out.push(['intervals', a]); }
      { const a = clone(ans); const other = dir === 'increasing' ? 'decreasing' : 'increasing'; a.intervals[other].push(a.intervals[dir].splice(i, 1)[0]); out.push(['intervals', a]); }
    });
  }
  return out;
}
let cases = 0, falseCredit = 0;
for (const [expression, answer] of CATALOGUE) {
  const expected = deriveFeatures({ expression });
  for (const [feature, student] of perturbations(answer)) {
    const r = compareFeatures(expected, student, ALL);
    cases += 1;
    if (r.features[feature].status === 'credited') { falseCredit += 1; console.error('false credit', expression, feature, JSON.stringify(student)); }
  }
}
ok(cases > 600 && falseCredit === 0, `graph sweep: ${falseCredit} false credits in ${cases} perturbed features`);
console.log(`graph-feature sweep: ${falseCredit} false credits in ${cases} perturbed features across ${CATALOGUE.length} functions [SYNTHETIC]`);

console.log(`GRAPH FEATURES: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
