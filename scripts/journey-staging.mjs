// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the native journey against the DEPLOYED staging service
//
//   node scripts/iphone-journey.mjs --staging --family iphone|ipad --app <DEBUG .app> \
//     [--origin https://app.prilearning.com] [--evidence out.json]
//
// A DEBUG simulator build (the only build that may be pointed at staging,
// NativeCloudBridge.swift) talks to staging, signs in with a code emailed to
// the owner's TEST inbox, writes on the real PencilKit surface, meets the D17
// prompt, is read by the REAL reader (OpenAI through staging), confirms the
// reading, is marked by the deployed server, finds the attempt in History, and
// deletes the test account it made (JourneySelfCheck.swift `--journey-staging`).
//
// Evidence class SIMULATOR + DEPLOYED: a simulator and programmatic strokes,
// against the real deployed service, a real reader and real email. It is
// never device, Pencil, finger or student evidence, and it says nothing about
// reading accuracy (the strokes are synthetic). Runnable nightly, for both
// families: scripts/journey-staging-nightly.sh.
//
// The inbox is read with tools/staging-inbox.mjs (L8, PR #746) from
// ~/Developer/.pri-fleet/staging-inbox.env. Without either the run is NOT
// MEASURED (exit 2) and records why; nothing is invented.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
export const STAGING_ORIGIN = 'https://pri-learning-staging-staging.up.railway.app';
export const STAGING_STEPS = Object.freeze(['stagingCardOnboarding', 'stagingInkRead', 'stagingConfirmedMarked', 'stagingHistory', 'stagingDeleteAccount']);
export const TIER = 'SIMULATOR + DEPLOYED';
export const INBOX_MODULE = join(ROOT, 'tools', 'staging-inbox.mjs');

/** The origin a staging run may use: staging itself, or the public origin while it fronts staging. */
export function stagingOriginProblem(origin) {
  let url;
  try { url = new URL(String(origin || '')); } catch { return `not a URL: ${origin}`; }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return `the staging origin must be a bare https origin (got ${origin})`;
  if (url.origin === STAGING_ORIGIN || url.origin === 'https://app.prilearning.com') return null;
  return `a staging run names ${STAGING_ORIGIN} or https://app.prilearning.com, not ${origin}`;
}

/** Why a staging run must not start against this backend (null when it may). Sign-up and deletion never run against production. */
export function stagingBackendProblem(evidence) {
  if (evidence?.backend === 'staging') return null;
  return `the origin declares itself ${evidence?.backend || 'unknown'}, not staging: a staging run signs up and deletes accounts, so it refuses`;
}

/** The inbox purpose a page's code request maps to (codeFromSubject purposes). */
export const inboxPurpose = purpose => (purpose === 'reauth' || purpose === 'delete' ? 'delete' : purpose === 'guardian' ? 'guardian' : 'sign-in');

/** { ok, reason, config, inbox } — the inbox module and its settings, or why not. */
export async function openInbox({ modulePath = INBOX_MODULE, file = null } = {}) {
  if (!existsSync(modulePath)) return { ok: false, reason: 'tools/staging-inbox.mjs is not on this checkout (it arrives with L8\'s staging journey, PR #746)' };
  const inbox = await import(pathToFileURL(modulePath).href);
  const loaded = file ? inbox.loadInbox(file) : inbox.loadInbox();
  if (!loaded.ok) return { ok: false, reason: `the test inbox is not usable: ${loaded.reason}` };
  return { ok: true, reason: null, config: loaded.config, inbox };
}

/** What the record says about itself, whatever the result. */
export function stagingEvidence({ sim = {}, steps = {}, origin, backend = null, sha = '', dirty = null, notMeasured = null, now = () => new Date().toISOString() } = {}) {
  const total = Object.keys(steps).length;
  const passed = Object.values(steps).filter(s => s.ok).length;
  return {
    schemaVersion: 1,
    evidenceClass: 'SIMULATOR_DEPLOYED',
    evidenceTier: TIER,
    physicalDevice: false,
    real: ['the built client in the shipped WKWebView shell (DEBUG build)', 'the native PencilKit surface and priInk bridge',
      'the DEPLOYED staging service (accounts, sessions, issue / read / confirm / grade, History, deletion)',
      'the real handwriting reader (the provider staging is configured with)', 'email: a sign-in and a deletion code sent by staging\'s real email provider to the owner\'s test inbox'],
    synthetic: ['an iOS simulator, not a device', 'strokes placed on the surface programmatically, not written with a Pencil or finger',
      'the final answer: the reading is confirmed as read, or a fixed answer is typed when the reading proposes none'],
    notEvidenceFor: ['a physical iPhone, iPad or Apple Pencil', 'reading accuracy (the strokes are synthetic)', 'that any answer is right (staging has no answer oracle)',
      'production', 'VoiceOver or any assistive technology'],
    origin,
    backend,
    sha,
    dirtyWorkingTree: dirty,
    simulator: { name: sim.name || null, udid: sim.udid || null },
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    timestamp: now(),
    steps,
    result: notMeasured ? 'NOT MEASURED' : (total && passed === total ? 'PASS' : 'FAIL'),
    ...(notMeasured ? { notMeasured } : {})
  };
}

/** One quick look for a code in a child process (the journey's wait loop is synchronous). */
function codeFor(to, purpose, since) {
  try {
    const out = execFileSync(process.execPath, [join(HERE, 'staging-inbox-code.mjs'), to, inboxPurpose(purpose), String(since), '4000'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 });
    const reply = JSON.parse(out.trim().split('\n').at(-1) || '{}');
    return /^\d{6}$/.test(reply.code || '') ? reply.code : null;
  } catch { return null; }
}

/**
 * The staging leg. `launchAndRead` and `run` are iphone-journey.mjs's own, so
 * a staging run launches, relays and reads exactly as every other leg does.
 */
export async function runStagingLeg({ sim, udid, bundleId, launchAndRead, run, origin = STAGING_ORIGIN, out = null, runTag = Date.now().toString(36) }) {
  const write = evidence => { if (out) writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`); return evidence; };
  let sha = '', dirty = null;
  try { sha = run('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).trim(); } catch { /* not a checkout */ }
  try { dirty = run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).trim().length > 0; } catch { /* not a checkout */ }
  const originProblem = stagingOriginProblem(origin);
  if (originProblem) { console.log(`STAGING JOURNEY — REFUSED: ${originProblem}`); return 1; }
  const opened = await openInbox();
  if (!opened.ok) {
    write(stagingEvidence({ sim, origin, sha, dirty, notMeasured: opened.reason }));
    console.log(`\nSTAGING JOURNEY: NOT MEASURED — ${opened.reason}. Nothing was run against staging.`);
    return 2;
  }
  const { backendEvidence } = await import(pathToFileURL(join(HERE, 'check-native-archive.mjs')).href);
  const backend = await backendEvidence(origin);
  const refused = stagingBackendProblem(backend);
  if (refused) { write(stagingEvidence({ sim, origin, backend, sha, dirty, notMeasured: refused })); console.log(`STAGING JOURNEY — REFUSED: ${refused}`); return 1; }
  console.log(`\nStaging leg · ${origin} (${backend.cname.join(' → ') || 'no CNAME'}) · server ${backend.health?.releaseSha?.slice(0, 12) || '?'} on ${backend.health?.databaseEngine || '?'} · ${TIER}`);
  const address = opened.inbox.tagAddress(opened.config.PRI_STAGING_INBOX_ADDRESS, `ios-${runTag}`, 1);
  const shown = opened.inbox.redactAddress ? opened.inbox.redactAddress(address, opened.config.PRI_STAGING_INBOX_ADDRESS) : '(test inbox)';
  const since = Date.now();
  const oracleDir = mkdtempSync(join(tmpdir(), 'pri-staging-oracle-'));
  const answered = new Set();
  const tick = () => {
    for (const name of readdirSync(oracleDir)) {
      const n = name.match(/^ask-(\d+)\.json$/)?.[1];
      if (!n || answered.has(n)) continue;
      let ask = null;
      try { ask = JSON.parse(readFileSync(join(oracleDir, name), 'utf8')); } catch { continue; }
      if (ask.kind === 'emailCode') {
        if (ask.to !== address) { writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), code: null, reason: 'not this run\'s address' })); answered.add(n); continue; }
        const code = codeFor(address, ask.purpose, since);
        if (!code) continue;   // ask again on the next tick
        writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), code }));
        answered.add(n);
        continue;
      }
      writeFileSync(join(oracleDir, `reply-${n}.json`), JSON.stringify({ n: Number(n), supported: false, reason: 'staging has no answer oracle' }));
      answered.add(n);
    }
  };
  console.log(`  test account ${shown}`);
  const lines = launchAndRead(udid, bundleId, '--journey-staging', 'staging',
    { PRI_CLOUD_ORIGIN: origin, PRI_JOURNEY_EMAIL: address, PRI_JOURNEY_ORACLE_DIR: oracleDir }, { tick, loops: 200 });
  for (const line of lines) console.log(`  ${line.replace(/^PRIJOURNEY\s*/, '')}`);
  const steps = Object.fromEntries(STAGING_STEPS.map(name => {
    const hit = lines.find(l => new RegExp(`^PRIJOURNEY (ok|FAIL) ${name}( |$)`).test(l));
    return [name, hit ? { ok: hit.startsWith('PRIJOURNEY ok'), detail: hit.replace(/^PRIJOURNEY (ok|FAIL) \S+ ?/, '') } : { ok: false, detail: 'not reported' }];
  }));
  const evidence = write(stagingEvidence({ sim, steps, origin, backend, sha, dirty }));
  const passed = Object.values(steps).filter(s => s.ok).length;
  console.log(evidence.result === 'PASS'
    ? `\nSTAGING JOURNEY: PASS — ${passed}/${STAGING_STEPS.length} steps on ${sim.name} (${TIER})`
    : `\nSTAGING JOURNEY: FAIL — ${passed}/${STAGING_STEPS.length} steps on ${sim.name} (${TIER})${Object.entries(steps).filter(([, s]) => !s.ok).map(([n, s]) => `\n  ✗ ${n}: ${s.detail}`).join('')}`);
  return evidence.result === 'PASS' ? 0 : 1;
}
