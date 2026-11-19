// Line interpreter evaluation over the understanding-audit corpus.
//
//   node tools/line-interpreter-eval/run.mjs [--limit N] [--json out.json] [--examples out.md]
//   railway run ... -- node tools/line-interpreter-eval/run.mjs --model 150 --json out.json   (model arm; see doc)
//
// SYNTHETIC: transcripts are built by rule from the generators' own authored
// solutions (tools/understanding-audit/corpus.mjs). No real student. The model
// arm only sees the question's PUBLIC description and the transcript lines.
import fs from 'node:fs';
import { stepMetaFor } from '../../server/platform/markerOps.js';
import { stepCheck } from '../../client/src/engine/checker.js';
import { SEEDS, EXTRA_SEEDS, editionOf, loadFamilies, questionsFor, transcriptsFor } from '../understanding-audit/corpus.mjs';
import { publicDescription } from '../../server/platform/lineInterpreter/givens.js';
import { ruleInterpretation } from '../../server/platform/lineInterpreter/rules.js';
import { interpretWithModel } from '../../server/platform/lineInterpreter/model.js';
import { verifyLines, TICKED } from '../../server/platform/lineInterpreter/verifier.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const HAS_MATHS = /[0-9=+\-*/^×÷√π]/;

function engineStatuses(q, lines) {
  const meta = stepMetaFor(q);
  if (!meta) return lines.map(() => 'unsupported');
  let report;
  try { report = stepCheck(meta, lines.join('\n'), { prompt: q.prompt }); } catch { return lines.map(() => 'error'); }
  const j = Array.isArray(report?.lines) ? report.lines : [];
  if (j.length !== lines.length) return lines.map(() => 'misaligned');
  return j.map(l => (l.status === 'ok' ? 'ok' : l.status === 'break' ? 'break' : 'silent'));
}

const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

export async function collect({ limit = Infinity } = {}) {
  const ids = (await loadFamilies()).slice(0, limit);
  const T = [];
  for (const id of ids) {
    let qs = questionsFor(id, SEEDS);
    if (qs.some(q => stepMetaFor(q))) qs = qs.concat(questionsFor(id, EXTRA_SEEDS));
    for (const q of qs) {
      for (const t of transcriptsFor(q)) {
        const texts = t.lines.map(l => l.text);
        const description = publicDescription(q);
        const rules = texts.map(x => ruleInterpretation(x, description));
        const answer = q.answerType === 'numeric' && Number.isFinite(Number(q.answer?.value)) ? { kind: 'numeric', value: Number(q.answer.value) } : null;
        const engine = engineStatuses(q, texts);
        T.push({ id, edition: editionOf(id), style: t.style, q, texts, truth: t.lines.map(l => l.truth), template: t.lines.map(l => !!l.template), description, rules, answer, engine });
      }
    }
  }
  return T;
}

export function score(T, { modelClaims = new Map() } = {}) {
  const groups = {};
  const bump = (g, k, n = 1) => { groups[g] = groups[g] || {}; groups[g][k] = (groups[g][k] || 0) + n; };
  const detail = { falseTicks: [], falseCrosses: [], examples: [] };
  const bySource = {};
  for (let ti = 0; ti < T.length; ti++) {
    const t = T[ti];
    const items = t.rules.map((r, i) => modelClaims.get(`${ti}:${i}`) || r);
    const mine = verifyLines(items.map((it, i) => ({ ...it, text: t.texts[i] })), t.description, { answer: t.answer });
    t.texts.forEach((text, i) => {
      const truth = t.truth[i];
      const eng = t.engine[i];
      const m = mine[i];
      const engineVerdict = eng === 'ok' ? 'tick' : eng === 'break' ? 'cross' : null;
      const mineVerdict = TICKED.has(m.verdict) ? 'tick' : m.verdict === 'first-break' ? 'cross' : m.verdict === 'follows-from-error' ? 'follows' : null;
      const combined = engineVerdict || mineVerdict;
      const src = items[i].source;
      for (const g of ['all', t.edition, t.engine[i] === 'unsupported' ? 'no-step-meta' : 'step-meta']) {
        if (truth === 'neutral') { bump(g, 'neutral'); if (combined) bump(g, 'neutral-verdict'); continue; }
        bump(g, 'lines');
        if (t.template[i]) bump(g, 'template');
        if (truth === 'valid') bump(g, 'true');
        if (engineVerdict) bump(g, 'engine-verdict');
        if (mineVerdict) bump(g, 'mine-verdict');
        if (combined) bump(g, 'combined-verdict');
        if (truth === 'valid' && engineVerdict === 'tick') bump(g, 'engine-ticked-true');
        if (truth === 'valid' && combined === 'tick') bump(g, 'combined-ticked-true');
        if (truth === 'valid' && mineVerdict === 'tick' && !engineVerdict) bump(g, 'mine-added-ticks');
        if (truth === 'valid' && combined === 'cross') bump(g, 'false-cross');
        if (truth === 'valid' && engineVerdict === 'cross') bump(g, 'false-cross-engine');
        if (truth === 'valid' && mineVerdict === 'cross' && !engineVerdict) bump(g, 'false-cross-mine');
        if (truth === 'break') {
          bump(g, 'wrong');
          if (combined === 'cross') bump(g, 'wrong-crossed');
          if (engineVerdict === 'cross') bump(g, 'wrong-crossed-engine');
          if (combined === 'tick') bump(g, 'FALSE-TICK');
          if (mineVerdict === 'tick') bump(g, 'FALSE-TICK-mine');
        }
        if (truth === 'follows') { bump(g, 'after-slip'); if (combined === 'tick') bump(g, 'after-slip-ticked'); if (combined === 'cross') bump(g, 'after-slip-crossed'); }
        if (m.verdict === 'unverifiable' && HAS_MATHS.test(text)) bump(g, `why:${m.basis || m.why}`);
      }
      if (truth !== 'neutral') {
        bySource[src] = bySource[src] || { lines: 0, verdict: 0 };
        bySource[src].lines++; if (mineVerdict) bySource[src].verdict++;
      }
      if (truth === 'break' && (combined === 'tick') && detail.falseTicks.length < 40) detail.falseTicks.push({ id: t.id, text, line: i, by: engineVerdict ? 'engine' : 'interpreter', basis: m.basis, lines: t.texts });
      if (truth === 'valid' && mineVerdict === 'cross' && !engineVerdict && detail.falseCrosses.length < 40) detail.falseCrosses.push({ id: t.id, text, basis: m.basis, why: m.why, lines: t.texts });
      if (mineVerdict && !engineVerdict && detail.examples.length < 400 && hash(`${ti}:${i}`) % 97 === 0) detail.examples.push({ id: t.id, text, verdict: m.verdict, basis: m.basis, kind: m.kind, truth });
    });
  }
  return { groups, detail, bySource };
}

// ── the liar sweep: an interpreter that lies about every claim type, over the corpus's wrong lines ──
import { guardClaim, CLAIM_KINDS, QUANTITIES } from '../../server/platform/lineInterpreter/claims.js';
export function liarSweep(T, { every = 25, perLine = 2500 } = {}) {
  let lines = 0, lies = 0, ticks = 0;
  const examples = [];
  let n = 0;
  for (let ti = 0; ti < T.length; ti++) {
    const t = T[ti];
    const bad = t.truth.indexOf('break');
    if (bad < 0 || (n++ % every) !== 0) continue;
    const line = t.texts[bad];
    lines++;
    const toks = line.split(/\s+/).filter(Boolean);
    const runs = [];
    for (let i = 0; i < toks.length; i++) for (let j = i + 1; j <= Math.min(toks.length, i + 6); j++) runs.push(toks.slice(i, j).join(' '));
    const sides = line.split('=').map(x => x.trim()).filter(Boolean);
    const partSets = [[line.trim()], ...sides.map(x => [x]), sides, sides.slice().reverse(), ...runs.slice(0, 20).map(r => [r])];
    let count = 0;
    const before = t.rules.slice(0, bad).map((r, i) => ({ ...r, text: t.texts[i] }));
    for (const kind of CLAIM_KINDS) for (const quantity of QUANTITIES) for (const label of ['', ...runs.slice(0, 6)]) for (const subject of ['', ...runs.slice(0, 3)]) for (const parts of partSets) {
      if (count++ > perLine) break;
      const claim = guardClaim({ kind, quantity, subject, label, at: '', parts }, line);
      if (claim.kind === 'unparseable' || claim.kind === 'prose') continue;
      lies++;
      const out = verifyLines([...before, { claim, source: 'model', text: line }], t.description, { answer: t.answer });
      if (TICKED.has(out[out.length - 1].verdict)) { ticks++; if (examples.length < 10) examples.push({ id: t.id, line, claim, verdict: out[out.length - 1] }); }
    }
  }
  return { lines, lies, ticks, examples };
}

const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/a');
export function table(groups) {
  const rows = [];
  for (const g of ['all', 'NSW', 'India', 'step-meta', 'no-step-meta']) {
    const x = groups[g] || {};
    rows.push(`| ${g} | ${x.lines || 0} | ${pct(x['engine-verdict'] || 0, x.lines)} | ${pct(x['combined-verdict'] || 0, x.lines)} | ${pct(x['engine-ticked-true'] || 0, x.true)} | ${pct(x['combined-ticked-true'] || 0, x.true)} | ${x['false-cross-engine'] || 0} | ${x['false-cross-mine'] || 0} | ${x['wrong-crossed'] || 0}/${x.wrong || 0} | ${x['FALSE-TICK'] || 0} |`);
  }
  return ['| Group | Scored lines | Verdict before (engine) | Verdict after (engine + interpreter) | True lines ticked before | True lines ticked after | False crosses (engine) | False crosses (interpreter) | Wrong lines crossed | FALSE TICKS |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|', ...rows].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const T = await collect({ limit: Number(arg('--limit', Infinity)) });
  console.log(`transcripts ${T.length} (${((Date.now() - t0) / 1000).toFixed(1)}s to build)`);
  const base = score(T);
  console.log(table(base.groups));
  console.log('by source', base.bySource);
  console.log('false ticks', base.detail.falseTicks.length, 'interpreter false crosses', base.detail.falseCrosses.length);
  const why = Object.entries(base.groups.all).filter(([k]) => k.startsWith('why:')).sort((a, b) => b[1] - a[1]).slice(0, 14);
  console.log('why unverifiable (lines with maths):', why.map(([k, v]) => `${k.slice(4)}=${v}`).join(', '));
  if (process.argv.includes('--model')) {
    const N = Number(arg('--model', 0));
    const PRICE = { inPerM: Number(arg('--price-in', 5)), outPerM: Number(arg('--price-out', 20)), capUsd: Number(arg('--cap', 2.5)) };
    const cands = [];
    T.forEach((t, ti) => {
      const idx = t.texts.map((x, i) => i).filter(i => ['unparseable', 'prose'].includes(t.rules[i].claim.kind) && HAS_MATHS.test(t.texts[i]) && t.engine[i] !== 'ok' && t.engine[i] !== 'break');
      if (idx.length) cands.push({ ti, idx });
    });
    cands.sort((a, b) => hash(`m${a.ti}`) - hash(`m${b.ti}`));
    const pick = cands.slice(0, N);
    const subset = pick.map(p => T[p.ti]);
    const claims = new Map();
    let spent = 0, tokensIn = 0, tokensOut = 0, calls = 0, ok = 0, stopped = false;
    const lat = [], statuses = {}, kinds = {}, rejected = { guard: 0, accepted: 0 }, reasons = {};
    let next = 0;
    const worker = async () => {
      while (next < pick.length && !stopped) {
        const k = next++;
        const { idx } = pick[k], t = subset[k];
        const res = await interpretWithModel({ description: t.description, lines: t.texts, indices: idx, env: process.env });
        calls++; lat.push(res.latencyMs); statuses[res.status] = (statuses[res.status] || 0) + 1;
        const u = res.usage || {};
        tokensIn += u.input_tokens || 0; tokensOut += u.output_tokens || 0;
        spent = (tokensIn * PRICE.inPerM + tokensOut * PRICE.outPerM) / 1e6;
        if (spent > PRICE.capUsd) stopped = true;
        if (res.status === 'ok') ok++;
        for (const [i, claim] of res.claims) {
          kinds[claim.kind] = (kinds[claim.kind] || 0) + 1;
          if (claim.kind === 'unparseable') { rejected.guard++; const r = claim.reason || 'model-said-unparseable'; reasons[r] = (reasons[r] || 0) + 1; } else { rejected.accepted++; claims.set(`${k}:${i}`, { claim, source: 'model' }); }
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const done = Math.min(next, pick.length);
    const withClaims = subset.slice(0, done);
    const before = score(withClaims);
    const after = score(withClaims, { modelClaims: claims });
    lat.sort((a, b) => a - b);
    const summary = {
      candidatesAvailable: cands.length, answersSent: calls, ok, statuses, kinds, rejected, reasons,
      tokensIn, tokensOut, estUsdAtAssumedPrice: Number(spent.toFixed(4)), assumedPricePerMTok: PRICE,
      usdPerAnswer: calls ? Number((spent / calls).toFixed(5)) : 0,
      latencyMs: { p50: lat[Math.floor(lat.length / 2)] || 0, p95: lat[Math.floor(lat.length * 0.95)] || 0, mean: Math.round(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)) },
      linesInSubset: before.groups.all?.lines || 0,
      verdictBeforeModel: before.groups.all?.['combined-verdict'] || 0, verdictAfterModel: after.groups.all?.['combined-verdict'] || 0,
      ticksBefore: before.groups.all?.['combined-ticked-true'] || 0, ticksAfter: after.groups.all?.['combined-ticked-true'] || 0,
      falseTicksAfter: after.groups.all?.['FALSE-TICK'] || 0, falseCrossesMineAfter: after.groups.all?.['false-cross-mine'] || 0,
      wrongLines: after.groups.all?.wrong || 0, wrongCrossedBefore: before.groups.all?.['wrong-crossed'] || 0, wrongCrossedAfter: after.groups.all?.['wrong-crossed'] || 0,
      neutralVerdictAfter: after.groups.all?.['neutral-verdict'] || 0
    };
    console.log('MODEL ARM', JSON.stringify(summary, null, 1));
    const mex = [];
    for (const [key, v] of claims) { const [k, i] = key.split(':').map(Number); if (mex.length < 25) mex.push({ line: subset[k].texts[i], claim: v.claim, truth: subset[k].truth[i] }); }
    if (arg('--model-out', null)) fs.writeFileSync(arg('--model-out'), JSON.stringify({ summary, examples: mex }, null, 1));
  }
  if (process.argv.includes('--liar')) {
    const L = liarSweep(T, { every: Number(arg('--liar', 25)) });
    console.log(`liar sweep: ${L.lines} wrong corpus lines, ${L.lies} guarded lies, ${L.ticks} ticks`);
    if (L.examples.length) console.log(JSON.stringify(L.examples, null, 1));
  }
  const out = arg('--json', null);
  if (out) fs.writeFileSync(out, JSON.stringify({ groups: base.groups, detail: base.detail, bySource: base.bySource }, null, 1));
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
