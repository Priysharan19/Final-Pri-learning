// When the working indicator may show (Lit Instrument D6). It is honest: it
// shows only while the caller's real work is pending, and only once that work
// has taken WORK_DELAY ms, so fast work shows nothing. Once shown it stays at
// least WORK_MIN ms so it never flashes, then fades for WORK_FADE ms ('out').
// emit(true | 'out' | false) reports each change. client/test/working-
// indicator-check.mjs drives this with fake timers.
export const WORK_DELAY = 400;
export const WORK_MIN = 480;
export const WORK_FADE = 120;

export function workingClock(emit) {
  let state = false, at = 0, timer;
  const go = (next, wait) => {
    const step = () => {
      state = next;
      if (next === true) at = Date.now();
      emit(next);
      if (next === 'out') go(false, WORK_FADE);
    };
    if (wait > 0) timer = setTimeout(step, wait); else step();
  };
  return {
    set(pending) {
      clearTimeout(timer);
      if (pending) {
        if (state === 'out') { state = true; emit(true); } else if (!state) go(true, WORK_DELAY);
      } else if (state === true) go('out', at + WORK_MIN - Date.now());
      else if (state === 'out') go(false, WORK_FADE);
    },
    stop: () => clearTimeout(timer)
  };
}
