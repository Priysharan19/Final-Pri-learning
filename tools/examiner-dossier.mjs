#!/usr/bin/env node
// Pri Learning · Order 14 examiner certification dossier (#499)
//
// Builds docs/marking/order14-examiner-certification-dossier.md from the code
// itself: every rubric bank the engine issues (a question whose stepcheck is a
// first-error / error-carried-forward plan), the AP / ECF policy as the marker
// actually applies it, the two open #430 policy calls probed on real issued
// questions, and a SHA-256 digest bound to the exact marking source and to the
// plan of every sampled bank question. An examiner signs that digest, so any
// later change to the rubric or the marker voids the signature.
//
// It is a review request. Nothing in it is academically approved.
//
//   node tools/examiner-dossier.mjs           # write the dossier
//   node tools/examiner-dossier.mjs --check   # fail if the dossier is stale
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'docs/marking/order14-examiner-certification-dossier.md');
const { GENERATORS, loadAllBanks, generateQuestion } = await import(path.join(ROOT, 'client/src/engine/generators/index.js'));
const { checkAnswer } = await import(path.join(ROOT, 'client/src/engine/checker.js'));
const { marksPossibleFor, stepEvidence } = await import(path.join(ROOT, 'server/platform/markerOps.js'));
await loadAllBanks();

const sha = s => createHash('sha256').update(s).digest('hex');
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));

// The marking source an examiner signs: the full static and dynamic import tree
// of the server marker (which includes the engine's checker), every generator
// file that builds a step check, and the policy documents. A change to any of
// them voids the digest. A listed file that is missing is an error, not a skip.
function importTree(entries) {
  const seen = new Set(), todo = [...entries];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file)) continue;
    const abs = path.join(ROOT, file);
    if (!existsSync(abs)) { console.error(`EXAMINER DOSSIER: FAIL — marking source ${file} is missing`); process.exit(1); }
    seen.add(file);
    const text = readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const dep = path.relative(ROOT, path.resolve(path.dirname(abs), m[1]));
      if (/\.(m?js|jsx)$/.test(dep)) todo.push(dep);
    }
  }
  return seen;
}
const GEN_DIR = 'client/src/engine/generators';
const stepcheckGenerators = readdirSync(path.join(ROOT, GEN_DIR)).filter(f => /\.m?js$/.test(f) && /stepcheck/.test(readFileSync(path.join(ROOT, GEN_DIR, f), 'utf8'))).map(f => `${GEN_DIR}/${f}`);
const DOCS = ['docs/product/marking-first-error-ecf.md', 'docs/content/marking-tolerance.md'];
for (const d of DOCS) if (!existsSync(path.join(ROOT, d))) { console.error(`EXAMINER DOSSIER: FAIL — policy document ${d} is missing`); process.exit(1); }
const SOURCES = [...new Set([...importTree(['server/platform/markerOps.js', ...stepcheckGenerators]), ...DOCS])].sort();
const sourceRows = SOURCES.map(f => ({ file: f, sha256: sha(readFileSync(path.join(ROOT, f))) }));

// Every rubric bank: a (generator, difficulty) that issues a chain plan on the fixed seeds.
const SEEDS = Array.from({ length: 12 }, (_, i) => 1009 + i * 7919);
// A wider sweep finds banks; the digest samples SEEDS within each one.
const DISCOVERY = Array.from({ length: 200 }, (_, i) => 1 + i * 37);
const banks = [];
for (const id of Object.keys(GENERATORS).sort()) {
  for (const diff of [1, 2, 3, 4]) {
    const plans = [];
    let marks = null, shape = null;
    for (const seed of SEEDS) {
      let q;
      try { q = generateQuestion(id, diff, seed); } catch { continue; }
      if (!q || !q.stepcheck) continue;
      plans.push({ seed, plan: q.stepcheck, answer: q.answer });
      marks = marksPossibleFor(q);
      const sc = q.stepcheck;
      shape = sc.kind === 'plan'
        ? (sc.chain ? 'chain plan: ' : 'plan: ') + (sc.stages || []).map(s => s.kind + (s.supporting ? '(supporting)' : '') + (s.evidence ? `[${s.evidence}]` : '')).join(' → ')
        : `${sc.kind} step check`;
    }
    if (!plans.length) {
      const found = DISCOVERY.some(seed => { try { return !!generateQuestion(id, diff, seed)?.stepcheck; } catch { return false; } });
      if (found) { console.error(`EXAMINER DOSSIER: FAIL — ${id}/D${diff} issues step checks but none on the sampled seeds; widen SEEDS`); process.exit(1); }
      continue;
    }
    const ecf = plans[0].plan.chain ? (plans[0].plan.ecf || 'none') : 'n/a';
    banks.push({ id, diff, marks, shape, ecf, seeds: plans.map(p => p.seed), hash: sha(canon(plans)) });
  }
}

// The two open #430 policy calls, probed on real issued AP questions through the server marker.
function judge(q, lines, ans) {
  const w = lines.join('\n'), r = checkAnswer(q, ans), e = stepEvidence(q, ans, w, r), m = marksPossibleFor(q);
  const a = e.partial?.awarded ?? 0;
  return { marks: m, earned: r.correct ? m : Math.max(0, Math.min(m - 1, a)) };
}
const probes = [];
for (const diff of [1, 2, 4]) {
  const q = generateQuestion('c10-arithmetic-progressions', diff, 1009);
  const { a, d, n } = q.stepcheck.givens;
  const [wa, wd, wn] = [a + 3, d + 1, n + 2];
  const sum = diff !== 1;
  const formula = sum ? 'S = n/2 (2a + (n-1)d)' : 'T_n = a + (n-1)d';
  const subst = sum ? `S = ${wn}/2 (${2 * wa} + ${(wn - 1) * wd})` : `T_${wn} = ${wa} + ${wn - 1} × ${wd}`;
  const wv = sum ? wn / 2 * (2 * wa + (wn - 1) * wd) : wa + (wn - 1) * wd;
  const guess = String(q.answer.value + 1000);
  probes.push({
    diff, prompt: q.prompt, right: q.answer.value,
    wrongGivens: { page: [`a = ${wa}, d = ${wd}, n = ${wn}`, formula, subst, `= ${wv}`], answer: String(wv) },
    formulaGuess: { page: [formula, `${sum ? 'S' : `T_${n}`} = ${guess}`], answer: guess },
    bareGuess: { page: [`${guess}`], answer: guess }
  });
  const p = probes.at(-1);
  for (const k of ['wrongGivens', 'formulaGuess', 'bareGuess']) Object.assign(p[k], judge(q, p[k].page, p[k].answer));
}

const bankDigest = sha(banks.map(b => `${b.id}/D${b.diff} ${b.hash}`).join('\n'));
const sourceDigest = sha(sourceRows.map(r => `${r.file} ${r.sha256}`).join('\n'));
const digest = sha(`pri-order14-rubric-digest-v1\n${sourceDigest}\n${bankDigest}`);

const L = [];
const p = s => L.push(s);
p('# Order 14 — independent examiner certification dossier (#499)');
p('');
p('> **Nothing in this dossier is academically approved.** It is a review request. No qualified examiner, teacher or board has reviewed or signed any rubric, mark allocation or policy below. Automated tests and agent reviews are software evidence, not academic approval. The method rubrics stay off in production until a signed result returns through governance.');
p('');
p('Generated by `node tools/examiner-dossier.mjs` from the code it describes. Do not edit by hand; `npm run test:marking:dossier` fails when this file no longer matches the code.');
p('');
p('## 1. What the examiner signs: the rubric digest');
p('');
p(`**Rubric digest (sha256): \`${digest}\`**`);
p('');
p(`It hashes (a) the marking source files below — the full import tree of \`server/platform/markerOps.js\`, every generator file that builds a step check, and the two policy documents — and (b) the full plan and keyed answer of every sampled question in every rubric bank (${SEEDS.length} fixed seeds: ${SEEDS.join(', ')}). Any change to the marker, a rubric, a plan, a key or this policy text produces a different digest, and a signature over the old digest does not carry over.`);
p('');
p(`- Source digest: \`${sourceDigest}\``);
p(`- Bank digest: \`${bankDigest}\``);
p('');
p('| Marking source | sha256 |');
p('|---|---|');
for (const r of sourceRows) p(`| \`${r.file}\` | \`${r.sha256}\` |`);
p('');
p('Recompute with `node tools/examiner-dossier.mjs --check` at the signed commit.');
p('');
p(`## 2. Every rubric bank (${banks.length} generator × difficulty banks)`);
p('');
p('A rubric bank is a generator and difficulty whose issued question carries a step check, so its working can earn method marks. *Chain plans* are the first-error / error-carried-forward rubrics (`stepcheck.chain`); the ECF policy in section 3 applies to them only. *Equation, inequality, derivative* and non-chain *plan* step checks verify each line and award progress stages without carrying errors forward. Every question outside these banks is marked on its final answer only and is outside this review.');
p('');
p('Where a bank shows the same plan hash at several levels (e.g. `c10-sector-reasoning`), the level changes the marks available but not the question form; the examiner should confirm the marks at each level are justified.');
p('');
p('| Generator | Level | Marks | Stages (in plan order) | ECF | Sampled seeds | Plan hash |');
p('|---|---|---:|---|---|---:|---|');
for (const b of banks) p(`| \`${b.id}\` | D${b.diff} | ${b.marks} | ${b.shape} | ${b.ecf} | ${b.seeds.length} | \`${b.hash.slice(0, 16)}\` |`);
p('');
p('## 3. The AP / ECF policy as the marker applies it');
p('');
p('Source of truth: `docs/product/marking-first-error-ecf.md` (hashed above). In short:');
p('');
p('- A line earns only as the proof of a stage, and each stage earns at most once. Restated givens, bare values, prose, the copied question and padding earn nothing.');
p('- A substitution stage is proved only by a line showing the authored expression with the numbers in it, never by the bare value or another computation reaching it.');
p('- The first mathematical break is marked once. A later line that is correct on the student\'s own wrong value is "carried forward": it is not called wrong. Under `ecf: \'method\'` it may earn its method stage; it never earns the answer mark.');
p('- A substitution into a wrong formula never earns. A `supporting` stage (the last term on a sum question) earns only when a primary method stage is verified.');
p('- Method marks are capped at one below the question\'s marks, so a wrong final answer never earns full marks, and a one-mark question pays no method mark. A right final answer earns full marks under the existing final-answer policy.');
p('- Marking is online-only and server-authoritative (ADR-0001 amendment 2026-10-10). A model never sets a mark.');
p('');
p('## 4. The two open #430 policy calls — decisions the examiner must make');
p('');
p('Both are current engine behaviour, probed below on real issued `c10-arithmetic-progressions` questions (seed 1009) through the server marker (`markerOps.stepEvidence`). The final award applies the server rule (full marks for a correct answer, otherwise the method award capped at marks − 1), restated in the tool rather than called through the HTTP route. They are **not** approved. The examiner rules on each.');
p('');
p('**Call A — ECF on wholly wrong givens pays the substitution mark.** A student who copies every given wrongly, then uses the right formula and substitutes their own values correctly, earns the formula and substitution stages (within the cap), never the answer mark.');
p('');
p('**Call B — formula-then-guess pays the method mark.** A student who writes the correct formula and then a guessed value with no substitution earns the formula stage.');
p('');
p('| Level | Question | Right answer | A: wrong givens, right method | B: formula, then a guess | Control: bare guess |');
p('|---|---|---:|---:|---:|---:|');
const tableCell = value => String(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
for (const x of probes) p(`| D${x.diff} | ${tableCell(x.prompt)} | ${x.right} | ${x.wrongGivens.earned}/${x.wrongGivens.marks} | ${x.formulaGuess.earned}/${x.formulaGuess.marks} | ${x.bareGuess.earned}/${x.bareGuess.marks} |`);
p('');
for (const x of probes) {
  p(`<details><summary>D${x.diff} pages</summary>`);
  p('');
  p('A (wrong givens):');
  p('```text'); for (const l of x.wrongGivens.page) p(l); p('```');
  p('B (formula, then a guess):');
  p('```text'); for (const l of x.formulaGuess.page) p(l); p('```');
  p('</details>');
  p('');
}
p('Questions for the examiner: (A) Should a page whose every given is misread earn the substitution mark when the method is otherwise right? (B) Does writing the correct formula, with no substitution and a wrong value, earn a method mark on a 2- or 3-mark question? For each: APPROVE as is, or state the intended award per level.');
p('');
p('## 5. Earlier pilot scope still awaiting a decision');
p('');
p('The 2026-10-15 local Order 14 pilot (`server/platform/authoredRubrics.js`, Class VIII two-sided linear equations, Year 8 working-only, Class XI rational domain) is **not on this branch**; its rubrics are not in the digest and are not under review here. One decision from it still stands: Class XI least-value D3 (`c11-relations-functions`, e.g. `f(x)=(x+3)^2+6`) is marked final-answer-only, so a correct 6 with a false strict inequality `(x+3)^2>0` earns 3/3. The examiner should state whether that is the intended three-mark scheme.');
p('');
p('## 6. Review protocol');
p('');
p('1. Check out the commit, run `node tools/examiner-dossier.mjs --check`, and confirm the digest above.');
p('2. For each bank, blind-solve a sample of the issued questions (any seed listed) without looking at the keyed answer.');
p('3. Mark by hand, per stage: canonical working; a valid alternative or reversed equality; compressed but valid working; right method with a wrong final; right final with no method; one arithmetic slip carried forward correctly; two independent errors; repeated or padded lines. Compare with the server\'s award and list every disagreement.');
p('4. Rule on calls A and B and on the Class XI least-value scheme.');
p('5. Confirm the syllabus fit of each bank against the official curriculum. A seed count is not chapter coverage.');
p('');
p('## 7. Signing template');
p('');
p('Return this block, completed, to release governance. The reviewer\'s identity and qualification go to governance privately; do not commit personal details. No code change is made under the reviewer\'s identity, and no production flag changes without a separate governance approval.');
p('');
p('```text');
p('PRI LEARNING — ORDER 14 EXAMINER RESULT (#499)');
p(`Rubric digest reviewed (sha256): ${digest}`);
p('Repository commit reviewed:      ____________________________________');
p('Reviewer reference (held by governance, not committed): ______________');
p('Qualification (summary):         ____________________________________');
p('Independence: I did not write or commission this code.  [ ] confirmed');
p('Date (YYYY-MM-DD):               ______________');
p('');
p('Banks reviewed (generator/level, seeds solved): _____________________');
p('Disagreements with server awards (bank, seed, page, expected, actual):');
p('  ___________________________________________________________________');
p('Call A — ECF on wholly wrong givens pays substitution:  APPROVE / CHANGE TO: ________');
p('Call B — formula-then-guess pays the method mark:       APPROVE / CHANGE TO: ________');
p('Class XI least-value D3 scheme:  FINAL-ONLY / METHOD (≥0, equality, result) / OTHER: ____');
p('Syllabus fit confirmed for: _____________________________________________');
p('');
p('DECISION:  APPROVE  /  CONDITIONAL (defects listed above)  /  REJECT');
p('Signature: ____________________');
p('```');
p('');
p('## 8. Software evidence (not a substitute for section 6)');
p('');
p('- `npm run test:marker:ap` — the AP first-error / ECF adversarial corpus.');
p('- `npm run test:marker:rubrics` — every plan-carrying family, model page and attacks, through `markerOps.stepEvidence`.');
p('- `server/test/ap-term-firstbreak-regression-check.mjs` and `server/test/owner-ap-first-mistake-contract-check.mjs` — seed sweep and the owner\'s page over HTTP.');
p('');
p(`**Certification status: PENDING. Approved by: nobody.**`);
p('');
const text = L.join('\n');

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== text) { console.error('EXAMINER DOSSIER: FAIL — docs/marking/order14-examiner-certification-dossier.md does not match the code; run node tools/examiner-dossier.mjs and re-request review'); process.exit(1); }
  console.log(`EXAMINER DOSSIER: PASS — ${banks.length} rubric banks, digest ${digest.slice(0, 12)}…, status PENDING (not academically approved)`);
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT} — ${banks.length} banks, digest ${digest}`);
}
