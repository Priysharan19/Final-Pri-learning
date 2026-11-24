import assert from 'node:assert/strict';
import { reportOffset, readJourneyReport, journeyReportSource } from './journey-evidence-reader.mjs';

const path = '/sim/Documents/PRIJOURNEY.log';
const data = text => () => Buffer.from(text);
const missing = () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); };
const denied = () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); };
const old = 'PRIJOURNEY started offlineDraft\nPRIJOURNEY summary offlineDraft 0 failure(s)\n';
const fresh = 'PRIJOURNEY started offlineRelaunch\nPRIJOURNEY ok offlineRelaunchGrace held\n';
const choose = (report, launchAgeMs, sinceLogMs = 90_000, reportPath = path) =>
  journeyReportSource({ path: reportPath, report, launchAgeMs, sinceLogMs, stallMs: 180_000, logIntervalMs: 30_000 });

assert.equal(reportOffset(path, missing), 0);
assert.equal(reportOffset(path, denied), null);
assert.equal(reportOffset(null, data(old)), null);
const offset = reportOffset(path, data(old));
assert.equal(offset, Buffer.byteLength(old));
const empty = readJourneyReport(path, offset, data(old));
assert.deepEqual(empty, { offset, lines: [] });
assert.equal(choose(empty, 2_000), 'file');
assert.equal(choose(empty, 300_000), 'file'); // never block a readable report, even at stall recovery
const read = readJourneyReport(path, offset, data(old + fresh + 'PRIJOURNEY summary offlineRelaunch'));
assert.deepEqual(read.lines, fresh.trimEnd().split('\n')); // old phase and incomplete summary excluded
assert.equal(choose(read, 240_000), 'file');
assert.equal(readJourneyReport(path, null, data(old)), null); // never trust an unknown pre-launch offset
assert.equal(readJourneyReport(path, offset, denied), null);
assert.equal(choose(null, 2_000), 'wait');
assert.equal(choose(null, 179_999), 'wait');
assert.equal(choose(null, 180_000), 'unified');
assert.equal(choose(null, 180_000, 29_999), 'wait');
assert.equal(choose(null, 0, 90_000, null), 'unified');
assert.deepEqual(readJourneyReport(path, 10000, data(fresh)), { offset: 0, lines: fresh.trimEnd().split('\n') });
console.log('JOURNEY EVIDENCE READER: PASS — 17/17 checks');

// Negative coverage of the final per-family evidence gate. A cancelled,
// partial, stale or wrong-device result cannot certify a native journey.
const { verifyJourneyEvidence } = await import('./verify-journey-evidence.mjs');
const sha = 'a'.repeat(40);
const required = ['offlineAfterEntry','practice','nativeInk','typedDraft','photoDraft','noCheckOffered','replaceKeepsWork','nothingRecorded','offlineProgress','offlinePersistenceMarker','offlineRelaunchGrace','offlineDraftOnDisk','cardOnboarding','firstQuestion','typedWrongZero','typedCorrectFull','inkServerReading','inkCorrectedMarked','historyRecorded','historyAfterRelaunch','serverAccountFromCard','serverGrades','serverReaderAnswerBlind','dynamicTypeZoom','dynamicTypeNoOverflow','backgroundDraftKept','a11yAudit','launch','wordmarkClearsStatusBar','noEntryWithoutAccount','deepLinkHeld','nothingMarked','persistenceMarker','relaunchStillHeld','relaunchMarker'];
const phone = ['cloudSignUp','cloudDeleteAccount','serverDeletedAccountRefused','cloudSignIn','cloudSync','offlineGraceOpens','cloudSessionKept','cloudReconnectSync','cloudDisconnect','serverLogoutRecorded'];
function sample(family) {
  return { sha, evidenceClass:'SYNTHETIC_SIMULATOR', physicalDevice:false, result:'PASS',
    simulator:{name:family==='ipad'?'iPad Pro':'iPhone Pro', runtime:'iOS-26-5', pinnedRuntime:'26.5', runtimePinned:true},
    steps:Object.fromEntries([...required,...(family==='iphone'?phone:[])].map(k=>[k,{ok:true}])) };
}
assert.equal(verifyJourneyEvidence(sample('ipad'),'ipad','26.5',sha),true);
assert.equal(verifyJourneyEvidence(sample('iphone'),'iphone','26.5',sha),true);
for (const mutate of [
  e=>{e.sha='b'.repeat(40)}, e=>{e.simulator.name='iPhone'}, e=>{e.simulator.runtimePinned=false},
  e=>{e.simulator.runtime='iOS-27-0'}, e=>{e.result='FAIL'}, e=>{delete e.steps.offlineDraftOnDisk},
  e=>{e.steps.offlineRelaunchGrace.ok=false}, e=>{e.physicalDevice=true}
]) { const e=sample('ipad'); mutate(e); assert.throws(()=>verifyJourneyEvidence(e,'ipad','26.5',sha)); }
const missingCloud=sample('iphone'); delete missingCloud.steps.cloudDeleteAccount;
assert.throws(()=>verifyJourneyEvidence(missingCloud,'iphone','26.5',sha));
console.log('JOURNEY FAMILY EVIDENCE: PASS — 11/11 checks');
