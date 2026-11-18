// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 practice papers (server/platform/papers.js)
//
//   1 · the manifest is the truth about the files: every PDF named exists, its
//       sha256 and size match, it is a PDF, and nothing else sits beside them;
//   2 · scoping by edition: Prithagoras lists the papers, Priyabhata answers
//       404 PAPERS_NOT_AVAILABLE to the list and to a download;
//   3 · who may download: signed out 401; a free account reads the list but
//       gets 402 PREMIUM_REQUIRED (premium-exams) on every file except the
//       sample, Practice Paper 01 (paper and guidelines), which is free;
//       Premium, an active trial and grace get every file, byte for byte; an
//       expired period, a refunded or revoked state and a claim in a header or
//       query are Free;
//   4 · an unknown id, an unknown kind, a paper with no guidelines and every
//       traversal attempt are 404 and never read outside the papers directory;
//   5 · the response is an attachment, application/pdf, no-store.
// Accounts are SYNTHETIC; the PDFs are the owner's real papers.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checks, cookieHeader, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { asStore } from '../platform/store.js';
import { PAPERS_DIR, PAPERS_CAPABILITY, loadManifest } from '../platform/papers.js';

const c = checks();
const DAY = 86_400_000;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const real = loadManifest();

// ── 1 · the manifest matches the files on disk ────────────────────────────────
c.eq(real.edition, 'prithagoras', 'the manifest is the Prithagoras edition\'s');
const SHIPPED = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];
c.deq(real.papers.map(p => p.id), SHIPPED.map(n => `ext1-2027-p${n}`), 'thirteen practice papers ship, in order: 01-13 (08, 09, 11 and 12 are the scope-revised versions, each replaced part re-solved 18 Nov 2026)');
c.deq(real.papers.map(p => p.title), SHIPPED.map(n => `Practice Paper ${n}`), 'titled "Practice Paper NN"');
const named = new Set(['manifest.json']);
for (const p of real.papers) {
  c.deq([p.course, p.yearLevel, p.marks, p.workingTime], ['nsw-ext1', 12, 70, '2 hours'], `${p.id}: course, year level, marks and working time`);
  c.eq(p.hasGuidelines, p.guidelines !== null, `${p.id}: hasGuidelines agrees with the guidelines file`);
  for (const f of [p.paper, p.guidelines].filter(Boolean)) {
    named.add(f.file);
    const bytes = readFileSync(join(PAPERS_DIR, f.file));
    c.eq(sha(bytes), f.sha256, `${f.file}: sha256 matches the manifest`);
    c.eq(bytes.length, f.bytes, `${f.file}: size matches the manifest`);
    c.eq(bytes.subarray(0, 5).toString('latin1'), '%PDF-', `${f.file}: is a PDF`);
    c.ok(Number.isInteger(f.pages) && f.pages > 0, `${f.file}: has a page count`);
    c.match(f.file, /^ext1-2027-[a-z0-9]+(-guidelines)?\.pdf$/, `${f.file}: a short slug name`);
  }
}
c.deq(readdirSync(PAPERS_DIR).sort(), [...named].sort(), 'the directory holds exactly the manifest and the files it names');
c.deq(real.papers.filter(p => p.sample).map(p => p.id), ['ext1-2027-p01'], 'Practice Paper 01 is the only free sample; the other twelve are Premium');
c.deq(real.papers.map(p => [p.hasGuidelines, p.paper.pages, p.guidelines.pages]), [[true, 19, 14], [true, 18, 12], [true, 17, 11], [true, 18, 11], [true, 18, 11], [true, 17, 12], [true, 17, 11], [true, 18, 12], [true, 14, 10], [true, 16, 9], [true, 15, 10], [true, 15, 9], [true, 20, 22]], 'every paper has its marking guidelines, with the page counts of the rebuilt files');

// Text scan of every shipped PDF, under node (pdfjs-dist, the client's own dependency): the brand is spelled right,
// and no personal contact, street address or old spelling is in any of them (B1 of the review of #1058: the owner's
// mobile number and personal email were once printed on the last page of twenty-four of them).
const pdfjs = await import(new URL('../../client/node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href);
async function pdfText(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(PAPERS_DIR, file))), useSystemFonts: false, verbosity: 0 }).promise;
  let out = '';
  for (let n = 1; n <= doc.numPages; n++) out += `${(await (await doc.getPage(n)).getTextContent()).items.map(it => it.str).join(' ')}\n`;
  return out;
}
const SCAN = [
  ['an iCloud address', /@\s*icloud|icloud\s*\.\s*com/i],
  ['an Australian mobile number', /(?:\+?\s*61\s*)?\(?0?4\d{2}\)?[\s-]*\d{3}[\s-]*\d{3}\b|\b04\d{2}\s?\d{3}\s?\d{3}\b/],
  ['a street address', /\b\d{1,4}\s+[A-Z][a-z]+\s+(?:Pl|Place|St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ct|Court|Cres|Crescent|Lane|Ln)\b|\bOakville\b|\bNSW\s+2\d{3}\b/],
  ['the old spelling', /Pritagoras/i],
  ['the owner\'s personal name beside a contact', /Priysharan/i]
];
const pdfFiles = [...named].filter(f => f.endsWith('.pdf'));
const brandRows = [];
const scanHits = [];
for (const f of pdfFiles) {
  const text = await pdfText(f);
  brandRows.push([f, /Prithagoras/.test(text)]);
  for (const [label, re] of SCAN) if (re.test(text)) scanHits.push(`${f}: ${label}`);
}
c.eq(brandRows.length, 26, 'the text scan read all twenty-six PDFs');
c.deq(brandRows.filter(r => !r[1]).map(r => r[0]), [], 'every shipped PDF contains "Prithagoras"');
c.deq(scanHits, [], 'no shipped PDF carries an iCloud address, an Australian mobile number, a street address, the owner\'s name or the old spelling');
// The scan itself is proved on a string that must trip it.
c.ok(SCAN.every(([, re]) => re.test(['0416 169 219', 'impriysharan' + '@' + 'icloud.com', '5 Juniper' + ' Pl', 'Oakv' + 'ille', 'Prit' + 'agoras', 'Priysh' + 'aran'].join(' '))) , 'each pattern catches what it exists to catch');
c.eq(PAPERS_CAPABILITY, 'premium-exams', 'the capability is the existing premium one');

// ── The fixture: the real files plus two TEST-ONLY entries ────────────────────
// A paper without guidelines, so that path stays proved. It reuses a real
// paper's bytes under another name; every other entry is the real manifest.
const fixtureDir = mkdtempSync(join(tmpdir(), 'pri-papers-fixture-'));
const SAMPLE = 'ext1-2027-p01';
const NO_GUIDE = 'ext1-test-noguide';
const LOCKED = 'ext1-2027-p02';
const base = real.papers[0];
for (const f of named) if (f.endsWith('.pdf')) copyFileSync(join(PAPERS_DIR, f), join(fixtureDir, f));
copyFileSync(join(PAPERS_DIR, base.paper.file), join(fixtureDir, `${NO_GUIDE}.pdf`));
const entry = (id, title, extra) => ({ ...base, id, title, sample: false, ...extra,
  paper: { ...base.paper, file: `${id}.pdf` }, guidelines: extra.hasGuidelines === false ? null : { ...base.guidelines, file: `${id}-guidelines.pdf` } });
const manifest = { ...real, papers: [...real.papers, entry(NO_GUIDE, 'Practice Paper 99', { hasGuidelines: false })] };
writeFileSync(join(fixtureDir, 'manifest.json'), JSON.stringify(manifest));

// ── Over HTTP ─────────────────────────────────────────────────────────────────
const hAu = await startApp({ resources: { edition: 'prithagoras' }, papers: { dir: fixtureDir } });
const hIn = await startApp({ resources: { edition: 'priyabhata' }, papers: { dir: fixtureDir } });
try {
  const now = Date.now();
  async function student(h, email, state) {
    const r = await registerAccount(h, { email });
    await verifyEmail(h, r.account.id);
    if (state) {
      await asStore(h.db).run('INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,grace_until,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until',
        [r.account.id, state.plan ?? 'premium', state.status, 'web', state.end ?? now + 30 * DAY, state.grace ?? null, now]);
    }
    return r.jar;
  }
  const get = (h, path, jar, headers = {}) => h.request(path, { jar, headers });
  const bytesOf = async (h, path, jar) => {
    const response = await fetch(`${h.origin}${path}`, { headers: { Cookie: cookieHeader(jar) } });
    return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
  };
  const free = await student(hAu, 'free@example.test', null);
  const freeRow = await student(hAu, 'freerow@example.test', { plan: 'free', status: 'free' });
  const paid = await student(hAu, 'paid@example.test', { status: 'active' });
  const trial = await student(hAu, 'trial@example.test', { status: 'trialing', end: now + 5 * DAY });
  const grace = await student(hAu, 'grace@example.test', { status: 'grace', end: now - DAY, grace: now + 2 * DAY });
  const expired = await student(hAu, 'expired@example.test', { status: 'active', end: now - DAY });
  const revoked = await student(hAu, 'revoked@example.test', { status: 'revoked' });

  // signed out
  c.eq((await get(hAu, '/v1/papers')).status, 401, 'signed out: no list');
  c.eq((await get(hAu, `/v1/papers/${SAMPLE}/paper`)).status, 401, 'signed out: not even the sample');

  // 2 · the list
  const list = await get(hAu, '/v1/papers', free);
  c.eq(list.status, 200, 'a free account reads the list');
  c.eq(list.headers.get('cache-control'), 'private, no-store', 'the list is not cached');
  c.deq([list.data.available, list.data.premium, list.data.capability], [true, false, 'premium-exams'], 'a free account is told it is not Premium');
  c.deq(list.data.papers.map(p => p.id), manifest.papers.map(p => p.id), 'every paper is listed, in manifest order');
  c.deq(list.data.papers.filter(p => !p.locked).map(p => p.id), [SAMPLE], 'for a free account only the sample is unlocked');
  const row = list.data.papers[0];
  c.deq([row.title, row.marks, row.workingTime, row.pages, row.hasGuidelines, row.guidelinesPages, row.yearLevel, row.course], ['Practice Paper 01', 70, '2 hours', 19, true, 14, 12, 'nsw-ext1'], 'a row carries title, marks, time, pages');
  c.ok(!JSON.stringify(list.data).match(/sha256|\.pdf|server\/content/), 'the list names no file, hash or path');
  c.deq((await get(hAu, '/v1/papers', paid)).data.papers.filter(p => p.locked), [], 'Premium: nothing is locked');
  c.eq((await get(hAu, '/v1/papers', paid)).data.premium, true, 'Premium is reported from the server\'s own row');
  c.eq((await get(hAu, '/v1/papers', freeRow)).data.premium, false, 'a free-plan row is not Premium');
  c.eq((await get(hAu, '/v1/papers', free, { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'premium-exams' })).data.premium, false, 'a Premium claim in a header changes nothing');
  c.eq((await get(hAu, '/v1/papers?premium=1&edition=prithagoras', free)).data.premium, false, 'a query claim changes nothing');

  // 3 · downloads
  const sample = await bytesOf(hAu, `/v1/papers/${SAMPLE}/paper`, free);
  c.eq(sample.status, 200, 'the sample paper is free to a free account');
  c.eq(sha(sample.bytes), real.papers[0].paper.sha256, 'the sample paper arrives byte for byte');
  c.eq(sample.headers.get('content-type'), 'application/pdf', 'application/pdf');
  c.match(sample.headers.get('content-disposition'), /^attachment; filename="[A-Za-z0-9._-]+\.pdf"$/, 'an attachment with a plain file name');
  c.eq(sample.headers.get('cache-control'), 'private, no-store', 'no-store');
  c.eq(sample.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  c.eq(Number(sample.headers.get('content-length')), sample.bytes.length, 'content-length is the file\'s');
  const sampleGuide = await bytesOf(hAu, `/v1/papers/${SAMPLE}/guidelines`, free);
  c.deq([sampleGuide.status, sha(sampleGuide.bytes)], [200, real.papers[0].guidelines.sha256], 'the sample\'s marking guidelines are free too');
  c.match(sampleGuide.headers.get('content-disposition'), /Marking-Guidelines\.pdf"$/, 'the guidelines file says what it is');
  for (const kind of ['paper', 'guidelines']) {
    const refusal = await get(hAu, `/v1/papers/${LOCKED}/${kind}`, free);
    c.deq([refusal.status, refusal.data?.error?.code, refusal.data?.error?.capability, refusal.data?.error?.plan, refusal.data?.error?.retryable], [402, 'PREMIUM_REQUIRED', 'premium-exams', 'free', false],
      `a free account is refused ${LOCKED}/${kind}: the existing Premium-required shape`);
    c.eq(refusal.headers.get('content-type')?.startsWith('application/json'), true, 'the refusal is JSON, never a PDF');
    c.eq(refusal.headers.get('cache-control'), 'private, no-store', 'the refusal is not cached');
  }
  c.eq((await get(hAu, `/v1/papers/${LOCKED}/paper`, freeRow)).status, 402, 'a free-plan row is refused');
  c.eq((await get(hAu, `/v1/papers/${LOCKED}/paper`, free, { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'premium-exams' })).status, 402, 'a Premium claim in a header changes nothing');
  c.eq((await get(hAu, `/v1/papers/${LOCKED}/paper?plan=premium`, free)).status, 402, 'a query claim changes nothing');
  for (const [name, jar] of [['an expired period', expired], ['a revoked state', revoked]]) {
    c.eq((await get(hAu, `/v1/papers/${LOCKED}/paper`, jar)).status, 402, `${name} is Free`);
  }
  for (const [name, jar] of [['an active subscription', paid], ['an active trial', trial], ['a grace period', grace]]) {
    for (const p of manifest.papers) {
      for (const [kind, f] of [['paper', p.paper], ['guidelines', p.guidelines]]) {
        if (!f) continue;
        const got = await bytesOf(hAu, `/v1/papers/${p.id}/${kind}`, jar);
        if (got.status !== 200 || sha(got.bytes) !== f.sha256) c.ok(false, `${name}: ${p.id}/${kind} should arrive intact (status ${got.status})`);
      }
    }
    c.ok(true, `${name}: every paper and every guidelines file arrives, byte for byte`);
  }

  // 4 · unknown, absent, traversal
  const missing = async (path, jar = paid) => { const r = await get(hAu, path, jar); return [r.status, r.data?.error?.code]; };
  c.deq(await missing(`/v1/papers/${NO_GUIDE}/guidelines`), [404, 'PAPER_NOT_FOUND'], 'a paper with no guidelines: 404');
  c.eq((await get(hAu, `/v1/papers/${NO_GUIDE}/paper`, paid)).status, 200, '... but its paper downloads');
  c.deq(await missing('/v1/papers/ext1-2027-p99/paper'), [404, 'PAPER_NOT_FOUND'], 'an unknown id: 404 for Premium');
  c.deq(await missing('/v1/papers/ext1-2027-p99/paper', free), [404, 'PAPER_NOT_FOUND'], 'an unknown id: the same 404 for a free account');
  c.deq(await missing(`/v1/papers/${SAMPLE}/answers`), [404, 'PAPER_NOT_FOUND'], 'an unknown kind: 404');
  for (const bad of ['..%2F..%2Fmanifest', '..%2fmanifest.json', '%2e%2e%2fmanifest', '..', '.', 'ext1-2027-p13.pdf', 'ext1-2027-p13%00', 'ext1-2027-p13%2F..%2F..%2Fmanifest', '__proto__', 'constructor', 'toString', 'EXT1-2027-P13', '%2Fetc%2Fpasswd', 'C%3A%5Cwindows']) {
    for (const kind of ['paper', 'guidelines', '..%2Fmanifest.json', 'paper.pdf', '__proto__', 'constructor', 'hasOwnProperty']) {
      const r = await get(hAu, `/v1/papers/${bad}/${kind}`, paid);
      if (![404, 400].includes(r.status) || (r.headers.get('content-type') || '').includes('pdf') || (r.text || '').includes('"papers"')) c.ok(false, `traversal ${bad}/${kind} answered ${r.status}`);
    }
  }
  c.ok(true, 'no traversal attempt, in the id or the kind, reaches a file');
  c.eq((await get(hAu, `/v1/papers/${SAMPLE}/paper/extra`, paid)).status, 404, 'an extra path segment: 404');
  c.eq((await get(hAu, '/v1/papers/manifest.json', paid)).status, 404, 'the manifest is not a downloadable name');
  for (const path of ['/papers/ext1-2027-p13.pdf', '/server/content/papers/nsw-ext1/ext1-2027-p13.pdf', '/content/papers/nsw-ext1/manifest.json']) {
    const r = await bytesOf(hAu, path, paid);
    c.ok(r.status !== 200 || r.headers.get('content-type') !== 'application/pdf', `${path} is not served as a file`);
  }

  // 2 · the other edition
  const inFree = await student(hIn, 'in-free@example.test', null);
  const inPaid = await student(hIn, 'in-paid@example.test', { status: 'active' });
  for (const [name, jar] of [['free', inFree], ['Premium', inPaid]]) {
    const l = await get(hIn, '/v1/papers', jar);
    c.deq([l.status, l.data?.error?.code, l.data?.papers], [404, 'PAPERS_NOT_AVAILABLE', undefined], `Priyabhata: a ${name} account's list is 404`);
    const d = await get(hIn, `/v1/papers/${SAMPLE}/paper`, jar);
    c.deq([d.status, d.data?.error?.code, (d.headers.get('content-type') || '').includes('pdf')], [404, 'PAPERS_NOT_AVAILABLE', false], `Priyabhata: a ${name} account's download is 404`);
  }
  c.eq((await get(hIn, '/v1/papers')).status, 401, 'Priyabhata: signed out is still 401');
} finally {
  await hAu.close();
  await hIn.close();
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(`PRACTICE PAPERS: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC accounts; the PDFs are the owner's real papers]`);
