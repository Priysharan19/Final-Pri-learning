// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the trial reminders (day 5 and day 7)
//
// From two days before the 7-day trial ends, and for three days after it has
// ended, one plain line says exactly what happens: it ends on that date, the
// account goes back to Free by itself, and nothing is charged. It links to no
// purchase and asks nothing: a reminder, not an offer. Website only: the store
// apps show nothing about the invitation trial.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useLanguage, useT } from '../i18n/index.js';
import { referralState } from '../platform/referral.js';
import { priNative } from '../platform/native/index.js';
import { localeOf } from '../lib/locale.js';
import { defaultCourse } from '../platform/edition.js';

const DAY = 86_400_000;

export function trialNoticeKey(trial, now = Date.now()) {
  if (!trial?.endsAt) return null;
  if (trial.active && trial.remind) return 'trial.endsSoon';
  if (trial.ended && now - Number(trial.endsAt) < 3 * DAY) return 'trial.ended';
  return null;
}

export default function TrialNotice() {
  const t = useT();
  const { language } = useLanguage();
  const [trial, setTrial] = useState(null);
  useEffect(() => {
    let live = true;
    referralState().then(state => { if (live) setTrial(state?.trial || null); });
    return () => { live = false; };
  }, []);
  // The store apps show nothing about the invitation trial (store rules).
  const key = priNative.isNativeShell() ? null : trialNoticeKey(trial);
  if (!key) return null;
  let when = '';
  try { when = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : localeOf(defaultCourse()), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Number(trial.endsAt))); } catch { when = ''; }
  return <p className="muted" role="status" data-trial-notice={key} style={{ margin: '0 0 14px' }}>{t(key, { when })}</p>;
}
