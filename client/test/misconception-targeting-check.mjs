// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · misconception targeting audit fixes (C1, C2, C3a, C3b, C6)
//
// Deterministic checks of the learner-state rules that decide when a named
// misconception steers practice, when it stops, and what the student is told:
//   C2  a pattern needs two distinct sittings; so does a reactivation;
//   C3a a Step Check / cloud-confirmed misconception is walked back by clean,
//       fully verified working in the same owner (quiet after 2, gone after 4);
//   C3b three seek misses mark it unreachable: no boost, still on record;
//   C1  the submit path records nothing from locally produced feedback;
//   C6  no efficacy wording, and "same slip keeps coming back" only for a
//       question the server attested carries the slip.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const A = await import(new URL('engine/adaptive.js', SRC));
const M = await import(new URL('engine/misconceptions.js', SRC));
const backend = readFileSync(fileURLToPath(new URL('local/backend.js', SRC)), 'utf8');
const en = readFileSync(fileURLToPath(new URL('i18n/strings.en.js', SRC)), 'utf8');
const hi = readFileSync(fileURLToPath(new URL('i18n/strings.hi.js', SRC)), 'utf8');
const adaptiveSrc = readFileSync(fileURLToPath(new URL('engine/adaptive.js', SRC)), 'utf8');

let n = 0;
const fails = [];
const ok = (name, cond, detail = '') => { n++; if (!cond) fails.push(`${name} ${detail}`); };

const T0 = Date.UTC(2026, 9, 1);
const MIN = 60 * 1000;

// Mirror of ratingWithOccurrence's sitting rule (backend.js), applied in order.
function occur(prev, now) {
  const fresh = !prev || (Number(prev.credit) || 0) > 0;
  const newSitting = !prev?.lastAt || now - prev.lastAt >= A.TRAP_SITTING_GAP_MS;
  return { n: Math.min(9, (prev?.n || 0) + 1), credit: 0, firstAt: prev?.firstAt || now, lastAt: now,
    s: Math.min(9, fresh ? 1 : A.trapSittingsOf(prev) + (newSitting ? 1 : 0)), label: 'slip', dotpoint: null };
}
ok('ratingWithOccurrence implements the sitting rule mirrored here',
  backend.includes('s: Math.min(9, fresh ? 1 : trapSittingsOf(prev) + (newSitting ? 1 : 0))'));

// ── C2 ──
let t = occur(null, T0);
t = occur(t, T0 + 30 * 1000);
ok('two slips 30 s apart in one sitting are not a pattern', A.activeTraps({ k: t }, T0 + MIN).length === 0, JSON.stringify(t));
t = occur(t, T0 + 2 * A.TRAP_SITTING_GAP_MS);
ok('a third slip in a later sitting is', A.activeTraps({ k: t }, T0 + 2 * A.TRAP_SITTING_GAP_MS).length === 1);
const quiet = { ...t, credit: A.TRAP_CREDIT_QUIET };
ok('two credits quiet it', A.activeTraps({ k: quiet }, T0 + 3 * A.TRAP_SITTING_GAP_MS).length === 0);
let back = occur(quiet, T0 + 4 * A.TRAP_SITTING_GAP_MS);
ok('one recurrence after repair does not reactivate it at once', A.activeTraps({ k: back }, T0 + 4 * A.TRAP_SITTING_GAP_MS).length === 0, JSON.stringify(back));
back = occur(back, T0 + 4 * A.TRAP_SITTING_GAP_MS + MIN);
ok('nor does a second slip in the same sitting', A.activeTraps({ k: back }, T0 + 4 * A.TRAP_SITTING_GAP_MS + MIN).length === 0);
back = occur(back, T0 + 6 * A.TRAP_SITTING_GAP_MS);
ok('a recurrence in a second sitting does', A.activeTraps({ k: back }, T0 + 6 * A.TRAP_SITTING_GAP_MS).length === 1);
ok('a record written before sittings were counted reads one per occurrence',
  A.activeTraps({ k: { n: 3, credit: 0, lastAt: T0, label: 'x' } }, T0).length === 1);

// ── C3a ──
const verified = { firstBreak: -1, lines: [{ text: '2(x-3)=4', status: 'ok' }, { text: '2x-6=4', status: 'ok' }, { text: 'x=5', status: 'ok' }] };
ok('fully verified working is recognised', M.fullyVerifiedWorking(verified));
ok('a broken line is not', !M.fullyVerifiedWorking({ ...verified, firstBreak: 1, lines: [verified.lines[0], { text: '2x-3=4', status: 'break' }] }));
ok('an unread note line is not', !M.fullyVerifiedWorking({ firstBreak: -1, lines: [verified.lines[0], { text: '??', status: 'note' }] }));
ok('a single line is not', !M.fullyVerifiedWorking({ firstBreak: -1, lines: [verified.lines[0]] }));
ok('no report is not', !M.fullyVerifiedWorking(null));
const ledger = {
  'distribute-sign': { n: 3, s: 2, credit: 0, lastAt: T0, label: 'sign' },
  'arithmetic-slip': { n: 2, s: 2, credit: 0, lastAt: T0, label: 'arith' },
  'probability-wrong-total': { n: 3, s: 2, credit: 0, lastAt: T0, label: 'prob' },
  'own.tabc123': { n: 3, s: 2, credit: 0, lastAt: T0, label: 'authored only' }
};
const repairs = M.verifiedWorkingRepairs(ledger, verified);
ok('verified working repairs Step Check–detectable IDs', repairs.has('distribute-sign') && repairs.has('arithmetic-slip'), [...repairs].join());
ok('but not one only a distractor can detect (#232)', !repairs.has('probability-wrong-total'));
ok('nor a derived authored-trap key', !repairs.has('own.tabc123'));
ok('unverified working repairs nothing', M.verifiedWorkingRepairs(ledger, { firstBreak: 1, lines: [] }).size === 0);
// decayTraps semantics: +1 credit per opportunity, forgotten at 4.
let rec = ledger['distribute-sign'];
const step = r => { const credit = r.credit + 1; return credit < A.TRAP_CREDIT_FORGET ? { ...r, credit } : null; };
rec = step(step(rec));
ok('two verified answers quiet it', A.activeTraps({ 'distribute-sign': rec }, T0).length === 0 && rec.credit === 2);
rec = step(step(rec));
ok('four forget it', rec === null);
ok('resolve() adds verified-working opportunities only for a clean answer',
  backend.includes('if (clean) for (const key of verifiedWorkingRepairs(st.traps, resolution?.stepReport)) opportunities.add(key);'));
ok('the server-marked submit passes the correct answer\'s step report to resolve()',
  backend.includes('stepReport: result.correct ? stepReport || null : null,'));

// ── C3b ──
const live = { n: 3, s: 2, credit: 0, lastAt: T0, label: 'x' };
ok('a reachable live trap boosts its topic', A.trapPressureOf({ k: live }, T0) === 3);
const gone = { ...live, seekMisses: A.TRAP_SEEK_GIVE_UP, unreachable: true };
ok('an unreachable one adds no pressure', A.trapPressureOf({ k: gone }, T0) === 0);
ok('is not sought', A.seekableTraps({ k: gone }, T0).length === 0);
ok('but stays on the record', A.activeTraps({ k: gone }, T0).length === 1);
ok('the give-up is three misses', A.TRAP_SEEK_GIVE_UP === 3);
const SUBS = [{ id: 'sa', weight: 1, own: true }, { id: 'sb', weight: 1, own: true }];
const st = traps => ({ rating: 1200, attempts: 6, correct: 4, last_at: T0 - 86400000, recent: [1, 1, 0], traps });
const pick = traps => A.pickNextAmong({ candidates: SUBS, ratings: { sa: st(traps), sb: st({}) }, reviewsDue: [], rand: 0.5, recent: [], nowMs: T0 });
const liveTraps = { k: { ...live, n: 4 } };
ok('a reachable trap steers practice', pick(liveTraps)?.reason === 'misconception', JSON.stringify(pick(liveTraps)?.reason));
ok('three misses later it does not', pick({ k: { ...liveTraps.k, unreachable: true, seekMisses: 3 } })?.reason !== 'misconception');
ok('misses are counted only for an issued question', /if \(trap\) await noteTrapSeek\(pid, trap, out\.trapDelivered === true\);/.test(backend));
ok('a fresh sighting clears the give-up', !/prev\.unreachable === true \? \{ unreachable: true \}/.test(backend));

// ── C1 ──
const submitBlock = backend.slice(backend.indexOf('let trapHit = null;\n    if (!result.correct && !result.invalid) {'));
const branch = submitBlock.slice(0, submitBlock.indexOf('// The student\'s own work is stored'));
ok('the submit path has a trap-recording block', branch.length > 0);
ok('it records nothing from local feedback', !/recordTrap\(/.test(branch), branch);

// ── C6 ──
const EFFICACY = /fastest|guarantee|will improve|lift your|learning is fastest/i;
const whyLines = adaptiveSrc.split('\n').filter(l => /'weak-spot':|misconception:|MISCONCEPTION_UNTARGETED_WHY =/.test(l));
ok('no adaptive why-string makes an efficacy claim', whyLines.every(l => !EFFICACY.test(l)), whyLines.join('\n'));
const indiaWhy = backend.slice(backend.indexOf('const INDIA_WHY = {'), backend.indexOf('};', backend.indexOf('const INDIA_WHY = {')));
ok('no India why-string makes one', !EFFICACY.test(indiaWhy));
ok('the English success-rate line claims no speed of learning', /'progressAu\.engineNear70': 'The engine aims to keep your success rate near 70%\.'/.test(en));
ok('nor the Hindi one', !/सबसे तेज़ होता/.test(hi) && /'progressAu\.engineNear70': 'इंजन आपकी सफलता दर/.test(hi));
ok('the untargeted reason does not say the slip keeps coming back', !/keeps coming back/i.test(A.MISCONCEPTION_UNTARGETED_WHY));
const choice = pick(liveTraps);
ok('the pick names the slip for when the question carries it', /Same slip keeps coming back/.test(choice.why));
ok('NSW serve swaps in the untargeted reason unless the server attested the trap',
  backend.includes("return choice.reason === 'misconception' && !trapKey ? why.replace(choice.whyPlain, MISCONCEPTION_UNTARGETED_WHY) : why;"));
ok('India serve does the same', backend.includes('why: trapKey ? pick.why : pick.whyUntargeted'));
ok('the India untargeted reason does not say it keeps coming back', /misconception: \(c, trap\) => \(trap \? `Same slip keeps coming back in \$\{c\.name\}: \$\{trap\.label\}` : `Practising \$\{c\.name\}, where the same mistake has come up before\.`\)/.test(backend));

if (fails.length) {
  console.error(fails.map(f => `  ✗ ${f}`).join('\n'));
  console.error(`MISCONCEPTION TARGETING: FAIL — ${n - fails.length}/${n} checks`);
  process.exit(1);
}
console.log(`MISCONCEPTION TARGETING: PASS — ${n}/${n} checks — a pattern needs two sittings, verified working repairs a Step Check misconception, a seek gives up after three misses, local feedback records nothing, and the copy says only what is known.`);
