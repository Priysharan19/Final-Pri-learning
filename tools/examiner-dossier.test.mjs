// Pri Learning · examiner dossiers (mission CERT): the CBSE dossier is
// untouched by the jurisdiction parameter, the NSW dossier is deterministic,
// and changing one marking plan changes the NSW digest.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const run = args => { try { return { code: 0, out: execFileSync(process.execPath, [path.join(ROOT, 'tools/examiner-dossier.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' }) }; } catch (e) { return { code: e.status, out: String(e.stderr) }; } };

ok(run(['--check']).code === 0, 'CBSE dossier (default) matches the committed file byte for byte');
ok(run(['--jurisdiction', 'cbse', '--check']).code === 0, 'CBSE dossier (explicit) matches the committed file');
ok(run(['--jurisdiction', 'nsw', '--check']).code === 0, 'NSW dossier matches the committed file');
ok(run(['--jurisdiction', 'icse', '--check']).code === 1, 'an unknown jurisdiction fails');

const { buildNswDossier } = await import('./examiner-dossier-nsw.mjs');
const a = await buildNswDossier(), b = await buildNswDossier();
ok(a.text === b.text && a.digest === b.digest, 'NSW dossier is deterministic');
ok(a.text === readFileSync(path.join(ROOT, 'docs/marking/hsc-examiner-certification-dossier.md'), 'utf8'), 'NSW in-process build equals the committed file');
ok(/Not yet reviewed by a human examiner/.test(a.text) && /Approved by: nobody/.test(a.text), 'NSW dossier says it is not reviewed');
ok(!/NESA-approved|HSC-endorsed|official HSC/i.test(a.text), 'NSW dossier makes no endorsement claim');

// Change one marking plan (in memory): the digest must change.
const { GENERATORS } = await import(path.join(ROOT, 'client/src/engine/generators/index.js'));
const target = a.methodCells[0] || a.cells[0];
const orig = GENERATORS[target.generator];
GENERATORS[target.generator] = Object.assign((rng, d) => {
  const q = orig(rng, d);
  return q.stepcheck ? { ...q, stepcheck: { ...q.stepcheck, tampered: true } } : { ...q, answer: { ...q.answer, tampered: true } };
}, orig);
const c = await buildNswDossier();
GENERATORS[target.generator] = orig;
ok(c.digest !== a.digest, `changing ${target.generator}'s marking plan changes the NSW digest`);
const d = await buildNswDossier();
ok(d.digest === a.digest, 'restoring the plan restores the digest');

if (failures.length) { for (const f of failures) console.error(`  ✗ ${f}`); console.error(`EXAMINER DOSSIER TEST: FAIL — ${failures.length} failed`); process.exit(1); }
console.log(`EXAMINER DOSSIER TEST: PASS — ${pass}/${pass} checks`);
