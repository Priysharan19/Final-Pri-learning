// Pri Learning · head-to-head marking benchmark (offline lab tooling only).
//
// Who decides what is TRUE: SymPy (truth.py), line by line. Nobody's opinion.
// Who is MEASURED: the deterministic marking engine (client/src/engine/checker.js
// stepCheck, exactly as the server runs it) and frontier LLM graders given the
// same question and the same lines as text, with a strict marking instruction.
//
// Headline metric: FALSE CREDIT, credit given to wrong working.
//
//   node run.mjs                         engine + every model, 1 run
//   node run.mjs --engine-only           no API calls
//   node run.mjs --models=fable,opus --reruns=3 --rerun-sample=30 --concurrency=6
//
// API key: read from ANTHROPIC_API_KEY (the caller loads it from Keychain for
// the one process; it is never written anywhere). No server-side model
// fallback is enabled: a refusal is scored as an abstention for the model that
// was asked, so every answer is attributable to that model.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PY = join(ROOT, 'tools', 'math-oracle', '.venv', 'bin', 'python');
const arg = (name, dflt) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : dflt; };
const flag = name => process.argv.includes(`--${name}`);

const MODELS = {
  fable: { id: 'claude-fable-5-2', label: 'Claude Fable 5.2', inPerM: 8, outPerM: 40, effort: 'high' },
  opus: { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', inPerM: 4, outPerM: 20, effort: 'high' },
  // The OpenAI model Pri's server already uses for its display-only working
  // hints (server/platform/workingProvider.js). Prices are not recorded here:
  // the report gives its token counts, not a guessed dollar figure.
  terra: { provider: 'openai', id: 'gpt-5.6-terra', label: 'OpenAI gpt-5.6-terra (Pri server model)', inPerM: null, outPerM: null, effort: 'high' },
};

// ── Corpus and SymPy ground truth ───────────────────────────────────────────
const corpusDir = join(HERE, 'corpus');
const items = readdirSync(corpusDir).filter(f => f.endsWith('.jsonl')).sort()
  .flatMap(f => readFileSync(join(corpusDir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const limit = Number(arg('limit', 0));
const pool = limit ? items.slice(0, limit) : items;
const corpusFile = join(HERE, 'results', 'corpus.all.jsonl');
mkdirSync(join(HERE, 'results'), { recursive: true });
writeFileSync(corpusFile, pool.map(i => JSON.stringify(i)).join('\n') + '\n');
const truth = Object.fromEntries(execFileSync(PY, [join(HERE, 'truth.py'), corpusFile], { encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n').filter(Boolean).map(l => JSON.parse(l)).map(t => [t.id, t]));
const judged = pool.filter(i => truth[i.id]?.status === 'judged');
const excluded = pool.filter(i => truth[i.id]?.status !== 'judged');

// ── Contender 1: the deterministic engine ───────────────────────────────────
const { stepCheck } = await import(join(ROOT, 'client', 'src', 'engine', 'checker.js'));
function engineMark(item) {
  const rep = stepCheck(item.meta, item.lines.join('\n'), { prompt: item.prompt });
  const st = (rep?.lines || []).map(l => l?.status);
  // A ticked line whose note tells the student a solution is still missing
  // ("True for x = 5 — the equation has 2 solutions, and the other is still to
  // find") is not credit for a complete step: the student is told it is
  // incomplete, and the final answer is marked incomplete. Score it as flagged.
  const incomplete = (rep?.lines || []).map(l => /still to find/.test(String(l?.note || '')));
  const verdicts = item.lines.map((_, i) => {
    if (i === 0 && item.kind !== 'derivative') return 'given';
    const s = st[i];
    if (s === 'ok' && incomplete[i]) return 'invalid';
    return s === 'ok' ? 'valid' : s === 'break' ? 'invalid' : 'abstain';
  });
  const anyBreak = verdicts.includes('invalid');
  const lastOk = verdicts[verdicts.length - 1] === 'valid' || (verdicts.length === 1 && verdicts[0] === 'given');
  const solution = anyBreak ? 'incorrect' : lastOk ? 'correct' : 'abstain';
  const fb = verdicts.findIndex(v => v === 'invalid');
  return { verdicts, solution, firstBreak: fb < 0 ? null : fb };
}

// ── Contender 2..n: frontier LLM graders ────────────────────────────────────
const SYSTEM = `You are an exacting senior mathematics examiner marking a student's handwritten working, which has been transcribed into text for you. Correctness matters more than anything: never give credit to a step that is not mathematically valid, and never take credit away from a valid step, including valid alternative methods.

For each numbered line, decide:
- "valid": the line follows correctly from the line immediately before it (for "differentiate" tasks: the line is a correct expression for the derivative of the given function);
- "invalid": it does not;
- "cannot_verify": you genuinely cannot decide.
Line 1 of a non-differentiation task is the student's starting statement: judge only whether it correctly restates the question.
After the first invalid line, still judge each later line only against the line immediately before it.
Then give the 1-based number of the first invalid line (or null), whether the final answer is correct, and whether the whole solution is fully correct (no invalid line AND a correct final answer).`;

function userPrompt(item) {
  const task = item.kind === 'derivative' ? `${item.prompt} (Each line below is the student's expression for the derivative.)` : item.prompt;
  return `Question: ${task}\n\nStudent's working:\n${item.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['lines', 'first_invalid_line', 'final_answer_correct', 'solution_fully_correct'],
  properties: {
    lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['line', 'verdict'],
      properties: { line: { type: 'integer' }, verdict: { type: 'string', enum: ['valid', 'invalid', 'cannot_verify'] } } } },
    first_invalid_line: { type: ['integer', 'null'] },
    final_answer_correct: { type: 'boolean' },
    solution_fully_correct: { type: 'boolean' },
  },
};

function readVerdict(item, out, ms, usage) {
  const byLine = Object.fromEntries((out.lines || []).map(l => [l.line, l.verdict]));
  const verdicts = item.lines.map((_, i) => {
    if (i === 0 && item.kind !== 'derivative') return 'given';
    const v = byLine[i + 1];
    return v === 'valid' ? 'valid' : v === 'invalid' ? 'invalid' : 'abstain';
  });
  return { ms, usage, verdicts, solution: out.solution_fully_correct ? 'correct' : 'incorrect',
    firstBreak: typeof out.first_invalid_line === 'number' ? out.first_invalid_line - 1 : null };
}

// OpenAI Responses API, the same endpoint and structured-output form Pri's
// server uses. Key: OPENAI_API_KEY for this process only.
async function openaiMark(model, item) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: model.id,
      reasoning: { effort: model.effort },
      instructions: SYSTEM,
      input: userPrompt(item),
      text: { format: { type: 'json_schema', name: 'marking', strict: true, schema } },
    }),
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const body = await res.json();
  const usage = { input: body.usage?.input_tokens || 0, output: body.usage?.output_tokens || 0 };
  const text = body.output_text ?? (body.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
  const refusal = (body.output || []).flatMap(o => o.content || []).some(c => c.type === 'refusal');
  if (refusal) return { refusal: true, ms, usage, verdicts: item.lines.map(() => 'abstain'), solution: 'abstain', firstBreak: null };
  try { return readVerdict(item, JSON.parse(text), ms, usage); }
  catch { return { parseError: true, ms, usage, verdicts: item.lines.map(() => 'abstain'), solution: 'abstain', firstBreak: null }; }
}

let client = null;
async function llmMark(model, item) {
  if (model.provider === 'openai') return openaiMark(model, item);
  if (!client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic({ maxRetries: 4, timeout: 15 * 60 * 1000 });
  }
  const t0 = Date.now();
  const res = await client.messages.create({
    model: model.id,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: model.effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: userPrompt(item) }],
  });
  const ms = Date.now() - t0;
  const usage = { input: res.usage?.input_tokens || 0, output: res.usage?.output_tokens || 0 };
  if (res.stop_reason === 'refusal') return { refusal: true, ms, usage, verdicts: item.lines.map(() => 'abstain'), solution: 'abstain', firstBreak: null };
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let out;
  try { out = JSON.parse(text); } catch { return { parseError: true, ms, usage, verdicts: item.lines.map(() => 'abstain'), solution: 'abstain', firstBreak: null }; }
  const byLine = Object.fromEntries((out.lines || []).map(l => [l.line, l.verdict]));
  const verdicts = item.lines.map((_, i) => {
    if (i === 0 && item.kind !== 'derivative') return 'given';
    const v = byLine[i + 1];
    return v === 'valid' ? 'valid' : v === 'invalid' ? 'invalid' : 'abstain';
  });
  return {
    ms, usage, verdicts,
    solution: out.solution_fully_correct ? 'correct' : 'incorrect',
    firstBreak: typeof out.first_invalid_line === 'number' ? out.first_invalid_line - 1 : null,
  };
}

async function runPool(tasks, n) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }));
  return results;
}

// ── Scoring against SymPy ───────────────────────────────────────────────────
function score(name, marks) {
  const s = { name, items: 0, wrongSolutions: 0, correctSolutions: 0, falseCreditSolutions: 0, falseRejectSolutions: 0,
    abstainOnCorrect: 0, abstainOnWrong: 0, firstBreakExact: 0, firstBreakTotal: 0,
    invalidLines: 0, falseCreditLines: 0, validLines: 0, falseRejectLines: 0, abstainLines: 0, examples: [] };
  for (const item of judged) {
    const m = marks[item.id]; if (!m) continue;
    const t = truth[item.id];
    s.items++;
    if (t.solutionCorrect) {
      s.correctSolutions++;
      if (m.solution === 'incorrect') { s.falseRejectSolutions++; if (s.examples.length < 40) s.examples.push({ kind: 'false-reject', id: item.id }); }
      if (m.solution === 'abstain') s.abstainOnCorrect++;
    } else {
      s.wrongSolutions++;
      if (m.solution === 'correct') { s.falseCreditSolutions++; s.examples.push({ kind: 'FALSE-CREDIT', id: item.id }); }
      if (m.solution === 'abstain') s.abstainOnWrong++;
      if (t.firstBreak !== null) { s.firstBreakTotal++; if (m.firstBreak === t.firstBreak) s.firstBreakExact++; }
    }
    t.labels.forEach((lab, i) => {
      if (lab === 'given') return;
      const v = m.verdicts[i];
      // Before the first break, a line is either a valid/implied step or the break itself.
      if (t.firstBreak !== null && i > t.firstBreak) return;
      if (lab === 'invalid') { s.invalidLines++; if (v === 'valid') s.falseCreditLines++; }
      else { s.validLines++; if (v === 'invalid') s.falseRejectLines++; }
      if (v === 'abstain') s.abstainLines++;
    });
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  s.rates = {
    falseCreditSolutions: pct(s.falseCreditSolutions, s.wrongSolutions),
    falseRejectSolutions: pct(s.falseRejectSolutions, s.correctSolutions),
    firstBreakExact: pct(s.firstBreakExact, s.firstBreakTotal),
    falseCreditLines: pct(s.falseCreditLines, s.invalidLines),
    falseRejectLines: pct(s.falseRejectLines, s.validLines),
    abstainOnCorrect: pct(s.abstainOnCorrect, s.correctSolutions),
    abstainOnWrong: pct(s.abstainOnWrong, s.wrongSolutions),
  };
  return s;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const report = { date: new Date().toISOString().slice(0, 10), commit: execFileSync('git', ['rev-parse', '--short=9', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  corpus: { total: pool.length, judged: judged.length, excluded: excluded.map(i => ({ id: i.id, status: truth[i.id]?.status })) }, contenders: [] };

const engineMarks = Object.fromEntries(judged.map(i => [i.id, engineMark(i)]));
report.contenders.push(score('Pri deterministic engine', engineMarks));
writeFileSync(join(HERE, 'results', 'engine.json'), JSON.stringify(engineMarks, null, 1));

if (!flag('engine-only')) {
  const names = arg('models', 'fable,opus,terra').split(',');
  for (const n of names) {
    const need = MODELS[n]?.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    if (!MODELS[n]) { console.error(`Unknown model ${n}`); process.exit(2); }
    if (!process.env[need]) { console.error(`No ${need} for ${n}: load the key for this process, or leave ${n} out of --models.`); process.exit(2); }
  }
  const conc = Number(arg('concurrency', 6));
  for (const name of names) {
    const model = MODELS[name];
    const cacheFile = join(HERE, 'results', `${name}.run1.jsonl`);
    const done = existsSync(cacheFile) ? Object.fromEntries(readFileSync(cacheFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(r => [r.id, r])) : {};
    const todo = judged.filter(i => !done[i.id]);
    console.error(`${model.label}: ${todo.length} to mark (${Object.keys(done).length} cached)`);
    await runPool(todo.map(item => async () => {
      try { const r = { id: item.id, ...(await llmMark(model, item)) }; appendFileSync(cacheFile, JSON.stringify(r) + '\n'); done[item.id] = r; }
      catch (e) { console.error(`${model.label} ${item.id}: ${e?.status || ''} ${String(e?.message || e).slice(0, 160)}`); }
    }), conc);
    const sc = score(model.label, done);
    const tokens = Object.values(done).reduce((a, r) => ({ input: a.input + (r.usage?.input || 0), output: a.output + (r.usage?.output || 0) }), { input: 0, output: 0 });
    sc.cost = model.inPerM == null ? { ...tokens, usd: null, note: 'price not recorded; tokens only' }
      : { ...tokens, usd: +(tokens.input / 1e6 * model.inPerM + tokens.output / 1e6 * model.outPerM).toFixed(2), perItemUsd: +((tokens.input / 1e6 * model.inPerM + tokens.output / 1e6 * model.outPerM) / Math.max(1, Object.keys(done).length)).toFixed(4) };
    const lat = Object.values(done).map(r => r.ms).filter(Boolean).sort((a, b) => a - b);
    sc.latencyMs = { median: lat[Math.floor(lat.length / 2)] || null, p90: lat[Math.floor(lat.length * 0.9)] || null };
    sc.refusals = Object.values(done).filter(r => r.refusal).length;
    sc.parseErrors = Object.values(done).filter(r => r.parseError).length;

    // Consistency: re-mark a fixed sample and compare solution verdicts.
    const reruns = Number(arg('reruns', 1));
    if (reruns > 1) {
      const sample = judged.slice(0, Number(arg('rerun-sample', 30)));
      let same = 0, total = 0;
      for (let r = 2; r <= reruns; r++) {
        const rf = join(HERE, 'results', `${name}.run${r}.jsonl`);
        const prev = existsSync(rf) ? Object.fromEntries(readFileSync(rf, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(x => [x.id, x])) : {};
        await runPool(sample.filter(i => !prev[i.id]).map(item => async () => {
          try { const x = { id: item.id, ...(await llmMark(model, item)) }; appendFileSync(rf, JSON.stringify(x) + '\n'); prev[item.id] = x; } catch {}
        }), conc);
        for (const item of sample) if (prev[item.id] && done[item.id]) { total++; if (prev[item.id].solution === done[item.id].solution) same++; }
      }
      sc.consistency = total ? (100 * same / total).toFixed(1) + `% of ${total} re-marks gave the same solution verdict` : 'n/a';
    }
    report.contenders.push(sc);
  }
}
report.contenders[0].consistency = '100% (deterministic: same input, same output)';
report.contenders[0].cost = { usd: 0, note: 'runs on our own server' };

writeFileSync(join(HERE, 'results', 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.contenders.map(c => ({ name: c.name, items: c.items, ...c.rates, consistency: c.consistency, cost: c.cost?.usd, refusals: c.refusals })), null, 1));
