import React, { useMemo, useState } from 'react';
import InkAnswer from '../ink/InkAnswer.jsx';
import { nativeInkAvailable } from '../ink/native.js';
import { downloadJSON } from '../lib/files.js';
import {
  BUILD_KINDS,
  REAL_PENCIL_PROMPTS,
  SERVERS,
  assignedEvidenceSplit,
  buildCorpusFromPhysicalRun,
  buildPhysicalEvidenceRun,
  canonicalEvidenceWriter,
  criticalEvidenceTarget,
  makeEvidenceRunId,
  productionAuthorityOf
} from '../ink/productionEvidence.js';

const STORAGE = 'pri-ink-physical-evidence-setup-v2';

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
  return downloadJSON(value, filename);
}

/**
 * Hidden physical-study route (/practice?inkEvidence=1). It mounts the real
 * InkAnswer: the PencilKit surface, the production picture and the SERVER
 * reader, read when the writer presses "Read my answer". The reading, the
 * card's confirmation decision and the round trip InkAnswer itself measured
 * (readMs) are what get recorded. Nothing here times, calls or substitutes a
 * reader of its own, so this route cannot change ordinary Practice behaviour
 * and cannot record a latency the student would not have waited.
 */
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
    buildKind: BUILD_KINDS.includes(initial.buildKind) ? initial.buildKind : 'development',
    server: SERVERS.includes(initial.server) ? initial.server : 'staging',
    consent: false
  });
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [samples, setSamples] = useState([]);
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState('');

  const writer = canonicalEvidenceWriter(setup.writerId);
  const split = writer ? assignedEvidenceSplit(writer) : null;
  const prompt = REAL_PENCIL_PROMPTS[index] || null;
  const complete = Boolean(session && index >= REAL_PENCIL_PROMPTS.length);

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
      buildKind: setup.buildKind,
      server: setup.server,
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

  // Every reading InkAnswer publishes for this prompt. Only a FRESH server
  // read carries readMs; a correction, a kept reading or a page that changed
  // after the read does not, and cannot be recorded as a timed sample.
  const onRecognized = reading => {
    const recognitionMs = Number.isFinite(reading?.readMs) ? Math.max(0, reading.readMs) : NaN;
    const authority = productionAuthorityOf(reading, { nativeAvailable });
    setLatest({ ...reading, ...authority, recognitionMs });
  };

  const record = () => {
    if (!prompt || !latest) return;
    if (!latest.productionReady) {
      setError('This reading did not come from the server reader on the native build. Use a release or development iPad build that is signed in, and press "Read my answer".');
      return;
    }
    if (!Array.isArray(latest.strokes) || !latest.strokes.length) {
      setError('No Pencil strokes were attached to the current reading.');
      return;
    }
    if (!Number.isFinite(latest.recognitionMs)) {
      setError('This reading was not a fresh server read (it was corrected, kept, or the page changed after it). Press "Read my answer" again and record that reading.');
      return;
    }
    if (latest.stale) {
      setError('The ink changed after this reading was made. Press "Read my answer" again so the sample and its timing are of the same page.');
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
      reader: 'server',
      recognitionMs: Number(latest.recognitionMs.toFixed(2)),
      engine: String(latest.engine || ''),
      serverConfidence: Number.isFinite(Number(latest.minConf)) ? Number(latest.minConf) : null,
      serverNeedsConfirmation: latest.needsConfirmation === true,
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
      <section className="card" style={{ maxWidth: 760, margin: '0 auto' }} data-ink-evidence="setup">
        <h1 style={{ marginTop: 0 }}>Pri Ink physical release evidence</h1>
        <p className="muted">Hidden research route. It uses the same native PencilKit surface and the same server reader as Practice, read when you press "Read my answer". No expected answer or mark scheme is supplied to the reader. Each prompt is one paid server read, so the device must be signed in to an account the server allows to read.</p>
        {!nativeAvailable && <div className="callout warn" role="alert">Native PencilKit is unavailable. Open this route inside the physical iPad app; browser/LAN fallback cannot produce release evidence.</div>}
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ gridColumn: '1 / -1' }}>Anonymous participant code
            <input value={setup.writerId} onChange={e => update('writerId', e.target.value)} placeholder="e.g. P0217" autoComplete="off" />
          </label>
          <label>Assigned split<input value={split || 'enter participant code'} readOnly /></label>
          <label>Exact build commit<input value={setup.buildCommit} onChange={e => update('buildCommit', e.target.value)} placeholder="40-char Git SHA" autoCapitalize="none" /></label>
          <label>App version<input value={setup.appVersion} onChange={e => update('appVersion', e.target.value)} placeholder="e.g. 1.0 (42)" /></label>
          <label>Build kind
            <select value={setup.buildKind} onChange={e => update('buildKind', e.target.value)}>
              <option value="development">development (Xcode run of the frozen SHA)</option>
              <option value="testflight">testflight (signed store build)</option>
            </select>
          </label>
          <label>Server this build talks to
            <select value={setup.server} onChange={e => update('server', e.target.value)}>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </label>
          <label>iPad model<input value={setup.deviceModel} onChange={e => update('deviceModel', e.target.value)} placeholder="e.g. iPad Air 11-inch (M2)" /></label>
          <label>iPadOS<input value={setup.osVersion} onChange={e => update('osVersion', e.target.value)} placeholder="e.g. 26.1" /></label>
          <label>Pencil model<input value={setup.pencil} onChange={e => update('pencil', e.target.value)} placeholder="e.g. Apple Pencil Pro" /></label>
        </div>
        {split === 'final-holdout' && <p className="callout warn"><b>Final holdout.</b> Collect and export the session, but do not inspect individual recognition mistakes while tuning the reader.</p>}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
          <input type="checkbox" checked={setup.consent} onChange={e => update('consent', e.target.checked)} style={{ width: 'auto', marginTop: 4 }} />
          <span>I confirm this participant agreed to anonymous Apple Pencil strokes being used for Pri Ink evaluation, and to the pictures of them being read by Pri's server. No name, email, account history or student identifier is stored.</span>
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
      <section className="card" style={{ maxWidth: 760, margin: '0 auto' }} data-ink-evidence="complete" data-ink-evidence-recorded={samples.length}>
        <h1>Session complete</h1>
        <p><b>{session.writerId}</b> · {assignedEvidenceSplit(session.writerId)} · {samples.length}/{REAL_PENCIL_PROMPTS.length} recorded</p>
        <p className="muted">Authority decisions captured before ground-truth comparison: auto {auto}, confirm {confirm}, abstain {abstain}.</p>
        <p>Save <b>both</b> files. The evidence file feeds the physical release scorer. The corpus file contains the same raw PencilKit strokes and deterministic writer split for the real-writer corpus.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="button" onClick={exportEvidence} data-ink-evidence-export="evidence">Export release evidence JSON</button>
          <button className="btn" type="button" onClick={exportCorpus} data-ink-evidence-export="corpus">Export corpus JSON</button>
        </div>
      </section>
    );
  }

  const canRecord = Boolean(latest && latest.productionReady && latest.strokes?.length && Number.isFinite(latest.recognitionMs) && !latest.stale);
  return (
    <section className="ink-evidence-session" style={{ maxWidth: 980, margin: '0 auto' }} data-ink-evidence="prompt" data-ink-evidence-recorded={samples.length}>
      <style>{`.ink-evidence-session .ink-syms,.ink-evidence-session .ink-picker{display:none!important}`}</style>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="muted">Physical production evidence · {session.writerId} · {assignedEvidenceSplit(session.writerId)} · {session.buildKind} build → {session.server}</div>
          <h1 style={{ margin: '4px 0' }}>Write naturally</h1>
          <p style={{ fontSize: 26, margin: 0 }} data-ink-evidence-prompt={prompt.id}>{prompt.shown}</p>
          <p className="muted">Prompt {index + 1} of {REAL_PENCIL_PROMPTS.length}. One natural attempt, then press "Read my answer". Do not make it neat for the reader.</p>
        </div>
        <span className="chip" data-ink-evidence-count={samples.length}>{samples.length} recorded</span>
      </div>

      <InkAnswer key={`${session.runId}-${prompt.id}`} onRecognized={onRecognized} height={380} />

      <div className="card" style={{ marginTop: 14 }}>
        <b>Pre-correction server reading</b>
        {!latest && <p className="muted">Write the prompt, then press "Read my answer" and wait for the reading.</p>}
        {latest && (
          <>
            <p style={{ overflowWrap: 'anywhere' }} data-ink-evidence-reading={latest.text || ''}>{latest.text || <i>no reading</i>}</p>
            <p className="muted" style={{ marginBottom: 4 }} data-ink-evidence-ms={Number.isFinite(latest.recognitionMs) ? latest.recognitionMs.toFixed(1) : ''}>
              engine: {latest.engine || 'unknown'} · authority: <b>{latest.authority}</b> ({latest.reason}) · server read: {Number.isFinite(latest.recognitionMs) ? `${latest.recognitionMs.toFixed(1)} ms` : 'not a fresh read'}
            </p>
            {!latest.productionReady && <p style={{ color: 'var(--danger, #c44)' }}>This reading did not come from the server reader on the native build and cannot be recorded as release evidence.</p>}
          </>
        )}
        {error && <p role="alert" style={{ color: 'var(--danger, #c44)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={record} disabled={!canRecord} data-ink-evidence-record>Record this sample →</button>
          <button className="btn btn-ghost" type="button" onClick={skip} data-ink-evidence-skip>Skip prompt</button>
        </div>
      </div>
    </section>
  );
}
