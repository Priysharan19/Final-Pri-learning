#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pri Learning · the AI line check, OFFLINE EVALUATION (never run by CI; calls the real provider)
//
// Decides whether the layer (server/platform/aiLineCheck) can be switched on. It builds pages, runs the real engine over them (the server's marking
// path), asks the provider ONCE per page through the layer's own code, and measures:
//   · of the engine-open TRUE lines: share AI-checked correct / flagged wrong (false alarm) / cannot_tell (or no answer) / engine-proved by the veto
//   · of the planted WRONG lines the engine missed: share the model flags vs calls correct (THE critical number: the AI wrong-tick rate),
//     and the RESIDUAL rate after the engine veto
//   · latency and tokens per page; the comments, verbatim, for a hand check
//
// Pages (synthetic ones are STUDENT-STYLE, built from each question's own authored solution: SYNTHETIC, not evidence about real students):
//   · the product-rule page (the owner's, in the task of 27 Nov 2026), and the owner's real pages when --real <dir> names the reader outputs
//   · per question: a TRUE page, and TWO pages with ONE planted error each (wrong arithmetic, sign, derivative/integral term, substitution, formula, conclusion)
//
// RUN (from the repository root; the provider key comes from the Railway environment and is never printed, logged or written):
//   railway run --service Final-Pri-learning --environment production -- node tools/ai-line-check-eval.mjs --out <dir> [--real <dir>] [--budget 400] [--questions 120] [--plan]
//   --plan   builds every page, runs the ENGINE only, makes NO provider call, prints the page and line counts
// Every provider response is cached under --out, so a re-run costs no call. A hard counter refuses any call over --budget.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { loadWorld, authoredLines, genToPlain, bankToPlain, keyText } from './annotation-coverage.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const OUT = flag('out');
const PLAN = flag('plan') === true;
const BUDGET = Number(flag('budget') || 400);
const NQ = Number(flag('questions') || 130);
const TIME = Number(flag('time') || 0);          // stop asking new pages after this many seconds (re-run to continue: every answer is cached)
const PAR = Math.max(1, Math.min(6, Number(flag('parallel') || 4)));
const T0 = Date.now();
const REAL = typeof flag('real') === 'string' ? flag('real') : null;
if (!OUT) { console.error('--out <dir> is required'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const { MARKER_OPS, markerView } = await import('../server/platform/markerOps.js');
const { adoptProved } = await import('../client/src/engine/provedLines.js');
const AI = await import('../server/platform/aiLineCheck/index.js');
const { parseResponse } = await import('../server/platform/aiLineCheck/schema.js');
const { engineCheckLine } = await import('../server/platform/aiLineCheck/veto.js');
const { aiLineCheckConfig } = AI;
const EX = await import('../client/src/engine/expr.js');

// ── topics ───────────────────────────────────────────────────────────────────
const TOPICS = [
  ['Functions and graphs', /functions|quadfunc|polynomials|poly\b|transform|func-model|^me11-poly|function/],
  ['Coordinate geometry', /lines|coordinate|geometry/],
  ['Trigonometry', /trig|sine-cosine|inversetrig|trigid|trigeq|trig-ident|trigcalc/],
  ['Exponentials and logarithms', /explog|exponential|logarithm/],
  ['Differentiation', /diff|rates|me12-calc|further-calc|appdiff|derivative/],
  ['Integration', /integration|integral|integr|area/],
  ['Series and finance', /series|financial|fin-exact|sequence|arith|geom|finance/],
  ['Probability and statistics', /probability|stats|random-var|data-sets|statistic|binomial-dist|prob/],
  ['Motion and projectiles', /motion|projectile|kinematic/],
  ['Vectors', /vector/],
  ['Induction', /induction/],
  ['Binomial and counting', /binomial|comb|counting|permut/]
];
const BANK_TOPIC = {
  'a11-ma-c1': 'Differentiation', 'a11-ma-e1': 'Exponentials and logarithms', 'a11-ma-f1': 'Functions and graphs', 'a11-ma-s1': 'Probability and statistics', 'a11-ma-t1': 'Trigonometry', 'a11-ma-t2': 'Trigonometry',
  'a12-ma-c2': 'Differentiation', 'a12-ma-c3': 'Differentiation', 'a12-ma-c4': 'Integration', 'a12-ma-f2': 'Functions and graphs', 'a12-ma-m1': 'Series and finance', 'a12-ma-s2': 'Probability and statistics',
  'a12-ma-s3': 'Probability and statistics', 'a12-ma-t3': 'Trigonometry', 'x11-me-a1': 'Binomial and counting', 'x11-me-c1': 'Differentiation', 'x11-me-f1': 'Functions and graphs', 'x11-me-f2': 'Functions and graphs',
  'x11-me-t1': 'Trigonometry', 'x11-me-t2': 'Trigonometry', 'x12-me-c2': 'Integration', 'x12-me-c3': 'Motion and projectiles', 'x12-me-s1': 'Probability and statistics', 'x12-me-t3': 'Trigonometry', 'x12-me-v1': 'Vectors'
};
const topicOf = id => BANK_TOPIC[String(id).replace(/^qb-/, '')] || (TOPICS.find(([, re]) => re.test(String(id).toLowerCase())) || ['Other', null])[0];

// ── planting one error ───────────────────────────────────────────────────────
const lastNumber = /(-?\d+(?:\.\d+)?)(?!.*\d)/;
function nudge(n) { const v = Number(n); const w = Number.isInteger(v) ? (Math.abs(v) < 10 ? v + 1 : v + 2) : Math.round((v + 0.5) * 100) / 100; return String(w); }
const MUTATORS = {
  arithmetic: line => { if (!/=/.test(line)) return null; const m = lastNumber.exec(line); return m ? line.slice(0, m.index) + nudge(m[1]) + line.slice(m.index + m[1].length) : null; },
  sign: line => { const i = line.search(/[+-](?=\s*\d|\s*[a-z(])/); if (i < 0) return null; const flip = line[i] === '+' ? '-' : '+'; return line.slice(0, i) + flip + line.slice(i + 1); },
  derivative: line => { const m = /(\d*)([a-z])\^(\d+)/.exec(line); if (m) return line.slice(0, m.index) + `${m[1]}${m[2]}^${Number(m[3]) + 1}` + line.slice(m.index + m[0].length); const c = /(\d+)(?=[a-z])/.exec(line); return c ? line.slice(0, c.index) + (Number(c[1]) + 1) + line.slice(c.index + c[1].length) : null; },
  substitution: line => { const m = /\((-?\d+(?:\.\d+)?)\)/.exec(line); if (m) return line.slice(0, m.index) + `(${nudge(m[1])})` + line.slice(m.index + m[0].length); const b = /\b([a-z])\s*=\s*(-?\d+(?:\.\d+)?)/.exec(line); return b ? line.slice(0, b.index) + `${b[1]} = ${nudge(b[2])}` + line.slice(b.index + b[0].length) : null; },
  formula: line => { if (/\bsin\b/.test(line)) return line.replace(/\bsin\b/, 'cos'); if (/\bcos\b/.test(line)) return line.replace(/\bcos\b/, 'sin'); if (/\*/.test(line)) return line.replace('*', '+'); const i = line.search(/[+](?=\s)/); if (i >= 0) return line.slice(0, i) + '*' + line.slice(i + 1); return /\^2/.test(line) ? line.replace('^2', '^3') : null; },
  conclusion: line => { const m = lastNumber.exec(line); return m ? line.slice(0, m.index) + nudge(m[1]) + line.slice(m.index + m[1].length) : null; }
};
const ORDER = ['arithmetic', 'sign', 'derivative', 'substitution', 'formula', 'conclusion'];
const norm = s => String(s).replace(/\s+/g, '');
function equivalentSides(a, b) {
  // true when the last side of a and of b are provably the same expression (then the "mutation" changed nothing)
  const last = t => String(t).split('=').pop().trim();
  try { return EX.exprEquivalent(EX.normalize(last(a)), EX.normalize(last(b))) === true; } catch { return false; }
}
function plant(lines, kind, rnd) {
  const idxs = lines.map((l, i) => i).filter(i => (kind === 'conclusion' ? i === lines.length - 1 : i < lines.length - (lines.length > 3 ? 1 : 0)));
  const order = kind === 'conclusion' ? idxs : idxs.slice().sort(() => rnd() - 0.5);
  for (const i of order) {
    const out = MUTATORS[kind](lines[i]);
    if (!out || norm(out) === norm(lines[i]) || equivalentSides(out, lines[i])) continue;
    const page = lines.slice(); page[i] = out;
    return { page, at: i, kind };
  }
  return null;
}
const rngOf = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const hash32 = s => parseInt(crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8), 16);

// ── student style: the words and labels a student writes around the maths ────
const PREFIX = ['So ', 'Therefore ', 'Hence ', 'Then ', 'Now ', 'We get '];
function style(lines, seed) {
  const rnd = rngOf(hash32(seed));
  return lines.map((l, i) => {
    if (i === 0 && lines.length > 2) return l;
    if (i === lines.length - 1) return rnd() < 0.7 ? `Therefore ${l.replace(/^=\s*/, '')}` : l;
    const r = rnd();
    if (r < 0.34) return /^=/.test(l) ? l : `${PREFIX[Math.floor(rnd() * PREFIX.length)]}${l}`;
    if (r < 0.55) return /^=/.test(l) ? l : `Step ${i + 1}: ${l}`;
    return l;
  });
}

// ── the engine, as the submit route runs it ───────────────────────────────────
function engineOf(q, answer, lines) {
  const r = MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const ev = r?.evidence || {};
  const shown = ev.shownReport ? (ev.stepReport ? adoptProved(ev.stepReport, ev.shownReport) : ev.shownReport) : ev.stepReport || null;
  return { correct: r?.result?.correct === true, invalid: r?.result?.invalid === true, report: shown, stepReport: ev.stepReport || null, marks: JSON.stringify(ev.partial ?? null) };
}
const sentenceOf = (q, key) => `Answer: ${key}\n${(Array.isArray(q.steps) ? q.steps : []).slice(0, 14).map(s => `${String(s?.h ?? '')}: ${String(s?.d ?? '')}`).join('\n')}`;

// ── the world ────────────────────────────────────────────────────────────────
const W = await loadWorld();
const G = W.G;
const questions = [];
const usable = (q, toPlain) => { const { lines } = authoredLines(q, toPlain); return lines.length >= 2 && lines.length <= 14 ? lines : null; };
const genIds = W.ledger.filter(e => /^(y11|y12|me11|me12)-/.test(e.generator) && e.issued).map(e => e.generator);
for (const [seed, diff] of [[11, 3], [12, 2], [13, 3], [14, 2], [15, 3], [16, 2]]) {
  for (const g of genIds) {
    if (questions.filter(x => x.family === g).length >= 2) continue;
    let q; try { q = markerView(G.generateQuestion(g, diff, seed)); } catch { continue; }
    const lines = usable(q, genToPlain);
    const key = keyText(q);
    if (!lines || !key || ['mcq', 'multi-mcq', 'matrix-match', 'manual', 'graph-sketch', 'working'].includes(q.answerType)) continue;
    if (questions.some(x => x.family === g && x.prompt === q.prompt)) continue;
    questions.push({ id: `gen:${g}:${diff}:${seed}`, kind: 'generated', family: g, topic: topicOf(g), q, lines, key, prompt: q.prompt });
  }
}
// the author's bank: spread across its families
const bank = W.pack.qbankEntries().filter(e => e.place);
const byFamily = new Map();
for (const e of bank) { if (!byFamily.has(e.family)) byFamily.set(e.family, []); byFamily.get(e.family).push(e); }
const families = [...byFamily.keys()].sort();
const bankWanted = Math.max(0, NQ - questions.length);
for (let round = 0; questions.filter(x => x.kind === 'bank').length < bankWanted && round < 12; round++) {
  for (const fam of families) {
    if (questions.filter(x => x.kind === 'bank').length >= bankWanted) break;
    const list = byFamily.get(fam);
    const e = list[(hash32(fam) + round * 7) % list.length];
    if (questions.some(x => x.id === `bank:${e.entry.id}`)) continue;
    let q; try { q = markerView(W.pack.qbankEntryQuestion(e.entry.id, 17)); } catch { continue; }
    const lines = usable(q, bankToPlain);
    const key = keyText(q);
    if (!lines || !key || ['mcq', 'multi-mcq', 'matrix-match', 'manual', 'graph-sketch', 'working'].includes(q.answerType)) continue;
    questions.push({ id: `bank:${e.entry.id}`, kind: 'bank', family: fam, topic: topicOf(fam.replace(/^qb-/, '')), q, lines, key, prompt: q.prompt });
  }
}
questions.length = Math.min(questions.length, NQ);

// ── pages ────────────────────────────────────────────────────────────────────
const pages = [];
const PRODUCT = {
  id: 'owner:product-rule', kind: 'owner', label: 'the product-rule page', topic: 'Differentiation', key: '-18', wrongLines: [],
  q: { id: 'owner-product-rule', answerType: 'numeric', answer: { value: -18 }, prompt: 'Use the product rule to find the gradient of $y = (4x - 3)(2x + 1)$ at the point where $x = -1$.', steps: [] },
  lines: ['Use the product rule to find the gradient of y = (4x−3)(2x+1)', 'at the point where x = −1.', 'Let u = 4x − 3, v = 2x + 1', 'dy/dx = u′v + uv′', '= 4(2x+1) + (4x−3)(2)', '= 8x + 4 + 8x − 6', '= 16x − 2', 'At x = −1:', 'dy/dx = 16(−1) − 2', '= −16 − 2', '= −18', 'Gradient = −18']
};
pages.push({ ...PRODUCT, version: 'owner' });
if (REAL) {
  const wrong = { real43: [8] };   // the one false line on the owner's real pages: "= 3x^2 - x" (it is 3x^2 - 2x); every other line of the other pages is true by my own check
  const keys = { 'real-key6': '6', 'real-key12': '12', real47: '(x^2+8)^6 + C', real48: '13040', real43: '3x^2 - 2x' };
  for (const id of ['real-key6', 'real-key12', 'real47', 'real48', 'real43']) {
    const f = path.join(REAL, `${id}.json`);
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    const numeric = ['real-key6', 'real-key12', 'real48'].includes(id);
    const q = { id: `owner-${id}`, answerType: numeric ? 'numeric' : 'expression', answer: numeric ? { value: Number(keys[id]) } : { expr: keys[id] }, prompt: d.question.prompt, steps: [] };
    pages.push({ id: `owner:${id}`, kind: 'owner', label: id, topic: topicOf(id === 'real47' ? 'integration' : id === 'real48' ? 'series' : 'diff'), q, key: keys[id], lines: d.reading.lines.map(l => String(l.text)), wrongLines: wrong[id] || [], version: 'owner' });
  }
}
const planted = [];
for (const item of questions) {
  pages.push({ id: `${item.id}:true`, kind: item.kind, label: item.id, topic: item.topic, family: item.family, q: item.q, key: item.key, lines: style(item.lines, `${item.id}:true`), wrongLines: [], version: 'true' });
  const rnd = rngOf(hash32(item.id));
  const kinds = ORDER.slice().sort(() => rnd() - 0.5);
  let made = 0;
  for (const kind of kinds) {
    if (made >= 2) break;
    const p = plant(item.lines, kind, rnd);
    if (!p) continue;
    made++;
    const styled = style(p.page, `${item.id}:${kind}`);
    // the planted line keeps its own text under the styling, so the label of the wrong line is its index
    pages.push({ id: `${item.id}:${kind}`, kind: item.kind, label: item.id, topic: item.topic, family: item.family, q: item.q, key: kind === 'conclusion' ? (lastNumber.exec(p.page[p.page.length - 1])?.[1] ?? item.key) : item.key, lines: styled, wrongLines: [p.at], version: kind });
    planted.push(kind);
  }
}

// ── the engine over every page, no provider call ─────────────────────────────
for (const pg of pages) {
  const e = engineOf(pg.q, pg.key, pg.lines);
  pg.engine = e;
  pg.open = AI.openIndices(e.report, pg.lines);
}
const countBy = (xs, f) => xs.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const synth = pages.filter(p => p.kind !== 'owner');
console.log(`pages ${pages.length} (synthetic ${synth.length} from ${questions.length} questions: ${questions.filter(x => x.kind === 'generated').length} generated, ${questions.filter(x => x.kind === 'bank').length} bank; owner ${pages.length - synth.length}); topics ${Object.keys(countBy(questions, x => x.topic)).length}`);
console.log('questions per topic', JSON.stringify(countBy(questions, x => x.topic)));
console.log('planted errors by type', JSON.stringify(countBy(planted, x => x)));
console.log(`engine-open lines: ${pages.reduce((n, p) => n + p.open.length, 0)} over ${pages.filter(p => p.open.length).length} pages`);
if (PLAN) process.exit(0);

// ── the provider, counted ────────────────────────────────────────────────────
const COUNT_FILE = path.join(OUT, 'calls.json');
const counter = fs.existsSync(COUNT_FILE) ? JSON.parse(fs.readFileSync(COUNT_FILE, 'utf8')) : { calls: 0 };
const realFetch = globalThis.fetch;
const als = new AsyncLocalStorage();
globalThis.fetch = async (url, init) => {
  const current = als.getStore();
  if (!current) throw new Error('no page in flight');
  if (counter.calls >= BUDGET) throw new Error('call budget spent');
  counter.calls++;
  fs.writeFileSync(COUNT_FILE, JSON.stringify(counter));
  const started = Date.now();
  const res = await realFetch(url, init);
  const text = await res.text();
  current.raw = { status: res.status, text, ms: Date.now() - started };
  return new Response(text, { status: res.status, headers: res.headers });
};
const evalEnv = { ...process.env, PRI_FEATURE_AI_LINE_CHECK: '1', PRI_EDITION: 'prithagoras' };
const cfg = aiLineCheckConfig(evalEnv);
if (!cfg.usable) { console.error('the provider is not configured in this environment'); process.exit(2); }
console.log(`model ${cfg.model}, reasoning effort ${cfg.reasoningEffort}, timeout ${cfg.timeoutMs} ms, budget ${BUDGET}, calls so far ${counter.calls}`);

const ablationNoRef = new Set();   // pages also asked WITHOUT the reference (set below)
const results = [];
async function ask(pg, { reference }) {
  const tag = `${pg.id}|${reference ? 'ref' : 'noref'}`.replace(/[^A-Za-z0-9_.|:-]/g, '_');
  const cacheFile = path.join(OUT, 'cache', `${crypto.createHash('sha256').update(tag).digest('hex').slice(0, 24)}.json`);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  AI.clearCache();
  const current = { raw: null };
  const stats = {};
  const e = pg.engine;
  const submitted = /^-?\d+(?:\.\d+)?$/.test(String(pg.key)) ? Number(pg.key) : null;
  const answer = { key: pg.q.answerType === 'numeric' && Number.isFinite(Number(pg.q.answer?.value)) ? { kind: 'numeric', value: Number(pg.q.answer.value) } : null, correct: pg.version === 'conclusion' ? false : e.correct, submitted };
  let result = null, error = null;
  try {
    result = await als.run(current, () => AI.runAiLineCheck({ question: pg.q, questionId: pg.id, working: pg.lines.join('\n'), report: e.report, reference: reference ? sentenceOf(pg.q, pg.key) : `Answer: ${pg.key}`, answer, env: evalEnv, stats }));
  } catch (err) { error = String(err?.message || err).slice(0, 80); }
  const raw = current.raw;
  const out = { id: pg.id, reference, result, raw: raw ? { status: raw.status, text: raw.text, ms: raw.ms } : null, stats, error };
  // an answer is kept only when the provider answered; a refusal or a network error is asked again on the next run (and counted)
  if (raw && raw.status === 200) fs.writeFileSync(cacheFile, JSON.stringify(out));
  return out;
}

// every page, with the reference; then the ablation (without) on a fixed subset. The first page is asked alone (a reasoning model may refuse `temperature`: one retry, remembered), then PAR at a time.
const todo = pages.filter(p => p.open.length).map(pg => ({ pg, reference: true }));
const candidates = pages.filter(p => p.kind !== 'owner' && p.open.length);
const first16 = candidates.filter((p, i) => i % 23 === 0).slice(0, 16);
// the ablation: the same page asked WITHOUT the worked solution (only the key); 16 first, then up to EXTRA more (wrong pages every 6th, true pages every 5th)
const EXTRA = Number(flag('ablate-extra') || 0);
const extra = candidates.filter(p => !first16.includes(p)).filter((p, j) => (p.version === 'true' ? j % 5 === 0 : j % 6 === 0)).slice(0, EXTRA);
const ablate = [...first16, ...extra];
for (const pg of ablate) { ablationNoRef.add(pg.id); todo.push({ pg, reference: false }); }
let done = 0, stopped = false;
const worker = async queue => {
  while (queue.length) {
    const job = queue.shift();
    if (counter.calls >= BUDGET) { stopped = true; return; }
    if (TIME && (Date.now() - T0) / 1000 > TIME) { stopped = true; return; }
    results.push({ pg: job.pg, ...(await ask(job.pg, { reference: job.reference })) });
    if (++done % 25 === 0) console.log(`  ${done} answers, ${counter.calls} calls`);
  }
};
await worker(todo.splice(0, 1));
await Promise.all(Array.from({ length: PAR }, () => worker(todo)));
if (stopped || todo.length) { console.log(`STOPPED with ${todo.length} still to ask; ${counter.calls} provider calls so far. Run the same command again to continue.`); process.exit(3); }
console.log(`asked ${done} answers (${ablationNoRef.size} without the reference); ${counter.calls} provider calls in all`);

// ── measures ─────────────────────────────────────────────────────────────────
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/a');
function lineFacts(r) {
  const pg = r.pg;
  const text = r.raw?.status === 200 ? (() => { try { const j = JSON.parse(r.raw.text); return j?.output_text ?? j?.output?.flatMap(x => x?.content || []).find(p => typeof p?.text === 'string')?.text ?? ''; } catch { return ''; } })() : '';
  const parsed = parseResponse(text, { asked: pg.open, lines: pg.lines });
  // The shown result is recomputed from the stored provider answer by the layer's own deterministic code (the veto, the verifier, the sanitiser), so a fix to
  // that code is measured without another provider call.
  const submittedKey = /^-?\d+(?:\.\d+)?$/.test(String(pg.key)) ? Number(pg.key) : null;
  const answer = { key: pg.q.answerType === 'numeric' && Number.isFinite(Number(pg.q.answer?.value)) ? { kind: 'numeric', value: Number(pg.q.answer.value) } : null, correct: pg.version === 'conclusion' ? false : pg.engine.correct, submitted: submittedKey };
  const decided = r.raw?.status === 200 ? AI.decide({ question: pg.q, lines: pg.lines, report: pg.engine.report, parsed, open: pg.open, reference: r.reference ? sentenceOf(pg.q, pg.key) : `Answer: ${pg.key}`, answer }) : [];
  const final = new Map(decided.map(x => [x.index, x]));
  return pg.open.map(i => {
    const raw = parsed.get(i)?.verdict || 'none';
    const f = final.get(i);
    const shown = f ? f.kind : 'nothing';
    const wrongLine = pg.wrongLines.includes(i);
    const veto = engineCheckLine(pg.lines[i], { above: pg.lines.slice(0, i), prompt: pg.q.prompt });
    return { page: pg.id, version: pg.version, kind: pg.kind, topic: pg.topic, index: i, text: pg.lines[i], truth: wrongLine ? 'wrong' : 'true', raw, shown, comment: f?.comment ?? null, generic: f?.generic ?? null, vetoed: raw === 'correct' && !f && !!veto.refuted, ref: r.reference };
  });
}
const rows = results.flatMap(lineFacts);
const main = rows.filter(r => r.ref);
const trueOpen = main.filter(r => r.truth === 'true' && r.kind !== 'owner' ? (r.version === 'true') : false);
const trueOpenAll = main.filter(r => r.truth === 'true' && r.version === 'true');
// a planted page's non-planted lines are consistent with the original solution but not with the planted line above: not scored
const wrongOpen = main.filter(r => r.truth === 'wrong' && r.kind !== 'owner');
const share = (set, f) => set.filter(f).length;
function table(set, wrong) {
  const n = set.length;
  const rawC = share(set, r => r.raw === 'correct'), rawI = share(set, r => r.raw === 'incorrect'), rawT = share(set, r => r.raw === 'cannot_tell' || r.raw === 'none');
  const aiC = share(set, r => r.shown === 'ai-checked'), doubt = share(set, r => r.shown === 'ai-doubt'), eng = share(set, r => r.shown === 'engine-proved'), none = share(set, r => r.shown === 'nothing');
  const vetoed = share(set, r => r.vetoed);
  return { n, rawCorrect: rawC, rawIncorrect: rawI, rawCannotTell: rawT, vetoDropped: vetoed, shownAiChecked: aiC, shownDoubt: doubt, shownEngineProved: eng, shownNothing: none,
    rates: wrong
      ? { aiWrongTickRate: pct(rawC, n), aiFlagRate: pct(rawI, n), cannotTell: pct(rawT, n), residualWrongTickRate: pct(aiC + eng, n), residualFlagged: pct(doubt, n) }
      : { aiCheckedCorrect: pct(aiC, n), flaggedWrongFalseAlarm: pct(doubt, n), cannotTell: pct(none - vetoed < 0 ? 0 : none, n), engineProvedByVeto: pct(eng, n), rawFalseAlarm: pct(rawI, n), rawCorrect: pct(rawC, n) } };
}
const topics = [...new Set(main.map(r => r.topic))].sort();
const perTopic = Object.fromEntries(topics.map(t => [t, { true: table(trueOpenAll.filter(r => r.topic === t), false), wrong: table(wrongOpen.filter(r => r.topic === t), true) }]));
const byType = Object.fromEntries(ORDER.map(k => [k, table(wrongOpen.filter(r => r.version === k), true)]));
const latency = results.filter(r => r.stats?.latencyMs).map(r => r.stats.latencyMs).sort((a, b) => a - b);
const tok = results.filter(r => r.stats?.usage);
const sum = f => tok.reduce((n, r) => n + (f(r.stats.usage) || 0), 0);
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const perPage = {
  pagesWithAnswer: tok.length, latencyMs: { p50: q(latency, 0.5), p90: q(latency, 0.9), max: latency[latency.length - 1] ?? null, mean: latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : null },
  inputTokensMean: tok.length ? Math.round(sum(u => u.input_tokens) / tok.length) : null, outputTokensMean: tok.length ? Math.round(sum(u => u.output_tokens) / tok.length) : null,
  reasoningTokensMean: tok.length ? Math.round(sum(u => u.output_tokens_details?.reasoning_tokens) / tok.length) : null,
  totals: { input: sum(u => u.input_tokens), output: sum(u => u.output_tokens), reasoning: sum(u => u.output_tokens_details?.reasoning_tokens) }
};
const failed = results.filter(r => r.ref && !r.result);
const ablation = ['true', 'wrong'].map(truth => {
  const ids = [...ablationNoRef];
  const a = rows.filter(r => !r.ref && r.truth === truth && (truth === 'true' ? r.version === 'true' : r.kind !== 'owner'));
  const b = rows.filter(r => r.ref && ids.includes(r.page) && r.truth === truth && (truth === 'true' ? r.version === 'true' : r.kind !== 'owner'));
  return { truth, withoutReference: table(a, truth === 'wrong'), withReference: table(b, truth === 'wrong') };
});
const owner = rows.filter(r => r.ref && r.kind === 'owner');
const comments = main.filter(r => r.comment && r.generic === false);
const pick = (xs, n) => { const step = Math.max(1, Math.floor(xs.length / n)); return xs.filter((_, i) => i % step === 0).slice(0, n); };
const sample = [...pick(comments.filter(r => r.shown === 'ai-checked'), 22), ...pick(comments.filter(r => r.shown === 'ai-doubt'), 8)].map(r => ({ page: r.page, line: r.text, shown: r.shown, truth: r.truth, comment: r.comment }));
const summary = {
  made: new Date().toISOString().slice(0, 10), model: cfg.model, reasoningEffort: cfg.reasoningEffort, providerCalls: counter.calls, pages: pages.length, pagesAsked: done, failedCalls: failed.length,
  questions: questions.length, generated: questions.filter(x => x.kind === 'generated').length, bank: questions.filter(x => x.kind === 'bank').length,
  topicsCovered: topics.length,
  trueOpen: table(trueOpenAll, false), wrongOpen: table(wrongOpen, true), byErrorType: byType, perTopic, perPage, ablation,
  engineOnPlanted: { plantedLines: planted.length, engineCrossedPlanted: synth.filter(p => p.wrongLines.length).filter(p => p.engine.report?.lines?.[p.wrongLines[0]]?.status === 'break').length, engineTickedPlanted: synth.filter(p => p.wrongLines.length).filter(p => p.engine.report?.lines?.[p.wrongLines[0]]?.status === 'ok').length }
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(OUT, 'owner-pages.json'), JSON.stringify(owner, null, 1));
fs.writeFileSync(path.join(OUT, 'comment-sample.json'), JSON.stringify(sample, null, 1));
console.log(JSON.stringify({ trueOpen: summary.trueOpen, wrongOpen: summary.wrongOpen, perPage, failed: failed.length, engineOnPlanted: summary.engineOnPlanted }, null, 1));
