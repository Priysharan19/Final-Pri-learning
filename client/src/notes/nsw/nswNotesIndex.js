// Pri Learning · NSW Notes — the topic index and loader.
//
// The notes page for the Prithagoras edition is built from the NSW curriculum
// model (engine/curriculum-nsw/): one topic per focus area of a current
// syllabus, so every topic NESA lists appears, with notes where they have been
// written and an honest "coming soon" where they have not. NOTHING here (or in
// the NSW notes page) imports the India curriculum or the India notes; a
// Prithagoras build never shows them (client/test/nsw-notes-no-india-check.mjs).
//
// A topic is keyed by the lower-case NESA outcome code of its focus area (a
// reference, never syllabus text). Years: Stage 4 is Years 7–8, Stage 5 is
// Years 9–10, Stage 6 is Year 11 or 12 by course.
import { mergeE3 } from '../e3.js';
import {
  NSW_MATHEMATICS_K10_2022, NSW_MATHEMATICS_STANDARD_2024, NSW_MATHEMATICS_ADVANCED_2024,
  NSW_MATHEMATICS_EXTENSION1_2024, NSW_MATHEMATICS_EXTENSION2_2024
} from '../../engine/curriculum-nsw/index.js';

export const NSW_NOTES_YEARS = Object.freeze([7, 8, 9, 10, 11, 12]);
// The course order of the Year 11–12 tabs, with the syllabus each one reads.
export const NSW_NOTES_COURSES = Object.freeze([
  { id: 'standard', labelKey: 'notes.nsw.course.standard', syllabus: NSW_MATHEMATICS_STANDARD_2024 },
  { id: 'advanced', labelKey: 'notes.nsw.course.advanced', syllabus: NSW_MATHEMATICS_ADVANCED_2024 },
  { id: 'ext1', labelKey: 'notes.nsw.course.ext1', syllabus: NSW_MATHEMATICS_EXTENSION1_2024 },
  { id: 'ext2', labelKey: 'notes.nsw.course.ext2', syllabus: NSW_MATHEMATICS_EXTENSION2_2024 }
]);

// K–10 strand names (NSW Mathematics K–10, 2022), by the three-letter code in a
// focus area's outcome code. A code not listed shows no strand.
const STRAND_KEYS = Object.freeze({
  'number-algebra': 'notes.nsw.strand.numberAlgebra',
  'measurement-space': 'notes.nsw.strand.measurementSpace',
  'statistics-probability': 'notes.nsw.strand.statisticsProbability'
});
const STRAND_OF = Object.freeze({
  ALG: 'number-algebra', EQU: 'number-algebra', FRC: 'number-algebra', IND: 'number-algebra', INT: 'number-algebra', LIN: 'number-algebra',
  RAT: 'number-algebra', MAG: 'number-algebra', NLI: 'number-algebra', FIN: 'number-algebra', FNC: 'number-algebra', LOG: 'number-algebra', POL: 'number-algebra',
  ANG: 'measurement-space', ARE: 'measurement-space', GEO: 'measurement-space', LEN: 'measurement-space', PYT: 'measurement-space', VOL: 'measurement-space', TRG: 'measurement-space', CIR: 'measurement-space',
  DAT: 'statistics-probability', PRO: 'statistics-probability'
});

const idOf = code => String(code).toLowerCase();

function k10Topics() {
  return NSW_MATHEMATICS_K10_2022.focusAreas.map(fa => {
    const code = fa.outcomes[0];
    const strand = STRAND_OF[code.split('-')[1]] || null;
    return Object.freeze({
      id: idOf(code), name: fa.name, outcomes: fa.outcomes, course: null, stage: fa.stage,
      years: fa.stage === 4 ? [7, 8] : [9, 10], strandKey: strand ? STRAND_KEYS[strand] : null, path: fa.kind === 'path'
    });
  });
}
function stage6Topics() {
  return NSW_NOTES_COURSES.flatMap(({ id, syllabus }) => syllabus.focusAreas.map(fa => Object.freeze({
    id: idOf(fa.outcomes[0]), name: fa.name, outcomes: fa.outcomes, course: id, stage: 6, years: [fa.year], strandKey: null, path: false
  })));
}

/** Every topic of every current NSW syllabus, in syllabus order. */
export const NSW_NOTES_TOPICS = Object.freeze([...k10Topics(), ...stage6Topics()]);
export const NSW_NOTES_TOPIC_BY_ID = Object.freeze(Object.fromEntries(NSW_NOTES_TOPICS.map(t => [t.id, t])));

/** The topics a Year tab shows (and, for Year 11–12, the chosen course). */
export function topicsFor(year, course = null) {
  return NSW_NOTES_TOPICS.filter(t => t.years.includes(year) && (year < 11 || t.course === course));
}

// One chunk per band of written notes. A band with no module yet has no
// entry: its topics show "coming soon".
/** A topic's base notes plus its premium layer (examiners, diagrams, aligned working, self-check). */
export function mergePremium(base, premium) {
  const out = {};
  for (const [id, n] of Object.entries(base)) {
    const p = premium?.[id];
    out[id] = p ? { ...n, examiners: p.examiners, diagrams: p.diagrams || [], check: p.check, examples: n.examples.map((ex, i) => ({ ...ex, working: p.working?.[i] })) } : n;
  }
  return out;
}

// Stage 6 notes are written per course (each one an on-demand chunk of its own); their
// modules are already complete (the premium layer is written into each topic).
// A band is one base file plus its premium layer; a stage (or a Stage 6 course) loads its bands together.
const bandsLoader = bands => async () => {
  const merged = await Promise.all(bands.map(async load => { const [base, premium] = await load(); return mergePremium(base.default, premium.default); }));
  return { default: Object.assign({}, ...merged) };
};

// The Experience 3 layer (objective, intuition, more teaching diagrams) of each stage or course:
// notes/e3.js. Loaded with, and merged over, the notes it completes.
const E3 = Object.freeze({
  4: [() => import('./notes-nsw-e3-stage4.js')],
  5: [() => import('./notes-nsw-e3-stage5-core.js'), () => import('./notes-nsw-e3-stage5-path.js')],
  'six:standard': [() => import('./notes-nsw-e3-standard.js')],
  'six:advanced': [() => import('./notes-nsw-e3-advanced.js')],
  'six:ext1': [() => import('./notes-nsw-e3-ext1.js')],
  'six:ext2': [() => import('./notes-nsw-e3-ext2.js')]
});

const LOADERS = Object.freeze({
  'six:advanced': () => import('./notes-nsw-stage6-advanced.js'),
  'six:standard': () => import('./notes-nsw-stage6-standard.js'),
  4: bandsLoader([
    () => Promise.all([import('./notes-nsw-stage4.js'), import('./notes-nsw-stage4-premium.js')]),
    () => Promise.all([import('./notes-nsw-stage4b.js'), import('./notes-nsw-stage4b-premium.js')])
  ]),
  5: bandsLoader(['core-a', 'core-b', 'path-a', 'path-b'].map(b => () => Promise.all([import(`./notes-nsw-stage5-${b}.js`), import(`./notes-nsw-stage5-${b}-premium.js`)]))),
  'six:ext1': bandsLoader(['a', 'b'].map(b => () => Promise.all([import(`./notes-nsw-ext1-${b}.js`), import(`./notes-nsw-ext1-${b}-premium.js`)]))),
  'six:ext2': bandsLoader([() => Promise.all([import('./notes-nsw-ext2.js'), import('./notes-nsw-ext2-premium.js')])])
});

/** The notes of every topic in a stage (an object keyed by topic id), or null when none are written yet. */
export async function loadNswNotesForStage(stage, course = null) {
  const key = stage === 6 ? `six:${course}` : stage;
  const load = LOADERS[key];
  if (!load) return null;
  const [notes, ...layers] = await Promise.all([load(), ...(E3[key] || []).map(l => l())]);
  return layers.reduce((n, l) => mergeE3(n, l.default, `NSW ${key}`), notes.default);
}

/** Whether a topic's stage has a notes module at all (the topic may still have none). */
export const stageHasNotes = (stage, course = null) => Object.hasOwn(LOADERS, stage === 6 ? `six:${course}` : stage);

/** The year a student studies a topic in, for headings: the Year tab if given, else the topic's first year. */
export const yearOfTopic = (topic, year = null) => (year && topic.years.includes(year) ? year : topic.years[0]);

/** Text a search matches: the topic name, its outcome codes, its strand. */
export const topicSearchText = topic => `${topic.name} ${topic.outcomes.join(' ')}`.toLowerCase();
