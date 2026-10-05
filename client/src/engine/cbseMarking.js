// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · marking the way a board examiner marks
//
// The problem this exists for is specific and Indian. CBSE awards marks per
// STEP, not per answer: a three-mark question is typically one mark for the
// formula, one for the substitution, one for the final answer with its units.
// Correct method with a slip in the arithmetic still earns two of three. Work
// with no steps shown earns the answer mark and nothing else, because an
// examiner cannot award credit for reasoning they cannot see.
//
// Every Indian student is told this. Almost none of them get to practise it,
// because the person who would mark their working is teaching a class of
// twenty-seven — forty-seven in Jharkhand — with a million teaching posts
// vacant nationally. Explanation is abundant in India; a lecture on any topic
// is a search away. What is scarce is somebody to read YOUR notebook and say
// which line lost the mark.
//
// So this module does not explain. It marks, in the shape the board marks:
//
//   · a scheme derived from the question's own worked solution, allocating the
//     question's marks across method, substitution, computation and answer;
//   · the student's working walked against that scheme in order, the way an
//     examiner ticks scheme points down a page;
//   · error carried forward, so one slip costs one mark and not the paper;
//   · the answer mark withheld when the units are missing, which is the most
//     commonly lost mark in Indian board mathematics;
//   · and the "no working shown" rule stated plainly, because a student who
//     writes only the answer has thrown away marks they had earned.
//
// HONESTY. This is a scheme DERIVED from the worked solution, not CBSE's own
// marking scheme for a real past paper. It follows the published convention;
// it is not the official document, and nothing here may claim it is. The
// wording that reaches the student says "board-style", never "official".
// ─────────────────────────────────────────────────────────────────────────────

// Every sentence this module shows a student is a catalogue key (board.* in
// i18n/strings.en.js). Rows and the summary carry the key and its variables so
// the card renders them in the student's language; the English fields are the
// same keys resolved against the English catalogue, so there is one copy.
import en from '../i18n/strings.en.js';
import { pluralCategory } from '../i18n/languages.js';
import { unitWritten } from './units.js';
import { ruleKeyFor } from './checker.js';

const english = (key, vars = {}) => {
  let entry = en[key];
  if (entry && typeof entry === 'object') entry = entry[pluralCategory(vars.count, 'en')] ?? entry.other;
  return String(entry ?? key).replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
};

/** The four things a board scheme puts marks on, in the order they are earned. */
export const MARK_KINDS = Object.freeze({
  METHOD: 'method',
  SUBSTITUTION: 'substitution',
  COMPUTATION: 'computation',
  ANSWER: 'answer'
});

const LABEL_KEY = Object.freeze({
  [MARK_KINDS.METHOD]: 'board.labelMethod',
  [MARK_KINDS.SUBSTITUTION]: 'board.labelSubstitution',
  [MARK_KINDS.COMPUTATION]: 'board.labelComputation',
  [MARK_KINDS.ANSWER]: 'board.labelAnswer'
});
const LABEL = Object.freeze(Object.fromEntries(Object.entries(LABEL_KEY).map(([kind, key]) => [kind, english(key)])));

/** Headings a generator uses for work that is not a scheme point. */
const NON_SCHEME = /^(check|note|bonus|aside|remark)/i;

const SUBSTITUTION = /substitut|put |plug|insert|apply the values|using the values|find r\b|set /i;
const METHOD = /formula|rule|identity|theorem|law|general term|method|expand|set up|let |define|standard result|approach/i;
const ANSWERY = /answer|solution|result|conclusion|hence|therefore|final/i;

const text = v => String(v ?? '').trim();

/**
 * Which kind of scheme point a solution step is.
 *
 * Read from the heading first, because a generator's headings are written by
 * the person who authored the mathematics and are the best signal there is.
 * Position breaks ties: the first step of a worked solution is the method
 * almost without exception, and the last is the answer.
 */
export function classifyStep(step, index, total) {
  const h = text(step?.h);
  const body = text(step?.d);
  const last = index === total - 1;

  if (last) return MARK_KINDS.ANSWER;
  if (SUBSTITUTION.test(h)) return MARK_KINDS.SUBSTITUTION;
  if (METHOD.test(h)) return MARK_KINDS.METHOD;
  if (ANSWERY.test(h)) return MARK_KINDS.ANSWER;
  if (index === 0) return MARK_KINDS.METHOD;
  // A middle step whose body is an equation being reduced is simplification.
  return /=/.test(body) ? MARK_KINDS.COMPUTATION : MARK_KINDS.METHOD;
}

/** Does this question's answer have to carry a unit to be complete? */
export function requiresUnits(question) {
  return !!text(question?.answerSuffix);
}

/**
 * The mark scheme for a question, derived from its worked solution.
 *
 * The final answer always carries exactly one mark, which is the board's own
 * convention and the reason method marks matter: everything above the answer is
 * still available to a student whose arithmetic slipped at the last line.
 *
 * A one-mark question has no step marks. That is not an omission — a one-mark
 * question IS the answer mark, and pretending otherwise would invent credit.
 */
export function markScheme(question) {
  const marks = Math.max(1, Math.min(6, Number(question?.marks) || Math.min(4, Math.max(1, Number(question?.difficulty) || 1))));
  const steps = (question?.steps || []).filter(s => !NON_SCHEME.test(text(s?.h)));

  const answerRow = {
    kind: MARK_KINDS.ANSWER,
    marks: 1,
    label: requiresUnits(question) ? english('board.labelAnswerUnits') : LABEL[MARK_KINDS.ANSWER],
    labelKey: requiresUnits(question) ? 'board.labelAnswerUnits' : LABEL_KEY[MARK_KINDS.ANSWER],
    detail: text(steps[steps.length - 1]?.d) || null,
    requiresUnits: requiresUnits(question)
  };
  if (marks === 1 || steps.length <= 1) return Object.freeze({ total: marks, rows: Object.freeze([answerRow]), stepMarks: 0 });

  // Everything except the answer mark is spread over the earlier steps, in the
  // order the solution takes them. More steps than marks means the later ones
  // share a mark; more marks than steps means the earliest carry the extra,
  // because method is what a board scheme weights most heavily.
  const workingSteps = steps.slice(0, -1);
  const available = marks - 1;
  const rows = [];
  if (workingSteps.length <= available) {
    workingSteps.forEach((s, i) => rows.push({
      kind: classifyStep(s, i, steps.length),
      marks: 1,
      label: text(s.h) || LABEL[classifyStep(s, i, steps.length)],
      labelKey: text(s.h) ? null : LABEL_KEY[classifyStep(s, i, steps.length)],
      detail: text(s.d) || null,
      requiresUnits: false
    }));
    let spare = available - workingSteps.length;
    for (let i = 0; spare > 0 && i < rows.length; i += 1, spare -= 1) rows[i].marks += 1;
  } else {
    const per = Math.ceil(workingSteps.length / available);
    for (let i = 0; i < available; i += 1) {
      const group = workingSteps.slice(i * per, (i + 1) * per);
      if (!group.length) break;
      rows.push({
        kind: classifyStep(group[0], i * per, steps.length),
        marks: 1,
        label: group.map(s => text(s.h)).filter(Boolean).join(', ') || LABEL[classifyStep(group[0], i * per, steps.length)],
        labelKey: group.map(s => text(s.h)).filter(Boolean).length ? null : LABEL_KEY[classifyStep(group[0], i * per, steps.length)],
        detail: text(group[0].d) || null,
        requiresUnits: false
      });
    }
  }
  rows.push(answerRow);
  const total = rows.reduce((s, r) => s + r.marks, 0);
  return Object.freeze({ total, rows: Object.freeze(rows), stepMarks: total - 1 });
}

/** Has the student written their answer with the unit the question asks for? */
export function unitsPresent(question, workingLines, answerText) {
  const suffix = text(question?.answerSuffix);
  if (!suffix) return true;
  const texts = [...(workingLines || []), answerText].map(text);
  // A unit this marker reads must be written as that whole unit: "cm" is not
  // "m", and "m" is not "m²". Substring search credited "12 cm" for metres.
  const known = unitWritten(suffix, texts);
  // the degree sign was never demanded here (it has no letters to search for)
  if (known === false && /^\s*°\s*$/.test(suffix)) return true;
  if (known !== null) return known;
  const needle = suffix.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!needle) return true;
  const hay = ` ${texts.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return hay.includes(` ${needle} `) || hay.replace(/ /g, '').endsWith(needle);
}

/**
 * Award the scheme against a student's working.
 *
 * The walk is deliberately the one an examiner does: go down the page, and tick
 * off scheme points in order as the working demonstrates them. It does not try
 * to match a student's line to a particular scheme row by content, because
 * students reach the same place by different routes and an examiner does not
 * demand the order of the printed solution either.
 *
 * `stepReport` is the on-device step check ({ lines: [{ status }] }), or a
 * cloud check merged into that shape. Only lines the checker affirmatively
 * verifies as `ok` are credit-bearing. A later line may still earn
 * error-carried-forward credit after a break, but only when the checker verifies
 * that continuation; a generic `note` is explicitly non-authoritative.
 */
export function awardStepMarks({
  question,
  workingLines = [],
  stepReport = null,
  answerText = '',
  correct = false
} = {}) {
  const scheme = markScheme(question);
  const lines = (workingLines || []).map(text).filter(Boolean);
  const reportLines = Array.isArray(stepReport?.lines) ? stepReport.lines : [];

  // Fail closed: only an affirmative checker verdict can create marking credit.
  // `break`, `note`, missing entries and unknown statuses earn nothing. This
  // preserves carried-forward credit for verified post-break work without
  // allowing unverified prose or malformed continuation to recover marks.
  let credited = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (reportLines[i]?.status === 'ok') credited += 1;
  }
  // Where the credit stopped: the first line the checker refused, or the first
  // it could not read. A point that was not reached is explained by that line
  // and the rule it broke, not by a generic "did not reach this point".
  const breakIndex = reportLines.findIndex(l => l?.status === 'break');
  const unverifiedIndex = reportLines.findIndex(l => l && l.status !== 'ok' && l.status !== 'break');
  const brokenLine = breakIndex >= 0 ? reportLines[breakIndex] : null;
  const ruleKey = brokenLine ? ruleKeyFor(brokenLine, null) : null;
  const ruleText = ruleKey ? (ruleKey.startsWith('misconception.') ? english(ruleKey) : (brokenLine?.diagnosis?.title || brokenLine?.note || english(ruleKey))) : '';

  const stepRows = scheme.rows.filter(r => r.kind !== MARK_KINDS.ANSWER);
  const answerRow = scheme.rows.find(r => r.kind === MARK_KINDS.ANSWER);

  const rows = [];
  let budget = credited;
  for (const row of stepRows) {
    const earned = Math.min(row.marks, budget);
    budget -= earned;
    let whyKey = null, whyVars = null;
    if (earned !== row.marks) {
      if (lines.length === 0) whyKey = 'board.whyNoWorking';
      else if (breakIndex >= 0) { whyKey = 'board.whyBrokeAtLine'; whyVars = { line: breakIndex + 1, rule: ruleText, ruleKey }; }
      else if (unverifiedIndex >= 0) { whyKey = 'board.whyUnverifiedLine'; whyVars = { line: unverifiedIndex + 1 }; }
      else whyKey = 'board.whyNotReached';
    }
    rows.push({
      kind: row.kind,
      label: row.label,
      labelKey: row.labelKey || null,
      outOf: row.marks,
      earned,
      why: whyKey ? english(whyKey, whyVars || {}) : null,
      whyKey,
      whyVars
    });
  }

  const hasUnits = unitsPresent(question, lines, answerText);
  const answerEarned = correct && hasUnits ? answerRow.marks : 0;
  const answerWhyKey = correct && !hasUnits ? 'board.whyUnitMissing' : correct ? null : 'board.whyAnswerWrong';
  const answerWhyVars = { unit: text(question.answerSuffix) };
  rows.push({
    kind: MARK_KINDS.ANSWER,
    label: answerRow.label,
    labelKey: answerRow.labelKey,
    outOf: answerRow.marks,
    earned: answerEarned,
    why: answerWhyKey ? english(answerWhyKey, answerWhyVars) : null,
    whyKey: answerWhyKey,
    whyVars: answerWhyVars
  });

  const awarded = rows.reduce((s, r) => s + r.earned, 0);
  const showedWorking = lines.length > 0;
  const lostToNoWorking = !showedWorking ? scheme.stepMarks : 0;

  return Object.freeze({
    awarded,
    total: scheme.total,
    rows: Object.freeze(rows),
    showedWorking,
    lostToNoWorking,
    unitsMissing: correct && !hasUnits,
    creditedLines: credited,
    // Never "official". This is derived from the question's own worked solution
    // and follows the published convention; it is not CBSE's marking scheme
    // document for a real past paper.
    schemeKind: 'board-style-derived'
  });
}

/**
 * The one-line verdict under the marks — in the register a teacher would use —
 * as a catalogue key and its variables, so the card renders it in the
 * student's language. marksSentence() is the same line in English.
 */
export function marksSentenceKey(award) {
  if (!award) return null;
  const { awarded, total } = award;
  if (!award.showedWorking && award.lostToNoWorking > 0) {
    return { key: 'board.sentenceNoWorking', vars: { awarded, total, count: award.lostToNoWorking, n: award.lostToNoWorking } };
  }
  if (award.unitsMissing) return { key: 'board.sentenceUnitsMissing', vars: { awarded, total } };
  if (awarded === total) return { key: 'board.sentenceFull', vars: { awarded, total } };
  if (awarded === 0) return { key: 'board.sentenceNone', vars: { awarded, total } };
  return { key: 'board.sentenceMethod', vars: { awarded, total } };
}

export function marksSentence(award) {
  const line = marksSentenceKey(award);
  return line ? english(line.key, line.vars) : null;
}
