// Hint rungs each add something (audit #7); a first rung from the student's
// own working (#13); specific praise and a next step for a right answer (#5).
// Run: node client/test/hint-rungs-praise-check.mjs   [SYNTHETIC: direct engine]
const SRC = new URL('../src/', import.meta.url).href;
const { buildHintLadder, repeats, workingHint, containsAnswer, statesAnswerValue } = await import(`${SRC}engine/hintLadder.js`);
const { praiseFor, ANSWER_ONLY_NOTE } = await import(`${SRC}engine/praise.js`);
const { stepCheck } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, GENERATORS, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
await loadAllBanks();

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass += 1; else { fail += 1; console.error('FAIL', l); } };

// ── Group 1: rungs ──
const pyth = { hints: ['Use Pythagoras.', '$c^2 = 3^2 + 4^2 = 9 + 16$', '$c = \\sqrt{25}$'], steps: [{ h: 'Square and add', d: '$3^2 + 4^2 = 9 + 16 = 25$' }, { h: 'Root', d: '$c = \\sqrt{25} = 5$' }] };
const L = buildHintLadder(pyth);
ok(L[1].text === '$c^2 = 3^2 + 4^2 = 9 + 16$' && L[2].text === '$3^2 + 4^2 = 9 + 16 = 25$', 'Pythagoras: c = √25 repeats the final step (c = √25 = 5), so the worked rung keeps its old text');
ok(repeats('$c^2 = 3^2 + 4^2 = 9 + 16$', '$3^2 + 4^2 = 9 + 16 = 25$'), 'the near-repeat is detected');
ok(!repeats('Use Pythagoras.', 'Take the square root.'), 'different text is not a repeat');
ok(buildHintLadder({ hints: ['A', 'A'], steps: [] })[1].text === 'A', 'with nothing new to say, a paid rung keeps its old text (never emptied)');
const last = buildHintLadder({ answerType: 'numeric', answer: { value: 3 }, hints: ['Halve.', '$2A = 6$'], steps: [{ h: 'Double', d: '$2A = 6$' }, { h: 'Halve', d: '$A = 3$' }] });
ok(last[2].text === '$2A = 6$', 'the worked rung never falls through to the final step');
const ans = buildHintLadder({ answerType: 'numeric', answer: { value: 19 }, hints: ['Count.', '$0 < c < 20$'], steps: [{ h: 'Range', d: '$0 < c < 20$' }, { h: 'Count', d: '$1$ through $19$ gives $19$ values' }, { h: 'Answer', d: '$19$' }] });
ok(!containsAnswer(ans[2].text, '19'), 'the worked rung never states the answer');
const mcq = buildHintLadder({ answerType: 'mcq', answer: { correctIndex: 0 }, mcqOptions: ['$3x-7$', '$3x+7$'], hints: ['Read it.', '$3x$'], steps: [{ h: 'x', d: '$3x$' }, { h: 'keyed', d: '$3x-7$' }, { h: 'end', d: 'done' }] });
ok(mcq[2].text === '$3x$', 'an MCQ worked rung never falls through (the keyed option)');
ok(buildHintLadder({ hints: ['Expand the bracket.', 'Collect like terms.', 'Divide by 3.'], steps: [] }).slice(0, 3).map(r => r.text).join('|') === 'Expand the bracket.|Collect like terms.|Divide by 3.', 'distinct hints keep their order');
// Catalogue: no ladder shows the same thing twice.
const cells = new Map();
for (const ch of IN_CHAPTERS) for (const c of ch.covers || []) if (GENERATORS[c.gen]) for (const d of c.diff || [1, 2, 3, 4]) cells.set(`${c.gen}|${d}`, { gen: c.gen, d });
// main's formula, as the baseline this change must not make worse.
const text = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const oldLadder = q => { const h = (q.hints || []).map(text).filter(Boolean), st = q.steps || [];
  return [h[0] || text(st[0]?.h), h[1] || text(st[1]?.h) || (h[0] ? text(st[0]?.h) : null), text(st[0]?.d) || text(st[0]?.h) || h[2] || null]; };
let ladders = 0, dupNew = 0, dupOld = 0, emptied = 0, newLeak = 0, mcqChanged = 0, changed = 0;
for (const { gen, d } of cells.values()) for (const seed of [1, 7919, 15838]) {
  let q; try { q = generateQuestion(gen, d, seed); } catch { continue; }
  if (!q) continue;
  ladders += 1;
  const now = buildHintLadder(q).slice(0, 3).map(r => r.text), was = oldLadder(q);
  const dups = t => { let n = 0; for (let i = 0; i < 3; i += 1) for (let j = i + 1; j < 3; j += 1) if (t[i] && t[j] && repeats(t[i], t[j])) n += 1; return n; };
  dupNew += dups(now); dupOld += dups(was);
  const a = q.answer || {};
  const keyed = q.answerType === 'mcq' ? [(q.mcqOptions || [])[a.correctIndex]].map(o => (typeof o === 'string' ? o : o?.text)) : [Number.isFinite(a.value) ? String(a.value) : null, a.expr];
  for (let i = 0; i < 3; i += 1) {
    if (was[i] && !now[i]) emptied += 1;
    if (now[i] !== was[i]) {
      changed += 1;
      if (q.answerType === 'mcq') mcqChanged += 1;
      const nums = [a.value, a.simplestFraction ? a.simplestFraction.n / a.simplestFraction.d : NaN, ...(a.values || [])].filter(Number.isFinite);
      if (keyed.some(k => k && containsAnswer(now[i], k)) || statesAnswerValue(now[i], nums)) { newLeak += 1; console.error('leak', gen, d, seed, now[i]); }
      const fin = (q.steps || []).at(-1);
      if (fin && (q.steps || []).length > 1 && repeats(now[i], fin.d || fin.h || '')) { newLeak += 1; console.error('final step', gen, d, seed, now[i]); }
    }
  }
}
ok(emptied === 0, `catalogue: ${emptied} rungs emptied`);
ok(newLeak === 0, `catalogue: ${newLeak} changed rungs state the answer`);
ok(mcqChanged === 0, `catalogue: ${mcqChanged} MCQ rungs changed`);
ok(dupNew < dupOld, `catalogue: repeated rungs ${dupOld} → ${dupNew}`);
console.log(`hint ladders: repeated rungs ${dupOld} → ${dupNew}; ${changed} rungs changed, none emptied, none stating the answer, in ${ladders} India ladders [SYNTHETIC]`);

// The review's examples, value by value.
ok(statesAnswerValue('$\\dfrac{2/20}{7/20} = \\dfrac{2}{7}$.', [2 / 7]) && statesAnswerValue('= $\\dfrac{6}{10}$', [3 / 5]), 'a TeX fraction equal to the answer, reduced or not');
ok(statesAnswerValue('The top-left entry of the adjugate is $d = -5$.', [-5]) && statesAnswerValue('height $14$.', [14]), 'a number before a full stop');
ok(statesAnswerValue('Reduce $\\dfrac{225}{180}$ to lowest terms.', [1.25]) && statesAnswerValue('That is 16/6 — reduce it.', [16 / 6]) && statesAnswerValue('$= \\dfrac{2540}{54}$', [2540 / 54]), 'an unreduced form');
ok(!statesAnswerValue('Use $P(A|B) = \\dfrac{P(A \\cap B)}{P(B)}$.', [2 / 7]), 'a definition with letters is not a value');
for (const [gen, d] of [['c12-conditional-probability', 1], ['c12-matrices', 4], ['c10-coordinate-geometry', 2], ['c11-trig-functions', 1], ['c11-straight-lines', 1], ['c10-statistics', 1]]) for (const seed of [1, 7919, 15838]) {
  let q; try { q = generateQuestion(gen, d, seed); } catch { q = null; }
  if (!q) continue;
  const a = q.answer || {};
  const nums = [a.value, a.simplestFraction ? a.simplestFraction.n / a.simplestFraction.d : NaN, ...(a.values || [])].filter(Number.isFinite);
  const was = oldLadder(q), now = buildHintLadder(q).slice(0, 3).map(r => r.text);
  ok(now.every((t, i) => t === was[i] || !statesAnswerValue(t, nums)), `${gen} d${d} s${seed}: no changed rung states the answer`);
}

// ── Group 2: a rung from the student's own working ──
const rep = stepCheck({ kind: 'equation', variable: 'x', solutions: [3] }, '2x + 4 = 10\n2x = 14\nx = 7');
const h = workingHint(rep);
ok(/^Your first line checks out\. Look again at line 2/.test(h), 'names the first break and the good lines');
ok(!/\b3\b|\b6\b/.test(h), 'no value of the answer or the right line');
ok(workingHint(stepCheck({ kind: 'equation', variable: 'x', solutions: [3] }, '2x + 4 = 10\n2x = 6')) === null, 'no break: no working hint');
ok(workingHint(null) === null, 'no report: none');

// ── Group 3: praise ──
const p1 = praiseFor({ attempt: 1, hintLevel: 0, difficulty: 2, stepReport: { lines: [{ status: 'ok' }, { status: 'ok', milestone: { step: 1 } }] } });
ok(p1.text === 'Correct — first try, with no hints and all 2 checked lines of working hold. Ready for a harder one on the same idea?' && p1.next.difficulty === 3, 'first try, unaided, working holds, step up');
ok(praiseFor({ attempt: 2, hintLevel: 1, difficulty: 2 }).text === 'Correct.' && praiseFor({ attempt: 2, hintLevel: 1, difficulty: 2 }).next === null, 'second try with a hint: plain, no step up');
ok(praiseFor({ attempt: 1, hintLevel: 0, difficulty: 4 }).next === null, 'top difficulty: no step up');
ok(!praiseFor({ attempt: 1, hintLevel: 0, stepReport: { lines: [{ status: 'ok' }, { status: 'break' }] } }).kinds.includes('working-checks-out'), 'a break: no working praise');
ok(praiseFor({ attempt: 2, hintLevel: 1, stepReport: { lines: [{ status: 'ok' }] } }).text === 'Correct — your working line checks out.', 'no dangling "and"');
ok(!/not verified/.test(ANSWER_ONLY_NOTE), 'the answer-only note is neutral');

console.log(`HINT RUNGS AND PRAISE: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
