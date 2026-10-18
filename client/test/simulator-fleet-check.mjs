// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one booted simulator per CI runner, one Swift build per job.
//
// Since #523 both the iPhone and the iPad simulators stayed booted for the
// whole Native Ink job, and the journey's own mitigation never fired because
// it only shut the other family down when it had to boot its own. The
// decisions now live in scripts/simulator-fleet.mjs, which this check drives
// with fixture `simctl` output and a fake exec — no Mac needed — and it pins
// the lane contract: every harness script keeps one simulator, every install
// is bounded, the workflow builds the app once and boots only the iPad first.
// Run on its own:  node client/test/simulator-fleet-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import {
  FAMILIES, INSTALL_ATTEMPTS, INSTALL_TIMEOUT_MS, bootFamily, installApp, keepOnlySimulator, otherBooted, parseDevices,
} from '../../scripts/simulator-fleet.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e?.message || e)); } };

const IPHONE = 'DAE21AF9-5E95-4DC4-B291-48516B01F119';
const IPAD = '0E715DE2-5385-4E6F-91C4-54FC32F51FFD';
const BOOTING = '8427636B-F8C7-4B15-BD44-C048BF6D550D';
const OLD = '2F983163-13D4-4DCB-9A36-F1370697B7EE';
const LISTING = `== Devices ==
-- iOS 26.0 --
    Pri CI iPhone 16 (04DC0BC4-CC4B-42F6-BDEE-B4D997F661DD) (Shutdown)
    Pri Learning Agent3 QA 20261009 (${OLD}) (Shutdown) (unavailable, runtime profile not found)
-- iOS 27.0 --
    iPhone 17 Pro (${IPHONE}) (Booted)
    iPad Pro 13-inch (M5) (${IPAD}) (Booted)
    Pri 528 iPad (1E63B5AF-4D96-43B6-87A3-77B4C133D915) (Shutdown)
    Pri Agent2 C5 Background (${BOOTING}) (Booting)
-- Unavailable: com.apple.CoreSimulator.SimRuntime.iOS-17-5 --
    iPad (10th generation) (6A8D1C2E-1111-4222-8333-944455556666) (Shutdown) (unavailable, runtime profile not found)
`;

// ── parsing `simctl list devices` ────────────────────────────────────────────
const rows = parseDevices(LISTING);
ok(rows.length === 7, `every device row is parsed, headers are not (${rows.length} rows)`);
ok(rows.find(r => r.udid === IPAD)?.name === 'iPad Pro 13-inch (M5)' && rows.find(r => r.udid === IPAD)?.runtime === 'iOS 27.0',
  'a name with parentheses keeps its name and runtime');
ok(rows.find(r => r.udid === OLD)?.state === 'Shutdown', 'an unavailable device still reports its state');
ok(rows.find(r => r.udid === BOOTING)?.state === 'Booting', 'a device still booting is seen as booting');
ok(parseDevices('').length === 0 && parseDevices(null).length === 0, 'empty output parses to no devices');

// ── which simulators are in the way ──────────────────────────────────────────
ok(JSON.stringify(otherBooted(LISTING, IPHONE)) === JSON.stringify([IPAD, BOOTING]),
  'from the iPhone, the booted iPad and the booting device are the others; shutdown devices are not');
ok(JSON.stringify(otherBooted(LISTING, IPAD)) === JSON.stringify([IPHONE, BOOTING]), 'from the iPad, the iPhone is the other');
ok(JSON.stringify(otherBooted(LISTING, IPAD.toLowerCase())) === JSON.stringify([IPHONE, BOOTING]), 'the target UDID is matched case-insensitively');
ok(JSON.stringify(otherBooted(LISTING, 'NOT-A-DEVICE')) === JSON.stringify([IPHONE, IPAD, BOOTING]), 'with an unknown target every booted device is another');

// ── keepOnlySimulator: CI shuts the others down, a person's Mac is untouched ──
{
  const calls = [];
  const exec = args => { calls.push(args); return args[0] === 'list' ? LISTING : ''; };
  const quiet = () => {};
  ok(JSON.stringify(keepOnlySimulator(IPHONE, { ci: false, exec, log: quiet })) === '[]' && calls.length === 0,
    'off CI nothing is listed and nothing is shut down');
  const down = keepOnlySimulator(IPHONE, { ci: true, exec, log: quiet });
  ok(JSON.stringify(down) === JSON.stringify([IPAD, BOOTING]), 'on CI the other booted simulators are shut down and reported');
  ok(JSON.stringify(calls) === JSON.stringify([['list', 'devices'], ['shutdown', IPAD], ['shutdown', BOOTING]]),
    `the shutdowns name exactly the other devices, never the target: ${JSON.stringify(calls)}`);
  ok(JSON.stringify(keepOnlySimulator(IPHONE, { ci: true, exec: args => (args[0] === 'list' ? LISTING.replace(`(${IPAD}) (Booted)`, `(${IPAD}) (Shutdown)`).replace('(Booting)', '(Shutdown)') : ''), log: quiet })) === '[]',
    'with the target alone booted there is nothing to shut down');
  const logged = [];
  const flaky = args => { if (args[0] === 'shutdown') throw new Error('Unable to shutdown device in current state: Shutdown'); return LISTING; };
  ok(JSON.stringify(keepOnlySimulator(IPHONE, { ci: true, exec: flaky, log: m => logged.push(m) })) === JSON.stringify([IPAD, BOOTING]),
    'a device that is already down by the time it is asked does not fail the step');
  ok(logged.length === 2 && logged.every(m => /CI keeps one simulator booted/.test(m)), 'each shutdown says why');
}

// ── --boot names at most one family ──────────────────────────────────────────
ok(JSON.stringify(FAMILIES) === '["iPhone","iPad"]', 'the lane provisions iPhone and iPad');
ok(bootFamily([]) === null && bootFamily(['--create']) === null, 'without --boot nothing is booted (create only)');
ok(bootFamily(['--boot', 'ipad']) === 'iPad' && bootFamily(['--create', '--boot', 'iPhone']) === 'iPhone', '--boot picks one family, case-insensitively');
ok(throwsWith(() => bootFamily(['--boot', 'ipad', '--boot', 'iphone']), /one family/), 'booting both families is refused');
ok(throwsWith(() => bootFamily(['--boot', 'mac']), /iPhone or iPad/), 'an unknown family is refused');
ok(throwsWith(() => bootFamily(['--boot']), /iPhone or iPad/), 'a bare --boot is refused');

// ── bounded install with one retry and an infrastructure fingerprint ─────────
const timeout = () => Object.assign(new Error('spawnSync xcrun ETIMEDOUT'), { code: 'ETIMEDOUT', signal: 'SIGKILL', status: null });
const broken = () => Object.assign(new Error('Command failed'), { status: 1, stderr: 'An error was encountered processing the command (domain=IXUserPresentableErrorDomain, code=1):\nFailed to install the requested application\n' });
ok(INSTALL_TIMEOUT_MS === 180_000 && INSTALL_ATTEMPTS === 2, 'the install bound is 180 s per attempt, two attempts (new bounds, not raised budgets)');
{
  const calls = [];
  const good = (args, opts) => { calls.push([args, opts]); return ''; };
  const r = installApp(IPAD, '/tmp/dd/Pri Learning.app', { exec: good, log: () => {} });
  ok(r.attempt === 1 && calls.length === 1, 'a healthy install is one attempt');
  ok(calls[0][0][0] === 'install' && calls[0][0][1] === IPAD && calls[0][0][2] === '/tmp/dd/Pri Learning.app', 'the install names the device and the app');
  ok(calls[0][1].timeout === INSTALL_TIMEOUT_MS && calls[0][1].killSignal === 'SIGKILL', 'every attempt is bounded and killed hard when it stalls');
}
{
  let n = 0; const logged = [];
  const r = installApp(IPAD, '/tmp/dd/Pri Learning.app', { exec: () => { if (++n === 1) throw timeout(); return ''; }, log: m => logged.push(m) });
  ok(r.attempt === 2 && n === 2, 'a stalled first attempt is retried once');
  ok(logged.length === 1 && /attempt 1 of 2 did not finish in 180 s; retrying/.test(logged[0]), `the retry is announced with the bound: ${logged[0]}`);
}
{
  let n = 0; let error = null;
  try { installApp(IPAD, '/tmp/dd/Pri Learning.app', { exec: () => { n++; throw timeout(); }, log: () => {} }); } catch (e) { error = e; }
  ok(n === 2 && error, 'two stalled attempts stop — the job is not consumed');
  ok(error && /^INFRASTRUCTURE: simctl install of Pri Learning\.app on 0E715DE2/.test(error.message) && error.infrastructure === true,
    `a stall is labelled an infrastructure failure, naming the app and device: ${error?.message}`);
  ok(error && /did not finish in 180 s on 2 attempt\(s\)/.test(error.message) && /not a product failure/.test(error.message),
    'the label carries the bound and says it is not a product failure');
}
{
  let n = 0; let error = null;
  try { installApp(IPAD, '/tmp/dd/Pri Learning.app', { exec: () => { n++; throw broken(); }, log: () => {} }); } catch (e) { error = e; }
  ok(n === 2 && error && !/^INFRASTRUCTURE/.test(error.message) && error.infrastructure === false,
    'a real install error is retried once but never relabelled as infrastructure');
  ok(error && /Failed to install the requested application|IXUserPresentableErrorDomain/.test(error.message), `the real error text is kept: ${error?.message}`);
}
{
  let n = 0;
  try { installApp(IPAD, '/x.app', { exec: () => { n++; throw timeout(); }, log: () => {}, attempts: 1 }); } catch { /* expected */ }
  ok(n === 1, 'attempts is honoured');
}

// ── the harness scripts and the lane follow the rule ─────────────────────────
const src = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
for (const script of ['scripts/iphone-journey.mjs', 'scripts/native-bridge-selfcheck.mjs', 'scripts/ink-native-check.mjs']) {
  const text = src(script);
  const fn = text.slice(text.indexOf('function ensureBooted'), text.indexOf('\n}\n', text.indexOf('function ensureBooted')));
  ok(fn.indexOf('keepOnlySimulator(') > 0 && fn.indexOf('keepOnlySimulator(') < fn.indexOf('if (booted()) return'),
    `${script}: ensureBooted shuts the other family down BEFORE deciding its own target is already booted`);
  ok(!/\['simctl',\s*'shutdown'/.test(text), `${script}: no inline shutdown loop remains beside the shared rule`);
  ok(!/\['simctl',\s*'install'/.test(text) && /installApp\(/.test(text), `${script}: every simctl install goes through the bounded installApp`);
}
{
  const prov = src('scripts/ci-provision-simulators.mjs');
  ok(/bootFamily\(process\.argv\)/.test(prov) && /keepOnlySimulator\(/.test(prov), 'the provisioning script boots at most one family and clears the others first');
  ok(!/for \(const d of chosen\)[\s\S]*simctl\('boot'/.test(prov), 'the provisioning script no longer boots every chosen device');
}
{
  const wf = src('.github/workflows/native-ink.yml');
  const at = s => { const i = wf.indexOf(s); return i < 0 ? Infinity : i; };
  ok(/ci-provision-simulators\.mjs --boot ipad/.test(wf), 'the lane provisions both families and boots only the iPad the first simulator steps use');
  ok(at('xcodebuild -scheme PriLearning') < at('node scripts/ink-native-check.mjs'), 'the one Swift build runs before the native self-check');
  ok(at('xcodebuild -scheme PriLearning') < at('node scripts/native-bridge-selfcheck.mjs --family ipad'), 'and before the first bridge self-check');
  ok(/scripts\/ink-native-check\.mjs --app "\$PRI_SIM_APP"/.test(wf), 'the native self-check installs the already built app instead of building a second time');
  ok(/native-bridge-selfcheck\.mjs --family ipad --app "\$PRI_SIM_APP"/.test(wf) && /native-bridge-selfcheck\.mjs --family iphone --app "\$PRI_SIM_APP"/.test(wf),
    'both bridge self-checks reuse the built app');
  ok((wf.match(/xcodebuild -scheme PriLearning/g) || []).length === 1, 'the workflow contains exactly one xcodebuild of the package');
  ok(/'scripts\/simulator-fleet\.mjs'/.test(wf), 'the shared simulator rule is in the lane\'s path filter');
}

console.log(failures.length
  ? `SIMULATOR FLEET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `SIMULATOR FLEET: PASS — ${pass}/${pass} checks — CI keeps one booted simulator, installs are bounded (${INSTALL_TIMEOUT_MS / 1000} s × ${INSTALL_ATTEMPTS}), the lane builds once.`);
process.exit(failures.length ? 1 : 0);
