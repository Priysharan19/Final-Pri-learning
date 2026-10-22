// The question clock's arithmetic, kept pure so it can be tested without a
// browser (client/test/question-clock-check.mjs).
//
// The clock shows whole seconds of elapsed wall time. It used to re-render on
// a free-running 1 s setInterval started in the same commit that fixed the
// start time, so every tick landed within a millisecond or two of a whole-second
// boundary of elapsed time. Ordinary timer jitter then decided whether a tick
// showed k or k−1: seconds repeated and skipped, and one late tick under load
// left the text unchanged for over two seconds. The fix keeps time and
// scheduling apart: the text is always derived from the wall clock at render,
// and the tick only asks for a render, aimed a little past the next boundary.

export const CLOCK_TICK_MARGIN_MS = 50;

export const clockText = ms => {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// How long until the shown second next changes, plus a margin so the render
// lands clearly after the boundary, never on it.
export const msToNextSecond = elapsedMs => {
  const e = Math.max(0, Number(elapsedMs) || 0);
  return 1000 - (e % 1000) + CLOCK_TICK_MARGIN_MS;
};
