// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the reader's per-line doubt survives on the handwriting path,
// and a misread relation sign is fixed with one tap
//
// Synthetic readings only. The reader's own "≥ or ≠" doubt is kept by
// toReading (as the photo path keeps it), shown as "check this symbol", and
// answered by a one-tap swap that is a correction of the reading. ≠ is worth
// a look when the question's public wording asks for an inequality. Nothing
// here sees an answer.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toReading } from '../src/ink/cloudReader.js';
import { applyLineCorrection } from '../src/ink/readingCorrection.js';
import { RELATIONS, asksForInequality, doubtSigns, neqWorthCheck, relationChoices, relationsIn, swapRelation } from '../src/ink/relationSwap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── the doubt is kept ────────────────────────────────────────────────────────
const r = toReading({ engine: 'cloud-x', confidence: 0.7, lines: [
  { text: '2x + 1 ≥ 7', confidence: 0.7, uncertain: true, doubt: '≥ or ≠' },
  { text: 'x ≥ 3', confidence: 0.95, uncertain: false, doubt: '' }
] }, null);
eq(r.lines[0].doubt, '≥ or ≠', 'the reader\'s doubt on a line is kept');
ok(r.lines[0].uncertain === true && !('doubt' in r.lines[1]) && !('uncertain' in r.lines[1]), 'a line without doubt carries none');

// ── relation signs ───────────────────────────────────────────────────────────
eq(relationsIn('x >= 3 and y != 2').map(x => x.sign), ['≥', '≠'], 'ASCII spellings read as signs');
eq(doubtSigns('>= or >'), ['≥', '>'], 'a sign doubt gives its two signs');
eq(doubtSigns('x or n'), null, 'a letter doubt is not a sign swap');
const c = relationChoices(r.lines[0]);
ok(c.current === '≥' && c.options[0] === '≠' && c.options.length === RELATIONS.length - 1, 'the doubted alternative is offered first, then the other signs');
eq(swapRelation('2x + 1 ≥ 7', c.at, '≠'), '2x + 1 ≠ 7', 'one tap swaps only that sign');
const two = relationChoices({ text: '1 < x >= 3', doubt: '>= or >' });
eq(swapRelation('1 < x >= 3', two.at, '>'), '1 < x > 3', 'the doubted sign is the one swapped, not the first');
eq(relationChoices({ text: 'x = 3' }), null, 'a line with no relation sign offers no swap');

// ── the tap is a correction of the reading ───────────────────────────────────
const fixed = applyLineCorrection(r, 0, swapRelation(r.lines[0].text, c.at, '≠'));
ok(fixed.lines[0].text === '2x + 1 ≠ 7' && fixed.lines[0].corrected === true && fixed.lines[0].readText === '2x + 1 ≥ 7', 'the swap lands as a correction, keeping what was read');
ok(!('doubt' in fixed.lines[0]) && !('uncertain' in fixed.lines[0]), 'an answered line no longer carries the doubt');
const kept = applyLineCorrection(r, 0, r.lines[0].text);
ok(kept.lines[0].corrected === true && !('doubt' in kept.lines[0]), 'standing behind the reading answers the doubt too');

// ── ≠ on an inequality question ──────────────────────────────────────────────
ok(asksForInequality('Solve the inequality 2x + 1 > 7.') && asksForInequality('Solve 3x - 2 ≤ 10') && !asksForInequality('Solve 2x + 1 = 7'), 'the question\'s public wording says when an inequality is asked for');
ok(neqWorthCheck('x ≠ 3', true) && !neqWorthCheck('x ≠ 3', false) && !neqWorthCheck('x ≥ 3', true), '≠ is flagged only on an inequality question');

// ── wiring ───────────────────────────────────────────────────────────────────
const ink = read('client/src/ink/InkAnswer.jsx');
ok(/t\('ink\.checkSymbol', \{ doubt: line\.doubt \}\)/.test(ink) && /data-relation-swap=\{sign\}/.test(ink) && /correctLine\(li, swapRelation\(line\.text, choice\.at, sign\)\)/.test(ink), 'the reading shows the doubt and one-tap swaps that correct the line');
ok(/neqWorthCheck\(line\.text, promptAsksInequality\)/.test(ink), 'and flags ≠ on an inequality question');
ok((ink.match(/\bpromptAsksInequality\b/g) || []).length === 2, 'the reader UI uses the prompt flag only in its declaration and the ≠ note, never in a reader request');
ok(asksForInequality('Solve 2x + 3 > 7.') && !asksForInequality('Simplify 3(x + 2).'), 'the flag comes from the visible wording alone');
const card = read('client/src/components/QuestionCard.jsx');
ok(/promptAsksInequality=\{asksForInequality\(question\.prompt\)\}/.test(card), 'the question passes only whether its wording asks for an inequality');
ok(/verdict\.checkLineDoubt/.test(card) && /doubt: lines\[doubtedLine\]\.doubt/.test(card), 'the check prompt names the doubted line, where the swaps are');
const en = read('client/src/i18n/strings.en.js');
ok(!/Tap it below if I read it wrong/.test(en), 'no prompt points at a symbol that is not there');
ok(!/answer|expected|solution/i.test(read('client/src/ink/relationSwap.js').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'the swap helpers know no answer');

if (failures.length) {
  console.error(`READER DOUBTS: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`READER DOUBTS: PASS — ${pass}/${pass} checks — per-line doubts kept, one-tap sign swaps correct the reading, ≠ flagged on inequality questions.`);
