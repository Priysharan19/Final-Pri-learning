// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Why this step?" (lazy chunk)
//
// A short, grounded dialogue about ONE step of a resolved question's verified
// solution. The first turn asks why the step is done this way; the student may
// follow up in their own words. Every turn goes through the local backend
// (POST /practice/:id/tutor/why), which adds the verified solution this panel
// never sees, and the server checks that every piece of mathematics in a
// reply is copied from the solution, the question or the student's lines.
//
// It is help when stuck, not a companion and not a mark: plain instrument
// styling, and Premium (with a few free tries a day) on the server.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { MAX_TURN_CHARS, cleanTurnText } from './conversation.js';
import './TutorHelp.css';

export default function WhyStep({ questionId, stepIndex, locale, onClose }) {
  const t = useT();
  const headingId = useId();
  const panelRef = useRef(null);
  const [turns, setTurns] = useState([]);       // { role: 'student' | 'tutor', text, source }
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState(null);   // an i18n key, kept live
  const [draft, setDraft] = useState('');

  async function ask(message) {
    setBusy(true); setNotice(null);
    const history = turns.map(turn => ({ role: turn.role, text: turn.text })).slice(-6);
    try {
      const r = await api.post(`/practice/${questionId}/tutor/why`, { stepIndex, locale, ...(message ? { message, history } : {}) });
      if (r?.message) setTurns(list => [...list, ...(message ? [{ role: 'student', text: message }] : []), { role: 'tutor', text: r.message, source: r.source }]);
      else setNotice(r?.code === 'TUTOR_PREMIUM_REQUIRED' ? 'tutor.why.premium' : 'tutor.why.unavailable');
    } catch (e) {
      setNotice(e?.code === 'TUTOR_PREMIUM_REQUIRED' ? 'tutor.why.premium' : 'tutor.why.unavailable');
    } finally { setBusy(false); }
  }

  useEffect(() => { ask(null); /* one opening turn per panel */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { panelRef.current?.focus(); }, []);

  function send(e) {
    e.preventDefault();
    const text = cleanTurnText(draft).slice(0, MAX_TURN_CHARS);
    if (!text || busy) return;
    setDraft('');
    ask(text);
  }

  return (
    <section className="tutor-panel tutor-why no-print" aria-labelledby={headingId} tabIndex={-1} ref={panelRef} data-tutor-why={stepIndex}>
      <header className="tutor-head">
        <h3 id={headingId}>{t('tutor.why.title', { n: stepIndex + 1 })}</h3>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t('tutor.why.close')}>✕</button>
      </header>
      <div className="tutor-notes" aria-live="polite">
        {turns.map((turn, i) => (
          <div key={i} className={`tutor-note tutor-note-${turn.role === 'tutor' ? (turn.source || 'tutor') : 'you'}`}>
            <span className="tutor-note-src">{turn.role === 'tutor' ? (turn.source === 'tutor' ? t('tutor.fromTutor') : t('tutor.why.fromSolution')) : t('tutor.you')}</span>
            <MathText text={turn.text} />
          </div>
        ))}
        {busy && <p className="tutor-thinking" role="status">{t('tutor.why.asking')}</p>}
        {notice && <p role="status">{t(notice)}</p>}
      </div>
      {turns.length > 0 && (
        <form className="tutor-ask" onSubmit={send}>
          <div className="tutor-ask-row">
            <input className="tutor-ask-input" value={draft} maxLength={MAX_TURN_CHARS} disabled={busy}
              aria-label={t('tutor.why.followUp')} placeholder={t('tutor.why.followUp')} onChange={e => setDraft(e.target.value)} />
            <button type="submit" className="btn btn-ghost tutor-ask-send" disabled={busy || !draft.trim()}>{t('tutor.send')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
