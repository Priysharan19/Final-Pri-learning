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
  FAMILIES, INSTALL_ATTEMPTS, INSTALL_TIMEOUT_MS, bootFamily, describeRuntimes, installApp, keepOnlySimulator, otherBooted, parseDevices, pickSimulator,
  requiredRuntime, runtimeMatches,
} from '../../scripts/simulator-fleet.mjs';
import { EXPECTED_CASES, MAX_DEVIATION_PX, judge } from '../../scripts/ink-native-check.mjs';
import { judgeContentEnd } from '../../scripts/native-bridge-selfcheck.mjs';

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

// ── which simulator a harness runs on: booted first, else the newest runtime ──
// `simctl list` prints runtimes oldest first; taking the first iPad row ran the
// App Health native self-check on the runner's oldest iOS runtime, where it
// never reported (run 39227834970).
{
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
  const multi = `== Devices ==
-- iOS 18.0 --
    iPad Pro 11-inch (M4) (${A}) (Shutdown)
-- iOS 18.6 --
    iPad Pro 11-inch (M4) (${B}) (Shutdown)
-- iOS 26.1 --
    iPad Pro 11-inch (M4) (${C}) (Shutdown)
    iPhone 17 (44444444-4444-4444-8444-444444444444) (Shutdown)
`;
  ok(pickSimulator(multi)?.udid === C, 'with nothing booted the iPad on the newest runtime is picked, not the first listed');
  ok(pickSimulator(multi, { named: 'iPad Pro 11-inch (M4)' })?.udid === C, 'a named device resolves to its newest runtime');
  ok(pickSimulator(multi.replace(`${B}) (Shutdown)`, `${B}) (Booted)`))?.udid === B, 'an already booted match wins over a newer runtime');
  ok(pickSimulator(multi.replace('-- iOS 18.6 --', '-- iOS 18.10 --'))?.udid === C && pickSimulator(multi.replace('-- iOS 26.1 --', '-- iOS 18.10 --'))?.udid === C,
    'runtime versions compare numerically (18.10 > 18.6)');
  ok(pickSimulator(multi, { family: 'iPhone' })?.name === 'iPhone 17', 'the family filter applies');
  ok(pickSimulator(multi, { named: 'iPad Air' }) === null && pickSimulator('') === null, 'no match is null, not a guess');
  ok(pickSimulator(LISTING)?.udid === IPAD, 'the fixture listing picks its booted iPad');
}

// ── the runtime is NAMED: a pin, never "the newest installed" ────────────────
// #676: the iOS 27 regression went unseen because every harness took the
// newest runtime on the image. A pinned lane cannot be moved to another iOS by
// a runner-image change; it fails by name instead.
{
  const A = 'AAAAAAAA-1111-4111-8111-111111111111', B = 'BBBBBBBB-2222-4222-8222-222222222222', C = 'CCCCCCCC-3333-4333-8333-333333333333';
  const image = `== Devices ==
-- iOS 26.5 --
    iPad (A16) (${A}) (Shutdown)
    iPhone 17 (${'44444444-4444-4444-8444-444444444444'}) (Shutdown)
-- iOS 27.0 --
    iPad (A16) (${B}) (Shutdown)
-- iOS 27.1 --
    iPad (A16) (${C}) (Shutdown)
`;
  ok(runtimeMatches('iOS 27.0', '27') && runtimeMatches('iOS 27.0', '27.0') && !runtimeMatches('iOS 27.0', '27.1') && !runtimeMatches('iOS 26.5', '27') && runtimeMatches('iOS 26.5', null),
    'a pin matches by the components it names (27 matches 27.0 and 27.1; 27.0 matches 27.0 only; no pin matches everything)');
  ok(pickSimulator(image, { runtime: '27.0' })?.udid === B, 'pinned to 27.0 the lane runs on the 27.0 device, not the newer 27.1 one');
  ok(pickSimulator(image, { runtime: '26.5' })?.udid === A, 'pinned to 26.5 the lane runs on 26.5 although 27.x is installed');
  ok(pickSimulator(image, { runtime: '27' })?.udid === C, 'a major-only pin takes the newest runtime of that major');
  ok(pickSimulator(image, { runtime: '28' }) === null && pickSimulator(image, { runtime: '27.2' }) === null, 'a pin the image does not carry is null, never a run on another iOS');
  ok(pickSimulator(image, { family: 'iPhone', runtime: '27.0' }) === null, 'the pin applies per family (no iPhone on 27.0 here)');
  // Mutation: without the pin, adding a newer runtime to the image silently moves the lane.
  ok(pickSimulator(image)?.udid === C && pickSimulator(image.replace('-- iOS 27.1 --', '-- iOS 28.0 --'))?.udid === C,
    'unpinned, a runner-image update moves the gate to whatever is newest');
  ok(pickSimulator(image.replace('-- iOS 27.1 --', '-- iOS 28.0 --'), { runtime: '27.0' })?.udid === B, 'pinned, the same image update changes nothing');
  ok(describeRuntimes(image) === 'iOS 26.5, iOS 27.0, iOS 27.1', 'the installed runtimes are named for the failure message');
  ok(requiredRuntime({ argv: ['node', 'x', '--runtime', '27.0'], env: {} }) === '27.0', '--runtime names the pin');
  ok(requiredRuntime({ argv: [], env: { PRI_SIM_RUNTIME: 'iOS 26.5' } }) === '26.5', 'PRI_SIM_RUNTIME names the pin (an iOS prefix is tolerated)');
  ok(requiredRuntime({ argv: [], env: {} }) === null, 'off CI a pin is optional');
  ok(throwsWith(() => requiredRuntime({ argv: [], env: { CI: 'true' } }), /CI must name the iOS simulator runtime/), 'on CI a lane with no pin refuses to run');
  ok(throwsWith(() => requiredRuntime({ argv: ['node', 'x', '--runtime', 'latest'], env: {} }), /must look like 27 or 27\.0/), '"latest" is not a pin');
}

// ── Gate A judges capture fidelity, not a reader ─────────────────────────────
{
  const fidelity = (over = {}) => {
    const f = { passed: 10, cases: 10, pct: '100.0', back: 231, sent: 231, dev: '0.74', floor: MAX_DEVIATION_PX.toFixed(1), fields: 'ok', ...over };
    return `PRIINK ── capture fidelity: ${f.passed}/${f.cases} cases · strokes ${f.pct}% (${f.back}/${f.sent}) · max deviation ${f.dev} px (floor ${f.floor}) · fields ${f.fields} ──`;
  };
  const bridge = (over = {}) => {
    const b = { mounted: 'yes', positioned: 'yes', sent: 4, back: 4, placement: 'ok', ...over };
    return `PRIINK bridge mounted=${b.mounted} positioned=${b.positioned} strokesSent=${b.sent} strokesBack=${b.back} placement=${b.placement}`;
  };
  const restore = (over = {}) => {
    const r = { passed: 10, cases: 10, cycles: 5, identical: 'yes', fresh: 'reencoded', altered: 'reencoded', ...over };
    return `PRIINK restore identity: ${r.passed}/${r.cases} cases · cycles=${r.cycles} identical=${r.identical} new=${r.fresh} altered=${r.altered}`;
  };
  // Restore identity: a draft restored on relaunch must not drift.
  ok(judge([fidelity(), bridge()]).problems.some(p => /did not report restore identity/.test(p)), 'a run without the restore-identity line fails');
  ok(judge([restore({ identical: 'NO' }), fidelity(), bridge()]).problems.some(p => /draft drift/.test(p)), 'a restored stroke that moved fails (draft drift)');
  ok(judge([restore({ passed: 9 }), fidelity(), bridge()]).problems.some(p => /restore identity 9\/10/.test(p)), 'one case that does not restore exactly fails');
  ok(judge([restore({ cycles: 1 }), fidelity(), bridge()]).problems.some(p => /ran 1 cycles/.test(p)), 'fewer than five restore cycles fails');
  ok(judge([restore({ fresh: 'BAD' }), fidelity(), bridge()]).problems.some(p => /new stroke after a restore/.test(p)), 'a new stroke not read from the canvas fails');
  ok(judge([restore({ altered: 'BAD' }), fidelity(), bridge()]).problems.some(p => /stale original/.test(p)), 'a changed stroke replaced by its stale original fails');
  ok(EXPECTED_CASES === 10 && MAX_DEVIATION_PX === 2.0, 'the gate holds ten cases to a 2.0 px deviation floor');
  ok(judge([restore(), fidelity(), bridge()]).problems.length === 0, 'a clean run passes');
  ok(judge([restore(), fidelity({ passed: 9 })]).problems.some(p => /capture fidelity 9\/10/.test(p)), 'one failing case fails the gate');
  ok(judge([restore(), fidelity({ back: 230, pct: '99.6' }), bridge()]).problems.some(p => /every stroke must come back/.test(p)), 'one dropped stroke in 231 fails the gate');
  ok(judge([restore(), fidelity({ dev: '2.01' }), bridge()]).problems.some(p => /2\.01 px is above the 2 px floor/.test(p)), 'a point moved past the floor fails the gate');
  ok(judge([restore(), fidelity({ dev: '2.00' }), bridge()]).problems.length === 0, 'exactly the floor passes');
  ok(judge([restore(), fidelity({ dev: 'inf' }), bridge()]).problems.some(p => /above the 2 px floor/.test(p)), 'an unmeasurable deviation fails');
  ok(judge([restore(), fidelity({ fields: 'BAD' }), bridge()]).problems.some(p => /Pencil field/.test(p)), 'a lost Pencil field fails the gate');
  ok(judge([restore(), fidelity({ floor: '3.0' }), bridge()]).problems.some(p => /different deviation floor/.test(p)), 'the Swift floor and this gate must agree');
  ok(judge([restore(), fidelity({ cases: 9, passed: 9 }), bridge()]).problems.some(p => /ran 9 cases; expected 10/.test(p)), 'fewer cases than the protocol fails');
  ok(judge([restore(), fidelity(), bridge({ positioned: 'NO' })]).problems.some(p => /mispositioned/.test(p)), 'a mispositioned surface fails');
  ok(judge([restore(), fidelity(), bridge({ back: 3 })]).problems.some(p => /did not survive the bridge round trip \(3\/4\)/.test(p)), 'a stroke lost on the live bridge fails');
  ok(judge([restore(), fidelity(), bridge({ placement: 'BAD' })]).problems.some(p => /placement maths/.test(p)), 'wrong placement at page scale 1.5 fails');
  ok(judge([restore(), fidelity()]).problems.some(p => /bridge smoke test did not report/.test(p)) && judge([bridge()]).problems.some(p => /did not report a capture-fidelity score/.test(p)), 'a missing half fails');
  ok(judge(['PRIINK ── 10/10 exact · character accuracy 100.0% ──', 'PRIINK bridge mounted=yes positioned=yes strokesBack=4 readShape=ok']).problems.length >= 2,
    'the retired reader benchmark lines no longer satisfy the gate');
}

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

// ── The page's WebContent process ends (native-bridge-selfcheck.mjs) ──
// The leg kills the app's real WebContent process with ink on the native
// surface; the verdict is judged here on recorded lines, both ways.
{
  const L = s => `PRIBRIDGE ${s}`;
  const clean = [L('ok inkMountedBeforeContentEnd'), L('contentProcessEnded n=1 action=reload inkMounted=false'),
    L('ok pageAliveAfterContentEnd (load 1)'), L('ok bridgeAfterContentEnd (load 1)'), L('ok inkDroppedAfterContentEnd (load 1)'),
    L('ok recoveryPolicy (load 1)'), L('recovery 1 summary 0 failure(s)'),
    L('contentProcessEnded n=2 action=reload inkMounted=false'), L('contentProcessEnded n=3 action=stopped inkMounted=false'), L('contentStopped shown')];
  const without = (re) => clean.filter(l => !re.test(l));
  const swap = (a, b) => clean.map(l => l.replace(a, b));
  ok(judgeContentEnd(clean).ok, 'content end: a reload that drops the ink and stops at the third end passes');
  // Recorded on an iOS 27 simulator with the handler removed: WebKit reloaded
  // on its own, the ink surface stayed up, and the shell heard nothing.
  ok(!judgeContentEnd([L('ok inkMountedBeforeContentEnd'), L('ok pageAliveAfterContentEnd (load 1)'), L('ok bridgeAfterContentEnd (load 1)'),
    L('FAIL inkDroppedAfterContentEnd (load 1)'), L('ok recoveryPolicy (load 1)'), L('recovery 1 summary 1 failure(s)')]).ok,
    'content end: the pre-fix run (WebKit reload, ink left mounted) fails');
  ok(!judgeContentEnd(swap('n=1 action=reload inkMounted=false', 'n=1 action=reload inkMounted=true')).ok, 'content end: ink still mounted when the process ended fails');
  ok(!judgeContentEnd(without(/stopped|shown/).concat([L('contentProcessEnded n=3 action=reload inkMounted=false')])).ok, 'content end: a reload loop that never stops fails');
  ok(!judgeContentEnd(swap('n=2 action=reload', 'n=2 action=stopped').filter(l => !/n=3/.test(l))).ok, 'content end: stopping at the second end fails');
  ok(!judgeContentEnd(without(/shown/)).ok, 'content end: no native stopped screen fails');
  ok(!judgeContentEnd(swap('ok bridgeAfterContentEnd', 'FAIL bridgeAfterContentEnd')).ok, 'content end: a bridge that does not answer after the reload fails');
  ok(!judgeContentEnd([]).ok, 'content end: a run that never reached the leg fails');
}

console.log(failures.length
  ? `SIMULATOR FLEET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `SIMULATOR FLEET: PASS — ${pass}/${pass} checks — CI keeps one booted simulator, installs are bounded (${INSTALL_TIMEOUT_MS / 1000} s × ${INSTALL_ATTEMPTS}), the lane builds once.`);
process.exit(failures.length ? 1 : 0);
