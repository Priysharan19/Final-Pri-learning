// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Practise this" — photograph a question, practise its skill
//
// A lazily-loaded route. The student photographs a question from a textbook or
// worksheet; the server proposes which chapter and skill it belongs to; the
// student confirms or changes the chapter; Practice then serves fresh
// generated questions of that skill, marked on the device by the deterministic
// engine. The photographed question itself is never marked here.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { chapterChoices, identifyQuestionPhoto, practiseHrefFor } from '../lib/questionPhoto.js';

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

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function PractisePhoto() {
  const t = useT();
  const nav = useNavigate();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [chapterId, setChapterId] = useState('');
  const choices = useMemo(() => chapterChoices(), []);

  const onFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setResult(null);
    let dataUrl = '';
    try { dataUrl = await readFile(file); } catch { dataUrl = ''; }
    const read = await identifyQuestionPhoto(dataUrl);
    setResult(read);
    setChapterId(read.candidates?.[0]?.chapterId || '');
    setBusy(false);
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
