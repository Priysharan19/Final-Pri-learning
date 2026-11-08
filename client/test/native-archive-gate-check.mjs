// The archive gate itself: an iPad build with no production server origin can
// never mark an answer, and nothing in the repository can see the origin (it
// is an archive-time build setting), so the gate that reads the built product
// must refuse every unusable value.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { originProblem, checkArchive, probeOrigin, backendEvidence, CANDIDATE_ORIGIN, BACKEND_HOSTS } from '../../scripts/check-native-archive.mjs';

let n = 0;
const bad = (v, why) => { assert.ok(originProblem(v), `${why}: ${JSON.stringify(v)} must be refused`); n++; };
bad(undefined, 'missing'); bad('', 'empty'); bad('   ', 'blank'); bad('$(PRI_CLOUD_ORIGIN)', 'unsubstituted setting');
bad('http://pri.example.com', 'plain http'); bad('https://localhost', 'loopback name'); bad('https://127.0.0.1', 'loopback address');
bad('https://192.168.1.20', 'private address'); bad('https://pri.local', 'mDNS host'); bad('https://intranet', 'single-label host');
bad('https://pri.example.com/v1', 'a path'); bad('https://pri.example.com?x=1', 'a query'); bad('https://user:pw@pri.example.com', 'credentials');
bad('https://pri-learning-staging-staging.up.railway.app', 'a staging host'); bad('not a url', 'not a URL');
// D5 (Director decision, 9 Nov 2026): every native archive names exactly the public origin.
assert.equal(CANDIDATE_ORIGIN, 'https://app.prilearning.com', 'the one origin a native archive may name'); n++;
assert.equal(originProblem('https://app.prilearning.com'), null, 'the candidate origin is accepted'); n++;
assert.equal(originProblem('https://app.prilearning.com/'), null, 'with or without the trailing slash'); n++;
assert.equal(originProblem('https://APP.PriLearning.com'), null, 'a host is case-insensitive'); n++;
bad('https://final-pri-learning-production.up.railway.app', 'the raw production Railway host');
bad('https://pri-api.up.railway.app', 'any raw Railway host');
bad('https://railway.app', 'Railway itself');
bad('https://api.prilearning.example', 'any other https origin');
bad('https://prilearning.com', 'the public site, not the app');
bad('https://app.prilearning.com:8443', 'the right host on another port');
bad('http://app.prilearning.com', 'the right host over http');
bad('https://app.prilearning.com.evil.example', 'a look-alike host');
bad('https://app.prilearning.com/v1', 'the right host with a path');

const dir = mkdtempSync(join(tmpdir(), 'pri-archive-gate-'));
try {
  const app = (origin, bundle = 'com.prilearning.app', sha = 'a'.repeat(40)) => {
    const root = join(dir, `${Math.random().toString(36).slice(2)}.xcarchive`, 'Products', 'Applications', 'PriLearning.app');
    mkdirSync(join(root, 'Web'), { recursive: true });
    writeFileSync(join(root, 'Info.plist'), `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>${bundle}</string><key>CFBundleShortVersionString</key><string>4.0</string><key>CFBundleVersion</key><string>3</string><key>PRICloudOrigin</key>${origin === '' ? '<string></string>' : `<string>${origin}</string>`}</dict></plist>`);
    writeFileSync(join(root, 'Web', 'release.json'), JSON.stringify({ releaseSha: sha }));
    return join(root, '..', '..', '..');
  };
  assert.deepEqual(checkArchive(app('https://app.prilearning.com'), { sha: 'a'.repeat(40) }).problems, [], 'a correct archive passes'); n++;
  assert.ok(checkArchive(app(''), { sha: 'a'.repeat(40) }).problems.some(p => /empty/.test(p)), 'an archive with no origin fails'); n++;
  assert.ok(checkArchive(app('https://app.prilearning.com')).problems.some(p => /--sha/.test(p)), 'an archive checked without the release commit fails'); n++;
  assert.equal(checkArchive(app('https://app.prilearning.com', 'com.prilearning.qa'), { sha: 'a'.repeat(40) }).problems.length, 1, 'a QA bundle id is not the shipping app'); n++;
  assert.equal(checkArchive(app('https://app.prilearning.com'), { sha: 'b'.repeat(40) }).problems.length, 1, 'a build from another commit fails'); n++;
} finally { rmSync(dir, { recursive: true, force: true }); }
const answer = body => async () => ({ ok: true, json: async () => body });
assert.equal(await probeOrigin('https://api.prilearning.example', 'a'.repeat(40), answer({ service: 'pri-learning-platform', releaseIdentity: { releaseSha: 'a'.repeat(40) } })), null, 'an origin serving this release passes the probe'); n++;
assert.match(await probeOrigin('https://api.prilearning.example', 'a'.repeat(40), answer({ service: 'pri-learning-platform', releaseIdentity: { releaseSha: 'b'.repeat(40) } })), /is serving/, 'an origin on another release fails it'); n++;
assert.match(await probeOrigin('https://api.prilearning.example', 'a'.repeat(40), answer({ service: 'something-else' })), /did not answer as a Pri server/, 'a host that is not a Pri server fails it'); n++;
assert.match(await probeOrigin('https://api.prilearning.example', 'a'.repeat(40), async () => { throw new TypeError('fetch failed'); }), /could not be reached/, 'an unreachable origin fails it'); n++;

// Release evidence: which service app.prilearning.com fronts, and on which release.
{
  const SHA = 'a'.repeat(40);
  const serving = (sha, engine = 'postgres', web = sha) => async url => {
    const path = new URL(url).pathname;
    if (path === '/v1/health') return { ok: true, json: async () => ({ service: 'pri-learning-platform', releaseIdentity: { releaseSha: sha }, database: { engine }, schemaVersion: '13' }) };
    if (path === '/release.json') return { ok: true, json: async () => ({ releaseSha: web }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const cnameTo = (...chain) => async name => { const i = ['app.prilearning.com', ...chain].indexOf(name); return i >= 0 && i < chain.length ? [chain[i]] : []; };
  const stamp = { now: () => '2026-11-09T00:00:00.000Z' };
  const staging = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: serving(SHA), resolveCname: cnameTo(`${BACKEND_HOSTS.staging}.`), ...stamp });
  assert.deepEqual(staging, { origin: CANDIDATE_ORIGIN, checkedAt: '2026-11-09T00:00:00.000Z', cname: [BACKEND_HOSTS.staging], backend: 'staging',
    health: { service: 'pri-learning-platform', releaseSha: SHA, databaseEngine: 'postgres', schemaVersion: '13' }, webReleaseSha: SHA, sha: SHA, problems: [] },
    'before GO: app.prilearning.com CNAMEs to the staging service on the candidate SHA, and the record says so'); n++;
  const prod = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: serving(SHA, 'sqlite'), resolveCname: cnameTo('edge.example.net', BACKEND_HOSTS.production), ...stamp });
  assert.equal(prod.backend, 'production', 'after promotion it CNAMEs (through any hop) to the production service'); n++;
  assert.deepEqual(prod.cname, ['edge.example.net', BACKEND_HOSTS.production], 'and the whole chain is recorded'); n++;
  const stale = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: serving('b'.repeat(40), 'postgres', 'c'.repeat(40)), resolveCname: cnameTo(BACKEND_HOSTS.staging), ...stamp });
  assert.ok(stale.problems.some(p => /server is on b{40}/.test(p)) && stale.problems.some(p => /release\.json is c{40}/.test(p)),
    'a server or web bundle on another commit is a problem, each named'); n++;
  const elsewhere = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: serving(SHA), resolveCname: cnameTo('someone-else.example.net'), ...stamp });
  assert.ok(elsewhere.backend === 'unknown' && elsewhere.problems.some(p => /does not resolve to a known Pri service/.test(p)), 'a CNAME to neither service is unknown, and a problem'); n++;
  const noDns = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: serving(SHA), resolveCname: async () => { throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }); }, ...stamp });
  assert.ok(noDns.cname.length === 0 && noDns.backend === 'unknown' && noDns.problems.length === 1, 'no DNS answer is recorded as an empty chain, never as a known backend'); n++;
  const down = await backendEvidence(CANDIDATE_ORIGIN, { sha: SHA, fetchImpl: async () => { throw new TypeError('fetch failed'); }, resolveCname: cnameTo(BACKEND_HOSTS.staging), ...stamp });
  assert.ok(down.health === null && down.webReleaseSha === null && down.problems.some(p => /health could not be read/.test(p)) && down.problems.some(p => /release\.json could not be read/.test(p)),
    'an unreachable origin is two named problems, never a pass'); n++;
}
console.log(`NATIVE ARCHIVE GATE CHECK: PASS — ${n}/${n} checks — an iPhone + iPad build that does not name https://app.prilearning.com is refused, and the release evidence records which service it fronts on which release.`);
