import { useEffect, useRef } from 'react';

// The Aurora skin's light pool (ported from #655, commit 70026a687; one pool
// in the edition's light since Lit Instrument D3): a soft pool of light on the
// desk, drifting on the compositor (transform only). App.jsx mounts this only where no question, ink or review surface is
// in view — the Index, the Map and Settings — and only when the setting's
// skin is 'aurora'. While mounted it marks <html data-aurora-pools> so those
// pages drop their own backdrop (aurora.css), and every surface holding
// mathematics stays opaque. The drift pauses while the page is hidden and does
// not run under Reduce Motion; nothing is drawn in forced colours or under
// Reduce Transparency. Decorative: hidden from assistive technology.

export default function Aurora() {
  const ref = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-aurora-pools', '');
    const el = ref.current;
    const sync = () => { if (el) for (const i of el.children) i.style.animationPlayState = document.hidden ? 'paused' : ''; };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); root.removeAttribute('data-aurora-pools'); };
  }, []);
  return (
    <div ref={ref} className="a-aurora" aria-hidden="true" data-aurora-pools>
      <i />
    </div>
  );
}
