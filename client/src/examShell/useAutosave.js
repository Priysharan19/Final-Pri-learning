// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exam shell's autosave (F4 §1.1)
//
// The save chain the marked exam room has always had (ExamRoom.jsx), as a
// piece both modes can use:
//   · every change is saved a moment later (`debounceMs`, 600 ms);
//   · saves run ONE AT A TIME, in order: a newer save never overtakes an older
//     one, so what reaches the server last is what the student did last;
//   · a page that is being hidden or closed saves at once (`urgent`), because
//     it may never come back; coming back, regaining focus or the network
//     saves again, which is also how the page re-learns the server's time;
//   · a heartbeat (`heartbeatMs`, 30 s) bounds how long anything can go unsent
//     or unseen;
//   · leaving the page inside the app saves at once too (reason 'leave').
//
// `send({ urgent, reason })` is the caller's: it sends whatever is outstanding
// and resolves, or rejects when it could not. It may resolve `{ more: true }`
// to be called again straight away. The state it leaves is what the status
// line says: 'saving', 'saved', or 'unsaved' (not saved — kept on this device).
//
// createAutosave is the framework-free core (client/test/desk-ui-check.mjs
// drives it with a fake timer); useAutosave binds it to the page's lifecycle.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';

export const SAVE_DEBOUNCE_MS = 600;
export const HEARTBEAT_MS = 30000;

export function createAutosave({ send, onState = () => {}, debounceMs = SAVE_DEBOUNCE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let chain = Promise.resolve();
  let queued = 0;
  let stopped = false;
  const cancel = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  const flush = (urgent = false, reason = 'change') => {
    cancel();
    if (stopped) return chain;
    // At most one save waits behind the one in flight: it will send whatever
    // is outstanding when its turn comes, so a second waiting save adds nothing
    // (and a slow network cannot build a backlog that bursts on recovery).
    if (queued >= 2) return chain;
    queued++;
    onState('saving');
    chain = chain.catch(() => {}).then(() => send({ urgent: urgent === true, reason })).then(result => {
      queued--;
      if (result?.more === true && !stopped) { flush(false, 'more'); return; }
      if (!queued) onState('saved');
    }, () => {
      queued--;
      if (!queued) onState('unsaved');
    });
    return chain;
  };
  const schedule = () => {
    if (stopped) return;
    cancel();
    // An unsaved change is never shown as saved, even for the debounce window.
    onState('saving');
    timer = setTimer(() => { timer = null; flush(); }, debounceMs);
  };
  // Stopping (the page is being left): what is outstanding is sent now, once.
  const stop = ({ leave = false } = {}) => { if (leave && !stopped) flush(true, 'leave'); stopped = true; cancel(); };
  // A page can be torn down and set up again without being left (React's development double-mount): saving resumes.
  const start = () => { stopped = false; };
  return { schedule, flush, stop, start, settled: () => chain.catch(() => {}) };
}

export function useAutosave({ send, debounceMs = SAVE_DEBOUNCE_MS, heartbeatMs = HEARTBEAT_MS, enabled = true }) {
  const [state, setState] = useState('idle');
  const latest = useRef(send);
  latest.current = send;
  const saver = useMemo(() => createAutosave({ send: options => latest.current(options), onState: setState, debounceMs }), [debounceMs]);
  // Leaving the page inside the app (no pagehide fires): save now.
  const started = useRef(false);
  started.current = enabled;
  useEffect(() => { saver.start(); return () => saver.stop({ leave: started.current }); }, [saver]);
  useEffect(() => {
    if (!enabled) return undefined;
    const onVisibility = () => { if (document.visibilityState === 'hidden') saver.flush(true, 'hidden'); else saver.flush(false, 'visible'); };
    const onPageHide = () => saver.flush(true, 'hidden');
    const onOnline = () => saver.flush(false, 'online');
    const onFocus = () => saver.flush(false, 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    const beat = setInterval(() => saver.flush(false, 'heartbeat'), heartbeatMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      clearInterval(beat);
    };
  }, [saver, enabled, heartbeatMs]);
  return { state, schedule: saver.schedule, flush: saver.flush, settled: saver.settled };
}

/** The i18n key of the status line for a save state. */
export const saveStateKey = state => (state === 'saving' ? 'shell.saving' : state === 'unsaved' ? 'shell.unsaved' : state === 'saved' ? 'shell.saved' : null);
