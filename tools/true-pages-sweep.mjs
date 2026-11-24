// Pri Learning · the authored true pages of the Years 11-12 calculus families, marked by the real marker, line by line.
// Used by server/test/true-pages-vs-main-check.mjs (against a committed snapshot of origin/main) and, to refresh that snapshot, run with a
// path:  node tools/true-pages-sweep.mjs --write server/test/fixtures/true-pages-main-2026-11-24.json   (from a checkout of the base to compare with).
// Each page is keyed by the question's prompt, the transcript style and the page's own lines (a seed that draws a different form on another branch is still the same page).
import '../server/test/support/hermetic.mjs';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { stepEvidence } from '../server/platform/markerOps.js';
import * as C from './understanding-audit/corpus.mjs';

export const FAMILIES = ['y12-diff', 'y12-appdiff', 'y12-integration', 'y12-integral-calc'];
export const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const CODE = { ok: 'o', break: 'b', note: 'n' };

/** { key: { family, statuses: 'oonb', last: index } } — and, with texts, the line texts. */
export async function sweep({ withTexts = false } = {}) {
  await C.loadFamilies();
  const out = {};
  for (const fid of FAMILIES) for (const q of C.questionsFor(fid, SEEDS)) {
    let ts; try { ts = C.transcriptsFor(q); } catch { continue; }
    for (const t of ts) {
      if (t.style === 'slip') continue;
      const text = t.lines.map(l => l.text).join('\n');
      let r; try { r = stepEvidence(q, '', text, { correct: false }, { slipWarnings: true }); r = r.shownReport || r.stepReport; } catch { continue; }
      if (!r?.lines || r.lines.length !== t.lines.length) continue;
      const key = createHash('sha1').update(`${q.subtopic}|${q.prompt}|${t.style}|${text}`).digest('hex').slice(0, 12);
      out[key] = { family: q.subtopic, statuses: r.lines.map(l => CODE[l.status] || '?').join(''), ...(withTexts ? { texts: t.lines.map(l => l.text), prompt: q.prompt, style: t.style } : {}) };
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('true-pages-sweep.mjs') && process.argv[2] === '--write') {
  const s = await sweep();
  const compact = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, `${v.family.replace('y12-', '')}:${v.statuses}`]));
  writeFileSync(process.argv[3], JSON.stringify(compact) + '\n');
  console.log(`wrote ${Object.keys(compact).length} pages to ${process.argv[3]}`);
}
