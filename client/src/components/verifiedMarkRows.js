// Defensive display validator. A response or stale cache cannot attach its
// supplemental mark explanation to another question/attempt's actual grade.
// The grade itself comes ONLY from attestedGrade(), never from this module.
export function verifiedMarkBreakdown(result, grade) {
  if (!result || result.authoritative !== true || result.resolved !== true ||
      result.invalid === true || result.revealed === true || !grade) return null;
  const info = result.markRows;
  if (!info || info.scheme !== 'pri-practice-verified-aggregate-v1' ||
      info.attribution !== 'aggregate-only' ||
      Object.hasOwn(info, 'rows') || !info.totals ||
      !Number.isInteger(info.totals.earned) ||
      !Number.isInteger(info.totals.possible) ||
      info.totals.possible < 1 || info.totals.possible > 4 ||
      info.totals.earned < 0 || info.totals.earned > info.totals.possible ||
      info.totals.earned !== grade.awarded || info.totals.possible !== grade.possible ||
      info.totals.earned !== result.marksEarned ||
      info.totals.possible !== result.marksPossible ||
      (result.correct === true && (info.finalAnswer !== 'accepted' || info.method != null)) ||
      (result.correct === false && (info.finalAnswer !== 'not-accepted' ||
        info.totals.earned >= info.totals.possible)) ||
      typeof result.correct !== 'boolean') return null;

  if (info.method != null) {
    if (result.correct !== false || info.workingEvidence === 'not-read' ||
        info.method.attribution !== 'aggregate-only' ||
        !Number.isInteger(info.method.awarded) ||
        info.method.awarded !== info.totals.earned) return null;
  } else if (result.correct === false && info.workingEvidence !== 'not-read') {
    return null;
  }
  if (info.workingEvidence != null && info.workingEvidence !== 'not-read') return null;
  if (Object.hasOwn(info.totals, 'creditedAfterHints')) {
    const after = info.totals.creditedAfterHints;
    if (!Number.isFinite(after) || after < 0 || after >= info.totals.earned) return null;
  }
  return info;
}
