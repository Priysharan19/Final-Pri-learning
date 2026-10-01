// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor panel on a practice question (lazy chunk)
//
// Three levels, in order, and the order is enforced by the local backend, not
// by these buttons: 1 nudge → 2 Socratic question → 3 narrated walkthrough.
// Each opened level is charged like a hint, and the card shows the reduced
// credit as soon as a level is opened.
//
// Level 3 is the deterministic Pri Explain player, opened on the verified
// solution. The model may only rephrase its captions, and a rephrased caption
// is shown only if every $…$ span in it is already in the verified solution —
// the same rule storyboard.js applies to any storyboard. The server checks this
// too; this is the second check, on the device that will display it.
//
// Offline, unavailable, rate-limited or refused, the panel falls back to the
// question's own authored hints and says so. It never crashes the card.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { buildDeterministicStoryboard } from '../explain/visualEngine.js';
import { verifiedMath } from '../explain/storyboard.js';
import './TutorHelp.css';

export const TUTOR_LEVELS = Object.freeze([1, 2, 3]);

/** Each level's name and description, as literal keys the i18n gate can see. */
function levelText(t) {
  return {
    1: { name: t('tutor.level1'), desc: t('tutor.level1Desc') },
    2: { name: t('tutor.level2'), desc: t('tutor.level2Desc') },
    3: { name: t('tutor.level3'), desc: t('tutor.level3Desc') }
  };
}

const SPAN = /\$([^$]+)\$/g;

/** Captions the device will show: only those whose maths is all in the verified solution. */
export function safeCaptions(captions, solution) {
  const evidence = verifiedMath(solution);
  const out = {};
  for (const c of Array.isArray(captions) ? captions : []) {
    if (c?.source !== 'tutor' || typeof c.text !== 'string' || !c.id) continue;
    const spans = [...c.text.matchAll(SPAN)].map(m => m[1].trim()).filter(Boolean);
    if (spans.every(s => evidence.has(s))) out[c.id] = c.text;
  }
  return out;
}

export default function TutorHelp({ question, work, locale, onUsed, onClose }) {
  const t = useT();
  const text = levelText(t);
  const headingId = useId();
  const [used, setUsed] = useState(Math.max(0, Math.min(3, Number(question.tutorLevel) || 0)));
  const [busy, setBusy] = useState(0);
  const [notes, setNotes] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => { panelRef.current?.focus(); }, []);

  const note = (level, entry) => setNotes(list => [...list.filter(n => n.level !== level), { level, ...entry }].sort((a, b) => a.level - b.level));

  function openWalkthrough(solution) {
    if (!solution?.steps?.length || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pri:worked-solution', {
      detail: { questionId: question.id, solution, revealed: false, tutorWalkthrough: true }
    }));
    let board = null;
    try { board = buildDeterministicStoryboard(solution, { questionPrompt: question.prompt, questionFigure: question.figure }); } catch { board = null; }
    const captions = (board?.scenes || [])
      .map(scene => ({ id: String(scene.id).slice(0, 40), text: String(scene.narration || '').slice(0, 700) }))
      .filter(c => c.id && c.text).slice(0, 24);
    if (!captions.length) return;
    api.post(`/practice/${question.id}/tutor/captions`, { captions, locale, work })
      .then(r => {
        const map = safeCaptions(r?.captions, solution);
        if (Object.keys(map).length) {
          window.dispatchEvent(new CustomEvent('pri:tutor-captions', { detail: { questionId: question.id, captions: map } }));
        }
      })
      .catch(() => { /* the deterministic captions are already playing */ });
  }

  async function ask(level) {
    if (busy || level > used + 1) return;
    setBusy(level);
    try {
      const r = await api.post(`/practice/${question.id}/tutor`, { level, locale, work });
      const reached = Math.max(used, Number(r?.tutorLevel) || level);
      setUsed(reached);
      onUsed?.(reached);
      if (level === 3) {
        openWalkthrough(r?.walkthrough?.solution);
        note(3, { text: t('tutor.walkthroughReady'), source: 'deterministic' });
      } else {
        note(level, {
          text: r?.message || null,
          source: r?.source === 'tutor' ? 'tutor' : 'deterministic',
          offline: r?.source !== 'tutor' && ['TUTOR_OFFLINE', 'TUTOR_TIMEOUT', 'TUTOR_UNAVAILABLE', 'CLOUD_DISABLED', 'AUTH_REQUIRED', 'RATE_LIMITED', 'PAID_CAPACITY_REACHED', 'TUTOR_NOT_CONFIGURED'].includes(r?.code)
        });
      }
    } catch (error) {
      note(level, { text: error?.code === 'EXAM_QUESTION_LOCKED' ? t('tutor.examLocked') : t('tutor.unavailable'), source: 'error' });
    } finally {
      setBusy(0);
    }
  }

  return (
    <section className="tutor-panel no-print" aria-labelledby={headingId} tabIndex={-1} ref={panelRef} data-tutor-panel>
      <header className="tutor-head">
        <h3 id={headingId}>{t('tutor.title')}</h3>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t('tutor.close')}>✕</button>
      </header>
      <p className="tutor-intro">{t('tutor.intro')}</p>
      <ol className="tutor-levels">
        {TUTOR_LEVELS.map(n => {
          const level = { n, ...text[n] };
          const locked = level.n > used + 1;
          const opened = level.n <= used;
          const descId = `${headingId}-d${level.n}`;
          return (
            <li key={level.n}>
              <button type="button" className={`tutor-level ${opened ? 'opened' : ''}`} data-tutor-level={level.n}
                disabled={locked || !!busy} aria-describedby={descId} onClick={() => ask(level.n)}>
                <span className="tutor-level-n" aria-hidden="true">{level.n}</span>
                <span className="tutor-level-text">
                  <b>{t('tutor.levelButton', { n: level.n, name: level.name })}</b>
                  <small id={descId}>{locked ? t('tutor.locked', { n: level.n - 1 }) : level.desc}</small>
                </span>
                {opened && <span className="tutor-level-used">✓ {t('tutor.used')}</span>}
                {busy === level.n && <span className="tutor-level-used">{t('tutor.asking')}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="tutor-notes" aria-live="polite">
        {notes.map(n => (
          <div key={n.level} className={`tutor-note tutor-note-${n.source}`} data-tutor-note={n.level} data-tutor-source={n.source}>
            <span className="tutor-note-src">
              {t('tutor.levelButton', { n: n.level, name: text[n.level].name })}
              {n.source === 'tutor' ? ` · ${t('tutor.fromTutor')}` : n.source === 'deterministic' && n.level < 3 ? ` · ${t('tutor.fromHint')}` : ''}
            </span>
            {n.offline && <small className="tutor-note-why">{t('tutor.fallbackOffline')}</small>}
            {n.text ? <MathText text={n.text} /> : <span>{t('tutor.noHint')}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
