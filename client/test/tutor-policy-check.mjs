// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor policy (engine/tutorPolicy.js)
//
//   table        the smallest next step for every cause class, with and
//                without a line, a help request, faded support and an
//                available "See why" view
//   fading       recent unbroken independent success starts lower; stale or
//                assisted evidence does not; policy-helped attempts are not
//                independent
//   exam         off in every exam and one-try mode, whatever else is true
//   recognition  an unconfirmed reading is answered "confirm the reading" in
//                EVERY context — never a maths hint, never a rung
//   authority    a rung action is always the server's next rung; the
//                solution rung is never offered; escalation only goes up;
//                no action reveals the final answer
//   copy         every reachable reason and prompt key exists in English and
//                Hindi, names no value but the line number, and makes no
//                efficacy claim
//
// Usage: node client/test/tutor-policy-check.mjs
// ─────────────────────────────────────────────────────────────────────────────

const SRC = new URL('../src/', import.meta.url).href;
let pass = 0;
const failures = [];
let group = 'table';
const section = n => { group = n; };
const show = v => JSON.stringify(v) ?? String(v);
const ok = (name, cond, detail = '') => { if (cond) { pass++; return true; } failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`); return false; };
const eq = (name, a, b) => ok(name, show(a) === show(b), `expected ${show(b)}, got ${show(a)}`);

const P = await import(`${SRC}engine/tutorPolicy.js`);
const { HINT_RUNGS } = await import(`${SRC}engine/hintLadder.js`);
const { MISCONCEPTIONS } = await import(`${SRC}engine/misconceptions.js`);
const EN = (await import(`${SRC}i18n/strings.en.js`)).default;
const HI = (await import(`${SRC}i18n/strings.hi.js`)).default;

const NOW = Date.UTC(2026, 10, 18, 9);
const DAY = 24 * 3600 * 1000;
const decide = (cause, context = {}, evidence = null) => P.decideNextHelp({ cause, evidence, context: { mode: 'practice', rungLevel: 0, ladderAvailable: true, helpRequested: true, ...context } });
const att = (over = {}) => ({ subtopic: 'g', dotpoint: 'dp-1', correct: true, hintLevel: 0, hintRungs: [], at: NOW - DAY, ...over });
const FADED = P.skillEvidence([att({ at: NOW - 3 * DAY }), att({ at: NOW - 2 * DAY }), att({ at: NOW - DAY })], { skill: 'dp-1', now: NOW });
const FRESH = P.skillEvidence([], { skill: 'dp-1', now: NOW });

// ── Menu and levels ─────────────────────────────────────────────────────────
section('menu');
eq('the fixed menu, smallest dose first', P.ACTIONS, ['keep-going', 'confirm-reading', 'self-check', 'mistake-graph', 'nudge', 'prerequisite', 'method', 'worked']);
eq('every cause class is named', P.CAUSE_CLASSES, ['concept', 'arithmetic', 'method', 'notation', 'recognition', 'unverified', 'none']);
eq('assistance levels follow the PMR ladder and never decrease along the menu',
  P.ACTIONS.map(a => P.ASSISTANCE_LEVEL[a]), ['A0', 'A0', 'A2', 'A2', 'A3', 'A3', 'A4', 'A5']);
eq('rung actions are exactly the three hint rungs below the solution', P.RUNG_ACTIONS, HINT_RUNGS.slice(0, 3));

// ── The table, per cause class ──────────────────────────────────────────────
section('table');
const H = (cls, line = 3) => ({ class: cls, line, confidence: 'high' });
const act = r => r.action;
// concept
eq('concept + See-why view → the mistake graph', act(decide(H('concept'), { mistakeGraph: true })), 'mistake-graph');
eq('concept, no See-why view → the ladder\'s next rung', act(decide(H('concept'))), 'nudge');
eq('concept, needed the method last time, prerequisite known → prerequisite pointer before the rung',
  act(decide(H('concept'), { prerequisite: { id: 'c7-fractions', name: 'Fractions' } }, P.skillEvidence([att({ correct: true, hintLevel: 2, hintRungs: ['nudge', 'method'] })], { skill: 'dp-1', now: NOW }))), 'prerequisite');
eq('concept, faded → a self-check first', act(decide(H('concept'), { mistakeGraph: true }, FADED)), 'self-check');
eq('concept self-check prompt names the line', decide(H('concept'), {}, FADED).prompt, { key: 'tutorPolicy.prompt.concept', params: { line: 3 } });
// arithmetic
eq('arithmetic → self-check on the line', act(decide(H('arithmetic'))), 'self-check');
eq('arithmetic self-check is about the calculation', decide(H('arithmetic')).prompt.key, 'tutorPolicy.prompt.arithmetic');
eq('arithmetic, self-check already offered, See-why view → the mistake graph', act(decide(H('arithmetic'), { offered: ['self-check'], mistakeGraph: true })), 'mistake-graph');
eq('arithmetic, self-check offered, no See-why → next rung', act(decide(H('arithmetic'), { offered: ['self-check'] })), 'nudge');
// method selection
eq('method selection → next rung (the pointer at the idea)', act(decide({ class: 'method', line: null, confidence: 'high' })), 'nudge');
eq('method selection, faded → a planning self-check first', decide({ class: 'method', confidence: 'high' }, {}, FADED).prompt?.key, 'tutorPolicy.prompt.method');
// notation
eq('notation ambiguity → rewrite the line (not a maths hint)', [act(decide(H('notation'))), decide(H('notation')).prompt.key, decide(H('notation')).charges], ['self-check', 'tutorPolicy.prompt.notation', false]);
eq('notation, rewrite already asked, help asked again → next rung', act(decide(H('notation'), { offered: ['self-check'] })), 'nudge');
// recognition
eq('recognition failure → confirm the reading', [act(decide(H('recognition'))), decide(H('recognition')).prompt.key, decide(H('recognition')).level], ['confirm-reading', 'tutorPolicy.prompt.confirmReading', 'A0']);
// unverified
const unv = decide({ class: 'unverified', line: null, confidence: 'low' });
eq('unverified + help → the question\'s own next rung, said to be unverified', [unv.action, unv.reason.key], ['nudge', 'tutorPolicy.reason.unverified']);
eq('unverified, no help asked → keep going, saying it could not check', [act(decide({ class: 'unverified' }, { helpRequested: false })), decide({ class: 'unverified' }, { helpRequested: false }).reason.key], ['keep-going', 'tutorPolicy.reason.unverifiedKeepGoing']);
eq('unverified never carries a line-specific self-check', decide({ class: 'unverified', line: 2, confidence: 'low' }).prompt, null);
// none
eq('no break, no help asked → keep going', [act(decide({ class: 'none' }, { helpRequested: false })), decide({ class: 'none' }, { helpRequested: false }).level], ['keep-going', 'A0']);
eq('no break, help asked → next rung', act(decide({ class: 'none' })), 'nudge');
eq('no break, help asked, faded → general self-check first', [act(decide({ class: 'none' }, {}, FADED)), decide({ class: 'none' }, {}, FADED).prompt.key], ['self-check', 'tutorPolicy.prompt.general']);
// confidence
for (const cls of ['concept', 'arithmetic']) {
  for (const confidence of ['medium', 'low']) {
    const r = decide({ class: cls, line: 4, confidence }, { mistakeGraph: true });
    eq(`${cls} at ${confidence} confidence is never asserted: treated as unverified`, [r.envelope.causeClass, r.action, r.prompt], ['unverified', 'nudge', null]);
  }
}
eq('an unknown cause is unverified, not a guess', decide({ class: 'vibes', line: 2 }).envelope.causeClass, 'unverified');

// ── causeClassOf: engine outputs → cause class ──────────────────────────────
section('cause');
eq('an unconfirmed reading is recognition, before anything else', P.causeClassOf({ recognition: 'unconfirmed', firstBreak: 1, diagnosis: { code: 'arithmetic-slip', confidence: 'high' }, category: 'arithmetic' }).class, 'recognition');
eq('a low-confidence reading is recognition', P.causeClassOf({ recognition: 'low-confidence' }).class, 'recognition');
eq('an ambiguous parse is notation', P.causeClassOf({ parse: 'ambiguous', firstBreak: 0 }), { class: 'notation', line: 1, confidence: 'high' });
eq('a check that did not run is unverified', P.causeClassOf({ checked: false, firstBreak: 2 }).class, 'unverified');
eq('every line holds but the answer is not reached → method selection', P.causeClassOf({ allLinesHold: true, reachedAnswer: false }).class, 'method');
eq('nothing to check → none', P.causeClassOf({}).class, 'none');
eq('a bare counterexample is unverified', P.causeClassOf({ firstBreak: 1, diagnosis: { code: 'counterexample', confidence: 'high' }, category: 'unclassified' }).class, 'unverified');
eq('a medium-confidence diagnosis is unverified, with its line', P.causeClassOf({ firstBreak: 1, diagnosis: { code: 'sign-flipped', confidence: 'medium' }, category: 'copying' }), { class: 'unverified', line: 2, confidence: 'medium' });
const byCategory = {};
for (const m of MISCONCEPTIONS) byCategory[m.category] = P.causeClassOf({ firstBreak: 0, diagnosis: { code: m.id, confidence: 'high' }, category: m.category }).class;
eq('ontology categories map onto cause classes', byCategory, {
  'equation-balance': 'concept', expansion: 'concept', notation: 'notation', indices: 'concept', functions: 'concept', fractions: 'concept', solutions: 'concept',
  'coordinate-geometry': 'concept', probability: 'concept', copying: 'arithmetic', arithmetic: 'arithmetic', unclassified: 'unverified'
});

// ── Fading ──────────────────────────────────────────────────────────────────
section('fading');
ok('two recent unbroken independent successes fade support', P.supportFaded(FADED));
ok('no evidence does not fade', !P.supportFaded(FRESH));
ok('one success does not fade', !P.supportFaded(P.skillEvidence([att()], { skill: 'dp-1', now: NOW })));
ok('stale independent success (over a fortnight) does not fade', !P.supportFaded(P.skillEvidence([att({ at: NOW - 30 * DAY }), att({ at: NOW - 20 * DAY }), att({ at: NOW - 16 * DAY })], { skill: 'dp-1', now: NOW })));
ok('an assisted success after them breaks the streak', !P.supportFaded(P.skillEvidence([att({ at: NOW - 3 * DAY }), att({ at: NOW - 2 * DAY }), att({ at: NOW - DAY, hintLevel: 1, hintRungs: ['nudge'] })], { skill: 'dp-1', now: NOW })));
ok('a wrong answer after them breaks the streak', !P.supportFaded(P.skillEvidence([att({ at: NOW - 3 * DAY }), att({ at: NOW - 2 * DAY }), att({ at: NOW - DAY, correct: false })], { skill: 'dp-1', now: NOW })));
ok('a reveal is never independent', !P.supportFaded(P.skillEvidence([att({ at: NOW - 2 * DAY, revealed: true }), att({ at: NOW - DAY, revealed: true })], { skill: 'dp-1', now: NOW })));
const helped = P.skillEvidence([att({ at: NOW - 2 * DAY, policyAssistance: [{ action: 'self-check', level: 'A2' }] }), att({ at: NOW - DAY, policyAssistance: [{ action: 'self-check', level: 'A2' }] })], { skill: 'dp-1', now: NOW });
eq('an attempt the policy helped above A0 is assisted, not independent', [helped.independentSuccesses, helped.assistedSuccesses, P.supportFaded(helped)], [0, 2, false]);
eq('an A0 offer (keep going / confirm the reading) keeps it independent', P.skillEvidence([att({ policyAssistance: [{ action: 'keep-going', level: 'A0' }] })], { skill: 'dp-1', now: NOW }).independentSuccesses, 1);
eq('evidence is per skill: another dot point does not count', P.skillEvidence([att({ dotpoint: 'dp-2' }), att({ dotpoint: 'dp-2' })], { skill: 'dp-1', now: NOW }).attempts, 0);
eq('the last attempt\'s rungs are kept', P.skillEvidence([att({ hintLevel: 2, hintRungs: ['nudge', 'method'] })], { skill: 'dp-1', now: NOW }).lastRungs, ['nudge', 'method']);
eq('faded support starts LOWER than unfaded for every cause with a line',
  ['concept', 'arithmetic', 'notation'].map(cls => P.ACTIONS.indexOf(decide(H(cls), { mistakeGraph: true }, FADED).action) <= P.ACTIONS.indexOf(decide(H(cls), { mistakeGraph: true }, FRESH).action)), [true, true, true]);
eq('the reason says support was faded', decide(H('concept'), {}, FADED).reason.key, 'tutorPolicy.reason.faded');
eq('the envelope records it', decide(H('concept'), {}, FADED).envelope.faded, true);

// ── Exam and one-try modes: off ─────────────────────────────────────────────
section('exam');
const EVERY_CAUSE = P.CAUSE_CLASSES.flatMap(cls => [{ class: cls, line: 2, confidence: 'high' }, { class: cls, line: null, confidence: 'low' }]);
for (const mode of P.POLICY_OFF_MODES) {
  const all = EVERY_CAUSE.map(c => decide(c, { mode, mistakeGraph: true, prerequisite: { id: 'x', name: 'X' } }, FADED));
  ok(`${mode}: off for every cause`, all.every(r => r.off === 'exam' && r.action === null && r.rung === null && r.charges === false && r.prompt === null && r.reason.key === 'tutorPolicy.reason.exam'));
}
ok('examMode: off in practice mode too', EVERY_CAUSE.every(c => decide(c, { examMode: true }).off === 'exam'));
ok('a one-try question: off', EVERY_CAUSE.every(c => decide(c, { oneTry: true }).off === 'exam'));

// ── Exhaustive: recognition, authority, escalation ─────────────────────────
section('exhaustive');
const offeredSets = [[], ['self-check'], ['self-check', 'mistake-graph'], ['nudge'], ['method'], ['worked'], ['confirm-reading'], ['keep-going']];
const evidences = [null, FRESH, FADED, P.skillEvidence([att({ hintLevel: 3, hintRungs: ['nudge', 'method', 'worked'] })], { skill: 'dp-1', now: NOW })];
let cases = 0, recognitionOk = true, rungOk = true, neverSolution = true, upOnly = true, noAnswer = true, deterministic = true, chargesOnlyRungs = true;
for (const cause of EVERY_CAUSE) for (const rungLevel of [0, 1, 2, 3, 4]) for (const offered of offeredSets) for (const evidence of evidences)
  for (const help of [true, false]) for (const mistakeGraph of [true, false]) for (const prereq of [null, { id: 'c6-x', name: 'X' }]) for (const ladderAvailable of [true, false]) {
    const ctx = { rungLevel, offered, helpRequested: help, mistakeGraph, prerequisite: prereq, ladderAvailable };
    const r = decide(cause, ctx, evidence);
    cases += 1;
    if (show(r) !== show(decide(cause, ctx, evidence))) deterministic = false;
    if (cause.class === 'recognition' && (r.action !== 'confirm-reading' || r.rung !== null || r.charges || r.level !== 'A0')) recognitionOk = false;
    if (r.action === 'solution' || r.rung === 'solution') neverSolution = false;
    if (r.rung && (!ladderAvailable || r.rung !== HINT_RUNGS[rungLevel])) rungOk = false;
    if (r.charges !== !!r.rung) chargesOnlyRungs = false;
    if (r.envelope && r.envelope.revealsFinalAnswer !== false) noAnswer = false;
    if (r.envelope && r.envelope.revealsNextStep !== (r.action === 'worked')) noAnswer = false;
    // Escalation: a non-recognition offer after earlier offers is strictly above them, or keep-going.
    if (cause.class !== 'recognition' && offered.length && r.action && r.action !== 'keep-going') {
      const floor = Math.max(...offered.map(a => P.ACTIONS.indexOf(a)));
      if (P.ACTIONS.indexOf(r.action) <= floor) upOnly = false;
    }
  }
ok(`recognition failure never yields a maths hint, a rung or a charge (${cases} contexts)`, recognitionOk);
ok('a rung action is always the server\'s next rung, and only where the ladder exists', rungOk);
ok('the solution rung is never offered', neverSolution);
ok('only a rung action is marked as charged (and the server charges it, not the policy)', chargesOnlyRungs);
ok('no action reveals the final answer; only the worked step reveals a next step', noAnswer);
ok('escalation only goes up: nothing at or below an earlier offer is repeated', upOnly);
ok('the same input always gives the same decision', deterministic);
const spent = decide({ class: 'none' }, { rungLevel: 3 });
eq('with only the solution left, the policy says so and keeps going', [spent.action, spent.reason.key], ['keep-going', 'tutorPolicy.reason.ladderSpent']);

// ── Copy: every reachable key, en + hi, no values, no efficacy claims ──────
section('copy');
const keys = new Set(['tutorPolicy.ask', 'tutorPolicy.asking', 'tutorPolicy.title', 'tutorPolicy.why', 'tutorPolicy.unavailable', 'tutorPolicy.ladderCost', 'tutorPolicy.action.rung',
  'tutorPolicy.action.keepGoing', 'tutorPolicy.action.confirmReading', 'tutorPolicy.action.selfCheck', 'tutorPolicy.action.mistakeGraph', 'tutorPolicy.action.prerequisite']);
const rendered = [];
for (const cause of EVERY_CAUSE) for (const rungLevel of [0, 1, 2, 3]) for (const offered of offeredSets) for (const evidence of evidences)
  for (const help of [true, false]) for (const mistakeGraph of [true, false]) for (const mode of ['practice', 'exam']) {
    const r = decide(cause, { rungLevel, offered, helpRequested: help, mistakeGraph, mode, prerequisite: { id: 'c6-x', name: 'Fractions' } }, evidence);
    keys.add(r.reason.key);
    if (r.prompt) keys.add(r.prompt.key);
    rendered.push(r);
  }
const GENERAL = new Set(['tutorPolicy.reason.faded', 'tutorPolicy.reason.keepGoing', 'tutorPolicy.reason.unverified', 'tutorPolicy.reason.unverifiedKeepGoing', 'tutorPolicy.reason.ladderSpent', 'tutorPolicy.reason.recognition', 'tutorPolicy.reason.exam']);
const unmapped = rendered.filter(r => !GENERAL.has(r.reason.key) && P.REASON_KEY[`${r.envelope.causeClass}:${r.rung ? 'rung' : r.action}`] !== r.reason.key)
  .map(r => `${r.envelope.causeClass}:${r.action}`);
eq('every specific reason is the table\'s sentence for that cause and action — none falls through', [...new Set(unmapped)], []);
const fill = (s, params) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
const missing = [...keys].filter(k => typeof EN[k] !== 'string' || typeof HI[k] !== 'string');
eq('every reachable key exists in English and Hindi', missing, []);
const unfilled = rendered.flatMap(r => [r.reason, r.prompt].filter(Boolean)).flatMap(({ key, params }) => [fill(EN[key], params), fill(HI[key], params)]).filter(s => /\{\w+\}/.test(s));
eq('every placeholder a reachable string uses is supplied', [...new Set(unfilled)], []);
const valueful = rendered.flatMap(r => [r.reason, r.prompt].filter(Boolean)).flatMap(({ key, params }) => [fill(EN[key], params), fill(HI[key], params)].map(s => s.replace(String(params.line ?? '#'), '')))
  .filter(s => /\d/.test(s));
eq('no policy sentence states a number other than the line number', [...new Set(valueful)], []);
const policyCopy = Object.entries(EN).filter(([k]) => k.startsWith('tutorPolicy.')).map(([, v]) => v).join(' ');
ok('no efficacy or superiority claim in the English copy', !/\b(improv\w*|prove[ns]?|proven|better|best|smartest|guarantee\w*|boost\w*|effective|research shows)\b/i.test(policyCopy), policyCopy.match(/\b(improv\w*|prove[ns]?|proven|better|best|smartest|guarantee\w*|boost\w*|effective|research shows)\b/i)?.[0]);
eq('the English and Hindi catalogues carry the same tutorPolicy keys',
  Object.keys(EN).filter(k => k.startsWith('tutorPolicy.')).sort(), Object.keys(HI).filter(k => k.startsWith('tutorPolicy.')).sort());
ok('the copy uses Commonwealth spelling, so the shared English catalogue reads the same in en-IN and en-AU', !/\b(color|center|analyze|favorite|math\b)/i.test(policyCopy));

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`TUTOR POLICY: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`TUTOR POLICY: PASS — ${pass}/${pass} checks (${cases} exhaustive contexts)`);
