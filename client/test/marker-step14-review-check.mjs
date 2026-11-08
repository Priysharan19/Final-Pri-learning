// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the independent R4 review of #723 (Step 14), pinned
//
// The review at f4fd06987 (PR #723 comment 6721703073) found four regressions
// in the new rupee, unit and label rules. Every case here failed at f4fd06987
// and passes with the repair. SYNTHETIC: the checker, in-process, on generated
// questions.
//
//   P1  a ₹ or Rs mark before the right amount, on a box that counts rupees in
//       crores, lakhs or millions, was marked wrong (a try spent);
//   P2  with no unit beside the box, a written unit was credited when the
//       prompt mentioned it anywhere or it was a generic "units" — never by
//       dimension ("24 square units" for a length, "147 litres" for a price,
//       "6 g" for g(3));
//   P3  the subject of a model formula ("h = 13 + 3.5w") was read as a given,
//       so the correctly labelled prediction was refused;
//   P4  "Profit % = 20" went from unread to marked wrong.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
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

// ── P1 · a rupee mark on a rupee-scale box ──────────────────────────────────
{
  const G = 'p1-rupee-scale';
  for (const [d, s] of [[3, 1], [1, 2]]) {
    const q = generateQuestion('c7-place-value-systems-reasoning', d, s);
    const k = fmt(q.answer.value);
    for (const input of [k, `₹${k}`, `₹ ${k}`, `Rs ${k}`, `Rs. ${k}`]) check(G, verdict(q, input).correct === true, `d${d} s${s} (box "${q.answerSuffix}"): "${input}" is the amount, and correct`);
    check(G, verdict(q, `₹${fmt(q.answer.value + 1)}`).correct === false, `d${d} s${s}: a rupee mark does not make a wrong amount right`);
    // The box's own word written out is the box's unit (the correct-answer sweep);
    // a unit the box is not, beside a word that is no unit, is a different quantity.
    check(G, verdict(q, `₹${k} ${q.answerSuffix}`).correct === true, `d${d} s${s}: "₹${k} ${q.answerSuffix}" — the box's word written out — is correct`);
    check(G, verdict(q, `${k} kg`).correct === false, `d${d} s${s}: "${k} kg" beside "${q.answerSuffix}" is not the amount`);
  }
  // Every rupee-scale box the banks serve, at D1–D3.
  let seen = 0;
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3]) for (let s = 1; s <= 40; s++) {
    let q; try { q = generateQuestion(id, d, s); } catch { break; }
    if (q?.answerType !== 'numeric' || !/^(?:crores?|lakhs?|millions?|billions?|thousands?)$/i.test(String(q.answerSuffix || '').trim()) || !/₹|\bRs\b|rupee/i.test(q.prompt)) continue;
    seen++;
    check(G, verdict(q, `₹${fmt(q.answer.value)}`).correct === true && verdict(q, `Rs ${fmt(q.answer.value)}`).correct === true, `${id} d${d} s${s}: ₹/Rs before the right amount is credited`);
  }
  check(G, seen >= 20, `the sweep reached the rupee-scale boxes (${seen})`);
}

// ── P1b · ₹ on a count is a wrong unit (the correct-answer sweep's audit) ───
{
  const G = 'p1-rupee-count';
  let seen = 0;
  for (const [id, d] of [['c7-equation-context-reasoning', 3], ['c7-formula-evaluation-reasoning', 3]]) for (let s = 1; s <= 40; s++) {
    const q = generateQuestion(id, d, s);
    if (q.answerType !== 'numeric' || q.answerSuffix || !/₹|\bRs\b|rupee/i.test(q.prompt)) continue;
    const ask = String(q.prompt).replace(/\$/g, ' ').split(/(?<=[.?!])\s+/).pop();
    if (!/\bhow many\b|\bnumber of\b/i.test(ask)) continue;
    seen++;
    const k = fmt(q.answer.value);
    check(G, verdict(q, k).correct === true, `${id} d${d} s${s}: the count ${k} is correct`);
    check(G, verdict(q, `₹${k}`).correct !== true && verdict(q, `Rs ${k}`).correct !== true, `${id} d${d} s${s}: "₹${k}" on "${ask.slice(0, 50)}" is not the count`);
  }
  check(G, seen >= 10, `the sweep reached the counts asked in rupee-priced questions (${seen})`);
  const notes = { answerType: 'numeric', answer: { value: 500 }, prompt: 'Uday saves ₹50 a week. How many rupees does he save in 10 weeks?' };
  check(G, verdict(notes, '₹500').correct === true, '"How many rupees …" asks for money: ₹500 is correct');
}

// ── P2 · a written unit is credited only in the asked dimension ─────────────
{
  const G = 'p2-unit-dimension';
  const cases = [
    // [question, credited, unread]
    [{ answerType: 'numeric', answer: { value: 24 }, prompt: 'Find the length of the latus rectum of the parabola $y^2 = 24x$.' },
      ['24', '24 units'], ['24 square units', '24 cubic units', '24 units^3', '24 kg', '24 cm']],
    [{ answerType: 'numeric', answer: { value: 24 }, prompt: 'A rectangle is 8 cm by 4 cm. Find its perimeter.' },
      ['24', '24 cm', '24 centimetres'], ['24 cm²', '24 m', '24 kg', '24 square units']],
    [{ answerType: 'numeric', answer: { value: 32 }, prompt: 'A rectangle is 8 cm by 4 cm. Find its area.' },
      ['32', '32 cm²', '32 sq cm', '32 square units'], ['32 cm', '32 m²', '32 cm³', '32 units']],
    [{ answerType: 'numeric', answer: { value: 60 }, prompt: 'A cuboid is 5 cm by 4 cm by 3 cm. Find its volume.' },
      ['60 cm³', '60 cm^3', '60 cubic cm', '60 cubic units'], ['60 cm²', '60 cm', '60 kg']],
    [{ answerType: 'numeric', answer: { value: 60 }, prompt: 'A tank holds 20 litres in each of 3 parts. Find its capacity.' },
      ['60 litres', '60 l'], ['60 ml', '60 kg', '60 cm']],
    [{ answerType: 'numeric', answer: { value: 6 }, prompt: 'If $g(x) = 2x$, find the mass $g(3)$.' },
      ['6'], ['6 g', '6 grams']],
    [{ answerType: 'numeric', answer: { value: 12 }, prompt: 'Find the second term of the sequence 5, 12, 19.' },
      ['12'], ['12 s', '12 seconds']],
    [{ answerType: 'numeric', answer: { value: 12 }, prompt: 'A rope of 20 m loses 8 m. How many metres are left?' },
      ['12', '12 m', '12 metres'], ['12 kg', '12 m²']],
    [{ answerType: 'numeric', answer: { value: 12 }, prompt: 'Three bags weigh 4 kg each. Find the total mass in kg.' },
      ['12 kg'], ['12 m', '12 litres']]
  ];
  for (const [q, credited, unread] of cases) {
    for (const input of credited) check(G, verdict(q, input).correct === true, `"${input}" — ${q.prompt.slice(0, 50)} — is credited`);
    for (const input of unread) { const r = verdict(q, input); check(G, r.correct === false && r.invalid === true, `"${input}" — ${q.prompt.slice(0, 50)} — is left unread, not credited (got ${state(r)})`); }
  }
  // The review's served repros.
  for (const [id, d, s, credited, unread] of [
    ['c11-conic-sections', 2, 1, ['24', '24 units'], ['24 square units', '24 kg']],
    ['y7-equations', 1, 1, ['4'], ['4 square units', '4 cubic units', '4 units^3']],
    ['c8-surface-area-reasoning', 1, 2, ['17', '17 cm'], ['17 cm^2', '17 sq cm']],
    ['c12-rate-approximation-reasoning', 1, 1, ['20/9'], ['20/9 cm^3/s']],
    ['c10-linear-pair-methods', 4, 4, ['147', '₹147'], ['147 litres', '147 kilograms']],
    ['c8-monomial-product-reasoning', 1, 1, ['3456', '3456 cm³'], ['3456 cm']]
  ]) {
    const q = generateQuestion(id, d, s);
    for (const input of credited) check(G, verdict(q, input).correct === true, `${id} d${d} s${s}: "${input}" is credited`);
    for (const input of unread) check(G, verdict(q, input).correct !== true, `${id} d${d} s${s}: "${input}" is not credited`);
  }
  // Every no-unit numeric question: a square or cubic unit, a mass or a
  // volume is never credited where the asking sentence names no area,
  // volume, capacity, mass or weight.
  let probes = 0;
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (let s = 1; s <= 4; s++) {
    let q; try { q = generateQuestion(id, d, s * 7907 + d); } catch { continue; }
    if (q?.answerType !== 'numeric' || q.answerSuffix || !Number.isFinite(q.answer?.value) || q.answer.angle) continue;
    const sentences = String(q.prompt).replace(/\$/g, ' ').split(/(?<=[.?!])\s+(?=[A-Z*])/);
    const asking = sentences[sentences.length - 1] || '';
    const k = fmt(q.answer.value);
    const ban = [];
    if (!/\barea\b/i.test(asking)) ban.push(' square units', ' sq cm', ' cm²', ' m²');
    if (!/\b(?:volume|capacity)\b/i.test(asking)) ban.push(' cubic units', ' cm³', ' litres', ' ml');
    if (!/\b(?:mass|weight|weighs?|kg|kilograms?|grams?)\b/i.test(asking)) ban.push(' kg', ' grams');
    for (const unit of ban) { probes++; check(G, verdict(q, k + unit).correct !== true, `${id} d${d}: "${k}${unit}" is not credited — ${asking.slice(0, 60)}`); }
  }
  check(G, probes > 5000, `the sweep wrote ${probes} wrong-dimension units`);
}

// ── P3 · a model formula's subject is not a given ───────────────────────────
{
  const G = 'p3-formula-subject';
  let reached = 0;
  for (let s = 1; s <= 300; s++) {
    const q = generateQuestion('ms12-bivariate', 2, s * 104729);
    const m = String(q.prompt).match(/\$([a-z])\s*=\s*-?[\d.]+\s*[+\-]/);
    if (!m) continue;
    reached++;
    check(G, verdict(q, `${m[1]} = ${fmt(q.answer.value)}`).correct === true, `seed ${s * 104729}: "${m[1]} = ${fmt(q.answer.value)}" names the predicted quantity, and is correct`);
  }
  check(G, reached === 300, `every D2 item states its model as a formula (${reached}/300)`);
  // A letter the question really gives is still refused.
  const given = { answerType: 'numeric', answer: { value: 10 }, prompt: 'Given $b = 3$, find $b^2 + 1$.' };
  check(G, verdict(given, 'b = 10').correct === false, 'a given letter still names the given, not the answer');
}

// ── P4 · a percentage label ─────────────────────────────────────────────────
{
  const G = 'p4-percent-label';
  const profit = generateQuestion('y8-percentages', 3, 2);
  for (const input of ['Profit % = 20', 'Profit% = 20', '% profit = 20', 'Profit % = 20%', 'Percentage profit = 20'])
    check(G, verdict(profit, input).correct === true, `y8-percentages d3 s2: "${input}" is the asked percentage, and correct`);
  check(G, verdict(profit, 'Profit % = 25').correct === false, 'y8-percentages d3 s2: a wrong value under the label is wrong');
  const fall = generateQuestion('c8-gst-reasoning', 1, 1013946281);
  for (const input of ['Loss % = 12', 'Fall % = 12', 'Loss percent = 12']) {
    const r = verdict(fall, input);
    check(G, r.correct === false && r.invalid === true, `c8-gst-reasoning: "${input}" on "by what percentage did the price fall?" is left unread, never marked wrong (got ${state(r)})`);
  }
  // Every %-box question: a percentage label on the right value is never marked
  // wrong with a try spent, and a wrong value is never credited.
  let seen = 0;
  for (const id of Object.keys(GENERATORS)) for (const d of [1, 2, 3, 4]) for (let s = 1; s <= 4; s++) {
    let q; try { q = generateQuestion(id, d, s * 31 + d); } catch { continue; }
    if (q?.answerType !== 'numeric' || String(q.answerSuffix || '').trim() !== '%') continue;
    seen++;
    for (const label of ['Profit %', 'Loss %', '% increase']) {
      const r = verdict(q, `${label} = ${fmt(q.answer.value)}`);
      check(G, r.correct === true || r.invalid === true, `${id} d${d}: "${label} = ${fmt(q.answer.value)}" is credited or left unread (got ${state(r)})`);
      check(G, verdict(q, `${label} = ${fmt(q.answer.value + 7)}`).correct !== true, `${id} d${d}: "${label} = ${fmt(q.answer.value + 7)}" is not credited`);
    }
  }
  check(G, seen >= 20, `the sweep reached the %-box questions (${seen})`);
}

const pass = Object.values(groups).reduce((n, g) => n + g.pass, 0);
const total = Object.values(groups).reduce((n, g) => n + g.total, 0);
const summary = Object.entries(groups).map(([g, x]) => `${g} ${x.pass}/${x.total}`).join(' · ');
console.log(failures.length
  ? `STEP14 REVIEW FIXES: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 30).join('\n  · ')}`
  : `STEP14 REVIEW FIXES: PASS — ${pass}/${total} checks — ${summary}. [SYNTHETIC: direct checker on generated questions]`);
if (failures.length) process.exitCode = 1;
