// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Report a problem with this question"
//
// A short form under the question: a few fixed reasons and an optional note,
// sent to the server's issue-report route (POST /v1/reports, server/platform/
// reports.js) against the question's own server id. The note is the only free
// text; the answer, the working and the handwriting are never sent.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { newSubmissionId } from './practiceRecovery.js';
import { useT } from '../i18n/index.js';
import { reportFailureKey } from './reportFailure.js';

// Each reason maps to a category the server accepts; a broken page is 'other' and says so in its context.
const REASONS = [
  { id: 'unclear', category: 'ambiguous-wording', key: 'report.reasonUnclear' },
  { id: 'wrong', category: 'wrong-answer', key: 'report.reasonWrong' },
  { id: 'broken', category: 'other', key: 'report.reasonBroken' }
];

export default function QuestionReport({ questionId, onClose, onSent }) {
  const t = useT();
  const uid = useId();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | failed
  const [failKey, setFailKey] = useState('report.failed');
  const formRef = useRef(null);
  // Focus goes to the first field when the form opens and back to the button
  // that opened it when it closes (the opener is whatever held focus on opening).
  useEffect(() => {
    // Safari does not focus a button on click, so fall back to the opener by name.
    const held = document.activeElement;
    const opener = held && held !== document.body ? held : document.querySelector('[data-report-question]');
    formRef.current?.querySelector('input[type="radio"]')?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus?.(); };
  }, []);
  // One key per form, so a second tap after a lost reply does not file the report twice.
  const [key] = useState(() => newSubmissionId());

  async function send(event) {
    event.preventDefault();
    const picked = REASONS.find(r => r.id === reason);
    if (!picked || state === 'sending') return;
    setState('sending');
    try {
      await cloud.reportIssue({
        category: picked.category,
        questionId: String(questionId),
        note: note.trim() || undefined,
        context: { surface: 'question', reason: picked.id }
      }, key);
      onSent();
    } catch (error) {
      setFailKey(reportFailureKey(error, typeof navigator === 'undefined' || navigator.onLine !== false));
      setState('failed');
    }
  }

  return (
    <form ref={formRef} className="q-report" data-question-report onSubmit={send} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <fieldset>
        <legend>{t('report.title')}</legend>
        {REASONS.map(r => (
          <label key={r.id} className="q-report-opt">
            <input type="radio" name={`${uid}-reason`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span>{t(r.key)}</span>
          </label>
        ))}
      </fieldset>
      <label className="q-report-note">
        <span className="sub">{t('report.noteLabel')}</span>
        <textarea className="input" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
      </label>
      {state === 'failed' && <p className="q-report-fail" role="alert" data-report-failure={failKey}>{t(failKey)}</p>}
      <div className="q-report-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!reason || state === 'sending'}>{t('report.send')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('report.cancel')}</button>
      </div>
    </form>
  );
}
