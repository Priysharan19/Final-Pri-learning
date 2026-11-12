// Pri Learning · a request that failed because the page is leaving is not "no
// connection".
//
// When the page navigates away (a reload, a typed address, a link out), the
// browser cancels its in-flight requests. WebKit rejects them — as a bare
// TypeError, exactly like a dropped connection — BEFORE the page is torn down,
// so the code waiting on them keeps running for a moment: a question being
// fetched falls back to an offline draft, and the draft is stored. The student
// comes back, online, to a question that "was opened without a connection" and
// can never be marked. (Chromium tears the page down first; the CI WebKit
// browser shard caught this, issue: the responsive-matrix flake.)
//
// `beforeunload` fires before any of that in every engine. After it, a failed
// request is held for a moment before anything is concluded from it: if the
// page really is going, it goes and nothing is written; if the navigation was
// cancelled (or the page comes back from the back-forward cache), the caller
// carries on exactly as it would have.

const HOLD_MS = 1500;

let leavingSince = 0;

/** Wire the page's lifecycle events (a no-op where there is no window). */
export function watchPageLeaving(target = typeof window !== 'undefined' ? window : null) {
  if (!target?.addEventListener) return () => {};
  const leaving = () => { leavingSince = Date.now(); };
  const back = () => { leavingSince = 0; };
  target.addEventListener('beforeunload', leaving);
  target.addEventListener('pageshow', back);
  return () => {
    target.removeEventListener('beforeunload', leaving);
    target.removeEventListener('pageshow', back);
  };
}

/** True while the page has said it is leaving (within the hold). */
export function pageIsLeaving(now = Date.now()) {
  return leavingSince > 0 && now - leavingSince < HOLD_MS * 4;
}

/**
 * Call before acting on a failed request as if the device were offline. While
 * the page is leaving it waits; a page that really unloads never resumes.
 * Resolves at once otherwise.
 */
export async function settleIfLeaving({ wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!pageIsLeaving()) return false;
  await wait(HOLD_MS);
  return true;
}

/** Test seam: forget any leaving signal. */
export function resetPageLeaving() { leavingSince = 0; }

watchPageLeaving();
