// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the correct-answer sweep
//
// The false-positive sweep asks "is a wrong answer ever credited?". This sweep
// asks the opposite: "is a right answer ever refused?". For every question the
// India curriculum's covers serve — every (generator, difficulty) a cover
// names, at several seeds — each of these is a right answer, and must be
// CREDITED, or refused only by the D13 rule (an operation left to do) with its
// guidance. It is never marked wrong, and never left unread for any other
// reason:
//
//   (a) the key, as the answer box takes it;
//   (b) the key with the box's unit, in every accepted spelling (D14);
//   (c) the key with ₹ or Rs, where the question asks for an amount in rupees;
//   (d) the printed answer — what the server shows after resolution
//       (server/platform/practice.js answerTextFor);
//   (e) a handwritten "Ans: …" final line, as the photo path proposes it
//       (client/src/photo/finalAnswer.js proposeFinalAnswer).
//
// The spellings in (b) and the "asks for an amount" reading in (c) are this
// suite's own, written from the classroom, not read from the marker, so the
// sweep cannot agree with the checker by construction.
//
// SYNTHETIC: the deterministic checker in-process on generated questions. It
// is not evidence about real students' answers.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
const { formatRegion, formatMatrix, formatVector, formatComplex, authoredRegion } = await import(`${SRC}engine/answer-forms.js`);
const { proposeFinalAnswer } = await import(`${SRC}photo/finalAnswer.js`);
const { answerTextFor } = await import('../../server/platform/practice.js');
await loadAllBanks();

const SEEDS = Number(process.argv[2]) || 24;
const D13 = /Work it out first/;
const fmt = x => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));

// ── The cells the India covers serve ────────────────────────────────────────
const cells = new Map();
for (const chapter of IN_CHAPTERS) for (const cover of chapter.covers || []) {
  if (!GENERATORS[cover.gen]) continue;
  for (const d of cover.diff || [1, 2, 3, 4]) cells.set(`${cover.gen}|${d}`, { gen: cover.gen, d });
}

// ── (a) the key ─────────────────────────────────────────────────────────────
function keyOf(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return Number.isFinite(a.value) ? fmt(a.value) : null;
    case 'set': return Array.isArray(a.values) ? a.values.map(fmt).join(', ') : null;
    case 'point': return `(${fmt(a.x)}, ${fmt(a.y)})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'expression': return a.expr ?? null;
    case 'mcq': return String(a.correctIndex);
    case 'interval': { const region = authoredRegion(a); return region ? formatRegion(region, a.variable || 'x') : (a.region || null); }
    case 'matrix': return Array.isArray(a.rows) ? formatMatrix(a.rows) : null;
    case 'vector': return Array.isArray(a.components) ? formatVector(a.components) : null;
    case 'complex': return Number.isFinite(Number(a.re)) ? formatComplex({ re: Number(a.re), im: Number(a.im) }) : null;
    default: return null;
  }
}

// ── (b) the box's unit, every accepted spelling (this suite's own table) ────
const LENGTH = {
  mm: ['mm', 'mms', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
  cm: ['cm', 'cms', 'centimetre', 'centimetres', 'centimeter', 'centimeters'],
  m: ['m', 'metre', 'metres', 'meter', 'meters', 'mtr', 'mtrs'],
  km: ['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers']
};
const LONG = { mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres' };
const WORDS = {
  g: ['g', 'gm', 'gms', 'gram', 'grams'], kg: ['kg', 'kgs', 'kilogram', 'kilograms'],
  ml: ['ml', 'mls', 'millilitre', 'millilitres'], l: ['l', 'L', 'litre', 'litres', 'liter', 'liters', 'ltr', 'ltrs'],
  s: ['s', 'sec', 'secs', 'second', 'seconds'], min: ['min', 'mins', 'minute', 'minutes'], h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  '°': ['°', ' degrees', ' deg'], '%': ['%', ' %', ' percent', ' per cent'],
  'km/h': ['km/h', 'km/hr', 'kmph', 'km per hour', 'kilometres per hour'], 'm/s': ['m/s', 'm per second', 'metres per second'],
  crore: ['crore', 'crores'], lakh: ['lakh', 'lakhs'], million: ['million', 'millions'], thousand: ['thousand', 'thousands'], billion: ['billion', 'billions']
};
/** The spellings of a box's unit, or null when the box shows none. */
function unitSpellings(suffixRaw) {
  const suffix = String(suffixRaw ?? '').trim();
  if (!suffix) return null;
  const lower = suffix.toLowerCase();
  const pow = suffix.match(/^(mm|cm|m|km)\s*(?:\^?([23])|([²³]))$/);
  if (pow) {
    const [base, p] = [pow[1], pow[2] || (pow[3] === '²' ? '2' : '3')];
    const sym = p === '2' ? '²' : '³';
    const out = [`${base}${sym}`, `${base}^${p}`, `${base}${p}`, `${p === '2' ? 'sq' : 'cu'} ${base}`, `${p === '2' ? 'sq.' : 'cu.'} ${base}`, `${p === '2' ? 'square' : 'cubic'} ${LONG[base]}`];
    if (base === 'cm' && p === '3') out.push('cc');
    return out;
  }
  if (LENGTH[suffix]) return LENGTH[suffix];
  for (const [canon, list] of Object.entries(WORDS)) if (canon === suffix || canon === lower || list.map(w => w.trim().toLowerCase()).includes(lower)) return list;
  // A count or other word beside the box ("students", "days"): the word as printed.
  return /^[A-Za-z][A-Za-z ]*$/.test(suffix) ? [suffix] : [suffix];
}

// ── (c) an amount in rupees (this suite's own reading of the question) ──────
const RUPEE = /₹|\bRs\.?(?=\s|\d|$)|\bINR\b|\brupees?\b/i;
const MONEY_ASK = /\b(?:cost|costs|price|amount|money|profit|loss|interest|discount|bill|pays?|paid|earns?|earned|wages?|salary|worth|spend|spent|saves?|saved|savings|tax|gst|fare|rent|fees?|emi|charges?|selling|value)\b/i;
const NOT_MONEY_ASK = /\bhow many\b|percent|percentage|%|\brate\b|\bratio\b|\bfraction\b|\btime\b|\byears?\b|\bmonths?\b|\bdays?\b|\bnumber of\b/i;
function askingSentence(prompt) {
  const parts = String(prompt ?? '').replace(/\$/g, ' ').split(/(?<=[.?!])\s+(?=[A-Z*])/);
  return parts[parts.length - 1] || '';
}
function asksRupees(q) {
  if (q.answerType !== 'numeric') return false;
  const prefix = String(q.answerPrefix ?? ''), suffix = String(q.answerSuffix ?? '').trim();
  if (RUPEE.test(prefix) || RUPEE.test(suffix)) return true;
  if (/^(?:crores?|lakhs?|millions?|thousands?|billions?)$/i.test(suffix)) return RUPEE.test(q.prompt);
  if (suffix) return false;
  const ask = askingSentence(q.prompt);
  return RUPEE.test(q.prompt) && MONEY_ASK.test(ask) && !NOT_MONEY_ASK.test(ask);
}

// ── The sweep ───────────────────────────────────────────────────────────────
const totals = { items: 0, checks: 0, credited: 0, d13: 0, key: 0, unit: 0, rupee: 0, printed: 0, photo: 0, photoNotProposed: 0 };
const failures = [];
const seenItems = new Set();
function judge(kind, id, d, seed, q, input) {
  if (input == null || input === '') return;
  totals.checks++; totals[kind]++;
  let r;
  try { r = checkAnswer(q, input); } catch (e) { r = { correct: false, invalid: true, feedback: `threw ${e.message}` }; }
  if (r.correct === true) { totals.credited++; return; }
  if (r.invalid === true && D13.test(r.feedback || '')) { totals.d13++; return; }
  failures.push(`${kind} · ${id} D${d} seed ${seed} [${q.answerType}${q.answerSuffix ? ` box "${q.answerSuffix}"` : ''}${q.answerPrefix ? ` prefix "${q.answerPrefix}"` : ''}] ${JSON.stringify(input)} → ${r.invalid ? 'UNREAD' : 'WRONG'}: ${String(r.feedback || '').slice(0, 90)} — ${String(q.prompt || '').replace(/\s+/g, ' ').slice(0, 110)}`);
}
for (const { gen, d } of cells.values()) {
  for (let i = 1; i <= SEEDS; i++) {
    const seed = i * 7919 + d * 104729;
    let q;
    try { q = generateQuestion(gen, d, seed); } catch { continue; }
    if (!q || q.answerType === 'working' || q.answerType === 'multi-mcq') continue;
    if (seenItems.has(q.contentHash || `${gen}|${d}|${seed}`)) continue;
    seenItems.add(q.contentHash || `${gen}|${d}|${seed}`);
    totals.items++;
    const key = keyOf(q);
    judge('key', gen, d, seed, q, key);
    if (q.answerType !== 'numeric' || key == null) {
      if (q.answerType !== 'mcq') {
        const printed = String(answerTextFor(q) ?? '');
        if (printed && printed !== key) judge('printed', gen, d, seed, q, printed);
      }
      continue;
    }
    const spellings = unitSpellings(q.answerSuffix);
    if (spellings) for (const unit of spellings) {
      const glue = /^[%°]$/.test(unit) || unit.startsWith(' ') ? '' : ' ';
      judge('unit', gen, d, seed, q, `${key}${glue}${unit}`);
      if (!unit.startsWith(' ') && /^[a-z]{1,3}[²³]?$/i.test(unit)) judge('unit', gen, d, seed, q, `${key}${unit}`);
    }
    if (asksRupees(q) && !q.answer.canonicalInput) {
      const tail = String(q.answerSuffix ?? '').trim() && !RUPEE.test(String(q.answerSuffix)) ? ` ${String(q.answerSuffix).trim()}` : '';
      for (const input of [`₹${key}`, `₹ ${key}`, `Rs ${key}`, `Rs. ${key}`, `${key} rupees`]) judge('rupee', gen, d, seed, q, input + (input.endsWith('rupees') ? '' : tail));
    }
    const printed = String(answerTextFor(q) ?? '');
    if (printed && printed !== key) judge('printed', gen, d, seed, q, printed);
    // (e) the photo path: a handwritten final line "Ans: <printed answer>".
    const proposal = proposeFinalAnswer([`Ans: ${printed || key}`], q);
    if (proposal?.status === 'proposed') judge('photo', gen, d, seed, q, proposal.answer);
    else totals.photoNotProposed++;
  }
}

const head = `${totals.checks} right answers over ${totals.items} India questions (${cells.size} generator×difficulty cells × ${SEEDS} seeds)`;
console.log(`credited ${totals.credited}, refused by D13 with guidance ${totals.d13}; key ${totals.key} · unit ${totals.unit} · rupee ${totals.rupee} · printed ${totals.printed} · photo ${totals.photo} (${totals.photoNotProposed} photo lines proposed nothing — the student is asked to type the answer)`);
console.log(failures.length
  ? `CORRECT-ANSWER SWEEP: FAIL — ${failures.length} right answers refused of ${head}\n  · ${failures.slice(0, Number(process.env.SWEEP_SHOW) || 60).join('\n  · ')}`
  : `CORRECT-ANSWER SWEEP: PASS — 0 of ${head} marked wrong or left unread; ${totals.credited} credited, ${totals.d13} refused only by D13. [SYNTHETIC]`);
if (failures.length) process.exitCode = 1;
