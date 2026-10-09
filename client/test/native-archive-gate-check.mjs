// The archive gate itself: an iPad build with no production server origin can
// never mark an answer, and nothing in the repository can see the origin (it
// is an archive-time build setting), so the gate that reads the built product
// must refuse every unusable value.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { originProblem, checkArchive } from '../../scripts/check-native-archive.mjs';

let n = 0;
const bad = (v, why) => { assert.ok(originProblem(v), `${why}: ${JSON.stringify(v)} must be refused`); n++; };
bad(undefined, 'missing'); bad('', 'empty'); bad('   ', 'blank'); bad('$(PRI_CLOUD_ORIGIN)', 'unsubstituted setting');
bad('http://pri.example.com', 'plain http'); bad('https://localhost', 'loopback name'); bad('https://127.0.0.1', 'loopback address');
bad('https://192.168.1.20', 'private address'); bad('https://pri.local', 'mDNS host'); bad('https://intranet', 'single-label host');
bad('https://pri.example.com/v1', 'a path'); bad('https://pri.example.com?x=1', 'a query'); bad('https://user:pw@pri.example.com', 'credentials');
bad('https://pri-learning-staging-staging.up.railway.app', 'a staging host'); bad('not a url', 'not a URL');
assert.equal(originProblem('https://api.prilearning.example'), null, 'a bare https origin is accepted'); n++;
assert.equal(originProblem('https://api.prilearning.example/'), null, 'with or without the trailing slash'); n++;

const dir = mkdtempSync(join(tmpdir(), 'pri-archive-gate-'));
try {
  const app = (origin, bundle = 'com.prilearning.app', sha = 'a'.repeat(40)) => {
    const root = join(dir, `${Math.random().toString(36).slice(2)}.xcarchive`, 'Products', 'Applications', 'PriLearning.app');
    mkdirSync(join(root, 'Web'), { recursive: true });
    writeFileSync(join(root, 'Info.plist'), `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>${bundle}</string><key>CFBundleShortVersionString</key><string>4.0</string><key>CFBundleVersion</key><string>3</string><key>PRICloudOrigin</key>${origin === '' ? '<string></string>' : `<string>${origin}</string>`}</dict></plist>`);
    writeFileSync(join(root, 'Web', 'release.json'), JSON.stringify({ releaseSha: sha }));
    return join(root, '..', '..', '..');
  };
  assert.deepEqual(checkArchive(app('https://api.prilearning.example'), { sha: 'a'.repeat(40) }).problems, [], 'a correct archive passes'); n++;
  assert.equal(checkArchive(app('')).problems.length, 1, 'an archive with no origin fails'); n++;
  assert.equal(checkArchive(app('https://api.prilearning.example', 'com.prilearning.qa')).problems.length, 1, 'a QA bundle id is not the shipping app'); n++;
  assert.equal(checkArchive(app('https://api.prilearning.example'), { sha: 'b'.repeat(40) }).problems.length, 1, 'a build from another commit fails'); n++;
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`NATIVE ARCHIVE GATE CHECK: PASS — ${n}/${n} checks — an iPad build without a usable production server origin is refused.`);
