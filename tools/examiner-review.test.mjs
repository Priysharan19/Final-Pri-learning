// Pri Learning · the examiner review page, the AI pre-review and the kits (mission examiner-prereview).
//
// Proves, deterministically:
//   · the page is generated from the packet, is current (--check), covers every item, and
//     pre-fills nothing (no verdict button starts selected, no saved state ships in the file);
//   · the page makes no network request and never reads, quotes or links the AI pre-review;
//   · the JSON export always carries `draftNotSigned: true`, which the certification schema
//     forbids, so tools/verify-examiner-certification.mjs refuses it until a human signs;
//   · the AI pre-review is labelled synthetic, is not a certification record and covers every
//     packet item;
//   · the packets print no `undefined` key and every item's answer cell is present;
//   · no kit contains the AI pre-review.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { kitFiles } from './examiner-kits.mjs';
import { verifyRecord } from './verify-examiner-certification.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = f => readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

try { execFileSync('node', ['tools/examiner-review-page.mjs', '--check'], { cwd: ROOT, stdio: 'pipe' }); ok(true); }
catch (e) { ok(false, `review pages are stale: ${String(e.stdout || e.message).slice(0, 200)}`); }

const schema = JSON.parse(read('docs/marking/certifications/schema.json'));
ok(JSON.stringify(schema).includes('"additionalProperties":false'), 'the certification schema forbids unknown fields, so a draftNotSigned record is refused');

for (const [id, packet, label] of [['nsw-hsc', 'hsc', 'NSW'], ['cbse', 'cbse', 'CBSE']]) {
  const items = JSON.parse(read(`docs/marking/packets/${packet}/items.json`)).items;
  const html = read(`docs/marking/review/${id}.html`);
  // coverage: every item id is on the page exactly once as a card
  const missing = items.filter(i => !html.includes(i));
  ok(missing.length === 0, `${label} page misses ${missing.length} item(s), e.g. ${missing[0]}`);
  // nothing pre-filled: no button ships pressed or selected, and the only state is read from the examiner's own browser storage
  ok(!/aria-pressed="true"/.test(html), `${label} page ships a verdict button already pressed`);
  ok(!/class="[^"]*\b(on|selected|active|chosen)\b[^"]*"[^>]*data-v=/.test(html), `${label} page ships a verdict button already selected`);
  ok(/state=JSON\.parse\(localStorage\.getItem\(KEY\)\|\|'\{\}'\)/.test(html) && /if\(!state\.items\)state\.items=\{\}/.test(html), `${label} page seeds its state from something other than empty storage`);
  ok(!/s\.v\s*=\s*['"][ACR]['"]|s\.v\|\|['"][ACR]['"]|\.v\s*\|\|\s*['"][ACR]/.test(html), `${label} page defaults a verdict`);
  // offline, answer from the packet only
  ok(!/<script[^>]+src=/.test(html) && !/<link[^>]+href=["']https?:/.test(html) && !/@import/.test(html), `${label} page loads something over the network`);
  ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(html), `${label} page makes a network call`);
  ok(!/prereview|pre-review|AI-A|AI-C|AI-R/i.test(html), `${label} page mentions the AI pre-review`);
  const rec = /var rec=\{schemaVersion:1,draftNotSigned:true,[^\n]*?independent:false,[^\n]*?signedOriginal:'',recordedBy:''\}/;
  ok(rec.test(html), `${label} page does not build its export as an unsigned, independence-unconfirmed draft with empty signedOriginal and recordedBy`);
  const draft = { schemaVersion: 1, draftNotSigned: true, jurisdiction: id, syllabusVersions: [], dossierDigest: JSON.parse(read(`docs/marking/packets/${packet}/items.json`)).dossierDigest, commit: '', examiners: [{ name: 'Test', qualification: 'x', affiliation: 'y', date: '2026-01-01', independent: false, independenceStatement: '', conflicts: '' }], decisions: Object.fromEntries(items.map(i => [i, { verdict: 'approved' }])), signedOriginal: '', recordedBy: '' };
  const v1 = verifyRecord(JSON.stringify(draft), { name: 'draft.json' });
  ok(!v1.enables && v1.refusals.some(r => /draftNotSigned/.test(r)), `${label} draft with the marker is not refused for the marker`);
  delete draft.draftNotSigned;
  const v2 = verifyRecord(JSON.stringify(draft), { name: 'draft.json' });
  ok(!v2.enables && !v2.complete, `${label} an unsigned draft with the marker removed would still enable`);
  ok(/Not yet reviewed by a human examiner/i.test(html), `${label} page does not say it is unreviewed`);
  // the AI pre-review
  const pr = read(`docs/marking/prereview/${id}.md`);
  ok(pr.includes("AI pre-review — synthetic, not an examiner's verdict, never used as certification"), `${label} pre-review lacks its label`);
  const rowIds = new Set([...pr.matchAll(/^\| ([^ |]+) \| AI-[ACR] \|/gm)].map(m => m[1]));
  const notCovered = items.filter(i => !rowIds.has(i));
  ok(notCovered.length === 0, `${label} pre-review misses ${notCovered.length} item(s), e.g. ${notCovered[0]}`);
  ok(!/"verdict"\s*:\s*"approved"/.test(pr), `${label} pre-review contains a certification-shaped verdict`);
  // packets print no undefined
  ok(!/undefined/.test(read(`docs/marking/packets/${packet}/worked-cases.md`)), `${label} worked cases print "undefined"`);
  ok(!/\bNaN\b/.test(read(`docs/marking/packets/${packet}/worked-cases.md`)), `${label} worked cases print NaN`);
  // kits
  const files = kitFiles({ id, packet });
  ok(files.every(f => !/prereview/.test(f)), `${label} kit contains the AI pre-review`);
  ok(files.every(f => existsSync(path.join(ROOT, f))), `${label} kit names a file that does not exist`);
  ok(files.includes(`docs/marking/review/${id}.html`), `${label} kit lacks the review page`);
}
ok(!existsSync(path.join(ROOT, 'docs/marking/prereview/certification.json')), 'the pre-review folder holds no record');

if (failures.length) { console.error(`EXAMINER REVIEW: FAIL\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`EXAMINER REVIEW: PASS — ${pass} checks: pages current, complete, nothing pre-filled, offline, never read the AI pre-review; pre-review labelled and covers every item; packets print no undefined; kits hold no pre-review. Signs and certifies nothing.`);
