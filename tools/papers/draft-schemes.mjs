// Pri Learning · draft marking schemes for the author's review (never approved by this script)
//
//   node tools/papers/draft-schemes.mjs        writes owner-review/paper-schemes/<paper id>.json and owner-review/PAPER-SCHEMES.md
//
// Turns the criteria the author wrote in his own guidelines into the scheme-record shape of owner-review/method-marks (criterion, marks,
// how the engine decides it), and says for each criterion whether the engine can award it deterministically from a student's working.
// The classification is by rule, stated below, never by judgement of a student's work. Every file says: DRAFT for the author's review,
// not approved. Nothing here creates, edits or implies an author-approval record (docs/marking/author-approvals/).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRUCT = join(ROOT, 'server/content/papers/nsw-ext1/structured');
const OUT = join(ROOT, 'owner-review/paper-schemes');
const text = blocks => (blocks || []).map(b => (b.k === 'list' ? b.items.join(' ') : b.t || '')).join(' ').replace(/\s+/g, ' ').trim();
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const leaves = parts => parts.flatMap(p => (p.parts ? leaves(p.parts) : [p]));

// The rules (one place, in plain words in PAPER-SCHEMES.md too).
function decide(part, criterion, index, topMarks) {
  if (part.answerType === 'mcq') return { engine: 'yes', decidedBy: 'answer checker', why: 'a multiple-choice answer is checked against the key.' };
  const isTop = criterion.marks === topMarks && index === part.criteria.findIndex(c => c.marks === topMarks);
  if (part.key && isTop) return { engine: 'yes, final answer only', decidedBy: 'answer checker', why: `the engine checks the final answer against a key verified by computation (${part.key.type}). It earns 1 mark at most, because a bare answer earns at most 1 mark on a multi-mark part (CTO decision, 19 Nov 2026, to be confirmed by the author). The justification the criterion also asks for cannot be verified.` };
  if (part.key) return { engine: 'no', decidedBy: 'student, against the sample answer', why: 'a method step. The line checker can say a written line is true or follows from the line above; it cannot tell that the line is the step this criterion names, so it awards nothing for it.' };
  const kind = part.answerType;
  const reason = { 'show-that': 'a "show that" or proof: no final answer exists to check, and the steps are not machine-judged.', 'proof-explain': 'an explanation: words are not machine-judged.', sketch: 'a sketch: no graph-feature key is written for it yet.', open: 'a part whose answer is not a single value, expression, set, interval or equation (or whose key could not be verified), so it has no key.' }[kind] || 'no key.';
  return { engine: 'no', decidedBy: 'student, against the sample answer', why: reason };
}

mkdirSync(OUT, { recursive: true });
const summary = [];
for (const file of readdirSync(STRUCT).filter(f => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(readFileSync(join(STRUCT, file), 'utf8'));
  const parts = [];
  for (const s of doc.sections) for (const q of s.questions) for (const part of leaves(q.parts)) {
    if (s.id === 'I') continue;
    const top = Math.max(0, ...part.criteria.map(c => c.marks));
    const criteria = part.criteria.map((c, i) => ({ key: `c${i + 1}`, text: text(c.text), marks: c.marks, ...decide(part, c, i, top) }));
    parts.push({ id: part.id, question: q.number, marks: part.marks, answerType: part.answerType, keyed: !!part.key, criteria,
      digest: sha(part.criteria) });
  }
  const crit = parts.flatMap(p => p.criteria);
  const yes = crit.filter(c => c.engine.startsWith('yes')).length;
  const record = {
    status: 'DRAFT for the author\'s review: not approved. Nothing in this file is switched on.',
    paper: doc.id, schemeDigest: doc.markingScheme.digest, source: 'the criteria exactly as written in the author\'s marking guidelines; marks per criterion are his, not guessed',
    sectionII: { parts: parts.length, criteria: crit.length, engineCanAward: yes, engineCannot: crit.length - yes }, parts
  };
  writeFileSync(join(OUT, `${doc.id}.json`), JSON.stringify(record, null, 1) + '\n');
  summary.push({ id: doc.id, parts: parts.length, keyed: parts.filter(p => p.keyed).length, criteria: crit.length, yes, no: crit.length - yes });
}
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
console.log(summary.map(s => `${s.id}: ${s.parts} Section II parts (${s.keyed} keyed), ${s.criteria} criteria, engine can award ${s.yes}`).join('\n'));

// ── The plain-words index ────────────────────────────────────────────────────
const rows = summary.map(s => `| ${s.id.replace('ext1-2027-p', 'Paper ')} | ${s.parts} | ${s.keyed} | ${s.criteria} | ${s.yes} | ${s.no} |`).join('\n');
const tot = summary.reduce((a, s) => ({ parts: a.parts + s.parts, keyed: a.keyed + s.keyed, criteria: a.criteria + s.criteria, yes: a.yes + s.yes }), { parts: 0, keyed: 0, criteria: 0, yes: 0 });
const md = `DRAFT for the author's review: not approved. Nothing in this file or in owner-review/paper-schemes/ is switched on.

# Marking schemes for the thirteen papers: drafts for the author

What this is. For every Section II part of every paper, the criteria you wrote in your own marking guidelines, with your marks, in the same record shape as owner-review/method-marks/. Beside each criterion is whether Pri's engine can award it by itself from a student's working, yes or no, and why. These are your words, copied exactly. Nothing was reworded or re-marked.

Nothing is approved. Until you write an approval record (docs/marking/author-approvals/), no student sees a mark beside a criterion. Students see the criteria as "How this is marked", with no marks. The totals line says how many marks the engine decided (a multiple-choice answer, or a final answer matched to a key) and how many the student checks.

## What the engine can and cannot award

A criterion is "yes" only in two cases:

1. A multiple-choice question (Section I): the answer is checked against the key.
2. The top criterion of a Section II part that has a verified final-answer key: the engine checks the final answer. That earns 1 mark at most (see the decision below). It cannot check the justification the same criterion also asks for.

Every other criterion is "no". The reasons, in the draft files, are one of these:

- It is a method step. The line checker can say a written line is true, or follows from the line above. It cannot say the line is the step your criterion names, so it awards nothing for it.
- The part is a proof or "show that": there is no final answer to check.
- The part is an explanation: words are not judged by the engine.
- The part is a sketch: no graph-feature key is written for it yet.
- The part has no single final answer in a form the engine reads (a pair of values, a vector, a formula with a free constant), or its key could not be verified.

## Totals

| Paper | Section II parts | Parts with a verified key | Criteria | Engine can award | Engine cannot |
|---|---:|---:|---:|---:|---:|
${rows}
| All thirteen | ${tot.parts} | ${tot.keyed} | ${tot.criteria} | ${tot.yes} | ${tot.criteria - tot.yes} |

Read "Engine can award" as: the engine can decide the final-answer criterion of that many parts, and no other criterion of any Section II part. Section I adds ten multiple-choice marks to every paper.

## Decisions the CTO made so work was not blocked (overturn any of them)

1. A correct final answer with no working earns at most 1 mark on a multi-mark part. This is from your own marker's notes. If you want a different amount, say so and the key's mark changes; no code changes.
2. The rebuilt Paper 13 PDF is the one that ships.
3. A student whose written working is read line by line gets a verdict on each line (consistent, not readable, or does not follow from the line above). That verdict never earns a mark and never takes one away.
4. The papers' PDFs are free for any signed-in student. Sitting a paper in the app is free for Paper 01 and Premium for the rest (owner decision of 19 November 2026).

## How to approve

Read one paper's file in owner-review/paper-schemes/, then write one approval record per paper in docs/marking/author-approvals/, naming the scheme digest printed at the top of the file. Any change to a criterion changes the digest and the approval stops counting until you review it again. This script never writes an approval record, and a test refuses one that names a fixture or an automation.

## Where each file is

- owner-review/paper-schemes/ext1-2027-pNN.json: one per paper, every Section II part with its criteria.
- owner-review/paper-schemes/summary.json: the table above as data.
- Regenerate with: node tools/papers/draft-schemes.mjs
`;
writeFileSync(join(ROOT, 'owner-review/PAPER-SCHEMES.md'), md);
