// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Where each lost mark went (ledger 3.6, re-implemented on #430)
//
// Every mark the method rule did not award is named by the line it was lost on
// and, for a mistake, the rule that line broke. Each entry is a catalogue key
// with its variables, so the card renders it in the student's language; `text`
// is the same sentence resolved against the English catalogue for records and
// logs — one copy, never prose kept in the engine.
//
// On the first-error / error-carried-forward report (#430):
//   · the FIRST break is named once, with its rule (`marks.lost.break`);
//   · a later, independent break is a second mistake and names its own rule
//     (`marks.lost.anotherBreak`) — it never repeats the first one;
//   · a line that is correct on the student's own earlier slip (`ecf: true`)
//     and earned nothing says it was carried forward from that line
//     (`marks.lost.carried`), never that it is wrong;
//   · a line after the first mistake that the rubric does not pay, and that is
//     not a verified carried line, points back to the first break
//     (`marks.lost.afterBreak`);
//   · the answer mark: carried from the first break when the last line was a
//     carried line (`marks.lost.answerCarried`), otherwise `marks.lost.answer`.
//
// This module explains a verdict the marker already reached. It never awards,
// removes or changes a mark.
// ─────────────────────────────────────────────────────────────────────────────
import en from '../i18n/strings.en.js';

// Diagnosis codes whose misconception key is not the camel-cased code, and the
// first-error / chain codes, which name a rule of their own.
const RULE_KEY_BY_CODE = Object.freeze({
  'extraneous-solution': 'marks.rule.extraneousSolution',
  'formula-error': 'marks.rule.formulaError',
  'formula-misapplied': 'marks.rule.formulaMisapplied',
  'given-misread': 'marks.rule.givenMisread',
  'value-slip': 'marks.rule.valueSlip',
  'system-line-false': 'marks.rule.systemLineFalse'
});

const camel = code => String(code).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** The catalogue key naming the rule a broken line broke. Always a key in the English catalogue. */
export function ruleKeyFor(line, meta) {
  const code = line?.diagnosis?.code;
  if (code && RULE_KEY_BY_CODE[code]) return RULE_KEY_BY_CODE[code];
  if (code) {
    const key = `misconception.${camel(code)}.name`;
    if (typeof en[key] === 'string') return key;
  }
  const text = String(line?.text ?? '');
  if (/±/.test(text)) return 'marks.rule.plusMinusBranch';
  if (meta?.kind === 'expression') return 'marks.rule.expressionBroken';
  if (!/=/.test(text)) return 'marks.rule.valueWrong';
  return 'marks.rule.equationBroken';
}

const englishOf = key => (typeof en[key] === 'string' ? en[key] : key);
const fill = (template, vars) => String(template).replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));

/** Every key lostMarks() can emit. */
export const LOST_MARK_KEYS = Object.freeze([
  'marks.lost.break', 'marks.lost.anotherBreak', 'marks.lost.carried', 'marks.lost.afterBreak',
  'marks.lost.unverified', 'marks.lost.restated', 'marks.lost.repeat', 'marks.lost.answer', 'marks.lost.answerCarried'
]);

/**
 * One entry per lost mark: { line, key, vars, ruleKey, text }, in line order,
 * then the answer mark. `line` is 1-based. `vars.rule` is left to the
 * renderer, which fills it with the translated `ruleKey`.
 *
 * `vector` is methodMarks()'s per-line mark vector; `allLines` the report lines
 * it was built from (status, diagnosis, ecf, note).
 */
export function lostMarks(vector, allLines, meta) {
  const out = [];
  const rows = Array.isArray(vector) ? vector : [];
  const src = Array.isArray(allLines) ? allLines : [];
  let breakLine = null;
  const push = (line, key, extra = {}, ruleKey = null) => {
    const vars = { line, ...extra };
    out.push({ line, key, vars, ruleKey, text: fill(englishOf(key), { ...vars, rule: ruleKey ? englishOf(ruleKey) : '' }) });
  };
  rows.forEach((row, i) => {
    const l = src[i] || {};
    const line = i + 1;
    if (row.mark > 0 || row.reason === 'cap') return;
    if (row.status === 'break') {
      const ruleKey = ruleKeyFor(l, meta);
      if (breakLine == null) { breakLine = line; push(line, 'marks.lost.break', {}, ruleKey); }
      else push(line, 'marks.lost.anotherBreak', {}, ruleKey);
      return;
    }
    if (row.status === 'ok' && row.reason === 'after-mistake') {
      if (breakLine == null) return;
      push(line, l.ecf === true ? 'marks.lost.carried' : 'marks.lost.afterBreak', { breakLine });
      return;
    }
    if (row.status === 'note') {
      if (breakLine != null && (l.ecf === true || /follows from the earlier slip|carrying the earlier slip/i.test(String(l.note || '')))) {
        push(line, 'marks.lost.afterBreak', { breakLine });
      } else push(line, 'marks.lost.unverified');
      return;
    }
    if (row.reason === 'restated') { push(line, 'marks.lost.restated'); return; }
    if (row.reason === 'repeat') push(line, 'marks.lost.repeat');
  });
  const last = rows.length || 1;
  const lastLine = src[rows.length - 1];
  if (breakLine != null && breakLine !== last && lastLine?.ecf === true && lastLine?.status === 'ok') {
    push(last, 'marks.lost.answerCarried', { breakLine });
  } else push(last, 'marks.lost.answer');
  return out;
}
