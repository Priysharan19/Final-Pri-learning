// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the live step coach (F1), lazy chunk
//
// While the attempt is open, each FINISHED line the reader has read is checked
// by the server against the worked steps: a tick with the step it reached,
// "doesn't follow from the line above" on the first break under a verified
// line, or nothing. A final-answer line gets only "Press Check". No value and
// no mark: Check alone marks. QuestionCard mounts this only while the server
// says the coach is on for this account and the question is open; it renders
// nothing and reports { verdicts, final } through onChange.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';

export default function StepCoachLive({ questionId, inkResult, onChange }) {
  const t = useT();
  const [coach, setCoach] = useState(null);   // { lines, rows }
  const sentRef = useRef(null);

  useEffect(() => {
    if (!questionId || !inkResult || inkResult.stale === true) return undefined;
    const all = (inkResult.lines || []).map(l => String(l || '').trim());
    // A live read's last line may still be being written: only the lines above it are finished.
    const finished = inkResult.live === true ? all.slice(0, -1) : all;
    if (!finished.length || finished.some(l => !l)) return undefined;
    const key = finished.join('\n');
    if (sentRef.current === key) return undefined;
    sentRef.current = key;
    let live = true;
    api.post(`/practice/${questionId}/tutor/step-coach`, { lines: finished })
      .then(r => { if (live && Array.isArray(r?.stepCoach?.lines)) setCoach({ lines: finished, rows: r.stepCoach.lines }); })
      .catch(() => { });
    return () => { live = false; };
  }, [questionId, inkResult]);

  useEffect(() => {
    let verdicts = null;
    if (coach && inkResult?.stale !== true) {
      const shown = (inkResult?.lines || []).map(l => String(l || '').trim());
      // Drawn only while the lines it judged are still the lines on screen.
      if (coach.lines.every((l, i) => shown[i] === l)) {
        const out = shown.map((_, i) => {
          const r = coach.rows[i];
          if (r?.status === 'ok') return { status: 'ok', note: Number.isInteger(r.step) ? t('ink.coachStep', { n: r.step }) : t('ink.coachOk') };
          if (r?.status === 'break') return { status: 'break', note: t('ink.coachBreak') };
          return { status: 'unknown' };
        });
        if (out.some(v => v.status !== 'unknown')) verdicts = out;
      }
    }
    onChange({ verdicts, final: !!coach && coach.rows.some(r => r?.status === 'final') });
  }, [coach, inkResult, t, onChange]);

  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
