// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk — /desk/:attemptId (ADR-0002 §8, plan F4b)
//
// The unmarked mode of the one examination system. A student sits a library
// paper under reading and working time, marks questions done or flagged, keeps
// typed notes, and closes the paper. NOTHING HERE IS MARKED, CHECKED OR SENT
// FOR CHECKING, and every screen says so in plain words ("Practice · not
// marked"). There is no answer box, no result, and no number that could be
// read as one.
//
// THE SERVER KEEPS THE CLOCK. The page sends intents ("pause") and shows the
// time derived from the server's own stamped event log; the device clock only
// carries the display between replies, corrected by the `now` each reply
// brings. A press made with no connection is queued and takes effect when the
// server receives it — the face says "offline estimate" until then.
//
// INTERRUPTIONS (F4 spec §3): a hidden page saves at once and re-reads the
// attempt when it returns; a reload paints from the device cache and is then
// replaced by the server's reply; edits made offline are kept on the device
// and sent as one save on reconnect; closing twice is one close.
//
// Built on the shared exam shell (client/src/examShell). Ships dark behind
// PRI_FEATURE_EXAM_DESK, and is reached from a library paper.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import { deriveClock, formatClock, questionTallies } from '../engine/deskClock.js';
import { safeExternalUrl } from '../library/libraryApi.js';
import QuestionNavigator from '../examShell/QuestionNavigator.jsx';
import QuestionNotes from '../examShell/QuestionNotes.jsx';
import ClockFace, { ElapsedRule } from '../examShell/ClockFace.jsx';
import ConfirmSheet from '../examShell/ConfirmSheet.jsx';
import ShortcutsSheet from '../examShell/ShortcutsSheet.jsx';
import PaperHeader from '../examShell/PaperHeader.jsx';
import { saveStateKey, useAutosave } from '../examShell/useAutosave.js';
import { useExamShortcuts } from '../examShell/useExamShortcuts.js';
import { useAnnounce } from '../examShell/useAnnounce.js';
import { deskApi, isAttemptId, newKey, unreachable } from './deskApi.js';
import { dropCache, dropOtherAccounts, linkedAccount, openDeskCache, readCache, sweepCache, writeCache } from './deskCache.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { changesOf, confirmQuestions, editQuestion, entryOf, fromCache, groupsOf, nextFlagged, overlay, projectEvents, sectionOf, settleSave, timeLedger } from './deskState.js';
import '../examShell/examShell.css';
import './desk.css';

const MINUTE = 60000;
// The i18n keys, written out so client/test/i18n-check.mjs can see each one.
const KIND_KEYS = Object.freeze({ 'multiple-choice': 'desk.kindChoice', 'extended-response': 'desk.kindExtended' });
const PHASE_LABEL = Object.freeze({ idle: 'desk.clockWorking', reading: 'desk.clockReading', ready: 'desk.clockWorking', working: 'desk.clockWorking' });
const ERROR_KEYS = Object.freeze({
  AUTH_REQUIRED: 'desk.signedOut', DESK_ATTEMPT_NOT_FOUND: 'desk.notFound', CLOUD_DISABLED: 'desk.needsConnection',
  GUARDIAN_CONSENT_PENDING: 'library.consentRequired', GUARDIAN_CONSENT_WITHDRAWN: 'library.consentRequired'
});
const errorKey = code => (Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : 'desk.loadFailed');
const minutesOf = ms => Math.max(1, Math.round(ms / MINUTE));
// Time on a question is measured on the page's monotonic clock, so changing
// the device's date or time cannot add to it.
// The server's time is pinned to the same clock (see adopt).
const tick = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The standing line of every desk screen. Exported for client/test/desk-ui-check.mjs. */
export function UnmarkedPlate({ t }) {
  return <p className="dk-plate" data-desk-unmarked>{t('desk.unmarked')}</p>;
}

/** The closed paper: a review desk and a time ledger — figures and the student's own flags, never a result. */
export function ClosedSummary({ t, attempt, clock, questions, groups, estimate, onNextFlagged, onAgain, onDelete, busy }) {
  const paper = attempt.paper;
  const tallies = questionTallies(questions, paper.questionCount);
  const ledger = timeLedger(paper, clock, questions, groups);
  const imported = attempt.origin === 'prithagoras-import';
  const exportedOn = imported && attempt.imported?.exportedAt
    ? new Date(attempt.imported.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <section className="dk-closed" aria-labelledby="dk-closed-title" data-desk-closed={imported ? 'imported' : 'closed'}>
      <h2 id="dk-closed-title">{t('desk.closedTitle')}</h2>
      <p>{t('desk.closedLead')}</p>
      {estimate && <p className="in-note" data-desk-estimate>{t('desk.closeQueued')}</p>}
      {imported && <p className="in-note" data-desk-imported>{exportedOn ? t('desk.importedOn', { date: exportedOn }) : t('desk.imported')}</p>}
      <dl className="dk-ledger">
        <div><dt>{t('desk.tallyLabel')}</dt><dd data-desk-tallies>{t('desk.tallies', { done: tallies.done, flagged: tallies.flagged, notes: tallies.notes })}</dd></div>
        {!imported && <div><dt>{t('desk.ledgerWorking')}</dt><dd>{t('desk.ledgerOf', { used: formatClock(ledger.workingMs), allotted: formatClock(ledger.allottedMs) })}</dd></div>}
        {!imported && ledger.readingMs > 0 && <div><dt>{t('desk.ledgerReading')}</dt><dd>{formatClock(ledger.readingMs)}</dd></div>}
        {!imported && ledger.overtimeMs > 0 && <div><dt>{t('desk.ledgerOver')}</dt><dd>+{formatClock(ledger.overtimeMs)}</dd></div>}
        {!imported && ledger.pausedMs >= 1000 && <div><dt>{t('desk.ledgerPaused')}</dt><dd>{t('desk.ledgerPausedNote', { time: formatClock(ledger.pausedMs) })}</dd></div>}
        {ledger.sections.filter(s => s.ms > 0).map(s => (
          // A section's own label, as the paper's publisher recorded it.
          <div key={s.label}><dt>{s.label}</dt><dd>{formatClock(s.ms)}</dd></div>
        ))}
        {ledger.longest.length > 0 && (
          <div><dt>{t('desk.ledgerLongest')}</dt><dd>{ledger.longest.map(x => t('desk.ledgerQuestion', { n: x.q, time: formatClock(x.ms) })).join(' · ')}</dd></div>
        )}
      </dl>
      <div className="dk-actions">
        {tallies.flagged > 0 && <button type="button" className="btn btn-primary" onClick={onNextFlagged} data-desk-next-flagged>{t('desk.nextFlagged')}</button>}
        <button type="button" className="btn btn-ghost" onClick={onAgain} disabled={busy} data-desk-again>{t('desk.again')}</button>
        <button type="button" className="btn btn-ghost" onClick={onDelete} data-desk-delete>{t('desk.delete')}</button>
      </div>
    </section>
  );
}

/** One attempt, one page: a different attempt is a fresh page, so nothing of one can land on another. */
export default function DeskPage() {
  const { attemptId } = useParams();
  return <Desk key={attemptId} attemptId={attemptId} />;
}

function Desk({ attemptId }) {
  const t = useT();
  const navigate = useNavigate();
  const [view, setView] = useState({ status: 'loading' });
  const live = useRef(view);
  const mounted = useRef(true);
  const [now, setNow] = useState(() => tick());
  const [current, setCurrent] = useState(1);
  const [sheet, setSheet] = useState(null); // 'close' | 'delete' | 'keys'
  const [clockHidden, setClockHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState(null);
  const notesRef = useRef(null);
  const entered = useRef({ q: 1, at: tick() });
  // 'hidden' while the page is in the background; 'returning' from the moment
  // it is shown again until the server has been heard from — so whatever
  // happened meanwhile is said as having happened "while you were away".
  const away = useRef(false);
  const said = useRef({ phase: null, five: false, over: false, roomy: false });
  const againKey = useRef(null);
  // Set when the page was deliberately emptied (the attempt was deleted, or
  // the account signed out): a reply still on its way must not bring it back
  // on screen or into the device cache.
  const gone = useRef(false);
  // Set when the attempt is known to have changed elsewhere and has not been
  // read since: every sync reads until one read succeeds.
  const behind = useRef(false);
  const { announce, region } = useAnnounce();

  /** Put a new state on screen and into the device cache (the cache only under the established account). */
  const commit = useCallback((patch, { persist = true } = {}) => {
    if (gone.current && patch.status !== 'error') return live.current;
    const next = { ...live.current, ...patch };
    live.current = next;
    if (mounted.current) setView(next);
    if (persist && next.attempt && next.accountId) {
      void writeCache(next.accountId, next.attempt.id, { attempt: next.attempt, serverNow: tick() + (next.offset || 0), pending: next.pending, intents: next.intents });
    }
    return next;
  }, []);

  /**
   * A reply from the server replaces what the page held; unconfirmed edits
   * stay laid over it. The server's `now` is pinned to the page's monotonic
   * clock, so changing the device's date or time moves nothing on screen.
   */
  const adopt = useCallback((reply, extra = {}) => {
    if (gone.current || reply?.attempt?.id !== attemptId) return live.current;
    const s = live.current;
    // A reply older than what a later reply already brought (a slow first read
    // overtaken by a save) is not put back on screen.
    if (s.synced && s.attempt && Number(reply.attempt.rev) < Number(s.attempt.rev)) return s;
    const pending = extra.pending ?? s.pending ?? {};
    if (away.current === 'returning') away.current = 'back';
    behind.current = false;
    return commit({
      status: 'ready', checking: false, synced: true, problem: null,
      attempt: reply.attempt, offset: Number(reply.now) - tick(),
      questions: overlay(reply.attempt.questions, pending, reply.attempt.paper.questionCount),
      pending, intents: s.intents || [], ...extra
    });
  }, [attemptId, commit]);

  // ── Time on each question ──────────────────────────────────────────────────
  // Counted while the question is on screen, the page is visible and working
  // time is running. Measured on this device and advisory: it feeds the time
  // ledger and nothing else.
  const clockAt = useCallback((s, at) => (s.attempt.state === 'finished'
    ? s.attempt.clock
    : deriveClock(s.attempt.paper, projectEvents(s.attempt.paper, s.attempt.events, s.intents), at + (s.offset || 0))), []);
  const accrue = useCallback(() => {
    const s = live.current;
    const { q, at } = entered.current;
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    entered.current = { q, at: visible ? tick() : null };
    if (!s.attempt || at === null) return;
    const clock = clockAt(s, tick());
    const spent = Math.round(tick() - at);
    if (clock.phase !== 'working' || !clock.running) return;
    if (spent < 1000) { entered.current.at = at; return; }
    commit(editQuestion(s.questions, s.pending, q, { ms: entryOf(s.questions, q).ms + spent }));
  }, [clockAt, commit]);

  // ── Talking to the server: one request at a time, in order ────────────────
  const sendPress = useCallback(async (press) => {
    for (let tries = 0; tries < 4; tries++) {
      try {
        const reply = await deskApi.clock(attemptId, press.intent, live.current.attempt.rev, press.early);
        adopt(reply, { intents: live.current.intents.slice(1) });
        return;
      } catch (err) {
        // The attempt moved on (a save here, or another device): read where it
        // stands and send the press again with that revision.
        if (err?.code === 'DESK_REV_STALE') { adopt(await deskApi.read(attemptId)); continue; }
        // Closed already, or the clock cannot do that from where it now stands:
        // the server's record is the answer, and the press is spent.
        if (err?.code === 'DESK_FINISHED' || err?.code === 'DESK_INTENT_NOT_ALLOWED') {
          adopt(await deskApi.read(attemptId), { intents: live.current.intents.slice(1) });
          return;
        }
        throw err;
      }
    }
    throw Object.assign(new Error('The attempt kept changing.'), { code: 'DESK_REV_STALE', status: 409 });
  }, [adopt, attemptId]);

  const sync = useCallback(async ({ reason }) => {
    if (!live.current.attempt) return undefined;
    accrue();
    try {
      let talked = false;
      while (live.current.intents.length) { await sendPress(live.current.intents[0]); talked = true; }
      const sent = changesOf(live.current.pending);
      if (Object.keys(sent).length) {
        const revBefore = live.current.attempt.rev;
        const reply = await deskApi.questions(attemptId, sent);
        const s = live.current;
        const settled = settleSave(s.questions, s.pending, sent, reply);
        // The confirmed entries are the server's now: they go into the kept
        // copy of the attempt too, so a reload with no connection still has them.
        commit({ ...settled, synced: true, checking: false, problem: null, offset: Number(reply.now) - tick(),
          attempt: { ...s.attempt, rev: reply.rev, questions: confirmQuestions(s.attempt.questions, reply.questions) } });
        talked = true;
        // The revision moved by more than this save: something else changed
        // the attempt (a clock press on another device). Read it.
        if (reply.rev !== revBefore + 1) behind.current = true;
      }
      // Known to be behind (now, or from a read that failed earlier): read
      // until a read succeeds, so the gap cannot be forgotten.
      if (behind.current) adopt(await deskApi.read(attemptId));
      // Nothing to send: on a heartbeat, a return or a reconnect, read the
      // attempt again — that is how the page re-learns the server's time.
      if (!talked && reason !== 'change' && reason !== 'leave') adopt(await deskApi.read(attemptId));
      if (Object.keys(changesOf(live.current.pending)).length) return { more: true };
      return undefined;
    } catch (err) {
      // Deleted on another device: there is nothing left to save to.
      if (err?.code === 'DESK_ATTEMPT_NOT_FOUND') { gone.current = true; if (live.current.accountId) void dropCache(live.current.accountId, attemptId); commit({ status: 'error', code: err.code, attempt: null }, { persist: false }); }
      else commit({ synced: false, problem: unreachable(err) ? 'offline' : err?.status === 401 ? 'signed-out' : 'failed' }, { persist: false });
      throw err;
    }
  }, [accrue, adopt, attemptId, commit, sendPress]);

  const ready = view.status === 'ready';
  const { state: saveState, schedule, flush } = useAutosave({ send: sync, enabled: ready });
  // Leaving the page (another screen of the app, another attempt): what is
  // unsent goes now, not after a debounce that will never fire.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Signed out of the account on this device while the desk is open (here or
  // in another tab): the device cache has been forgotten, so the page stops
  // and says to sign in, rather than claiming anything is kept.
  useEffect(() => onCloudSessionChange(event => {
    if (event?.detail?.connected === false) { gone.current = true; live.current = { ...live.current, attempt: null }; commit({ status: 'error', code: 'AUTH_REQUIRED', attempt: null }, { persist: false }); }
  }), [commit]);

  // While the server cannot be reached, try again every few seconds: unsent
  // notes and clock presses go as soon as it can, without waiting for the
  // browser to announce a connection (it does not always) or for the heartbeat.
  const unreached = ready && (view.problem === 'offline' || view.problem === 'failed');
  useEffect(() => {
    if (!unreached) return undefined;
    // A refused save (a busy server, a limit) is retried too, more slowly.
    const retry = setInterval(() => { void flush(false, 'retry').catch(() => {}); }, view.problem === 'failed' ? 15000 : 5000);
    return () => clearInterval(retry);
  }, [unreached, view.problem, flush]);
  // Said once when work starts being kept on the device only, not on every save.
  useEffect(() => { if (view.problem === 'offline') announce(t('shell.unsaved')); }, [view.problem, announce, t]);

  // ── Load: establish whose desk this is, then the device cache, then the server ──
  useEffect(() => {
    let alive = true;
    if (!isAttemptId(attemptId)) { commit({ status: 'error', code: 'DESK_ATTEMPT_NOT_FOUND' }, { persist: false }); return undefined; }
    (async () => {
      // WHO FIRST. Nothing is painted from the device until the account is
      // established: the server's answer, or — only when the server cannot be
      // reached — the account this device profile is linked to. A record kept
      // for any other account is never read into this page.
      let accountId = null;
      let online = true;
      try { accountId = await deskApi.account(); } catch (err) {
        if (!alive) return;
        if (!unreachable(err)) { commit({ status: 'error', code: err?.status === 401 ? 'AUTH_REQUIRED' : err?.code || null }, { persist: false }); return; }
        online = false;
        accountId = await linkedAccount();
      }
      openDeskCache();
      const kept = accountId ? await readCache(accountId, attemptId).catch(() => null) : null;
      if (!alive) return;
      if (kept) {
        commit({
          status: 'ready', checking: online, synced: false, problem: online ? null : 'offline', accountId, attempt: kept.attempt,
          // The server's time when this was kept, moved on by the time since.
          offset: (Number(kept.serverNow) || Date.now()) + Math.max(0, Date.now() - Number(kept.at || Date.now())) - tick(),
          pending: fromCache(kept.pending), intents: Array.isArray(kept.intents) ? kept.intents : [],
          questions: overlay(kept.attempt.questions, kept.pending, kept.attempt.paper.questionCount)
        }, { persist: false });
      }
      if (!online) { if (!kept) commit({ status: 'error', code: 'CLOUD_DISABLED' }, { persist: false }); return; }
      try {
        const reply = await deskApi.read(attemptId);
        if (!alive) return;
        // Whatever was typed or pressed while this was in flight is in the
        // page's own pending and queue, and stays there.
        adopt(reply, { accountId });
        const others = await sweepCache(accountId);
        if (alive && others) commit({ others }, { persist: false });
        if (alive && (live.current.intents.length || Object.keys(live.current.pending || {}).length)) void flush(false, 'online').catch(() => {});
      } catch (err) {
        if (!alive) return;
        if (kept && unreachable(err)) commit({ checking: false, synced: false, problem: 'offline' }, { persist: false });
        else {
          // Not this account's any more (deleted on another device): nothing of it stays on this device.
          if (err?.code === 'DESK_ATTEMPT_NOT_FOUND') { gone.current = true; void dropCache(accountId, attemptId); }
          commit({ status: 'error', code: err?.status === 401 ? 'AUTH_REQUIRED' : err?.code || null, attempt: null }, { persist: false });
        }
      }
    })();
    return () => { alive = false; };
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The clock on screen ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setInterval(() => setNow(tick()), 500);
    return () => clearInterval(timer);
  }, [ready]);
  useEffect(() => {
    let settle = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { away.current = 'hidden'; accrue(); return; }
      if (away.current === 'hidden') {
        away.current = 'returning';
        // If the server is not heard from, "while you were away" lapses.
        clearTimeout(settle);
        settle = setTimeout(() => { if (away.current === 'returning') away.current = false; }, 15000);
      }
      entered.current = { ...entered.current, at: tick() };
      setNow(tick());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(settle); document.removeEventListener('visibilitychange', onVisibility); };
  }, [accrue]);

  const attempt = ready ? view.attempt : null;
  const paper = attempt?.paper || null;
  const clock = useMemo(() => (attempt ? clockAt(view, now) : null), [attempt, view, now, clockAt]);
  const questions = view.questions || {};
  const groups = useMemo(() => (paper ? groupsOf(paper, kind => (Object.hasOwn(KIND_KEYS, kind) ? t(KIND_KEYS[kind]) : ''), t('shell.questions')) : []), [paper, t]);
  const finished = clock?.phase === 'finished';
  // Until the server has been heard from, the face is this device's projection, and says so.
  const estimate = ready && view.synced === false && !view.checking && attempt?.state !== 'finished';

  // Phase changes are said once, politely: reading time ending, five minutes
  // of working time left, working time ending (the paper stays open).
  useEffect(() => {
    // A hidden page says nothing: what happened while it was away is said once, when it returns.
    if (!clock || view.checking || document.visibilityState === 'hidden') return;
    const before = said.current;
    const wasAway = away.current !== false;
    if (before.phase === 'reading' && clock.phase === 'ready') announce(t(wasAway ? 'desk.sayReadingEndedAway' : 'desk.sayReadingEnded'));
    if (clock.phase === 'working') {
      if (clock.overtimeMs === 0) before.over = false;
      if (clock.remainingMs > 5 * MINUTE) { before.five = false; before.roomy = true; }
      if (clock.overtimeMs > 0 && !before.over) {
        before.over = true;
        if (before.phase !== null) announce(wasAway ? t('desk.sayOverAway', { count: minutesOf(clock.overtimeMs), n: minutesOf(clock.overtimeMs) }) : t('desk.sayOver'));
      } else if (clock.running && clock.overtimeMs === 0 && clock.remainingMs <= 5 * MINUTE && !before.five) {
        before.five = true;
        // Only a clock that was seen with more than five minutes can "reach" five.
        if (before.phase !== null && before.roomy) announce(t('desk.sayFiveLeft'));
      }
    }
    if (before.phase !== null && before.phase !== 'finished' && clock.phase === 'finished') announce(t('desk.sayClosed'));
    before.phase = clock.phase;
    if (away.current === 'back') away.current = false;
  }, [clock, view.checking, announce, t]);

  // ── The student's actions ─────────────────────────────────────────────────
  const select = useCallback((q) => {
    if (!paper) return;
    const to = Math.min(paper.questionCount, Math.max(1, q));
    // The note being typed is already in state under its own question; close
    // that question's time before the next one opens.
    accrue();
    entered.current = { q: to, at: tick() };
    setCurrent(to);
  }, [paper, accrue]);
  const edit = useCallback((q, change) => {
    const s = live.current;
    if (!s.attempt) return;
    commit(editQuestion(s.questions, s.pending, q, change));
    schedule();
  }, [commit, schedule]);
  const press = useCallback((intent, early = false) => {
    const s = live.current;
    if (!s.attempt) return;
    accrue();
    commit({ intents: [...live.current.intents, { intent, early, at: Math.round(tick() + (s.offset || 0)) }] });
    void flush(false, 'press').catch(() => {});
  }, [accrue, commit, flush]);

  const sheetOpen = sheet !== null;
  useExamShortcuts({
    ArrowLeft: () => select(current - 1),
    ArrowRight: () => select(current + 1),
    d: () => edit(current, { done: !entryOf(live.current.questions, current).done }),
    f: () => edit(current, { flagged: !entryOf(live.current.questions, current).flagged }),
    n: () => notesRef.current?.focus(),
    t: () => setClockHidden(h => !h),
    '?': () => setSheet('keys')
  }, { enabled: ready && !sheetOpen });

  const startAgain = async () => {
    setBusy(true); setStartError(null);
    againKey.current ||= newKey();
    try {
      const reply = await deskApi.start(attempt.resource.id, againKey.current);
      againKey.current = null;
      navigate(`/desk/${reply.attempt.id}`);
    } catch (err) {
      setStartError(unreachable(err) ? 'desk.needsConnection' : err?.code === 'DESK_PAPER_NOT_FOUND' ? 'desk.unlisted' : 'desk.startFailed');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deskApi.remove(attemptId);
      // Nothing of a deleted attempt is kept or written back.
      gone.current = true;
      live.current = { ...live.current, attempt: null, pending: {}, intents: [] };
      // After any write already on its way has landed, so it cannot put the record back.
      if (view.accountId) { await new Promise(done => setTimeout(done, 0)); await dropCache(view.accountId, attemptId); await dropCache(view.accountId, attemptId); }
      navigate(`/library/${attempt.resource.id}`);
    } catch (err) {
      setSheet(null);
      setStartError('desk.deleteFailed');
    } finally { setBusy(false); }
  };

  const back = <PageLink to={attempt ? `/library/${attempt.resource.id}` : '/library'} className="btn btn-ghost dk-back">{t('desk.back')}</PageLink>;
  if (view.status === 'loading') {
    return <div className="dk-page">{back}<UnmarkedPlate t={t} /><h1>{t('desk.name')}</h1><p role="status">{t('desk.loading')}</p></div>;
  }
  if (view.status === 'error') {
    return (
      <div className="dk-page" data-desk-error={view.code || 'unknown'}>
        {back}<UnmarkedPlate t={t} /><h1>{t('desk.name')}</h1>
        <p className="dk-honest" role="alert">{t(errorKey(view.code))}</p>
      </div>
    );
  }

  const entry = entryOf(questions, current);
  const section = sectionOf(groups, current);
  const tallies = questionTallies(questions, paper.questionCount);
  const paused = (clock.phase === 'reading' || clock.phase === 'working') && !clock.running;
  const over = clock.phase === 'working' && clock.overtimeMs > 0;
  const allotted = (clock.phase === 'reading' ? paper.readingMinutes : paper.workingMinutes) * MINUTE;
  const elapsed = clock.phase === 'reading' ? clock.elapsedReadingMs : clock.phase === 'working' || finished ? clock.elapsedWorkingMs : 0;
  const clockNote = estimate ? t('desk.estimate') : paused ? t('desk.paused') : over ? t('desk.overNote') : clock.phase === 'ready' ? t('desk.readyNote') : clock.phase === 'idle' ? t('desk.idleNote') : null;
  const saveKey = view.problem === 'signed-out' ? 'desk.signedOutKept' : view.problem === 'offline' || view.problem === 'failed' ? 'shell.unsaved'
    : view.checking ? 'desk.checking' : saveStateKey(saveState);
  const link = attempt.resource.listed ? safeExternalUrl(attempt.resource.url) : null;
  const shortcuts = [
    { keys: ['←', '→'], label: t('desk.keyMove') }, { keys: ['D'], label: t('desk.keyDone') }, { keys: ['F'], label: t('desk.keyFlag') },
    { keys: ['N'], label: t('desk.keyNotes') }, { keys: ['T'], label: t('desk.keyClock') }, { keys: ['?'], label: t('shell.shortcuts') }
  ];

  return (
    <div className="dk-page xs-room" data-desk-attempt={attempt.id} data-desk-phase={clock.phase} data-desk-running={clock.running ? 'true' : 'false'}
      data-desk-rev={attempt.rev} data-desk-queued={view.intents?.length || 0} data-desk-save={view.problem || saveState} data-desk-estimate={estimate ? 'true' : undefined}>
      <header className="xs-head">
        {back}
        <PaperHeader title={attempt.resource.title || paper.title} eyebrow={<UnmarkedPlate t={t} />}
          source={attempt.resource.source} attribution={attempt.resource.attribution} disclaimer={attempt.resource.disclaimer}
          note={attempt.resource.listed ? null : t('desk.unlisted')}
          link={link} linkLabel={link ? t('desk.openPaper', { source: attempt.resource.source }) : null} />
        <div className="xs-head-clock">
          <ol className="xs-phases" aria-label={t('desk.phases')}>
            {paper.readingMinutes > 0 && <li className={clock.phase === 'reading' ? 'is-on' : undefined} aria-current={clock.phase === 'reading' ? 'step' : undefined}>{t('desk.phaseReading', { time: formatClock(paper.readingMinutes * MINUTE) })}</li>}
            <li className={clock.phase === 'working' ? 'is-on' : undefined} aria-current={clock.phase === 'working' ? 'step' : undefined}>{t('desk.phaseWorking', { time: formatClock(paper.workingMinutes * MINUTE) })}</li>
          </ol>
          {!finished && (
            <ClockFace remainingMs={clock.remainingMs} overtimeMs={over ? clock.overtimeMs : 0} label={t(PHASE_LABEL[clock.phase])} note={clockNote}
              hidden={clockHidden} onToggle={() => setClockHidden(h => !h)} />
          )}
        </div>
      </header>
      {!finished && <ElapsedRule fraction={allotted ? elapsed / allotted : 0} tone={clock.phase === 'reading' ? 'reading' : null} />}
      {region}

      <p className="dk-status" data-desk-status>
        {saveKey && <span data-save-state={view.problem || saveState}>{t(saveKey)}</span>}
        {estimate && view.intents?.length > 0 && <span data-desk-estimate-note>{t('desk.estimateNote')}</span>}
        {over && <span data-desk-over>{t('desk.overLine', { count: minutesOf(clock.overtimeMs), n: minutesOf(clock.overtimeMs) })}</span>}
        {clock.phase === 'ready' && <span data-desk-ready>{t('desk.readyLine')}</span>}
      </p>
      {view.others > 0 && (
        <div className="dk-honest" data-desk-others>
          <p>{t('desk.othersKept')}</p>
          <button type="button" className="btn btn-ghost" onClick={async () => { await dropOtherAccounts(view.accountId); commit({ others: 0 }, { persist: false }); }}>{t('desk.othersRemove')}</button>
        </div>
      )}
      {startError && <p className="dk-honest" role="alert" data-desk-start-error>{t(startError)}</p>}

      {finished && (
        <ClosedSummary t={t} attempt={attempt} clock={clock} questions={questions} groups={groups} estimate={estimate} busy={busy}
          onNextFlagged={() => { const q = nextFlagged(questions, paper.questionCount, current); if (q) select(q); }}
          onAgain={startAgain} onDelete={() => setSheet('delete')} />
      )}

      <div className="xs-grid">
        <div className="xs-rail">
          <QuestionNavigator groups={groups} current={current} onSelect={select}
            stateOf={q => { const e = entryOf(questions, q); return { done: e.done, flagged: e.flagged, noted: !!e.note }; }} />
          <p className="in-note xs-tally" data-desk-tally>{t('desk.tallies', { done: tallies.done, flagged: tallies.flagged, notes: tallies.notes })}</p>
        </div>

        <section className="xs-qcol" aria-labelledby="dk-question-title">
          <h2 id="dk-question-title" data-desk-question={current}>{t('shell.q', { n: current })}</h2>
          {/* i18n-exempt-start: a section's own label, as the paper's publisher recorded it */}
          {section && groups.length > 1 && <p className="in-note">{section.label}{section.format ? ` · ${section.format}` : ''}</p>}
          {/* i18n-exempt-end */}
          <div className="xs-marks">
            <button type="button" className="btn btn-ghost" aria-pressed={entry.done} onClick={() => edit(current, { done: !entry.done })} data-desk-done>{t('desk.done')}</button>
            <button type="button" className="btn btn-ghost" aria-pressed={entry.flagged} onClick={() => edit(current, { flagged: !entry.flagged })} data-desk-flag>{t('desk.flag')}</button>
          </div>
          <div className="xs-step">
            <button type="button" className="btn btn-ghost" onClick={() => select(current - 1)} disabled={current <= 1}>{t('desk.previous')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => select(current + 1)} disabled={current >= paper.questionCount}>{t('desk.next')}</button>
          </div>

          {!finished && (
            <div className="dk-clock-actions" data-desk-controls>
              {clock.phase === 'idle' && paper.readingMinutes > 0 && <button type="button" className="btn btn-primary" onClick={() => press('begin-reading')} data-desk-intent="begin-reading">{t('desk.beginReading')}</button>}
              {(clock.phase === 'idle' || clock.phase === 'ready') && <button type="button" className={`btn ${clock.phase === 'ready' || paper.readingMinutes === 0 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => press('begin-working')} data-desk-intent="begin-working">{t('desk.beginWorking')}</button>}
              {clock.phase === 'reading' && <button type="button" className="btn btn-ghost" onClick={() => press('begin-working')} data-desk-intent="begin-working">{t('desk.skipReading')}</button>}
              {(clock.phase === 'reading' || clock.phase === 'working') && clock.running && <button type="button" className="btn btn-ghost" onClick={() => press('pause')} data-desk-intent="pause">{t('desk.pause')}</button>}
              {paused && <button type="button" className="btn btn-primary" onClick={() => press('resume')} data-desk-intent="resume">{t('desk.resume')}</button>}
              {clock.phase !== 'idle' && <button type="button" className="btn btn-ghost" onClick={() => setSheet('close')} data-desk-close>{t('desk.close')}</button>}
              {clock.phase === 'idle' && <p className="in-note">{t('desk.startNote')}</p>}
              {clock.phase === 'idle' && <button type="button" className="btn btn-ghost" onClick={() => setSheet('delete')} data-desk-delete>{t('desk.delete')}</button>}
            </div>
          )}
          <button type="button" className="btn btn-ghost dk-keys" onClick={() => setSheet('keys')}>{t('shell.shortcuts')}</button>
        </section>

        <section className="xs-sheet-col" aria-label={t('shell.notesFor', { n: current })}>
          <QuestionNotes q={current} text={entry.note} inputRef={notesRef} onText={text => edit(current, { note: text })} />
        </section>
      </div>

      <ConfirmSheet open={sheet === 'close'} title={t('desk.closeAsk')} cancelLabel={t('desk.keepGoing')} confirmLabel={t('desk.close')} testId="desk-close-sheet"
        onCancel={() => setSheet(null)} onConfirm={() => { setSheet(null); press('finish', clock.phase !== 'working'); }}>
        <p>{t('desk.closeBody')}</p>
        <p className="in-note">{t('desk.ledgerWorking')}: {t('desk.ledgerOf', { used: formatClock(clock.elapsedWorkingMs), allotted: formatClock(paper.workingMinutes * MINUTE) })} · {t('desk.tallies', { done: tallies.done, flagged: tallies.flagged, notes: tallies.notes })}</p>
      </ConfirmSheet>
      <ConfirmSheet open={sheet === 'delete'} title={t('desk.deleteAsk')} cancelLabel={t('desk.keepIt')} confirmLabel={t('desk.delete')} busy={busy} testId="desk-delete-sheet"
        onCancel={() => setSheet(null)} onConfirm={remove}>
        <p>{t('desk.deleteBody')}</p>
      </ConfirmSheet>
      <ShortcutsSheet open={sheet === 'keys'} onClose={() => setSheet(null)} shortcuts={shortcuts} />
    </div>
  );
}
