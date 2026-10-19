// #408: the 20 JEE Advanced Complex Numbers forms meet the D4 structural rubric,
// and the 8 worked examples are re-derived here by complex arithmetic.
// Nothing here is a human review; the check fails if any record claims one.
import assert from 'node:assert/strict';
import { JEE_2026_COMPLEX_ORIGINAL_BLIND as pack } from '../src/engine/ncert/jee-2026-complex-original-blind.js';
import { JEE_ADV_COMPLEX_D4_CERTIFICATION as cert, JEE_ADV_COMPLEX_WORKED_EXAMPLES as worked, JEE_ADV_COMPLEX_SYLLABUS_ITEMS as items, D4_DEMANDS } from '../src/engine/ncert/jee-2026-complex-d4-certification.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const C = (a, b) => [a, b], add = (p, q) => [p[0] + q[0], p[1] + q[1]], sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]], abs = p => Math.hypot(p[0], p[1]);
const div = (p, q) => { const d = q[0] ** 2 + q[1] ** 2; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
const pow = (p, k) => { let r = C(1, 0); for (let i = 0; i < k; i++) r = mul(r, p); return r; };
const near = (p, q, e = 1e-9) => abs(sub(p, q)) < e;

// Honesty of the certification record.
ok(cert.certifiedDifficulty === 'D4' && cert.certificationBasis === 'automated-structural-rubric', 'basis stated');
ok(cert.humanMathsReview === 'pending' && cert.rightsReview === 'pending' && cert.independentExaminerCertified === false, 'no claimed review');
ok(cert.liveGraded === false && cert.studentVisible === false, 'not live');
ok(!('reviewedBy' in cert) && cert.forms.every(f => !('reviewedBy' in f)), 'no reviewer named');
ok(/jeeadv\.ac\.in/.test(cert.source.url), 'official syllabus source');

// Rubric: every pack question certified once; ≥2 syllabus items, ≥2 demands, distinct archetypes.
const byId = new Map(pack.questions.map(q => [q.id, q]));
ok(cert.forms.length === 20 && new Set(cert.forms.map(f => f.id)).size === 20, '20 distinct forms');
const archetypes = new Set();
for (const f of cert.forms) {
  const q = byId.get(f.id); ok(q, f.id + ' exists in the public pack');
  ok(new Set(f.syllabus).size >= 2 && f.syllabus.every(s => s in items), f.id + ' combines ≥2 syllabus items');
  ok(new Set(f.demands).size >= 2 && f.demands.every(d => D4_DEMANDS.includes(d)), f.id + ' ≥2 reasoning demands');
  ok(!archetypes.has(q.archetypeId), f.id + ' distinct archetype'); archetypes.add(q.archetypeId);
  // Demands must be visible in the prompt wording, not just asserted.
  const t = q.question.toLowerCase();
  const cue = { proof: /prove|show|explain|why/, converse: /converse/, 'equality-cases': /equality/, 'full-range': /range|principal/, 'geometric-justification': /geometric|describe|sketch/, 'complete-solution-set': /all|every|solve|find all|exactly/, classification: /locus|classify|describe/, 'extremum-with-attainment': /min|max/ };
  ok(f.demands.some(d => cue[d].test(t)), f.id + ' prompt shows a declared demand');
  // The seed-56 owner case (direct principal argument of a single number) can never be a D4 form.
  ok(!/^find the principal argument of z\s*=/.test(t), f.id + ' is not a direct principal-argument item');
}

// Worked examples: distinct from the 20 forms, ≥3 steps, and re-derived numerically.
ok(worked.length === 8 && new Set(worked.map(w => w.archetypeId)).size === 8, '8 distinct worked archetypes');
for (const w of worked) {
  ok(!archetypes.has(w.archetypeId), w.id + ' does not reuse a form archetype');
  ok(w.steps.length >= 3 && w.steps.every(s => s.length > 20), w.id + ' worked steps');
  ok(w.syllabus.every(s => s in items), w.id + ' syllabus items');
  const k = w.check;
  if (k.kind === 'square-roots') { for (const r of k.roots) ok(near(mul(r, r), k.of), w.id + ' root squares back'); ok(k.roots.length === 2 && !near(k.roots[0], k.roots[1]), w.id + ' two roots'); }
  if (k.kind === 'triangle-area') { const z = C(3, 4), iz = mul(C(0, 1), z); ok(near(k.vertices[1], iz) && near(k.vertices[2], add(z, iz)), w.id + ' vertices'); const [a, b, c] = k.vertices; ok(Math.abs(Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2 - k.area) < 1e-9, w.id + ' area'); }
  if (k.kind === 'power-sum') { ok(near(add(k.u, k.v), C(1, 0)) && Math.abs(abs(k.u) - 1) < 1e-12, w.id + ' hypotheses'); const s = add(pow(k.u, k.n % 6), pow(k.v, k.n % 6)); ok(near(pow(k.u, 6), C(1, 0)) && near(s, k.value), w.id + ' value'); }
  if (k.kind === 'omega-expression') for (const s of [1, -1]) { const om = C(-0.5, s * Math.sqrt(3) / 2); ok(near(add(pow(add(C(1, 0), om), 6), pow(add(C(1, 0), mul(om, om)), 6)), k.value, 1e-9), w.id + ' value for ω'); }
  if (k.kind === 'square') { const v = k.vertices; for (let i = 0; i < 4; i++) { const e1 = sub(v[(i + 1) % 4], v[i]), e2 = sub(v[(i + 2) % 4], v[(i + 1) % 4]); ok(near(mul(C(0, 1), e1), e2), w.id + ' side ' + i + ' turns anticlockwise'); } }
  if (k.kind === 'circle-extremes') { for (const [m, z] of [k.max, k.min]) { ok(Math.abs(abs(sub(z, k.centre)) - k.radius) < 1e-9 && Math.abs(abs(z) - m) < 1e-9, w.id + ' attained'); } for (let t = 0; t < 360; t++) { const z = add(k.centre, [k.radius * Math.cos(t * Math.PI / 180), k.radius * Math.sin(t * Math.PI / 180)]); ok(abs(z) <= k.max[0] + 1e-9 && abs(z) >= k.min[0] - 1e-9, w.id + ' bound at ' + t); } }
  if (k.kind === 'solution-count') { const sols = [C(0, 0)]; for (let j = 0; j < 6; j++) sols.push([Math.cos(j * Math.PI / 3), Math.sin(j * Math.PI / 3)]); for (const z of sols) ok(near(pow(z, k.power), [z[0], -z[1]]), w.id + ' solution'); ok(sols.length === k.count, w.id + ' count'); }
  if (k.kind === 'real-ratio-line') { for (let x = -5; x <= 5; x += 0.5) { if (Math.abs(x + 2) < 1e-12) continue; const z = C(x, x + 2); ok(Math.abs(div(sub(z, k.a), sub(z, k.b))[1]) < 1e-9, w.id + ' on-line real at ' + x); const off = C(x, x + 3); ok(Math.abs(div(sub(off, k.a), sub(off, k.b))[1]) > 1e-6, w.id + ' off-line not real at ' + x); } }
}

console.log(`JEE COMPLEX D4: PASS — ${n}/${n} checks — 20 forms meet the automated D4 rubric, 8 worked examples re-derived; human maths review and rights pending`);
