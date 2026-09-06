// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · finding NCERT terms in the app's own English.
//
// The data lives next door in ncertTerms.js, with the argument for why a gloss
// and not a translation. This is the machinery: load it when it is wanted, find
// the terms inside a label the app was already showing, and answer a search
// typed the way an Indian student actually types.
//
// ENGLISH IS NEVER REMOVED. Every function here returns the original English
// text plus, where a term was recognised, the Hindi that goes beside it. There
// is no code path that substitutes one for the other, and the contract suite
// fails if the renderer ever emits a segment whose English has gone missing —
// because the paper this student will sit is bilingual with English final, and
// an app that hides the English is teaching against the exam.
//
// SEPARATE FROM THE INTERFACE LANGUAGE, on purpose. A Hindi-medium student who
// prefers the app's buttons in English is exactly the person this bridge is
// for; making them switch the whole interface to Hindi to get their terminology
// would miss them. `mathsGloss` is its own profile setting, and it is off until
// it is turned on.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';

// ── Loading ──────────────────────────────────────────────────────────────────
// Own chunk, like the Hindi catalogue: an install that never opens the bridge
// never fetches the glossary. vite.config.js names it and keeps it out of the
// service worker's install precache.

let terms = null;
let index = null;
let pending = null;
const listeners = new Set();

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const readTerms = () => terms;

/**
 * Fetch the glossary if it is not already here. Resolves with the terms, or
 * with null when the chunk could not be fetched — offline with it never yet
 * cached, which is a reason to show plain English rather than an error.
 */
export function loadGlossary() {
  if (terms) return Promise.resolve(terms);
  if (!pending) {
    pending = import('./ncertTerms.js')
      .then(m => {
        terms = m.default;
        index = buildIndex(terms);
        for (const fn of listeners) fn();
        return terms;
      })
      .catch(() => { pending = null; return null; });
  }
  return pending;
}

// ── Hinglish ─────────────────────────────────────────────────────────────────
//
// Indian students type Hindi words in Latin letters, and they do not agree with
// each other about how. "त्रिकोणमिति" is written trikonmiti, trikonamiti,
// trikonmithi; "समुच्चय" is samuchchay, samuchay, samucchaya. There is no
// standard to conform to, so nothing here tries to be a transliteration scheme.
// It is a fold: push both sides through the same lossy normalisation until the
// spellings that a person would consider "the same word" collide.
//
// The scheme is a rough Devanagari → Latin first, then the fold, which drops
// vowel length, doubled consonants, aspiration and the s/sh, v/w, c/ch pairs
// that Hinglish spelling never settles.

const DEVANAGARI_LATIN = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ळ': 'l',
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': ''
};

const CONSONANT = /[क-हळ]/;
// A matra, anusvara, visarga or virama — anything that says the consonant
// before it does NOT carry the inherent vowel.
const VOWEL_SIGN = /[ा-ौ्ंँः]/;

/**
 * A rough Latin spelling of a Devanagari word — for matching, never for display.
 *
 * The inherent vowel is the part that has to be right. A bare consonant in
 * Devanagari carries an unwritten 'a', and dropping it turns बहुपद into "bhupd",
 * where the h from ह then looks exactly like the aspiration in भ. A student
 * writes "bahupad". Restoring the inherent 'a' makes those two the same word
 * and keeps aspiration meaning aspiration.
 */
export function latinize(text) {
  const chars = [...String(text).normalize('NFC').replace(/़/g, '')];   // nukta folded away
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    out += Object.prototype.hasOwnProperty.call(DEVANAGARI_LATIN, ch)
      ? DEVANAGARI_LATIN[ch]
      : (/[ऀ-ॿ]/.test(ch) ? '' : ch);
    if (CONSONANT.test(ch) && !VOWEL_SIGN.test(chars[i + 1] || '')) out += 'a';
  }
  return out;
}

/**
 * Collapse a spelling to the form two people who meant the same word would
 * share. Aggressive by design: this decides matches, not display.
 *
 * The order is load-bearing. Digraphs are folded before doubled letters,
 * because "samuchchay" only becomes "samuchay" once ch has become c; doing it
 * the other way round leaves the two spellings apart. Vowels go last because
 * they are what varies most, and removing them first would destroy the
 * long-vowel and aspiration rules above.
 */
export function fold(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zऀ-ॿ]+/g, '')
    .replace(/[ऀ-ॿ]+/g, m => latinize(m))
    .replace(/[^a-z]+/g, '')
    .replace(/ph/g, 'f')                      // फलन: phalan / falan
    .replace(/w/g, 'v')                       // vishesh / wishesh
    .replace(/z/g, 'j')                       // ज़ written z or j
    .replace(/sh/g, 's')                      // shanku / sanku
    .replace(/ch/g, 'c')                      // samuchchay / samuchay
    .replace(/([kgjtdb])h/g, '$1')            // aspiration nobody agrees on
    .replace(/(.)\1+/g, '$1')                 // any doubled letter
    // Vowels vary most between spellings, so they go last — except a
    // word-initial one, which is not spelling variance but meaning. Sanskrit's
    // privative अ- is what separates चर from अचर and परिमित from अपरिमित, and a
    // fold that dropped it would answer "finite" to somebody who typed
    // "infinite". Keeping the first letter keeps the two words apart.
    .replace(/(?!^)[aeiou]/g, '');
}

/**
 * Two indexes, because matching a search box and matching a label are not the
 * same job and must not share a rule.
 *
 * `exact` is what decides whether a word in a chapter name IS a term. It is
 * case-insensitive and nothing more. This matters: the fold below collapses
 * "some" and "सीमा" onto the same key, so a fuzzy match would gloss the English
 * word "Some" in "Some Applications of Trigonometry" as "limit" — confidently,
 * and completely wrongly.
 *
 * `fuzzy` is what answers a search box, where a person typing "trikonmiti" or
 * "samuchay" should find the term they meant. Wrong guesses there cost a
 * student one glance at a filtered list; wrong guesses in a label teach them a
 * word their textbook does not use.
 */
/**
 * The English plural of a term, so the glossary does not have to list one for
 * every noun in it. Chapter names are full of plurals — "Circles", "Triangles",
 * "Surface Areas and Volumes" — and a glossary that only knew the singular
 * would silently miss most of them. An explicit `also` still wins, because the
 * irregular cases are the ones a rule cannot reach.
 */
function pluralOf(word) {
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function buildIndex(list) {
  const exact = new Map();
  const fuzzy = new Map();
  for (const term of list) {
    const spellings = [term.en, ...(term.also || [])];
    // The plural of the last word, which is where an English phrase pluralises:
    // "surface area" → "surface areas", never "surfaces area".
    const plurals = spellings.map(s => s.replace(/(\w+)$/, (w) => pluralOf(w)));
    for (const spelling of [...spellings, ...plurals]) {
      const key = spelling.toLowerCase();
      if (!exact.has(key)) exact.set(key, term);
    }
    for (const spelling of [...spellings, ...plurals, term.hi]) {
      const key = fold(spelling);
      if (key && !fuzzy.has(key)) fuzzy.set(key, term);
    }
  }
  return { exact, fuzzy };
}

/**
 * The term a query names, however it was spelled — English, Devanagari, or
 * Hinglish in Latin letters. Null when nothing matches, which is the honest
 * answer for a word this glossary does not have.
 */
export function findTerm(query) {
  if (!index) return null;
  const literal = index.exact.get(String(query).trim().toLowerCase());
  if (literal) return literal;
  const key = fold(query);
  return key ? index.fuzzy.get(key) || null : null;
}

/**
 * Does this text mention the query? This is what lets a student find
 * "Introduction to Trigonometry" by typing "trikonmiti".
 *
 * Four ways, in order of confidence, because the fold is lossy and leaning on
 * it first would make the filter useless. Plain substring comes first, so
 * "quad" behaves the way a filter box is expected to. Then the query is
 * resolved to a term by any spelling — English, Devanagari or Hinglish — and
 * the label is asked whether it mentions that term; this is the precise path
 * and it carries most of the Hinglish work. Only then does raw folded
 * substring matching apply, and only for a query long enough to survive it:
 * "zzzz" folds all the way down to "j", which would otherwise match every
 * chapter whose Hindi has a j in it.
 */
const MIN_FOLDED = 3;

export function textMatches(text, query) {
  const raw = String(query ?? '').trim().toLowerCase();
  if (!raw) return true;
  const label = String(text ?? '');
  if (label.toLowerCase().includes(raw)) return true;

  const named = findTerm(raw);
  if (named && termsIn(label).some(t => t.en === named.en)) return true;

  const q = fold(raw);
  if (q.length < MIN_FOLDED) return false;
  if (fold(label).includes(q)) return true;
  return termsIn(label).some(t => fold(t.hi).includes(q) || fold(t.en).includes(q));
}

// ── Finding terms inside a label ─────────────────────────────────────────────

/**
 * Split a label into runs of plain text and runs that are a known term.
 *
 * Longest match wins, so "surface area" is one term rather than "area" with a
 * stray word in front of it, and matching is on whole words so "cone" is not
 * found inside "coneflower". A label with nothing known in it comes back as a
 * single plain segment — no gloss, rather than a guess.
 */
export function segment(text) {
  const source = String(text ?? '');
  if (!terms || !source) return [{ text: source, term: null }];

  const words = [...source.matchAll(/[A-Za-z]+/g)];
  const out = [];
  let cursor = 0;
  for (let i = 0; i < words.length;) {
    let hit = null;
    // Terms run to three words ("pair of linear equations" is four but its
    // Hindi title was not verified, so three is the length that pays).
    for (let span = Math.min(3, words.length - i); span >= 1 && !hit; span--) {
      const phrase = source.slice(words[i].index, words[i + span - 1].index + words[i + span - 1][0].length);
      const found = index?.exact.get(phrase.toLowerCase());
      if (found) hit = { found, span, start: words[i].index, end: words[i + span - 1].index + words[i + span - 1][0].length };
    }
    if (!hit) { i++; continue; }
    if (hit.start > cursor) out.push({ text: source.slice(cursor, hit.start), term: null });
    out.push({ text: source.slice(hit.start, hit.end), term: hit.found });
    cursor = hit.end;
    i += hit.span;
  }
  if (cursor < source.length) out.push({ text: source.slice(cursor), term: null });
  return out.length ? out : [{ text: source, term: null }];
}

/**
 * The distinct terms a label mentions, in the order they appear.
 *
 * This is what the renderer uses, rather than splicing Hindi into the middle of
 * the English. "Coordinate · निर्देशांक Geometry · ज्यामिति" is technically
 * correct and horrible to read; "Coordinate Geometry · निर्देशांक, ज्यामिति"
 * leaves the English phrase intact — which is both easier to read and a
 * stronger promise, because the English is not merely present, it is
 * uninterrupted.
 *
 * Deduplicated, so "Areas Related to Circles" does not repeat वृत्त if a label
 * ever mentions the same term twice.
 */
export function termsIn(text) {
  const seen = new Set();
  const found = [];
  for (const part of segment(text)) {
    if (!part.term || seen.has(part.term.en)) continue;
    seen.add(part.term.en);
    found.push(part.term);
  }
  return found;
}

// ── React ────────────────────────────────────────────────────────────────────

/**
 * The glossary, or null while it is still arriving. Components render their
 * plain English until it lands, which is also what they render forever if the
 * chunk cannot be fetched — the English was never conditional on it.
 */
export function useGlossary(enabled) {
  const loaded = useSyncExternalStore(subscribe, readTerms, readTerms);
  if (enabled && !loaded) void loadGlossary();
  return enabled ? loaded : null;
}
