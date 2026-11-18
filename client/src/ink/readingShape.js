// Pri Learning · is a read line well-formed maths, and where is it not.
//
// Shared by the reading chips, the reading list and the confirmation panel so a
// line is never "read" in one place and "check" in another. This decides only
// whether the student is asked to look at a line; it never marks anything.

const OPS = '+\\-*/=<>^';

/**
 * A line the reader returned that cannot be finished maths as it stands.
 * `continuation` is true for any line after the first: working often goes on
 * from the line above ("= 27"), so a leading relation sign there is ordinary.
 * An operator left dangling before a closing bracket, "(n+)", is not.
 */
export function readsAsMaths(text, { continuation = false } = {}) {
  return doubtfulSpan(text, { continuation }) === null;
}

/**
 * The part of the line to look at, or null when the line reads as maths.
 * { text, start, end } indexes the original string.
 */
export function doubtfulSpan(raw, { continuation = false } = {}) {
  const s = String(raw ?? '');
  const flat = [];                      // non-space characters with their original index
  for (let i = 0; i < s.length; i++) if (!/\s/.test(s[i])) flat.push({ ch: s[i], at: i });
  if (!flat.length) return null;
  const span = (a, b) => ({ start: flat[a].at, end: flat[b].at + 1, text: s.slice(flat[a].at, flat[b].at + 1) });
  const q = flat.findIndex(f => f.ch === '?');
  if (q >= 0) return span(q, q);
  const stack = [];
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].ch === '(') stack.push(i);
    else if (flat[i].ch === ')') { if (!stack.length) return span(i, i); stack.pop(); }
  }
  if (stack.length) return span(stack[stack.length - 1], flat.length - 1);
  // The innermost bracket group around index i, else the stretch around it.
  const around = i => {
    let open = -1, depth = 0;
    for (let k = i; k >= 0; k--) {
      if (flat[k].ch === ')') depth++;
      else if (flat[k].ch === '(') { if (depth === 0) { open = k; break; } depth--; }
    }
    if (open >= 0) {
      let close = flat.length - 1; depth = 0;
      for (let k = open; k < flat.length; k++) {
        if (flat[k].ch === '(') depth++;
        else if (flat[k].ch === ')' && --depth === 0) { close = k; break; }
      }
      return span(open, close);
    }
    return span(Math.max(0, i - 3), Math.min(flat.length - 1, i + 1));
  };
  const isOp = ch => OPS.includes(ch);
  const last = flat.length - 1;
  if (isOp(flat[last].ch) || flat[last].ch === '.') return around(last);
  for (let i = 0; i < last; i++) {
    if (isOp(flat[i].ch) && flat[i + 1].ch === ')') return around(i);
  }
  const head = flat[0].ch;
  if (!continuation && ('+*/=<>^'.includes(head))) return span(0, Math.min(1, last));
  if (head === '.' && !(flat[1] && /\d/.test(flat[1].ch))) return span(0, Math.min(1, last));
  const plain = flat.map(f => f.ch).join('');
  const m = plain.replace(/<=|>=|!=|=-|\(-/g, 'AA').match(/[+\-*/=<>^]{2,}/);
  if (m) { const i = plain.replace(/<=|>=|!=|=-|\(-/g, 'AA').indexOf(m[0]); return span(i, Math.min(last, i + m[0].length - 1)); }
  return null;
}
