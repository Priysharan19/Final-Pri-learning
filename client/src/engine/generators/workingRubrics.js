// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step-checkable working rubrics for formula questions
//
// A rubric here is a `stepcheck` plan (checker.js `chain: true`, the #430
// first-error / error-carried-forward engine — see
// docs/product/marking-first-error-ecf.md). These helpers only build the plan
// data; the deterministic engine reads the page and decides every mark.
//
// Letters in a plan are single characters. A letter a student writes as a
// symbol (θ) is named by an alias, never by the symbol itself.
//
// A part is one formula and its substitution:
//
//     { letter: 'c', labels: ['V_1'], forms: ['pi*r^2*h'], source: '(22/7)*r^2*h',
//       expected: 1848, why, traps: [{ expr, why }], substitutionTraps: [{ source, why }] }
//
// `letter` is what the part's value is called when a later part combines it;
// a slipped value is carried forward under that letter.
// ─────────────────────────────────────────────────────────────────────────────

const lettersOf = expr => [...new Set((String(expr).replace(/\bpi\b|sqrt/g, '').match(/[a-zA-Z]/g) || []))];

function partStages(part, values, { supporting = false } = {}) {
  const labels = part.labels || [];
  const forms = (part.forms || []).map(expr => ({ expr, letters: lettersOf(expr) }));
  const used = Object.fromEntries(lettersOf(part.source).map(l => [l, values[l]]));
  const stages = [];
  if (forms.length) {
    stages.push({ kind: 'formula', labels, forms, why: part.why, ...(part.traps ? { traps: part.traps } : {}), ...(supporting ? { supporting } : {}) });
  }
  stages.push({
    kind: 'evaluation', source: part.source, substitutions: used, expected: part.expected, labels,
    evidence: 'substitution',
    ...(part.letter ? { yields: [part.letter] } : {}),
    ...(part.bind ? { ecf: { source: part.source, bind: part.bind } } : {}),
    ...(part.substitutionTraps ? { traps: part.substitutionTraps } : {}),
    ...(supporting ? { supporting } : {})
  });
  return stages;
}

/**
 * A plan of one or more parts. `combine` (optional) is the last line that puts
 * the parts together (`c + e`, `s - t`); it binds every part letter, so a part
 * slipped and then combined correctly is error carried forward.
 */
export function formulaPlan({ givens, givensWhy, aliases, parts, combine, identify = false }) {
  const derived = {};
  for (const p of parts) if (p.letter) derived[p.letter] = p.expected;
  const values = { ...givens, ...derived };
  const stages = [];
  if (identify) stages.push({ kind: 'identify', letters: Object.keys(givens) });
  // A part that uses an earlier part's value binds it, so a value slipped
  // above and then used correctly below is error carried forward.
  const bound = part => {
    const bind = lettersOf(part.source).filter(l => l in derived && l !== part.letter);
    return bind.length ? { ...part, bind } : part;
  };
  for (const p of parts) stages.push(...partStages(bound(p), values));
  if (combine) stages.push(...partStages(bound(combine), values));
  return {
    kind: 'plan', chain: true, anyOrder: true, creditPerStage: true, ecf: 'method',
    givens, ...(givensWhy ? { givensWhy } : {}),
    ...(Object.keys(derived).length ? { derived } : {}),
    ...(aliases ? { aliases } : {}),
    stages
  };
}

export const ANGLE_ALIASES = { t: ['θ', 'theta'] };
