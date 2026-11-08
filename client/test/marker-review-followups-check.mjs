// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the follow-ups from the independent R4 review of #723
//
// Pre-existing or latent marking defects the review listed for the policies
// train (PR #723 comment 6721703073, "Can follow in task/l1-marking-policies").
// Each case failed before this repair. SYNTHETIC: the checker, in-process.
//
//   2  set, point and surd-form answers skipped the numeric box's percent,
//      unit and currency guards: "200%, -800%", "2 kg, -8 kg" and
//      "(2 kg, -5 kg)" were credited (D13 stays the numeric box's rule);
//   3  "Simplify 6 : 18" credited 0.2 : 0.6;
//   4  the exact evaluator's floating-point fallback re-credited a pinned
//      refusal (3840000000000+10^-65*10^62);
//   5  interval endpoints: an authored 1/3 or √2 refused its exact answer,
//      an exact key against an evaluated float was compared bit for bit,
//      an endpoint outside the radical grammar (2/√2 + 10⁻¹⁵) fell back to
//      floats, an intersection depended on the order it was written in, and
//      bound text skipped the number guards ("x > 1 2", "x > 1200%");
//   6  √0 was read as a non-zero radical (x >= sqrt(0) refused for x >= 0).
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { exactRadical, sameRadical, compareRadical, rationalAsRadical, exactValue } = await import(`${SRC}engine/exact.js`);
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();

const groups = {};
const failures = [];
function check(group, cond, label) {
  groups[group] ??= { pass: 0, total: 0 };
  groups[group].total++;
  if (cond) groups[group].pass++; else failures.push(`${group} · ${label}`);
}
const verdict = (q, input) => { try { return checkAnswer(q, input); } catch (e) { return { correct: false, threw: e.message }; } };
const state = r => (r.correct === true ? 'correct' : r.invalid ? 'unread' : 'wrong');
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));

// ── 2 · set, point and surd values are held to the numeric box ──────────────
{
  const G = 'components';
  const roots = generateQuestion('y10-quadratics', 1, 1);       // Solve (x − 2)(x + 8) = 0
  for (const input of ['2, -8', 'x = 2, x = -8', '{-8, 2}']) check(G, verdict(roots, input).correct === true, `roots: "${input}" is credited`);
  for (const input of ['200%, -800%', '2 kg, -8 kg', '2 cm, -8 cm', '₹2, -8', '$2, -8']) {
    const r = verdict(roots, input);
    check(G, r.correct === false && r.invalid === true, `roots: "${input}" is left unread, never credited (got ${state(r)})`);
  }
  const pair = generateQuestion('y10-simeq', 1, 1);              // (2, −5)
  const [x, y] = [pair.answer.x, pair.answer.y];
  check(G, verdict(pair, `(${x}, ${y})`).correct === true, 'point: the pair is credited');
  for (const input of [`(${x} kg, ${y} kg)`, `(${x}%, ${y})`, `(₹${x}, ${y})`]) {
    const r = verdict(pair, input);
    check(G, r.correct === false && r.invalid === true, `point: "${input}" is left unread, never credited (got ${state(r)})`);
  }
  const surd = generateQuestion('y10-surds', 1, 1);              // √50 = 5√2
  const k = `${surd.answer.surdForm.k}sqrt(${surd.answer.surdForm.r})`;
  check(G, verdict(surd, k).correct === true, 'surd form: k√r is credited');
  for (const input of [`${k} kg`, `${k}%`, `₹${k}`]) check(G, verdict(surd, input).correct !== true, `surd form: "${input}" is not credited`);
  // Every set and point question: the key with a % or a unit on each value is never credited.
  let seen = 0;
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (let s = 1; s <= 3; s++) {
    let q; try { q = generateQuestion(id, d, s * 53 + d); } catch { continue; }
    if (q?.answerType === 'set' && Array.isArray(q.answer?.values) && q.answer.values.every(Number.isFinite)) {
      seen++;
      for (const tail of ['%', ' kg']) check(G, verdict(q, q.answer.values.map(v => fmt(v) + tail).join(', ')).correct !== true, `${id} d${d}: the set key with "${tail.trim()}" on each value is not credited`);
    } else if (q?.answerType === 'point' && Number.isFinite(q.answer?.x) && Number.isFinite(q.answer?.y)) {
      seen++;
      for (const tail of ['%', ' kg']) check(G, verdict(q, `(${fmt(q.answer.x)}${tail}, ${fmt(q.answer.y)}${tail})`).correct !== true, `${id} d${d}: the point key with "${tail.trim()}" on each value is not credited`);
    }
  }
  check(G, seen >= 40, `the sweep reached the set and point questions (${seen})`);
}

// ── 3 · a simplified ratio is two whole numbers ─────────────────────────────
{
  const G = 'ratio';
  const q = generateQuestion('y7-ratio', 1, 1);                   // Simplify 6 : 18
  for (const input of ['1:3', '1 : 3', '1 to 3']) check(G, verdict(q, input).correct === true, `"${input}" is credited`);
  for (const input of ['0.2:0.6', '0.5:1.5', '2:6', '10:30', '3:1']) check(G, verdict(q, input).correct === false, `"${input}" is not the simplified ratio`);
  const plain = { answerType: 'ratio', answer: { a: 1, b: 2, simplified: false } };
  check(G, verdict(plain, '0.5:1').correct === true, 'where simplest form is not asked, an equal decimal ratio still passes');
}

// ── 4 · the exact evaluator's fallback cannot re-credit a pinned refusal ────
{
  const G = 'exact-fallback';
  const q = generateQuestion('c8-exponents-ncert-mastery', 4, 1);
  check(G, verdict(q, '3840000000000+10^-65*10^62').correct !== true, 'a value beyond exact arithmetic, written as a sum, is not credited (D13 refuses it unevaluated)');
  check(G, verdict(q, String(q.answer.value)).correct === true, 'the key itself is credited');
}

// ── 5 · interval endpoints ──────────────────────────────────────────────────
{
  const G = 'interval';
  const iv = region => ({ answerType: 'interval', answer: { region, variable: 'x' } });
  const auth = (lo, hi = null) => ({ answerType: 'interval', prompt: 'Solve.', answer: { intervals: [{ lo, hi, loOpen: true, hiOpen: true }], variable: 'x' } });
  const cases = [
    [auth(1 / 3), ['x > 1/3', '(1/3, inf)'], ['x > 0.333', 'x > 0.34']],
    [auth(-Math.SQRT2, Math.SQRT2), ['-sqrt(2) < x < sqrt(2)', '(-√2, √2)'], ['-1.414 < x < 1.414']],
    [auth(0.5), ['x > 1/2', 'x > 0.5'], ['x > 0.5000000000000001']],
    [iv('x > 1/2'), ['x > sin(pi/6)', 'x > 0.5'], ['x > 0.5000000000000001', 'x > 0.51']],
    [iv('x > sqrt(2)'), ['x > 2/sqrt(2)', 'x > sqrt(8)/2', 'x > sqrt(2) and x > 1.4142135623730950', 'x > 1.4142135623730950 and x > sqrt(2)'],
      ['x > 2/sqrt(2)+0.000000000000001', 'x > sqrt(2)+0.000000000000001', 'x > 1.4142135623730951',
        'x > sqrt(2) and x > 1.4142135623730951', 'x > 1.4142135623730951 and x > sqrt(2)']],
    [iv('x >= 0'), ['x >= sqrt(0)', 'x >= 0', '[0, inf)'], ['x > 0']]
  ];
  for (const [q, credited, refused] of cases) {
    for (const input of credited) check(G, verdict(q, input).correct === true, `"${input}" is credited`);
    for (const input of refused) check(G, verdict(q, input).correct !== true, `"${input}" is not credited`);
  }
  for (const input of ['x > 1 2', 'x > 1,2', 'x > 1200%']) {
    const r = verdict(iv('x > 12'), input);
    check(G, r.correct === false && r.invalid === true, `"${input}" is one bound written wrongly, left unread (got ${state(r)})`);
  }
  check(G, verdict(iv('x > 10.5'), 'x > 2 1/2').correct !== true, '"x > 2 1/2" is not read as x > 21/2');
  // The exact comparators behind them.
  const R = t => exactRadical(t);
  check(G, R('sqrt(0)')?.size === 0, '√0 is zero, not a radical');
  check(G, sameRadical(R('2/sqrt(2)'), R('sqrt(2)')) && sameRadical(R('sqrt(2)*sqrt(8)'), R('4')), '2/√2 is √2 and √2·√8 is 4, exactly');
  check(G, compareRadical(R('sqrt(2)'), rationalAsRadical(exactValue('1.4142135623730951'))) === -1, '√2 is below 1.4142135623730951, exactly');
  check(G, compareRadical(R('1+sqrt(3)'), rationalAsRadical(exactValue('2.7320508075688772'))) === 1, '1 + √3 is above 2.7320508075688772, exactly');
}

const pass = Object.values(groups).reduce((n, g) => n + g.pass, 0);
const total = Object.values(groups).reduce((n, g) => n + g.total, 0);
const summary = Object.entries(groups).map(([g, x]) => `${g} ${x.pass}/${x.total}`).join(' · ');
console.log(failures.length
  ? `REVIEW FOLLOW-UPS: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 30).join('\n  · ')}`
  : `REVIEW FOLLOW-UPS: PASS — ${pass}/${total} checks — ${summary}. [SYNTHETIC: direct checker]`);
if (failures.length) process.exitCode = 1;
