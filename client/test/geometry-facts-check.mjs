// Geometry and diagram answers: measurable facts are marked by the engine;
// construction steps go to a person and never earn marks automatically.
// Run: node client/test/geometry-facts-check.mjs   [SYNTHETIC: direct engine]
import { markGeometry, sameLocus, checkGeometry } from '../src/engine/geometryFacts.js';
import { checkAnswer } from '../src/engine/checker.js';
import { markResponse } from '../../server/platform/markerOps.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass += 1; else { fail += 1; console.error('FAIL', label); } };

const GEO = { parts: [
  { id: 'a', kind: 'angle', marks: 1, value: 60 },
  { id: 'b', kind: 'length', marks: 1, value: 5, unit: 'cm' },
  { id: 'c', kind: 'point', marks: 1, x: 2, y: -3 },
  { id: 'd', kind: 'locus', marks: 2, equation: 'x^2+y^2=25' }
] };
const RIGHT = { a: '60°', b: '5 cm', c: '(2, -3)', d: 'x^2 + y^2 = 25' };

// ── Group 1: each kind ──
ok(markGeometry(GEO, RIGHT).awarded === 5, 'all parts right → 5');
ok(markGeometry(GEO, { ...RIGHT, a: '60' }).awarded === 5, 'angle without the degree sign');
ok(markGeometry(GEO, { ...RIGHT, a: 'pi/3' }).parts.a.status === 'not-credited', 'radians for a degree angle: no');
ok(markGeometry(GEO, { ...RIGHT, a: '120' }).parts.a.status === 'not-credited', 'supplement: no');
ok(markGeometry(GEO, { ...RIGHT, a: '60 cm' }).parts.a.marks === 0, 'angle in cm: no');
ok(markGeometry(GEO, { ...RIGHT, b: '5 m' }).parts.b.marks === 0, 'length in the wrong unit: no');
ok(markGeometry(GEO, { ...RIGHT, c: '(-3, 2)' }).parts.c.status === 'not-credited', 'swapped coordinates: no');
ok(markGeometry(GEO, { ...RIGHT, d: '2x^2+2y^2-50=0' }).parts.d.status === 'credited', 'locus times 2, rearranged');
ok(markGeometry(GEO, { ...RIGHT, d: '25 = y^2 + x^2' }).parts.d.status === 'credited', 'locus sides swapped');
ok(markGeometry(GEO, { ...RIGHT, d: 'y = sqrt(25-x^2)' }).parts.d.status === 'not-credited', 'half the circle: no');
ok(markGeometry(GEO, { ...RIGHT, d: 'x^2+y^2=5' }).parts.d.status === 'not-credited', 'radius for r²: no');
ok(markGeometry(GEO, { ...RIGHT, d: '0=0' }).parts.d.status === 'not-credited', '0 = 0: no');
ok(markGeometry(GEO, { ...RIGHT, d: 'x^2+y^2-25' }).parts.d.status === 'invalid', 'no equals sign: unread');
ok(markGeometry(GEO, { ...RIGHT, d: 'x^2+y^2+z^2=25' }).parts.d.status === 'not-credited', 'a third variable: no');
ok(markGeometry(GEO, { ...RIGHT, d: '(x^2+y^2-25)^2=0' }).parts.d.status === 'not-credited', 'squared form is refused (conservative)');
const line = { parts: [{ id: 'l', kind: 'locus', marks: 1, equation: '2x - y + 3 = 0' }] };
ok(markGeometry(line, { l: 'y = 2x + 3' }).awarded === 1, 'line in slope form');
ok(markGeometry(line, { l: 'y = 2x - 3' }).awarded === 0, 'wrong intercept');
ok(markGeometry(line, { l: 'x = (y-3)/2' }).awarded === 1, 'line solved for x');
ok(markGeometry(GEO, {}).awarded === 0 && markGeometry(GEO, {}).parts.a.status === 'unanswered', 'blank parts');
ok(markGeometry(GEO, null).awarded === 0, 'no response');
ok(markGeometry(null, RIGHT).possible === 0, 'no key: nothing to award');

// ── Group 2: construction steps go to a person ──
const CON = { parts: [{ id: 'a', kind: 'angle', marks: 1, value: 90 }, { id: 's', kind: 'construction', marks: 2, describe: 'Construct the perpendicular bisector of AB.' }] };
const con = markGeometry(CON, { a: '90', s: 'With centre A draw an arc more than half AB; repeat from B; join the crossings.' });
ok(con.awarded === 1 && con.parts.s.status === 'needs-review' && con.parts.s.marks === 0 && con.needsReview, 'a perfect construction description earns nothing automatically');
ok(markGeometry(CON, { a: '90' }).parts.s.status === 'unanswered' && !markGeometry(CON, { a: '90' }).needsReview, 'blank construction is unanswered, not review');
ok(markGeometry({ parts: [{ id: 'z', kind: 'similar-triangles', marks: 3 }] }, { z: 'yes' }).parts.z.status === 'needs-review', 'unknown kind → review, never credit');
ok(markGeometry({ parts: [{ id: 'a', kind: 'angle', marks: 1, value: 1 }, { id: 'a', kind: 'angle', marks: 1, value: 1 }] }, { a: '1' }).needsReview, 'duplicate part id → review');

// ── Group 3: practice and examination pipelines ──
const q = { answerType: 'geometry', answer: { geometry: GEO } };
ok(checkAnswer(q, JSON.stringify(RIGHT)).correct === true, 'practice: all right');
ok(checkAnswer(q, JSON.stringify({ ...RIGHT, c: '(2, 3)' })).correct === false, 'practice: one wrong part');
ok(checkAnswer(q, '{nope').invalid === true, 'practice: unreadable');
const cq = { answerType: 'geometry', answer: { geometry: CON } };
const cr = checkAnswer(cq, JSON.stringify({ a: '90', s: 'arcs' }));
ok(cr.correct === false && cr.needsReview === true, 'practice: construction is never right automatically');
ok(checkGeometry(cq, { a: '90' }).correct === false, 'practice: missing construction is not right');
const GRID = { correct: 5, incorrect: 0, unanswered: 0 };
ok(markResponse(q, JSON.stringify(RIGHT), '', GRID).awarded === 5, 'exam: full');
const ep = markResponse(q, JSON.stringify({ a: '60', d: 'x^2+y^2=25' }), 'working', GRID);
ok(ep.awarded === 3 && ep.outcome === 'partial' && !ep.correct, 'exam: parts a and d → 3');
const ec = markResponse(cq, JSON.stringify({ a: '90', s: 'arcs' }), '', { correct: 3 });
ok(ec.awarded === 1 && ec.needsReview && !ec.correct, 'exam: construction earns nothing until reviewed');
ok(markResponse(q, '{bad', '', GRID).awarded === 0, 'exam: unreadable earns nothing');

// ── Group 4: false-positive sweeps ──
// Numbers: every wrong value on a 0.01 grid within ±3 of the key, and the
// classic slips (supplement, complement, reflex, radians), must earn nothing.
let numCases = 0, numFalse = 0;
for (const value of [30, 45, 60, 72, 90, 108, 135]) {
  const g = { parts: [{ id: 'a', kind: 'angle', marks: 1, value }] };
  const wrong = new Set([180 - value, 90 - value, 360 - value, value * Math.PI / 180, value / 2, value * 2]);
  for (let k = -300; k <= 300; k += 1) if (k) wrong.add(Math.round((value + k / 100) * 100) / 100);
  for (const w of wrong) {
    if (Math.abs(w - value) < 1e-12) continue;
    numCases += 1;
    if (markGeometry(g, { a: String(w) }).awarded) { numFalse += 1; console.error('false angle credit', value, w); }
  }
}
for (const value of [3, 5, 7.5, 12, 13]) {
  const g = { parts: [{ id: 'b', kind: 'length', marks: 1, value, unit: 'cm' }] };
  for (let k = -300; k <= 300; k += 1) {
    if (!k) continue;
    const w = Math.round((value + k / 100) * 100) / 100;
    for (const raw of [String(w), `${w} cm`]) { numCases += 1; if (markGeometry(g, { b: raw }).awarded) { numFalse += 1; console.error('false length credit', value, raw); } }
  }
  for (const raw of [`${value} m`, `${value} mm`, `${value * 10} mm`, `${value}²`, `${value} cm²`]) { numCases += 1; if (markGeometry(g, { b: raw }).awarded) { numFalse += 1; console.error('false length credit', value, raw); } }
}
ok(numFalse === 0, `numeric sweep: ${numFalse} false credits in ${numCases}`);
// Loci: every perturbation of every coefficient of a family of conics and
// lines must earn nothing; every non-zero multiple must earn the mark.
const CONICS = [[1, 0, 1, 0, 0, -25], [1, 0, 1, -4, 6, -12], [4, 0, 9, 0, 0, -36], [1, 0, -1, 0, 0, -1], [0, 0, 1, -8, 0, 0], [0, 0, 0, 2, -1, 3], [1, 0, 0, 0, -1, 0], [0, 1, 0, 0, 0, -4]];
const eq = ([a, b, c, d, e, f]) => `${a}*x^2 + ${b}*x*y + ${c}*y^2 + ${d}*x + ${e}*y + ${f} = 0`;
let locCases = 0, locFalse = 0, locMissed = 0;
for (const co of CONICS) {
  const key = eq(co);
  for (const k of [1, -1, 2, -3, 0.5]) { locCases += 1; if (!sameLocus(key, eq(co.map(v => v * k))).ok) { locMissed += 1; console.error('missed multiple', key, k); } }
  for (let i = 0; i < 6; i += 1) for (const dv of [1, -1, 0.5, 2]) {
    const p = [...co]; p[i] += dv;
    locCases += 1;
    if (sameLocus(key, eq(p)).ok) { locFalse += 1; console.error('false locus credit', key, eq(p)); }
  }
}
ok(locFalse === 0 && locMissed === 0, `locus sweep: ${locFalse} false credits, ${locMissed} missed multiples in ${locCases}`);
console.log(`geometry sweep: ${numFalse} false credits in ${numCases} numeric cases; ${locFalse} false credits in ${locCases} locus cases [SYNTHETIC]`);

console.log(`GEOMETRY FACTS: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
