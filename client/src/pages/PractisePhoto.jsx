// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Practise this" — photograph a question, practise its skill
//
// A lazily-loaded route. The student photographs a question from a textbook or
// worksheet; the server proposes which chapter and skill it belongs to; the
// student confirms or changes the chapter; Practice then serves fresh
// generated questions of that skill; grading requires a verified online server
// receipt. The photographed question itself is never marked here.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { useApp } from '../App.jsx';
import { cloudAvailable } from '../platform/cloudTransport.js';
// The same account component used by Practice, never an alternate sign-in
// flow or a route bypassing verified/guardian eligibility.
const PhotoAccountRecovery = React.lazy(() => import('../components/CloudAccountPanel.jsx'));
import { chapterChoices, identifyQuestionPhoto, practiseHrefFor } from '../lib/questionPhoto.js';
import { createPhotoRequestGate } from './photoPractiseRequest.js';

const STATE_KEY = {
  offline: 'snap.offline',
  'signed-out': 'snap.signedOut',
  unverified: 'snap.unverified',
  consent: 'snap.consent',
  'not-configured': 'snap.notConfigured',
  'provider-down': 'snap.providerDown',
  allowance: 'snap.allowance',
  'not-maths': 'snap.notMaths',
  unreadable: 'snap.unreadable',
  'no-match': 'snap.noMatch',
  'bad-photo': 'snap.badPhoto'
};

function readFile(file, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const finish = (value, failed = false) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', abort);
      if (failed) reject(value); else resolve(value);
    };
    const abort = () => {
      try { if (reader.readyState === FileReader.LOADING) reader.abort(); } catch { /* best effort */ }
      finish(new Error('Photo reading was cancelled.'), true);
    };
    reader.onload = () => finish(String(reader.result || ''));
    reader.onerror = () => finish(reader.error || new Error('Photo cannot be read.'), true);
    reader.onabort = () => finish(new Error('Photo reading was cancelled.'), true);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener?.('abort', abort, { once: true });
    try { reader.readAsDataURL(file); } catch (error) { finish(error, true); }
  });
}

export default function PractisePhoto() {
  const t = useT();
  const { user } = useApp();
  const accountId = String(user?.id ?? 'no-profile');
  const nav = useNavigate();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // The identified question is student material: never render another
  // profile's transcript during a cloud/local account switch.
  const [reading, setReading] = useState(null);
  const result = reading?.accountId === accountId ? reading.result : null;
  const [accountRecoveryOpen, setAccountRecoveryOpen] = useState(false);
  const [chapterId, setChapterId] = useState('');
  const choices = useMemo(() => chapterChoices(), []);
  const requestGate = useRef(null);
  useEffect(() => {
    const gate = createPhotoRequestGate();
    requestGate.current = gate;
    setBusy(false); setReading(null); setChapterId(''); setAccountRecoveryOpen(false);
    return () => {
      gate.dispose();
      if (requestGate.current === gate) requestGate.current = null;
    };
  }, [accountId]);

  const onFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return; // Cancelling a picker must not discard a valid prior review.
    const gate = requestGate.current;
    if (!gate) return; // Component/account transition is not a valid submission.
    const { epoch, signal } = gate.next();
    setBusy(true);
    setReading(null);
    setChapterId('');
    setAccountRecoveryOpen(false); // photo replacement ends previous auth-error pane.
    let stage = 'decoding';
    try {
      const dataUrl = await readFile(file, signal);
      if (!gate.current(epoch)) return;
      stage = 'identifying';
      const read = await identifyQuestionPhoto(dataUrl, { signal });
      if (!gate.current(epoch)) return;
      setReading({ accountId, result: read });
      setChapterId(read.candidates?.[0]?.chapterId || '');
    } catch {
      if (gate.current(epoch)) {
        // No unhandled FileReader/proxy/provider exception may strand the spinner
        // or leave an old chapter available to practise.
        setReading({ accountId, result: { state: stage === 'decoding' ? 'bad-photo' : 'provider-down', questionText: '', candidates: [] } });
      }
    } finally {
      if (gate.current(epoch)) setBusy(false);
    }
  };

  const proposed = result?.candidates?.find(c => c.chapterId === chapterId) || null;
  const href = chapterId ? practiseHrefFor({ chapterId, dotpoint: proposed?.dotpoint ?? null }) : null;
  const chapterLabel = c => (c.grade ? t('snap.chapterOption', { grade: c.grade, name: c.name }) : c.name);

  return (
    <div className="card" style={{ maxWidth: 760 }} data-photo-practise>
      <h1 className="card-title">{t('snap.title')}</h1>
      <p className="sub">{t('snap.lead')}</p>
      <p className="muted">{t('snap.howMarked')}</p>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={onFile} data-photo-practise-input aria-hidden="true" tabIndex={-1} />
      <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()} data-photo-practise-pick>
          {result ? t('snap.another') : t('snap.pick')}
        </button>
      </div>

      {busy && <p role="status" className="muted" style={{ marginTop: 12 }}>{t('snap.reading')}</p>}

      {result && result.state !== 'ok' && (
        <div className="error-box" role="alert" style={{ marginTop: 12 }} data-photo-practise-state={result.state}>
          {t(STATE_KEY[result.state] || 'snap.providerDown')}
        </div>
      )}

      {result?.state === 'signed-out' && cloudAvailable() && (
        <div data-photo-practise-account-recovery style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary btn-sm"
            aria-expanded={accountRecoveryOpen}
            data-testid="photo-practise-sign-in"
            onClick={() => setAccountRecoveryOpen(open => !open)}>
            {t('login.cloudSignIn')}
          </button>
          {accountRecoveryOpen && (
            <React.Suspense fallback={<p role="status">{t('cloud.stateChecking')}</p>}>
              <PhotoAccountRecovery />
            </React.Suspense>
          )}
        </div>
      )}

      {result?.state === 'ok' && (
        <section style={{ marginTop: 16 }} data-photo-practise-state="ok" aria-labelledby="photo-practise-read">
          <h2 id="photo-practise-read" className="sc-label">{t('snap.recognised')}</h2>
          <blockquote style={{ margin: '6px 0 14px', whiteSpace: 'pre-wrap' }} data-photo-practise-question>{result.questionText}</blockquote>

          <label htmlFor="photo-practise-chapter" className="sc-label">{t('snap.chapter')}</label>
          <select id="photo-practise-chapter" className="input" value={chapterId}
            onChange={e => setChapterId(e.target.value)} data-photo-practise-chapter>
            <optgroup label={t('snap.suggested')}>
              {result.candidates.map(c => <option key={c.chapterId + c.skillId} value={c.chapterId}>{chapterLabel(c)}</option>)}
            </optgroup>
            <optgroup label={t('snap.allChapters')}>
              {choices.filter(c => !result.candidates.some(p => p.chapterId === c.id))
                .map(c => <option key={c.id} value={c.id}>{chapterLabel(c)}</option>)}
            </optgroup>
          </select>
          {proposed?.dotpointText && <p className="muted" style={{ marginTop: 8 }} data-photo-practise-skill>{t('snap.skill', { skill: proposed.dotpointText })}</p>}
          <p className="muted" style={{ fontSize: 12.5 }}>{t('snap.confirmNote')}</p>

          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <button className="btn btn-primary" disabled={!href} onClick={() => href && nav(href)} data-photo-practise-start>
              {t('snap.start')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
