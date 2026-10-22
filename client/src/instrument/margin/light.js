// A "Spatial"'s single key light. The pointer (never the Pencil) or, once the
// student allows it on iOS, device tilt steers --lx/--ly, the specular origin
// the .c-rim ring reads. Smoothed at k = 0.08 a frame with a slow drift. It
// stops when the page is hidden and is fixed under Reduce Motion. One loop
// per document; start() returns a stop function.

import { reduced } from './motion.js';

export function lightAt(x, y, drift = 0) {
  return { lx: 30 - x * 40 - drift * 60, ly: -10 - y * 30 };
}

let running = null;
export function startLight(root = document.documentElement) {
  if (running) return running;
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let raf = 0; const t0 = performance.now();
  const put = ({ lx, ly }) => { root.style.setProperty('--lx', `${lx.toFixed(1)}%`); root.style.setProperty('--ly', `${ly.toFixed(1)}%`); };
  const onMove = e => { if (e.pointerType === 'pen') return; tgt.x = (e.clientX / innerWidth) * 2 - 1; tgt.y = (e.clientY / innerHeight) * 2 - 1; loop(); };
  const onTilt = e => { if (e.gamma == null) return; tgt.x = Math.max(-1, Math.min(1, e.gamma / 25)); tgt.y = Math.max(-1, Math.min(1, (e.beta - 40) / 25)); loop(); };
  const frame = now => {
    raf = 0;
    if (document.hidden) return;
    if (reduced()) { put(lightAt(0, 0)); return; }
    cur.x += (tgt.x - cur.x) * 0.08; cur.y += (tgt.y - cur.y) * 0.08;
    put(lightAt(cur.x, cur.y, Math.sin((now - t0) / 4200) * 0.08));
    // Keep easing while still travelling toward the target; otherwise rest
    // (the drift alone does not justify a 60Hz loop).
    if (Math.abs(tgt.x - cur.x) > 0.002 || Math.abs(tgt.y - cur.y) > 0.002) loop();
  };
  function loop() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  const onVis = () => { if (!document.hidden) loop(); };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  // Tilt needs a permission prompt on iOS; enableTilt() must run from a tap.
  const enableTilt = async () => {
    const D = window.DeviceOrientationEvent;
    if (!D) return false;
    if (typeof D.requestPermission === 'function' && (await D.requestPermission().catch(() => 'denied')) !== 'granted') return false;
    addEventListener('deviceorientation', onTilt);
    return true;
  };
  put(lightAt(0, 0)); loop();
  const stop = () => { cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); removeEventListener('deviceorientation', onTilt); document.removeEventListener('visibilitychange', onVis); running = null; };
  running = Object.assign(stop, { enableTilt });
  return running;
}
