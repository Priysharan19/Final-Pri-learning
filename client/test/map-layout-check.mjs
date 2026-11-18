// The syllabus map's layered layout and the NSW prerequisite links.
//   node client/test/map-layout-check.mjs
import assert from 'node:assert/strict';
import { CURRICULUM } from '../src/engine/curriculum.js';
import { NSW_PREREQ_EDGES, nswPrerequisitesOf } from '../src/engine/prerequisites-nsw.js';
import { layered, layersOf, overlaps, MAP_W } from '../src/instrument/mapLayout.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

const rows = CURRICULUM.flatMap(y => y.subtopics.map(s => ({ ...s, year: y.year })));
const ids = new Set(rows.map(r => r.id));

check('every NSW prerequisite link names real chapters, never itself', () => {
  for (const [id, pre] of Object.entries(NSW_PREREQ_EDGES)) {
    assert.ok(ids.has(id), `${id} is not a chapter`);
    for (const p of pre) { assert.ok(ids.has(p), `${id} builds on unknown ${p}`); assert.notEqual(p, id); }
  }
});
check('a chapter builds only on an earlier or the same year (no cycle can form)', () => {
  const year = Object.fromEntries(rows.map(r => [r.id, r.year]));
  const pos = Object.fromEntries(rows.map((r, i) => [r.id, i]));
  for (const [id, pre] of Object.entries(NSW_PREREQ_EDGES)) for (const p of pre) assert.ok(year[p] <= year[id] && pos[p] < pos[id], `${id} ← ${p}`);
});
check('every chapter from Year 8 up builds on something, and Year 7 is the floor', () => {
  for (const r of rows) if (r.year >= 8 && r.year <= 12) assert.ok(nswPrerequisitesOf(r.id).length > 0, `${r.id} has no link`);
});

const y12 = CURRICULUM.find(y => y.year === 12).subtopics.map((s, i) => ({ id: s.id, name: s.name, mastery: (i * 7) % 100, strand: s.strand }));
const lay = layered(y12, nswPrerequisitesOf, { width: MAP_W - 352, card: { w: 352, h: 330 }, top: 96 });
check('Year 12 is laid out in prerequisite layers: a chapter sits right of everything it builds on', () => {
  const at = new Map(lay.nodes.map(n => [n.id, n]));
  const inScope = new Set(y12.map(c => c.id));
  assert.equal(at.size, y12.length);
  for (const c of y12) for (const p of nswPrerequisitesOf(c.id).filter(x => inScope.has(x))) assert.ok(at.get(p).x < at.get(c.id).x, `${c.id} is not right of ${p}`);
  assert.ok(lay.layerCount >= 3 && lay.layerCount <= 4, `layers ${lay.layerCount}`);
});
check('chapters are grouped by strand: one lane per strand, in syllabus order', () => {
  assert.deepEqual(lay.lanes.map(l => l.strand), [...new Set(y12.map(c => c.strand))]);
  for (const n of lay.nodes) { const lane = lay.lanes.find(l => l.strand === y12.find(c => c.id === n.id).strand); assert.ok(n.y >= lane.top && n.y <= lane.top + lane.height, n.id); }
});
check('no two nodes or labels overlap, and none sits under the floating card', () => {
  assert.deepEqual(overlaps(lay.nodes.map(n => n.box)), []);
  for (const n of lay.nodes) assert.ok(!(n.box.x2 > MAP_W - 352 && n.box.y1 < 330), `${n.id} is under the card`);
});
check('the layout is deterministic', () => {
  assert.deepEqual(layered(y12, nswPrerequisitesOf, { width: MAP_W - 352, card: { w: 352, h: 330 }, top: 96 }), lay);
});
check('a cycle in authored edges never loops', () => {
  const d = layersOf([{ id: 'a' }, { id: 'b' }], id => (id === 'a' ? ['b'] : ['a']));
  assert.ok(d.get('a') >= 0 && d.get('b') >= 0);
});
check('the three practice sets are named for what they are, and not "Exact Results"', () => {
  const names = new Map(rows.map(r => [r.id, r.name]));
  const EXPECTED = { 'y12-integral-calc': 'Integral Calculus: Practice', 'y12-random-var': 'Random Variables: Practice', 'y12-fin-exact': 'Financial Mathematics: Practice' };
  for (const [id, name] of Object.entries(EXPECTED)) assert.equal(names.get(id), name);
  assert.ok(![...names.values()].some(n => /Answer-Checked/.test(n) && /Integral Calculus|Random Variables|Financial Mathematics/.test(n)));
  assert.ok(![...names.values()].some(n => /Exact Results/.test(n)));
});

if (failures.length) { console.error(failures.join('\n')); console.error(`MAP LAYOUT: FAIL ${failures.length}`); process.exit(1); }
console.log(`MAP LAYOUT: PASS — ${pass} checks`);
