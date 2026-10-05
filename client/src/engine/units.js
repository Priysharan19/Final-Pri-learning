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

// the trailing unit of an answer: letters, ², ³, ^2, /, ° and spaces after the number
const TRAIL = /(?:\d|\)|π|pi)\s*((?:square|sq\.?|cubic|cu\.?)?\s*[a-zA-Z°][a-zA-Z°.\s]*(?:\^?[23]|[²³])?(?:\s*(?:\/|per)\s*[a-zA-Z]+\.?(?:\^?[23]|[²³])?)?)\s*$/;

/** The canonical unit written after an answer's number, or null if none or unknown. */
export function writtenUnit(answerText) {
  const m = String(answerText ?? '').trim().match(TRAIL);
  return m ? canonicalUnit(m[1]) : null;
}

/** The answer with a trailing unit this module reads removed ("12 metres" → "12"). */
export function withoutUnit(answerText) {
  const s = String(answerText ?? '').trim();
  const m = s.match(TRAIL);
  if (!m || !canonicalUnit(m[1])) return s;
  return s.slice(0, s.length - m[0].length + m[0].indexOf(m[1])).trim();
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

// ── Angles ───────────────────────────────────────────────────────────────────
// An angle is the one quantity a student writes in two units that are both
// right: 60° and π/3 are the same answer. The unit is read off the end of what
// was written; a bare multiple of π is radians; a bare number is whatever unit
// the question asked in. Nothing here changes the value — only the unit it is
// read in — so 60 rad can never pass for 60°.

const DEG_TAIL = /(?:°|º|˚|\bdeg(?:ree)?s?\.?)\s*$/i;
const RAD_TAIL = /(?:\brad(?:ian)?s?\.?|ᶜ)\s*$/i;

/** 'deg' | 'rad' | null — the angle unit a student wrote, if any. */
export function angleUnitWritten(answerText) {
  const s = String(answerText ?? '').trim();
  if (DEG_TAIL.test(s)) return 'deg';
  if (RAD_TAIL.test(s)) return 'rad';
  if (/π|\bpi\b/i.test(s)) return 'rad';
  return null;
}

/** The answer with a trailing degree/radian unit removed ("60°" → "60"). */
export function withoutAngleUnit(answerText) {
  return String(answerText ?? '').trim().replace(DEG_TAIL, '').replace(RAD_TAIL, '').trim();
}

/** The angle unit a question's suffix asks in: 'deg' | 'rad' | null. */
export function angleUnitOfSuffix(suffix) {
  const s = String(suffix ?? '').trim();
  if (!s) return null;
  if (/^(?:°|º|˚|deg(?:ree)?s?\.?)$/i.test(s)) return 'deg';
  if (/^(?:rad(?:ian)?s?\.?|ᶜ)$/i.test(s)) return 'rad';
  return null;
}

/** A value read in `from`, expressed in `to`. */
export function convertAngle(value, from, to) {
  if (!Number.isFinite(value) || from === to) return value;
  return from === 'deg' ? value * Math.PI / 180 : value * 180 / Math.PI;
}
