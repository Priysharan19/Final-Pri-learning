// Pri Learning · "Not found in your working: step 1 (Antiderivative) and step 3 (Subtract) of the worked solution."
//
// The list of missing steps (engine/missingSteps.js) as one natural phrase: each step named by its number and
// heading, joined as the language joins a list ("a and b", "a, b and c"). Display only; no mark reads it.
const MAX_NAMED = 4;

/** The language's own list join ("and" / "और"), falling back to commas when the runtime has no Intl.ListFormat. */
function join(parts, language) {
  if (parts.length < 2) return parts.join('');
  try { return new Intl.ListFormat(language === 'hi' ? 'hi' : 'en', { style: 'long', type: 'conjunction' }).format(parts); }
  catch { return parts.join(', '); }
}

/**
 * @param {{ step: number, heading: string }[]} missing
 * @param {(key: string, vars?: object) => string} t
 * @param {string} language
 */
export function missingStepsPhrase(missing, t, language = 'en') {
  const named = (Array.isArray(missing) ? missing : []).slice(0, MAX_NAMED)
    .map(m => t('verdict.workingMissing.step', { step: m.step, heading: String(m.heading ?? '').trim() }));
  return join(named, language);
}
