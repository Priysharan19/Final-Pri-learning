import React, { useLayoutEffect, useRef } from 'react';
import { detent, flip, reduced, rot } from './motion.js';
import { startLight } from './light.js';

async function flipSeq(win, values, gap = 60, alive = () => true) {
  for (const v of values) {
    if (!alive() || !win.isConnected) return;
    await flip(win, v).finished;
    if (!reduced()) await new Promise(r => setTimeout(r, gap * 0.4));
  }
}

// The Index centrepiece (direction C, "Examiner's Chronograph"): an engraved
// register dial whose two hands are the student's own evidence, nothing else.
//   · long hand: accuracy over every answer, only once the floor allows it to
//     be stated (otherwise the hand rests at 0 and the window reads —);
//   · short hand: the share of the syllabus's chapters with any answer.
// No streak, no "today" target: Pri never puts the student on a clock.
// The seconds hand beats at 6 Hz for ten seconds after the hero and then
// rests, so the dial costs the main thread nothing at idle. The arrival plays
// once per page load (a visit to the app, not each return to the tab); Reduce
// Motion draws the final frame straight away.

const NS_C = 200;
const rad = d => ((d - 90) * Math.PI) / 180;
const pt = (r, deg) => [NS_C + r * Math.cos(rad(deg)), NS_C + r * Math.sin(rad(deg))];

let guillocheCache = null;
function guilloche() {
  if (guillocheCache) return guillocheCache;
  const ring = (R, amp, k, count, N) => {
    let d = '';
    for (let j = 0; j < count; j++) {
      const ph = (j * 2 * Math.PI) / count;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * 2 * Math.PI;
        const r = R + amp * Math.sin(k * t + ph) + amp * 0.35 * Math.sin((k * 2 + 1) * t - ph * 2);
        d += `${i ? 'L' : 'M'}${(NS_C + r * Math.cos(t)).toFixed(1)} ${(NS_C + r * Math.sin(t)).toFixed(1)}`;
      }
      d += 'Z';
    }
    return d;
  };
  guillocheCache = ring(108, 2.6, 36, 18, 360) + ring(74, 2.2, 28, 16, 280) + ring(40, 1.8, 16, 12, 180);
  return guillocheCache;
}

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  const [x1, y1] = pt(182, i * 6); const [x2, y2] = pt(major ? 166 : 174, i * 6);
  return { x1, y1, x2, y2, w: major ? (i % 15 === 0 ? 2.2 : 1.4) : 0.5 };
});
// A percentage scale: 12 o'clock reads 100 (and is 0), as on the reference. 30 is left out because the
// date window sits on it, as on the reference dial.
const NUMERALS = [10, 20, 40, 50, 60, 70, 80, 90, 100].map(p => {
  const [x, y] = pt(150, p * 3.6);
  return { p, x, y: y + 5, size: p % 50 === 0 ? 22 : 14 };
});

function Dauphine({ len, w, hand }) {
  return (
    <g className="m-dial-hand" ref={hand}>
      <polygon points={`${NS_C},${NS_C + len * 0.12} ${NS_C - w},${NS_C} ${NS_C},${NS_C - len}`} fill="var(--c-hand)" />
      <polygon points={`${NS_C},${NS_C + len * 0.12} ${NS_C + w},${NS_C} ${NS_C},${NS_C - len}`} fill="var(--c-hand-2)" />
    </g>
  );
}

let playedThisPageLoad = false;

export default function IndexDial({ accuracy, covered, label, caption, ariaLabel }) {
  const svg = useRef(null);
  const lit = useRef(null);
  // A's key light, scoped to the dial: written on the whole document, every
  // pointer move restyled the page (traced: the cause of ⌘K's first-open drops).
  useLayoutEffect(() => startLight(lit.current), []);
  const bezel = useRef(null);
  const minute = useRef(null);
  const hour = useRef(null);
  const win = useRef(null);
  const reading = accuracy == null ? '—' : String(accuracy);
  const toMin = accuracy == null ? 0 : accuracy * 3.6;
  const toHour = covered * 3.6;

  useLayoutEffect(() => {
    const first = !playedThisPageLoad && !reduced();
    playedThisPageLoad = true;
    if (!first) {
      minute.current.style.transform = `rotate(${toMin}deg)`;
      hour.current.style.transform = `rotate(${toHour}deg)`;
      win.current.replaceChildren(Object.assign(document.createElement('span'), { textContent: reading }));
      return undefined;
    }
    let live = true; let timer = 0;
    const ticks = svg.current.querySelectorAll('.m-dial-tick');
    bezel.current.animate?.([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 800, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'backwards' });
    ticks.forEach((t, i) => t.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 90, delay: 150 + i * 8, fill: 'backwards' }));
    rot(minute.current, -300, toMin, { dur: 1300, delay: 300, overshoot: 3 });
    rot(hour.current, -200, toHour, { dur: 1200, delay: 400, overshoot: 2 });
    // The window counts up to the reading by calendar flip, in five steps.
    if (accuracy == null) win.current.replaceChildren(Object.assign(document.createElement('span'), { textContent: '—' }));
    else {
      const steps = [0.17, 0.41, 0.65, 0.82, 0.93].map(f => String(Math.round(accuracy * f))).concat(reading);
      timer = setTimeout(() => { if (live) flipSeq(win.current, steps, 60, () => live && prev.current.reading === reading); }, 700);
    }
    return () => { live = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Later changes (the evidence arriving after paint) step there in detents.
  const prev = useRef({ toMin, toHour, reading });
  useLayoutEffect(() => {
    const p = prev.current;
    // New evidence mid-arrival: land the arrival first so the hands never fight.
    if (p.toMin !== toMin || p.toHour !== toHour || p.reading !== reading) {
      [minute.current, hour.current].forEach(h => h?.getAnimations?.().forEach(a => a.finish()));
    }
    if (p.toMin !== toMin) detent(minute.current, p.toMin, toMin, 4);
    if (p.toHour !== toHour) detent(hour.current, p.toHour, toHour, 4);
    if (p.reading !== reading) flipSeq(win.current, [reading]);
    prev.current = { toMin, toHour, reading };
  }, [toMin, toHour, reading]);

  return (
    <figure className="m-dial" data-instrument-dial>
      <p className="sr-only">{ariaLabel}</p>
      <div className="m-dial-box c-rim" ref={lit}>
        <svg ref={svg} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
          <circle cx="200" cy="200" r="197" fill="var(--c-bezel)" stroke="var(--c-bezel-2)" strokeWidth="1" />
          <circle ref={bezel} cx="200" cy="200" r="190" fill="none" stroke="var(--c-dial-line)" strokeWidth=".5" pathLength="1" strokeDasharray="1" />
          <circle cx="200" cy="200" r="186" fill="var(--c-dial)" />
          <path className="m-dial-guil" d={guilloche()} fill="none" stroke="var(--c-dial-line)" strokeWidth=".35" vectorEffect="non-scaling-stroke" />
          <circle cx="200" cy="200" r="122" fill="none" stroke="var(--c-dial-line)" strokeWidth=".5" />
          <circle cx="200" cy="200" r="126" fill="none" stroke="var(--c-dial-line)" strokeWidth=".25" />
          <circle cx="200" cy="200" r="182" fill="none" stroke="var(--c-dial-line)" strokeWidth=".4" />
          <circle cx="200" cy="200" r="174" fill="none" stroke="var(--c-dial-line)" strokeWidth=".3" />
          {TICKS.map((t, i) => <line key={i} className="m-dial-tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--c-dial-line)" strokeWidth={t.w} />)}
          {NUMERALS.map(n => <text key={n.p} x={n.x} y={n.y} textAnchor="middle" className="m-dial-num" fontSize={n.size}>{n.p}</text>)}
          <text x="200" y="262" textAnchor="middle" className="m-dial-num" fontSize="22">P′</text>
          <text x="200" y="280" textAnchor="middle" className="m-dial-sc">{label}</text>
          <Dauphine len={96} w={7} hand={hour} />
          <Dauphine len={158} w={6} hand={minute} />
          <circle cx="200" cy="200" r="5" fill="var(--c-hand)" />
          <circle cx="200" cy="200" r="2" fill="var(--c-lume)" />
        </svg>
        <svg className="m-dial-sec" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
          <line x1="200" y1={200 + 170 * 0.24} x2="200" y2={30} stroke="var(--c-lume)" strokeWidth=".9" strokeLinecap="round" />
          <circle cx="200" cy={200 + 170 * 0.2} r="2.4" fill="none" stroke="var(--c-lume)" strokeWidth=".9" />
        </svg>
        <span className="m-datewin" aria-hidden="true"><span className="m-flip" ref={win}><span>{reading}</span></span></span>
      </div>
      <figcaption className="m-dial-cap">{caption}</figcaption>
    </figure>
  );
}
