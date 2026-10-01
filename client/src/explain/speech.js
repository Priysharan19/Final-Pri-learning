// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · how Pri Explain speaks.
//
// Two decisions live here, both pure so the Node suites can hold them:
//
//   1. WHICH VOICE. Narration follows the interface language: English is
//      spoken in Indian English (en-IN) and Hindi in Hindi (hi-IN). A device
//      rarely has every voice, so the choice degrades in a fixed order — an
//      exact tag the language registers, then any voice of the same base
//      language (a hi voice with no region), then English, then whatever the
//      platform does with no voice at all. It never picks a voice of an
//      unrelated language: a Hindi sentence read by a French voice is worse
//      than an English one.
//
//   2. HOW MATHS IS SAID. The lines on the board are the verified solution and
//      are never changed. What is changed is the text handed to the speech
//      engine: LaTeX and symbols are turned into words, in the narration
//      language. A Hindi voice reading "\frac{3}{4}" letter by letter, or an
//      English voice reading "x²" as "x two", teaches nothing. Hindi follows
//      the spoken school forms — "3 बटा 4", "x का वर्ग", "x की घात 5",
//      "बराबर" — with postpositions after the operand, as Hindi word order
//      wants.
//
// The engine's prose (worked-solution sentences, marker feedback) stays in
// English by design — see client/test/i18n-check.mjs — so a Hindi narration
// speaks the translated captions in Hindi and the maths in Hindi words, while
// any engine sentence it reads is still the English the board shows.
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULT_LANGUAGE, cleanLanguage, speechTagsOf } from '../i18n/languages.js';

const norm = tag => String(tag || '').replace(/_/g, '-').toLowerCase();
const base = tag => norm(tag).split('-')[0];
const tidy = tag => String(tag).replace(/_/g, '-');

/**
 * The voice to narrate a language with, and the tag to put on the utterance.
 *
 * `voices` is what speechSynthesis.getVoices() returned — possibly empty, as it
 * is on first call in several browsers before `voiceschanged` fires. With no
 * voice the tag alone still asks the platform for the right language.
 *
 * Returns `{ voice, lang, fallback }`, where `fallback` is
 *   'exact'    a voice for one of the language's own tags (hi-IN for Hindi);
 *   'language' a voice of the same base language with another region;
 *   'english'  no voice of the language at all, so English was used;
 *   'none'     no voices were listed; `lang` is still the language's best tag.
 */
export function pickVoice(voices, language = DEFAULT_LANGUAGE) {
  const id = cleanLanguage(language);
  const tags = speechTagsOf(id);
  const list = Array.isArray(voices) ? voices.filter(v => v && v.lang) : [];
  if (!list.length) return { voice: null, lang: tags[0], fallback: 'none' };

  // Prefer a local (on-device) voice where two match equally: it works offline,
  // which a network voice does not.
  const rank = v => (v.localService ? 0 : 1);
  const best = matches => matches.sort((a, b) => rank(a) - rank(b))[0] || null;

  for (const tag of tags) {
    const exact = best(list.filter(v => norm(v.lang) === norm(tag)));
    if (exact) return { voice: exact, lang: tidy(exact.lang), fallback: 'exact' };
  }
  const sameLanguage = best(list.filter(v => base(v.lang) === base(tags[0])));
  if (sameLanguage) return { voice: sameLanguage, lang: tidy(sameLanguage.lang), fallback: 'language' };

  if (id !== 'en') {
    const english = pickVoice(list, 'en');
    if (english.voice) return { ...english, fallback: 'english' };
  }
  return { voice: null, lang: tags[0], fallback: 'none' };
}

// ── Maths into words ────────────────────────────────────────────────────────

const WORDS = {
  en: {
    frac: (a, b) => `${a} divided by ${b}`,
    sqrt: a => `square root of ${a}`,
    squared: a => `${a} squared`,
    cubed: a => `${a} cubed`,
    power: (a, n) => `${a} to the power of ${n}`,
    times: 'times', divide: 'divided by', over: 'divided by', plusMinus: 'plus or minus',
    le: 'less than or equal to', ge: 'greater than or equal to', ne: 'not equal to',
    lt: 'less than', gt: 'greater than',
    equals: 'equals', plus: 'plus', minus: 'minus',
    pi: 'pi', theta: 'theta', degrees: 'degrees'
  },
  hi: {
    frac: (a, b) => `${a} बटा ${b}`,
    sqrt: a => `${a} का वर्गमूल`,
    squared: a => `${a} का वर्ग`,
    cubed: a => `${a} का घन`,
    power: (a, n) => `${a} की घात ${n}`,
    times: 'गुणा', divide: 'भाग', over: 'बटा', plusMinus: 'धन या ऋण',
    le: 'से कम या बराबर', ge: 'से अधिक या बराबर', ne: 'बराबर नहीं',
    lt: 'से कम', gt: 'से अधिक',
    equals: 'बराबर', plus: 'धन', minus: 'ऋण',
    pi: 'पाई', theta: 'थीटा', degrees: 'डिग्री'
  }
};

// The operand a power or root attaches to: a braced group, a bracketed group,
// a number, or a single symbol with an optional subscript.
const OPERAND = String.raw`(\([^()]*\)|\d+(?:\.\d+)?|[A-Za-z](?:_\{?\w+\}?)?)`;

/**
 * The words a speech engine should say for a line of the board, in `language`.
 * The line on screen is not touched; this is only what is spoken.
 */
export function speechText(value, language = DEFAULT_LANGUAGE) {
  const w = WORDS[cleanLanguage(language)] || WORDS.en;
  let s = String(value || '');

  // Structures first, innermost braces only, repeated so nesting resolves.
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => ` ${w.frac(a.trim(), b.trim())} `)
      .replace(/\\sqrt\{([^{}]+)\}/g, (_, a) => ` ${w.sqrt(a.trim())} `);
  }
  // Powers: ^2 and ² are "squared", ^3 and ³ "cubed", anything else a power.
  s = s
    .replace(new RegExp(`${OPERAND}\\s*(?:\\^\\{?2\\}?(?![\\d}])|²)`, 'g'), (_, a) => ` ${w.squared(a)} `)
    .replace(new RegExp(`${OPERAND}\\s*(?:\\^\\{?3\\}?(?![\\d}])|³)`, 'g'), (_, a) => ` ${w.cubed(a)} `)
    .replace(new RegExp(`${OPERAND}\\s*\\^\\{([^{}]+)\\}`, 'g'), (_, a, n) => ` ${w.power(a, n)} `)
    .replace(new RegExp(`${OPERAND}\\s*\\^([\\w-]+)`, 'g'), (_, a, n) => ` ${w.power(a, n)} `);

  s = s
    .replace(/\\times|×|\\cdot/g, ` ${w.times} `)
    .replace(/\\div|÷/g, ` ${w.divide} `)
    .replace(/\\pm|±/g, ` ${w.plusMinus} `)
    .replace(/\\leq?|≤/g, ` ${w.le} `)
    .replace(/\\geq?|≥/g, ` ${w.ge} `)
    .replace(/\\neq|≠/g, ` ${w.ne} `)
    .replace(/\\pi|π/g, ` ${w.pi} `)
    .replace(/\\theta|θ/g, ` ${w.theta} `)
    .replace(/\^\\circ|°/g, ` ${w.degrees} `)
    // A slash between two numbers or single letters is a fraction; between
    // words ("and/or") it is not, and is left for the voice.
    .replace(/(\d|\b[A-Za-z]\b|\))\s*\/\s*(?=\d|\b[A-Za-z]\b|\()/g, (_, a) => `${a} ${w.over} `)
    // Relations and signs, only where they stand as operators: "=" anywhere,
    // "+" anywhere, and "-" only when it is not a hyphen inside a word.
    .replace(/\s*=\s*/g, ` ${w.equals} `)
    .replace(/\s*<\s*/g, ` ${w.lt} `)
    .replace(/\s*>\s*/g, ` ${w.gt} `)
    .replace(/\s*\+\s*/g, ` ${w.plus} `)
    .replace(/\s*−\s*/g, ` ${w.minus} `)
    .replace(/(^|[\s(=,])-(?=\s*[\w(\\])/g, `$1 ${w.minus} `)
    .replace(/(\w|\))\s+-\s+/g, `$1 ${w.minus} `)
    .replace(/[{}$]/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}
