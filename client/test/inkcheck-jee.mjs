// ─────────────────────────────────────────────────────────────────────────────
// JEE / OLYMPIAD-NOTATION suite — the symbols an Indian senior paper is written
// in that the engine had no reading for at all: the factorial '!' (every
// permutations-and-combinations and binomial-theorem answer), '≡' for
// congruence (the working notation of olympiad number theory), and '∞'.
//
// WHY THIS EXISTS: the app was pointed at NCERT Classes 7–12, JEE and the
// olympiad ladder. Three of those chapters' most common written symbols read as
// something else — a factorial came back as 'i' or as a stray '1', a congruence
// as '=' with a loose bar beside it, an infinity as a pair of letters. Nothing
// in the existing suites contains one of them, so nothing measured the gap.
//
// HOW THEY ARE READ: geometrically, with no CNN class, exactly as V15 read the
// integral sign. Growing the class set costs the retrain gate — that is what
// blocked Ink V14 at 58 classes — so a new symbol earns its place only if it
// can be told apart by shape alone. Σ could not, and the comment where it would
// have gone in recognizer.js says what was measured and what would promote it.
//
// HONESTY NOTE (no-fake-100): every shape here is authored directly in this
// file, independently of templates.TEMPLATES — this is a diagnostic of the
// detectors on ink they have not seen, not self-recognition. It is still
// SYNTHETIC ink from ONE authored hand: a pass here is a plumbing guarantee and
// never a product accuracy claim. Real evidence needs the collector.
//
// Usage: node client/test/inkcheck-jee.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize, segment, classify } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const rng = makeRng(20260827);   // fixed seed — deterministic run

/** A closed figure-eight, drawn from the waist outwards the way a hand draws it. */
const lemniscate = (n = 34) => Array.from({ length: n }, (_, i) => {
  const t = Math.PI / 2 + (i / (n - 1)) * 2 * Math.PI;
  return [50 + 46 * Math.cos(t), 50 + 30 * Math.sin(t) * Math.cos(t)];
});

const bar = (y, x1 = 12, x2 = 88) => Array.from({ length: 9 }, (_, i) => [x1 + (x2 - x1) * i / 8, y]);
const blob = (cx, cy, r = 4) => Array.from({ length: 8 }, (_, i) => {
  const a = (i / 7) * 2 * Math.PI;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});

// ── scene-local letterforms (authored here, NOT imported from templates) ─────
const SHAPES = {
  // factorial: a tall stem with the dot UNDER it
  bang: [[[50, 6], [50, 20], [50, 34], [50, 48], [50, 62], [50, 72]], blob(50, 90)],
  // the near miss it must never become: an 'i', whose dot rides ABOVE
  iDot: [[[50, 34], [50, 48], [50, 62], [50, 74]], blob(50, 16)],
  // congruence: three evenly stacked bars
  equiv: [bar(28), bar(50), bar(72)],
  // the near miss: two bars, which is an equals sign and must stay one
  eq: [bar(38), bar(62)],
  // infinity
  inf: [lemniscate()],
  // the near miss: a wide lozenge that closes but never knots
  wideO: [Array.from({ length: 24 }, (_, i) => {
    const a = (i / 23) * 2 * Math.PI;
    return [50 + 46 * Math.cos(a), 50 + 22 * Math.sin(a)];
  })],
  // summation — no detector reads this; see recognizer.js for what was measured
  sigma: [[[92, 4], [70, 5], [48, 6], [26, 7], [8, 8], [22, 22], [36, 36], [50, 50], [36, 64], [22, 78], [8, 92], [28, 93], [50, 94], [72, 95], [92, 96]]]
};

const place = (variant, x, y, s) => variant.map(stroke => ({
  points: stroke.map(([px, py]) => ({ x: x + (px / 100) * s, y: y + (py / 100) * s }))
}));

const styledFrom = (lib, sym, strength, x, y, size) => {
  let variants = lib[sym];
  if (typeof variants[0][0][0] === 'number') variants = [variants];
  const v = variants[Math.floor(rng() * variants.length)].map(st => st.map(p => p.slice()));
  const warped = strength > 0 ? stylize(v, rng, strength) : v;
  return place(warped, x, y, size);
};

// items: [libKey, x, y, size] — '@' prefix comes from SHAPES, else TEMPLATES
function scene(items, strength = 0.35) {
  return items.flatMap(([key, x, y, s]) => key.startsWith('@')
    ? styledFrom(SHAPES, key.slice(1), strength, x, y, s)
    : styledFrom(TEMPLATES, key, strength, x, y, s));
}

let pass = 0, tot = 0, xpass = 0;
const failures = [];
// xfail: a limitation this suite RECORDS rather than hides — the line prints,
// the run stays green, and if the reading ever starts matching, the XPASS line
// demands the expectation be promoted. Never add one without a comment saying
// what evidence would fix it.
const expect = (name, strokes, want, { xfail = false, wantAlso = [] } = {}) => {
  const r = recognize(strokes);
  const got = r.text.replace(/\s+/g, '');
  const wants = [want, ...wantAlso].map(w => w.replace(/\s+/g, ''));
  const ok = wants.includes(got);
  tot++;
  if (ok && !xfail) { pass++; console.log(`PASS ${name} → "${got}"`); }
  else if (ok && xfail) { pass++; xpass++; console.log(`XPASS ${name} → "${got}" — promote this expectation to a hard PASS`); }
  else if (!ok && xfail) { pass++; console.log(`XFAIL ${name} → "${got}" (known gap; wants "${want}")`); }
  else { failures.push(name); console.log(`FAIL ${name} → "${got}" (wanted "${want}")`); }
};

for (const st of [0, 0.3, 0.5]) {
  // ── factorial: the P&C and binomial workhorse ────────────────────────────
  expect(`factorial-n (s=${st})`, scene([
    ['n', 0, 48, 46], ['@bang', 40, 30, 54]
  ], st), 'n!');

  expect(`factorial-value (s=${st})`, scene([
    ['5', 0, 42, 48], ['@bang', 36, 26, 54], ['=', 78, 52, 38],
    ['1', 122, 44, 46], ['2', 150, 44, 46], ['0', 184, 44, 46]
  ], st), '5!=120');

  expect(`factorial-two-digit (s=${st})`, scene([
    ['1', 0, 44, 46], ['0', 28, 44, 46], ['@bang', 66, 28, 54]
  ], st), '10!');

  // ── congruence: olympiad number theory ───────────────────────────────────
  expect(`congruence-simple (s=${st})`, scene([
    ['x', 0, 52, 44], ['@equiv', 36, 40, 52], ['3', 96, 44, 46]
  ], st), 'x≡3');

  expect(`congruence-letters (s=${st})`, scene([
    ['a', 0, 52, 44], ['@equiv', 36, 40, 52], ['b', 96, 50, 44]
  ], st), 'a≡b');

  // ── infinity ─────────────────────────────────────────────────────────────
  expect(`infinity-value (s=${st})`, scene([
    ['n', 0, 50, 46], ['=', 40, 52, 38], ['@inf', 84, 44, 56]
  ], st), 'n=∞');

  // ── Σ : no detector reads this. recognizer.js records the measurement —
  // three guard iterations each left held-out #3 one line short of a floor
  // with no margin, so the detector came out. What promotes this to a hard
  // pass is a discriminator tuned on REAL Σ strokes from the collector, not
  // another guard tuned against synthetic ink.
  expect(`summation (s=${st})`, scene([
    ['@sigma', 0, 30, 66], ['n', 60, 54, 42]
  ], st), 'Σn', { xfail: true });
}

// ── GUARDS: the near misses each detector must refuse ───────────────────────
// Each of these is one warped step away from a symbol above. A detector that
// cannot tell them apart is worse than no detector, because it turns readable
// working into unreadable working.
for (const st of [0, 0.3]) {
  expect(`guard-i-not-bang (s=${st})`, scene([
    ['@iDot', 0, 40, 54], ['+', 44, 54, 38], ['2', 88, 46, 46]
  ], st), 'i+2');

  expect(`guard-eq-not-equiv (s=${st})`, scene([
    ['x', 0, 52, 44], ['@eq', 36, 42, 52], ['3', 96, 44, 46]
  ], st), 'x=3');

  // A decimal point sits a glyph advance to the RIGHT of the digit, on the
  // baseline of the one that follows — never in the digit's own column. That
  // is the whole discriminator factorialRetry leans on, so it is tested.
  expect(`guard-decimal-not-bang (s=${st})`, scene([
    ['1', 0, 44, 46], ['.', 48, 78, 24], ['5', 72, 44, 46]
  ], st), '1.5');
}

// A wide closed lozenge is not an infinity: it closes but never knots.
const single = (key, size = 60) => {
  const groups = segment(styledFrom(SHAPES, key, 0, 0, 0, size));
  if (groups.length !== 1) return `SEGFAIL(${groups.length})`;
  return classify(groups[0], size).sym;
};
for (const [key, forbidden] of [['wideO', '∞'], ['eq', '≡'], ['iDot', '!']]) {
  const got = single(key);
  const ok = got !== forbidden;
  tot++; if (ok) pass++; else failures.push(`guard-single-${key}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} guard single ${key} → ${got} (must not be ${forbidden})`);
}

// And the symbols themselves, in isolation, at four warp strengths — the
// detector rate on authored ink, reported rather than gated, because a rate on
// one authored hand is a plumbing figure and not an accuracy claim.
console.log('');
for (const [key, want] of [['bang', '!'], ['equiv', '≡'], ['inf', '∞'], ['sigma', 'Σ']]) {
  let hit = 0, n = 0;
  for (const st of [0, 0.2, 0.35, 0.5]) {
    for (let k = 0; k < 10; k++) {
      const groups = segment(styledFrom(SHAPES, key, st, 0, 0, 60));
      n++;
      if (groups.length === 1 && classify(groups[0], 60).sym === want) hit++;
    }
  }
    const note = want === 'Σ' ? '  (no detector — expected 0)'
    : want === '!' ? '  (group level only; factorialRetry rejoins the split pair in line context, which is why every factorial scene above passes)'
      : want === '≡' ? '  (group level only; congruenceRetry rejoins a split third bar)' : '';
  console.log(`  detector ${want}  ${hit}/${n} on authored ink across four warp strengths${note}`);
}

console.log(`\nJEE notation: ${pass}/${tot}${xpass ? ` (${xpass} XPASS — promote them)` : ''}`);
console.log('Synthetic ink from one authored hand. Not a product accuracy claim.');
if (failures.length) {
  console.log('failing:', failures.join(', '));
  process.exit(1);
}
