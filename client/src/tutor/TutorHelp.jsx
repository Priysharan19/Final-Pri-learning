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
// Between levels 1 and 3 the student may also ask in their own words. Each
// turn goes through the local backend (POST /practice/:id/tutor/ask, built in
// askRoute.js), which adds the verified solution the panel never sees and
// streams the server's guarded reply back one sentence at a time as
// `pri:tutor-delta` events. The panel shows the text as it arrives, says
// "Pri is thinking" until the first sentence, and — offline, refused or
// guarded — shows the question's own authored hint and says why.
//
// Offline, unavailable, rate-limited or refused, the panel falls back to the
// question's own authored hints and says so. It never crashes the card.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { checkRefusal, checkRefusalCopy } from '../components/checkAccess.js';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { buildDeterministicStoryboard } from '../explain/visualEngine.js';
import { safeCaptions } from './captionRule.js';
import { TUTOR_DELTA_EVENT } from './askRoute.js';
import { MAX_TURN_CHARS, cleanTurnText } from './conversation.js';
import './TutorHelp.css';

/** Why a deterministic reply is showing, as one of the panel's own sentences. */
const OFFLINE_CODES = new Set(['TUTOR_OFFLINE', 'TUTOR_TIMEOUT', 'TUTOR_UNAVAILABLE', 'TUTOR_UNREACHABLE', 'CLOUD_DISABLED', 'AUTH_REQUIRED', 'RATE_LIMITED', 'PAID_CAPACITY_REACHED', 'TUTOR_NOT_CONFIGURED', 'TUTOR_DAILY_LIMIT', 'TUTOR_STREAM_INCOMPLETE', 'TUTOR_FAILED', 'TUTOR_EMPTY']);

let turnSerial = 0;
function newTurnId() {
  turnSerial += 1;
  try { return `t-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now().toString(36)}-${turnSerial}`; }
  catch { return `t-${Date.now().toString(36)}-${turnSerial}`; }
}

export const TUTOR_LEVELS = Object.freeze([1, 2, 3]);

/** Each level's name and description, as literal keys the i18n gate can see. */
function levelText(t) {
  return {
    1: { name: t('tutor.level1'), desc: t('tutor.level1Desc') },
    2: { name: t('tutor.level2'), desc: t('tutor.level2Desc') },
    3: { name: t('tutor.level3'), desc: t('tutor.level3Desc') }
  };
}

export { safeCaptions };

export default function TutorHelp({ question, work, locale, onUsed, onResolved, onRefused, onClose, startedAt }) {
  const t = useT();
  const text = levelText(t);
  const headingId = useId();
  const [used, setUsed] = useState(Math.max(0, Math.min(3, Number(question.tutorLevel) || 0)));
  const [busy, setBusy] = useState(0);
  const [notes, setNotes] = useState([]);
  const panelRef = useRef(null);

  // The conversation: what was said, what is being typed, what is arriving.
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [streaming, setStreaming] = useState('');
  const historyRef = useRef([]);
  const turnRef = useRef(null);
  const inputRef = useRef(null);
  const askId = useId();

  useEffect(() => { panelRef.current?.focus(); }, []);

  // Sentences the local route releases for the turn in flight, as they arrive.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onDelta = event => {
      const { turnId, text } = event.detail || {};
      if (!turnRef.current || turnId !== turnRef.current || typeof text !== 'string') return;
      setStreaming(prev => prev + text);
    };
    window.addEventListener(TUTOR_DELTA_EVENT, onDelta);
    return () => window.removeEventListener(TUTOR_DELTA_EVENT, onDelta);
  }, []);

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
    const sources = new Map(captions.map(c => [c.id, c.text]));
    api.post(`/practice/${question.id}/tutor/captions`, { captions, locale, work })
      .then(r => {
        const map = safeCaptions(r?.captions, solution, sources);
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
      const r = await api.post(`/practice/${question.id}/tutor`, {
        level, locale, work, ...(level === 3 && startedAt ? { ms: Date.now() - startedAt } : {})
      });
      const reached = Math.max(used, Number(r?.tutorLevel) || level);
      setUsed(reached);
      onUsed?.(reached);
      if (level === 3) {
        const solution = r?.walkthrough?.solution;
        openWalkthrough(solution);
        // No verified steps means no walkthrough to open: say so plainly.
        note(3, { text: solution?.steps?.length ? t('tutor.walkthroughReady') : null, source: 'deterministic' });
        // The walkthrough shows the answer, so the question is now resolved
        // exactly as Reveal resolves it; the card shows that outcome.
        if (r?.resolved) onResolved?.(r);
      } else {
        note(level, {
          text: r?.message || null,
          source: r?.source === 'tutor' ? 'tutor' : 'deterministic',
          offline: r?.source !== 'tutor' && ['TUTOR_OFFLINE', 'TUTOR_TIMEOUT', 'TUTOR_UNAVAILABLE', 'CLOUD_DISABLED', 'AUTH_REQUIRED', 'RATE_LIMITED', 'PAID_CAPACITY_REACHED', 'TUTOR_NOT_CONFIGURED'].includes(r?.code)
        });
      }
    } catch (error) {
      // The walkthrough shows the solution, so it needs what a check needs: a
      // signed-in eligible account, a connection and a server-issued question.
      // When that is why it was refused, the card names the reason and offers
      // the sign-in or retry; nothing was revealed and the question is open.
      const refused = level === 3 ? checkRefusalCopy(checkRefusal(error)) : null;
      if (refused) onRefused?.(error);
      note(level, { text: refused ? t(refused.titleKey) : error?.code === 'EXAM_QUESTION_LOCKED' ? t('tutor.examLocked') : t('tutor.unavailable'), source: 'error' });
    } finally {
      setBusy(0);
    }
  }

  const canAsk = used >= 1 && used < 3;

  async function sendQuestion(event) {
    event?.preventDefault?.();
    const message = cleanTurnText(draft);
    if (!message || asking || busy || !canAsk) return;
    const turnId = newTurnId();
    turnRef.current = turnId;
    setAsking(true);
    setStreaming('');
    setDraft('');
    setTurns(list => [...list, { id: `${turnId}-s`, role: 'student', text: message }]);
    try {
      const r = await api.post(`/practice/${question.id}/tutor/ask`, {
        message, history: historyRef.current, locale, work, turnId
      });
      const text = typeof r?.message === 'string' && r.message.trim() ? r.message : null;
      historyRef.current = Array.isArray(r?.history) ? r.history : historyRef.current;
      setTurns(list => [...list, {
        id: `${turnId}-t`, role: 'tutor', text,
        source: r?.source === 'tutor' ? 'tutor' : 'deterministic',
        offline: r?.source !== 'tutor' && OFFLINE_CODES.has(r?.code),
        guarded: r?.code === 'TUTOR_ANSWER_GUARD'
      }]);
    } catch (error) {
      const code = error?.code;
      setTurns(list => [...list, {
        id: `${turnId}-t`, role: 'tutor', source: 'error',
        text: code === 'EXAM_QUESTION_LOCKED' ? t('tutor.examLocked') : code === 'TUTOR_LEVEL_ORDER' ? t('tutor.askLocked') : t('tutor.askUnavailable')
      }]);
    } finally {
      turnRef.current = null;
      setStreaming('');
      setAsking(false);
      inputRef.current?.focus?.();
    }
  }

  function onDraftKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) sendQuestion(event);
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

      {used < 3 && (
        <form className="tutor-ask" onSubmit={sendQuestion} data-tutor-ask aria-labelledby={`${askId}-h`}>
          <h4 id={`${askId}-h`} className="tutor-ask-title">{t('tutor.askTitle')}</h4>
          <div className="tutor-transcript" role="log" aria-live="polite" aria-relevant="additions text" aria-label={t('tutor.transcript')} data-tutor-transcript>
            {turns.map(turn => (
              <div key={turn.id} className={`tutor-turn tutor-turn-${turn.role} tutor-turn-${turn.source || 'student'}`} data-tutor-turn={turn.role} data-tutor-source={turn.source || 'student'}>
                <span className="tutor-note-src">
                  {turn.role === 'student' ? t('tutor.you') : turn.source === 'tutor' ? t('tutor.fromTutor') : t('tutor.fromHint')}
                </span>
                {turn.offline && <small className="tutor-note-why">{t('tutor.fallbackOffline')}</small>}
                {turn.guarded && <small className="tutor-note-why">{t('tutor.fallbackGuarded')}</small>}
                {turn.text ? <MathText text={turn.text} /> : <span>{t('tutor.noHint')}</span>}
              </div>
            ))}
            {asking && (
              <div className="tutor-turn tutor-turn-tutor tutor-turn-streaming" data-tutor-turn="tutor" data-tutor-source="streaming">
                <span className="tutor-note-src">{t('tutor.fromTutor')}</span>
                {streaming ? <MathText text={streaming} /> : <span className="tutor-thinking" role="status">{t('tutor.thinking')}</span>}
              </div>
            )}
          </div>
          <label htmlFor={`${askId}-in`} className="sr-only">{t('tutor.askLabel')}</label>
          <div className="tutor-ask-row">
            <textarea id={`${askId}-in`} ref={inputRef} className="tutor-ask-input" rows={2} maxLength={MAX_TURN_CHARS}
              value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onDraftKey}
              placeholder={canAsk ? t('tutor.askPlaceholder') : t('tutor.askLocked')}
              disabled={!canAsk || asking || !!busy} data-tutor-ask-input />
            <button type="submit" className="btn btn-sm tutor-ask-send" disabled={!canAsk || asking || !!busy || !cleanTurnText(draft)}
              aria-label={t('tutor.send')} data-tutor-ask-send>
              {asking ? t('tutor.asking') : t('tutor.send')}
            </button>
          </div>
          <small className="tutor-ask-hint">{canAsk ? t('tutor.askHint', { n: MAX_TURN_CHARS }) : t('tutor.askLocked')}</small>
        </form>
      )}
    </section>
  );
}
