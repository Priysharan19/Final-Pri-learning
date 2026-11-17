import { flushSync } from 'react-dom';

// Focus push (UI6): going *into* something (a chapter's practice, a Notes
// chapter) pushes the plane behind back and the new plane rises. Only the
// listed "into" navigations call this; switching tabs stays an instant cut.
// No library: the platform's document.startViewTransition where it exists,
// a plain navigation where it does not, and a plain navigation under Reduce
// Motion. The exam room and the desk never push (their clock never animates).

const NEVER = /^\/(exam|desk)(\/|$|\?)/;
const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Whether a push may run for this destination, here and now. */
export function canPush(to, doc = globalThis.document) {
  const path = typeof to === 'string' ? to : `${to?.pathname || ''}`;
  const here = globalThis.location?.pathname || '/';
  return !!doc && typeof doc.startViewTransition === 'function' && !reduced() && !NEVER.test(path) && !NEVER.test(here);
}

/** Navigate with the push. `navigate` is react-router's; the result is whatever a plain call would be. */
export function navigateInto(navigate, to, options) {
  const doc = globalThis.document;
  if (!canPush(to, doc)) return navigate(to, options);
  const root = doc.documentElement;
  root.dataset.vt = 'in';
  const transition = doc.startViewTransition(() => { flushSync(() => navigate(to, options)); });
  const clear = () => { if (root.dataset.vt === 'in') delete root.dataset.vt; };
  transition.finished?.then(clear, clear);
  return undefined;
}

/** A navigate function that pushes: for links that go into something. */
export const pushing = navigate => (to, options) => navigateInto(navigate, to, options);
