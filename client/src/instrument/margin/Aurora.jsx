import React, { useEffect, useRef } from 'react';

// The living aurora behind every instrument screen: three pools of light that
// drift on the compositor (transform only) and brighten with progress. Mount
// it once from the shell. `progress` is 0–1 from real evidence (or omitted);
// it never stands in for a figure. The drift pauses while the page is hidden
// and does not run under Reduce Motion (margin.css).

export default function Aurora({ progress }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const sync = () => { el.style.animationPlayState = document.hidden ? 'paused' : ''; for (const i of el.children) i.style.animationPlayState = document.hidden ? 'paused' : ''; };
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return (
    <div ref={ref} className="a-aurora" aria-hidden="true" style={{ '--a-progress': p }}>
      <i /><i /><i />
    </div>
  );
}
