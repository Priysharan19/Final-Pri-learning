// Scripts card titles set maths on one text line (display only). Inside each
// $…$ span every stacked fraction (\frac, \dfrac, \tfrac; nested or with
// unbraced arguments) becomes a/b, bracketed when a side is more than one
// token, so nothing rises above the title's line box. Roots and powers are
// already inline at text size. \text{…} is copied verbatim, and anything that
// cannot be parsed (an unbalanced brace) is left exactly as written. The
// question itself is never changed: other screens render it as before.

/** A braced group starting at i, or a single token (\frac12). */
function readArg(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') {
    const tok = /^(\\[a-zA-Z]+|[^\s{}\\])/.exec(s.slice(i));
    return tok ? { body: tok[1], end: i + tok[1].length } : null;
  }
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

// One token (a number, a letter, a command or a single root) needs no brackets.
const side = x => (/^[\w.]+$|^\\[a-zA-Z]+$|^\\sqrt\{[^{}]*\}$/.test(x.trim()) ? x : `(${x})`);

/** Flattens the fractions of one TeX span; returns it unchanged if any fails. */
export function flattenFractions(tex) {
  let out = '';
  let i = 0;
  const re = /\\(text|mathrm|textrm|mbox)\s*\{|\\[dt]?frac(?![a-zA-Z])/g;
  for (let m; (m = re.exec(tex));) {
    if (m[1]) {
      const group = readArg(tex, m.index + m[0].length - 1);
      if (!group) return tex;
      re.lastIndex = group.end;
      continue;
    }
    const num = readArg(tex, m.index + m[0].length);
    const den = num && readArg(tex, num.end);
    if (!den) return tex;
    const n = flattenFractions(num.body);
    const d = flattenFractions(den.body);
    out += tex.slice(i, m.index) + `${side(n)}/${side(d)}`;
    i = den.end;
    re.lastIndex = den.end;
  }
  return out + tex.slice(i);
}

/** The title with every $…$ span's fractions set inline. */
export const flatTitle = text => String(text ?? '')
  .replace(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g, (_, tex) => `$${flattenFractions(tex)}$`);
