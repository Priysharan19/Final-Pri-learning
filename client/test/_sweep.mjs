import { readdirSync } from 'node:fs';
const { findingsIn, SCANNED } = await import('./i18n-coverage-check.mjs');
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (/data|engine|node_modules/.test(e.name) ? [] : walk(`${d}/${e.name}`)) : /\.jsx?$/.test(e.name) && !/test|\.browser\./i.test(e.name) ? [`${d}/${e.name}`] : []);
const out = {};
for (const f of walk('src')) { const rel = f; if (SCANNED.includes(rel)) continue; try { const h = findingsIn(rel); if (h.length) out[rel] = h.map(x => x.text.slice(0, 90)); } catch (e) {} }
const lines = Object.entries(out).map(([f, h]) => `${h.length}  ${f}`); console.log(lines.join('\n')); console.log('FILES', lines.length, 'TOTAL', Object.values(out).flat().length);
import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
