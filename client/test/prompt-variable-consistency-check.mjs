// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · prompt variable consistency audit
//
// `c8-linear-equations-verification` once issued "A student claims $x=3$ solves
// $4t - 13=t + 2$": the sentence named x, the equation was written in t. This
// audit sweeps EVERY authored generator at EVERY difficulty over a fixed seed
// range and fails when a sentence that proposes a value for a variable as a
// solution of an equation names a variable the equation does not contain:
//
//   · "claims $v=…$ solves $<equation>$"
//   · "$v=…$ (is|is not) a solution of/to $<equation>$", "v = … a solution of …"
//   · "$v=…$ satisfies $<equation>$"
//   · "Put v = … into both sides." in the worked steps of such a question
//   · "The solution is v = …" on a question whose prompt is one equation in one
//     other variable
//
// It is precise by construction: it only reads sentences of those exact shapes,
// and "occurs" means the letter appears in the equation once LaTeX command names
// are removed — so a multi-variable equation, a parameter, or a prompt that
// merely mentions another letter elsewhere is never flagged.
//
// It reports how many prompts it generated and how many matched each shape, and
// fails if the shapes it exists for stop appearing, so it cannot pass vacuously.
//
// Usage: node client/test/prompt-variable-consistency-check.mjs [--seeds N]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;

const seedsArg = process.argv.indexOf('--seeds');
const SEEDS = seedsArg > 0 ? Math.max(1, Number(process.argv[seedsArg + 1]) || 0) : 120;
// The seed that produced the reported defect, and its generator.
const REPORTED = { generator: 'c8-linear-equations-verification', seed: 642714604 };

/** An equation's text with LaTeX command names (\frac, \left, \text{…}) removed. */
export function lettersOf(equation) {
  const bare = String(equation).replace(/\\(?:text|mathrm|operatorname)\s*\{[^}]*\}/g, ' ').replace(/\\[a-zA-Z]+/g, ' ');
  return new Set(bare.match(/[a-zA-Z]/g) || []);
}

const VALUE = String.raw`[^$]*?`;
// Each shape captures the variable named and the equation it is said to solve.
const SHAPES = [
  { name: 'claims-solves', re: new RegExp(String.raw`claims?\s+(?:that\s+)?\$\s*([a-zA-Z])\s*=${VALUE}\$\s+solves\s+\$([^$]+)\$`, 'g') },
  { name: 'is-a-solution', re: new RegExp(String.raw`\$\s*([a-zA-Z])\s*=${VALUE}\$\s+(?:is|is\s+\*{0,2}not\*{0,2}|as)?\s*(?:a|the)\s+solution\s+(?:of|to)\s+\$([^$]+)\$`, 'g') },
  { name: 'is-a-solution', re: /\b([a-zA-Z])\s*=\s*-?\d+(?:[./]\d+)?\s+(?:is\s+)?(?:\*{0,2}not\*{0,2}\s+)?(?:a|the)\s+solution\s+(?:of|to)\s+\$([^$]+)\$/g },
  { name: 'satisfies', re: new RegExp(String.raw`\$\s*([a-zA-Z])\s*=${VALUE}\$\s+satisf(?:y|ies)\s+\$([^$]+)\$`, 'g') }
];

/** Every (shape, variable, equation) a prompt states, and whether it is consistent. */
export function claimsIn(prompt) {
  const found = [];
  const text = String(prompt || '');
  for (const { name, re } of SHAPES) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text));) {
      const equation = m[2];
      if (!equation.includes('=')) continue; // a relation to solve, not a bare expression
      found.push({ shape: name, variable: m[1], equation, ok: lettersOf(equation).has(m[1]) });
    }
  }
  return found;
}

/** The single equation of a prompt of the form "… $<equation>$ …", or null. */
function soleEquation(prompt) {
  const maths = String(prompt || '').match(/\$[^$]+\$/g) || [];
  if (maths.length !== 1 || !maths[0].includes('=')) return null;
  const letters = lettersOf(maths[0].slice(1, -1));
  return letters.size === 1 ? { equation: maths[0].slice(1, -1), variable: [...letters][0] } : null;
}

/** Inconsistencies of one generated question. */
export function inconsistenciesOf(q) {
  const out = [];
  const claims = claimsIn(q.prompt);
  for (const c of claims) if (!c.ok) out.push(`${c.shape}: "$${c.variable}=…$" against $${c.equation}$`);
  // The worked steps of a claim question substitute the claimed value.
  for (const c of claims) {
    const letters = lettersOf(c.equation);
    for (const step of q.steps || []) {
      const m = /\bPut\s+\$?([a-zA-Z])\s*=/.exec(String(step?.d || ''));
      if (m && !letters.has(m[1])) out.push(`step "Put ${m[1]} = …" against $${c.equation}$`);
    }
  }
  const stated = /^The solution is ([a-zA-Z]) = /.exec(String(q.solutionText || ''));
  const sole = stated ? soleEquation(q.prompt) : null;
  if (stated && sole && sole.variable !== stated[1]) out.push(`solutionText "${stated[1]} = …" against $${sole.equation}$`);
  return { claims, statedSolution: !!(stated && sole), problems: out };
}

async function run() {
  // Self-test of the detector first: it must flag the reported sentence and
  // must not flag legitimate multi-variable or parameterised ones.
  const self = [
    ['A student claims $x=3$ solves $4t - 13=t + 2$. What is the correct verification strategy?', 1],
    ['A student claims $t=3$ solves $4t - 13=t + 2$. What is the correct verification strategy?', 0],
    ['Why is x = 10 **not** a solution of $2x-3=7$?', 0],
    ['Why is y = 10 **not** a solution of $2x-3=7$?', 1],
    ['Is $x=2$ a solution of $x+y=5$ when $y=3$?', 0],
    ['Show that $k=4$ satisfies $kx^2-8x+k=0$ having equal roots.', 0],
    ['Show that $m=4$ satisfies $\\frac{x}{2}+\\sqrt{t}=\\left(3\\right)$.', 1],
    ['A student claims $a=\\frac{1}{2}$ solves $2a+1=2$.', 0]
  ];
  let selfFail = 0;
  for (const [prompt, bad] of self) {
    const got = claimsIn(prompt).filter(c => !c.ok).length;
    if (got !== bad) { selfFail++; console.log(`self-test: expected ${bad} inconsistency in ${JSON.stringify(prompt)}, found ${got}`); }
  }
  const stepSelf = inconsistenciesOf({ prompt: 'A student claims $t=3$ solves $4t-13=t+2$.', steps: [{ d: 'Put x = 3 into both sides.' }] }).problems.length;
  const solSelf = inconsistenciesOf({ prompt: 'Solve and then verify $4t-13=t+2$.', solutionText: 'The solution is x = 5.' }).problems.length;
  if (stepSelf !== 1 || solSelf !== 1) { selfFail++; console.log(`self-test: step ${stepSelf}/1, solutionText ${solSelf}/1`); }

  const { GENERATORS, loadAllBanks, generateQuestion } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();
  const ids = Object.keys(GENERATORS).sort();

  const stats = { generators: ids.length, prompts: 0, crashed: 0, byShape: {}, claimPrompts: 0, statedSolutions: 0, generatorsWithClaims: new Set() };
  const problems = [];
  const examine = (id, d, seed) => {
    let q;
    try { q = generateQuestion(id, d, seed); } catch { stats.crashed++; return; }
    // A structured question states its equations part by part.
    const units = q.multipart && Array.isArray(q.parts) ? [{ prompt: q.stem }, ...q.parts] : [q];
    for (const unit of units) {
      stats.prompts++;
      const r = inconsistenciesOf(unit);
      if (r.claims.length) { stats.claimPrompts++; stats.generatorsWithClaims.add(id); }
      for (const c of r.claims) stats.byShape[c.shape] = (stats.byShape[c.shape] || 0) + 1;
      if (r.statedSolution) stats.statedSolutions++;
      for (const p of r.problems) if (problems.length < 40) problems.push(`${id} D${d} seed ${seed}: ${p}\n      ${String(unit.prompt).slice(0, 160)}`);
      else if (problems.length === 40) problems.push('… further problems suppressed');
    }
  };
  for (const id of ids) for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= SEEDS; seed++) examine(id, d, seed);
  for (let d = 1; d <= 4; d++) examine(REPORTED.generator, d, REPORTED.seed);

  const reported = generateQuestion(REPORTED.generator, 2, REPORTED.seed);
  const reportedClaims = claimsIn(reported.prompt);

  console.log(`generators ${stats.generators} · difficulties 4 · seeds 1–${SEEDS} (+ reported seed ${REPORTED.seed}) · prompts examined ${stats.prompts}`);
  console.log(`prompts stating a value-solves-equation claim ${stats.claimPrompts} across ${stats.generatorsWithClaims.size} generator(s): ${[...stats.generatorsWithClaims].join(', ') || '—'}`);
  console.log(`claims by shape ${JSON.stringify(stats.byShape)} · single-equation prompts with a stated solution variable ${stats.statedSolutions}`);
  console.log(`reported seed now reads: ${reported.prompt}`);

  const fail = [];
  if (selfFail) fail.push(`${selfFail} detector self-test(s) failed`);
  if (stats.crashed) fail.push(`${stats.crashed} generation(s) threw`);
  if (!reportedClaims.length) fail.push('the reported seed no longer produces a "claims … solves …" prompt — the regression is not being exercised');
  if (reportedClaims.some(c => !c.ok)) fail.push('the reported seed still names a variable its equation does not contain');
  // Not vacuous: the shapes this audit exists for must actually be examined.
  if (stats.prompts < ids.length * 4 * SEEDS) fail.push(`only ${stats.prompts} prompts examined`);
  if ((stats.byShape['claims-solves'] || 0) < SEEDS) fail.push(`only ${stats.byShape['claims-solves'] || 0} "claims … solves …" prompts examined (expected at least ${SEEDS})`);
  if (stats.statedSolutions < 1000) fail.push(`only ${stats.statedSolutions} stated-solution prompts examined`);
  if (problems.length) fail.push(`${problems.length} inconsistent prompt(s)`);

  if (fail.length) {
    for (const p of problems) console.log('  ' + p);
    console.log(`\nPROMPT VARIABLE CONSISTENCY: FAIL — ${fail.join('; ')}`);
    return 1;
  }
  console.log(`PROMPT VARIABLE CONSISTENCY: PASS — ${stats.prompts} prompts, ${stats.claimPrompts} claim prompts, ${stats.statedSolutions} stated solutions, 0 inconsistent`);
  return 0;
}

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('prompt-variable-consistency-check.mjs')) {
  run().then(code => process.exit(code)).catch(err => { console.error(err?.stack || err); console.log('\nPROMPT VARIABLE CONSISTENCY: FAIL — crashed'); process.exit(1); });
}
