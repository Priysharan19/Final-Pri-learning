// Pri Learning · does a change of the TeX reader change anything for India? 2,000 India pages, each marked as the server marks a student's true working with a
// wrong typed answer, with the reader's TeX of every line supplied as well; the statuses of every line are dumped so two checkouts can be compared.
//   node tools/india-reading-diff.mjs --dump out.json [--pages 2000]            (run in each checkout)
//   node tools/india-reading-diff.mjs --compare base.json new.json              (lists every line whose status differs)
//   node tools/india-reading-diff.mjs --ungated [--pages 2000]                  (what the extended reading WOULD change on India pages if it were not gated to the Australian edition)
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
if (process.argv.includes('--compare')) {
  const [a, b] = process.argv.slice(process.argv.indexOf('--compare') + 1, process.argv.indexOf('--compare') + 3).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  let same = 0; const diffs = [];
  for (const k of Object.keys(a)) { if (!(k in b)) { diffs.push([k, 'page missing', a[k], null]); continue; } if (JSON.stringify(a[k]) === JSON.stringify(b[k])) same++; else diffs.push([k, 'differs', a[k], b[k]]); }
  console.log(`India pages compared ${Object.keys(a).length}: identical ${same}, different ${diffs.length}`);
  for (const d of diffs.slice(0, 30)) console.log(JSON.stringify(d).slice(0, 400));
  process.exit(0);
}
const { IN_CHAPTERS } = await import('../client/src/engine/curriculum-in.js');
const { generateQuestion, loadAllBanks } = await import('../client/src/engine/generators/index.js');
const { stepEvidence } = await import('../server/platform/markerOps.js');
const { stepCheckArithmetic } = await import('../client/src/engine/arithmeticLines.js');
const { _internals } = await import('../client/src/engine/solutionMatch.js');
const { checkAnswer } = await import('../client/src/engine/checker.js');
await loadAllBanks();
const want = Number(arg('pages', 2000));
const out = {};
let n = 0, ungatedDiff = 0, ungatedNewTicks = 0, ungatedCross = 0; const examples = [];
outer: for (let s = 1; s <= 40; s++) for (const ch of IN_CHAPTERS) for (const c of ch.covers) for (const d of c.diff) {
  if (n >= want) break outer;
  let q = null; try { q = generateQuestion(c.gen, d, `indiadiff-${c.gen}-${d}-${s}`); } catch { q = null; }
  if (!q || typeof q.prompt !== 'string' || !Array.isArray(q.steps)) continue;
  const pairs = [];
  for (const st of q.steps) for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) {
    let plain = null; try { plain = _internals.spanToPlain(part); } catch { plain = null; }
    if (plain && plain.trim() && plain.length < 140 && !/[<>≤≥≠]|!=/.test(plain)) pairs.push({ text: plain.trim(), latex: part.trim() });
  }
  if (!pairs.length) continue;
  const lines = pairs.map(p => p.text).slice(0, 14), latex = pairs.slice(0, 14);
  let ev; try { ev = stepEvidence({ ...q }, '99991', lines.join('\n'), checkAnswer({ ...q }, '99991'), { slipWarnings: true, latex }); } catch { continue; }
  n++;
  const key = `${c.gen}|${d}|${s}`;
  out[key] = (ev.shownReport || ev.stepReport || { lines: [] }).lines.map(l => `${l.status}${l.state ? ':' + l.state : ''}`);
  if (process.argv.includes('--ungated')) {
    const base = stepCheckArithmetic(lines.join('\n'), { latex });
    const ext = stepCheckArithmetic(lines.join('\n'), { latex, extendedTex: true });
    const a = base.lines.map(l => l.status), b = ext.lines.map(l => l.status);
    if (a.join() !== b.join()) { ungatedDiff++; b.forEach((st, i) => { if (st === 'ok' && a[i] !== 'ok') ungatedNewTicks++; if (st === 'break' && a[i] !== 'break') ungatedCross++; }); if (examples.length < 12) examples.push({ key, lines: lines.map((l, i) => `${a[i]}->${b[i]} ${l}`).filter((_, i) => a[i] !== b[i]) }); }
  }
}
if (arg('dump')) fs.writeFileSync(arg('dump'), JSON.stringify(out));
console.log(`India pages marked: ${n}; lines ${Object.values(out).reduce((a, x) => a + x.length, 0)}`);
if (process.argv.includes('--ungated')) { console.log(`if NOT gated: pages that differ ${ungatedDiff}, lines newly ticked ${ungatedNewTicks}, lines newly crossed ${ungatedCross}`); for (const e of examples) console.log(JSON.stringify(e).slice(0, 300)); }
