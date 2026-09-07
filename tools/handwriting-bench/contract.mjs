// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting benchmark · the shared contract
//
// Every candidate — Pri's local recogniser, Mathpix image, Mathpix strokes, a
// multimodal model, or a hybrid of two — returns one of the two shapes below.
// Nothing else in this harness knows which vendor produced a result, which is
// the only way an architecture comparison means anything: if each candidate
// were scored through its own adapter-specific path, the measurement would be
// of the adapters rather than of the architectures.
//
// Two rules hold the comparison honest:
//
//   1. One normaliser. Every candidate's text is compared to ground truth
//      through `normalizeMath` below, which is character-identical to the one
//      in client/test/ink-physical-release-evidence.mjs. A candidate cannot win
//      by returning a prettier dialect of the same answer, and the numbers this
//      harness prints stay comparable to the existing release gate.
//
//   2. Unconverted markup is a miss, and a visible one. A recogniser that
//      returns LaTeX has to be translated into the linear form Pri's parser
//      reads. Where the translation fails, `residue` records what was left
//      over, so a low score can be attributed to the recogniser or to this
//      harness's translator rather than silently blamed on the vendor.
// ─────────────────────────────────────────────────────────────────────────────

/** Recognition candidates return this. `costUsd` is computed, never guessed. */
export function reading({
  engine,
  lines = [],
  confidence = 0,
  needsConfirmation = true,
  latencyMs = null,
  costUsd = null,
  residue = [],
  error = null,
  raw = null
} = {}) {
  const clean = lines
    .map(line => ({
      text: String(line?.text ?? '').trim(),
      latex: line?.latex ? String(line.latex) : null,
      confidence: clamp01(line?.confidence),
      box: line?.box ?? null
    }))
    .filter(line => line.text.length > 0);
  return Object.freeze({
    kind: 'reading',
    engine: String(engine),
    lines: clean,
    text: clean.map(l => l.text).join('\n'),
    confidence: clamp01(confidence),
    needsConfirmation: needsConfirmation !== false,
    latencyMs,
    costUsd,
    residue,
    error,
    raw
  });
}

/**
 * Marking candidates return this.
 *
 * `awarded` is marks, `lines[].status` is the per-line judgement Pri's own
 * marker produces, and `firstBreak` is the 1-indexed line the candidate says
 * went wrong first. Direct multimodal marking (Architecture A) fills these in
 * from the model; the Mathpix and local pipelines fill them in by running the
 * transcription through Pri's deterministic marker. Same shape either way, so
 * error localisation and false-wrong rate are computed identically for both.
 */
export function marking({
  marker,
  awarded = null,
  total = null,
  lines = [],
  firstBreak = null,
  confidence = 0,
  latencyMs = null,
  costUsd = null,
  error = null,
  raw = null
} = {}) {
  return Object.freeze({
    kind: 'marking',
    marker: String(marker),
    awarded: Number.isFinite(Number(awarded)) ? Number(awarded) : null,
    total: Number.isFinite(Number(total)) ? Number(total) : null,
    lines: lines.map((line, i) => ({
      index: Number.isFinite(Number(line?.index)) ? Number(line.index) : i + 1,
      status: LINE_STATUS.has(line?.status) ? line.status : 'unknown',
      carried: line?.carried === true,
      why: String(line?.why ?? '').slice(0, 300)
    })),
    firstBreak: Number.isFinite(Number(firstBreak)) ? Number(firstBreak) : null,
    confidence: clamp01(confidence),
    latencyMs,
    costUsd,
    error,
    raw
  });
}

export const LINE_STATUS = new Set(['ok', 'wrong', 'carried', 'unknown']);

const clamp01 = v => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 0);

/**
 * The single normaliser. Identical to the release gate's, deliberately:
 * NFKC, every dash variant folded to ASCII minus, all whitespace removed.
 */
export function normalizeMath(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '');
}

export function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * The structural categories measured separately, because a recogniser can be
 * excellent at digits and useless at a stacked fraction, and one blended
 * accuracy number hides exactly the difference this study exists to find.
 * Tested against the NORMALISED ground truth, so a category is a property of
 * the expression, never of the candidate that read it.
 */
export const STRUCTURE_TESTS = Object.freeze({
  fraction: t => /\//.test(t) || /\\frac/.test(t),
  superscript: t => /\^/.test(t),
  subscript: t => /_/.test(t),
  radical: t => /sqrt\(/.test(t) || /√/.test(t),
  integral: t => /∫/.test(t) || /\\int/.test(t),
  matrix: t => /\\begin\{[bp]?matrix\}/.test(t) || /\[\[/.test(t),
  relation: t => /(<=|>=|!=|=|<|>)/.test(t),
  trig: t => /(sin|cos|tan|sec|csc|cot)\(/.test(t),
  log: t => /(ln|log)\(/.test(t),
  greek: t => /(pi|theta|alpha|beta|lambda)/.test(t),
  multiline: t => /\n/.test(t)
});

export function structuresOf(target) {
  const t = normalizeMath(target);
  return Object.entries(STRUCTURE_TESTS)
    .filter(([, test]) => test(t))
    .map(([name]) => name);
}

/** The release gate's definition of a "critical" expression, reused verbatim. */
export function isCritical(target) {
  return /\^|\/|sqrt\(|[=<>]|!=|<=|>=|∫|\n/.test(normalizeMath(target));
}
