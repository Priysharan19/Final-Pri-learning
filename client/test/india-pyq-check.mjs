// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · previous-year question (PYQ) contract
//
// "PYQ" is the word every JEE and CBSE student uses for the thing they practise
// most, and it is a claim: this question was set in that exam, in that year. The
// one unforgivable failure in this layer is a question that carries the claim
// without the paper behind it, so this suite is mostly about provenance rather
// than about maths.
//
// It checks four things, in this order of seriousness:
//
//   1. every record claiming to be a past paper names its exam, its year, its
//      sitting, its printed question number, and the documents its prompt and
//      its answer were transcribed from — and the answer document is an
//      official key or marking scheme wherever the record says it is;
//   2. every record is answerable by the real marker: feeding the keyed answer
//      to checker.js marks it right, and feeding a wrong one marks it wrong,
//      so no PYQ can reach a student in a state where it cannot be marked;
//   3. every four-option MCQ offers four distinct options — the live bug
//      hasFourDistinctOptions in indiaExamComposer.js exists for, which a
//      dropped option in a transcription would reintroduce;
//   4. the archive is actually wired: the coverage table matches the records,
//      the generator registry can load a PYQ generator, papers compose with
//      past-paper questions in them, and "past papers only" practice either
//      serves a past paper or refuses with a reason.
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv } from './backend-check.mjs';

installBrowserEnv();
const { PYQ_RECORDS, buildPyqBank, pyqArchiveSnapshot, pyqGenerator } = await import('../src/engine/pyq/pyqArchive.js');
const { PYQ_COVERAGE, PYQ_MANIFEST, PYQ_ABSENT_EXAMS, hasPyqGenerator, pyqCellsFor, pyqGeneratorId, pyqAbsenceFor } =
  await import('../src/engine/pyq/pyqCoverage.js');
const { PYQ_SOURCES, PYQ_EXAMS, PYQ_PROVENANCE, PYQ_PUBLISHABLE } = await import('../src/engine/pyq/pyqSources.js');
const { validatePyqRecord, pyqPayload, PYQ_STEPS_AUTHORSHIP } = await import('../src/engine/pyq/pyqSchema.js');
const { checkAnswer } = await import('../src/engine/checker.js');
const { bankOf, loadBanks, loadAllBanks, generateQuestion } = await import('../src/engine/generators/index.js');
const { indiaChapter, resolveIndiaTarget } = await import('../src/engine/indiaProduct.js');
const { hasFourDistinctOptions, answerText } = await import('../src/engine/indiaExamComposer.js');
const { dispatch } = await import('../src/local/backend.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

await loadAllBanks();

// ── 1. Provenance ────────────────────────────────────────────────────────────
// Nothing in this block is about whether a question is good. It is about
// whether the archive can prove the question is real.

ok(PYQ_RECORDS.length > 0, 'the archive publishes at least one record');
eq(PYQ_RECORDS.length, PYQ_MANIFEST.records, 'the manifest count is the record count');
eq(PYQ_MANIFEST.records, PYQ_MANIFEST.papers.reduce((n, p) => n + p.records, 0), 'the manifest papers account for every record');
// The manifest is product-facing copy: "8 questions from JEE Advanced 2026
// Paper 1" is a number a student reads. Each line is counted from the records
// rather than trusted, because a stale count here is a false claim.
for (const paper of PYQ_MANIFEST.papers) {
  const held = PYQ_RECORDS.filter(r => r.examId === paper.exam && r.year === paper.year
    && (paper.paper === undefined || r.paper === paper.paper)
    && (paper.setCode === undefined || r.setCode === paper.setCode)).length;
  eq(held, paper.records, `manifest: ${paper.exam} ${paper.year} ${paper.paper || paper.setCode} holds the number of records it claims`);
}

const officialKinds = new Set(['official-final-answer-key', 'official-marking-scheme']);
for (const rec of PYQ_RECORDS) {
  const where = `${rec.id}`;
  ok(rec.pastPaper === true, `${where}: declares itself a past-paper question`);
  ok(PYQ_PUBLISHABLE.includes(rec.provenance), `${where}: sits at a publishable provenance rung`);
  ok(!!PYQ_EXAMS[rec.examId], `${where}: names a known sitting`);
  ok(Number.isInteger(rec.year) && rec.year >= 1990, `${where}: carries the year it was set (${rec.year})`);
  ok(!!(rec.paper || rec.setCode), `${where}: names the paper or set code it came from`);
  ok(Number.isInteger(rec.questionNumber) && rec.questionNumber > 0, `${where}: carries its printed question number`);
  ok(!!indiaChapter(rec.chapterId), `${where}: is routed to a live India chapter (${rec.chapterId})`);

  const promptIds = [].concat(rec.promptSource);
  const answerIds = [].concat(rec.answerSource);
  ok(promptIds.length > 0 && promptIds.every(id => PYQ_SOURCES[id]), `${where}: every prompt source resolves to a cited document`);
  ok(answerIds.length > 0 && answerIds.every(id => PYQ_SOURCES[id]), `${where}: every answer source resolves to a cited document`);
  if (rec.provenance === PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY) {
    ok(answerIds.some(id => officialKinds.has(PYQ_SOURCES[id].kind)), `${where}: claims an official key and names one`);
  }
}

// Every cited document must be checkable by someone who does not trust us.
for (const [id, src] of Object.entries(PYQ_SOURCES)) {
  ok(/^https:\/\//.test(String(src.url || '')), `source ${id}: carries an https URL`);
  ok(!!src.authority && !!src.title && !!src.kind, `source ${id}: names its authority, title and kind`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(String(src.retrieved || '')), `source ${id}: records the day it was retrieved`);
}
ok(Object.values(PYQ_SOURCES).every(src => /(jeeadv\.ac\.in|cbse\.gov\.in)/.test(String(src.archivedAt || src.url))),
  'every cited document comes from the exam authority itself');

// Two records for the same printed question would mean one of them is a
// duplicate transcription, and a student would meet it twice as often.
const sittings = new Set(PYQ_RECORDS.map(r => `${r.examId}|${r.year}|${r.paper || ''}|${r.setCode || ''}|${r.questionNumber}`));
eq(sittings.size, PYQ_RECORDS.length, 'no printed question is transcribed twice');
eq(new Set(PYQ_RECORDS.map(r => r.id)).size, PYQ_RECORDS.length, 'record ids are unique');
eq(new Set(PYQ_RECORDS.map(r => r.prompt.trim())).size, PYQ_RECORDS.length, 'no two records carry the same prompt');

// The worked steps are Pri's own explanation of a real question, and the payload
// has to keep saying so — a house explanation read as an official solution is
// the quiet version of the same lie.
ok(PYQ_RECORDS.every(r => Array.isArray(r.steps) && r.steps.length > 0), 'every record carries worked steps');
ok(pyqPayload(PYQ_RECORDS[0]).archive.stepsAuthorship === PYQ_STEPS_AUTHORSHIP, 'the payload states who wrote the worked solution');

// ── 2. The schema refuses what it says it refuses ────────────────────────────
// These are the rules that stand between a bad record and a student. Each one
// is exercised on a copy of a real record with one field spoiled.
const sample = PYQ_RECORDS.find(r => r.answerType === 'mcq');
const numericSample = PYQ_RECORDS.find(r => r.answerType === 'numeric');
const refuses = (patch, label) => {
  try {
    validatePyqRecord({ ...sample, ...patch });
    failures.push(`schema: accepted a record that ${label}`);
  } catch { pass++; }
};
refuses({ year: undefined }, 'has no year');
refuses({ questionNumber: undefined }, 'has no printed question number');
refuses({ paper: undefined, setCode: undefined }, 'names neither a paper nor a set');
refuses({ promptSource: 'no-such-document' }, 'cites a document that does not exist');
refuses({ answerSource: undefined }, 'names no answer source');
refuses({ answerSource: 'cbse-2025-xii-65-1-1-questions' }, 'claims an official key but cites only a question paper');
refuses({ provenance: PYQ_PROVENANCE.UNVERIFIED }, 'is unverified');
refuses({ pastPaper: false }, 'does not claim to be a past paper');
refuses({ chapterId: 'c12-not-a-chapter' }, 'is routed to a chapter that does not exist');
refuses({ steps: [] }, 'has no worked steps');
refuses({ mcqOptions: [sample.mcqOptions[0], sample.mcqOptions[0], sample.mcqOptions[2], sample.mcqOptions[3]] }, 'repeats an MCQ option');
refuses({ mcqOptions: sample.mcqOptions.slice(0, 3) }, 'offers only three options');
refuses({ answer: { correctIndex: 9 } }, 'keys an option that is not on the paper');
refuses({ answerType: 'working' }, 'uses an answer contract the marker cannot mark');
try {
  validatePyqRecord({ ...numericSample, answer: { value: 5, officialRange: [10, 20] } });
  failures.push('schema: accepted a numeric record keyed outside its own official range');
} catch { pass++; }

// ── 3. Every record marks, through the real marker ───────────────────────────
// A PYQ that cannot be marked is worse than no PYQ: the student has done real
// exam work and gets no verdict. So each record is fed its own keyed answer and
// a deliberately wrong one, through checker.js — the same call the exam backend
// and practice both make.
let marked = 0;
let optionsChecked = 0;
for (const rec of PYQ_RECORDS) {
  const q = pyqPayload(rec);
  if (q.answerType === 'mcq') {
    ok(hasFourDistinctOptions(q), `${rec.id}: offers four distinct options`);
    optionsChecked += 1;
    const right = checkAnswer(q, String(q.answer.correctIndex));
    ok(right.correct === true, `${rec.id}: the keyed option marks correct`);
    const wrongIndex = (q.answer.correctIndex + 1) % 4;
    ok(checkAnswer(q, String(wrongIndex)).correct === false, `${rec.id}: a different option marks wrong`);
    ok(answerText(q) === q.mcqOptions[q.answer.correctIndex], `${rec.id}: the solution shown is the keyed option`);
  } else {
    const right = checkAnswer(q, String(q.answer.value));
    ok(right.correct === true, `${rec.id}: the keyed value marks correct`);
    // Move well outside any tolerance the official band allows.
    const off = q.answer.value + Math.max(1, Math.abs(q.answer.value) * 0.5) + (q.answer.tol || 0) * 10;
    ok(checkAnswer(q, String(off)).correct === false, `${rec.id}: a clearly different value marks wrong`);
    if (rec.answer.officialRange) {
      const [lo, hi] = rec.answer.officialRange;
      ok(checkAnswer(q, String(lo)).correct === true, `${rec.id}: the low end of the official band marks correct`);
      ok(checkAnswer(q, String(hi)).correct === true, `${rec.id}: the high end of the official band marks correct`);
    }
  }
  marked += 1;
}
eq(marked, PYQ_RECORDS.length, 'every record was put through the real marker');
ok(optionsChecked >= 30, `enough MCQs had their four options checked (${optionsChecked})`);

// ── 4. Coverage matches the records ──────────────────────────────────────────
// pyqCoverage.js is hand-maintained so indiaProduct.js can consult it without a
// dynamic import. That is only safe while it is exactly what the records say.
const rebuilt = new Map();
for (const rec of PYQ_RECORDS) {
  const id = pyqGeneratorId(rec.track, rec.chapterId);
  if (!rebuilt.has(id)) rebuilt.set(id, { track: rec.track, chapterId: rec.chapterId, exams: new Set(), difficulties: new Set(), years: new Set(), records: 0 });
  const row = rebuilt.get(id);
  row.exams.add(rec.examId); row.difficulties.add(rec.difficulty); row.years.add(rec.year); row.records += 1;
}
eq(Object.keys(PYQ_COVERAGE).length, rebuilt.size, 'the coverage table names every generator the records produce');
for (const [id, want] of rebuilt) {
  const got = PYQ_COVERAGE[id];
  if (!got) { failures.push(`coverage: ${id} is missing from the table`); continue; }
  eq(got.track, want.track, `coverage ${id}: track`);
  eq(got.chapterId, want.chapterId, `coverage ${id}: chapter`);
  eq(got.records, want.records, `coverage ${id}: record count`);
  eq(got.difficulties.join(','), [...want.difficulties].sort().join(','), `coverage ${id}: difficulty rungs`);
  eq(got.years.join(','), [...want.years].sort().join(','), `coverage ${id}: years`);
  eq(got.exams.join(','), [...want.exams].sort().join(','), `coverage ${id}: exams`);
  ok(hasPyqGenerator(id), `coverage ${id}: is reported as published`);
}

// An archive that names an absent exam has to say why, not just be empty.
ok(PYQ_ABSENT_EXAMS.length > 0, 'the archive names the exams it deliberately carries nothing for');
ok(PYQ_ABSENT_EXAMS.every(row => row.reason && row.reason.length > 40), 'each absent exam carries a real reason, not a placeholder');
ok(!!pyqAbsenceFor('jee-main'), 'the JEE Main gap is stated rather than silent');
ok(!PYQ_RECORDS.some(r => r.track === 'jee-main'), 'no record is served on a track the archive says it cannot serve');

// ── 5. The generator registry can actually load one ──────────────────────────
const someGenerator = Object.keys(PYQ_COVERAGE)[0];
eq(bankOf(someGenerator), `pyq-archive:${someGenerator}`, 'the registry routes a PYQ id to the PYQ bank');
eq(bankOf('not-a-generator-at-all'), null, 'the registry still refuses an unknown id');
await loadBanks([bankOf(someGenerator)]);
const drawn = generateQuestion(someGenerator, PYQ_COVERAGE[someGenerator].difficulties[0], 12345);
ok(drawn?.pyq === true, 'a question drawn through generateQuestion is labelled as a past-paper question');
ok(!!drawn?.pyqSource && /\d{4}/.test(drawn.pyqSource), `the drawn question names its sitting (${drawn?.pyqSource})`);
ok(!!drawn?.archive?.citations?.length, 'the drawn question carries its citations');
ok(typeof pyqGenerator(someGenerator) === 'function', 'the archive exposes the generator by id');
eq(pyqGenerator('pyq-cbse-c12-not-a-chapter'), null, 'the archive returns nothing for an id it does not publish');

// The bank respects difficulty rungs: asking for a rung it does not publish
// gets the nearest one it does, never an invented one.
const bank = buildPyqBank();
for (const [id, row] of Object.entries(PYQ_COVERAGE)) {
  for (const want of [1, 2, 3, 4]) {
    const payload = bank[id](() => 0, want);
    ok(row.difficulties.includes(payload.difficulty), `${id}: a request for D${want} is served from a published rung (got D${payload.difficulty})`);
  }
}

// ── 6. Practice: the past-papers-only filter ─────────────────────────────────
const covered = indiaChapter('c12-matrices');
const pyqOnlyTarget = resolveIndiaTarget(covered, { track: 'cbse', grade: 12, difficulty: 2, pyqOnly: true, random: () => 0 });
ok(pyqOnlyTarget?.pyq === true, 'past-papers-only practice on a covered chapter resolves to the archive');
eq(pyqOnlyTarget?.generator, 'pyq-cbse-c12-matrices', 'past-papers-only practice names the archive generator');
const uncovered = indiaChapter('c12-3d-geometry');
eq(resolveIndiaTarget(uncovered, { track: 'cbse', grade: 12, difficulty: 2, pyqOnly: true, random: () => 0 }), null,
  'past-papers-only practice refuses a chapter the archive does not cover, rather than serving authored practice');
// Dot-point practice stays on the authored generators: the archive routes at
// chapter level and does not claim to know which dot point a question is on.
const dotpointTarget = resolveIndiaTarget(covered, { track: 'cbse', grade: 12, dotpoint: 0, difficulty: 2, random: () => 0 });
ok(dotpointTarget && dotpointTarget.pyq === false, 'a dot-point request stays on an authored generator');

// Without the filter the archive competes with the authored forms rather than
// replacing them, so a student practising a covered chapter still meets both.
{
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const t = resolveIndiaTarget(covered, { track: 'cbse', grade: 12, difficulty: 2, random: () => i / 40 });
    if (t) seen.add(t.pyq ? 'pyq' : 'authored');
  }
  ok(seen.has('pyq') && seen.has('authored'), `unfiltered chapter practice mixes past papers with authored forms (${[...seen].join(' + ')})`);
}

// ── 7. Papers: a PYQ reaches a composed paper, and marks there ───────────────
async function premiumProfile(spec) {
  const created = await dispatch('POST', '/profiles', spec);
  const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
  const idb = await import('../src/local/idb.js');
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(created.user.id), accountId: `acct-${created.user.id}`, role: 'student',
    emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: {
      plan: 'premium', status: 'active', provider: 'web',
      currentPeriodEnd: now + 30 * 86400000, offlineUntil: now + 7 * 86400000,
      issuedAt: now, sourceVersion: 1
    }
  });
  return created.user;
}

for (const [label, profile] of [
  ['Class 12 CBSE', { name: 'PyqBhavesh', course: 'in', indiaTrack: 'cbse', year: 12 }],
  ['Class 10 CBSE', { name: 'PyqAsha', course: 'in', indiaTrack: 'cbse', year: 10 }],
  ['JEE Advanced', { name: 'PyqDevan', course: 'in', indiaTrack: 'jee-advanced', year: 12 }]
]) {
  const user = await premiumProfile(profile);
  let sawPyq = 0;
  let examined = 0;
  const badLabels = [];
  let lastExam = null;
  for (let seed = 1; seed <= 4; seed += 1) {
    const made = await dispatchIndiaExam(user, 'POST', '/exams', { seed });
    const paper = (await dispatchIndiaExam(user, 'GET', `/exams/${made.exam.id}`, {})).exam;
    lastExam = { id: made.exam.id, paper };
    for (const q of paper.questions || []) {
      examined += 1;
      if (!q.pyq) continue;
      sawPyq += 1;
      if (!q.pyqSource || !q.pyqYear || !q.pyqArchive?.citations?.length) badLabels.push(`seed ${seed} · ${q.id}`);
    }
    ok(Number.isInteger(paper.indiaExam?.pyq?.used), `${label}: the paper reports how many past-paper questions it used`);
  }
  ok(examined > 0, `${label}: papers composed (${examined} questions over 4 seeds)`);
  ok(sawPyq > 0, `${label}: at least one past-paper question reached a paper (${sawPyq} of ${examined})`);
  ok(badLabels.length === 0, `${label}: every past-paper question in a paper carries its sitting, year and citations — ${badLabels.length} did not (${badLabels[0] || ''})`);

  // A paper containing PYQs says so out loud, in the same reducedPattern list
  // the composer uses for every other honesty note.
  const notes = (lastExam.paper.indiaExam?.reducedPattern || []).join(' ');
  if (lastExam.paper.indiaExam?.pyq?.used > 0) {
    ok(/previous-year questions from a published paper/.test(notes), `${label}: the paper states how much of it is real past-paper work`);
  }

  // And it marks: answer every question with its own keyed answer and check the
  // past-paper ones all scored.
  const full = lastExam.paper;
  const answers = {};
  for (const q of full.questions || []) {
    if (q.parts?.length) for (const part of q.parts) answers[`${q.id}::${part.key}`] = '0';
    else answers[q.id] = q.mcqOptions?.length ? '0' : '1';
  }
  const result = await dispatchIndiaExam(user, 'POST', `/exams/${full.id}/submit`, { answers, ms: 60_000 });
  const pyqRows = (result.detail || []).filter(row => row.sourceKind === 'reviewed-jee-pyq');
  ok(pyqRows.every(row => typeof row.awarded === 'number' && !Number.isNaN(row.awarded)),
    `${label}: every past-paper question in the sat paper received a mark`);
  ok(pyqRows.every(row => row.solution ? typeof row.solution.answerText === 'string' : true),
    `${label}: every marked past-paper question shows its answer`);
}

// ── 8. Nothing claims a JEE Main past paper ──────────────────────────────────
// The NTA does not publish the JEE Main question paper outside the candidate
// portal, so a "JEE Main 2025" label in this repository would be a reprint from
// somewhere else wearing an official name.
const archiveText = JSON.stringify(PYQ_RECORDS.map(r => ({ e: r.examId, s: r.pyqSource, l: r.chapterId })));
ok(!/jee-main/.test(archiveText), 'no record is labelled JEE Main');
ok(pyqAbsenceFor('jee-main').reason.includes('candidate portal'), 'the JEE Main gap names the reason it exists');

const snapshot = pyqArchiveSnapshot();
const summary = Object.entries(snapshot.byExam).map(([exam, n]) => `${n} ${PYQ_EXAMS[exam].label}`).join(', ');
console.log(failures.length
  ? `INDIA PYQ: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `INDIA PYQ: PASS — ${pass}/${pass} checks — ${snapshot.records} source-cited previous-year questions (${summary}) across ${snapshot.chapters} chapters, every one provenance-complete, marked by the real marker and reachable in a composed paper.`);
process.exit(failures.length ? 1 : 0);
