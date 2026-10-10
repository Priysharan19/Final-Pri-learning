// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · old marker vs new marker, on a generated population
//
//   node tools/first-mistake-differential.mjs --old <path to a checkout of the
//        base commit> [--seeds 12]
//
// Marks every generated question of every bank with both trees through the
// operation the server runs (server/platform/markerOps.js MARKER_OPS.practice),
// with a right and a wrong final answer and a spread of workings — none, the
// bare right value, the authored solution steps and hints as lines, a correct
// substitution with a wrong last line, padding — and reports every way the two
// trees differ in verdict, marks or step report.
//
// It is a measurement, not a gate: it needs the old tree on disk. What it must
// show for the first-mistake change (#430):
//   · no verdict on a final answer changes;
//   · no submission earns FEWER marks;
//   · a submission earns more only on a question that gained step metadata,
//     and only for the formula or the substitution — never for a restated
//     value, a bare answer, a hint copied out or padding.
// Synthetic by construction: generated questions and authored workings.
// ─────────────────────────────────────────────────────────────────────────────
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const OLD = arg('--old');
const SEEDS = Number(arg('--seeds') || 12);
if (!OLD) { console.error('usage: node tools/first-mistake-differential.mjs --old <base checkout> [--seeds N]'); process.exit(2); }

async function tree(root) {
  const at = file => pathToFileURL(resolve(root, file)).href;
  const gen = await import(at('client/src/engine/generators/index.js'));
  await gen.loadAllBanks();
  const ops = await import(at('server/platform/markerOps.js'));
  return { gen, ops };
}
const NEW = await tree(resolve(new URL('..', import.meta.url).pathname));
const BASE = await tree(OLD);

const plain = text => String(text ?? '').replace(/\$\$?/g, '')
  .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)').replace(/\\(?:left|right|,|;|!|quad)/g, '')
  .replace(/\\(?:times|cdot)/g, '×').replace(/\\div/g, '÷').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '').trim();

function workings(q) {
  const out = { none: [] };
  const value = q.answer?.value;
  if (Number.isFinite(value)) {
    out.bareRight = [`= ${value}`];
    out.namedRight = [`x = ${value}`];
    out.sweep = [`= ${value - 1}`, `= ${value}`, `= ${value + 1}`];
  }
  out.steps = (q.steps || []).map(s => plain(s.d)).filter(Boolean);
  out.hints = (q.hints || []).map(plain).filter(Boolean);
  out.padding = ['1 + 1 = 2', '2 × 3 = 6', '10 - 4 = 6'];
  out.falsePadding = ['1 + 1 = 3', '2 × 3 = 7'];
  const meta = q.stepcheck;
  if (meta?.kind === 'formula') {
    const { a, d, n } = meta.substitutions;
    const p = v => (v < 0 ? `(${v})` : String(v));
    const sub = /n\/2/.test(meta.source) ? `${n}/2 × (2 × ${p(a)} + ${n - 1} × ${p(d)})` : `${p(a)} + ${n - 1} × ${p(d)}`;
    const formula = /n\/2/.test(meta.source) ? 'S_n = n/2(2a + (n - 1)d)' : 'T_n = a + (n - 1)d';
    out.method = [formula, `X = ${sub}`, `= ${value + 2}`];
    out.methodNoFormula = [`X = ${sub}`, `= ${value + 2}`];
    out.givens = [`a = ${a}, d = ${d}, n = ${n}`];
  }
  return out;
}

const tally = new Map();
const note = (cls, example) => { const t = tally.get(cls) || { n: 0, example }; t.n += 1; tally.set(cls, t); };
let questions = 0, submissions = 0, gained = 0, lost = 0, verdictChanges = 0, crashes = 0;
const gainedBy = new Map();

for (const id of Object.keys(NEW.gen.GENERATORS).sort()) {
  for (const difficulty of [1, 2, 3, 4]) {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      let qn, qo;
      try { qn = NEW.gen.generateQuestion(id, difficulty, seed); qo = BASE.gen.generateQuestion(id, difficulty, seed); } catch { continue; }
      if (!qn || qn.multipart || !qo) continue;
      questions += 1;
      if (qn.prompt !== qo.prompt || JSON.stringify(qn.answer) !== JSON.stringify(qo.answer)) note('question text or key changed', `${id} d${difficulty} s${seed}`);
      const right = qn.answerType === 'numeric' && Number.isFinite(qn.answer?.value) ? String(qn.answer.value) : null;
      const answers = [['wrong', right === null ? '123456789' : String(qn.answer.value + 1)], ...(right === null ? [] : [['right', right]])];
      for (const [kind, lines] of Object.entries(workings(qn))) {
        for (const [verdict, answer] of answers) {
          submissions += 1;
          const run = (t, q) => {
            try {
              const r = t.ops.MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true }, () => {});
              const possible = t.ops.marksPossibleFor(q);
              return { correct: r.result.correct === true, possible,
                earned: r.result.correct ? possible : Math.max(0, Math.min(possible - 1, r.evidence?.partial?.awarded ?? 0)),
                report: (r.evidence?.stepReport?.lines || []).map(l => l.status).join(',') };
            } catch (error) { return { crash: String(error?.message || error) }; }
          };
          const o = run(BASE, qo), n = run(NEW, qn);
          if (o.crash || n.crash) { crashes += 1; note(`crash (${o.crash ? 'old' : ''}${n.crash ? 'new' : ''})`, `${id} d${difficulty} s${seed} ${kind}`); continue; }
          const where = `${id} d${difficulty} s${seed} ${kind}/${verdict}: ${o.earned}/${o.possible} → ${n.earned}/${n.possible}`;
          if (o.correct !== n.correct) { verdictChanges += 1; note('FINAL-ANSWER VERDICT CHANGED', where); }
          if (o.possible !== n.possible) note('marks possible changed', where);
          if (n.earned < o.earned) { lost += 1; note('MARKS LOST', where); }
          if (n.earned > o.earned) {
            gained += 1;
            const cls = `marks gained: ${qn.stepcheck?.kind === 'formula' && !qo.stepcheck ? 'new formula metadata' : 'OTHER'} · working "${kind}"`;
            note(cls, where);
            gainedBy.set(kind, (gainedBy.get(kind) || 0) + 1);
          }
          if (o.report !== n.report && n.earned === o.earned) note(`step report differs, marks equal · ${qn.stepcheck?.kind === 'formula' && !qo.stepcheck ? 'new formula metadata' : 'OTHER'}`, where);
        }
      }
    }
  }
}

console.log(`population: ${questions} questions × workings × answers = ${submissions} submissions (${SEEDS} seeds per generator and difficulty)`);
for (const [cls, t] of [...tally].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(t.n).padStart(6)}  ${cls}   e.g. ${t.example}`);
console.log(`verdict changes: ${verdictChanges} · marks lost: ${lost} · marks gained: ${gained} · crashes: ${crashes}`);
const unexpected = [...gainedBy.keys()].filter(kind => !['method', 'methodNoFormula', 'steps', 'hints'].includes(kind));
const otherGain = [...tally.keys()].some(k => /OTHER/.test(k) && /gained/.test(k));
const bad = verdictChanges || lost || crashes || unexpected.length || otherGain;
console.log(bad
  ? `FIRST-MISTAKE DIFFERENTIAL: FAIL — ${[verdictChanges && 'a verdict changed', lost && 'marks were lost', crashes && 'a crash', unexpected.length && `marks gained for ${unexpected.join(', ')}`, otherGain && 'marks gained outside the new metadata'].filter(Boolean).join('; ')}`
  : `FIRST-MISTAKE DIFFERENTIAL: PASS — ${submissions} submissions: no verdict changed, no marks lost, and marks were gained only on questions with new formula metadata for working that shows the formula or the substitution.`);
process.exit(bad ? 1 : 0);
