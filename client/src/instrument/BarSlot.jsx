import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// A page's own controls in the shared instrument bar (design s7: the Report's
// period switch; s8: the Scripts search). The bar renders an empty slot; a
// page wraps its controls in <BarSlot>, which portals them there on a wide
// screen. The state stays in the page. On a phone or a portrait iPad (900px
// and below), where the bar has no room for them, and whenever there is no
// bar, the controls render in place, as before.
// While the slot holds controls, the bar hides its ⌘K field and status (as the
// design's bar does); the ⌘K shortcut keeps working everywhere.

let slotEl = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());
export function setBarSlot(el) { if (el !== slotEl) { slotEl = el; notify(); } }
const subscribeSlot = fn => { listeners.add(fn); return () => listeners.delete(fn); };

const PHONE = '(max-width: 900px)';
const subscribePhone = fn => {
  const mq = window.matchMedia?.(PHONE);
  mq?.addEventListener?.('change', fn);
  return () => mq?.removeEventListener?.('change', fn);
};
const isPhone = () => !!window.matchMedia?.(PHONE).matches;

export default function BarSlot({ children }) {
  const el = useSyncExternalStore(subscribeSlot, () => slotEl, () => null);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  if (!el || phone) return children;
  return createPortal(children, el);
}
