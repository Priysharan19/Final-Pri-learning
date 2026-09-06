// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India exam flow contract
//
// Before this, no Indian profile could sit any exam: the JEE Main path needed
// reviewed previous-year questions the repository does not have, and every
// other track answered INDIA_EXAM_NOT_RELEASED. This suite drives the real
// local backend the way the app does — create a paper, read it, answer it,
// submit it, read the result — for each track a student can choose, and checks
// the shape of the paper against the published pattern it claims to follow.
//
// It also pins the marking rules that cost a student marks if they are wrong:
// JEE Main's +4/−1/0 with an unanswered question scoring zero, and JEE
// Advanced's partial credit on multiple-correct questions.
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
const { dispatch } = await import('../src/local/backend.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { markObjective, markMultiCorrect, JEE_MAIN_MATHEMATICS_2026, JEE_ADVANCED_2026 } = await import('../src/engine/indiaExams.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

async function profileFor(spec) {
  const created = await dispatch('POST', '/profiles', spec);
  ok(!!created?.user?.id, `${spec.name}: profile created`);
  // The free tier allows one exam simulation every 30 days, which
  // entitlement-enforcement-check.mjs is the suite for. This one is about
  // whether each track can compose, sit and mark a paper at all, so every
  // profile here holds a server-issued Premium snapshot.
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

// src/api.js routes an India profile's /exams calls to the India exam backend;
// this suite drives dispatch() directly, so it does the same resolution.
const examCall = (profile, method, path, body = {}) => dispatchIndiaExam(profile, method, path, body);

const sectionsOf = paper => {
  const groups = new Map();
  for (const q of paper.questions || []) {
    if (!groups.has(q.section)) groups.set(q.section, { id: q.section, label: q.sectionLabel, questions: [] });
    groups.get(q.section).questions.push(q);
  }
  return [...groups.values()];
};
const marksOf = paper => (paper.questions || []).reduce((n, q) => n + (q.marks || 0), 0);

// ── Every track a student can choose can sit a paper ─────────────────────────
const TRACKS = [
  { label: 'Class 10 CBSE', profile: { name: 'Asha', course: 'in', indiaTrack: 'cbse', year: 10 }, marks: 80 },
  { label: 'Class 12 CBSE', profile: { name: 'Bhavesh', course: 'in', indiaTrack: 'cbse', year: 12 }, marks: 80 },
  { label: 'JEE Main', profile: { name: 'Chitra', course: 'in', indiaTrack: 'jee-main', year: 12 }, marks: 100 },
  { label: 'JEE Advanced', profile: { name: 'Devan', course: 'in', indiaTrack: 'jee-advanced', year: 12 }, marks: 60 },
  { label: 'Olympiad', profile: { name: 'Esha', course: 'in', indiaTrack: 'olympiad', year: 10 }, marks: 100 },
];

const papers = {};
for (const track of TRACKS) {
  const user = await profileFor(track.profile);
  let created = null;
  try {
    created = await examCall(user, 'POST', '/exams', {});
  } catch (error) {
    failures.push(`${track.label}: creating an exam threw — ${error?.code || ''} ${error?.message || error}`);
    continue;
  }
  const exam = created?.exam;
  ok(!!exam?.id, `${track.label}: an exam is created (no INDIA_EXAM_NOT_RELEASED)`);
  if (!exam?.id) continue;

  // ExamRoom reads the paper back through this route; a shape it cannot read
  // is what made every India exam unopenable before.
  const paper = (await examCall(user, 'GET', `/exams/${exam.id}`, {})).exam;
  ok(!!paper, `${track.label}: the paper reads back`);
  if (!paper) continue;
  papers[track.label] = { paper, user };

  const questions = paper.questions || [];
  ok(questions.length > 0, `${track.label}: the paper has questions (${questions.length})`);
  // A case-study question is multipart: it carries a stem and parts instead of
  // one prompt and one answer type.
  ok(questions.every(q => q.prompt || (q.stem && q.parts?.length)), `${track.label}: every question carries a prompt, or a stem with parts`);
  ok(questions.every(q => q.answerType || q.parts?.every(part => part.answerType)), `${track.label}: every question declares how it is answered`);
  ok(questions.every(q => Number.isFinite(q.marks) && q.marks > 0), `${track.label}: every question carries its marks`);
  eq(paper.total, track.marks, `${track.label}: the paper is worth the published total`);
  eq(marksOf(paper), track.marks, `${track.label}: the question marks add up to the paper total`);
  ok(!!paper.indiaExam?.blueprintId, `${track.label}: the paper names the blueprint it follows`);
  ok(!!paper.indiaExam?.authenticity, `${track.label}: the paper states how authentic its pattern is`);

  // Sit it: answer every question, submit, read the result.
  const answers = {};
  for (const q of questions) {
    if (q.parts?.length) for (const part of q.parts) answers[part.id ?? `${q.id}:${part.label}`] = '1';
    else answers[q.id] = q.mcqOptions?.length ? String(q.mcqOptions[0].id ?? q.mcqOptions[0].value ?? 'a') : '1';
  }
  let marked = null;
  try {
    marked = await examCall(user, 'POST', `/exams/${exam.id}/submit`, { answers, ms: 60_000 });
  } catch (error) {
    failures.push(`${track.label}: submitting threw — ${error?.code || ''} ${error?.message || error}`);
    continue;
  }
  ok(!!marked, `${track.label}: submitting returns a marked paper`);
  if (!marked) continue;
  ok(typeof marked.score === 'number', `${track.label}: the result carries a numeric score (${marked.score})`);
  ok(marked.score <= marked.total, `${track.label}: the score cannot exceed the paper total`);
  const breakdown = marked.summary?.sections || marked.indiaExam?.sections || marked.summary?.byChapter;
  ok(Array.isArray(breakdown) && breakdown.length > 0, `${track.label}: the result breaks the score down by section or chapter`);
}

// ── Class 10 follows the published 80-mark board pattern ─────────────────────
const class10 = papers['Class 10 CBSE']?.paper;
if (class10) {
  const sections = sectionsOf(class10);
  eq(sections.length, 5, 'Class 10: five sections, A to E');
  const byId = Object.fromEntries(sections.map(s => [String(s.id).toUpperCase().slice(-1), s]));
  for (const [id, count, each] of [['A', 20, 1], ['B', 5, 2], ['C', 6, 3], ['D', 4, 5], ['E', 3, 4]]) {
    const section = byId[id];
    ok(!!section, `Class 10: section ${id} exists`);
    if (!section) continue;
    eq(section.questions.length, count, `Class 10: section ${id} has ${count} questions`);
    ok(section.questions.every(q => q.marks === each), `Class 10: section ${id} questions are worth ${each} mark(s) each`);
  }
  eq(marksOf(class10), 80, 'Class 10: the marks add up to 80');
  ok((class10.questions || []).some(q => q.choice), 'Class 10: internal choice appears where the pattern allows it');
  ok((class10.questions || []).some(q => q.mcqOptions?.length === 4), 'Class 10: Section A offers four-option MCQs');
}

const class12 = papers['Class 12 CBSE']?.paper;
if (class12) {
  eq(sectionsOf(class12).length, 5, 'Class 12: five sections');
  eq(marksOf(class12), 80, 'Class 12: the marks add up to 80');
  ok((class12.questions || []).some(q => q.choice), 'Class 12: internal choice is offered');
}

// ── JEE Main is the mathematics section at +4/−1/0 ───────────────────────────
const jeeMain = papers['JEE Main']?.paper;
if (jeeMain) {
  const questions = jeeMain.questions || [];
  eq(questions.length, 25, 'JEE Main: 20 MCQ + 5 numerical');
  const mcq = questions.filter(q => q.mcqOptions?.length);
  eq(mcq.length, 20, 'JEE Main: twenty are multiple choice');
  ok(mcq.every(q => q.mcqOptions.length === 4), 'JEE Main: every MCQ offers four options');
  ok(mcq.every(q => new Set(q.mcqOptions.map(o => String(o.text ?? o.label ?? o.value ?? o))).size === 4), 'JEE Main: the four options are distinct');
  eq(questions.length - mcq.length, 5, 'JEE Main: five are numerical');
  ok(questions.every(q => q.marks === 4), 'JEE Main: every question is worth +4');
  ok(questions.every(q => q.negativeMarks === 1), 'JEE Main: every question carries −1 for a wrong answer');
}
const mainMarking = (JEE_MAIN_MATHEMATICS_2026?.sections || [])[0];
if (mainMarking) {
  eq(markObjective(mainMarking, { unanswered: true, correct: false }), 0, 'JEE Main: an unanswered question scores nothing');
  eq(markObjective(mainMarking, { unanswered: false, correct: true }), 4, 'JEE Main: a correct answer scores +4');
  eq(markObjective(mainMarking, { unanswered: false, correct: false }), -1, 'JEE Main: a wrong answer scores −1');
} else failures.push('JEE Main: the 2026 marking rules are not exported');


// A four-option slot must hold four distinct options in EVERY paper, not most.
// Some generators author two- and three-option questions, and one reaching a
// JEE Main paper turns a one-in-four guess into a one-in-three: it showed up in
// roughly one paper in six before the composer began refusing them. A single
// sampled paper cannot gate that, so this sweeps twenty seeded papers.
{
  const user = papers['JEE Main']?.user;
  if (user) {
    let examined = 0;
    const bad = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const made = await examCall(user, 'POST', '/exams', { seed });
      const paper = (await examCall(user, 'GET', `/exams/${made.exam.id}`, {})).exam;
      for (const q of (paper.questions || []).filter(q => q.mcqOptions?.length)) {
        examined += 1;
        const texts = q.mcqOptions.map(o => String(o?.text ?? o?.label ?? o?.value ?? o).trim());
        if (texts.length !== 4 || new Set(texts).size !== 4) bad.push(`seed ${seed} · ${q.subtopic}: ${JSON.stringify(texts)}`);
      }
    }
    ok(examined >= 300, `JEE Main sweep: enough MCQs examined (${examined})`);
    ok(bad.length === 0, `JEE Main sweep: every MCQ in 20 papers offers four distinct options — ${bad.length} did not (${bad[0] || ''})`);
  }
}

// ── JEE Advanced partial marking on multiple-correct questions ───────────────
const jeeAdvanced = papers['JEE Advanced']?.paper;
if (jeeAdvanced) {
  const questions = jeeAdvanced.questions || [];
  ok(questions.length > 0, 'JEE Advanced: a paper is composed');
  ok(questions.some(q => q.partialPerOption), 'JEE Advanced: multiple-correct questions carry per-option partial marks');
  ok(questions.some(q => q.negativeMarks === 2), 'JEE Advanced: a wrong option costs −2');
  ok(questions.some(q => q.negativeMarks === 0), 'JEE Advanced: some sections carry no negative marking');
}
const advancedSection = (JEE_ADVANCED_2026?.sections || []).find(s => s.partialPerOption);
if (advancedSection) {
  const m = advancedSection;
  const correct = ['a', 'b', 'd'];
  eq(markMultiCorrect(m, ['a', 'b', 'd'], correct), m.correct, 'JEE Advanced: all correct options score full marks');
  eq(markMultiCorrect(m, ['a', 'b'], correct), 2 * m.partialPerOption, 'JEE Advanced: two of three correct, none wrong, scores per option');
  eq(markMultiCorrect(m, ['a'], correct), m.partialPerOption, 'JEE Advanced: one of three correct, none wrong, scores one option');
  eq(markMultiCorrect(m, ['a', 'c'], correct), m.incorrect, 'JEE Advanced: any wrong option takes the penalty');
  eq(markMultiCorrect(m, [], correct), m.unanswered ?? 0, 'JEE Advanced: an unanswered question scores nothing');
}

// ── Olympiad is the IOQM format, not the retired PRMO ─────────────────────────
const olympiad = papers.Olympiad?.paper;
if (olympiad) {
  const questions = olympiad.questions || [];
  eq(questions.length, 30, 'Olympiad: an IOQM paper has thirty questions');
  eq(marksOf(olympiad), 100, 'Olympiad: 10x2 + 10x3 + 10x5 = 100 marks');
  const tally = {};
  for (const q of questions) tally[q.marks] = (tally[q.marks] || 0) + 1;
  eq(tally[2], 10, 'Olympiad: ten questions at 2 marks');
  eq(tally[3], 10, 'Olympiad: ten questions at 3 marks');
  eq(tally[5], 10, 'Olympiad: ten questions at 5 marks');
  ok(questions.every(q => q.negativeMarks === 0), 'Olympiad: IOQM has no negative marking');
  ok(!/PRMO/i.test(String(olympiad.indiaExam?.label || olympiad.title || '')), 'Olympiad: the paper is not labelled PRMO, retired in 2021');
  ok(/IOQM/i.test(String(olympiad.indiaExam?.label || olympiad.title || '')), 'Olympiad: the paper is labelled IOQM');
}

// ── No HSC language reaches an Indian exam ───────────────────────────────────
const indiaText = JSON.stringify(Object.fromEntries(Object.entries(papers).map(([k, v]) => [k, v.paper])));
ok(!/Band [1-6]|\bHSC\b|NESA/.test(indiaText), 'India exams carry no HSC band or NESA language');

console.log(failures.length
  ? `INDIA EXAM FLOW: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `INDIA EXAM FLOW: PASS — ${pass}/${pass} checks — CBSE Class 10 and 12, JEE Main, JEE Advanced and IOQM papers create, open, submit and mark.`);
process.exit(failures.length ? 1 : 0);
