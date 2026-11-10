// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the targeted board mock (premium-intelligence plan F3)
//
// A targeted paper is a board mock whose BLUEPRINT is unchanged — the same
// sections, the same item types, the same marks, the same chapter the layout
// allots each slot — but whose questions are drawn, inside each allotted
// chapter, toward the subtopics this account's own marked work says are weak
// or due. Two pure functions, shared by the device (which composes) and the
// server (which decides, labels and writes the key):
//
//   targetsFrom({ due, notebook })      → the ranked targets, with evidence
//   whyTheseQuestions(questions, targets, { cap })
//                                       → the "why these questions" key
//
// The rule is transparent and deliberately simple (research gate:
// docs/research/RESEARCH_TO_BUILD_V7.md, V7-17 — an information-gain selector
// is later work). A subtopic is a target when
//   · DUE: a dot point in it is under its retention target on the per-dot-
//     point review queue (engine/reviewQueue.js dueDotpoints), or
//   · MISTAKES: it holds an unfixed mistake in the notebook
//     (engine/mistakeNotebook.js buildNotebook).
// Nothing else is inferred. A subtopic with no marked work is never a target.
//
// CAP. At most TARGETED_SHARE_CAP of the paper's questions may be targeted,
// so the paper stays a sample of the whole syllabus. Even so, a targeted paper
// is NOT a fair estimate of a whole-syllabus mark
// (docs/research/PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md): its score must
// not feed a forecast or readiness band without reweighting, and its copy says
// "targeted paper", never "the paper you will get".
// ─────────────────────────────────────────────────────────────────────────────

export const TARGETED_SHARE_CAP = 0.6;
export const MAX_TARGETS = 12;
export const TARGETED_LABEL = 'Targeted paper in board format';

/** The most questions of an n-question paper that may be targeted. */
export function targetedCap(n, cap = TARGETED_SHARE_CAP) {
  return Math.max(0, Math.floor((Number(n) || 0) * cap));
}

/**
 * The targets, strongest evidence first: due dot points (lowest recall first),
 * then subtopics with unfixed mistakes (most open first). One row per subtopic,
 * carrying every piece of evidence for it.
 *   due      — rows of dueDotpoints().due: { subtopic, dotpoint, recall, target }
 *   notebook — entries of buildNotebook(): { subtopic, dotpoint, fixed }
 */
export function targetsFrom({ due = [], notebook = [] } = {}) {
  const bySubtopic = new Map();
  const row = subtopic => bySubtopic.get(subtopic) || bySubtopic.set(subtopic, {
    subtopic, dueDotpoints: [], lowestRecall: null, openMistakes: 0, mistakeDotpoints: []
  }).get(subtopic);
  for (const d of Array.isArray(due) ? due : []) {
    if (!d || typeof d.subtopic !== 'string' || !d.subtopic) continue;
    const r = row(d.subtopic);
    if (typeof d.dotpoint === 'string' && !r.dueDotpoints.includes(d.dotpoint)) r.dueDotpoints.push(d.dotpoint);
    const recall = Number(d.recall);
    if (Number.isFinite(recall)) r.lowestRecall = r.lowestRecall === null ? recall : Math.min(r.lowestRecall, recall);
  }
  for (const e of Array.isArray(notebook) ? notebook : []) {
    if (!e || e.fixed === true || typeof e.subtopic !== 'string' || !e.subtopic) continue;
    const r = row(e.subtopic);
    r.openMistakes++;
    if (typeof e.dotpoint === 'string' && !r.mistakeDotpoints.includes(e.dotpoint)) r.mistakeDotpoints.push(e.dotpoint);
  }
  return [...bySubtopic.values()]
    .map(r => ({ ...r, reasons: [...(r.dueDotpoints.length ? ['due'] : []), ...(r.openMistakes ? ['mistakes'] : [])] }))
    .sort((a, b) => (b.dueDotpoints.length > 0) - (a.dueDotpoints.length > 0)
      || (a.lowestRecall ?? 1) - (b.lowestRecall ?? 1)
      || b.openMistakes - a.openMistakes
      || a.subtopic.localeCompare(b.subtopic))
    .slice(0, MAX_TARGETS);
}

/** The subtopics of a target list, as a set the composer can test cells with. */
export function targetSubtopics(targets) {
  return new Set((Array.isArray(targets) ? targets : []).map(t => t?.subtopic).filter(s => typeof s === 'string' && s));
}

/** The generators an issued or composed question was drawn from. */
export function generatorsOf(question) {
  const out = new Set();
  if (typeof question?.generator === 'string') out.add(question.generator);
  for (const cell of question?.recipe?.cells || []) if (typeof cell?.generator === 'string') out.add(cell.generator);
  if (typeof question?.recipe?.generator === 'string') out.add(question.recipe.generator);
  return [...out];
}

/**
 * The "why these questions" key: for every question of the paper, whether it
 * was drawn toward a target and on what evidence, in plain words. A question
 * is counted as targeted when a generator it was drawn from is a target's
 * subtopic. `withinCap` is false when the paper holds more targeted questions
 * than the cap allows — the server refuses such a paper.
 */
export function whyTheseQuestions(questions, targets, { cap = TARGETED_SHARE_CAP } = {}) {
  const list = Array.isArray(questions) ? questions : [];
  const byGen = new Map((Array.isArray(targets) ? targets : []).map(t => [t.subtopic, t]));
  const rows = list.map((q, i) => {
    const hit = generatorsOf(q).map(g => byGen.get(g)).find(Boolean) || null;
    return {
      order: Number(q?.order) || i + 1,
      section: q?.section ?? null,
      chapterName: q?.chapterName || null,
      targeted: !!hit,
      ...(hit ? { subtopic: hit.subtopic, reasons: hit.reasons, due: hit.dueDotpoints.length, open: hit.openMistakes, because: becauseOf(hit) } : {})
    };
  });
  const targeted = rows.filter(r => r.targeted).length;
  const limit = targetedCap(list.length, cap);
  return { questions: list.length, targeted, cap: limit, withinCap: targeted <= limit, rows };
}

/** One plain sentence of evidence for a target. No prediction, no promise. */
export function becauseOf(target) {
  const parts = [];
  const due = target?.dueDotpoints?.length || 0;
  const open = Number(target?.openMistakes) || 0;
  if (due) parts.push(due === 1 ? 'a dot point here is due for review' : `${due} dot points here are due for review`);
  if (open) parts.push(open === 1 ? 'you have 1 unfixed mistake here' : `you have ${open} unfixed mistakes here`);
  return parts.length ? `Chosen because ${parts.join(' and ')}.` : '';
}
