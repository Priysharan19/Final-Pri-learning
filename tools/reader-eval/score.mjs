// Scoring for the synthetic evaluation. Same rules for every configuration.
const map = s => s.normalize('NFKC').toLowerCase()
  .replace(/[′’‘`]/g, "'").replace(/[−–—]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
  .replace(/\\(?:left|right|cdot|,|;)/g, '').replace(/\\(frac|sqrt|int|pi|theta|therefore)/g, m => ({ '\\frac': '', '\\sqrt': '√', '\\int': '∫', '\\pi': 'π', '\\theta': 'θ', '\\therefore': '∴' })[m])
  .replace(/sqrt/g, '√').replace(/[\s(){}\[\]_^$\\*·×.]/g, '').replace(/"/g, '');
function truthText(line) {
  return line.replace(/int\[(\d+),(\d+)\]/g, '∫$1$2').replace(/sqrt\[([^\]]*)\]/g, '√$1')
    .replace(/\{([^{}]*)\/([^{}]*)\}/g, '$1/$2');
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) { const cur = [i]; for (let j = 1; j <= n; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
export function scoreCase(c, parsed) {
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  const got = map(lines.map(l => String(l.text ?? '')).join(''));
  const want = map(c.lines.map(truthText).join(''));
  const d = lev(got, want);
  const out = { exact: got === want, charAcc: Math.max(0, 1 - d / Math.max(1, want.length)), lines: lines.length === c.lines.length };
  if (c.primes) {
    const marks = (lines.map(l => l.text).join(' ').match(/[′'’]/g) || []).length;
    const asSuper = /[A-Za-z)]\s*(?:\^\s*1(?!\d)|¹)/.test(lines.map(l => l.text).join(' '));
    out.primeOk = marks >= c.primes && !asSuper;
  }
  if (c.words) {
    const joined = lines.map(l => l.text).join(' ');
    const letterRuns = (joined.match(/[A-Za-z]+/g) || []).map(w => w.toLowerCase());
    const seg = lines.flatMap(l => Array.isArray(l.segments) ? l.segments.filter(s => s.kind === 'text').flatMap(s => (s.value.match(/[A-Za-z]+/g) || []).map(w => w.toLowerCase())) : null);
    const hasSeg = lines.some(l => Array.isArray(l.segments));
    out.wordsOk = c.words.every(w => letterRuns.includes(w.toLowerCase())) && (!hasSeg || c.words.every(w => seg.includes(w.toLowerCase())));
    out.wordsFused = !c.words.every(w => letterRuns.includes(w.toLowerCase()));
  }
  return out;
}
