// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Section analysis of a finalised India exam
//
// A pure function of the marked paper: the per-question detail the marker wrote
// at finalisation and the blueprint's own section list. It never re-marks and
// never reads an answer key — every number below is arithmetic over marks that
// were already awarded, so the analysis can only disagree with the score if the
// arithmetic here is wrong, and client/test/exam-analysis-check.mjs pins that
// arithmetic against hand-computed papers.
//
// One vocabulary for every pattern. A question that was answered is either:
//   full     every available mark awarded
//   partial  some marks, not all (CBSE method marks, JEE Advanced per-option)
//   wrong    nothing, or a negative mark
// and a question that was not answered is `unattempted`. Accuracy is full
// answers over attempted questions. Positive marks are the sum of the marks
// awarded above zero, negative marks the sum below zero, and net is their
// difference — which is the paper score.
//
// What each pattern adds on top:
//   CBSE         step-mark losses — marks given away on questions that earned
//                some method marks but not all — per section A–E
//   JEE Main     the +4/−1 negative-marking picture: marks lost to wrong
//                answers, and the score with those answers left blank instead
//   JEE Advanced the partial-marking breakdown: how many multi-correct answers
//                earned partial credit, what it was worth and what it left
//   IOQM         no negative marks; the sections are its 2/3/5-mark tiers
//
// Time per section is reported only when the room actually measured time per
// question for the whole paper; an even split of the paper's total is not a
// measurement and is not presented as one. Weak chapters are the chapters where the paper lost at
// least half of what they were worth, ordered by marks lost.
// ─────────────────────────────────────────────────────────────────────────────

const pct = (n, d) => (d > 0 ? Math.round(1000 * n / d) / 10 : null);

function patternOf(indiaExam) {
  const track = indiaExam?.track;
  if (track === 'cbse') return 'cbse';
  if (track === 'jee-main') return 'jee-main';
  if (track === 'jee-advanced') return 'jee-advanced';
  if (track === 'olympiad') return 'ioqm';
  return 'generic';
}

/** full / partial / wrong / unattempted for one marked question. */
export function outcomeOf(d) {
  if (d.unanswered) return 'unattempted';
  const marks = Number(d.marks) || 0;
  const awarded = Number(d.awarded) || 0;
  if (marks > 0 && awarded >= marks) return 'full';
  if (awarded > 0) return 'partial';
  return 'wrong';
}

function blank(id, label) {
  return {
    id, label, questions: 0, marks: 0, awarded: 0, positive: 0, negative: 0,
    attempted: 0, unattempted: 0, full: 0, partial: 0, wrong: 0,
    unattemptedMarks: 0, lostOnAttempted: 0, partialMarks: 0, partialLeft: 0,
    stepMarked: 0, stepMarksEarned: 0, stepMarksLost: 0,
    ms: 0, timedQuestions: 0
  };
}

function add(row, d) {
  const marks = Number(d.marks) || 0;
  const awarded = Number(d.awarded) || 0;
  const outcome = outcomeOf(d);
  row.questions++;
  row.marks += marks;
  row.awarded += awarded;
  if (awarded > 0) row.positive += awarded;
  if (awarded < 0) row.negative += -awarded;
  if (outcome === 'unattempted') {
    row.unattempted++;
    row.unattemptedMarks += marks;
  } else {
    row.attempted++;
    row[outcome]++;
    row.lostOnAttempted += marks - awarded;
  }
  if (outcome === 'partial') {
    row.partialMarks += awarded;
    row.partialLeft += marks - awarded;
  }
  // A step-marked question is one the marker credited for working, either as a
  // whole question (Step Check on the working) or part by part (case studies).
  const stepCredit = d.partial && Number(d.partial.awarded) > 0;
  const partCredit = d.multipart && outcome === 'partial';
  if (stepCredit || partCredit) {
    row.stepMarked++;
    row.stepMarksEarned += awarded;
    row.stepMarksLost += marks - awarded;
  }
  // `timed` is set by the marker when the room measured time per question; a
  // question never opened was measured too, at zero.
  if (d.timed === true) {
    row.ms += Math.max(0, Number(d.ms) || 0);
    row.timedQuestions++;
  }
}

function finish(row) {
  return {
    ...row,
    accuracy: pct(row.full, row.attempted),
    scorePct: pct(row.awarded, row.marks)
  };
}

/**
 * The analysis of one marked paper.
 * @param {{ detail: object[], indiaExam?: object }} paper
 * @returns {object|null} null when the detail carries no sections to analyse
 */
export function analyseExam({ detail, indiaExam } = {}) {
  const rows = Array.isArray(detail) ? detail.filter(d => d && typeof d === 'object') : [];
  if (!rows.length || rows.some(d => d.section === undefined || d.section === null)) return null;
  const pattern = patternOf(indiaExam);

  // Sections in the blueprint's order; any section the blueprint does not name
  // (an older paper) follows in the order it first appears.
  const order = [];
  const labels = new Map();
  for (const s of indiaExam?.sections || []) { order.push(String(s.id)); labels.set(String(s.id), s.label || `Section ${s.id}`); }
  const sorted = [...rows].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  for (const d of sorted) {
    const id = String(d.section);
    if (!order.includes(id)) { order.push(id); labels.set(id, d.sectionLabel || `Section ${id}`); }
  }
  const bySection = new Map(order.map(id => [id, blank(id, labels.get(id))]));
  const total = blank('paper', 'Whole paper');
  const chapters = new Map();
  for (const d of sorted) {
    add(bySection.get(String(d.section)), d);
    add(total, d);
    const cid = d.chapterId || d.subtopic || 'unlabelled';
    if (!chapters.has(cid)) chapters.set(cid, blank(cid, d.subtopicName || cid));
    add(chapters.get(cid), d);
  }
  const sections = order.map(id => bySection.get(id)).filter(s => s.questions > 0).map(finish);
  const timed = total.questions > 0 && total.timedQuestions === total.questions;

  const out = {
    pattern,
    timed,
    totals: finish(total),
    sections: sections.map(s => timed ? { ...s, msPerQuestion: Math.round(s.ms / s.questions) } : { ...s, ms: null, msPerQuestion: null }),
    weakChapters: [...chapters.values()]
      .map(finish)
      .map(c => ({ ...c, lost: c.marks - c.awarded }))
      .filter(c => c.marks > 0 && c.awarded * 2 < c.marks)
      .sort((a, b) => (b.lost - a.lost) || ((a.scorePct ?? 0) - (b.scorePct ?? 0)) || String(a.label).localeCompare(String(b.label)))
      .slice(0, 5)
      .map(c => ({ id: c.id, label: c.label, questions: c.questions, marks: c.marks, awarded: c.awarded, lost: c.lost, unattempted: c.unattempted, wrong: c.wrong, partial: c.partial, scorePct: c.scorePct }))
  };
  if (!timed) out.totals = { ...out.totals, ms: null };

  if (pattern === 'cbse') {
    out.stepMarks = {
      questions: total.stepMarked,
      earned: total.stepMarksEarned,
      lost: total.stepMarksLost,
      lostOnAttempted: total.lostOnAttempted,
      unattemptedMarks: total.unattemptedMarks
    };
  }
  if (pattern === 'jee-main' || pattern === 'jee-advanced') {
    out.negativeMarking = {
      wrong: total.wrong,
      marksLost: total.negative,
      // Leaving every wrong answer blank instead would have scored exactly the
      // marks those answers cost — no more, since a blank scores zero here.
      netIfWrongLeftBlank: total.awarded + total.negative,
      net: total.awarded,
      positive: total.positive
    };
  }
  if (pattern === 'jee-advanced') {
    out.partialMarking = {
      questions: total.partial,
      marks: total.partialMarks,
      left: total.partialLeft,
      sections: sections.filter(s => s.partial > 0 || s.id === '2').map(s => ({ id: s.id, label: s.label, partial: s.partial, marks: s.partialMarks, left: s.partialLeft, full: s.full, wrong: s.wrong }))
    };
  }
  return out;
}
