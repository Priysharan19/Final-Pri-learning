// node summarize.mjs a.jsonl [b.jsonl ...]  -> markdown table per configuration
import { readFileSync } from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]; };
const by = new Map();
for (const r of rows) { if (!by.has(r.config)) by.set(r.config, []); by.get(r.config).push(r); }
console.log('| config | n | ok | p50 ms | p95 ms | ttft p50 | exact | char acc | prime ok | words ok | would escalate | in tok | out tok | est $/read* |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, rs] of by) {
  const ok = rs.filter(r => r.score);
  const ms = rs.filter(r => r.status === 200).map(r => r.ms);
  const tt = rs.filter(r => r.ttft != null).map(r => r.ttft);
  const f = (k) => { const v = ok.filter(r => r.score[k] !== undefined); return v.length ? `${v.filter(r => r.score[k]).length}/${v.length}` : '-'; };
  const avg = ok.length ? (ok.reduce((s, r) => s + r.score.charAcc, 0) / ok.length * 100).toFixed(1) + '%' : '-';
  const inT = Math.round(ok.reduce((s, r) => s + (r.usage.input || 0), 0) / Math.max(1, ok.length));
  const outT = Math.round(ok.reduce((s, r) => s + (r.usage.output || 0), 0) / Math.max(1, ok.length));
  const esc = ok.filter(r => r.parsed.needs_confirmation !== false || (r.parsed.lines || []).some(l => l.uncertain !== false || !(l.confidence >= 0.82)) || !(r.parsed.confidence >= 0.82)).length;
  console.log(`| ${name} | ${rs.length} | ${ok.length} | ${pct(ms, .5) ?? '-'} | ${pct(ms, .95) ?? '-'} | ${pct(tt, .5) ?? '-'} | ${f('exact')} | ${avg} | ${f('primeOk')} | ${f('wordsOk')} | ${esc}/${ok.length} | ${inT} | ${outT} | ${((inT * 2 + outT * 10) / 1e6).toFixed(4)} |`);
}
