// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a read line, split into words and maths
//
// The reader returns a line as plain text: "for stat points y'=0",
// "x=0 or x=-3", "smallest: (0,0)". Typeset whole, the words fuse into italic
// maths ("forstatpointsy′ = 0", "x = 0orx = −3"). This splits a line into runs,
// so the page can set the words upright and typeset only the maths.
//
// Display only. It never changes a line's text and decides nothing about
// marking; it is the same text, shown more readably.
// ─────────────────────────────────────────────────────────────────────────────

// Letters that are maths, not words, however long.
const MATHS_NAMES = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'cosec', 'csc', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'sqrt', 'cbrt',
  'abs', 'pi', 'theta', 'alpha', 'beta', 'gamma', 'delta', 'sigma', 'lim', 'max', 'min', 'det', 'mod', 'gcd', 'lcm',
  'arcsin', 'arccos', 'arctan', 'inf', 'infty', 'dx', 'dy', 'dt', 'nCr', 'nPr', 'cis', 'arg', 'Re', 'Im'
]);
// Short words a student writes between pieces of maths.
const SMALL_WORDS = new Set(['or', 'and', 'if', 'is', 'so', 'at', 'to', 'of', 'by', 'in', 'on', 'as', 'for', 'when', 'then', 'hence', 'thus', 'ans']);

function isWord(token) {
  const core = token.replace(/^[(\[{"'“‘]+|[)\]}"'”’.,;:!?]+$/gu, '');
  if (!core || !/^\p{L}+$/u.test(core)) return false;
  if (MATHS_NAMES.has(core) || MATHS_NAMES.has(core.toLowerCase())) return false;
  if (core.length >= 3) return true;
  return SMALL_WORDS.has(core.toLowerCase());
}

/**
 * Runs of a line: [{ kind: 'words' | 'maths', text }]. A word is a run of three
 * or more letters that is not a function name, or one of a few short joining
 * words; everything else stays maths. Spacing between runs is preserved by the
 * runs themselves (words keep their own punctuation).
 */
export function splitWordsAndMaths(text) {
  const tokens = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const runs = [];
  for (const token of tokens) {
    const kind = isWord(token) ? 'words' : 'maths';
    const last = runs.at(-1);
    if (last && last.kind === kind) last.text += ` ${token}`;
    else runs.push({ kind, text: token });
  }
  // A trailing colon on a word run ("smallest:") reads as words; keep it there.
  return runs;
}
