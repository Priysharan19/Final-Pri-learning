// Pri Learning · report narrative helpers (audit #11). Fixed templates over
// the report's own figures; nothing is generated.

// The dot point inside a chapter that lost the most marks in the window, when
// the chapter is an Indian one keyed by dot-point index; otherwise none, and
// the link opens the chapter.
export function worstDotpoint(c, user) {
  if (user?.course !== 'in' || !c?.dotpoints) return null;
  let best = null;
  for (const [key, d] of Object.entries(c.dotpoints)) {
    if (!/^\d+$/.test(key)) continue;
    const lost = (Number(d.possible) || 0) - (Number(d.earned) || 0);
    if (lost > 0 && (!best || lost > best.lost)) best = { key: Number(key), lost };
  }
  return best ? best.key : null;
}

// The change since the previous window, narrated from the series' own delta.
// A side is named only when both windows cleared the report floor (pdiff is
// null otherwise). A change under one point reads as level.
const SINCE = { week: 'inst.trendSinceWeek', month: 'inst.trendSinceMonth', term: 'inst.trendSinceTerm' };
export function trendSentence(shown, period, t) {
  const m = shown?.delta?.methodPct; const a = shown?.delta?.accuracyPct;
  if (!Number.isFinite(m) || !Number.isFinite(a)) return null;
  const pick = (n, up, down, level) => (Math.round(n) >= 1 ? up : Math.round(n) <= -1 ? down : level);
  const method = t(pick(m, 'inst.trendMethodUp', 'inst.trendMethodDown', 'inst.trendMethodLevel'), { n: Math.abs(Math.round(m)) });
  const answer = t(pick(a, 'inst.trendAnswerUp', 'inst.trendAnswerDown', 'inst.trendAnswerLevel'), { n: Math.abs(Math.round(a)) });
  let out = t('inst.trend', { method, answer, since: t(SINCE[period] || SINCE.week) });
  if (Math.round(m) >= 0 && Math.round(a) <= -3) out += ' ' + t('inst.trendLastLine');
  return out;
}

