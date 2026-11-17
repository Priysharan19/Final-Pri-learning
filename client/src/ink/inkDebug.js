// ?inkdebug=1: an owner-run measurement overlay for a real device. Off unless
// the page was opened with ?inkdebug=1. It shows what the page measured on the
// device it is running on and nothing else: pen-up handler time, long tasks and
// the pen's event rate. It is a measurement aid, never evidence by itself —
// numbers on a screenshot are the owner's own device run, labelled as such.
const on = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('inkdebug') === '1'; } catch { return false; } };
let cached = null;
const enabled = () => (cached === null ? (cached = on()) : cached);
export const inkDebugEnabled = enabled;

const state = { penUpMs: 0, penUpMax: 0, longTasks: 0, events: 0, firstEventAt: 0, rate: 0, strokes: 0 };
let box = null; let observer = null;

function paint() {
  if (!box) return;
  box.textContent = `ink debug (owner-run device measurement)\npen-up handler ${state.penUpMs.toFixed(1)} ms (max ${state.penUpMax.toFixed(1)})\nlong tasks ${state.longTasks}\nevents ${state.rate.toFixed(0)} /s\nstrokes ${state.strokes}`;
}

function ensure() {
  if (box || typeof document === 'undefined') return;
  box = document.createElement('pre');
  box.setAttribute('data-ink-debug', '');
  box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;background:#000c;color:#fff;border-radius:4px;pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  try {
    observer = new PerformanceObserver(list => { state.longTasks += list.getEntries().length; globalThis.__inkDebug = { ...state }; paint(); });
    observer.observe({ entryTypes: ['longtask'] });
  } catch { /* longtask is not offered everywhere (Safari): the handler time still is */ }
}

/** One pen-up handler took `ms`. */
export function recordPenUp(ms) {
  if (!enabled()) return;
  ensure();
  state.penUpMs = ms; state.penUpMax = Math.max(state.penUpMax, ms); state.strokes += 1;
  globalThis.__inkDebug = { ...state };
  paint();
}

/** A pen sample arrived (for the event rate). */
export function recordPenEvent(now) {
  if (!enabled()) return;
  state.events += 1;
  if (!state.firstEventAt) state.firstEventAt = now;
  const span = now - state.firstEventAt;
  if (span > 500) { state.rate = (state.events * 1000) / span; if (span > 2000) { state.events = 0; state.firstEventAt = now; } }
}
