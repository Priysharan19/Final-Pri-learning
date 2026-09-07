import React, { useState } from 'react';
import { useApp } from '../App.jsx';
import { downloadJSON } from '../lib/files.js';
import { createPilotSummary, DEFAULT_COMPLETION_RULE } from '../local/pilotExport.js';

const DEFAULT_FROM = '2026-09-15';
const DEFAULT_TO = '2026-10-13';

export default function PilotEvidencePanel() {
  const { user, toast } = useApp();
  const [participant, setParticipant] = useState('');
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [baseline, setBaseline] = useState('');
  const [post, setPost] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.course !== 'in') return null;

  async function exportSummary() {
    setBusy(true);
    try {
      const summary = await createPilotSummary({
        participant: participant.trim().toUpperCase(),
        from,
        to,
        baseline: baseline === '' ? null : Number(baseline),
        post: post === '' ? null : Number(post),
        completionRule: DEFAULT_COMPLETION_RULE
      });
      downloadJSON(summary, `pri-pilot-${summary.participant.toLowerCase()}-${from}-${to}.json`);
      toast(<span>Pilot evidence exported. It contains only the anonymous summary.</span>);
    } catch (error) {
      toast(<span>{error.message}</span>);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h2 style={{ marginBottom: 8 }}>Pilot evidence export</h2>
      <p className="sub" style={{ marginBottom: 14 }}>
        Only use this if you are participating in the approved Pri Learning India Student Impact pilot.
        The file contains an anonymous participant code and aggregate usage only. It excludes your name,
        email, Pri profile id, handwriting, images, answers and raw question history.
      </p>

      <div className="grid cols-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="pilot-participant">Anonymous participant ID</label>
          <input
            className="input"
            id="pilot-participant"
            value={participant}
            placeholder="S042"
            autoComplete="off"
            onChange={event => setParticipant(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="pilot-from">Pilot start</label>
          <input className="input" id="pilot-from" type="date" value={from} onChange={event => setFrom(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pilot-to">Pilot end</label>
          <input className="input" id="pilot-to" type="date" value={to} onChange={event => setTo(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pilot-baseline">Controlled baseline score (%)</label>
          <input className="input" id="pilot-baseline" type="number" min="0" max="100" step="0.01" value={baseline} onChange={event => setBaseline(event.target.value)} placeholder="Optional until assessed" />
        </div>
        <div className="field">
          <label className="label" htmlFor="pilot-post">Controlled post score (%)</label>
          <input className="input" id="pilot-post" type="number" min="0" max="100" step="0.01" value={post} onChange={event => setPost(event.target.value)} placeholder="Optional until assessed" />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
        Completion is fixed before recruitment as baseline + post assessment + at least {DEFAULT_COMPLETION_RULE.minimumActiveDays} active practice days.
        A retry on the same question instance is not counted as another attempted question.
      </p>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={exportSummary}>
        {busy ? 'Preparing…' : 'Export anonymous pilot summary'}
      </button>
    </div>
  );
}
