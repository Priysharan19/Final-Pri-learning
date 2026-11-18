// Understanding audit runner. Feeds every corpus transcript to the engine the way the server does
// (server/platform/markerOps.js: stepMetaFor(q) then stepCheck(meta, lines.join('\n'), { prompt })),
// scores each line against its intended truth, and writes the evidence report.
//
//   node tools/understanding-audit/run.mjs [--report path] [--json path] [--limit N]
//
// Deterministic: fixed seeds, no clock or randomness in the corpus or the scoring.
import fs from 'node:fs';
import path from 'node:path';
import { stepMetaFor } from '../../server/platform/markerOps.js';
import { stepCheck } from '../../client/src/engine/checker.js';
import { SEEDS, EXTRA_SEEDS, editionOf, loadFamilies, questionsFor, transcriptsFor } from './corpus.mjs';
import { buildReport } from './report.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

/** One transcript through the engine as the server calls it. */
export function judge(q, lines) {
  const meta = stepMetaFor(q);
  if (!meta) return { supported: false, statuses: lines.map(() => 'unsupported'), notes: lines.map(() => null), firstBreak: -1 };
  let report = null;
  try { report = stepCheck(meta, lines.join('\n'), { prompt: q.prompt }); } catch (e) { return { supported: true, error: String(e.message || e), statuses: lines.map(() => 'error'), notes: lines.map(() => null), firstBreak: -1 }; }
  const judged = Array.isArray(report?.lines) ? report.lines : [];
  if (judged.length !== lines.length) return { supported: true, misaligned: true, statuses: lines.map(() => 'misaligned'), notes: lines.map(() => null), firstBreak: -1 };
  return {
    supported: true,
    statuses: judged.map(l => (l.status === 'ok' ? 'ok' : l.status === 'break' ? 'break' : 'silent')),
    notes: judged.map(l => (l.status === 'note' ? String(l.note || '') : null)),
    firstBreak: report.firstBreak ?? -1
  };
}

export async function runAudit({ limit = Infinity } = {}) {
  const ids = (await loadFamilies()).slice(0, limit);
  const rows = [];            // one per scored line
  const transcripts = [];     // one per transcript
  const familyInfo = {};
  for (const id of ids) {
    let qs = questionsFor(id, SEEDS);
    if (qs.some(q => stepMetaFor(q))) qs = qs.concat(questionsFor(id, EXTRA_SEEDS));
    familyInfo[id] = { edition: editionOf(id), questions: qs.length, supported: qs.filter(q => stepMetaFor(q)).length };
    for (const q of qs) {
      for (const t of transcriptsFor(q)) {
        const texts = t.lines.map(l => l.text);
        const j = judge(q, texts);
        const ti = transcripts.length;
        transcripts.push({ family: id, edition: editionOf(id), style: t.style, slipKind: t.slipKind || null, supported: j.supported, firstBreak: j.firstBreak, breakAt: t.breakAt ?? -1, qkey: `${q.seed}/d${q.difficulty}`, prompt: q.prompt, lines: texts });
        t.lines.forEach((l, i) => rows.push({
          ti, family: id, edition: editionOf(id), style: t.style, supported: j.supported, truth: l.truth, template: !!l.template,
          text: l.text, status: j.statuses[i], note: j.notes[i], index: i, first: j.firstBreak === i
        }));
      }
    }
  }
  return { rows, transcripts, familyInfo };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const result = await runAudit({ limit: Number(arg('--limit', Infinity)) });
  const md = buildReport(result);
  const out = arg('--report', 'docs/evidence/understanding-audit-2026-11-18.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  const jsonOut = arg('--json', null);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result));
  console.log(`transcripts ${result.transcripts.length}, lines ${result.rows.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
}
