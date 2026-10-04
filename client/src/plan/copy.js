// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · plan copy — the catalogue keys the plan surfaces share.
// ─────────────────────────────────────────────────────────────────────────────
import { practiceHref } from '../lib/practiceLinks.js';

export const SESSION_TYPE_KEYS = Object.freeze({
  review: 'plan.type.review', learn: 'plan.type.learn', practise: 'plan.type.practise', mock: 'plan.type.mock'
});

/** The translated "why" for one session. Dates are shown in the profile's locale. */
export function reasonText(t, session, formatDate = v => v) {
  const r = session?.reason;
  if (!r?.key) return '';
  const vars = { ...(r.vars || {}) };
  if (vars.date) vars.date = formatDate(vars.date);
  return t(r.key, vars);
}

/** Where a session starts: topic practice for a chapter, the exam room for a mock. */
export function sessionHref(session, user) {
  if (!session) return '/practice';
  if (session.type === 'mock') return '/exams';
  const track = user?.course === 'in' ? (user.indiaTrack || 'cbse') : null;
  return practiceHref({ subtopic: session.subtopic, track });
}
