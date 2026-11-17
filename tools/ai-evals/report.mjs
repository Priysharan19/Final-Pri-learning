#!/usr/bin/env node
// Turns a promptfoo results file into the markdown evidence report.
//   node report.mjs results/fixture.json [--out=../../docs/evidence/ai-redteam-<date>.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [file, ...rest] = process.argv.slice(2);
const out = (rest.find(a => a.startsWith('--out=')) || '').slice(6) || null;
const r = JSON.parse(readFileSync(file, 'utf8'));
const rows = r.results.results.map(x => {
  const d = x.testCase?.description || '';
  let o = {};
  try { o = JSON.parse(x.response?.output ?? '{}'); } catch { /* a file surface */ }
  return {
    d, pass: x.success === true, mode: o.mode || (process.env.PRI_EVAL_MODE === 'live' ? 'live' : 'fixture'),
    suite: d.replace(/^\[[^\]]*\]\s*/, '').split(' · ')[0],
    kind: (d.match(/^\[([^\]]*)\]/) || [])[1] || 'DETERMINISTIC',
    sees: typeof o.studentSees === 'string' ? o.studentSees : null,
    source: o.source || null
  };
});
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const pfVersion = JSON.parse(readFileSync(new URL('./node_modules/promptfoo/package.json', import.meta.url), 'utf8')).version;
let commit = '?';
try { commit = execFileSync('git', ['rev-parse', '--short=9', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
const pass = rows.filter(x => x.pass).length;
const mode = rows.some(x => x.mode === 'live') ? 'live' : 'fixture';
const L = [];
L.push(`# AI red-team — ${date} (${mode} mode)`, '');
L.push(mode === 'fixture'
  ? '> **Fixture mode. No model was called.** Every case runs through the server\'s real request construction, parse path and deterministic guards. Where a model reply is needed it is a SYNTHETIC fixture: a hand-written reply that tests what the guard and the assertions do with it. A fixture is never a recorded model output, so no line here describes how the live model behaves. Live runs are **pending** (no provider key on this machine).'
  : '> **Live mode.** The real provider was called through the server\'s own code with the server\'s key from the environment. MODEL-GRADED rows are a second model\'s opinion and are labelled as such.');
L.push('', `- Commit: \`${commit}\` · promptfoo ${pfVersion} · cases: ${rows.length} · **pass ${pass} · fail ${rows.length - pass}**`, '');
L.push('| Result | Kind | Case | What the student would see |', '|---|---|---|---|');
for (const x of rows) {
  const who = x.source === 'fallback' ? 'authored hint' : x.mode === 'fixture' ? 'SYNTHETIC reply shown' : 'model reply';
  const sees = x.sees == null ? '—' : `${who}: “${x.sees.replace(/\|/g, '¦').slice(0, 90)}”`;
  L.push(`| ${x.pass ? 'PASS' : '**FAIL**'} | ${x.kind} | ${x.d.replace(/^\[[^\]]*\]\s*/, '').replace(/\|/g, '¦')} | ${sees} |`);
}
L.push('', 'Kinds: **DETERMINISTIC** — the server path with a SYNTHETIC reply where one is needed. **CONTRACT** — a static property of the shipped prompts, code or copy. **GUARD-GAP** — would anything deterministic stop this unsafe reply? **LIVE** / **MODEL-GRADED** — needs the real model, and passes trivially in fixture mode.', '');
const md = L.join('\n') + '\n';
if (out) writeFileSync(out, md); else process.stdout.write(md);
