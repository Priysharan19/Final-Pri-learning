// ─────────────────────────────────────────────────────────────────────────────
// QUESTION-CONTEXT suite — the licence for ctx in recognize().
//
// recognize(strokes, overrides, ctx) may use what the app knows about the
// question it asked: the topic's legal symbol set, the shape of the answer the
// generator produced, and the correct answer itself. That last one is the
// dangerous one. Marking is built on the recognised STRING: equivalence
// marking, misconception tagging and Step Check all read it. If a prior strong
// enough to repair ink is also strong enough to turn a wrong answer into the
// expected one, the app starts telling students they were right when they were
// not — and the misconception that should have been caught is erased on the
// way in. A recogniser that misreads is a bug. A recogniser that agrees with
// whatever answer it was told to expect is a liar.
//
// So this suite renders deliberately WRONG answers — the plausible kind, one
// confusable glyph away from correct, the kind a real student actually writes
// — and recognises each one twice, once bare and once with ctx.expected set to
// the CORRECT answer. Three things must hold of every pair:
//
//   1. the primed reading is never the expected answer unless the bare reading
//      already was;
//   2. the primed reading is never further from what the student actually
//      WROTE — context may make a reading more faithful to the ink and may do
//      nothing else, which is the whole of what it is for;
//   3. the primed reading never drifts toward the expected answer WITHOUT also
//      moving toward the ink. Getting closer to the right answer is fine when
//      it happens because the reading got closer to the truth (the two differ
//      by one glyph, so any repair does both); getting closer to it while
//      moving away from, or no nearer to, what was written is the same lie told
//      one glyph at a time.
//
// It then does the same over correct answers to prove the context never breaks
// a reading that was already right, and reports what it buys: near-ties it
// settles in favour of what the student really wrote.
//
// Usage: node client/test/inkcheck-context.mjs [writers]
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const WRITERS = Number(process.argv[2] || 8);
const rng = makeRng(31415927);   // held out from training, hard, lines and both holdouts

// ── the writer model the holdout suites use: one hand, all the way down ──────
function makeWriter(r) {
  return {
    slant: (r() * 2 - 1) * 0.30,
    aspect: 0.85 + r() * 0.35,
    size: 38 + r() * 16,
    spacing: 0.06 + r() * 0.26,
    wobble: 0.35 + r() * 1.05,
    sizeVar: 0.04 + r() * 0.10
  };
}

function applyHand(strokes, w) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  return strokes.map(st => st.map(([x, y]) => {
    let px = x - cx, py = (y - cy) * w.aspect;
    px += w.slant * py;
    return [px + cx, py + cy];
  }));
}

const place = (variant, x, y, s) => variant.map(stroke => ({
  points: stroke.map(([px, py]) => ({ x: x + (px / 100) * s, y: y + (py / 100) * s }))
}));

function writeLine(syms, w) {
  let x = 0;
  const strokes = [];
  for (const sym of syms) {
    const variants = TEMPLATES[sym];
    if (!variants) throw new Error(`no template for ${sym}`);
    const v = variants[Math.floor(rng() * variants.length)].map(st => st.map(p => p.slice()));
    const warped = applyHand(stylize(v, rng, w.wobble), w);
    const s = w.size * (1 + (rng() * 2 - 1) * w.sizeVar);
    strokes.push(...place(warped, x, 0, s));
    let wid = 0;
    for (const st of warped) for (const p of st) wid = Math.max(wid, p[0]);
    x += (wid / 100) * s + w.spacing * w.size;
  }
  return strokes;
}

const OUT = { pi: 'pi', theta: 'theta', sqrt: 'sqrt', percent: '%', div: '/', pm: '±', deg: '°' };
const asText = syms => syms.map(y => OUT[y] || y).join('');
const read = (strokes, ctx) => recognize(strokes, {}, ctx).text.replace(/\s+/g, '');

const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

// ── the cases ────────────────────────────────────────────────────────────────
// Each is a question whose CORRECT answer is `right` and whose student wrote
// `wrong`. The two differ by one genuinely confusable glyph wherever possible —
// 1/7, 3/8, 5/6, 0/6, 4/9 are the pairs this classifier actually confuses — so
// the beam is at a real near-tie and the prior has every chance to tip it. The
// inverted fraction and the dropped sign are the classic misconceptions: those
// are the readings the tagger must still see.
const CASES = [
  { type: 'integer', alphabet: ['0','1','2','3','4','5','6','7','8','9'],
    right: ['1','8'], wrong: ['1','3'] },
  { type: 'integer', alphabet: ['0','1','2','3','4','5','6','7','8','9'],
    right: ['7','1'], wrong: ['1','1'] },
  { type: 'integer', alphabet: ['0','1','2','3','4','5','6','7','8','9'],
    right: ['4','0'], wrong: ['4','6'] },
  { type: 'integer', alphabet: ['0','1','2','3','4','5','6','7','8','9','-'],
    right: ['-','5'], wrong: ['5'] },
  { type: 'fraction', alphabet: ['0','1','2','3','4','5','6','7','8','9','/'],
    right: ['3','/','4'], wrong: ['3','/','9'] },
  { type: 'fraction', alphabet: ['0','1','2','3','4','5','6','7','8','9','/'],
    right: ['3','/','4'], wrong: ['4','/','3'] },
  { type: 'fraction', alphabet: ['0','1','2','3','4','5','6','7','8','9','/'],
    right: ['5','/','8'], wrong: ['6','/','8'] },
  { type: 'decimal', alphabet: ['0','1','2','3','4','5','6','7','8','9','.'],
    right: ['0','.','7','5'], wrong: ['0','.','1','5'] },
  { type: 'decimal', alphabet: ['0','1','2','3','4','5','6','7','8','9','.'],
    right: ['2','.','5'], wrong: ['2','.','6'] },
  { type: 'ratio', alphabet: ['0','1','2','3','4','5','6','7','8','9',':'],
    right: ['3',':','4'], wrong: ['8',':','4'] },
  { type: 'percent', alphabet: ['0','1','2','3','4','5','6','7','8','9','percent'],
    right: ['2','5','percent'], wrong: ['2','6','percent'] },
  { type: 'expression', alphabet: ['0','1','2','3','4','5','6','7','8','9','x','+','-'],
    right: ['2','x','+','5'], wrong: ['2','x','+','6'] },
  { type: 'expression', alphabet: ['0','1','2','3','4','5','6','7','8','9','n','+','-'],
    right: ['3','n','-','1'], wrong: ['3','n','-','7'] },
  { type: 'equation', alphabet: ['0','1','2','3','4','5','6','7','8','9','x','='],
    right: ['x','=','1','2'], wrong: ['x','=','1','3'] },
  { type: 'equation', alphabet: ['0','1','2','3','4','5','6','7','8','9','y','='],
    right: ['y','=','9'], wrong: ['y','=','4'] },
  { type: 'integer', alphabet: ['0','1','2','3','4','5','6','7','8','9'],
    right: ['1','0','8'], wrong: ['1','0','3'] },
];

let checks = 0, changed = 0, broke = 0, recovered = 0, faithful = 0, misreadRight = 0;
let becameExpected = 0, drewNearer = 0, lessFaithful = 0;
const failures = [];

// Each writer is run twice: once with their own hand, and once with the same
// hand made deliberately unsteady. The steady pass proves the prior leaves
// clear ink alone; the shaky pass is the one that matters, because a prior can
// only ever rewrite an answer where the ink is a near-tie, and that is exactly
// what a bad hand manufactures. A guard measured only on legible writing
// guards nothing.
for (let wi = 0; wi < WRITERS; wi++) {
  const base = makeWriter(rng);
  const hands = [base, { ...base, wobble: Math.max(base.wobble, 1.35), sizeVar: 0.15 }];
  for (const w of hands) for (const c of CASES) {
    const right = asText(c.right);
    const wrong = asText(c.wrong);
    const ctx = { alphabet: c.alphabet, answerType: c.type, expected: right };

    // ① a wrong answer, told the right one. The reading must not budge.
    const ink = writeLine(c.wrong, w);
    const bare = read(ink, null);
    const primed = read(ink, ctx);
    checks++;
    if (bare !== primed) changed++;
    const tag = `w${wi} wrote "${wrong}" (correct "${right}") — bare "${bare}" → primed "${primed}"`;
    const toInk = editDistance(primed, wrong) - editDistance(bare, wrong);
    const toAnswer = editDistance(primed, right) - editDistance(bare, right);
    if (primed === right && bare !== right) {
      becameExpected++;
      if (failures.length < 12) failures.push('READ AS EXPECTED: ' + tag);
    } else if (toAnswer < 0 && toInk >= 0) {
      drewNearer++;
      if (failures.length < 12) failures.push('DREW TOWARD EXPECTED: ' + tag);
    }
    if (toInk > 0) {
      lessFaithful++;
      if (failures.length < 12) failures.push('LESS FAITHFUL TO THE INK: ' + tag);
    } else if (toInk < 0) {
      faithful++;
    }

    // ② the right answer. Context must never break a reading that was correct,
    //    and any reading it repairs is what the feature is for.
    const ink2 = writeLine(c.right, w);
    const bare2 = read(ink2, null);
    const primed2 = read(ink2, ctx);
    checks++;
    if (bare2 !== right) misreadRight++;
    if (bare2 === right && primed2 !== right) {
      broke++;
      if (failures.length < 12) {
        failures.push(`w${wi} wrote "${right}" correctly — context broke it to "${primed2}"`);
      }
    }
    if (bare2 !== right && primed2 === right) recovered++;
  }
}

// ── ③ ctx is optional: every existing caller must behave identically ─────────
let inertFails = 0;
{
  const w = makeWriter(rng);
  for (const c of CASES.slice(0, 8)) {
    const ink = writeLine(c.wrong, w);
    const a = recognize(ink);
    const b = recognize(ink, {});
    const d = recognize(ink, {}, null);
    const e = recognize(ink, {}, {});
    if (!(a.text === b.text && a.text === d.text && a.text === e.text)) {
      inertFails++;
      failures.push(`ctx-optional drift: "${a.text}" / "${b.text}" / "${d.text}" / "${e.text}"`);
    }
  }
}

// ── ④ the confidence contract the marking gate consumes ─────────────────────
let apiFails = 0;
{
  const w = makeWriter(rng);
  const r = recognize(writeLine(CASES[0].right, w));
  const num01 = v => typeof v === 'number' && v >= 0 && v <= 1;
  if (!num01(r.minConf)) { apiFails++; failures.push(`minConf not 0..1: ${r.minConf}`); }
  if (!num01(r.margin)) { apiFails++; failures.push(`margin not 0..1: ${r.margin}`); }
  if (r.weakest === null || typeof r.weakest !== 'object') {
    apiFails++; failures.push('weakest missing on a non-empty reading');
  } else {
    const k = r.weakest;
    if (typeof k.index !== 'number' || typeof k.sym !== 'string' ||
        !num01(k.conf) || !Array.isArray(k.alts)) {
      apiFails++; failures.push(`weakest malformed: ${JSON.stringify(k)}`);
    }
    const all = r.lines.flatMap(l => l.symbols);
    if (all.length && Math.min(...all.map(s => s.conf)) !== r.minConf) {
      apiFails++; failures.push('minConf is not the minimum per-glyph confidence');
    }
    if (k.conf !== r.minConf) { apiFails++; failures.push('weakest is not the least-confident glyph'); }
  }
  const empty = recognize([]);
  if (empty.weakest !== null || !num01(empty.minConf) || !num01(empty.margin)) {
    apiFails++; failures.push('empty page does not report the confidence fields');
  }
  // the shapes every existing consumer already depends on
  if (!Array.isArray(r.lines) || !Array.isArray(r.symbols) || typeof r.text !== 'string') {
    apiFails++; failures.push('recognize() dropped one of lines/symbols/text');
  }
}

console.log('\nQuestion-context guard — a wrong answer must read as the wrong answer\n');
console.log(`  wrong answers rewritten as the expected one   ${becameExpected}`);
console.log(`  wrong answers drawn nearer the expected one   ${drewNearer}`);
console.log(`  readings made less faithful to the ink        ${lessFaithful}`);
console.log(`  correct readings broken by ctx                ${broke}`);
console.log(`  ctx-is-optional drift                        ${inertFails}`);
console.log(`  confidence-contract violations               ${apiFails}`);
console.log(`\n  wrong-answer readings ctx left alone          ${checks / 2 - changed}/${checks / 2}`);
console.log(`  wrong answers read MORE faithfully with ctx   ${faithful}`);
console.log(`  misread correct answers ctx recovered         ${recovered}/${misreadRight}`);

if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  ' + f);
}

const ok = becameExpected === 0 && drewNearer === 0 && lessFaithful === 0 &&
  broke === 0 && inertFails === 0 && apiFails === 0;
console.log(`\n${ok ? '✔ CONTEXT SUITE PASSED' : '✖ CONTEXT SUITE FAILED'} — ` +
  `${becameExpected + drewNearer} wrong answers pulled toward the expected one, ` +
  `${broke} correct readings broken, ${recovered + faithful} readings repaired`);
process.exit(ok ? 0 : 1);
