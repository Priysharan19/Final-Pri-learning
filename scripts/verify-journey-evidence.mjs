import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Fail closed if the selected family, source, runtime or required journey
// evidence is missing. Never use one family's artifact for the other.
export function verifyJourneyEvidence(e, family, runtime, sha) {
  assert.ok(family === 'ipad' || family === 'iphone', 'unknown device family');
  assert.ok(/^\d+\.\d+$/.test(runtime), 'missing runtime pin');
  assert.ok(/^[a-f0-9]{40}$/.test(sha), 'missing checkout SHA');
  assert.equal(e.sha, sha, 'wrong source checkout');
  assert.equal(e.evidenceClass, 'SYNTHETIC_SIMULATOR');
  assert.equal(e.physicalDevice, false);
  assert.equal(e.simulator?.runtimePinned, true, 'runtime not pinned');
  assert.equal(e.simulator.pinnedRuntime, runtime, 'wrong runtime pin');
  assert.equal(e.simulator.runtime, 'iOS-' + runtime.replace('.', '-'), 'wrong observed runtime');
  assert.ok((family === 'ipad' ? /iPad/ : /iPhone/).test(e.simulator.name), 'wrong device family');
  assert.equal(e.result, 'PASS');
  assert.ok(e.steps && Object.values(e.steps).length >= (family === 'ipad' ? 35 : 45), 'missing checks');
  for (const step of ['launch','wordmarkClearsStatusBar','noEntryWithoutAccount','deepLinkHeld','nothingMarked','persistenceMarker','relaunchStillHeld','relaunchMarker','offlineAfterEntry','practice','nativeInk','typedDraft','photoDraft','noCheckOffered','replaceKeepsWork','nothingRecorded','offlineProgress','offlinePersistenceMarker','offlineRelaunchGrace','offlineDraftOnDisk','cardOnboarding','firstQuestion','typedWrongZero','typedCorrectFull','inkServerReading','inkCorrectedMarked','historyRecorded','historyAfterRelaunch','serverAccountFromCard','serverGrades','serverReaderAnswerBlind','dynamicTypeZoom','dynamicTypeNoOverflow','backgroundDraftKept','a11yAudit']) {
    assert.equal(e.steps[step]?.ok, true, 'missing/failed ' + step);
  }
  if (family === 'iphone') for (const step of ['cloudSignUp','cloudDeleteAccount','serverDeletedAccountRefused','cloudSignIn','cloudSync','offlineGraceOpens','cloudSessionKept','cloudReconnectSync','cloudDisconnect','serverLogoutRecorded']) {
    assert.equal(e.steps[step]?.ok, true, 'missing/failed ' + step);
  }
  assert.ok(Object.values(e.steps).every(step => step?.ok === true), 'failed journey assertion');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, family, runtime, sha] = process.argv.slice(2);
  const e = JSON.parse(readFileSync(file, 'utf8'));
  verifyJourneyEvidence(e, family, runtime, sha);
  console.log(file + ': ' + e.simulator.name + ' on ' + e.simulator.runtime + ' — ' + Object.keys(e.steps).length + ' complete checks, exact checkout ' + sha);
}
