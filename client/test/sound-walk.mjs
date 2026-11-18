import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function walkSources(rel) {
  const base = fileURLToPath(new URL(rel + '/', import.meta.url));
  const out = [];
  const go = (d, r) => { for (const n of readdirSync(d)) { const p = `${d}/${n}`; const q = `${r}/${n}`; if (statSync(p).isDirectory()) go(p, q); else if (/\.(jsx?|mjs)$/.test(n)) out.push(q); } };
  go(base.replace(/\/$/, ''), rel);
  return out;
}
