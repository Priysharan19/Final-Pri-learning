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

/**
 * A short whole-number key (1-2 digits) turns up in a hint by coincidence as often as by leak, so it is only a leak when the
 * hint quotes it as a number the PROMPT never prints: a count the hint has just worked out ("6 people to choose from" when the
 * key is C(6, 1) = 6) is the answer handed over. A number the question itself prints is not.
 */
export function bareNumberLeaks(hints, key, prompt) {
  const f = String(key);
  if (!/^\d+$/.test(f)) return [];
  const token = new RegExp(`(?<![\\d.,\\w])${f}(?![\\d.]\\d|[\\d,\\w])`);
  const inPrompt = token.test(String(prompt).replace(/\$/g, ' ').replace(/\s+/g, ' '));
  if (inPrompt) return [];
  return (hints || []).filter(h => token.test(String(h).replace(/\$/g, ' ').replace(/\s+/g, ' '))).map(h => `"${f}" in: ${h}`);
}

export function bareNumberSelfTest() {
  const prompt = 'A committee of 3 is chosen from 8 students, including Asha and Ben, who must both serve.';
  const errors = [];
  if (!bareNumberLeaks(['There is 1 place left and 6 people to choose from.'], 6, prompt).length) errors.push('a worked-out count equal to the key was not caught');
  if (!bareNumberLeaks(['Choose 1 person from the other $6$.'], 6, prompt).length) errors.push('a count in maths mode equal to the key was not caught');
  if (bareNumberLeaks(['Choose 3 from the list.'], 3, prompt).length) errors.push('a number the prompt prints was flagged');
  if (bareNumberLeaks(['The total is 16 here.'], 6, prompt).length) errors.push('a longer number containing the key was flagged');
  return errors;
}
