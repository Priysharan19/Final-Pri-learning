#!/usr/bin/env node
// Pri Learning · verify a signed examiner certification record (mission CERT)
//
// Method marks stay OFF unless a complete, matching, human-signed record exists
// in the repository. This tool is the deterministic check of that rule.
//
//   node tools/verify-examiner-certification.mjs <record.json>
//       Verifies one record against the current packet (docs/marking/packets/
//       <jurisdiction>/items.json). Prints the exact value an operator may set
//       for PRI_METHOD_MARKS_EXAMINER_RESULT, or refuses and says why.
//   node tools/verify-examiner-certification.mjs --gate
//       The repository gate (CI): no fabricated or fixture record under
//       docs/marking/certifications/; no tracked deploy configuration sets
//       PRI_METHOD_MARKS=on or names an examiner result unless an enabling CBSE
//       record yields exactly that value; and the Prithagoras edition stays in
//       UNCERTIFIED_EDITIONS unless an enabling NSW HSC record exists.
//
// A record ENABLES only when it is complete (every check below passes) AND
// every item is `approved`. "Approved with changes" means the code must
// change, which changes the digest, so it can never enable this digest.
// Nothing here writes a record. The certification is a human act.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CERT_DIR = 'docs/marking/certifications';
const PACKET_FOLDER = { cbse: 'cbse', 'nsw-hsc': 'hsc' };
const VERDICTS = ['approved', 'approved-with-changes', 'rejected'];
const AUTOMATION = /\b(bot|claude|codex|gpt|openai|anthropic|automation|github-actions|agent|ci)\b|\[bot\]/i;
const sha = s => createHash('sha256').update(s).digest('hex');
const str = (v, min = 2) => typeof v === 'string' && v.trim().length >= min;
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** The packet's machine item list for a jurisdiction, or null. */
export function loadPacket(jurisdiction, root = ROOT) {
  const folder = PACKET_FOLDER[jurisdiction];
  if (!folder) return null;
  const f = path.join(root, 'docs/marking/packets', folder, 'items.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/**
 * Verify one record. `text` is the record file's exact bytes (the operator
 * value binds them). Returns { complete, enables, refusals, operatorValue }.
 */
export function verifyRecord(text, { name = 'record.json', root = ROOT, packet, today = new Date().toISOString().slice(0, 10) } = {}) {
  const refusals = [];
  const no = m => refusals.push(m);
  let r;
  try { r = JSON.parse(text); } catch { return { complete: false, enables: false, refusals: ['not valid JSON'], operatorValue: null }; }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { complete: false, enables: false, refusals: ['not a JSON object'], operatorValue: null };

  if ('fixture' in r) no('a fixture record is never a certification');
  if (/synthetic|fixture|sample|example|placeholder/i.test(name)) no(`the file name "${name}" marks it as synthetic`);
  const allowed = ['schemaVersion', 'fixture', 'jurisdiction', 'syllabusVersions', 'dossierDigest', 'commit', 'examiners', 'decisions', 'signedOriginal', 'recordedBy'];
  for (const k of Object.keys(r)) if (!allowed.includes(k)) no(`unknown field "${k}"`);
  if (r.schemaVersion !== 1) no('schemaVersion must be 1');
  const pk = packet ?? loadPacket(r.jurisdiction, root);
  if (!PACKET_FOLDER[r.jurisdiction]) no(`jurisdiction must be one of ${Object.keys(PACKET_FOLDER).join(', ')}`);
  else if (!pk) no(`no packet for ${r.jurisdiction}`);
  else if (pk.jurisdiction !== r.jurisdiction) no(`record is for ${r.jurisdiction}, the packet is for ${pk.jurisdiction}`);

  if (pk) {
    const sv = Array.isArray(r.syllabusVersions) ? [...r.syllabusVersions].sort() : null;
    if (!sv || JSON.stringify(sv) !== JSON.stringify([...pk.syllabusVersions].sort())) no(`syllabusVersions must be exactly ${pk.syllabusVersions.join(', ')}`);
    if (r.dossierDigest !== pk.dossierDigest) no(`stale or wrong dossier digest: the record names ${String(r.dossierDigest).slice(0, 16)}…, the current ${pk.jurisdiction} dossier is ${pk.dossierDigest.slice(0, 16)}…`);
  }
  if (typeof r.commit !== 'string' || !/^[0-9a-f]{40}$/.test(r.commit)) no('commit must be a 40-character commit id');

  const ex = Array.isArray(r.examiners) ? r.examiners : [];
  const min = pk?.minExaminers ?? 1;
  if (ex.length < min) no(`needs at least ${min} examiner(s), has ${ex.length}`);
  ex.forEach((e, i) => {
    const who = `examiner ${i + 1}`;
    if (!e || typeof e !== 'object') { no(`${who} is not an object`); return; }
    for (const k of ['name', 'qualification', 'affiliation', 'conflicts']) if (!str(e[k])) no(`${who}: missing ${k}`);
    if (e.independent !== true) no(`${who}: independence not confirmed`);
    if (!str(e.independenceStatement, 20)) no(`${who}: missing independence statement`);
    if (!isDate(e.date)) no(`${who}: date must be a real YYYY-MM-DD date`);
    else if (e.date > today) no(`${who}: date ${e.date} is in the future`);
    if (str(e.name) && AUTOMATION.test(e.name)) no(`${who}: an automation identity cannot be an examiner`);
  });
  if (new Set(ex.map(e => String(e?.name || '').trim().toLowerCase())).size !== ex.length) no('the examiners must be different people');

  const d = r.decisions && typeof r.decisions === 'object' && !Array.isArray(r.decisions) ? r.decisions : null;
  if (!d) no('decisions must be an object of item → verdict');
  else if (pk) {
    const missing = pk.items.filter(id => !(id in d));
    const unknown = Object.keys(d).filter(id => !pk.items.includes(id));
    if (missing.length) no(`incomplete: no decision for ${missing.length} item(s), e.g. ${missing.slice(0, 3).join(', ')}`);
    if (unknown.length) no(`scope names ${unknown.length} item(s) that do not exist in the current packet, e.g. ${unknown.slice(0, 3).join(', ')}`);
    for (const [id, v] of Object.entries(d)) if (!v || !VERDICTS.includes(v.verdict)) no(`${id}: verdict must be one of ${VERDICTS.join(', ')}`);
  }
  const so = r.signedOriginal;
  if (!so || !str(so.heldBy) || !str(so.location) || !isDate(so.receivedOn)) no('signedOriginal must say who holds the signed original, where, and when it was received');
  if (!str(r.recordedBy)) no('recordedBy must name the human who transcribed the signed original');
  else if (AUTOMATION.test(r.recordedBy)) no(`recordedBy "${r.recordedBy}" is an automation identity`);

  const complete = refusals.length === 0;
  const enables = complete && Object.values(d).every(v => v.verdict === 'approved');
  return { complete, enables, refusals, operatorValue: enables ? `${r.jurisdiction}:${path.basename(name)}:sha256:${sha(text)}` : null };
}

/** Is this file a fabricated or fixture record? Name, flag or author. */
export function fabricated(name, text) {
  if (/synthetic|fixture|sample|example|placeholder/i.test(name)) return `file name "${name}" marks it as synthetic`;
  let r;
  try { r = JSON.parse(text); } catch { return null; }
  if (r && typeof r === 'object' && 'fixture' in r) return 'carries the fixture flag';
  if (r && typeof r.recordedBy === 'string' && AUTOMATION.test(r.recordedBy)) return `recorded by an automation identity ("${r.recordedBy}")`;
  return null;
}

const CONFIG_FILE = /(^|\/)(Dockerfile[^/]*|Procfile|\.env[^/]*|[^/]+\.(ya?ml|toml|json|sh|ini|conf))$/;
const SETS_ON = /PRI_METHOD_MARKS\s*["']?\s*[:=]\s*["']?\s*on\b/i;
const NAMES_RESULT = /PRI_METHOD_MARKS_EXAMINER_RESULT\s*["']?\s*[:=]\s*["']?\s*([^\s"',}]+)/;

/**
 * The repository gate. `files` (tracked paths) and `uncertifiedEditions` can be
 * injected by tests. Returns { ok, failures, records, summary }.
 */
export async function gate({ root = ROOT, files, uncertifiedEditions, today } = {}) {
  const failures = [];
  const dir = path.join(root, CERT_DIR);
  const records = [];
  if (!existsSync(dir)) failures.push(`${CERT_DIR} is missing`);
  else {
    for (const f of readdirSync(dir).sort()) {
      if (f === 'README.md' || f === 'schema.json') continue;
      const rel = `${CERT_DIR}/${f}`;
      if (!f.endsWith('.json')) { failures.push(`${rel}: only README.md, schema.json and signed records (*.json) belong here`); continue; }
      const text = readFileSync(path.join(dir, f), 'utf8');
      const fab = fabricated(f, text);
      if (fab) { failures.push(`${rel}: fabricated record — ${fab}`); continue; }
      const v = verifyRecord(text, { name: f, root, today });
      records.push({ file: rel, jurisdiction: (() => { try { return JSON.parse(text).jurisdiction; } catch { return null; } })(), ...v });
    }
  }
  const enabling = j => records.filter(r => r.jurisdiction === j && r.enables);

  // CBSE / process-wide switch: no tracked deploy config turns it on without an enabling record.
  const tracked = files ?? execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const allowedValues = new Set(enabling('cbse').map(r => r.operatorValue));
  for (const f of tracked) {
    if (!CONFIG_FILE.test(f) || f.startsWith('docs/') || f.startsWith('tools/test-fixtures/') || f.startsWith(`${CERT_DIR}/`) || f.includes('node_modules/')) continue;
    const abs = path.join(root, f);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    const on = SETS_ON.test(text);
    const named = text.match(NAMES_RESULT)?.[1] || null;
    if (!on && !named) continue;
    if (!allowedValues.size) failures.push(`${f}: turns method marks on or names an examiner result, but no enabling CBSE certification record exists`);
    else if (named && !allowedValues.has(named)) failures.push(`${f}: names examiner result "${named}", which no enabling record yields`);
    else if (on && !named) failures.push(`${f}: sets PRI_METHOD_MARKS=on without naming the examiner result`);
  }

  // NSW: Prithagoras stays uncertified unless an enabling NSW HSC record exists.
  const unc = uncertifiedEditions ?? (await import(pathToFileURL(path.join(root, 'server/platform/editionMarking.js')).href)).UNCERTIFIED_EDITIONS;
  if (!unc.includes('prithagoras') && !enabling('nsw-hsc').length) failures.push('server/platform/editionMarking.js: prithagoras was removed from UNCERTIFIED_EDITIONS without an enabling NSW HSC certification record');

  const summary = { cbse: enabling('cbse').length ? 'ON permitted (signed record)' : 'OFF', 'nsw-hsc': enabling('nsw-hsc').length ? 'ON permitted (signed record)' : 'OFF' };
  return { ok: failures.length === 0, failures, records, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--gate') {
    const g = await gate();
    for (const r of g.records) if (!r.complete) console.log(`note: ${r.file} is not a complete record (enables nothing): ${r.refusals.join('; ')}`);
    if (!g.ok) { for (const f of g.failures) console.error(`EXAMINER CERTIFICATION GATE: FAIL — ${f}`); process.exit(1); }
    console.log(`EXAMINER CERTIFICATION GATE: PASS — ${g.records.length} signed record(s); method marks: CBSE ${g.summary.cbse}, NSW HSC ${g.summary['nsw-hsc']}`);
  } else if (args[0]) {
    const file = path.resolve(args[0]);
    const v = verifyRecord(readFileSync(file, 'utf8'), { name: path.basename(file) });
    if (!v.complete) { console.error('REFUSED — this record enables nothing:'); for (const m of v.refusals) console.error(`  · ${m}`); process.exit(1); }
    if (!v.enables) { console.error('REFUSED — the record is complete, but not every item is approved, so method marks stay off. Items approved with changes need a code change and a new signed dossier.'); process.exit(1); }
    console.log('VALID — a complete, current, signed record with every item approved.');
    console.log(`PRI_METHOD_MARKS_EXAMINER_RESULT=${v.operatorValue}`);
    console.log('Setting it is the owner\'s decision, made with the app and store wording change in the same release.');
  } else {
    console.error('usage: node tools/verify-examiner-certification.mjs <record.json> | --gate');
    process.exit(2);
  }
}
