// Pri Learning · what a change of the TeX reader changes over the generated Years 11-12 questions: every authored worked step and prompt span, read by two
// checkouts (the base and this one), listed where the reading differs.
//   node tools/reading-diff.mjs --base <repo> [--root <repo>] [--seeds 20] [--dump out.json]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEngine, SCOPE } from './marking-mutation-harness.mjs';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.resolve(arg('base', ''));
const root = path.resolve(arg('root', here));
const seeds = Number(arg('seeds', 20));
const [A, B] = [await loadEngine(base), await loadEngine(root)];
const spans = q => { const out = []; for (const t of [String(q.prompt ?? ''), ...(q.steps || []).map(s => String(s?.d ?? ''))]) for (const m of t.replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) out.push(part); return out; };
const rd = (E, s) => { try { return E.spanToPlain(s); } catch { return null; } };
let total = 0, same = 0, newlyRead = 0, lost = 0, changed = 0;
const diffs = new Map();
for (const e of A.NSW_BANK_LEDGER) {
  if (!SCOPE.test(e.generator)) continue;
  for (const c of e.cells) if (c.issued) for (let seed = 1; seed <= seeds; seed++) {
    let q; try { q = A.G.generateQuestion(e.generator, c.difficulty, seed); } catch { continue; }
    if (!q || typeof q.prompt !== 'string') continue;
    for (const s of spans(q)) {
      total++;
      const a = rd(A, s), b = rd(B, s);
      if (a === b) { same++; continue; }
      const kind = a === null ? 'newly-read' : b === null ? 'LOST' : 'changed';
      if (kind === 'newly-read') newlyRead++; else if (kind === 'LOST') lost++; else changed++;
      const k = `${kind}|${s.trim()}`;
      const o = diffs.get(k) || { kind, tex: s.trim(), from: a, to: b, n: 0, generator: e.generator };
      o.n++; diffs.set(k, o);
    }
  }
}
const list = [...diffs.values()].sort((x, y) => y.n - x.n);
console.log(`spans ${total}: identical ${same}, newly read ${newlyRead}, lost ${lost}, changed ${changed} (${list.length} distinct)`);
for (const kind of ['LOST', 'changed', 'newly-read']) { console.log(`-- ${kind}`); for (const d of list.filter(x => x.kind === kind).slice(0, 40)) console.log(`  x${d.n} [${d.generator}] ${d.tex.slice(0, 90)}  | ${d.from === null ? '(unread)' : d.from.slice(0, 60)} -> ${d.to === null ? '(unread)' : d.to.slice(0, 60)}`); }
const dump = arg('dump', null); if (dump) fs.writeFileSync(dump, JSON.stringify(list));
