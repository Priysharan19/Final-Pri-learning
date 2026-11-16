// Pri Learning · the examiner-certification verifier and gate (mission CERT).
//
// Proves: a synthetic fixture shaped exactly like a valid record for the
// current digest is still refused for being a fixture; with the fixture flag
// removed (in memory only, never on disk) it is complete and enables; and each
// defect — stale digest, wrong jurisdiction, a bank that does not exist, a
// missing independence statement, a missing item, a non-approved item, too few
// NSW examiners, an automation author — leaves method marks off. The gate
// passes on the tree, and fails on a planted fixture record, on a deploy file
// that turns method marks on without a record, and on Prithagoras leaving
// UNCERTIFIED_EDITIONS without one.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyRecord, loadPacket, gate, fabricated } from './verify-examiner-certification.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const fixtureText = readFileSync(path.join(ROOT, 'tools/test-fixtures/synthetic-cbse-certification.json'), 'utf8');
const base = JSON.parse(fixtureText);
const cbse = loadPacket('cbse'), nsw = loadPacket('nsw-hsc');
ok(cbse && nsw, 'both packets have items.json');

// A record shaped exactly right for the current CBSE digest (fixture flag kept).
const shaped = (packet, over = {}) => {
  const r = structuredClone(base);
  r.jurisdiction = packet.jurisdiction;
  r.syllabusVersions = [...packet.syllabusVersions];
  r.dossierDigest = packet.dossierDigest;
  r.commit = 'a'.repeat(40);
  r.examiners = Array.from({ length: packet.minExaminers }, (_, i) => ({ ...base.examiners[0], name: `Synthetic Examiner ${i + 1}` }));
  r.decisions = Object.fromEntries(packet.items.map(id => [id, { verdict: 'approved' }]));
  return Object.assign(r, over);
};
const unflag = r => { const c = structuredClone(r); delete c.fixture; return c; };
const check = (r, name = 'cert-2026.json') => verifyRecord(JSON.stringify(r, null, 2), { name, today: '2026-11-15' });

// 1. The fixture: right shape, refused for being a fixture.
const fx = check(shaped(cbse), 'synthetic-cbse-certification.json');
ok(!fx.complete && !fx.enables && fx.operatorValue === null, 'the synthetic fixture enables nothing');
ok(fx.refusals.some(m => /fixture/.test(m)), 'the fixture is refused for being a fixture');
ok(fx.refusals.every(m => /fixture|synthetic/.test(m)), `the fixture's only defects are fixture/synthetic: ${fx.refusals.join('; ')}`);

// 2. The same shape with no flag and a neutral name, in memory only: complete and enabling.
const good = check(unflag(shaped(cbse)));
ok(good.complete && good.enables && /^cbse:cert-2026\.json:sha256:[0-9a-f]{64}$/.test(good.operatorValue || ''), `a complete approved record enables: ${good.refusals.join('; ')}`);

// 3. Each defect leaves method marks off.
const refused = (label, r, re, name) => {
  const v = check(r, name);
  ok(!v.enables && v.operatorValue === null, `${label}: enables nothing`);
  ok(v.refusals.some(m => re.test(m)), `${label}: refused for the right reason — got ${v.refusals.join('; ')}`);
};
refused('stale digest', unflag(shaped(cbse, { dossierDigest: 'b'.repeat(64) })), /stale or wrong dossier digest/);
refused('wrong jurisdiction (CBSE record against the NSW packet)', (() => { const r = unflag(shaped(cbse)); r.jurisdiction = 'nsw-hsc'; return r; })(), /syllabusVersions|digest|examiner|item/);
{
  const r = unflag(shaped(cbse)); r.jurisdiction = 'nsw-hsc';
  const v = verifyRecord(JSON.stringify(r), { name: 'x.json', packet: cbse, today: '2026-11-15' });
  ok(!v.enables && v.refusals.some(m => /record is for nsw-hsc, the packet is for cbse/.test(m)), 'a record never verifies against another jurisdiction\'s packet');
}
refused('unknown jurisdiction', unflag(shaped(cbse, { jurisdiction: 'icse' })), /jurisdiction must be/);
refused('scope names a bank that does not exist', (() => { const r = unflag(shaped(cbse)); r.decisions['cbse-bank:c10-no-such-bank/D1'] = { verdict: 'approved' }; return r; })(), /do not exist/);
refused('missing independence statement', (() => { const r = unflag(shaped(cbse)); delete r.examiners[0].independenceStatement; return r; })(), /independence statement/);
refused('independence not confirmed', (() => { const r = unflag(shaped(cbse)); r.examiners[0].independent = false; return r; })(), /independence not confirmed/);
refused('incomplete: one item missing', (() => { const r = unflag(shaped(cbse)); delete r.decisions[cbse.items[0]]; return r; })(), /incomplete/);
refused('incomplete: no decisions', unflag(shaped(cbse, { decisions: {} })), /incomplete/);
refused('missing qualification', (() => { const r = unflag(shaped(cbse)); r.examiners[0].qualification = ''; return r; })(), /qualification/);
refused('future date', (() => { const r = unflag(shaped(cbse)); r.examiners[0].date = '2027-01-01'; return r; })(), /future/);
refused('impossible date', (() => { const r = unflag(shaped(cbse)); r.examiners[0].date = '2026-02-30'; return r; })(), /real YYYY-MM-DD/);
refused('no signed original', unflag(shaped(cbse, { signedOriginal: {} })), /signedOriginal/);
refused('automation author', unflag(shaped(cbse, { recordedBy: 'Claude agent' })), /automation/);
refused('automation examiner', (() => { const r = unflag(shaped(cbse)); r.examiners[0].name = 'github-actions[bot]'; return r; })(), /automation/);
refused('NSW with one examiner', unflag(shaped(nsw, { examiners: [{ ...base.examiners[0], name: 'Synthetic Examiner 1' }] })), /at least 2/);
refused('NSW with the same examiner twice', (() => { const r = unflag(shaped(nsw)); r.examiners[1].name = r.examiners[0].name; return r; })(), /different people/);
refused('CBSE digest on the NSW record', unflag(shaped(nsw, { dossierDigest: cbse.dossierDigest })), /stale or wrong dossier digest/);
refused('extra field', unflag(shaped(cbse, { methodMarks: 'on' })), /unknown field/);
refused('sample-named file', unflag(shaped(cbse)), /synthetic/, 'example-record.json');
{
  const r = unflag(shaped(cbse)); r.decisions[cbse.items[1]] = { verdict: 'approved-with-changes', notes: 'change it' };
  const v = check(r);
  ok(v.complete && !v.enables && v.operatorValue === null, 'a complete record with one item approved-with-changes enables nothing');
  r.decisions[cbse.items[1]] = { verdict: 'rejected' };
  ok(!check(r).enables, 'a complete record with one rejected item enables nothing');
}
ok(verifyRecord('{not json', { name: 'a.json' }).enables === false, 'malformed JSON enables nothing');
const nswGood = check(unflag(shaped(nsw)));
ok(nswGood.enables, `a complete NSW record with two examiners enables NSW: ${nswGood.refusals.join('; ')}`);

// 4. The gate.
const tree = await gate();
ok(tree.ok && tree.summary.cbse === 'OFF' && tree.summary['nsw-hsc'] === 'OFF', `the gate passes on the tree with method marks OFF: ${tree.failures.join('; ')}`);
ok(fabricated('synthetic-cbse-certification.json', fixtureText), 'the fixture is recognised as fabricated');

const tmp = mkdtempSync(path.join(tmpdir(), 'pri-cert-gate-'));
try {
  for (const d of ['docs/marking/packets', 'docs/marking/certifications']) cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  const certDir = path.join(tmp, 'docs/marking/certifications');
  const g = opts => gate({ root: tmp, files: [], uncertifiedEditions: ['prithagoras'], today: '2026-11-15', ...opts });
  ok((await g()).ok, 'the copied tree passes');

  writeFileSync(path.join(certDir, 'synthetic-cbse-certification.json'), fixtureText);
  const planted = await g();
  ok(!planted.ok && planted.failures.some(f => /fabricated/.test(f)), 'a planted fixture record fails the gate');
  rmSync(path.join(certDir, 'synthetic-cbse-certification.json'));

  writeFileSync(path.join(certDir, 'cert-flagged.json'), JSON.stringify(shaped(cbse)));
  ok(!(await g()).ok, 'a record carrying the fixture flag under any name fails the gate');
  rmSync(path.join(certDir, 'cert-flagged.json'));

  writeFileSync(path.join(certDir, 'cert-bot.json'), JSON.stringify(unflag(shaped(cbse, { recordedBy: 'pri-fleet automation' }))));
  ok(!(await g()).ok, 'a record authored by an automation identity fails the gate');
  rmSync(path.join(certDir, 'cert-bot.json'));

  writeFileSync(path.join(tmp, 'railway.json'), JSON.stringify({ deploy: { env: { PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'issue-499' } } }));
  const cfg = await g({ files: ['railway.json'] });
  ok(!cfg.ok && cfg.failures.some(f => /no enabling CBSE/.test(f)), 'a deploy file turning method marks on with no record fails');

  // An incomplete record (one item missing) does not switch them on.
  const partial = unflag(shaped(cbse)); delete partial.decisions[cbse.items.at(-1)];
  writeFileSync(path.join(certDir, 'cbse-2026-11.json'), JSON.stringify(partial, null, 2));
  const inc = await g({ files: ['railway.json'] });
  ok(!inc.ok && inc.summary.cbse === 'OFF', 'an incomplete record cannot switch method marks on');
  rmSync(path.join(certDir, 'cbse-2026-11.json'));

  // A complete record does, but only with exactly its operator value.
  const fullText = JSON.stringify(unflag(shaped(cbse)), null, 2);
  writeFileSync(path.join(certDir, 'cbse-2026-11.json'), fullText);
  const value = verifyRecord(fullText, { name: 'cbse-2026-11.json', root: tmp, today: '2026-11-15' }).operatorValue;
  ok(!(await g({ files: ['railway.json'] })).ok, 'a complete record does not bless a deploy file naming some other result');
  writeFileSync(path.join(tmp, 'railway.json'), JSON.stringify({ deploy: { env: { PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: value } } }));
  const blessed = await g({ files: ['railway.json'] });
  ok(blessed.ok && blessed.summary.cbse !== 'OFF', `a complete approved record permits exactly its own operator value: ${blessed.failures.join('; ')}`);
  ok(!(await g({ files: ['railway.json'], uncertifiedEditions: [] })).ok, 'a CBSE record never lets Prithagoras leave UNCERTIFIED_EDITIONS');
  rmSync(path.join(certDir, 'cbse-2026-11.json'));
  rmSync(path.join(tmp, 'railway.json'));

  writeFileSync(path.join(certDir, 'notes.txt'), 'x');
  ok(!(await g()).ok, 'a stray non-record file fails the gate');
} finally { rmSync(tmp, { recursive: true, force: true }); }

if (failures.length) { for (const f of failures) console.error(`  ✗ ${f}`); console.error(`EXAMINER CERTIFICATION VERIFIER: FAIL — ${failures.length} failed, ${pass} passed`); process.exit(1); }
console.log(`EXAMINER CERTIFICATION VERIFIER: PASS — ${pass}/${pass} checks`);
