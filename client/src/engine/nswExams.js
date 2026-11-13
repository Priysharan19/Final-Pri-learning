// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW HSC-style paper blueprints (Prithagoras, plan mission G4)
//
// One blueprint per HSC course examined under the 2024 Stage 6 syllabuses
// (first HSC examination 2027): Mathematics Standard 1, Standard 2, Advanced,
// Extension 1 and Extension 2. Each is an ORIGINAL structure. What is taken
// from NESA is only what NESA publishes as the examination SPECIFICATION —
// reading time, working time, total marks, the marks and item counts of
// Section I and Section II, and which part of the course is examined — read on
// each course's "HSC examinations" page and recorded in
// docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.3. No NESA paper,
// question, marking guideline, sample answer or reference sheet is reproduced
// here or anywhere else (§5.7: Crown copyright; the schools licence excludes
// tutoring companies and publishers).
//
// WHAT A BLUEPRINT SAYS. Its sections, and in each section its SLOTS: one
// question each, worth a stated number of marks, on ONE outcome code of the
// course's current syllabus. Which outcome each slot is on, and how many
// marks, is this product's own design: every Year 12 outcome of the examined
// course has slots, and Year 11 outcomes the specification says "may be
// examined" (or "assumed and may be examined") have smaller ones. The design
// is fixed in this file. It is never fitted to whatever content exists:
// whether a blueprint can be SAT is the release check below, and a blueprint
// whose slots cannot all be filled is refused, not trimmed.
//
// RELEASE (blueprintRelease; CTO decision for G4, 13 Nov 2026). The server
// hands in its pool of APPROVED
// QUESTION FORMS: each a (generator, difficulty) cell that the Prithagoras
// edition issues (server/platform/nswBanks.js: crosswalk-mapped to a current
// syllabus, a dot point behind it, a final answer, and through the quality
// gate), with the outcome codes every question it generates is sealed with.
// One form yields many questions with different numbers; it is still ONE
// approved question for this check, because a paper that draws all its
// questions on an outcome from one template is that template repeated. A
// slot is fillable when at least NSW_MIN_FORMS_PER_SLOT distinct forms are on
// its outcome, and an outcome is COVERED when its slots are fillable.
//   · Every slot fillable: the whole paper is released.
//   · Otherwise a PARTIAL paper — the fillable slots only — is released when
//     at least NSW_RELEASE_FLOOR of the course's Year 12 outcomes are covered.
//     The course's Year 12 outcomes come from the G2 model, handed in by the
//     server (never entered here). Its marks and working time are scaled to
//     what it examines, its title says "Practice paper — N of M Year 12
//     outcomes" (never HSC or trial), and every surface names what it omits.
//   · Below the floor the blueprint is refused, with its gaps listed.
// Nothing here pads a slot from another outcome, another course or another
// edition's banks.
//
// MARKING. Final answer only, by the deterministic engine on the server,
// exactly as every Prithagoras question is marked until a human HSC examiner
// certifies rubrics (plan G6). A slot worth n marks earns n or 0 —
// "answer checked: n of n or 0". HSC marking rewards working; this paper does
// not, and says so. The result is an "Answer-checked practice paper": never an
// HSC mark, band, ATAR, prediction or comparison with a state mean.
//
// Pure data and pure functions. This file does not import the NSW curriculum
// model (client/test/nsw-curriculum-check.mjs keeps client/src from depending
// on it); client/test/nsw-exams-check.mjs holds every outcome code here to
// that model, and the server builds the pool from it.
// ─────────────────────────────────────────────────────────────────────────────

/** What every NSW paper is called on every surface. */
export const NSW_EXAM_LABEL = 'Answer-checked practice paper';

/** The fixed sentence a result and the paper list carry about marking. */
export const NSW_MARKING_NOTE = 'Each question is checked on its final answer only: a question worth n marks earns n or 0. HSC markers also give marks for working; this paper does not, so it is not an HSC mark and predicts no band.';

/** How many distinct approved question forms each slot needs before a paper is released. */
export const NSW_MIN_FORMS_PER_SLOT = 3;

/** The share of the course's Year 12 outcomes a partial paper must cover to be released. */
export const NSW_RELEASE_FLOOR = 0.75;

/**
 * The difficulties (1–4) a slot worth this many marks PREFERS: the server
 * draws from a form at one of these when the slot has one, and from any of the
 * slot's forms otherwise. A preference, not a release condition: a form is an
 * approved question on its outcome whatever its level, and the marks a slot
 * carries are the blueprint's, not the form's.
 */
export const DIFFICULTIES_FOR_MARKS = Object.freeze({
  1: Object.freeze([1, 2]),
  2: Object.freeze([2, 3]),
  3: Object.freeze([2, 3, 4]),
  4: Object.freeze([3, 4]),
  5: Object.freeze([4])
});

const SPEC_PAGE = course => `https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-${course}-11-12-2024/assessment/hsc-examinations`;
const RESEARCH = 'docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.3';

const source = (course, examined) => Object.freeze({
  authority: 'NESA',
  document: `Mathematics ${course === 'standard' ? 'Standard' : course === 'advanced' ? 'Advanced' : course === 'extension-1' ? 'Extension 1' : 'Extension 2'} 11–12 Syllabus (2024): HSC examinations`,
  url: SPEC_PAGE(course),
  accessed: '2026-11-13',
  research: RESEARCH,
  // What the specification itself says is examined, in our words.
  examined,
  // Taken from the specification: times, marks, sections and item counts.
  // Everything else — which outcome each slot is on and how many marks it
  // carries — is this product's own design.
  takes: 'reading time, working time, total marks, Section I and Section II marks and item counts'
});

/**
 * Expand a compact design into slots. `objective` lists the outcome of each
 * 1-mark Section I slot; `written` maps an outcome to the marks of each of
 * its Section II slots.
 */
function design({ objective, written }) {
  const one = (section, outcome, marks) => Object.freeze({ section, outcome, marks, difficulties: DIFFICULTIES_FOR_MARKS[marks] });
  return Object.freeze([
    Object.freeze({
      id: 'I', label: 'Section I', marksEach: 1,
      slots: Object.freeze(objective.map(outcome => one('I', outcome, 1)))
    }),
    Object.freeze({
      id: 'II', label: 'Section II',
      slots: Object.freeze(Object.entries(written).flatMap(([outcome, list]) => list.map(marks => one('II', outcome, marks))))
    })
  ]);
}

function blueprint(b) {
  const sections = design(b.design);
  return Object.freeze({
    id: b.id, course: b.course, label: b.label, year: 12, modelCourse: b.modelCourse || null,
    syllabus: b.syllabus, syllabusVersion: '2024', firstExamined: 2027,
    readingMin: 10, workingMin: b.workingMin, totalMarks: b.totalMarks,
    spec: Object.freeze(b.spec), source: source(b.sourceCourse, b.examined),
    sections
  });
}

const STANDARD = 'nsw-mathematics-standard-11-12-2024';
const ADVANCED = 'nsw-mathematics-advanced-11-12-2024';
const EXT1 = 'nsw-mathematics-extension1-11-12-2024';
const EXT2 = 'nsw-mathematics-extension2-11-12-2024';

/**
 * The five blueprints. `spec` is NESA's specification as G1 recorded it (the
 * check holds each design to it); `design` is ours.
 */
export const NSW_EXAM_BLUEPRINTS = Object.freeze([
  blueprint({
    id: 'nsw-hsc-standard-1-2027', course: 'standard-1', label: 'Mathematics Standard 1', sourceCourse: 'standard', modelCourse: 'Standard 1',
    syllabus: STANDARD, workingMin: 120, totalMarks: 80,
    spec: { sectionIMarks: 15, sectionIIMarks: 65, sectionIIItems: [25, 30] },
    examined: 'The Year 12 Standard 1 course; the Year 11 course is assumed knowledge and may be examined. The examination is optional.',
    design: {
      objective: ['MST-12-S1-01', 'MST-12-S1-02', 'MST-12-S1-03', 'MST-12-S1-04', 'MST-12-S1-05', 'MST-12-S1-06', 'MST-12-S1-07',
        'MST-11-01', 'MST-11-02', 'MST-11-03', 'MST-11-04', 'MST-11-05', 'MST-11-06', 'MST-11-07', 'MST-11-08'],
      written: {
        'MST-12-S1-01': [2, 3], 'MST-12-S1-02': [2, 3, 3], 'MST-12-S1-03': [2, 3, 3], 'MST-12-S1-04': [2, 3, 3],
        'MST-12-S1-05': [2, 3], 'MST-12-S1-06': [2, 3, 3], 'MST-12-S1-07': [2, 3],
        'MST-11-01': [2], 'MST-11-02': [2], 'MST-11-03': [2, 1], 'MST-11-04': [2, 1], 'MST-11-05': [2],
        'MST-11-06': [2], 'MST-11-07': [1], 'MST-11-08': [2, 1]
      }
    }
  }),
  blueprint({
    id: 'nsw-hsc-standard-2-2027', course: 'standard-2', label: 'Mathematics Standard 2', sourceCourse: 'standard', modelCourse: 'Standard 2',
    syllabus: STANDARD, workingMin: 150, totalMarks: 100,
    spec: { sectionIMarks: 15, sectionIIMarks: 85, sectionIIItems: [35, 40] },
    examined: 'The Year 12 Standard 2 course; the Year 11 course is assumed knowledge and may be examined.',
    design: {
      objective: ['MST-12-S2-01', 'MST-12-S2-02', 'MST-12-S2-03', 'MST-12-S2-04', 'MST-12-S2-05', 'MST-12-S2-06', 'MST-12-S2-07',
        'MST-12-S2-08', 'MST-12-S2-09', 'MST-12-S2-10', 'MST-11-01', 'MST-11-03', 'MST-11-05', 'MST-11-06', 'MST-11-08'],
      written: {
        'MST-12-S2-01': [2, 3], 'MST-12-S2-02': [2, 3, 3], 'MST-12-S2-03': [2, 3, 3], 'MST-12-S2-04': [2, 3, 3],
        'MST-12-S2-05': [2, 3], 'MST-12-S2-06': [2, 3], 'MST-12-S2-07': [2, 3, 3], 'MST-12-S2-08': [2, 3, 3],
        'MST-12-S2-09': [2, 3], 'MST-12-S2-10': [2, 3, 3],
        'MST-11-01': [2, 1], 'MST-11-02': [2], 'MST-11-03': [2], 'MST-11-04': [2], 'MST-11-05': [2, 1],
        'MST-11-06': [2], 'MST-11-07': [2], 'MST-11-08': [1]
      }
    }
  }),
  blueprint({
    id: 'nsw-hsc-advanced-2027', course: 'advanced', label: 'Mathematics Advanced', sourceCourse: 'advanced',
    syllabus: ADVANCED, workingMin: 180, totalMarks: 100,
    spec: { sectionIMarks: 10, sectionIIMarks: 90, sectionIIItems: [37, 42], sectionIIAtLeastTwoOf: [4, 5] },
    examined: 'The Year 12 Advanced course; Year 11 content may be examined.',
    design: {
      objective: ['MAV-11-02', 'MAV-11-04', 'MAV-11-07', 'MAV-11-09', 'MAV-12-01', 'MAV-12-03', 'MAV-12-04', 'MAV-12-05', 'MAV-12-06', 'MAV-12-07'],
      written: {
        'MAV-12-01': [2, 2, 3], 'MAV-12-02': [2, 3, 4], 'MAV-12-03': [2, 2, 3], 'MAV-12-04': [2, 2, 3, 3],
        'MAV-12-05': [2, 3, 3, 4], 'MAV-12-06': [2, 3, 4, 5], 'MAV-12-07': [2, 2, 3], 'MAV-12-08': [2, 3, 3],
        'MAV-11-01': [1], 'MAV-11-02': [2], 'MAV-11-03': [2], 'MAV-11-04': [2], 'MAV-11-05': [2],
        'MAV-11-06': [2], 'MAV-11-07': [1], 'MAV-11-08': [2], 'MAV-11-09': [1], 'MAV-11-10': [1]
      }
    }
  }),
  blueprint({
    id: 'nsw-hsc-extension-1-2027', course: 'extension-1', label: 'Mathematics Extension 1', sourceCourse: 'extension-1',
    syllabus: EXT1, workingMin: 120, totalMarks: 70,
    spec: { sectionIMarks: 10, sectionIIMarks: 60, sectionIIItems: [23, 28] },
    examined: 'The Year 12 Extension 1 course; Advanced and the Year 11 Extension 1 course are assumed knowledge, and Year 11 Extension 1 content may be examined.',
    design: {
      objective: ['ME1-11-01', 'ME1-11-02', 'ME1-11-03', 'ME1-11-04', 'ME1-11-05', 'ME1-12-02', 'ME1-12-03', 'ME1-12-04', 'ME1-12-05', 'ME1-12-06'],
      written: {
        'ME1-12-01': [3, 4], 'ME1-12-02': [2, 3, 4], 'ME1-12-03': [2, 3], 'ME1-12-04': [2, 3, 4],
        'ME1-12-05': [2, 3, 3], 'ME1-12-06': [2, 3, 3],
        'ME1-11-01': [2, 2], 'ME1-11-02': [2, 3], 'ME1-11-03': [2], 'ME1-11-04': [2], 'ME1-11-05': [1]
      }
    }
  }),
  blueprint({
    id: 'nsw-hsc-extension-2-2027', course: 'extension-2', label: 'Mathematics Extension 2', sourceCourse: 'extension-2',
    syllabus: EXT2, workingMin: 180, totalMarks: 100,
    spec: { sectionIMarks: 10, sectionIIMarks: 90, sectionIIItems: [37, 42] },
    examined: 'The Year 12 Extension 2 course; Advanced and Extension 1 are assumed knowledge (students also sit the Extension 1 examination).',
    design: {
      objective: ['ME2-12-01', 'ME2-12-01', 'ME2-12-02', 'ME2-12-02', 'ME2-12-03', 'ME2-12-03', 'ME2-12-04', 'ME2-12-04', 'ME2-12-05', 'ME2-12-05'],
      written: {
        'ME2-12-01': [1, 2, 2, 2, 3, 3, 4], 'ME2-12-02': [1, 2, 2, 2, 3, 3, 4], 'ME2-12-03': [1, 2, 2, 2, 3, 3, 3, 4],
        'ME2-12-04': [1, 2, 2, 2, 3, 3, 3, 4], 'ME2-12-05': [1, 2, 2, 2, 3, 3, 3]
      }
    }
  })
]);

export const NSW_EXAM_BLUEPRINT_BY_ID = Object.freeze(Object.fromEntries(NSW_EXAM_BLUEPRINTS.map(b => [b.id, b])));

/** A blueprint by id, or null. Own entries only. */
export function nswExamBlueprint(id) {
  return typeof id === 'string' && Object.hasOwn(NSW_EXAM_BLUEPRINT_BY_ID, id) ? NSW_EXAM_BLUEPRINT_BY_ID[id] : null;
}

/** Every slot of a blueprint in paper order, numbered from 1. */
export function slotsOf(b) {
  let n = 0;
  return b.sections.flatMap(section => section.slots.map(slot => ({ ...slot, number: ++n, sectionLabel: section.label })));
}

/** The outcome codes a blueprint has slots on, in first-slot order. */
export function outcomesOf(b) {
  return [...new Set(slotsOf(b).map(slot => slot.outcome))];
}

/** Marks and item counts as designed: what the check holds to the specification. */
export function tallyOf(b) {
  const [one, two] = b.sections;
  const marks = s => s.slots.reduce((n, slot) => n + slot.marks, 0);
  return {
    sectionIMarks: marks(one), sectionIItems: one.slots.length,
    sectionIIMarks: marks(two), sectionIIItems: two.slots.length,
    totalMarks: marks(one) + marks(two), items: one.slots.length + two.slots.length,
    durationMin: b.readingMin + b.workingMin
  };
}

/**
 * The approved forms that can fill one slot: every form on its outcome, the
 * ones at a difficulty the slot prefers first. `pool` is the server's list of
 * `{ generator, difficulty, outcomes: [code…], types: [answerType…] }`.
 *
 * A slot worth more than one mark is never a multiple-choice question:
 * marked all or nothing, a blind guess at four options would earn the whole
 * 2–5 marks one time in four. Such a slot counts only forms KNOWN to set
 * written questions (their sampled answer types include one that is not
 * multiple choice), and the server redraws a form's multiple-choice variants
 * away for it. A form whose answer types are unknown is not counted there.
 */
export function formsForSlot(slot, pool) {
  const seen = new Set();
  const out = [];
  const preferred = form => (slot.difficulties || []).includes(form.difficulty) ? 0 : 1;
  for (const form of [...(pool || [])].sort((a, b) => preferred(a) - preferred(b))) {
    if (!form || !Array.isArray(form.outcomes) || !form.outcomes.includes(slot.outcome)) continue;
    if ((slot.marks || 1) > 1 && !writtenOnly(form)) continue;
    const key = `${form.generator}|${form.difficulty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(form);
  }
  return out;
}

/** Does this form set questions answered in writing (an answer type that is not multiple choice)? */
export const writtenOnly = form => Array.isArray(form?.types) && form.types.some(type => type !== 'mcq' && type !== 'multi-mcq');

/** A working time scaled to the marks a partial paper keeps: whole five minutes, at least ten. */
export const scaledMinutes = (minutes, kept, total) => (kept >= total ? minutes : Math.max(10, Math.round((minutes * kept / Math.max(1, total)) / 5) * 5));

/**
 * Whether a blueprint may be sat on this pool, in what form, and exactly why
 * not. `year12Outcomes` is the course's Year 12 outcome codes from the G2
 * model (the server's); without it nothing is released.
 *
 * Returns `{ released, full, slots, unfillable, included, formsByOutcome,
 * missingOutcomes, thinOutcomes, omittedOutcomes, year12: { total, covered,
 * codes, coveredCodes, share }, marks, workingMin, floor }`. `included` is
 * the slots a released paper sets (every slot when full; the fillable ones
 * when partial; none when refused). `omittedOutcomes` are the outcomes with
 * a slot the paper cannot fill, Year 11 and Year 12 alike.
 */
export function blueprintRelease(b, pool, { year12Outcomes = null } = {}) {
  const slots = slotsOf(b).map(slot => ({ number: slot.number, section: slot.section, outcome: slot.outcome, marks: slot.marks, forms: formsForSlot(slot, pool).length }));
  const unfillable = slots.filter(slot => slot.forms < NSW_MIN_FORMS_PER_SLOT);
  const formsByOutcome = Object.fromEntries(outcomesOf(b).map(code => [code, formsForSlot({ outcome: code }, pool).length]));
  const short = new Set(unfillable.map(slot => slot.outcome));
  const codes = Array.isArray(year12Outcomes) ? [...new Set(year12Outcomes)] : [];
  // A Year 12 outcome is covered when the paper has slots on it and all of them can be filled.
  const coveredCodes = codes.filter(code => slots.some(slot => slot.outcome === code) && !short.has(code));
  const share = codes.length ? coveredCodes.length / codes.length : 0;
  const full = unfillable.length === 0 && codes.length > 0 && coveredCodes.length === codes.length;
  const released = codes.length > 0 && (full || share >= NSW_RELEASE_FLOOR);
  const included = released ? slots.filter(slot => slot.forms >= NSW_MIN_FORMS_PER_SLOT) : [];
  const totalMarks = slots.reduce((n, slot) => n + slot.marks, 0);
  const marks = included.reduce((n, slot) => n + slot.marks, 0);
  return {
    id: b.id, released, full, floor: NSW_RELEASE_FLOOR, minFormsPerSlot: NSW_MIN_FORMS_PER_SLOT,
    slots, unfillable, included, formsByOutcome,
    missingOutcomes: outcomesOf(b).filter(code => formsByOutcome[code] === 0),
    thinOutcomes: outcomesOf(b).filter(code => short.has(code) && formsByOutcome[code] > 0),
    omittedOutcomes: outcomesOf(b).filter(code => short.has(code)),
    year12: { total: codes.length, covered: coveredCodes.length, codes, coveredCodes, share },
    marks: released ? marks : 0, totalMarks,
    workingMin: released ? scaledMinutes(b.workingMin, marks, totalMarks) : 0
  };
}

/** The brief's name for the release test: true when the paper, whole or partial, may be sat. */
export function blueprintReleasable(b, pool, options) {
  return blueprintRelease(b, pool, options).released;
}

/**
 * The title a paper is sealed under: the server's, never the device's. A
 * partial paper is a "Practice paper — N of M Year 12 outcomes", never an HSC
 * paper or a trial.
 */
export const nswPaperTitle = (b, release = null) => (release && release.released && !release.full
  ? `${b.label} · Practice paper — ${release.year12.covered} of ${release.year12.total} Year 12 outcomes`
  : `${b.label} · ${NSW_EXAM_LABEL}`);
