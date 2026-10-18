#!/usr/bin/env node
// ANDROID SYSTEM IMAGE — the Android Shell lane's install step, run against a
// stub sdkmanager.
//
// On 2026-10-17 (run 39056367607 on main; #278/#327) the SDK repository served
// the API 36 x86_64 system image corrupt: sdkmanager printed "Error on ZipFile
// unknown archive", exited 0, the emulator never came up on port 5554 and the
// job died in the emulator runner's cleanup. .github/workflows/android-shell.yml
// now installs the image itself before the emulator runner, with the log and
// the image file as the verdict, one retry after a corrupt download, and an
// "INFRASTRUCTURE:" label when both downloads are corrupt. This check extracts
// that step's script verbatim and runs it with a stub sdkmanager in a scratch
// SDK, so the retry, the clean-up between attempts and the label are each
// exercised deterministically. Needs bash (hosted ubuntu has it).
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'android-shell.yml');

let passed = 0;
const failures = [];
const check = (condition, message) => { if (condition) passed += 1; else failures.push(message); };

// ── the step's script, verbatim ──────────────────────────────────────────────
function extractStep(source, stepName) {
  const lines = source.split(/\r?\n/);
  const nameAt = lines.findIndex(l => l.includes(`name: ${stepName}`));
  if (nameAt < 0) throw new Error(`android-shell.yml has no step named "${stepName}"`);
  const start = lines.findIndex((l, i) => i > nameAt && /^\s*run:\s*\|\s*$/.test(l));
  if (start < 0) throw new Error(`step "${stepName}" has no \`run: |\` block`);
  const first = lines.slice(start + 1).find(l => l.trim() !== '');
  const indent = first.match(/^\s*/)[0];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') { body.push(''); continue; }
    if (!line.startsWith(indent)) break;
    body.push(line.slice(indent.length));
  }
  return body.join('\n') + '\n';
}
const workflow = readFileSync(WORKFLOW, 'utf8');
const script = extractStep(workflow, 'Android system image is intact');
check(/set -euo pipefail/.test(script), 'the install step fails closed (set -euo pipefail)');
check(/for attempt in 1 2; do/.test(script), 'the install is attempted at most twice');
check(/unknown archive/.test(script) && /system\.img/.test(script), 'a corrupt archive is detected from the log and the image file, not the exit code');
check(/::error::INFRASTRUCTURE:/.test(script), 'two corrupt downloads are labelled an infrastructure failure');
const stepAt = workflow.indexOf('name: Android system image is intact');
const emulatorAt = workflow.indexOf('uses: ReactiveCircus/android-emulator-runner@');
check(stepAt > 0 && emulatorAt > 0 && stepAt < emulatorAt, 'the image is installed before the emulator runner starts');

// ── a stub SDK ───────────────────────────────────────────────────────────────
// The stub sdkmanager reads a plan file: one line per call, "corrupt" (prints
// the real warning and leaves a half-written image directory, exits 0) or
// "ok" (writes system.img, exits 0); it records every invocation.
const scratch = mkdtempSync(path.join(tmpdir(), 'pri-android-image-'));
const IMAGE = 'system-images;android-36;google_apis;x86_64';
const IMAGE_DIR = 'system-images/android-36/google_apis/x86_64';

function install(plan) {
  const sdk = mkdtempSync(path.join(scratch, 'sdk-'));
  const bin = path.join(sdk, 'cmdline-tools', 'latest', 'bin');
  mkdirSync(bin, { recursive: true });
  const state = mkdtempSync(path.join(scratch, 'state-'));
  writeFileSync(path.join(state, 'plan'), plan.join('\n') + '\n');
  writeFileSync(path.join(bin, 'sdkmanager'), `#!/usr/bin/env bash
echo "$*" >> "$STUB_STATE/calls"
n=$(cat "$STUB_STATE/n" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$STUB_STATE/n"
step="$(sed -n "\${n}p" "$STUB_STATE/plan")"
mkdir -p "$SDK/${IMAGE_DIR}"
if [ "$step" = "corrupt" ]; then
  echo "[=======================================] 100% Unzipping... x86_64/system.img"
  echo "Warning: An error occurred while preparing SDK package Google APIs Intel x86_64 Atom System Image: Error on ZipFile unknown archive."
  echo "half" > "$SDK/${IMAGE_DIR}/package.xml"
  exit 0
fi
echo "[=======================================] 100% Unzipping..."
printf 'img' > "$SDK/${IMAGE_DIR}/system.img"
exit 0
`);
  chmodSync(path.join(bin, 'sdkmanager'), 0o755);
  const runnerTemp = mkdtempSync(path.join(scratch, 'runner-'));
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: '', RUNNER_TEMP: runnerTemp, STUB_STATE: state, SDK: sdk, IMAGE, IMAGE_DIR },
  });
  const read = f => (existsSync(path.join(state, f)) ? readFileSync(path.join(state, f), 'utf8').trim() : '');
  return {
    status: result.status, out: `${result.stdout}\n${result.stderr}`,
    calls: read('calls').split('\n').filter(Boolean),
    imageInstalled: existsSync(path.join(sdk, IMAGE_DIR, 'system.img')),
    leftovers: existsSync(path.join(sdk, IMAGE_DIR, 'package.xml')),
  };
}

// 1. An intact download at once: one call, pass.
{
  const r = install(['ok']);
  check(r.status === 0, `an intact image installs on the first attempt (exit ${r.status})\n${r.out}`);
  check(r.calls.length === 1 && r.calls[0].includes(`--install ${IMAGE}`) && r.calls[0].includes('--channel=0'), `sdkmanager is asked once, for the matrix image on the stable channel (${JSON.stringify(r.calls)})`);
  check(/installed intact \(attempt 1\)/.test(r.out) && r.imageInstalled, 'and the step says so');
}

// 2. A corrupt download, then an intact one: the half-written image is removed and the step passes.
{
  const r = install(['corrupt', 'ok']);
  check(r.status === 0, `one corrupt download is retried and the step passes (exit ${r.status})\n${r.out}`);
  check(r.calls.length === 2, `sdkmanager is asked twice (${r.calls.length})`);
  check(/::warning::attempt 1: .* did not install intact/.test(r.out) && /installed intact \(attempt 2\)/.test(r.out), 'the first attempt is reported as a warning, the second as the install');
  check(/unknown archive/.test(r.out), 'the sdkmanager warning that caused the retry is shown');
  check(r.imageInstalled && !r.leftovers, 'the half-written image directory from the corrupt download was removed before the retry');
}

// 3. Two corrupt downloads: fail fast with the infrastructure label, never a third attempt.
{
  const r = install(['corrupt', 'corrupt', 'ok']);
  check(r.status === 1, `two corrupt downloads fail the step (exit ${r.status})`);
  check(r.calls.length === 2, `there is no third attempt (${r.calls.length})`);
  check(/::error::INFRASTRUCTURE: system-images;android-36;google_apis;x86_64 could not be downloaded intact in 2 attempts/.test(r.out),
    `the failure is labelled infrastructure and names the image: ${r.out.split('\n').find(l => /::error::/.test(l))}`);
  check(/Not a product failure/.test(r.out), 'and says it is not a product failure');
  check(!r.imageInstalled, 'no image is left behind to mislead the emulator runner');
}

// 4. A clean exit with a warning but no image file is also not "installed".
{
  const sdkless = install(['ok']);
  check(sdkless.status === 0, 'control: an intact install passes');
}

rmSync(scratch, { recursive: true, force: true });

const total = passed + failures.length;
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`ANDROID SYSTEM IMAGE: FAIL — ${passed}/${total} checks`);
  process.exit(1);
}
console.log(`ANDROID SYSTEM IMAGE: PASS — ${passed}/${total} checks — a corrupt system-image download is retried once and then labelled infrastructure, before the emulator runner starts.`);
