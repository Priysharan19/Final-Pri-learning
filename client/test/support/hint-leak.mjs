// Does a hint state the final answer? A hint may restate an equation the QUESTION itself prints
// ("f(x) = 1" when the key is also 1); that is exempt only when the restated text equals, after
// normalisation, an equation in the prompt. Any other phrasing of the key (is, equals, gives, so,
// therefore, the answer, the result, = ) is a leak.
export const norm = s => String(s).replace(/\\left|\\right|\\,|\;|\\!|\\ |\$/g, '').replace(/\s+/g, '').replace(/\\dfrac|\\tfrac/g, '\\frac');
const esc = f => String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hintLeaks(hints, finals, prompt, { answerIsX = true } = {}) {
  const bad = [];
  const p = norm(prompt);
  for (const f of new Set((finals || []).map(String))) {
    const re = new RegExp(`(\\S*?)\\s*(=|\\\\Rightarrow|\\bis\\b|\\bequals\\b|\\bgives\\b|\\bso\\b|\\btherefore\\b|\\banswer\\b|\\bresult\\b)\\s*:?\\s*\\$?\\s*${esc(f)}(?!\\d|\\.\\d|[\\\\A-Za-z])`, 'g');
    for (const h of hints || []) {
      for (const m of String(h).replace(/\s+/g, ' ').matchAll(re)) {
        if (m[2] === '=' && m[1]) {
          if (/(^|\$)x$/.test(m[1]) && !answerIsX) continue;
          if (p.includes(norm(`${m[1]}=${f}`))) continue;   // the question's own equation, restated as printed
        }
        bad.push(`"${f}" in: ${h}`);
      }
    }
  }
  return bad;
}

// Self-test: a restated prompt equation passes; any rephrased final answer is caught.
export function hintLeakSelfTest() {
  const prompt = 'Let $f(x) = 2x + 1$. Find $f^{-1}(5)$.';
  const ok = hintLeaks(['Recall $f(x) = 2x + 1$.', 'Solve $2x + 1 = 5$.'], [2], prompt);
  const caught = [
    hintLeaks(['So the answer is 2.'], [2], prompt),
    hintLeaks(['This gives $x = 2$.'], [2], prompt),
    hintLeaks(['Therefore $f^{-1}(5) = 2$.'], [2], prompt),
    hintLeaks(['The result is $2$.'], [2], prompt),
    hintLeaks(['Hence the value equals 2'], [2], prompt)
  ];
  const errors = [];
  if (ok.length) errors.push(`a restated prompt equation was flagged: ${ok.join('; ')}`);
  caught.forEach((c, i) => { if (!c.length) errors.push(`rephrased leak #${i + 1} was not caught`); });
  return errors;
}
