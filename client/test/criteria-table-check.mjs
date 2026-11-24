// The criteria table: absent unless the author approved this type, for this digest, and the awards sum to the server mark.
import { criteriaView } from '../src/components/criteriaTableModel.js';
import { AUTHOR_APPROVED } from '../src/engine/authorApprovals.js';
import fs from 'node:fs';
import { approvedTypes, recordProblems, readRecords } from '../../tools/author-approvals.mjs';

let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const D = 'a'.repeat(64), D2 = 'b'.repeat(64);
const FIX = [{ typeId: 'y12-stationary-x', digest: D, approvedBy: 'Fixture Author', date: '2026-11-19' }];   // a test fixture, never a record
const cards = [{ n: 1, status: 'checked' }, { n: 2, status: 'checked' }, { n: 3, status: 'first-error' }, { n: 4, status: 'follows' }];
const crit = (over = {}) => ({ typeId: 'y12-stationary-x', digest: D, items: [
  { key: 'derivative', text: 'Differentiates correctly', marks: 1, awarded: true, lines: [2], reason: 'Line 2 is the derivative.' },
  { key: 'solve', text: 'Sets it to zero and solves', marks: 1, awarded: false, lines: [], reason: 'Line 3 is where it goes wrong.' }], ...over });
const mark = { awarded: 1, possible: 2 };

{
  const typesJson = JSON.parse(fs.readFileSync(new URL('../../owner-review/method-marks/types.json', import.meta.url), 'utf8')).types;
  const derived = approvedTypes(readRecords(), typesJson);
  ok(JSON.stringify(AUTHOR_APPROVED) === JSON.stringify(derived), 'the build list equals exactly what the tool derives from the committed records and types.json');
  ok(!AUTHOR_APPROVED.some(a => a.typeId === 'y12-stationary-x'), 'a type the page cannot verify is not approved in the build');
}
ok(criteriaView({ criteria: crit(), mark, cards }) === null, 'an unapproved type shows no criteria table at all');
const v = criteriaView({ criteria: crit(), mark, cards, approved: FIX });
ok(v && v.rows.length === 2 && v.earned === 1 && v.possible === 2, 'an approved type shows each criterion with its marks and the total');
ok(v.rows[0].awarded && v.rows[0].lines[0] === 2 && !v.rows[1].awarded, 'awarded or not, tied to the line that earned it');
ok(criteriaView({ criteria: crit({ digest: D2 }), mark, cards, approved: FIX }) === null, 'a changed scheme digest revokes: not approved until the author re-reviews');
ok(criteriaView({ criteria: crit(), mark: { awarded: 2, possible: 2 }, cards, approved: FIX }) === null, 'a table that does not equal the server mark is not shown');
ok(criteriaView({ criteria: crit(), mark: null, cards, approved: FIX }) === null, 'no server mark, no table');
const earnedOn = n => crit({ items: [{ key: 'x', text: 'x', marks: 1, awarded: true, lines: [n], reason: '' }] });
ok(criteriaView({ criteria: earnedOn(3), mark: { awarded: 1, possible: 1 }, cards, approved: FIX }) === null, 'a wrong line never earns a criterion');
ok(criteriaView({ criteria: earnedOn(4), mark: { awarded: 1, possible: 1 }, cards, approved: FIX }) === null, 'a line that only follows from an earlier error never earns (the engine policy)');
ok(criteriaView({ criteria: earnedOn(1), mark: { awarded: 1, possible: 1 }, cards, approved: FIX })?.rows.length === 1, 'a ticked line may earn');
ok(criteriaView({ criteria: crit({ items: [] }), mark, cards, approved: FIX }) === null, 'no criteria, no table');

// the records: a digest change revokes; a fixture or an automation name is refused
const types = [{ id: 'y12-stationary-x', digest: D }];
const rec = (o = {}) => ({ file: 'y12-stationary-x.json', record: { schemaVersion: 1, typeId: 'y12-stationary-x', digest: D, verdict: 'approved', note: 'ok', approvedBy: 'Priysharan Tripathi', role: 'author (tutor)', date: '2026-11-19', ...o } });
ok(approvedTypes([rec()], types).length === 1, 'a well-formed approval for the current digest counts');
ok(approvedTypes([rec()], [{ id: 'y12-stationary-x', digest: D2 }]).length === 0, 'the scheme changed after approval: not approved');
ok(approvedTypes([rec({ verdict: 'changes-needed' })], types).length === 0, 'changes needed is not approval');
ok(recordProblems(rec({ fixture: true }), types).length > 0, 'a fixture record is refused');
ok(recordProblems(rec({ approvedBy: 'Claude agent' }), types).length > 0, 'an automation name is refused');
ok(recordProblems(rec({ role: 'independent examiner' }), types).length > 0, 'the role is author (tutor), never examiner');
ok(recordProblems(rec({ note: 'examiner-certified by NESA' }), types).length > 0, 'the wording never claims examiner or NESA certification');
ok(recordProblems({ file: 'other.json', record: rec().record }, types).length > 0, 'a record is named after its type');
if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`CRITERIA TABLE: FAIL (${fail.length})`); process.exit(1); }
console.log(`CRITERIA TABLE: PASS — ${pass} checks — no table for an unapproved type; an approved fixture shows and sums to the server mark; a changed digest revokes; a wrong or follow-on line never earns`);
