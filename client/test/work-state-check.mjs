// The one vocabulary for the state of the student's work: every displayed state maps 1:1 to the
// underlying state, and nothing is ever shown as saved (or uploaded, or marked) before it is true.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORK_STATES, ALL_STATE_KEYS, stateKey, practiceWorkState, autosaveWorkState, syncWorkState, contentWorkState } from '../src/platform/workState.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const stateOfKey = key => {
  const m = /^workstate\.failed\.(.+)$/.exec(key); if (m) return 'failed';
  const bare = key.replace(/^workstate\./, '');
  if (WORK_STATES.includes(bare)) return bare;
  return ({ offlineReadable: 'offline-readable', savedOnDevice: 'saved-on-device', waitingToUpload: 'waiting-to-upload', beingRead: 'being-read', needsConfirmation: 'needs-confirmation', waitingSignIn: 'waiting-to-upload', waitingPhoto: 'waiting-to-upload', waitingKept: 'waiting-to-upload', waitingSignedOut: 'waiting-to-upload',
    savedOffline: 'saved-on-device', savedPhoto: 'saved-on-device', markingMethod: 'marking' })[bare];
};

ok('every state and variant has a catalogue string in en and hi, with the same placeholders', () => {
  for (const k of ALL_STATE_KEYS) {
    assert.equal(typeof en[k], 'string', 'en ' + k); assert.equal(typeof hi[k], 'string', 'hi ' + k);
    assert.deepEqual([...en[k].matchAll(/\{(\w+)\}/g)].map(m => m[1]), [...hi[k].matchAll(/\{(\w+)\}/g)].map(m => m[1]), k);
    assert.ok(stateOfKey(k), 'key ' + k + ' names no state');
  }
  for (const s of WORK_STATES) assert.ok(ALL_STATE_KEYS.some(k => stateOfKey(k) === s), 'no label for ' + s);
});

ok('no two different states share the same words', () => {
  const byText = new Map();
  for (const k of ALL_STATE_KEYS) { const t = en[k]; const s = stateOfKey(k); if (byText.has(t)) assert.equal(byText.get(t), s, 'text shared across states: ' + t); byText.set(t, s); }
});

ok('no state claims more than is true: no label says saved, uploaded or marked unless its state is', () => {
  for (const k of ALL_STATE_KEYS) {
    const s = stateOfKey(k); const t = en[k].toLowerCase();
    if (/(^|[^t] )saved to your account/.test(t) && !/not saved/.test(t)) assert.equal(s, 'uploaded', k);
    if (/not saved to your account/.test(t)) assert.equal(s, 'waiting-to-upload', k);
    if (/^marked|marked by/.test(t)) assert.equal(s, 'marked', k);
    if (/(^|\b)saved on this device|photo and reading saved/.test(t) && !/not saved|waiting/.test(t)) assert.ok(['saved-on-device', 'waiting-to-upload'].includes(s), k);
  }
});

ok('practice card: all 2^13 fact combinations map to one state, and the label never runs ahead of the facts', () => {
  const names = ['busy', 'cloudPending', 'resolved', 'serverAuthoritative', 'offline', 'inkUnread', 'inkWaitingSignIn', 'photoWaitingSignIn', 'readerLimit', 'readerDown', 'awaitingReading', 'reading', 'readOnScreen'];
  let seen = new Set();
  for (const saveState of ['idle', 'saving', 'saved', 'failed']) for (let mask = 0; mask < 1 << names.length; mask++) {
    const f = { saveState, photoSaved: mask % 3 === 0 }; names.forEach((nm, i) => { f[nm] = !!(mask & (1 << i)); });
    const v = practiceWorkState(f);
    assert.deepEqual(practiceWorkState(f), v, 'deterministic');
    if (v.state === null) { assert.equal(v.key, null); continue; }
    assert.ok(ALL_STATE_KEYS.includes(v.key), v.key); assert.equal(stateOfKey(v.key), v.state, `${v.key} is not a label of ${v.state}`);
    seen.add(v.state);
    if (v.state === 'saved-on-device') assert.equal(saveState, 'saved', 'saved shown without a confirmed device save');
    if (v.state === 'saving') assert.equal(saveState, 'saving');
    if (v.state === 'marked') assert.ok(f.resolved && f.serverAuthoritative && !f.busy, 'marked without a server receipt');
    if (saveState === 'failed' && !f.busy && !f.cloudPending && !f.resolved) assert.equal(v.state, 'failed');
    if (saveState !== 'saved' && v.state === 'waiting-to-upload') assert.equal(v.key, 'workstate.waitingPhoto');
    assert.notEqual(v.state, 'uploaded', 'the practice card cannot know the upload');
  }
  for (const s of ['marking', 'marked', 'saving', 'saved-on-device', 'waiting-to-upload', 'failed', 'being-read', 'needs-confirmation', 'offline-readable']) assert.ok(seen.has(s), 'never reached ' + s);
});

ok('exam room and desk: device save and account save are different states, and a failed account save is only "waiting"', () => {
  assert.equal(autosaveWorkState({ saveState: 'saved', target: 'device' }).state, 'saved-on-device');
  assert.equal(autosaveWorkState({ saveState: 'saved', target: 'account' }).state, 'uploaded');
  assert.equal(autosaveWorkState({ saveState: 'saving', target: 'account' }).state, 'saving');
  assert.equal(autosaveWorkState({ saveState: 'unsaved', target: 'account' }).state, 'waiting-to-upload');
  assert.equal(autosaveWorkState({ problem: 'offline', saveState: 'saved', target: 'account' }).state, 'waiting-to-upload', 'a stale "saved" never outranks a live problem');
  assert.equal(autosaveWorkState({ saveState: 'error', target: 'device' }).state, 'failed');
  assert.equal(autosaveWorkState({ saveState: 'idle', target: 'device' }).key, null);
  for (const t of ['device', 'account']) for (const saveState of ['idle', 'saving', 'saved', 'unsaved', 'error']) for (const problem of [null, 'offline', 'failed', 'signed-out']) {
    const v = autosaveWorkState({ saveState, problem, target: t });
    if (v.key) assert.equal(stateOfKey(v.key), v.state);
    if (v.state === 'uploaded') assert.ok(t === 'account' && saveState === 'saved' && !problem);
    if (v.state === 'saved-on-device') assert.ok(t === 'device' && saveState === 'saved' && problem !== 'failed');
  }
});

ok('a failed or running device save is never hidden by a result; a kept (unsynced) desk copy is never "uploaded"', () => {
  assert.equal(practiceWorkState({ saveState: 'failed', resolved: true, serverAuthoritative: true }).state, 'failed');
  assert.equal(practiceWorkState({ saveState: 'saving', resolved: true, serverAuthoritative: true }).state, 'saving');
  assert.equal(practiceWorkState({ saveState: 'saved', resolved: true, serverAuthoritative: true }).state, 'marked');
  assert.equal(autosaveWorkState({ saveState: 'saved', target: 'account', synced: false }).state, 'waiting-to-upload');
  assert.equal(autosaveWorkState({ saveState: 'saved', target: 'account', synced: true }).state, 'uploaded');
});

ok('sync: uploaded only after an acknowledgement and with nothing pending', () => {
  assert.equal(syncWorkState({ pending: 2, acknowledged: true }).state, 'waiting-to-upload');
  assert.equal(syncWorkState({ inFlight: true, acknowledged: true }).state, 'waiting-to-upload');
  assert.equal(syncWorkState({ failed: true, pending: 1 }).state, 'failed');
  assert.equal(syncWorkState({ acknowledged: true }).state, 'uploaded');
  assert.equal(syncWorkState({}).state, 'saved-on-device');
  assert.equal(contentWorkState({ cached: true }).state, 'cached');
  assert.equal(contentWorkState({ cached: true, readableOffline: true }).state, 'offline-readable');
  assert.equal(contentWorkState({}).key, null);
});

ok('the practice card, exam room and desk label their save state through the vocabulary only', () => {
  const card = read('../src/components/QuestionCard.jsx'), room = read('../src/pages/ExamRoom.jsx'), desk = read('../src/desk/DeskPage.jsx');
  assert.match(card, /practiceWorkState\(/); assert.match(room, /autosaveWorkState\(/); assert.match(desk, /autosaveWorkState\(/);
  for (const old of ['verdict.statusSaved', 'verdict.statusSaving', 'verdict.statusNotSaved', 'verdict.statusSavedOffline', 'photo.statusSaved'])
    assert.equal(card.includes(`t('${old}')`) || card.includes(`'${old}'`), false, 'card still labels with ' + old);
  for (const old of ["t('examRoom.saved')", "t('examRoom.saving')", "t('examRoom.saveError')"]) assert.equal(room.includes(old), false, old);
  assert.equal(/saveStateKey\(/.test(desk), false);
});
console.log(`WORK STATE: PASS — ${n}/${n} checks`);
