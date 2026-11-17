// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "What should I try next?" — the tutor policy's smallest next
// step, above the hint ladder (lazy chunk; PRI_FEATURE_TUTOR_POLICY, off).
//
// One question to the server (POST /practice/:id/help-plan through the local
// backend); one suggestion back, with the reason in plain words. A suggestion
// that is a hint rung is a button that opens that rung through the card's own
// getHint — the same request, order and charge as pressing the rung. Nothing
// else here costs marks. An account in the experiment's control arm, a dark
// server, or any failure renders nothing more than a one-line note: the
// ladder below is the card exactly as it always was.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';

const ACTION_KEY = {
  'keep-going': 'tutorPolicy.action.keepGoing',
  'confirm-reading': 'tutorPolicy.action.confirmReading',
  'self-check': 'tutorPolicy.action.selfCheck',
  'mistake-graph': 'tutorPolicy.action.mistakeGraph',
  prerequisite: 'tutorPolicy.action.prerequisite'
};
const RUNG_KEY = { nudge: 'verdict.rung.nudge', method: 'verdict.rung.method', worked: 'verdict.rung.worked' };

export default function HelpPlan({ questionId, lines = null, recognition = null, nextRung = null, busy = false, onOpenRung }) {
  const t = useT();
  const [plan, setPlan] = useState(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState(null);
  const [offered, setOffered] = useState([]);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function ask() {
    if (asking) return;
    setAsking(true); setNote(null);
    try {
      const r = await api.post(`/practice/${questionId}/help-plan`, {
        ...(Array.isArray(lines) && lines.length ? { lines } : {}),
        ...(recognition ? { recognition } : {}),
        offered, mistakeGraph: false, helpRequested: true
      });
      if (r?.experiment?.arm === 'control') { setHidden(true); return; }
      if (!r?.plan || !r.plan.action) { setNote(r?.plan?.reason?.key || 'tutorPolicy.unavailable'); setPlan(null); return; }
      setPlan(r.plan);
      setOffered(list => [...list, r.plan.action]);
    } catch (e) {
      if (e?.status === 404) { setHidden(true); return; }
      setNote('tutorPolicy.unavailable');
    } finally { setAsking(false); }
  }

  const rungAction = plan?.rung && plan.rung === nextRung;
  return (
    <section className="hints-block in-help-plan no-print" aria-label={t('tutorPolicy.title')} data-help-plan={plan?.action || 'none'}>
      {plan ? (
        <div className="hintbox" role="status" data-help-plan-action={plan.action} data-help-plan-level={plan.level}>
          <span className="h-n">{rungAction ? t('tutorPolicy.action.rung', { rung: t(RUNG_KEY[plan.rung]) }) : t(ACTION_KEY[plan.action] || 'tutorPolicy.title', plan.prerequisite ? { name: plan.prerequisite.name } : {})}</span>
          {plan.prompt?.key && <p>{t(plan.prompt.key, plan.prompt.params || {})}</p>}
          <p className="muted"><span className="sr-only">{t('tutorPolicy.why')}: </span>{t(plan.reason.key, plan.reason.params || {})}</p>
          {rungAction && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" data-help-plan-open={plan.rung} disabled={busy}
                onClick={() => { setPlan(null); onOpenRung?.(); }}>
                {t('tutorPolicy.action.rung', { rung: t(RUNG_KEY[plan.rung]) })}
              </button>
              <small className="muted">{t('tutorPolicy.ladderCost')}</small>
            </>
          )}
        </div>
      ) : note ? <p className="muted" role="status" data-help-plan-note>{t(note)}</p> : null}
      <button type="button" className="btn btn-quiet btn-sm" data-help-plan-ask disabled={asking || busy} onClick={ask}>
        {asking ? t('tutorPolicy.asking') : t('tutorPolicy.ask')}
      </button>
    </section>
  );
}
