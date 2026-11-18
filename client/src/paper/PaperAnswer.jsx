// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the answer area of one part of a paper
//
// One ruled writing area per part, in the three modes the rest of the app
// offers: Type, Write (the ink surface) and Photo. The component is controlled:
// the page owns the answers, the autosave and the submission.
//
//   · a multiple-choice question is four options, one chosen;
//   · a part Pri can check (a final number or expression) takes the final
//     answer and the working apart, exactly as a practice question does;
//   · every other part is a ruled area to write the whole answer in, which the
//     student checks against the sample answer afterwards.
// A handwritten or photographed part is read first (the reader is answer-blind,
// and reading never sets a mark); the student confirms the reading, and "Keep"
// stores the original, the strokes or the picture, with it. Submit all keeps any
// part still waiting.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { useApp } from '../App.jsx';
import TypedAnswerFields from '../components/TypedAnswerFields.jsx';
import { answerToTex } from '../engine/answerTex.js';
import Blocks from './PaperBlocks.jsx';
import { keepPart, failureKey } from './paperApi.js';

const InkAnswer = React.lazy(() => import('../ink/InkAnswer.jsx'));

export const MODES = ['typed', 'ink', 'photo'];

// ── Multiple choice ───────────────────────────────────────────────────────────

export function PaperChoice({ part, attemptId, value, onChange, disabled }) {
  const t = useT();
  const name = useId();
  return (
    <fieldset className="pp-choice" disabled={disabled} data-paper-choice={part.id}>
      <legend className="sr-only">{t('paper.choose', { n: part.id.replace(/^q/, '') })}</legend>
      {part.options.map(o => (
        <label key={o.label} className={`pp-opt${value?.text === o.label ? ' is-on' : ''}`}>
          <input type="radio" name={name} value={o.label} checked={value?.text === o.label} onChange={() => onChange({ mode: 'typed', text: o.label })} />
          <span className="pp-opt-key" aria-hidden="true">{o.label}</span>
          <span className="pp-opt-body">{o.blocks.length ? <Blocks blocks={o.blocks} attemptId={attemptId} inline /> : <span className="sr-only">{t('paper.option', { letter: o.label })}</span>}</span>
        </label>
      ))}
      {!disabled && value?.text && <button type="button" className="btn btn-ghost btn-sm pp-clear" onClick={() => onChange({ mode: 'typed', text: '' })}>{t('paper.clearChoice')}</button>}
    </fieldset>
  );
}

// ── Write and Photo share the reading, the confirmation and "Keep" ───────────

function Reading({ part, value, onChange, reading, busy, kept, keepError, onKeep, disabled }) {
  const t = useT();
  const id = useId();
  const keyed = part.checks === 'pri';
  const lines = reading?.lines || [];
  const finalAnswer = keyed ? (value?.text ?? '') : '';
  return (
    <div className="pp-reading" data-paper-reading>
      {lines.length > 0 && (
        <div className="pp-read">
          <p className="pp-read-title" id={`${id}-t`}>{t('paper.read.title')}</p>
          <ol className="pp-read-lines" aria-labelledby={`${id}-t`}>{lines.map((l, i) => <li key={i}><MathText text={answerToTex(l)} /></li>)}</ol>
        </div>
      )}
      {keyed
        ? (
          <>
            <label className="pp-field-label" htmlFor={`${id}-fa`}>{t('paper.read.finalAnswer')}</label>
            <input id={`${id}-fa`} className="answer-input pp-final" value={finalAnswer} disabled={disabled} data-paper-final
              onChange={e => onChange({ ...value, mode: value?.mode, text: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <p className="muted pp-hint">{t('paper.read.finalHint')}</p>
          </>
        ) : (
          <>
            <label className="pp-field-label" htmlFor={`${id}-all`}>{t('paper.read.confirm')}</label>
            <textarea id={`${id}-all`} className="input pp-ruled" rows={5} value={value?.text ?? ''} disabled={disabled} data-paper-confirm
              onChange={e => onChange({ ...value, mode: value?.mode, text: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </>
        )}
      <div className="pp-keep-row">
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || busy || !(value?.text || '').trim() || !reading?.ready} onClick={onKeep} data-paper-keep>
          {busy ? t('paper.keep.keeping') : t('paper.keep.button')}
        </button>
        <span className="muted" role="status" data-paper-kept={kept ? 'yes' : 'no'}>
          {keepError ? t(keepError) : kept ? t('paper.keep.kept') : t('paper.keep.waiting')}
        </span>
      </div>
    </div>
  );
}

function WriteArea({ part, attemptId, value, onChange, disabled, register }) {
  const t = useT();
  const [reading, setReading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [keepError, setKeepError] = useState(null);
  const latest = useRef({ value, reading });
  latest.current = { value, reading };
  const keyed = part.checks === 'pri';

  const onRecognized = useCallback(r => {
    if (!r || r.stale) return;
    setReading({ ...r, ready: !!(r.text || '').trim() });
    const prior = latest.current.value;
    // The reading is the student's to confirm; a part already confirmed by hand is not overwritten.
    if (!prior?.touched) onChange({ mode: 'ink', text: keyed ? (r.answerLine || '') : r.text, ...(keyed && r.lines.length > 1 ? { working: r.lines.slice(0, -1).join('\n') } : {}) });
  }, [onChange, keyed]);

  const keep = useCallback(async () => {
    const { value: v, reading: r } = latest.current;
    if (!r?.strokes?.length || !(v?.text || '').trim()) return false;
    setBusy(true); setKeepError(null);
    try {
      const [{ rasterizeInk }, { buildInkOriginal }] = await Promise.all([import('../ink/cloudRaster.js'), import('../ink/originalWork.js')]);
      const image = rasterizeInk(r.strokes)?.dataUrl;
      const original = await buildInkOriginal(r).catch(() => null);
      if (!image || !original) { setKeepError('paper.keep.tooLarge'); return false; }
      await keepPart(attemptId, part.id, { mode: 'ink', text: v.text, ...(v.working ? { working: v.working } : {}), image, original });
      onChange({ ...v, mode: 'ink', kept: true, touched: true });
      return true;
    } catch (error) { setKeepError(failureKey(error)); return false; } finally { setBusy(false); }
  }, [attemptId, part.id, onChange]);
  useEffect(() => { register?.(part.id, async () => (latest.current.value?.kept ? true : keep())); return () => register?.(part.id, null); }, [register, part.id, keep]);

  return (
    <div className="pp-write">
      <React.Suspense fallback={<p className="muted" role="status">{t('paper.write.loading')}</p>}>
        <InkAnswer feedback autoRead onRecognized={onRecognized} height={220} disabled={disabled} />
      </React.Suspense>
      {(reading || (value?.text || '').trim()) && <Reading part={part} value={value} onChange={v => onChange({ ...v, touched: true, kept: false })} reading={reading || { lines: [], ready: true }} busy={busy} kept={value?.kept === true} keepError={keepError} onKeep={keep} disabled={disabled} />}
    </div>
  );
}

function PhotoArea({ part, attemptId, value, onChange, disabled, register }) {
  const t = useT();
  const { user } = useApp();
  const [reading, setReading] = useState(null);
  const [status, setStatus] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [keepError, setKeepError] = useState(null);
  const pictureRef = useRef(null);
  const latest = useRef({ value, reading });
  latest.current = { value, reading };
  const keyed = part.checks === 'pri';

  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('reading'); setKeepError(null);
    try {
      const dataUrl = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); });
      const { readPhotoWithCloud } = await import('../ink/cloudReader.js');
      const { preparePhoto } = await import('../ink/photoRaster.js');
      let prepared = null;
      const out = await readPhotoWithCloud(dataUrl, { user, prepare: async u => { prepared = await preparePhoto(u); return prepared; } });
      const lines = (out?.transcription?.lines || []).map(l => (typeof l === 'string' ? l : l.text)).filter(Boolean);
      if (!lines.length || !prepared?.dataUrl) { setStatus('failed'); return; }
      pictureRef.current = prepared.dataUrl;
      setReading({ lines, ready: true });
      setStatus('read');
      onChange({ mode: 'photo', text: keyed ? lines[lines.length - 1] : lines.join('\n'), ...(keyed && lines.length > 1 ? { working: lines.slice(0, -1).join('\n') } : {}), kept: false });
    } catch { setStatus('failed'); }
  }

  const keep = useCallback(async () => {
    const { value: v } = latest.current;
    if (!pictureRef.current || !(v?.text || '').trim()) return false;
    setBusy(true); setKeepError(null);
    try {
      const { buildImageOriginal } = await import('../ink/originalWork.js');
      const original = await buildImageOriginal(pictureRef.current, { origin: 'photo', samePicture: true });
      await keepPart(attemptId, part.id, { mode: 'photo', text: v.text, ...(v.working ? { working: v.working } : {}), image: pictureRef.current, original });
      onChange({ ...v, mode: 'photo', kept: true, touched: true });
      return true;
    } catch (error) { setKeepError(failureKey(error)); return false; } finally { setBusy(false); }
  }, [attemptId, part.id, onChange]);
  useEffect(() => { register?.(part.id, async () => (latest.current.value?.kept ? true : keep())); return () => register?.(part.id, null); }, [register, part.id, keep]);

  return (
    <div className="pp-photo">
      <label className="btn btn-ghost btn-sm pp-file">
        <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={choose} data-paper-photo className="sr-only" />
        {t('paper.photo.choose')}
      </label>
      <p className="muted" role="status">{status === 'reading' ? t('paper.photo.reading') : status === 'failed' ? t('paper.photo.failed') : t('paper.photo.help')}</p>
      {reading && <Reading part={part} value={value} onChange={v => onChange({ ...v, touched: true, kept: false })} reading={reading} busy={busy} kept={value?.kept === true} keepError={keepError} onKeep={keep} disabled={disabled} />}
    </div>
  );
}

// ── One part ──────────────────────────────────────────────────────────────────

export default function PaperAnswer({ part, attemptId, value, onChange, disabled, register }) {
  const t = useT();
  const [mode, setMode] = useState(value?.mode && MODES.includes(value.mode) ? value.mode : 'typed');
  const id = useId();
  const keyed = part.checks === 'pri';
  const change = useCallback(next => onChange(part.id, next), [onChange, part.id]);
  const text = value?.text ?? '';
  const working = value?.working ?? '';

  return (
    <div className="pp-answer" data-paper-answer={part.id}>
      <div role="tablist" aria-label={t('paper.mode.label')} className="pp-modes">
        {MODES.map(m => (
          <button key={m} type="button" role="tab" id={`${id}-${m}`} aria-selected={mode === m} tabIndex={mode === m ? 0 : -1} disabled={disabled}
            className={`pp-mode${mode === m ? ' is-on' : ''}`} data-paper-mode={m} onClick={() => setMode(m)}
            onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const i = MODES.indexOf(m); setMode(MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length]); } }}>
            {t(`paper.mode.${m}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`${id}-${mode}`}>
        {mode === 'typed' && (keyed
          ? <TypedAnswerFields question={{ answerSuffix: part.answerSuffix || '', supportsSteps: true }} totalMarks={part.marks} offerWorking
              answer={value?.mode === 'typed' || !value?.mode ? text : ''} working={working} resolved={disabled}
              onAnswer={v => change({ mode: 'typed', text: v, working })} onWorking={v => change({ mode: 'typed', text, working: v })}
              previewTex={null} />
          : (
            <>
              <label className="pp-field-label" htmlFor={`${id}-ruled`}>{t('paper.typed.label')}</label>
              <textarea id={`${id}-ruled`} className="input pp-ruled" rows={7} value={value?.mode === 'typed' || !value?.mode ? text : ''} disabled={disabled}
                onChange={e => change({ mode: 'typed', text: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} data-paper-ruled />
            </>
          ))}
        {mode === 'ink' && <WriteArea part={part} attemptId={attemptId} value={value?.mode === 'ink' ? value : null} onChange={change} disabled={disabled} register={register} />}
        {mode === 'photo' && <PhotoArea part={part} attemptId={attemptId} value={value?.mode === 'photo' ? value : null} onChange={change} disabled={disabled} register={register} />}
      </div>
    </div>
  );
}
