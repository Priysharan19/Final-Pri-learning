import React, { useEffect, useMemo, useRef, useState } from 'react';
import InkAnswer from '../ink/InkAnswer.jsx';
import { nativeInk, nativeInkAvailable } from '../ink/native.js';
import {
  REAL_PENCIL_PROMPTS,
  assignedEvidenceSplit,
  buildCorpusFromPhysicalRun,
  buildPhysicalEvidenceRun,
  canonicalEvidenceWriter,
  criticalEvidenceTarget,
  makeEvidenceRunId,
  productionAuthorityOf
} from '../ink/productionEvidence.js';

const STORAGE = 'pri-ink-physical-evidence-setup-v1';

function savedSetup() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); }
  catch { return {}; }
}

function safeFile(value) {
  return String(value || '').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function cloneStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map(stroke => ({
    points: (Array.isArray(stroke?.points) ? stroke.points : []).map(point => ({ ...point }))
  }));
}

function shareJson(filename, value) {
  const content = JSON.stringify(value, null, 2);
  const nativeShare = window.webkit?.messageHandlers?.priShare;
  if (nativeShare) {
    nativeShare.postMessage({ filename, content });
    return;
  }
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function InkPhysicalEvidenceSession() {
  const nativeAvailable = nativeInkAvailable();
  const initial = useMemo(savedSetup, []);
  const [setup, setSetup] = useState({
    writerId: initial.writerId || '',
    deviceModel: initial.deviceModel || '',
    osVersion: initial.osVersion || '',
    pencil: initial.pencil || '',
    buildCommit: initial.buildCommit || '',
    appVersion: initial.appVersion || '',
    consent: false
  });
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [samples, setSamples] = useState([]);
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState('');
  const timingRef = useRef({ startedAt: null });

  const writer = canonicalEvidenceWriter(setup.writerId);
  const split = writer ? assignedEvidenceSplit(writer) : null;
  const prompt = REAL_PENCIL_PROMPTS[index] || null;
  const complete = Boolean(session && index >= REAL_PENCIL_PROMPTS.length);

  // Instrument, but never replace, the production recognisers. The wrapper only
  // timestamps the start of the exact calls InkAnswer already makes. Restoring
  // the original functions on unmount guarantees this hidden study route cannot
  // change ordinary Practice behaviour.
  useEffect(() => {
    if (!session || !nativeAvailable) return undefined;
    const originalFoundation = nativeInk.foundationRecognize;
    const originalRescue = nativeInk.recognize;
    const foundationProbe = function (...args) {
      timingRef.current.startedAt = performance.now();
      return originalFoundation.apply(nativeInk, args);
    };
    const rescueProbe = function (...args) {
      if (!Number.isFinite(timingRef.current.startedAt)) timingRef.current.startedAt = performance.now();
      return originalRescue.apply(nativeInk, args);
    };
    nativeInk.foundationRecognize = foundationProbe;
    nativeInk.recognize = rescueProbe;
    return () => {
      if (nativeInk.foundationRecognize === foundationProbe) nativeInk.foundationRecognize = originalFoundation;
      if (nativeInk.recognize === rescueProbe) nativeInk.recognize = originalRescue;
      timingRef.current.startedAt = null;
    };
  }, [session, nativeAvailable]);

  const update = (key, value) => setSetup(current => ({ ...current, [key]: value }));

  const start = () => {
    setError('');
    if (!nativeAvailable) {
      setError('Physical release evidence must run inside the native iPad package. Browser handwriting is not accepted.');
      return;
    }
    if (!writer || /@|\s|\.(COM|EDU|ORG)$/i.test(writer)) {
      setError('Use the assigned anonymous participant code, never a name, email or student identifier.');
      return;
    }
    if (!/^[0-9a-f]{7,40}$/i.test(setup.buildCommit.trim())) {
      setError('Enter the exact Git commit SHA of the iPad build being tested.');
      return;
    }
    if (![setup.deviceModel, setup.osVersion, setup.pencil, setup.appVersion].every(value => String(value || '').trim())) {
      setError('Device model, iPadOS, Pencil model and app version are required.');
      return;
    }
    if (!setup.consent) {
      setError('Record participant consent before collecting anonymous Pencil data.');
      return;
    }
    const now = Date.now();
    const runId = makeEvidenceRunId(writer, now);
    const meta = {
      writerId: writer,
      runId,
      recordedAt: new Date(now).toISOString(),
      startedAt: now,
      buildCommit: setup.buildCommit.trim(),
      appVersion: setup.appVersion.trim(),
      deviceModel: setup.deviceModel.trim(),
      osVersion: setup.osVersion.trim(),
      pencil: setup.pencil.trim()
    };
    localStorage.setItem(STORAGE, JSON.stringify({ ...setup, writerId: writer, consent: false }));
    setSession(meta);
    setIndex(0);
    setSamples([]);
    setLatest(null);
  };

  const onRecognized = reading => {
    const startedAt = timingRef.current.startedAt;
    const recognitionMs = Number.isFinite(startedAt) ? Math.max(0, performance.now() - startedAt) : NaN;
    timingRef.current.startedAt = null;
    const authority = productionAuthorityOf(reading, { nativeAvailable });
    setLatest({ ...reading, ...authority, recognitionMs });
  };

  const record = () => {
    if (!prompt || !latest) return;
    if (!latest.productionReady) {
      setError('This reading came from a debug/research/non-production path. Use a release iPad build before recording evidence.');
      return;
    }
    if (!Array.isArray(latest.strokes) || !latest.strokes.length) {
      setError('No Pencil strokes were attached to the current recognition result.');
      return;
    }
    if (!Number.isFinite(latest.recognitionMs)) {
      setError('Recognition timing was not captured for this sample. Rewrite the prompt and wait for the reading to settle.');
      return;
    }
    const sample = {
      id: `${session.runId}-${prompt.id}`,
      shown: prompt.shown,
      target: prompt.target,
      recognized: String(latest.text || ''),
      authority: latest.authority,
      authorityReason: latest.reason,
      pencil: true,
      recognitionMs: Number(latest.recognitionMs.toFixed(2)),
      engine: String(latest.engine || 'pri-native-no-reading'),
      productionReady: true,
      researchOnly: false,
      critical: criticalEvidenceTarget(prompt.target),
      strokes: cloneStrokes(latest.strokes)
    };
    setSamples(current => [...current, sample]);
    setIndex(value => value + 1);
    setLatest(null);
    setError('');
  };

  const skip = () => {
    setIndex(value => value + 1);
    setLatest(null);
    setError('');
  };

  const run = useMemo(() => {
    if (!session) return null;
    return {
      ...buildPhysicalEvidenceRun(session, samples),
      collectionDurationMs: Date.now() - session.startedAt,
      promptsPresented: Math.min(index, REAL_PENCIL_PROMPTS.length),
      promptsInProtocol: REAL_PENCIL_PROMPTS.length
    };
  }, [session, samples, index]);

  const exportEvidence = () => {
    if (!run) return;
    shareJson(`pri-physical-evidence-${safeFile(run.writer.id)}-${safeFile(run.runId)}.json`, run);
  };

  const exportCorpus = () => {
    if (!run) return;
    const corpus = buildCorpusFromPhysicalRun(run);
    corpus.writer.durationMs = run.collectionDurationMs;
    shareJson(`pri-real-ink-${safeFile(run.writer.id)}-${safeFile(run.runId)}.json`, corpus);
  };

  if (!session) {
    return (
      <section className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>Pri Ink physical release evidence</h1>
        <p className="muted">Hidden research route. It uses the same native PencilKit + production recognition path as Practice. No expected answer or mark scheme is supplied to recognition.</p>
        {!nativeAvailable && <div className="callout warn" role="alert">Native PencilKit is unavailable. Open this route inside the physical iPad app; browser/LAN fallback cannot produce release evidence.</div>}
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ gridColumn: '1 / -1' }}>Anonymous participant code
            <input value={setup.writerId} onChange={e => update('writerId', e.target.value)} placeholder="e.g. P0217" autoComplete="off" />
          </label>
          <label>Assigned split<input value={split || 'enter participant code'} readOnly /></label>
          <label>Exact build commit<input value={setup.buildCommit} onChange={e => update('buildCommit', e.target.value)} placeholder="40-char Git SHA" autoCapitalize="none" /></label>
          <label>App version<input value={setup.appVersion} onChange={e => update('appVersion', e.target.value)} placeholder="e.g. 1.0 (42)" /></label>
          <label>iPad model<input value={setup.deviceModel} onChange={e => update('deviceModel', e.target.value)} placeholder="e.g. iPad Air 11-inch (M2)" /></label>
          <label>iPadOS<input value={setup.osVersion} onChange={e => update('osVersion', e.target.value)} placeholder="e.g. 18.6" /></label>
          <label>Pencil model<input value={setup.pencil} onChange={e => update('pencil', e.target.value)} placeholder="e.g. Apple Pencil Pro" /></label>
        </div>
        {split === 'final-holdout' && <p className="callout warn"><b>Final holdout.</b> Collect and export the session, but do not inspect individual recognition mistakes while tuning the recogniser.</p>}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
          <input type="checkbox" checked={setup.consent} onChange={e => update('consent', e.target.checked)} style={{ width: 'auto', marginTop: 4 }} />
          <span>I confirm this participant agreed to anonymous Apple Pencil strokes being used for Pri Ink training and evaluation. No name, email, account history or student identifier is stored.</span>
        </label>
        {error && <p role="alert" style={{ color: 'var(--danger, #c44)' }}>{error}</p>}
        <button className="btn btn-primary" type="button" onClick={start} style={{ marginTop: 16 }}>Start production evidence session</button>
      </section>
    );
  }

  if (complete) {
    const auto = samples.filter(s => s.authority === 'auto').length;
    const confirm = samples.filter(s => s.authority === 'confirm').length;
    const abstain = samples.filter(s => s.authority === 'abstain').length;
    return (
      <section className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1>Session complete</h1>
        <p><b>{session.writerId}</b> · {assignedEvidenceSplit(session.writerId)} · {samples.length}/{REAL_PENCIL_PROMPTS.length} recorded</p>
        <p className="muted">Authority decisions captured before ground-truth comparison: auto {auto}, confirm {confirm}, abstain {abstain}.</p>
        <p>Save <b>both</b> files. The evidence file feeds the physical release scorer. The corpus file contains the same raw PencilKit strokes and deterministic writer split for the real-writer corpus.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="button" onClick={exportEvidence}>Export release evidence JSON</button>
          <button className="btn" type="button" onClick={exportCorpus}>Export corpus JSON</button>
        </div>
      </section>
    );
  }

  const canRecord = Boolean(latest && latest.productionReady && latest.strokes?.length && Number.isFinite(latest.recognitionMs));
  return (
    <section className="ink-evidence-session" style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{`.ink-evidence-session .ink-syms,.ink-evidence-session .ink-picker{display:none!important}`}</style>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="muted">Physical production evidence · {session.writerId} · {assignedEvidenceSplit(session.writerId)}</div>
          <h1 style={{ margin: '4px 0' }}>Write naturally</h1>
          <p style={{ fontSize: 26, margin: 0 }}>{prompt.shown}</p>
          <p className="muted">Prompt {index + 1} of {REAL_PENCIL_PROMPTS.length}. One natural attempt. Do not make it neat for the model.</p>
        </div>
        <span className="chip">{samples.length} recorded</span>
      </div>

      <InkAnswer key={`${session.runId}-${prompt.id}`} onRecognized={onRecognized} height={380} />

      <div className="card" style={{ marginTop: 14 }}>
        <b>Pre-correction production reading</b>
        {!latest && <p className="muted">Write the prompt, then wait for recognition to settle.</p>}
        {latest && (
          <>
            <p style={{ overflowWrap: 'anywhere' }}>{latest.text || <i>no reading</i>}</p>
            <p className="muted" style={{ marginBottom: 4 }}>
              engine: {latest.engine || 'unknown'} · authority: <b>{latest.authority}</b> ({latest.reason}) · recognition: {Number.isFinite(latest.recognitionMs) ? `${latest.recognitionMs.toFixed(1)} ms` : 'timing unavailable'}
            </p>
            {!latest.productionReady && <p style={{ color: 'var(--danger, #c44)' }}>This is a debug/research/non-production engine result and cannot be recorded as release evidence.</p>}
          </>
        )}
        {error && <p role="alert" style={{ color: 'var(--danger, #c44)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={record} disabled={!canRecord}>Record this sample →</button>
          <button className="btn btn-ghost" type="button" onClick={skip}>Skip prompt</button>
        </div>
      </div>
    </section>
  );
}
