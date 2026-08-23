import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'client', 'test', 'ink-corpus');
const OUT = join(ROOT, 'client', 'public', 'ink-bootstrap-profile.json');

// Only prompts deliberately written as small, left-to-right calibration runs.
// We do NOT pseudo-label arbitrary equations: one bad personal template is
// worse than no personal template because personal evidence outranks stock.
const CALIBRATION = new Map([
  ['1lIy', ['1', 'l', 'I', 'y']],
  ['0Otheta', ['0', 'O', 'theta']],
  ['2z', ['2', 'z']],
  ['5s', ['5', 's']],
  ['6b', ['6', 'b']],
  ['8B3', ['8', 'B', '3']],
  ['9gq4', ['9', 'g', 'q', '4']],
  ['x*4k', ['x', '*', '4', 'k']],
  ['350927', ['3', '5', '0', '9', '2', '7']],
  ['148603', ['1', '4', '8', '6', '0', '3']],
  ['n=48', ['n', '=', '4', '8']],
  ['pi', ['pi']]
]);

function strokeBounds(stroke) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of stroke?.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  return Number.isFinite(x1) ? { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2 } : null;
}

function normalize(strokes) {
  const pts = strokes.flatMap(s => s.points || []);
  if (!pts.length) return [];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const scale = 100 / Math.max(x2 - x1, y2 - y1, 1e-6);
  return strokes.map(s => (s.points || []).map(p => [
    Math.round((p.x - x1) * scale * 10) / 10,
    Math.round((p.y - y1) * scale * 10) / 10
  ])).filter(s => s.length >= 2);
}

function splitIntoGlyphs(strokes, count) {
  const items = strokes.map((stroke, index) => ({ stroke, index, box: strokeBounds(stroke) }))
    .filter(x => x.box && (x.stroke.points?.length || 0) >= 2)
    .sort((a, b) => a.box.cx - b.box.cx);
  if (!items.length || count < 1 || items.length < count) return null;
  if (count === 1) return [items.map(x => x.stroke)];

  // Real calibration prompts contain visible spaces. Pick the N-1 strongest
  // horizontal valleys between stroke groups. Overlapping strokes of one glyph
  // have a negative gap and therefore naturally stay together.
  const gaps = [];
  for (let i = 0; i < items.length - 1; i++) {
    const left = items[i].box;
    const right = items[i + 1].box;
    gaps.push({ i, gap: right.x1 - left.x2 });
  }
  const cuts = gaps.slice().sort((a, b) => b.gap - a.gap).slice(0, count - 1).sort((a, b) => a.i - b.i);
  if (cuts.length !== count - 1) return null;

  const heights = items.map(x => Math.max(x.box.h, x.box.w * 0.5)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 1;
  const weakestBoundary = Math.min(...cuts.map(c => c.gap));
  // A negative/near-zero chosen boundary means the prompt was not actually
  // separable into the requested glyph count; reject rather than mislabel it.
  if (weakestBoundary < 0.06 * medianH) return null;

  const groups = [];
  let start = 0;
  for (const cut of cuts) {
    groups.push(items.slice(start, cut.i + 1).map(x => x.stroke));
    start = cut.i + 1;
  }
  groups.push(items.slice(start).map(x => x.stroke));
  return groups.length === count && groups.every(g => g.length) ? groups : null;
}

if (!existsSync(CORPUS)) {
  console.error('No client/test/ink-corpus directory found.');
  process.exit(1);
}
const files = readdirSync(CORPUS).filter(f => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('No real Pencil corpus JSON found.');
  process.exit(1);
}

const docs = files.map(file => {
  try { return { file, data: JSON.parse(readFileSync(join(CORPUS, file), 'utf8')) }; }
  catch { return null; }
}).filter(Boolean)
  .filter(x => x.data?.format === 'pri-ink-corpus' && Number(x.data?.collector?.version) >= 7 && x.data?.writer?.pen === true);
if (!docs.length) {
  console.error('No valid capture-v7+ Pencil corpus found.');
  process.exit(1);
}

// The bootstrap profile is intentionally ONE writer. Mixing people into a
// personal profile would make it less personal and risks cross-writer leakage.
const writer = docs[0].data.writer.id;
const sessions = docs.filter(x => x.data.writer.id === writer);
const templates = [];
const rejected = [];
const counts = new Map();

for (const { file, data } of sessions) {
  for (const sample of data.samples || []) {
    const labels = CALIBRATION.get(sample.target);
    if (!labels || !Array.isArray(sample.strokes) || !sample.strokes.length) continue;
    const groups = splitIntoGlyphs(sample.strokes, labels.length);
    if (!groups) { rejected.push(`${file}:${sample.target}`); continue; }
    labels.forEach((sym, i) => {
      const strokes = normalize(groups[i]);
      if (!strokes.length) return;
      const used = counts.get(sym) || 0;
      if (used >= 12) return;
      counts.set(sym, used + 1);
      templates.push({ sym, strokes, src: `real-corpus:${writer}` });
    });
  }
}

if (templates.length < 20 || !counts.get('x') || !counts.get('2') || !counts.get('3') || !counts.get('4')) {
  console.error(`Calibration rejected: only ${templates.length} safe templates extracted.`);
  console.error('Need safe real examples for x, 2, 3 and 4 before writing a personal profile.');
  if (rejected.length) console.error(`Rejected ambiguous calibration samples: ${rejected.join(', ')}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
const payload = {
  format: 'pri-ink-personal-bootstrap',
  version: 1,
  writer,
  localOnly: true,
  generatedAt: new Date().toISOString(),
  templates
};
writeFileSync(OUT, JSON.stringify(payload));
console.log(`PRI INK PERSONALIZE — PASS: ${templates.length} real templates from ${writer}`);
console.log([...counts.entries()].sort().map(([s, n]) => `${s}:${n}`).join('  '));
console.log('wrote client/public/ink-bootstrap-profile.json (gitignored; local/iPad only)');
