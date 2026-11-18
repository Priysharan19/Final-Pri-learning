// Tex -> the plain text a handwriting reader would return for the same maths.
// Deterministic string rewriting only. Returns null for a span whose commands
// have no handwriting reading (so it is skipped, never guessed).

const SYMBOLS = {
  times: '×', cdot: '·', div: '÷', pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', lambda: 'λ', mu: 'μ', sigma: 'σ',
  le: '≤', leq: '≤', leqslant: '≤', ge: '≥', geq: '≥', geqslant: '≥', ne: '≠', neq: '≠', approx: '≈',
  pm: '±', infty: '∞', circ: '°', angle: '∠', triangle: '△', sqrt: '√', int: '∫', sum: '∑', in: '∈',
  cup: '∪', cap: '∩', to: '→', rightarrow: '→', ln: 'ln', log: 'log', sin: 'sin', cos: 'cos', tan: 'tan',
  lim: 'lim', max: 'max', min: 'min', cot: 'cot', sec: 'sec', csc: 'csc', Delta: 'Δ', perp: '⊥', parallel: '∥'
};

function braced(s, i) { // s[i] === '{' -> [content, indexAfter]
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
  }
  return [s.slice(i + 1), s.length];
}

function convert(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|[\s\S])/.exec(s.slice(i)) || [s[i], ' '];
      const name = m[1];
      i += m[0].length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        while (s[i] === ' ') i++;
        let a, b;
        if (s[i] === '{') [a, i] = braced(s, i); else { a = s[i]; i++; }
        while (s[i] === ' ') i++;
        if (s[i] === '{') [b, i] = braced(s, i); else { b = s[i]; i++; }
        const A = convert(a), B = convert(b);
        out += `${/^[\w.]+$/.test(A) ? A : `(${A})`}/${/^[\w.]+$/.test(B) ? B : `(${B})`}`;
        if (/[A-Za-z0-9\\]/.test(s[i] ?? '') && /[A-Za-z]$/.test(B)) out += ' ';
      } else if (name === 'sqrt') {
        while (s[i] === ' ') i++;
        if (s[i] === '{') { let a; [a, i] = braced(s, i); out += `√(${convert(a)})`; }
        else out += '√';
      } else if (name === 'text' || name === 'mathrm' || name === 'textbf' || name === 'mathbf') {
        while (s[i] === ' ') i++;
        let a = ''; if (s[i] === '{') [a, i] = braced(s, i);
        out += a;
      } else if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'mathrel' || name === 'limits') {
        // dropped
      } else if (name === ',' || name === ';' || name === '!' || name === ' ' || name === 'quad' || name === 'qquad' || name === ':') {
        out += ' ';
      } else if (name === 'Rightarrow' || name === 'Longrightarrow' || name === 'implies') {
        out += ' ⇒ ';
      } else if (name === '%') out += '%';
      else if (name === '$') out += '$';
      else if (name === '{' || name === '}' || name === '|') out += name;
      else if (Object.hasOwn(SYMBOLS, name)) out += SYMBOLS[name];
      else return null;
    } else if (c === '^' || c === '_') {
      i++;
      let a;
      if (s[i] === '{') [a, i] = braced(s, i);
      else if (s[i] === '\\') { const mm = /^\\([a-zA-Z]+|[\s\S])/.exec(s.slice(i)) || [s[i]]; a = mm[0]; i += mm[0].length; }
      else { a = s[i] ?? ''; i++; }
      a = convert(a);
      if (a === null) return null;
      if (c === '^') out += a === '°' ? '°' : `^${/^[\w.]+$/.test(a) || a === '-' ? a : `(${a})`}`;
      else out += `_${/^\w+$/.test(a) ? a : `(${a})`}`;
    } else if (c === '{' || c === '}') { i++; }
    else { out += c; i++; }
  }
  return out;
}

/** Plain handwriting-style text for one tex span, or null if it cannot be read. */
export function texToPlain(tex) {
  const r = convert(String(tex).trim());
  if (r === null) return null;
  const t = r.replace(/\s+/g, ' ').replace(/ ?([,;]) ?/g, '$1 ').replace(/\s+$/, '').replace(/\^\(([^()]*)\)°/g, '^($1)°').trim();
  return t || null;
}

/** The $...$ spans of a string and the prose around them. */
export function splitSpans(text) {
  const spans = [], prose = [];
  let last = 0;
  const re = /\$([^$]+)\$/g;
  let m;
  while ((m = re.exec(text))) {
    prose.push(text.slice(last, m.index));
    spans.push(m[1]);
    last = m.index + m[0].length;
  }
  prose.push(text.slice(last));
  return { spans, prose };
}
