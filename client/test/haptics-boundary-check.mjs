// Plan UI9b · haptics: one bridge message, never in the exam room or the desk,
// nothing on the web.   node client/test/haptics-boundary-check.mjs
//
// SIMULATOR/EMULATOR ONLY. This suite is static and contract-level: it cannot
// feel a motor. Physical-device acceptance belongs to the owner's device pass.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORTED } from '../src/platform/native/host.js';
import { hasReplySchema } from '../src/platform/native/envelope.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const walk = dir => readdirSync(join(ROOT, dir)).flatMap(n => {
  const p = `${dir}/${n}`;
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
});

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };

const EXAM_PATHS = [...walk('client/src/examShell'), ...walk('client/src/desk'), 'client/src/pages/ExamRoom.jsx'];

check('nothing in the exam room, the desk or the exam shell imports haptics', () => {
  assert.ok(EXAM_PATHS.length > 10);
  for (const f of EXAM_PATHS.filter(p => /\.(jsx?|mjs)$/.test(p))) {
    assert.ok(!/haptic/i.test(read(f)), `${relative(ROOT, join(ROOT, f))} mentions haptics`);
  }
});
check('the exam room does not ask the shared ink answer for feedback (it is opt-in)', () => {
  assert.ok(!/<InkAnswer[^>]*\bfeedback\b/.test(read('client/src/pages/ExamRoom.jsx')));
  assert.match(read('client/src/ink/InkAnswer.jsx'), /feedback = false/);
  assert.match(read('client/src/ink/InkAnswer.jsx'), /if \(feedback\) haptic\('selection'\)/);
});
check('the bridge message is the same on the page, iOS (both projects) and Android', () => {
  assert.equal(SUPPORTED.haptics?.[0], 1);
  assert.ok(hasReplySchema('haptics', 'fire'));
  assert.match(read('client/src/platform/native/index.js'), /viaBridge\('haptics', 'fire'/);
  for (const f of ['ios/PriLearning.swiftpm/NativeHostBridge.swift', 'ios/PriLearning 2.swiftpm/NativeHostBridge.swift']) {
    const s = read(f);
    assert.match(s, /case "haptics\.fire":/, f);
    assert.match(s, /"haptics": \["versions": \[1\], "transport": "bridge", "kinds": \["confirm", "selection"\]\]/, f);
    assert.match(s, /UIImpactFeedbackGenerator\(style: \.light\)\.impactOccurred\(\)/, f);
    assert.match(s, /UISelectionFeedbackGenerator\(\)\.selectionChanged\(\)/, f);
  }
  assert.equal(read('ios/PriLearning.swiftpm/NativeHostBridge.swift'), read('ios/PriLearning 2.swiftpm/NativeHostBridge.swift'), 'the two iOS projects stay identical');
  const kt = read('android/app/src/main/java/com/prilearning/app/bridge/PriBridge.kt');
  assert.match(kt, /"haptics\.fire" ->/);
  assert.match(kt, /HapticFeedbackConstants\.CONFIRM/);
  assert.match(kt, /HapticFeedbackConstants\.VIRTUAL_KEY/);
  assert.match(kt, /HapticFeedbackConstants\.CLOCK_TICK/);
  assert.match(read('android/app/src/main/java/com/prilearning/app/bridge/HostDescriptor.kt'), /put\("haptics", cap\("transport" to "bridge"/);
});
check('only the two kinds exist, on every side', () => {
  assert.match(read('client/src/platform/native/index.js'), /new Set\(\['confirm', 'selection'\]\)/);
  assert.match(read('android/app/src/main/java/com/prilearning/app/bridge/PriBridge.kt'), /"confirm" ->[\s\S]*"selection" ->[\s\S]*else -> return send/);
});
check('the web build has no vibration API and no in-app haptics toggle', () => {
  for (const f of walk('client/src').filter(p => /\.(jsx?|mjs)$/.test(p) && !p.startsWith('client/src/i18n/'))) {
    assert.ok(!/navigator\.vibrate|\.vibrate\(/.test(read(f)), `${f} calls the vibration API`);
  }
  assert.ok(!/haptic/i.test(read('client/src/i18n/strings.en.js')), 'no haptics setting string');
});
const { haptic } = await import('../src/platform/native/haptics.js');
check('haptic() is silent without a native host (no capability, no throw)', () => { haptic('confirm'); haptic('bogus'); });

if (failures.length) { console.error(failures.join('\n')); console.error(`HAPTICS BOUNDARY: FAIL ${failures.length}`); process.exit(1); }
console.log(`HAPTICS BOUNDARY: PASS — ${pass} checks (static; simulator/emulator only, no physical-device evidence)`);
