import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canonical = new URL('../../ios/PriLearning.swiftpm/', import.meta.url);
const runnableCopy = new URL('../../ios/PriLearning 2.swiftpm/', import.meta.url);
const critical = [
  'Package.swift',
  'PriLearningApp.swift',
  'LocalSchemeHandler.swift',
  'PhotoOCR.swift',
  'WebShell.swift',
  'StoreKitBillingBridge.swift',
  'NativeCloudBridge.swift'
];

for (const path of critical) {
  let expected;
  let actual;
  try { expected = readFileSync(new URL(path, canonical), 'utf8'); }
  catch { assert.fail(`canonical iOS package is missing release-critical source: ${path}`); }
  try { actual = readFileSync(new URL(path, runnableCopy), 'utf8'); }
  catch { assert.fail(`runnable iOS package copy is missing release-critical source: ${path}`); }
  assert.equal(actual, expected, `iOS package source drift detected in ${path}`);
}

console.log(`PASS — ${critical.length} release-critical Swift package files are identical in PriLearning.swiftpm and PriLearning 2.swiftpm.`);
