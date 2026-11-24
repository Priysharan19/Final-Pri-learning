// Draft method-mark schemes (tools/method-marks-drafts.mjs): deterministic, honest, and never approved.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, diffFiles, BANNER, OUT_DIR, readApprovals, bannerFor } from './method-marks-drafts.mjs';
import { GENERIC_ID, genericDigest } from '../server/platform/genericSteps.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const first = await build();
const second = await build();
ok(first.files.size === second.files.size && [...first.files].every(([k, v]) => second.files.get(k) === v), 'two runs give identical output');
ok(diffFiles(first.files).length === 0, `committed files match the generated ones (${diffFiles(first.files).join(', ')})`);

const json = JSON.parse(first.files.get('types.json'));
ok(Array.isArray(json.types) && json.types.length >= 5, 'at least five types have a scheme');
const approvedHere = json.types.filter(t => readApprovals().some(r => r.typeId === t.id && r.digest === t.digest && r.verdict === 'approved')).length;
ok(json.status.startsWith(`${approvedHere} of ${json.types.length} types`) && /the rest are drafts: not approved/.test(json.status) && !/approved"\s*:\s*true|signed|certified/i.test(first.files.get('types.json').replace(json.status, '')), 'types.json says how many types the author\'s records approve and that the rest are drafts, and carries no approval flag');
ok(json.types.every(t => !('approved' in t)), 'no type in types.json carries an approval flag of its own (the author\'s records are the only source)');

for (const [name, text] of first.files) {
  // a packet starts with the DRAFT banner, or with the plain statement of approval only when the author's own record names that packet's digest
  if (name.endsWith('.md') && name !== 'INDEX.md') {
    const id = name.replace(/\.md$/, ''), digest = id === GENERIC_ID ? genericDigest() : json.types.find(t => t.id === id)?.digest;
    const rec = readApprovals().find(r => r.typeId === id && r.digest === digest && r.verdict === 'approved');
    ok(text.split('\n')[0] === (rec ? bannerFor(id, digest) : BANNER) && (rec ? /^APPROVED by the author, Priysharan Tripathi \(tutor\), on 2026-11-24/.test(text) : text.startsWith('DRAFT')), `${name} starts with the banner its record decides (${rec ? 'approved at this digest' : 'draft, not approved'})`);
  } else if (name === 'INDEX.md') ok(/approved by the author|^DRAFT/.test(text.split('\n')[0]), 'INDEX.md states its status on the first line');
  ok(!/—/.test(text), `${name} has no em dash`);
  ok(!/examiner-certified|NESA approved/i.test(text), `${name} avoids the forbidden claims`);
}

// nothing was written to the certifications folder
let porcelain = '';
try { porcelain = execFileSync('git', ['status', '--porcelain', '--', 'docs/marking/certifications'], { cwd: ROOT, encoding: 'utf8' }); } catch { porcelain = ''; }
ok(porcelain.trim() === '', 'no file under docs/marking/certifications was created or changed');
ok(!/certifications/.test(fs.readFileSync(path.join(ROOT, 'tools/method-marks-drafts.mjs'), 'utf8').replace(/\/\/.*$/gm, '')), 'the tool never names the certifications folder in code');
ok(path.relative(ROOT, OUT_DIR) === path.join('owner-review', 'method-marks'), 'output goes only to owner-review/method-marks');

const ROW = /^\| (\d+) \| `(.*)` \| (.*?) \| (.*?) \| (.*) \|$/;
for (const t of json.types) {
  const text = first.files.get(t.file);
  ok(!!text, `${t.id} has a file`);
  ok(/^[0-9a-f]{64}$/.test(t.digest) && text.includes(t.digest), `${t.id} digest is in its file`);
  ok(t.totalMarks === t.criteria.reduce((s, c) => s + c.marks, 0) && t.criteria.length >= 2, `${t.id} total matches its criteria`);
  const awards = { full: null, partial: null, zero: null, slip: null };
  const sections = text.split(/^### |^## /m);
  for (const sec of sections) {
    const head = sec.split('\n')[0];
    const key = head === 'Full marks' ? 'full' : head === 'Partial marks' ? 'partial' : head === 'Zero marks' ? 'zero' : head === 'Error carried forward' ? 'slip' : null;
    if (!key) continue;
    const m = /Award: \*\*(\d+) of (\d+)\*\*/.exec(sec);
    ok(!!m, `${t.id} ${key} has an award`);
    if (!m) continue;
    awards[key] = Number(m[1]);
    ok(Number(m[1]) <= t.totalMarks && Number(m[2]) === t.totalMarks, `${t.id} ${key} award does not exceed the total`);
    // a wrong line never earns a criterion, and nothing after the first wrong line earns
    let broken = false;
    for (const line of sec.split('\n')) {
      const r = ROW.exec(line);
      if (!r) continue;
      const wrong = /wrong here/.test(r[3]) || /wrong here/.test(r[4]);
      if (wrong) broken = true;
      const earns = r[5].trim() !== 'nothing';
      if (wrong) ok(!earns, `${t.id} ${key} line ${r[1]}: a wrong line earns nothing`);
      else if (broken) ok(!earns, `${t.id} ${key} line ${r[1]}: a line after a wrong line earns nothing`);
    }
  }
  ok(awards.full === t.totalMarks, `${t.id} has a full-marks award`);
  ok(awards.partial > 0 && awards.partial < t.totalMarks, `${t.id} has a partial award`);
  ok(awards.zero === 0, `${t.id} has a zero award`);
  ok(awards.slip !== null && awards.slip < t.totalMarks, `${t.id} has an earlier-slip award below full marks`);
  ok(/## Review record/.test(text) && /Scheme digest/.test(text), `${t.id} has a blank review record`);
}
const index = first.files.get('INDEX.md');
ok(/Could not be given a provable scheme/.test(index), 'INDEX lists the types without a provable scheme');
ok(json.types.every(t => index.includes(`${t.id}.md`)), 'INDEX links every type');

if (failures.length) { console.error(`method-marks drafts: ${failures.length} failed`); for (const f of failures) console.error('  - ' + f); process.exit(1); }
console.log(`method-marks drafts: ${pass} checks passed`);
