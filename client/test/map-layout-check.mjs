// The syllabus map's layered layout and the NSW prerequisite links.
//   node client/test/map-layout-check.mjs
import assert from 'node:assert/strict';
import { CURRICULUM } from '../src/engine/curriculum.js';
import { NSW_PREREQ_EDGES, nswPrerequisitesOf } from '../src/engine/prerequisites-nsw.js';
import { layered, layersOf, linkFaults, overlaps } from '../src/instrument/mapLayout.js';
import { scopeForYear, PATHWAYS } from '../src/engine/curriculum.js';
import { IN_CHAPTERS, IN_TRACKS } from '../src/engine/curriculum-in-base.js';
import { GLYPHS, iconFor } from '../src/instrument/chapterIcons.js';
import { readFileSync } from 'node:fs';
import { prerequisitesOf, mapStrandOf } from '../src/engine/prerequisites.js';

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
const lay = layered(y12, nswPrerequisitesOf, { width: 900 });
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
check('no two nodes or labels overlap', () => {
  assert.deepEqual(overlaps(lay.nodes.map(n => n.box)), []);
});
check('the layout is deterministic', () => {
  assert.deepEqual(layered(y12, nswPrerequisitesOf, { width: 900 }), lay);
});
check('a cycle in authored edges never loops', () => {
  const d = layersOf([{ id: 'a' }, { id: 'b' }], id => (id === 'a' ? ['b'] : ['a']));
  assert.ok(d.get('a') >= 0 && d.get('b') >= 0);
});
// Every course of both editions: Prithagoras (NSW years 7-12, each senior pathway) and
// Priyabhata (CBSE classes 7-12, each JEE track). A link runs only in horizontal and
// vertical segments, gets a route, and meets no chapter's name or status line, no
// strand heading and no edge of the map, at three drawing widths.
const courses = [];
for (const year of [7, 8, 9, 10, 11, 12]) for (const pathway of year >= 11 ? Object.keys(PATHWAYS) : ['advanced']) {
  const own = scopeForYear(year, pathway).own;
  courses.push([`NSW Year ${year} ${pathway}`, own.map((s, i) => ({ id: s.id, name: s.name, mastery: (i * 13) % 100, strand: s.strand })), nswPrerequisitesOf]);
}
const gradeOf = c => Number(/^c(\d+)-/.exec(c.id)?.[1]);
for (const grade of [7, 8, 9, 10, 11, 12]) {
  const own = IN_CHAPTERS.filter(c => gradeOf(c) === grade);
  if (own.length) courses.push([`India class ${grade}`, own.map((c, i) => ({ id: c.id, name: c.name, mastery: (i * 13) % 100, strand: mapStrandOf(c.id) || 'algebra' })), id => prerequisitesOf(id).map(p => p.id)]);
}
for (const [id, track] of Object.entries(IN_TRACKS)) {
  const own = track.scopeFor(12).map(cid => IN_CHAPTERS.find(c => c.id === cid)).filter(Boolean);
  if (own.length) courses.push([`India ${id}`, own.map((c, i) => ({ id: c.id, name: c.name, mastery: (i * 13) % 100, strand: mapStrandOf(c.id) || 'algebra' })), id2 => prerequisitesOf(id2).map(p => p.id)]);
}
check('the course list covers both editions', () => {
  assert.ok(courses.filter(c => c[0].startsWith('NSW')).length >= 10, 'NSW courses');
  assert.ok(courses.filter(c => c[0].startsWith('India class')).length >= 5, 'India classes');
});
let linksChecked = 0;
for (const [label, chapters, pre] of courses) for (const width of [700, 950, 1200]) {
  check(`${label} at ${width}: no link meets a chapter's name, a heading or the map's edge`, () => {
    const l = layered(chapters, pre, { width });
    assert.deepEqual(overlaps(l.nodes.map(n => n.box)), []);
    assert.deepEqual(linkFaults(l), []);
    linksChecked += l.edges.length;
  });
}
check('the link checks looked at links', () => { assert.ok(linksChecked > 200, `only ${linksChecked} links`); });
check('the link checker can fail: a link drawn through a label is caught', () => {
  const l = layered(y12, nswPrerequisitesOf, { width: 900 });
  const target = l.nodes.find(n => n.id !== l.edges[0].from && n.id !== l.edges[0].to);
  const bad = { ...l, edges: [{ ...l.edges[0], points: [{ x: target.x - 40, y: target.y + target.r + 20 }, { x: target.x + 40, y: target.y + target.r + 20 }] }, ...l.edges.slice(1)] };
  assert.ok(linkFaults(bad).length > 0);
});

// Glyphs: every chapter of every course resolves to a drawn glyph, by its id.
const seen = new Map();
for (const [, chapters] of courses) for (const c of chapters) seen.set(c.id, c.strand);
check('every chapter of every course of both editions has a glyph named by its id', () => {
  assert.ok(seen.size > 200, `${seen.size} chapters`);
  const bad = [];
  for (const [id, strand] of seen) { const g = iconFor(id, strand); if (g.via !== 'id' || !GLYPHS[g.key]?.length) bad.push(`${id} → ${g.key} (${g.via})`); }
  assert.deepEqual(bad, []);
});
check('a chapter no rule names still gets its strand glyph, never none', () => {
  assert.equal(iconFor('zz-new-chapter', 'Calculus').via, 'strand');
  assert.ok(GLYPHS[iconFor('zz-new-chapter', '').key]);
});
check('every glyph is one line family: plain path data, decorative, no colour of its own', () => {
  for (const [key, paths] of Object.entries(GLYPHS)) assert.ok(paths.length >= 1 && paths.every(d => /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/.test(d)), key);
  // The two places a glyph is drawn: both aria-hidden, neither carries a name, colour or text of its own.
  const glyph = readFileSync(new URL('../src/instrument/chapterGlyph.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/instrument/MapPage.jsx', import.meta.url), 'utf8');
  assert.match(glyph, /<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(page, /<g className=\{`in-map-glyph[\s\S]{0,120}aria-hidden="true"/);
  assert.doesNotMatch(glyph, /aria-label|role=|<title|<text|fill="#|stroke="#/);
  assert.match(page, /aria-label=\{`\$\{node\.row\.name\} ·/);   // the node button is still named by the chapter
});
check('the three answer-checked sets are named for what they are, and not "Exact Results"', () => {
  const names = new Map(rows.map(r => [r.id, r.name]));
  for (const id of ['y12-integral-calc', 'y12-random-var', 'y12-fin-exact']) assert.match(names.get(id), / · Answer-Checked Practice$/);
  assert.ok(![...names.values()].some(n => /Exact Results/.test(n)));
});

if (failures.length) { console.error(failures.join('\n')); console.error(`MAP LAYOUT: FAIL ${failures.length}`); process.exit(1); }
console.log(`MAP LAYOUT: PASS — ${pass} checks`);
