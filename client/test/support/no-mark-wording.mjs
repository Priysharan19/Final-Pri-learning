// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "no screen of the Exam Desk shows a mark" — the one scanner
//
// The desk is unmarked practice (ADR-0002 §8). This reads the TEXT A STUDENT
// SEES on a desk screen and returns every piece of wording that could be read
// as a mark, a score or a verdict: mark/marks/marked, score, grade, band,
// percent or "%", result, correct/incorrect/wrong, "out of N" and any "n/m".
//
// The only wording allowed through is the desk saying that it does NOT mark:
// "not marked", "Nothing is marked", "Nothing (here) was marked" — and their
// Hindi. Those phrases are removed first; anything left that matches is a
// failure. The paper's own title and disclaimer (publisher's text, e.g.
// "100-Mark Practice Examination") are not the desk's wording: callers leave
// them out (the rendered [data-paper-own] nodes).
//
// Used by client/test/desk-ui-check.mjs (rendered markup) and
// client/test/tour-exam-desk.js (the live page, English and Hindi).
// ─────────────────────────────────────────────────────────────────────────────

const SAYS_UNMARKED = {
  en: /\bnot marked\b|\bnothing (?:here )?(?:is|was) marked\b/gi,
  hi: /(?:कोई )?अंक नहीं दि[एय] (?:जाते|गए)/g
};
const MARK_SHAPED = {
  en: [/\bmark(?:s|ed|ing)?\b/gi, /\bscor(?:e|es|ed|ing)\b/gi, /\bgrad(?:e|es|ed|ing)\b/gi, /\bbands?\b/gi, /\bpercent(?:age)?\b/gi,
    /\bresults?\b/gi, /\b(?:in)?correct(?:ly)?\b/gi, /\bwrong\b/gi, /\bout of \d+/gi],
  hi: [/अंक/g, /स्कोर/g, /ग्रेड/g, /बैंड/g, /प्रतिशत/g, /परिणाम/g, /नतीजा/g, /सही/g, /ग़लत|गलत/g]
};
const ANY_LANGUAGE = [/%/g, /\b\d+\s*\/\s*\d+\b/g];

/** Every mark-shaped piece of wording in `text`, for a language ('en' or 'hi'). Empty when there is none. */
export function markWording(text, language = 'en') {
  const lang = language === 'hi' ? 'hi' : 'en';
  // Hindi screens may still carry English (a fallback, a paper's section
  // label), so the English rules always apply too.
  let rest = String(text || '').replace(SAYS_UNMARKED.en, ' ');
  if (lang === 'hi') rest = rest.replace(SAYS_UNMARKED.hi, ' ');
  const found = [];
  for (const re of [...MARK_SHAPED.en, ...(lang === 'hi' ? MARK_SHAPED.hi : []), ...ANY_LANGUAGE]) {
    for (const m of rest.matchAll(re)) found.push(m[0]);
  }
  return found;
}

/** Whether the text says, in plain words, that this is unmarked. */
export const saysUnmarked = (text, language = 'en') => new RegExp(SAYS_UNMARKED[language === 'hi' ? 'hi' : 'en'].source, 'i').test(String(text || ''));

/** The visible text of rendered HTML: tags dropped, the paper's own text ([data-paper-own]) left out. */
export function textOfMarkup(html) {
  return String(html || '')
    .replace(/<([a-z0-9]+)[^>]*\bdata-paper-own\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // `&amp;` last, so an escaped entity in the text ("&amp;lt;") is unescaped once, not twice.
    .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
