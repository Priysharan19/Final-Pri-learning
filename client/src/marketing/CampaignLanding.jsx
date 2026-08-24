import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { captureCampaign, trackMarketing } from './attribution.js';
import './campaign.css';

const SYMBOLS = [
  ['∫', 7, 10, 32], ['π', 84, 8, 24], ['Σ', 77, 27, 30], ['√', 10, 38, 29],
  ['θ', 88, 48, 25], ['x²', 15, 67, 21], ['∞', 82, 74, 30], ['dy/dx', 7, 88, 18],
  ['±', 91, 91, 25], ['Δ', 53, 13, 24], ['=', 47, 89, 22], ['∂', 60, 69, 27],
];

function Brand() {
  return (
    <div className="campaign-brand" aria-label="Pri Learning">
      <span className="campaign-brand-p">P</span><span>ri Learning.</span>
    </div>
  );
}

function MathBackdrop() {
  return (
    <div className="campaign-mathfield" aria-hidden="true">
      {SYMBOLS.map(([symbol, left, top, size], i) => (
        <span key={`${symbol}-${i}`} style={{ left: `${left}%`, top: `${top}%`, fontSize: size }}>{symbol}</span>
      ))}
    </div>
  );
}

function ProductProof() {
  return (
    <div className="campaign-product" aria-label="Illustration of Pri Learning marking handwritten maths working">
      <div className="campaign-product-top">
        <Brand />
        <span>HSC ADVANCED · CALCULUS</span>
      </div>
      <div className="campaign-question">
        <span className="campaign-eyebrow">QUESTION</span>
        <p>Find the stationary points of</p>
        <strong>y = x³ − 6x² + 9x + 2</strong>
      </div>
      <div className="campaign-working">
        <span className="campaign-eyebrow">YOUR WORKING</span>
        <div className="campaign-ink-row"><i>dy/dx = 3x² − 12x + 9</i><b className="good">✓</b></div>
        <div className="campaign-ink-row"><i>0 = 3(x−1)(x−3)</i><b className="good">✓</b></div>
        <div className="campaign-ink-row"><i>x = 1, −3</i><b className="bad">×</b></div>
        <div className="campaign-feedback">
          <span>CHECK THE SIGN</span>
          <strong>x − 3 = 0, so x = 3</strong>
          <small>Your method is right. One sign slipped.</small>
        </div>
      </div>
      <div className="campaign-product-foot">
        <span>PRI INK · LIVE</span>
        <span>Tap to correct recognition when needed</span>
      </div>
    </div>
  );
}

const FEATURES = [
  ['Your working matters', 'Step Check can award method marks and put feedback against the reasoning, not only the final box.'],
  ['Practice adapts', 'Pri uses recent performance to choose what to practise next across Years 7–12 maths.'],
  ['Private by design', 'Profiles, progress and handwriting stay on the device. Once installed, the learning runtime works offline.'],
];

export default function CampaignLanding() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    captureCampaign();
    trackMarketing('landing_view', { surface: 'commercial_launch' });
  }, []);

  const openProfiles = () => {
    trackMarketing('cta_profile', { surface: 'hero' });
    window.location.assign('/');
  };

  const startDemo = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    trackMarketing('cta_demo', { surface: 'hero' });
    try {
      await api.post('/profiles/demo', {});
      trackMarketing('demo_started', { surface: 'commercial_launch' });
      window.location.assign('/');
    } catch (err) {
      setError(err?.message || 'The demo could not start on this device.');
      setBusy(false);
    }
  };

  return (
    <main className="campaign-page">
      <MathBackdrop />
      <header className="campaign-nav">
        <Brand />
        <button type="button" className="campaign-nav-link" onClick={openProfiles}>Open Pri Learning</button>
      </header>

      <section className="campaign-hero">
        <div className="campaign-copy">
          <div className="campaign-kicker">YEARS 7–12 · IPAD-FIRST MATHS PRACTICE</div>
          <h1>Write the working.<br /><em>Get feedback on the steps.</em></h1>
          <p className="campaign-lede">
            Pri Learning is built around the way maths is actually done: Apple Pencil working,
            on-device handwriting recognition, line-by-line feedback, HSC-style criteria and adaptive practice.
          </p>
          <div className="campaign-actions">
            <button type="button" className="campaign-primary" onClick={startDemo} disabled={busy}>
              {busy ? 'Opening demo…' : 'Try the live demo'}
            </button>
            <button type="button" className="campaign-secondary" onClick={openProfiles}>Create a local profile</button>
          </div>
          {error && <p className="campaign-error" role="alert">{error}</p>}
          <div className="campaign-trust" aria-label="Product highlights">
            <span><b>✓</b> Works offline after install</span>
            <span><b>✓</b> No student work uploaded</span>
            <span><b>✓</b> Built for Apple Pencil</span>
          </div>
        </div>
        <ProductProof />
      </section>

      <section className="campaign-proof" aria-label="Pri Learning coverage">
        <div><strong>7–12</strong><span>school years</span></div>
        <div><strong>252</strong><span>NSW syllabus dot points covered</span></div>
        <div><strong>344,798</strong><span>observed distinct question variants</span></div>
        <div><strong>Offline</strong><span>learning runtime</span></div>
      </section>

      <section className="campaign-features">
        <div className="campaign-section-head">
          <span className="campaign-kicker">WHY PRI LEARNING</span>
          <h2>Maths practice should understand more than an answer box.</h2>
        </div>
        <div className="campaign-feature-grid">
          {FEATURES.map(([title, body], i) => (
            <article key={title} className="campaign-feature">
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="campaign-final">
        <span className="campaign-kicker">PRI LEARNING</span>
        <h2>Your working matters.</h2>
        <p>Explore a ready-made demo profile without creating an account.</p>
        <button type="button" className="campaign-primary" onClick={startDemo} disabled={busy}>
          {busy ? 'Opening demo…' : 'Explore Pri Learning'}
        </button>
        <small>No cloud account required. Demo activity stays on this device.</small>
      </section>

      <footer className="campaign-footer">
        <Brand />
        <p>Adaptive Years 7–12 maths practice · built for iPad · local-first.</p>
      </footer>
    </main>
  );
}
