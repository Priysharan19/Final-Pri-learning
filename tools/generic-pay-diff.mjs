// Pri Learning · what the step-mark pay of the APPROVED generic rule is, page by page, over generator questions, so that two checkouts can be compared.
//   node tools/generic-pay-diff.mjs --dump out.json [--seeds 20]
// Pages per payable question: the authored working with the last line made wrong (wrong typed answer), and each middle line made wrong in turn. The key is the
// question's prompt and the page's name; the lines are recorded beside it, so a page whose lines were read differently is listed as such.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { payableQuestions, markPage, falsify, stillTrue } from './generic-steps-sweep.mjs';
import { authoredLines } from '../server/platform/genericSteps.js';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const items = await payableQuestions({ seeds: Number(arg('seeds', 20)) });
const out = {};
const h = s => createHash('sha1').update(s).digest('hex').slice(0, 14);
for (const { q, generator } of items) {
  const texts = authoredLines(q).map(l => l.text);
  if (texts.length < 2) continue;
  const pages = [['final', texts.map((t, i) => (i === texts.length - 1 ? falsify(t) || t : t))]];
  for (let i = 0; i < texts.length - 1; i++) { const b = falsify(texts[i]); if (b && b !== texts[i] && !stillTrue(texts[i], b)) pages.push([`m${i}`, texts.map((t, k) => (k === i ? b : t))]); }
  for (const [name, lines] of pages) {
    let r; try { r = markPage(q, lines, '99991'); } catch { continue; }
    out[`${generator}|${h(q.prompt)}|${name}`] = { marks: r.marks, N: r.N, st: r.lines.map(l => l?.status?.[0] || '?').join(''), lines: lines.length, hash: h(lines.join('\n')) };
  }
}
if (arg('dump')) fs.writeFileSync(arg('dump'), JSON.stringify(out));
console.log('pages', Object.keys(out).length, 'marks', Object.values(out).reduce((a, x) => a + x.marks, 0));
