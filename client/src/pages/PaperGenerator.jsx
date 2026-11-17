import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { tLater, useLanguage, useT } from '../i18n/index.js';
import { checkRefusal, checkRefusalCopy } from '../components/checkAccess.js';
import { CheckRefusal } from '../components/CheckRefusal.jsx';
import { saveBase64File } from '../lib/files.js';
import { generatedRequest, optionsQuery } from '../local/generatedPaperBackend.js';
import Working from '../instrument/Working.jsx';

// The Paper Generator (both editions). The student chooses; the server
// assembles from the edition's approved banks and keeps the seed. The summary
// is arithmetic the device may do (marks, minutes, a question estimate); whether
// the banks can fill it is the server's answer, asked after each change.
const MARK_LENGTHS = [10, 20, 40];
const MINUTE_LENGTHS = [30, 60, 90];
const MINUTES_PER_MARK = 1.5;
// Average marks a question carries under each mix: the estimate in the summary.
const AVG_MARKS = { foundation: 1.6, standard: 2.4, challenge: 3.1, exam: 2.2 };
const MIXES = ['foundation', 'standard', 'challenge', 'exam'];
const MIX_KEYS = { foundation: 'gen.mix.foundation', standard: 'gen.mix.standard', challenge: 'gen.mix.challenge', exam: 'gen.mix.exam' };
const MAX_TOPICS = 12;

export default function PaperGenerator() {
  const { user, refreshUser } = useApp();
  const t = useT();
  const { language } = useLanguage();
  const nav = useNavigate();
  const [options, setOptions] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [by, setBy] = useState('marks');
  const [length, setLength] = useState(20);
  const [mix, setMix] = useState('standard');
  const [topics, setTopics] = useState([]);
  const [weak, setWeak] = useState(false);
  const [fit, setFit] = useState({ state: 'idle' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [refusal, setRefusal] = useState(null);
  const attempt = useRef(0);

  useEffect(() => {
    let live = true;
    api.get(`/exams/generator/options?${optionsQuery(user)}`)
      .then(r => { if (live) setOptions(r); })
      .catch(() => { if (live) setUnavailable(true); });
    return () => { live = false; };
  }, [user.year, user.pathway, user.indiaTrack]);

  const marks = by === 'marks' ? length : Math.round(length / MINUTES_PER_MARK);
  const minutes = Math.round(marks * MINUTES_PER_MARK);
  const choice = useMemo(() => ({ year: user.year, topics, marks: by === 'marks' ? length : undefined, minutes: by === 'minutes' ? length : undefined, mix, weak }),
    [user.year, topics, by, length, mix, weak]);

  // Whether the banks can fill the request, asked of the server shortly after the last change.
  useEffect(() => {
    if (!topics.length) { setFit({ state: 'idle' }); return undefined; }
    const mine = ++attempt.current;
    setFit({ state: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const r = await api.post('/exams/generator/check', { generated: generatedRequest(choice, user) });
        if (mine === attempt.current) setFit({ state: 'ready', questions: r.questions, repeats: r.repeats || 0 });
      } catch (err) {
        if (mine !== attempt.current) return;
        if (err?.code === 'PAPER_BANK_INSUFFICIENT') setFit({ state: 'short', nearest: err.nearest || null });
        else if (err?.status === 402) setFit({ state: 'premium' });
        else if (checkRefusalCopy(checkRefusal(err), 'exam')) { setRefusal(checkRefusal(err)); setFit({ state: 'idle' }); }
        else setFit({ state: 'unknown' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [choice, user]);

  const names = useMemo(() => {
    const byId = new Map((options?.topics || []).map(x => [x.id, x.name]));
    return topics.map(id => byId.get(id)).filter(Boolean);
  }, [options, topics]);
  const list = useMemo(() => {
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    if (!shown.length) return '';
    const base = typeof Intl !== 'undefined' && Intl.ListFormat ? new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(shown) : shown.join(', ');
    return rest > 0 ? t('gen.andMore', { names: shown.join(', '), n: rest }) : base;
  }, [names, language, t]);
  const estimate = Math.max(1, Math.round(marks / AVG_MARKS[mix]));

  const toggle = id => setTopics(cur => (cur.includes(id) ? cur.filter(x => x !== id) : (cur.length < MAX_TOPICS ? [...cur, id] : cur)));
  const switchBy = next => { setBy(next); setLength(next === 'marks' ? 20 : 60); };

  async function start() {
    setBusy('start'); setError(''); setRefusal(null);
    try {
      const r = await api.post('/exams', { generated: generatedRequest(choice, user) });
      nav(`/exams/${r.exam.id}`);
    } catch (err) {
      const kind = checkRefusal(err);
      if (checkRefusalCopy(kind, 'exam')) setRefusal(kind);
      else if (err?.code === 'EXAM_OPEN_PAPER_LIMIT') setError(tLater('exams.openPaperLimit'));
      else if (err?.code === 'PAPER_BANK_INSUFFICIENT') setFit({ state: 'short', nearest: err.nearest || null });
      else setError(err?.message || tLater('gen.failed'));
    } finally { setBusy(''); }
  }

  async function print() {
    setBusy('print'); setError('');
    try {
      const r = await api.post('/exams/generator/pdf', { generated: generatedRequest(choice, user) });
      await saveBase64File(r.pdfBase64, r.filename || 'pri-practice-paper.pdf', 'application/pdf');
    } catch (err) { setError(err?.message || tLater('gen.failed')); }
    finally { setBusy(''); }
  }

  function applyNearest(n) {
    setBy('marks'); setLength(n.marks);
    if (n.mix) setMix(n.mix);
  }

  const ready = topics.length > 0 && fit.state !== 'short' && fit.state !== 'premium';
  if (unavailable) {
    return <section className="card" aria-labelledby="gen-title"><h1 className="card-title" id="gen-title">{t('gen.title')}</h1><p className="sub" role="status">{t('gen.unavailable')}</p></section>;
  }
  if (!options) {
    return <section className="card" aria-labelledby="gen-title"><h1 className="card-title" id="gen-title">{t('gen.title')}</h1><p className="muted" role="status"><Working pending={options === null} size={24} /><span>{t('gen.loading')}</span></p></section>;
  }

  return (
    <form className="pg" aria-labelledby="gen-title" onSubmit={e => { e.preventDefault(); if (ready && !busy) start(); }} data-paper-generator>
      <header className="pg-head">
        <h1 className="card-title" id="gen-title">{t('gen.title')}</h1>
        <p className="sub">{t('gen.intro')}</p>
        <p className="muted pg-note">{options.note}</p>
      </header>

      <div className="pg-body">
        <div className="pg-choices">
          <fieldset className="pg-set">
            <legend className="label">{t('gen.topics')}</legend>
            <p className="muted pg-help" id="gen-topics-help">{t('gen.topicsHelp', { n: MAX_TOPICS })}</p>
            <div className="pg-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTopics(options.topics.slice(0, MAX_TOPICS).map(x => x.id))}>{t('gen.selectAll', { n: Math.min(MAX_TOPICS, options.topics.length) })}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTopics([])} disabled={!topics.length}>{t('gen.clear')}</button>
            </div>
            <ul className="pg-topics" aria-describedby="gen-topics-help">
              {options.topics.map(x => {
                const on = topics.includes(x.id);
                return (
                  <li key={x.id}>
                    <label className={`pg-check${on ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(x.id)} disabled={!on && topics.length >= MAX_TOPICS} data-topic={x.id} />
                      <span>{x.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset className="pg-set">
            <legend className="label">{t('gen.length')}</legend>
            <div className="pg-row" role="radiogroup" aria-label={t('gen.measure')}>
              {['marks', 'minutes'].map(k => (
                <button key={k} type="button" role="radio" aria-checked={by === k} className={`btn btn-sm ${by === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => switchBy(k)}>{t(k === 'marks' ? 'gen.byMarks' : 'gen.byMinutes')}</button>
              ))}
            </div>
            <div className="pg-options">
              {(by === 'marks' ? MARK_LENGTHS : MINUTE_LENGTHS).map(n => (
                <label key={n} className={`pg-pick${length === n ? ' is-on' : ''}`}>
                  <input type="radio" name="gen-length" checked={length === n} onChange={() => setLength(n)} />
                  <span>{t(by === 'marks' ? 'gen.lenMarks' : 'gen.lenMinutes', { n })}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="pg-set">
            <legend className="label">{t('gen.mix')}</legend>
            <div className="pg-options">
              {MIXES.map(m => (
                <label key={m} className={`pg-pick${mix === m ? ' is-on' : ''}`}>
                  <input type="radio" name="gen-mix" checked={mix === m} onChange={() => setMix(m)} />
                  <span>{t(MIX_KEYS[m])}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={`pg-check pg-weak${weak ? ' is-on' : ''}`}>
            <input type="checkbox" checked={weak} onChange={e => setWeak(e.target.checked)} />
            <span>{t('gen.weak')}<small className="muted">{t('gen.weakHelp')}</small></span>
          </label>
        </div>

        <aside className="pg-summary" aria-label={t('gen.summaryLabel')}>
          <p className="pg-live" role="status" aria-live="polite" data-gen-summary>
            {topics.length
              ? t('gen.summary', { marks, minutes, count: estimate, n: estimate, topics: list })
              : t('gen.chooseTopics')}
          </p>
          <p className={`pg-fit pg-fit-${fit.state}`} role="status" data-gen-fit={fit.state}>
            {fit.state === 'checking' && <><Working pending={fit.state === 'checking'} size={16} /><span>{t('gen.checking')}</span></>}
            {fit.state === 'ready' && t('gen.ready')}
            {fit.state === 'premium' && t('gen.premiumWeak')}
            {fit.state === 'unknown' && t('gen.cannotCheck')}
            {fit.state === 'short' && (fit.nearest
              ? <>{t('gen.short')} <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyNearest(fit.nearest)}>{t('gen.useNearest', { marks: fit.nearest.marks, mix: t(MIX_KEYS[fit.nearest.mix] || MIX_KEYS[mix]) })}</button></>
              : t('gen.shortNone'))}
          </p>
          {fit.state === 'ready' && fit.repeats > 0 && <p className="muted">{t('gen.repeats', { count: fit.repeats, n: fit.repeats })}</p>}
          <div className="pg-actions">
            <button type="submit" className="btn btn-primary" disabled={!ready || !!busy} data-gen-start>{busy === 'start' ? t('exams.building') : t('gen.start')}</button>
            <button type="button" className="btn btn-ghost" onClick={print} disabled={!ready || !!busy} data-gen-print>{busy === 'print' ? t('gen.printing') : t('gen.print')}</button>
          </div>
          <p className="muted pg-note">{t('gen.marking')}</p>
          <p className="muted pg-note">{t('gen.guideNote')}</p>
          {error && <p className="verdict verdict-technical" role="alert">{error}</p>}
          {refusal && <div className="verdict verdict-technical" role="alert"><CheckRefusal kind={refusal} context="exam" user={user} refreshUser={refreshUser} onRetry={start} busy={!!busy} /></div>}
        </aside>
      </div>
    </form>
  );
}
