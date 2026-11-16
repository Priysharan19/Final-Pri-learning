// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · page links decide push or replace from the real URL
//
// React Router's <Link> replaces instead of pushing when its target equals the
// router's current location. That location is React state: after a Back press
// `window.location` changes at once, but the router only learns of it on the
// next render, which on a slow phone can be hundreds of ms later. A nav tap in
// that window (Back from /practice to /, then Practice before Home has drawn)
// made the Link believe it was already on /practice and REPLACE the Home entry
// (idx 0). The page then correctly said it had nothing to go Back to
// (backNavigation.js reads history.state.idx), so the next Back left the app.
//
// The decision is therefore made at click time from `window.location`: a tap
// on the page you are genuinely on replaces (no duplicate entry); anything
// else pushes.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = 'http://pri.invalid';

/** pathname + search + hash, normalised the way the browser would store it. */
function pathOf(to) {
  const target = typeof to === 'string' ? to : `${to?.pathname || ''}${to?.search || ''}${to?.hash || ''}`;
  const url = new URL(target, ORIGIN);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Is `to` the URL the browser is showing right now? */
export function isCurrentUrl(to, win = globalThis.window) {
  const loc = win?.location;
  if (!loc) return false;
  return pathOf(to) === pathOf(`${loc.pathname || '/'}${loc.search || ''}${loc.hash || ''}`);
}

const isModified = e => !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey);

/** The click handler a page link uses. Mirrors React Router's own guard
 * (left click, same tab, no modifier, not already handled), then navigates
 * itself so the router's possibly-stale location never decides. */
export function pageLinkClick({ to, navigate, onClick, target, replace, state, win = globalThis.window }) {
  return event => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || (target && target !== '_self') || isModified(event)) return;
    event.preventDefault();
    navigate(to, { replace: replace ?? isCurrentUrl(to, win), state });
  };
}
