// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Units in a written answer
// A student writes "12 m²", "12 sq m", "12 m^2" or "12 square metres" for the
// same thing, and "12 cm" for a different one. These helpers read the unit a
// student wrote into one canonical spelling so the marker can tell a unit that
// matches the question from one that does not. Deterministic, no model.
// ─────────────────────────────────────────────────────────────────────────────

// canonical spelling ← the ways it is written (lower-cased, spaces collapsed)
const SPELLINGS = {
  mm: ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
  cm: ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'],
  m: ['m', 'metre', 'metres', 'meter', 'meters', 'mtr', 'mtrs'],
  km: ['km', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'kms'],
  g: ['g', 'gm', 'gram', 'grams'],
  kg: ['kg', 'kgs', 'kilogram', 'kilograms'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  l: ['l', 'litre', 'litres', 'liter', 'liters', 'ltr'],
  s: ['s', 'sec', 'secs', 'second', 'seconds'],
  min: ['min', 'mins', 'minute', 'minutes'],
  h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  '°': ['°', 'deg', 'degree', 'degrees']
};
const CANON = new Map();
for (const [c, list] of Object.entries(SPELLINGS)) for (const w of list) CANON.set(w, c);
const POWER = { '²': '²', '2': '²', '^2': '²', '³': '³', '3': '³', '^3': '³' };

/**
 * One unit as its canonical spelling ("sq. metres" → "m²", "km/hr" → "km/h",
 * "m s^-2" is not read), or null when it is not a unit this module knows.
 */
export function canonicalUnit(raw) {
  let s = String(raw ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/\.(?=\s|$)/g, '').trim();
  if (!s) return null;
  if (s === '°') return '°';
  // a rate: km/h, m/s, m/s²
  const rate = s.split(/\s*(?:\/|\bper\b)\s*/);
  if (rate.length === 2) {
    const a = canonicalUnit(rate[0]), b = canonicalUnit(rate[1]);
    return a && b ? `${a}/${b}` : null;
  }
  let power = '';
  const sq = s.match(/^(?:square|sq)\s*(.+)$/), cu = s.match(/^(?:cubic|cu)\s*(.+)$/);
  if (sq) { power = '²'; s = sq[1]; } else if (cu) { power = '³'; s = cu[1]; }
  const tail = s.match(/^(.*?)\s*(\^?[23]|[²³])$/);
  if (tail && !power) { power = POWER[tail[2]]; s = tail[1]; }
  if (s === 'unit' || s === 'units') return `units${power}`;
  const base = CANON.get(s.trim());
  return base ? base + power : null;
}

/** The dimension a canonical unit measures, so km and m compare as lengths. */
function dimension(c) {
  if (!c) return null;
  if (c.includes('/')) return `rate:${c.split('/').map(dimension).join('/')}`;
  const power = /[²³]$/.test(c) ? c.slice(-1) : '';
  const base = power ? c.slice(0, -1) : c;
  if (base === 'units') return `length${power}`;
  const kind = ['mm', 'cm', 'm', 'km'].includes(base) ? 'length'
    : ['g', 'kg'].includes(base) ? 'mass'
      : ['ml', 'l'].includes(base) ? 'volume'
        : ['s', 'min', 'h'].includes(base) ? 'time'
          : base === '°' ? 'angle' : null;
  return kind ? kind + power : null;
}

// The trailing unit of an answer: letters, ², ³, ^2, /, ° and spaces after the
// number. Until this was a hand-written reader it was the pattern
//
//   /(?:\d|\)|π|pi)\s*((?:square|sq\.?|cubic|cu\.?)?\s*[a-zA-Z°][a-zA-Z°.\s]*
//     (?:\^?[23]|[²³])?(?:\s*(?:\/|per)\s*[a-zA-Z]+\.?(?:\^?[23]|[²³])?)?)\s*$/
//
// in which five runs can each take the same space, so a long run of spaces
// that is not followed by a unit was re-read every possible way. `trailingUnit`
// returns what that pattern's match returned — where the match starts, and the
// unit text it captured — by reading each character once.
//
// What the pattern accepts after its lead (a digit, ")", "π" or "pi") is:
// whitespace, then a unit that begins with a letter or "°" and runs on through
// letters, "°", full stops and whitespace; then optionally a power; then
// optionally a rate — "/" or "per", letters, one full stop, a power — and
// finally whitespace to the end. The "square"/"cubic" prefix is itself letters,
// so it never changes what is accepted or captured.
const isSpace = (ch) => /\s/.test(ch);
const isLetter = (ch) => /[a-zA-Z]/.test(ch);
const isUnitStart = (ch) => /[a-zA-Z°]/.test(ch);
const isUnitBody = (ch) => /[a-zA-Z°.\s]/.test(ch);
const skipSpace = (s, at) => { while (at < s.length && isSpace(s[at])) at++; return at; };
/** Where a power written at `at` ends ("^2", "3", "²"), or `at` if there is none. */
function powerEnd(s, at) {
  const c = s[at];
  if (c === '²' || c === '³' || c === '2' || c === '3') return at + 1;
  if (c === '^' && (s[at + 1] === '2' || s[at + 1] === '3')) return at + 2;
  return at;
}
/** The end of a rate's denominator starting at `at`, or -1 if it does not run to the end of the answer. */
function rateEnd(s, at) {
  const from = skipSpace(s, at);
  let end = from;
  while (end < s.length && isLetter(s[end])) end++;
  if (end === from) return -1;
  if (s[end] === '.') end++;
  end = powerEnd(s, end);
  return skipSpace(s, end) === s.length ? end : -1;
}
/** The end of the unit whose body stops at `at` (the first character a body cannot hold), or -1. */
function unitEnd(s, at) {
  if (at === s.length) return at;                    // the body ran to the end, trailing spaces included
  if (s[at] === '/') return rateEnd(s, at + 1);
  const afterPower = powerEnd(s, at);
  if (afterPower === at) return -1;
  const next = skipSpace(s, afterPower);
  if (next === s.length) return afterPower;
  if (s[next] === '/') return rateEnd(s, next + 1);
  if (s.startsWith('per', next)) return rateEnd(s, next + 3);
  return -1;
}
/** `{ index, unit }` for the leftmost lead a unit follows to the end of the answer, or null. */
export function trailingUnit(s) {
  let bodyFrom = -1, bodyStop = -1;                  // the last unit body scanned: [bodyFrom, bodyStop)
  let endFor = -2, end = -1;                         // unitEnd() of the last body stop asked about
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let after;
    if ((c >= '0' && c <= '9') || c === ')' || c === 'π') after = i + 1;
    else if (c === 'p' && s[i + 1] === 'i') after = i + 2;
    else continue;
    const start = skipSpace(s, after);
    if (start === s.length) return null;             // only whitespace is left: no later lead can match either
    if (!isUnitStart(s[start])) continue;
    if (start < bodyFrom || start >= bodyStop) {
      bodyFrom = start;
      bodyStop = start + 1;
      while (bodyStop < s.length && isUnitBody(s[bodyStop])) bodyStop++;
    }
    if (endFor !== bodyStop) { endFor = bodyStop; end = unitEnd(s, bodyStop); }
    if (end >= 0) return { index: i, unit: s.slice(start, end) };
  }
  return null;
}

/** The canonical unit written after an answer's number, or null if none or unknown. */
export function writtenUnit(answerText) {
  const m = trailingUnit(String(answerText ?? '').trim());
  return m ? canonicalUnit(m.unit) : null;
}

/** The answer with a trailing unit this module reads removed ("12 metres" → "12"). */
export function withoutUnit(answerText) {
  const s = String(answerText ?? '').trim();
  const m = trailingUnit(s);
  if (!m || !canonicalUnit(m.unit)) return s;
  // the first place the unit text appears at or after the lead, as before
  return s.slice(0, s.indexOf(m.unit, m.index)).trim();
}

/**
 * Does a unit the student wrote contradict the unit the question asks for?
 * True only when both are units this module reads and they differ — a missing
 * unit, a generic "units", or an unknown spelling never contradicts.
 */
export function unitContradicts(expectedSuffix, answerText) {
  const want = canonicalUnit(expectedSuffix);
  const got = writtenUnit(answerText);
  if (!want || !got || want === got) return false;
  // "square units" accepts any area unit and "units" any length unit
  if (/^units/.test(want)) return dimension(want) !== dimension(got);
  return true;
}

/** Is the question's unit written, as a whole unit, anywhere in the text? */
export function unitWritten(expectedSuffix, texts) {
  const want = canonicalUnit(expectedSuffix);
  if (!want) return null;                       // not a unit this module reads
  for (const t of texts) {
    const s = String(t ?? '');
    if (writtenUnit(s) === want) return true;
    // a unit mid-line: "= 12 m² so" — try every number-then-unit run
    const runs = s.match(/(?:\d|\)|π|pi)\s*(?:square|sq\.?|cubic|cu\.?)?\s*[a-zA-Z°][a-zA-Z°.]*(?:\^?[23]|[²³])?(?:\s*(?:\/|per)\s*[a-zA-Z]+(?:\^?[23]|[²³])?)?/g) || [];
    if (runs.some(r => writtenUnit(r) === want)) return true;
  }
  return false;
}
