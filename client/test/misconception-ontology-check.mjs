// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the misconception ontology contract
//
// One wrong idea must have one identity across the deterministic Step Check,
// the authored traps, the cloud working checker and the learner state. This
// suite is the proof that the identity holds:
//
//   1. INTEGRITY  IDs are unique, kebab-case and never collide with an alias;
//                 every alias resolves; every name and explanation is an i18n
//                 key present in English AND Hindi; every Step Check code has
//                 an entry and every Step Check entry has a code.
//   2. MIRROR     the server's list of IDs the cloud checker may propose, and
//                 the provider schema's enum, are exactly the client's.
//   3. MAPPING    the authored-trap table is deterministic: unique shapes,
//                 every target exists and is marked `authored`, every
//                 `authored` entry is reachable, and every row is still
//                 emitted by a real generator (a stale row maps nothing). The
//                 coverage it achieves is measured and printed, not claimed.
//   4. MIGRATION  legacy text-derived and Step Check keys become ontology IDs;
//                 duplicates merge (occurrences summed, latest recency, lowest
//                 credit); the transform is idempotent and independent of the
//                 order keys were written in, so a replayed or restored ledger
//                 lands on the same result.
//   5. AGREEMENT  a cloud-proposed ID is 'confirmed' only when the
//                 deterministic diagnoser names the same ID on the same line
//                 with a confident check and no on-device break elsewhere;
//                 otherwise it is at most 'possible'.
//   6. RENDERING  the diagnosis card declares the translator it uses — it once
//                 did not, and the first named mistake a student earned threw.
//
// Usage: node client/test/misconception-ontology-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import {
  MISCONCEPTIONS, MISCONCEPTION_IDS, CLOUD_MISCONCEPTION_IDS, AUTHORED_TRAP_SHAPES, ONTOLOGY_VERSION,
  resolveMisconceptionId, misconceptionById, idForDiagnosisCode, misconceptionIdForDiagnosis,
  mappedIdForTrap, misconceptionIdForTrap, trapShape, shapeHash, canonicalLedgerKey,
  migrateTrapLedger, migrateRatingRow, confirmCloudMisconception
} from '../src/engine/misconceptions.js';
import { DIAGNOSIS_CODES, diagnoseStep } from '../src/engine/diagnose.js';
import { misconceptionKey } from '../src/engine/adaptive.js';
import { stepCheck } from '../src/engine/checker.js';
import { GENERATORS, loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { CLOUD_MISCONCEPTION_IDS as SERVER_IDS, OTHER_MISCONCEPTION, MISCONCEPTION_ONTOLOGY_VERSION } from '../../server/platform/misconceptionIds.js';
import { WORKING_SCHEMA, normalizeResult, SYSTEM_INSTRUCTIONS } from '../../server/platform/workingProvider.js';
import { misconceptionProposal } from '../src/ink/cloudWorking.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · Integrity ────────────────────────────────────────────────────────────
const KEBAB = /^[a-z]+(-[a-z]+)*$/;
eq(new Set(MISCONCEPTION_IDS).size, MISCONCEPTION_IDS.length, 'every ontology ID is unique');
ok(MISCONCEPTION_IDS.every(id => KEBAB.test(id)), 'every ID is kebab-case');
ok(MISCONCEPTION_IDS.every(id => /^[A-Za-z0-9._-]{1,80}$/.test(id)), 'every ID is a valid learner-state ledger key (the backend ID_RE)');
const aliases = MISCONCEPTIONS.flatMap(m => m.aliases);
ok(aliases.every(a => !MISCONCEPTION_IDS.includes(a)), 'no alias shadows a canonical ID');
eq(new Set(aliases).size, aliases.length, 'no alias names two entries');
ok(MISCONCEPTIONS.every(m => m.aliases.every(a => resolveMisconceptionId(a) === m.id)), 'every alias resolves to its canonical ID');
ok(MISCONCEPTIONS.every(m => resolveMisconceptionId(m.id) === m.id), 'every ID resolves to itself');
eq(resolveMisconceptionId('not-a-misconception'), null, 'an unknown ID resolves to nothing');
ok(MISCONCEPTIONS.every(m => typeof m.category === 'string' && m.category.length > 0), 'every entry has a category');
const DETECTORS = new Set(['step-check', 'authored', 'cloud']);
ok(MISCONCEPTIONS.every(m => m.detectors.length > 0 && m.detectors.every(d => DETECTORS.has(d))), 'every entry names at least one known detector');
ok(Number.isInteger(ONTOLOGY_VERSION) && ONTOLOGY_VERSION >= 1, 'the ontology is versioned');
eq(MISCONCEPTION_ONTOLOGY_VERSION, ONTOLOGY_VERSION, 'and the server mirror carries the same version');

const missingI18n = [];
for (const m of MISCONCEPTIONS) {
  for (const key of [m.name, m.explain]) {
    if (!/^misconception\.[A-Za-z]+\.(name|explain)$/.test(key)) missingI18n.push(`${m.id}: malformed key ${key}`);
    if (typeof en[key] !== 'string' || !en[key].trim()) missingI18n.push(`${m.id}: ${key} missing in English`);
    if (typeof hi[key] !== 'string' || !hi[key].trim()) missingI18n.push(`${m.id}: ${key} missing in Hindi`);
    else if (hi[key] === en[key]) missingI18n.push(`${m.id}: ${key} left in English in Hindi`);
  }
}
eq(missingI18n, [], 'every name and explanation exists in English and Hindi');
eq(new Set(MISCONCEPTIONS.map(m => m.name)).size, MISCONCEPTIONS.length, 'every entry has its own name key');
ok(MISCONCEPTIONS.every(m => en[m.explain].length <= 140), 'explanations are short enough to read under a line of working');
ok(['verdict.lineMisconception', 'verdict.possibleMisconception'].every(k => en[k]?.includes('{n}') && en[k]?.includes('{name}') && hi[k]?.includes('{n}') && hi[k]?.includes('{name}')),
  'the "Line N: name" sentence carries both placeholders in both languages');

const stepEntries = MISCONCEPTIONS.filter(m => m.detectors.includes('step-check')).map(m => m.id).sort();
eq(stepEntries, [...DIAGNOSIS_CODES].sort(), 'every Step Check diagnosis code is an ontology entry, and every step-check entry is a code');
ok(DIAGNOSIS_CODES.every(code => idForDiagnosisCode(code) === code), 'a diagnosis code maps to the ID of the same name');
eq(idForDiagnosisCode('fraction-acros'), null, 'a misspelt code maps to nothing');
eq(misconceptionById('counterexample')?.recordable, false, 'a bare counterexample is not a recordable misconception');
eq(misconceptionIdForDiagnosis({ code: 'counterexample' }), null, 'so it never becomes a learner-state key');
ok(!CLOUD_MISCONCEPTION_IDS.includes('counterexample'), 'and the cloud checker cannot propose it');
eq(misconceptionIdForDiagnosis({ code: 'sign-on-transfer', confidence: 'high' }), 'sign-on-transfer', 'a named diagnosis is keyed by its ontology ID');

// Every diagnosis the engine actually produces carries an ontology identity.
const PRODUCED = [
  ['3x + 5 = 20', '3x = 20 + 5', 'sign-on-transfer'],
  ['2(x + 4) = 18', '2x + 4 = 18', 'distribute-partial'],
  ['10 - (x + 3)', '10 - x + 3', 'distribute-sign'],
  ['(a + b)^2', 'a^2 + b^2', 'power-of-sum'],
  ['(x^2)^3', 'x^5', 'power-of-power'],
  ['1/2 + 1/3', '2/5', 'fraction-across'],
  ['(x + 6)/2', 'x + 3', 'cancel-over-sum']
];
for (const [prev, broken, want] of PRODUCED) {
  const d = diagnoseStep({ prevText: prev, brokenText: broken });
  eq(misconceptionIdForDiagnosis(d), want, `diagnoseStep(${prev} → ${broken}) is recorded as ${want}`);
}

// ── 2 · Server mirror and provider schema ────────────────────────────────────
eq([...SERVER_IDS], [...CLOUD_MISCONCEPTION_IDS], 'the server list of proposable IDs is exactly the client ontology’s');
eq(WORKING_SCHEMA.properties.misconception_id.enum, [...CLOUD_MISCONCEPTION_IDS, OTHER_MISCONCEPTION, null],
  'the provider schema constrains misconception_id to ontology IDs, "other" and null');
ok(WORKING_SCHEMA.required.includes('misconception_id'), 'strict structured output: the field is required and nullable');
ok(/misconception_id/.test(SYSTEM_INSTRUCTIONS) && /never a hint at the answer/i.test(SYSTEM_INSTRUCTIONS), 'the prompt names the field and keeps it answer-free');
const normalized = (extra, lines = 3, firstBreak = 1) => normalizeResult({
  lines: Array.from({ length: lines }, (_, i) => ({ index: i, status: i === firstBreak ? 'break' : 'ok', carried: false, why: '' })),
  first_break: firstBreak, hint: '', confidence: 0.9, ...extra
}, { lineCount: lines, model: 'test', confidenceFloor: 0.75 });
eq(normalized({ misconception_id: 'sign-on-transfer' }).misconceptionId, 'sign-on-transfer', 'a listed ID survives normalisation');
eq(normalized({ misconception_id: 'other' }).misconceptionId, null, '"other" is no proposal');
eq(normalized({ misconception_id: 'made-up' }).misconceptionId, null, 'an unlisted string is dropped');
eq(normalized({ misconception_id: null }).misconceptionId, null, 'null is no proposal');
eq(normalized({ misconception_id: 'sign-on-transfer' }, 3, -1).misconceptionId, null, 'a proposal with no break is dropped');

// ── 3 · The authored-trap mapping ────────────────────────────────────────────
const shapes = AUTHORED_TRAP_SHAPES.map(r => r.shape);
eq(new Set(shapes).size, shapes.length, 'every mapped shape appears once');
eq(new Set(shapes.map(shapeHash)).size, shapes.length, 'and no two shapes share a hash');
ok(AUTHORED_TRAP_SHAPES.every(r => trapShape(r.shape) === r.shape), 'every row is written in normalised shape form');
const badTargets = AUTHORED_TRAP_SHAPES.filter(r => !misconceptionById(r.id) || r.id !== resolveMisconceptionId(r.id) || !misconceptionById(r.id).detectors.includes('authored'));
eq(badTargets.map(r => r.id), [], 'every mapping target exists, is canonical and is marked as an authored detector');
const unreachable = MISCONCEPTIONS.filter(m => m.detectors.includes('authored') && !AUTHORED_TRAP_SHAPES.some(r => r.id === m.id)).map(m => m.id);
eq(unreachable, [], 'every entry marked authored has at least one mapped trap');
ok(AUTHORED_TRAP_SHAPES.every(r => mappedIdForTrap(r.shape.replace(/#/g, '7')) === r.id), 'a sentence of each shape maps to its ID whatever its numbers');
eq(mappedIdForTrap('An explanation nobody mapped.'), null, 'an unmapped sentence maps to nothing');
// Mapping audit: sentences that LOOK like a named misconception but describe
// a different slip must stay on their derived IDs. These two quadratic-formula
// traps fire when the student answers plain −b — the ±√ part was dropped and
// nothing was divided — which is not cancelling one term of a sum.
const MUST_STAY_UNMAPPED = [
  'The formula is $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ — the $-b$ is only the first part of the numerator, and the whole numerator is divided by $2a$.',
  '$-b = 7$ is only the first term of the numerator; the whole numerator is still divided by $2a = 4$.'
];
eq(MUST_STAY_UNMAPPED.map(why => mappedIdForTrap(why)), [null, null], 'mapping audit: the quadratic-formula "−b only" traps keep derived IDs, not cancel-over-sum');
eq(misconceptionIdForTrap('y8-algebra', 'An explanation nobody mapped.'), misconceptionKey('y8-algebra', 'An explanation nobody mapped.'),
  'an unmapped trap keeps the derived ID it always had — nothing is lost');

// Every row must still be produced by a real generator, and the coverage the
// table achieves is measured over a fixed, seeded sweep of every bank.
await loadAllBanks();
const SEEDS = 400;
const seen = new Map();          // shape → occurrences
let probes = 0;
let mappedProbes = 0;
for (const id of Object.keys(GENERATORS).sort()) {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= SEEDS; s++) {
      let q;
      try { q = generateQuestion(id, d, s * 7919 + d); } catch { continue; }
      for (const item of [q, ...(Array.isArray(q.parts) ? q.parts : [])]) {
        const list = [
          ...(Array.isArray(item.traps) ? item.traps : []),
          ...Object.values(item.answer?.optionTraps || {}).map(why => ({ why }))
        ];
        for (const t of list) {
          if (!t?.why) continue;
          const shape = trapShape(t.why);
          if (!shape) continue;
          probes++;
          if (mappedIdForTrap(t.why)) mappedProbes++;
          seen.set(shape, (seen.get(shape) || 0) + 1);
        }
      }
    }
  }
}
const stale = shapes.filter(sh => !seen.has(sh));
eq(stale, [], 'every mapped shape is still emitted by a generator');
const mappedShapes = shapes.filter(sh => seen.has(sh)).length;
const coverage = {
  distinctShapes: seen.size, mappedShapes,
  probes, mappedProbes,
  byId: Object.fromEntries(MISCONCEPTION_IDS.map(id => [id, AUTHORED_TRAP_SHAPES.filter(r => r.id === id).length]).filter(([, n]) => n > 0))
};
ok(coverage.distinctShapes > 1000, `the sweep read the banks (${coverage.distinctShapes} distinct trap shapes)`);

// ── 4 · Migration ────────────────────────────────────────────────────────────
const OWNER = 'y8-algebra';
const signShape = AUTHORED_TRAP_SHAPES.find(r => r.id === 'sign-on-transfer').shape;
const legacyText = misconceptionKey(OWNER, signShape.replace(/#/g, '3'));
const legacyUnmapped = misconceptionKey(OWNER, 'Some slip with no ontology entry.');
eq(canonicalLedgerKey(legacyText), 'sign-on-transfer', 'a mapped text-derived key converts to its ontology ID');
eq(canonicalLedgerKey(`${OWNER}.step-fraction-across`), 'fraction-across', 'a Step Check key converts to its ontology ID');
eq(canonicalLedgerKey('c10-quadratic-roots.step-fraction-across'), 'fraction-across', 'whatever owner prefix it was written under');
eq(canonicalLedgerKey(`${OWNER}.step-counterexample`), `${OWNER}.step-counterexample`, 'a non-recordable step key is left alone rather than invented into a misconception');
eq(canonicalLedgerKey(`${OWNER}.step-not-a-code`), `${OWNER}.step-not-a-code`, 'an unknown step code is left alone');
eq(canonicalLedgerKey(legacyUnmapped), legacyUnmapped, 'an unmapped text key is already its derived ID');
eq(canonicalLedgerKey('sign-on-transfer'), 'sign-on-transfer', 'a canonical ID is unchanged');

const rec = (n, credit, firstAt, lastAt, label, dotpoint = null) => ({ n, credit, firstAt, lastAt, label, dotpoint });
const legacy = {
  [`${OWNER}.step-sign-on-transfer`]: rec(2, 1, 100, 500, 'step title', 'dp-1'),
  [legacyText]: rec(3, 0, 200, 900, 'authored sentence'),
  'sign-on-transfer': rec(1, 2, 50, 300, 'already canonical'),
  [legacyUnmapped]: rec(2, 0, 10, 20, 'unmapped')
};
const { traps: m1, changed: c1 } = migrateTrapLedger(legacy);
ok(c1, 'a legacy ledger reports that it changed');
eq(Object.keys(m1).sort(), [legacyUnmapped, 'sign-on-transfer'].sort(), 'three records of one misconception become one');
eq(m1['sign-on-transfer'].n, 6, 'occurrences are summed');
eq(m1['sign-on-transfer'].credit, 0, 'the lowest repair credit is kept — a merge never looks more repaired');
eq(m1['sign-on-transfer'].lastAt, 900, 'the latest sighting is kept');
eq(m1['sign-on-transfer'].firstAt, 50, 'the earliest first sighting is kept');
eq(m1['sign-on-transfer'].label, 'authored sentence', 'the display label comes from the most recent sighting');
eq(m1['sign-on-transfer'].dotpoint, 'dp-1', 'a known dot point is not lost to a record without one');
eq(m1[legacyUnmapped], legacy[legacyUnmapped], 'an unmapped record is untouched');
eq(migrateTrapLedger({ a: rec(9, 0, 1, 2, 'x'), [`${OWNER}.step-term-dropped`]: rec(5, 0, 1, 3, 'y'), 'term-dropped': rec(6, 0, 1, 4, 'z') }).traps['term-dropped'].n, 9,
  'summed occurrences are capped where the ledger caps them');

const { traps: m2, changed: c2 } = migrateTrapLedger(m1);
ok(!c2 && m2 === m1, 'the migration is idempotent: a canonical ledger comes back as the same object');
// Order independence: however the keys were written, replayed or restored,
// the result is the same.
const entries = Object.entries(legacy);
const permutations = [entries, [...entries].reverse(), [entries[2], entries[0], entries[3], entries[1]], [entries[1], entries[3], entries[2], entries[0]]];
const results = permutations.map(list => JSON.stringify(migrateTrapLedger(Object.fromEntries(list)).traps, Object.keys(m1).sort().concat(['n', 'credit', 'firstAt', 'lastAt', 'label', 'dotpoint'])));
ok(results.every(r => r === results[0]), 'the migrated ledger does not depend on the order its keys were written');
// A restored backup or a pulled cloud copy that still holds legacy keys,
// arriving after the device already migrated, folds into the same record.
const restored = migrateTrapLedger({ ...m1, [`${OWNER}.step-sign-on-transfer`]: rec(1, 0, 1000, 1200, 'replayed') }).traps;
eq([restored['sign-on-transfer'].n, restored['sign-on-transfer'].lastAt, restored['sign-on-transfer'].label], [7, 1200, 'replayed'],
  'a legacy record replayed after migration merges into the canonical one');
eq(migrateTrapLedger(restored).traps, restored, 'and stays put on every later read');
eq(migrateTrapLedger(null), { traps: {}, changed: false }, 'a row with no ledger reads as an empty one');
const row = { key: 'p:y8-algebra', subtopic: OWNER, rating: 1200, traps: legacy };
const migratedRow = migrateRatingRow(row);
ok(migratedRow !== row && migratedRow.rating === 1200 && migratedRow.traps['sign-on-transfer'], 'a rating row keeps every other field when its ledger migrates');
ok(migrateRatingRow(migratedRow) === migratedRow, 'and a migrated row reads back as itself');
ok(migrateRatingRow(undefined) === undefined, 'a missing row stays missing');

// ── 5 · The cloud agreement rule ─────────────────────────────────────────────
const lines = ['2(x + 3) = 10', '2x + 3 = 10', 'x = 3.5'];
eq(diagnoseStep({ prevText: lines[0], brokenText: lines[1] })?.confidence, 'high', 'the agreement fixture is a genuinely high-confidence diagnosis');
const base = { proposedId: 'distribute-partial', firstBreak: 1, lines, confident: true };
eq(confirmCloudMisconception(base)?.status, 'confirmed', 'agreement on the same line with a confident check is confirmed');
eq(confirmCloudMisconception({ ...base, confident: false })?.status, 'possible', 'an unconfident check is only possible');
eq(confirmCloudMisconception({ ...base, proposedId: 'fraction-across' })?.status, 'possible', 'a different misconception on the same line is only possible');
// When several slips reproduce the line the diagnoser is only 'medium' sure,
// and a model proposing one of them must not get to choose which is recorded.
// -(x + 3) = 5 → -x + 3 = 5 is really a distributed minus; the engine's top
// medium guess is sign-on-transfer.
const ambiguous = diagnoseStep({ prevText: '-(x + 3) = 5', brokenText: '-x + 3 = 5' });
eq(ambiguous?.confidence, 'medium', 'the ambiguous fixture is a medium-confidence diagnosis');
eq(confirmCloudMisconception({ proposedId: misconceptionIdForDiagnosis(ambiguous), firstBreak: 1, lines: ['-(x + 3) = 5', '-x + 3 = 5'], confident: true })?.status, 'possible',
  'a proposal agreeing with a medium diagnosis is only possible — the model does not pick among the engine’s hypotheses');
eq(confirmCloudMisconception({ proposedId: 'sign-on-transfer', firstBreak: 1, lines: ['3x + 5 = 20', '3x = 20 + 5'], confident: true })?.status, 'possible',
  'nor does any other medium diagnosis become a record');
eq(confirmCloudMisconception({ ...base, firstBreak: 2 })?.status, 'possible', 'the same misconception on another line is only possible');
eq(confirmCloudMisconception({ ...base, localFirstBreak: 0 })?.status, 'possible', 'an on-device break on another line outranks the proposal');
eq(confirmCloudMisconception({ ...base, localFirstBreak: 1 })?.status, 'confirmed', 'an on-device break on the same line agrees with it');
eq(confirmCloudMisconception({ ...base, proposedId: 'other' }), null, '"other" is no proposal');
eq(confirmCloudMisconception({ ...base, proposedId: 'counterexample' }), null, 'a non-recordable ID cannot be proposed');
eq(confirmCloudMisconception({ ...base, firstBreak: -1 }), null, 'no break, no proposal');
eq(confirmCloudMisconception({ ...base, firstBreak: 9 }), null, 'a break past the working is no proposal');
eq(confirmCloudMisconception({ ...base, lines: ['3x + 5 = 20', '3x + 5 = 20'] })?.status, 'possible', 'a line that still holds cannot be confirmed as a mistake');
// The real Step Check agrees with itself: where it finds the break, the same
// misconception proposed on that line is confirmed.
const meta = { kind: 'equation', variable: 'x', solutions: [2] };
const local = stepCheck(meta, lines.join('\n'));
eq(local.firstBreak, 1, 'Step Check places this break on line 2');
eq(confirmCloudMisconception({ ...base, meta, localFirstBreak: local.firstBreak })?.status, 'confirmed', 'and agrees with a proposal of the misconception it names there');

// The client re-expresses a proposal in the engine's index space.
const proposal = misconceptionProposal({ misconceptionId: 'distribute-partial', firstBreak: 3, needsConfirmation: false, lines: [] }, ['2(x + 3) = 10', '', ' ', '2x + 3 = 10']);
eq(proposal?.body, { lines: ['2(x + 3) = 10', '2x + 3 = 10'], firstBreak: 1, misconceptionId: 'distribute-partial', confident: true }, 'blank ink lines are dropped and the break index follows');
eq(proposal?.displayLine, 4, 'while the student is still shown the line number on their page');
eq(misconceptionProposal({ misconceptionId: null, firstBreak: 1 }, lines), null, 'no proposal, nothing to ask');
eq(misconceptionProposal({ misconceptionId: 'sign-on-transfer', firstBreak: 1, needsConfirmation: true }, lines)?.body.confident, false, 'an unsure check is sent as unsure');

// ── 6 · The diagnosis card declares what it uses ─────────────────────────────
// Every top-level component in QuestionCard.jsx that calls t() must declare it.
const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
const undeclared = [];
for (const match of card.matchAll(/^function ([A-Z][A-Za-z0-9]*)\(([^)]*)\)\s*\{/gm)) {
  let depth = 0;
  let end = match.index + match[0].length - 1;
  for (; end < card.length; end++) {
    if (card[end] === '{') depth++;
    else if (card[end] === '}' && --depth === 0) break;
  }
  const body = card.slice(match.index + match[0].length, end);
  if (/[^.\w]t\(/.test(body) && !/const t = useT\(\)/.test(body) && !/\bt\b/.test(match[2])) undeclared.push(match[1]);
}
eq(undeclared, [], 'every component that translates declares its translator');
ok(/function Diagnosis\(\{ d, line \}\)[\s\S]{0,400}const t = useT\(\)/.test(card), 'the diagnosis card in particular');
ok(/misconceptionById\(d\.code\)/.test(card) && /verdict\.lineMisconception/.test(card), 'and it names the misconception as "Line N: name"');

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`  ontology v${ONTOLOGY_VERSION}: ${MISCONCEPTION_IDS.length} IDs (${CLOUD_MISCONCEPTION_IDS.length} proposable by the cloud checker, ${stepEntries.length} named by Step Check)`);
console.log(`  authored-trap mapping: ${coverage.mappedShapes} of ${coverage.distinctShapes} distinct trap shapes mapped; ${coverage.mappedProbes} of ${coverage.probes} sampled trap occurrences (${(100 * coverage.mappedProbes / Math.max(1, coverage.probes)).toFixed(1)}%) carry an ontology ID; the rest keep their derived IDs`);
console.log(`  mapped shapes per ID: ${Object.entries(coverage.byId).map(([id, n]) => `${id} ${n}`).join(', ')}`);
console.log(failures.length
  ? `MISCONCEPTION ONTOLOGY: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `MISCONCEPTION ONTOLOGY: PASS — ${pass}/${pass} checks — one stable ID per misconception across Step Check, authored traps, the cloud checker and learner state.`);
process.exit(failures.length ? 1 : 0);
