// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · online-only checking, as the student meets it
//
// Owner decision 2026-10-10: only Pri's server marks. Nothing is checked signed
// out or offline. A student may read, type, write and keep drafts before
// signing in; checking an answer, awarding marks and showing the solution need
// a verified eligible account, a connection and a server-issued question.
//
//   1 · the reason a check was refused is named from the error's code;
//   2 · every reason has words in both languages, and none of them claims the
//       work was saved (only a storage readback may say that);
//   3 · a refused check is a state with no verdict, marks, XP or solution, and
//       it keeps the submission key, so Retry is the same submission;
//   4 · a device-shaped result is never a practice result;
//   5 · the real local backend, signed out: submit and reveal are refused,
//       nothing is spent, and the typed answer, working, ink and pending
//       submission are exactly where they were;
//   6 · the mounted card says checking needs a Pri account, with the sign-in in
//       the card, in Type, Write and Photo, before Submit is pressed;
//   7 · the mounted refusal for each reason, in the card and on the exam page;
//   8 · the card, the tutor and the exam page are wired to all of the above.
//
// This suite needs no server: every case here is a refusal or a rendering. The
// signed-in happy path is covered by the server-harness suites.
//
//   node client/test/online-check-access-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

installBrowserEnv(); resetStorage();
{
  const m = new Map();
  globalThis.localStorage = {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; }
  };
}
const fakeWindow = new EventTarget();
Object.defineProperty(fakeWindow, 'localStorage', { get: () => globalThis.localStorage });
fakeWindow.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.window = fakeWindow;
if (typeof globalThis.document === 'undefined') {
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible', documentElement: { lang: 'en' }, cookie: '' });
}

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const access = await import('../src/components/checkAccess.js');
const { CHECK_REFUSAL, checkRefusal, checkRefusalCopy, needsAccountToCheck, refusedCheckState, retryActionFor, serverRevealReceipt, legacyDeviceReplay } = access;
const { matchingGradeResponse, attestedGrade } = await import('../src/components/authoritativeGrade.js');
const { definitiveSubmissionRefusal } = await import('../src/components/photoSubmissionGuard.js');
const { consumeSessionReceipt } = await import('../src/pages/practiceSessionReceipt.js');

const err = (status, code, extra = {}) => Object.assign(new Error(code || String(status)), { status, code, ...extra });
// The errors the local backend throws (client/src/local/backend.js checkUnavailable).
const SIGN_IN = err(401, 'SIGN_IN_TO_CHECK');
const RECONNECT = err(503, 'RECONNECT_TO_CHECK');
const QUESTION = err(503, 'QUESTION_CHECK_UNAVAILABLE');
const EMAIL = err(403, 'EMAIL_UNVERIFIED');
const GUARDIAN = err(403, 'GUARDIAN_CONSENT_PENDING');
const UPGRADE = err(426, 'CLIENT_UPGRADE_REQUIRED');

// ── 1 · The reason, from the code ────────────────────────────────────────────
{
  eq(checkRefusal(SIGN_IN), 'sign-in', 'SIGN_IN_TO_CHECK is "sign in"');
  eq(checkRefusal(err(401, 'AUTH_REQUIRED')), 'sign-in', 'the server\'s own AUTH_REQUIRED is "sign in"');
  eq(checkRefusal(err(401, undefined)), 'sign-in', 'a 401 whose body lost its code is still "sign in"');
  eq(checkRefusal(RECONNECT), 'reconnect', 'RECONNECT_TO_CHECK is "reconnect"');
  eq(checkRefusal(err(500, 'CLOUD_DISABLED')), 'reconnect', 'no cloud configured is "could not reach the server"');
  eq(checkRefusal(err(500, 'INTERNAL_ERROR')), 'reconnect', 'a failed request to an issued question is "reconnect"');
  eq(checkRefusal(err(429, 'RATE_LIMITED')), 'reconnect', 'a rate limit is retryable, not an account problem');
  eq(checkRefusal(Object.assign(new Error('t'), { name: 'TimeoutError' })), 'reconnect', 'a timeout is "reconnect"');
  eq(checkRefusal(QUESTION), 'question', 'QUESTION_CHECK_UNAVAILABLE is about this question');
  eq(checkRefusal(EMAIL), 'verify-email', 'EMAIL_UNVERIFIED names the email step');
  eq(checkRefusal(GUARDIAN), 'guardian', 'GUARDIAN_CONSENT_PENDING names the guardian step');
  eq(checkRefusal(err(403, 'GUARDIAN_CONSENT_WITHDRAWN')), 'guardian', 'so does a withdrawn consent');
  eq(checkRefusal(err(403, 'AGE_DECLARATION_REQUIRED')), 'guardian', 'and a missing age declaration');
  eq(checkRefusal(err(403, 'GUARDIAN_CONSENT_UNAVAILABLE')), 'reconnect', 'a failed consent lookup is server trouble, not a guardian step');
  eq(checkRefusal(UPGRADE), 'update', 'CLIENT_UPGRADE_REQUIRED names the update');
  eq(checkRefusal(err(403, 'ACCOUNT_RESTRICTED')), 'account', 'any other 403 is an account step, never "sign in"');
  eq(checkRefusal(err(409, 'ALREADY_RESOLVED')), null, 'an already-finished question keeps its own message');
  eq(checkRefusal(err(409, 'SUBMISSION_ID_REUSED')), null, 'so does a reused key');
  eq(checkRefusal(err(422, 'RECOGNITION_IMAGE_REQUIRED')), null, 'and an unreadable image');
  eq(checkRefusal(err(503, 'GRADE_ACK_MISSING')), null, 'a server answer this device cannot trust is not called "offline"');
  eq(checkRefusal(err(403, 'EXAM_QUESTION_LOCKED')), null, 'an exam question opened as practice is not an account state');
  eq(checkRefusal(err(401, undefined, { needsPassword: true })), null, 'the device profile\'s own password lock is not a Pri sign-in');
  eq(checkRefusal(new Error('The server response did not match this submission.')), null, 'a receipt mismatch raised by the card keeps its own wording');
  eq(checkRefusal(null), null, 'nothing is nothing');
  ok(needsAccountToCheck({ id: 'p', cloudLinked: false }) && needsAccountToCheck({ id: 'p' }) && needsAccountToCheck(null), 'a profile with no linked account needs one to check');
  ok(!needsAccountToCheck({ id: 'p', cloudLinked: true }), 'a linked profile is not told to sign in before it has tried');
}

// ── 2 · Words for every reason, in both languages ────────────────────────────
{
  const kinds = Object.values(CHECK_REFUSAL);
  eq(kinds.length, 8, 'eight reasons are named');
  const used = new Set(['check.needsAccount', 'check.signInAction']);
  // A timed game (Rapid Fire, Match) is refused at its start with the same reasons.
  for (const context of ['answer', 'exam', 'game', 'placement']) {
    for (const kind of kinds) {
      const copy = checkRefusalCopy(kind, context);
      ok(copy && ['sign-in', 'retry', 'account', 'next'].includes(copy.action), `${kind}/${context} has one next step`);
      for (const key of [copy.titleKey, copy.contextKey, copy.hintKey]) {
        used.add(key);
        ok(typeof en[key] === 'string' && en[key].trim() && typeof hi[key] === 'string' && hi[key].trim() && en[key] !== hi[key], `${key} is in both catalogues`);
      }
    }
  }
  eq(checkRefusalCopy('sign-in').action, 'sign-in', 'the sign-in reason offers the sign-in itself');
  eq(checkRefusalCopy('reconnect').action, 'retry', 'the reconnect reason offers a retry');
  eq(checkRefusalCopy('question').action, 'retry', 'so does a question that cannot be checked');
  // A question the server never issued (opened offline) or whose prepared
  // token ran out cannot be marked by retrying or signing in: the way on is a
  // new question.
  eq(checkRefusalCopy('new-question').action, 'next', 'a question that can never be marked offers the next question');
  eq([checkRefusal({ status: 409, code: 'QUESTION_NOT_SERVER_ISSUED' }), checkRefusal({ status: 409, code: 'QUESTION_PREPARED_EXPIRED' })], ['new-question', 'new-question'], 'an offline draft and an expired prepared question both read as that reason');
  eq([checkRefusalCopy('verify-email').action, checkRefusalCopy('guardian').action], ['account', 'account'], 'the email and guardian reasons point at the account, where they are cleared');
  eq(checkRefusalCopy('sign-in', 'exam').titleKey, 'check.examSignInTitle', 'an exam start says a paper, not an answer');
  eq(checkRefusalCopy('reconnect', 'exam').contextKey, 'check.examNotStarted', 'and that the paper has not started');
  eq(checkRefusalCopy('sign-in', 'game').contextKey, 'check.gameNotStarted', 'a game that could not start says so, and that nothing was marked');
  eq(checkRefusalCopy('reconnect', 'placement').contextKey, 'check.placementNotStarted', 'a placement check that could not start says so');
  eq(checkRefusalCopy('nonsense'), null, 'an unknown reason has no words');
  const catalogueKeys = Object.keys(en).filter(k => k.startsWith('check.'));
  eq(catalogueKeys.filter(k => !used.has(k)), [], 'no check.* string is unused');
  for (const key of catalogueKeys) {
    ok(!/\bsaved\b|\bsafe\b|on this device|on-device|offline/i.test(en[key]), `${key} (EN) makes no saved, on-device or offline claim`);
    ok(!/सहेज|सुरक्षित|ऑफ़लाइन/.test(hi[key]), `${key} (HI) makes no saved or offline claim`);
  }
  ok(/not been checked/.test(en['check.notChecked']) && /still on this page/.test(en['check.notChecked']), 'the refusal says the answer was not checked and the working is still on the page');
  ok(/Pri account/.test(en['check.needsAccount']) && /keep working/.test(en['check.needsAccount']), 'before Submit: checking needs a Pri account, and working can continue');
  ok(/could not reach the server/.test(en['check.reconnectTitle']), 'reconnect is stated plainly');
  // Copy that used to promise marking with no account or no connection.
  const promised = /marked on your device|Typed practice works|works offline|Offline practice continues|marking happens entirely on this device|marking and handwriting all run on this device|use Pri fully on this device|Offline-first|type your answer/i;
  for (const key of ['login.heroSub', 'login.heroPrivacy', 'login.point4', 'login.localOnlySub', 'login.authFoot', 'cloud.created', 'cloud.offlineNote', 'cloud.intro', 'cloud.disabled', 'cloud.under18', 'signup.cloudUnavailable', 'signup.parentLead', 'settings.cloudMarkingUnavailable', 'home.cloudUnavailable', 'home.reason.practiceOffline', 'ink.waitingSignIn', 'ink.waitingOffline', 'ink.waitingGuardian', 'ink.waitingVerifyEmail', 'verdict.photoReadingSignIn', 'verdict.photoReadingOffline', 'verdict.photoReadingGuardian', 'verdict.photoReadingVerifyEmail']) {
    ok(typeof en[key] === 'string' && !promised.test(en[key]), `${key} no longer promises checking without an account or a connection`);
  }
  ok(/Pri account/.test(en['login.localOnlySub']) && /checking answers/.test(en['login.localOnlySub']), 'device-only mode says checking answers needs a Pri account');
  const html = read('index.html');
  ok(!/marked on your device|Offline-first|account is optional/.test(html) && /checked by Pri’s server/.test(html), 'the page description says answers are checked by Pri\'s server');
  const manifest = read('public/manifest.webmanifest');
  ok(!/marked on your device|Offline-first|account is optional/.test(manifest) && /checked by Pri’s server/.test(manifest), 'and so does the install manifest');
}

// ── 3 · A refused check: no verdict, and the same submission on Retry ────────
{
  for (const [error, kind] of [[SIGN_IN, 'sign-in'], [RECONNECT, 'reconnect'], [QUESTION, 'question'], [EMAIL, 'verify-email'], [GUARDIAN, 'guardian']]) {
    const state = refusedCheckState(error, 'submit');
    eq([state.phase, state.res.refusal, state.res.technical, state.res.invalid], ['retry', kind, true, true], `${kind}: the existing "not submitted" state, with its reason`);
    for (const field of ['correct', 'resolved', 'authoritative', 'attemptId', 'marksEarned', 'marksPossible', 'xp', 'solution', 'partial', 'stepReport']) {
      ok(!(field in state.res), `${kind}: the refused state has no ${field}`);
    }
    // 401/403/5xx are not definitive: the card keeps the pending key, so an
    // identical Retry is the same submission.
    ok(definitiveSubmissionRefusal(error) === false, `${kind}: the submission key is kept for the retry`);
  }
  eq(refusedCheckState(SIGN_IN, 'submit', { diagnostic: true }).res.refusal, 'sign-in', 'the placement check, now issued and marked by the server, names its account refusal too');
  eq(refusedCheckState(err(409, 'ALREADY_RESOLVED'), 'submit').res.conflict, true, 'a finished question is still a conflict, not a retry');
  // Regression (native simulator journey, 2026-10-10): an offline draft's 409
  // was shown as "This question is already finished" instead of its refusal.
  for (const code of ['QUESTION_NOT_SERVER_ISSUED', 'QUESTION_PREPARED_EXPIRED']) {
    const state = refusedCheckState(err(409, code), 'submit');
    eq([state.res.refusal, state.res.conflict], ['new-question', false], `${code}: named as a question that cannot be marked, not as an already-finished one`);
  }
  eq([retryActionFor('submit'), retryActionFor('reveal'), retryActionFor('tutor')], ['submit', 'reveal', null], 'Retry repeats the refused action and nothing else');
}

// ── 4 · A device-shaped result is never a practice result ────────────────────
{
  const device = { authoritative: false, correct: true, resolved: true, submissionId: 'sub-1' };
  ok(!matchingGradeResponse(device, 'q-1', 'sub-1'), 'a device verdict for the submission sent is refused');
  ok(!matchingGradeResponse({ ...device, authoritative: undefined }, 'q-1', 'sub-1'), 'so is a result that does not say who marked it');
  ok(!matchingGradeResponse({ ...device, attemptId: 'attempt-1', marksEarned: 1, marksPossible: 1 }, 'q-1', 'sub-1'), 'and one dressed with an attempt id and marks');
  ok(matchingGradeResponse({ ...device, authoritative: true, attemptId: 'attempt-1' }, 'q-1', 'sub-1'), 'only the matched server receipt is accepted');
  ok(!matchingGradeResponse({ ...device, authoritative: true, attemptId: 'attempt-1' }, 'q-1', 'sub-2'), 'and only for the submission that was sent');
  eq(attestedGrade({ ...device, attemptId: 'a', marksEarned: 1, marksPossible: 1 }, 'q-1', { questionId: 'q-1', attemptId: 'a', submissionId: 'sub-1' }), null, 'a device verdict never shows marks');
  ok(!serverRevealReceipt({ authoritative: false, resolved: true, revealed: true }), 'a device reveal does not open the solution');
  ok(serverRevealReceipt({ authoritative: true, resolved: true, revealed: true, attemptId: 'attempt-1' }), 'the server\'s committed reveal does');
  ok(!consumeSessionReceipt({ ...device }, new Set(), 'q-1'), 'a device verdict is not counted in the session banner');
  ok(consumeSessionReceipt({ authoritative: true, resolved: true, attemptId: 'attempt-00001' }, new Set()), 'a server receipt is');
  ok(legacyDeviceReplay({ ...device, replayed: true }) && !legacyDeviceReplay(device), 'only a replay of an older version\'s row is treated as history');
  ok(legacyDeviceReplay({ authoritative: false, replayed: true, resolved: false, correct: false }) && !legacyDeviceReplay({ ...device, replayed: true, authoritative: true }), 'a first try an older version marked is history too; a server replay never is');
  const grade = await import('../src/components/authoritativeGrade.js');
  ok(!('deviceMarkedResponse' in grade) && !('deviceRevealResponse' in grade), 'the device-verdict acceptors are gone');
}

// ── 5 · The real local backend, signed out ───────────────────────────────────
// Signed out with the server reachable (the real /v1 app, in-process) the
// student is shown a PREPARED question: it is the server's, waiting for an
// account, so the refusal is "sign in to check" and the in-card sign-in is the
// way on. With no connection the question is an offline DRAFT, which can never
// be marked: that refusal offers the next question instead.
{
  const { startOnlineAuthority } = await import('./support/online-authority.mjs');
  const online = await startOnlineAuthority({ label: 'online-check-access' });
  const { api } = await import('../src/api.js');
  const idb = await import('../src/local/idb.js');
  const recovery = await import('../src/components/practiceRecovery.js');
  const drafts = await import('../src/components/drafts.js');
  const inkDrafts = await import('../src/local/inkDrafts.js');
  const { loadAllBanks } = await import('../src/engine/generators/index.js');
  await loadAllBanks();
  const refused = async promise => { try { await promise; } catch (e) { return e; } return null; };

  const me = (await api.post('/profiles', { name: 'Signed Out Student', year: 10 })).user;
  drafts.setDraftProfile(me.id);
  eq(me.cloudLinked === true, false, 'a new device profile has no Pri account');
  ok(needsAccountToCheck(me), 'so the card says checking needs one before Submit is pressed');

  const served = await api.post('/practice/next', {});
  const id = served.question.id;
  ok(typeof served.question.prompt === 'string' && served.question.prompt.length > 0, 'signed out, the question is still served and readable');
  eq([served.question.checkState, typeof (await idb.get('questions', id)).prepared, (await idb.get('questions', id)).serverQuestionId], ['prepared', 'string', undefined], 'as a prepared question: the server\'s, not yet bound to any account');
  const rowBefore = JSON.stringify(await idb.get('questions', id));

  // What the card keeps while the student works, before any account exists.
  ok(drafts.saveDraft('question', id, { typed: '343/6', working: 'x = 0, 7\n∫(7x − x²) dx' }, { label: 'draft' }), 'the typed answer and working are written to the draft store');
  const strokes = [{ points: [{ x: 11, y: 12 }, { x: 31, y: 44 }] }, { points: [{ x: 50, y: 12 }, { x: 52, y: 60 }] }];
  ok(recovery.saveInkDraft(id, strokes, { label: 'draft' }), 'the Pencil strokes are queued for the sealed store');
  await inkDrafts.flushInkDrafts();
  eq((await recovery.readInkDraft(id))?.length, 2, 'and read back from IndexedDB');
  const submissionId = recovery.newSubmissionId();
  ok(recovery.savePendingSubmission(id, { submissionId, answer: '343/6', steps: 'x = 0, 7', viaInk: false, sourceMode: 'typed', ms: 4200, lines: null }, { label: 'draft' }), 'the submission key is on disk before the request leaves');

  const first = await refused(api.post(`/practice/${id}/submit`, { answer: '343/6', steps: 'x = 0, 7', ms: 4200, submissionId }));
  eq([first?.status, first?.code], [401, 'SIGN_IN_TO_CHECK'], 'Submit signed out is refused: sign in to check');
  eq(checkRefusal(first), 'sign-in', 'and the card reads that as the in-card sign-in');
  const stateAfter = refusedCheckState(first, 'submit');
  ok(!('correct' in stateAfter.res) && !('solution' in stateAfter.res) && !('marksEarned' in stateAfter.res), 'no verdict, marks or solution come back with it');
  eq(JSON.stringify(await idb.get('questions', id)), rowBefore, 'the question row is untouched: no try spent, nothing marked');
  eq((await idb.byIndex('attempts', 'pid', me.id)).filter(a => a.questionId === id).length, 0, 'no attempt is recorded');
  eq(drafts.readDraft('question', id)?.typed, '343/6', 'the typed answer is still in its draft');
  eq(drafts.readDraft('question', id)?.working, 'x = 0, 7\n∫(7x − x²) dx', 'the typed working is still in its draft');
  eq(JSON.stringify((await recovery.readInkDraft(id)).map(s => s.points.length)), JSON.stringify([2, 2]), 'the ink reads back from IndexedDB, stroke for stroke');
  eq(recovery.readPendingSubmission(id)?.submissionId, submissionId, 'the same submission key is still pending');

  const again = await refused(api.post(`/practice/${id}/submit`, { answer: '343/6', steps: 'x = 0, 7', ms: 4200, submissionId }));
  eq([again?.status, again?.code], [401, 'SIGN_IN_TO_CHECK'], 'a retry under the same key is refused the same way');
  eq(JSON.stringify(await idb.get('questions', id)), rowBefore, 'and still spends nothing');

  const reveal = await refused(api.post(`/practice/${id}/reveal`, { ms: 5000 }));
  eq([reveal?.status, reveal?.code], [401, 'SIGN_IN_TO_CHECK'], 'Show solution signed out is refused the same way');
  eq(JSON.stringify(await idb.get('questions', id)), rowBefore, 'the solution is not revealed and the question is still open');
  // The request Practice makes on a reload: resume, pending question first.
  eq(recovery.pendingSubmissionQuestionId(), id, 'the refused submission still names its question');
  const resumed = await api.post('/practice/next', { resume: true, pendingQuestionId: recovery.pendingSubmissionQuestionId() });
  eq(resumed.question.id, id, 'the same question comes back: the original question continues');
  ok(!('answer' in resumed.question) && !('solution' in resumed.question) && !('steps' in resumed.question), 'and it still carries no answer or solution');

  const exam = await refused(api.post('/exams', { length: 10, minutes: 30, year: 10 }));
  eq([exam?.status, exam?.code], [401, 'SIGN_IN_TO_CHECK'], 'an exam paper does not start signed out');
  eq(checkRefusalCopy(checkRefusal(exam), 'exam')?.titleKey, 'check.examSignInTitle', 'and the exam page offers the sign-in for it');
  // Opened with no connection, the question is a draft of the device's own.
  const draft = await online.offline(() => api.post('/practice/next', { resume: false }));
  eq(draft.question.checkState, 'draft', 'with no connection the question served is an offline draft');
  const draftBefore = JSON.stringify(await idb.get('questions', draft.question.id));
  const draftSubmit = await refused(api.post(`/practice/${draft.question.id}/submit`, { answer: '1', ms: 900, submissionId: recovery.newSubmissionId() }));
  eq([draftSubmit?.status, draftSubmit?.code], [409, 'QUESTION_NOT_SERVER_ISSUED'], 'a draft is refused as never the server\'s question, even once the connection is back');
  eq(checkRefusal(draftSubmit), 'new-question', 'and the card reads that as: open a new question');
  eq(JSON.stringify(await idb.get('questions', draft.question.id)), draftBefore, 'nothing is spent on it');
  drafts.setDraftProfile(null);
  await online.close();
}

// ── 6 · 7 · Mounted ──────────────────────────────────────────────────────────
{
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  // A server render reports useLayoutEffect once per tree; it is not a finding.
  const realError = console.error;
  console.error = (...args) => { if (!/useLayoutEffect does nothing on the server/.test(String(args[0]))) realError(...args); };
  const server = await createServer({
    root, configFile: false, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
    plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
  });
  try {
    const i18n = await server.ssrLoadModule('/src/i18n/index.js');
    await i18n.setLanguage('en');
    const { AppCtx } = await server.ssrLoadModule('/src/App.jsx');
    const { default: QuestionCard } = await server.ssrLoadModule('/src/components/QuestionCard.jsx');
    const { CheckRefusal, CheckSignIn } = await server.ssrLoadModule('/src/components/CheckRefusal.jsx');
    const noop = () => {};
    const app = user => ({ user, celebrate: noop, refreshUser: noop, refreshDue: noop, refreshRecent: noop, toast: noop });
    const question = {
      id: 'q-online-1', answerType: 'numeric', prompt: 'Find the area enclosed between $y = x^2$ and $y = 7x$.',
      subtopic: 'c12-applications-integrals', subtopicName: 'Application of Integrals', difficulty: 3, diffLabel: 'Hard',
      hintsAvailable: 2, hintsUsed: 0, tutorLevel: 0, supportsSteps: true, criteria: [{ text: '1' }, { text: '2' }, { text: '3' }]
    };
    const card = (user, mode, props = {}) => {
      globalThis.localStorage.setItem('pri-input-mode', mode);
      return renderToStaticMarkup(React.createElement(AppCtx.Provider, { value: app(user) }, React.createElement(QuestionCard, { question, ...props })));
    };
    const signedOut = { id: 'p-1', name: 'Asha', cloudLinked: false };
    const signedIn = { id: 'p-1', name: 'Asha', cloudLinked: true };
    const notice = html => /<div[^>]*data-check-needs-account[^>]*>[\s\S]*?<\/div>/.exec(html)?.[0] || '';

    for (const mode of ['type', 'write', 'photo']) {
      const html = card(signedOut, mode);
      ok(new RegExp(`data-mode="${mode}"`).test(html), `${mode}: the card is mounted in ${mode} mode`);
      const block = notice(html);
      ok(block && block.includes(en['check.needsAccount']), `${mode}: says plainly that checking needs a Pri account`);
      const button = /<button[^>]*data-check-sign-in[^>]*>([^<]*)<\/button>/.exec(block);
      ok(button && button[1] === en['check.signInAction'] && !/\sdisabled(=""|\s|>)/.test(button[0]), `${mode}: with the sign-in in the card, enabled`);
      ok(!/href="\/settings"/.test(block) && !/Account settings/.test(block), `${mode}: never a link to Settings`);
      ok(html.indexOf('data-check-needs-account') < html.indexOf('ws-actions') && html.indexOf('data-check-needs-account') > html.indexOf('ws-tools'), `${mode}: placed with the work, directly above the Submit bar`);
      ok(new RegExp(`<button[^>]*class="btn btn-primary"[^>]*>${en['verdict.submit']}</button>`).test(html), `${mode}: Submit is still the primary action`);
      ok(!/eval-card|verdict-title|data-outcome|solution-panel|eval-marks/.test(html), `${mode}: no verdict, marks or solution on an unchecked question`);
      ok(/data-phase="answering"/.test(html), `${mode}: the card is open for work`);
      const linked = card(signedIn, mode);
      ok(!/data-check-needs-account/.test(linked) && !/data-check-sign-in/.test(linked), `${mode}: a signed-in profile is not asked to sign in`);
    }
    const typeHtml = card(signedOut, 'type');
    ok(/<input[^>]*data-final-answer[^>]*>/.test(typeHtml) && !/<input[^>]*data-final-answer[^>]*\sdisabled/.test(typeHtml), 'signed out, the final answer can still be typed');
    ok(/<textarea[^>]*data-typed-working[^>]*>/.test(typeHtml) && !/<textarea[^>]*data-typed-working[^>]*\sdisabled/.test(typeHtml), 'and so can the working');
    ok(!/q-credit/.test(card(signedOut, 'type', { question: { ...question, hintsUsed: 1, tutorLevel: 1 } })), 'a practice question states no device credit figure');
    ok(!/data-check-needs-account/.test(card(signedOut, 'type', { diagnostic: { submitPath: '/placement/answer' } })), 'the placement check is not practice and shows no account notice');
    await i18n.setLanguage('hi');
    const hindi = card(signedOut, 'type');
    ok(hindi.includes(hi['check.needsAccount']) && hindi.includes(hi['check.signInAction']), 'the notice and its sign-in render in Hindi for a Hindi reader');
    await i18n.setLanguage('en');

    // The refusal itself, as the card's verdict and the exam page mount it.
    const refusal = (kind, props = {}) => renderToStaticMarkup(React.createElement(CheckRefusal, {
      kind, user: signedOut, refreshUser: noop, onRetry: noop, onNext: noop, ...props
    }));
    const signIn = refusal('sign-in');
    ok(signIn.includes(en['check.signInTitle']) && signIn.includes(en['check.notChecked']), 'sign in: the answer was not checked, and why');
    ok(/data-check-sign-in/.test(signIn) && !/href="\/settings"/.test(signIn) && !/data-check-retry/.test(signIn), 'sign in: the sign-in is here, with no Settings link and no blind retry');
    const reconnect = refusal('reconnect');
    ok(reconnect.includes(en['check.reconnectTitle']) && reconnect.includes(en['check.notChecked']) && reconnect.includes(en['check.reconnectHint']), 'reconnect: Pri could not reach the server and the working is still on the page');
    ok(new RegExp(`<button[^>]*data-check-retry[^>]*>${en['common.tryAgain']}</button>`).test(reconnect) && !/data-check-sign-in/.test(reconnect), 'reconnect: one Try again');
    ok(/data-check-retry[^>]*disabled/.test(refusal('reconnect', { busy: true })) || /disabled[^>]*data-check-retry/.test(refusal('reconnect', { busy: true })), 'which cannot be pressed twice while it runs');
    const email = refusal('verify-email');
    ok(email.includes(en['check.verifyEmailTitle']) && /<a[^>]*href="\/settings"[^>]*>Account settings<\/a>/.test(email), 'verify email: named, with the account page where it is cleared');
    const guardian = refusal('guardian');
    ok(guardian.includes(en['check.guardianTitle']) && /href="\/settings"/.test(guardian) && !/data-check-sign-in/.test(guardian), 'guardian consent: named, and not presented as a sign-in');
    const unavailable = refusal('question');
    ok(unavailable.includes(en['check.questionTitle']) && unavailable.includes(en['check.notChecked']), 'question: it cannot be checked right now, and the working is kept on the page');
    ok(new RegExp(`<button[^>]*data-check-next[^>]*>${en['practice.nextQuestion']}</button>`).test(unavailable) && /data-check-retry/.test(unavailable), 'question: Next question, or try again');
    ok(!/data-check-next/.test(reconnect), 'only that reason offers to leave the question');
    for (const kind of Object.values(CHECK_REFUSAL)) {
      const html = refusal(kind);
      ok(new RegExp(`data-check-refusal="${kind}"`).test(html) && !/marks|XP|Correct|solution/i.test(html.replace(/<[^>]+>/g, ' ')), `${kind}: the refusal shows no verdict, marks, XP or solution`);
    }
    const exam = refusal('sign-in', { context: 'exam' });
    ok(exam.includes(en['check.examSignInTitle']) && exam.includes(en['check.examNotStarted']) && /data-check-sign-in/.test(exam), 'exam start: the paper has not started, with the sign-in in place');
    ok(refusal('reconnect', { context: 'exam' }).includes(en['check.examNotStarted']) && !refusal('reconnect', { context: 'exam' }).includes(en['check.notChecked']), 'exam start: reconnect speaks of the paper, not an answer');
    eq(refusal('nonsense'), '', 'an unknown reason renders nothing');
    const waiting = renderToStaticMarkup(React.createElement(CheckSignIn, { user: signedOut, refreshUser: noop, ready: false, waitText: 'wait-text' }));
    ok(/<button[^>]*data-check-sign-in[^>]*disabled/.test(waiting) && waiting.includes('wait-text'), 'while a handwritten page is still being saved, the sign-in waits and says why');
    await i18n.setLanguage('hi');
    ok(refusal('reconnect').includes(hi['check.reconnectTitle']) && refusal('reconnect').includes(hi['common.tryAgain']), 'the refusal renders in Hindi');
    await i18n.setLanguage('en');
  } finally {
    console.error = realError;
    await server.close();
  }
}

// ── 8 · Wiring ───────────────────────────────────────────────────────────────
{
  const card = read('src/components/QuestionCard.jsx');
  const between = (from, to) => card.slice(card.indexOf(from), card.indexOf(to, card.indexOf(from)));
  ok(!/deviceMarkedResponse|deviceRevealResponse|deviceGrade|serverIssued|data-grade-device/.test(card), 'the card accepts no device verdict and reads no serverIssued flag');
  ok(!/selfMarks|CriteriaTable/.test(card), 'and has no self-marked marks for practice');

  const deliver = between('async function deliver(', '/** The submit, reveal or walkthrough did not go through');
  ok(/if \(!diagnostic && !matchingGradeResponse\(r, question\.id, body\.submissionId\)\) \{[\s\S]{0,400}?throw new Error\(gradingReceiptMismatch\(language\)\);/.test(deliver), 'a practice submit is valid only as a matched server receipt');
  ok(/if \(definitiveSubmissionRefusal\(e\)\) \{ pendingRef\.current = null; clearPendingSubmission\(question\.id\); \}/.test(deliver), 'only a definitive refusal drops the submission key');
  ok(/refuseCheck\(e, 'submit'\);/.test(deliver), 'every other failure becomes the refused-check state');
  const caught = deliver.slice(deliver.indexOf('} catch (e) {'));
  ok(!/setAnswer\(|setWorking\(|setPhoto\(|clearDraft\(|clearInkDraft\(|setInkResult\(/.test(caught), 'a refused submit clears no answer, working, photo, draft or ink');
  ok(/if \(!diagnostic && recovering && legacyDeviceReplay\(r\)\) \{[\s\S]{0,600}?if \(r\.resolved === true\) onNext\?\.\(\);\s*return;/.test(deliver), 'an older version\'s device mark replayed at relaunch shows no result here');

  const submit = between('async function submit(', 'async function deliver(');
  ok(/const replay = pendingRef\.current\?\.contentKey === contentKey && pendingRef\.current\?\.sourceMode === sourceMode;\s*const submissionId = replay \? pendingRef\.current\.submissionId : newSubmissionId\(\);/.test(submit), 'the same answer through the same mode reuses the pending submission id');
  ok(/retryActionFor\(state\.res\.via\) === 'submit' \? \(\) => submit\(\)/.test(card), 'Retry on a refused submit is Submit again: same content, same id');
  ok(/retryActionFor\(state\.res\.via\) === 'reveal' \? \(\) => reveal\(true\)/.test(card), 'Retry on a refused reveal repeats the reveal the student already confirmed');

  const reveal = between('async function reveal(', 'async function toggleBookmark(');
  ok(/if \(!serverRevealReceipt\(r\)\) throw new Error\(gradingReceiptMismatch\(language\)\);\s*settleReveal\(r\);/.test(reveal), 'the solution opens only on the server\'s committed reveal');
  ok(/\} catch \(e\) \{[\s\S]{0,200}?refuseCheck\(e, 'reveal'\);/.test(reveal) && !/throw e;/.test(reveal), 'a refused reveal is shown in the card instead of being thrown away');
  ok(!/clearDraft\(|setAnswer\(|setWorking\(/.test(reveal), 'and it clears nothing the student typed');
  ok(/if \(confirmed !== true && !revealArmed\) \{ setRevealArmed\(true\); return; \}/.test(reveal), 'Show solution still takes two deliberate presses');

  ok(/if \(serverRevealReceipt\(r\)\) settleReveal\(r\);\s*else refuseCheck\(new Error\(gradingReceiptMismatch\(language\)\), 'tutor'\);/.test(card), 'the walkthrough ends the question only as a server reveal');
  ok(/onRefused=\{e => refuseCheck\(e, 'tutor'\)\}/.test(card), 'a refused walkthrough reaches the card');
  const tutor = read('src/tutor/TutorHelp.jsx');
  ok(/const refused = level === 3 \? checkRefusalCopy\(checkRefusal\(error\)\) : null;\s*if \(refused\) onRefused\?\.\(error\);/.test(tutor), 'the tutor hands a refused walkthrough to the card');

  ok(/setState\(s => \(s\.phase === 'retry' && s\.res\?\.refusal === 'sign-in' \? \{ phase: 'answering' \} : s\)\);/.test(card), 'signing in on the card returns it to the open question');
  const session = between('useEffect(() => onCloudSessionChange(event => {', '}), [user?.id]);');
  ok(/String\(event\.detail\.localProfileId\) === String\(user\?\.id\)/.test(session), 'only for this profile\'s own sign-in');
  ok(!/submit\(|deliver\(|setAnswer\(|setWorking\(|setPhoto\(/.test(session), 'and it neither submits on its own nor touches the answer, working or photo');

  ok(/const accountNeeded = !diagnostic && !resolved && needsAccountToCheck\(user\)/.test(card), 'the notice is shown before Submit, on an open practice question');
  ok(/&& !\(inkAccountBlocked && inkReaderState\?\.blocker === 'ink\.waitingSignIn'\)/.test(card) && /photoOCR\.blockedKey === 'verdict\.photoReadingSignIn'\)/.test(card), 'and gives way only to the ink or photo reader\'s own in-card sign-in');
  ok(/const checkSignInReady = !\(writeMode && inkHasStrokes\) \|\| saveState === 'saved';/.test(card), 'a handwritten page is linked to an account only after its IndexedDB readback');
  ok(/\{checkRefused \? \([\s\S]{0,200}?<CheckRefusal kind=\{checkRefused\}/.test(card), 'a refused check replaces the generic "not submitted" words');
  ok(/const placementGrade = diagnostic && resolved && !serverAuthoritative \?/.test(card) && /const shownGrade = committedGrade \|\| placementGrade;/.test(card), 'practice marks come only from an attested server receipt');
  ok(/\{helpUsed > 0 && !resolved && diagnostic && \(/.test(card), 'the card promises no hint-credit figure for a practice question');

  const exams = read('src/pages/Exams.jsx');
  ok(/const kind = checkRefusal\(err\);\s*if \(checkRefusalCopy\(kind, 'exam'\)\) setRefusal\(kind\);/.test(exams), 'the exam page reads the same refusal codes');
  ok(/<CheckRefusal kind=\{refusal\} context="exam" user=\{user\} refreshUser=\{refreshUser\} onRetry=\{start\} busy=\{busy\} \/>/.test(exams), 'and mounts the same sign-in / retry in place');
  ok((exams.match(/^\s*\{startRefused\}$/gm) || []).length === 2, 'in both the India and the general exam layouts');
  ok(/setRefusal\(kind => \(kind === 'sign-in' \? null : kind\)\)/.test(exams) && !/onCloudSessionChange[\s\S]{0,300}start\(\)/.test(exams), 'signing in clears the reason; the paper never starts on its own');

  const receipt = read('src/pages/practiceSessionReceipt.js');
  ok(/receipt\?\.authoritative !== true/.test(receipt) && !/device-question/.test(receipt), 'the session banner counts server receipts only');
  const practice = read('src/pages/PracticeBase.jsx');
  ok(/consumeSessionReceipt\(res, seenSessionAttempts\.current\)\)/.test(practice), 'and Practice passes it nothing else');
}

console.log(failures.length
  ? `ONLINE CHECK ACCESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `ONLINE CHECK ACCESS: PASS — ${pass}/${pass} checks — refusals named from their codes, in-card sign-in in Type, Write and Photo, no verdict on an unchecked answer, the same submission on Retry, and no device verdict accepted for practice.`);
process.exit(failures.length ? 1 : 0);
