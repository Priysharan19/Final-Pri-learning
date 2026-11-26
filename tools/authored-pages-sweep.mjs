// Pri Learning · every authored page of every Years 11-12 generator, in every transcript style, marked by the real marker line by line.
// The permanent check against a TRUE line being crossed or a tick being lost (server/test/authored-pages-vs-base-check.mjs compares this sweep with
// a committed snapshot of the base the branch merges into). The authored page of a question is true by construction, and so is each style of it
// (a bare line, a restated question, a label in front, a verbal gloss): none may be crossed by any rule added later.
//
//   node tools/authored-pages-sweep.mjs --write server/test/fixtures/authored-pages-base.json     (from a checkout of the base)
import '../server/test/support/hermetic.mjs';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { stepEvidence } from '../server/platform/markerOps.js';
import * as C from './understanding-audit/corpus.mjs';

export const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
export const SCOPE = /^(y11|y12|me11|me12)-/;
const CODE = { ok: 'o', break: 'b', note: 'n' };

/** { key: 'statuses' } with a key from the page itself (the question's prompt, the style and the lines), so a seed that draws another form elsewhere is still the same page. */
export async function sweep({ withTexts = false } = {}) {
  const families = (await C.loadFamilies()).filter(f => SCOPE.test(f));
  const out = {};
  for (const fid of families) for (const q of C.questionsFor(fid, SEEDS)) {
    let ts; try { ts = C.transcriptsFor(q); } catch { continue; }
    for (const t of ts) {
      if (t.style === 'slip') continue;   // a slip page is wrong by construction
      const text = t.lines.map(l => l.text).join('\n');
      let r; try { r = stepEvidence(q, '', text, { correct: false }, { slipWarnings: true }); r = r.shownReport || r.stepReport; } catch { continue; }
      if (!r?.lines || r.lines.length !== t.lines.length) continue;
      const key = createHash('sha1').update(`${q.subtopic}|${q.prompt}|${t.style}|${text}`).digest('hex').slice(0, 12);
      out[key] = withTexts ? { statuses: r.lines.map(l => CODE[l.status] || '?').join(''), texts: t.lines.map(l => l.text), prompt: q.prompt, style: t.style } : r.lines.map(l => CODE[l.status] || '?').join('');
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('authored-pages-sweep.mjs') && process.argv[2] === '--write') {
  const s = await sweep();
  writeFileSync(process.argv[3], JSON.stringify(s) + '\n');
  console.log(`wrote ${Object.keys(s).length} pages to ${process.argv[3]}`);
}
