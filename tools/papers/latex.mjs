// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a small, honest LaTeX reader for the owner's HSC-format papers
//
// This is not a TeX engine. It reads the handful of constructs the owner's two
// paper dialects use (docs/papers/structured-paper-format.md) and turns text
// into BLOCKS the client can render with its existing KaTeX text component:
//
//   { k: 'p',    t: 'text with $inline maths$, **bold** and *italic*' }
//   { k: 'math', t: 'display maths (KaTeX source)' }
//   { k: 'list', items: ['text', ...] }
//   { k: 'fig',  name: 'figGsline' }
//
// Anything it cannot read reliably is REPORTED (`report.notes`), never guessed.
// Pure functions: no file system, no network. Used by tools/papers/convert.mjs.
// ─────────────────────────────────────────────────────────────────────────────

/** Remove % comments (a % not preceded by a backslash), keeping line structure. */
export function stripComments(src) {
  return String(src).split('\n').map(line => {
    let out = '';
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '\\') { out += ch + (line[i + 1] ?? ''); i += 1; continue; }
      if (ch === '%') break;
      out += ch;
    }
    return out;
  }).join('\n');
}

/** Index of the } that closes the { at `open`; -1 when unbalanced. */
export function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** Read one {...} argument at or after `i` (whitespace skipped). */
export function readArg(s, i) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j += 1;
  if (s[j] !== '{') return null;
  const close = matchBrace(s, j);
  if (close < 0) return null;
  return { text: s.slice(j + 1, close), start: j, end: close + 1 };
}

/** Read an optional [..] argument at `i`. */
export function readOpt(s, i) {
  let j = i;
  while (j < s.length && /[ \t]/.test(s[j])) j += 1;
  if (s[j] !== '[') return null;
  const close = s.indexOf(']', j);
  if (close < 0) return null;
  return { text: s.slice(j + 1, close), end: close + 1 };
}

/** Top-level \begin{name} ... \end{name} blocks (nesting of the same name respected). */
export function envBlocks(s, name) {
  const out = [];
  const open = `\\begin{${name}}`;
  const close = `\\end{${name}}`;
  let from = 0;
  for (;;) {
    const start = s.indexOf(open, from);
    if (start < 0) break;
    let depth = 0;
    let i = start;
    let end = -1;
    while (i < s.length) {
      const o = s.indexOf(open, i);
      const c = s.indexOf(close, i);
      if (c < 0) break;
      if (o >= 0 && o < c) { depth += 1; i = o + open.length; continue; }
      depth -= 1;
      i = c + close.length;
      if (depth === 0) { end = i; break; }
    }
    if (end < 0) break;
    out.push({ start, end, inner: s.slice(start + open.length, end - close.length), whole: s.slice(start, end) });
    from = end;
  }
  return out;
}

/** Split an environment body into its \item chunks at environment depth 0. */
export function splitItems(inner) {
  const items = [];
  let depth = 0;
  let last = -1;
  const re = /\\begin\{[^}]*\}|\\end\{[^}]*\}|\\item\b/g;
  let m;
  while ((m = re.exec(inner))) {
    if (m[0].startsWith('\\begin')) depth += 1;
    else if (m[0].startsWith('\\end')) depth -= 1;
    else if (depth === 0) {
      if (last >= 0) items.push(inner.slice(last, m.index));
      last = m.index + m[0].length;
    }
  }
  if (last >= 0) items.push(inner.slice(last));
  return items.map(t => t.trim());
}

const SIMPLE_TEXT = [
  [/\\textendash\b\s*/g, '–'],
  [/\\textemdash\b\s*/g, ' - '],
  [/\\ldots\b|\\dots\b/g, '…'],
  [/\\textbullet\b/g, '•'],
  [/\\textcopyright\b/g, '©'],
  [/\\&/g, '&'], [/\\%/g, '%'], [/\\#/g, '#'], [/\\_/g, '_'],
  [/\\\{/g, '{'], [/\\\}/g, '}'],
  [/\\ /g, ' '], [/\\,/g, ' '], [/\\;/g, ' '], [/\\!/g, ''], [/\\quad\b|\\qquad\b/g, ' '],
  [/~/g, ' ']
];

/** Macro names the converter knows how to carry into KaTeX. */
const KATEX_MACRO_MAP = [
  [/\\dd\b/g, '\\mathrm{d}'],
  [/\\vect\{([^{}]*)\}/g, '\\mathbf{$1}'],
  [/\\vc\{([^{}]*)\}/g, '\\underset{\\sim}{$1}'],
  [/\\vi\b/g, '\\underset{\\sim}{i}'],
  [/\\vj\b/g, '\\underset{\\sim}{j}'],
  [/\\vk\b/g, '\\underset{\\sim}{k}'],
  [/\\mbox\{/g, '\\text{'],
  [/\\textrm\{/g, '\\text{'],
  [/\\checkmark\b/g, '\\checkmark'],
  [/\\displaybreak(\[\d\])?/g, ''],
  [/\\begin\{align\*?\}/g, '\\begin{aligned}'],
  [/\\end\{align\*?\}/g, '\\end{aligned}'],
  [/\\begin\{gather\*?\}/g, '\\begin{gathered}'],
  [/\\end\{gather\*?\}/g, '\\end{gathered}'],
  [/\\hfill\b/g, ' '],
  [/\\nonumber\b/g, ''],
  [/\\label\{[^}]*\}/g, '']
];

/** One math fragment (the inside of $..$ or \[..\]) as KaTeX source. */
export function texMath(tex) {
  let out = String(tex).trim();
  for (const [re, to] of KATEX_MACRO_MAP) out = out.replace(re, to);
  return out;
}

const DROP_ARG_MACROS = ['vspace', 'vspace*', 'hspace', 'hspace*', 'enlargethispage', 'label', 'pageref', 'ref', 'phantom', 'rule'];

function dropMacroWithArg(s, name) {
  const needle = `\\${name}`;
  let out = '';
  let i = 0;
  for (;;) {
    const at = s.indexOf(needle, i);
    if (at < 0) { out += s.slice(i); break; }
    const after = s[at + needle.length];
    // the macro name must end here (\vspace vs \vspacer)
    if (/[A-Za-z]/.test(after ?? '')) { out += s.slice(i, at + needle.length); i = at + needle.length; continue; }
    out += s.slice(i, at);
    let j = at + needle.length;
    const opt = readOpt(s, j);
    if (opt) j = opt.end;
    const arg = readArg(s, j);
    // \rule takes two arguments
    if (name === 'rule' && arg) { const second = readArg(s, arg.end); i = second ? second.end : arg.end; }
    else i = arg ? arg.end : j;
  }
  return out;
}

/** Replace \cmd{arg} by wrap(arg-converted) for a one-argument formatting macro. */
function mapFormatting(s, name, wrap) {
  const needle = `\\${name}`;
  let out = '';
  let i = 0;
  for (;;) {
    const at = s.indexOf(needle, i);
    if (at < 0) { out += s.slice(i); break; }
    const after = s[at + needle.length];
    if (/[A-Za-z]/.test(after ?? '')) { out += s.slice(i, at + needle.length); i = at + needle.length; continue; }
    const arg = readArg(s, at + needle.length);
    if (!arg) { out += s.slice(i, at + needle.length); i = at + needle.length; continue; }
    out += s.slice(i, at) + wrap(mapFormatting(arg.text, name, wrap));
    i = arg.end;
  }
  return out;
}

/** Inline text (outside math) cleaned of LaTeX formatting; math stays as $..$. */
function inlineText(raw, notes) {
  // Pull math out first so the text rules never touch it.
  const maths = [];
  let s = String(raw).replace(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g, (_, m) => { maths.push(texMath(m)); return `\u0001${maths.length - 1}\u0002`; });
  for (const name of DROP_ARG_MACROS) s = dropMacroWithArg(s, name);
  s = mapFormatting(s, 'textbf', t => `**${t}**`);
  s = mapFormatting(s, 'textit', t => `*${t}*`);
  s = mapFormatting(s, 'emph', t => `*${t}*`);
  s = mapFormatting(s, 'textmd', t => t);
  s = mapFormatting(s, 'textsf', t => t);
  s = mapFormatting(s, 'textrm', t => t);
  s = mapFormatting(s, 'mbox', t => t);
  s = mapFormatting(s, 'text', t => t);
  s = s.replace(/\\(noindent|medskip|bigskip|smallskip|centering|raggedright|normalsize|small|large|Large|bfseries|sffamily|itshape)\b\s*/g, '');
  s = s.replace(/\\\\(\[[^\]]*\])?/g, '\n');
  for (const [re, to] of SIMPLE_TEXT) s = s.replace(re, to);
  s = s.replace(/\\\$/g, '$');
  s = s.replace(/---/g, ' - ').replace(/--/g, '–');
  const leftover = s.match(/\\[A-Za-z]+/g);
  if (leftover) for (const l of leftover) notes.add(`unmapped text macro ${l}`);
  s = s.replace(/\\[A-Za-z]+/g, '');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\u0001(\d+)\u0002/g, (_, k) => `$${maths[Number(k)]}$`);
  return s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

const FIG_RE = /\\(fig[A-Za-z0-9]+)\b/g;
const figNames = s => [...String(s).matchAll(FIG_RE)].map(m => m[1]);

/**
 * LaTeX text → blocks. `notes` is a Set that collects everything unreadable.
 * Display maths, align-like environments, itemize/enumerate lists and figure
 * macros become their own blocks; the rest is paragraphs.
 */
export function toBlocks(raw, notes = new Set()) {
  let s = stripComments(raw);
  const blocks = [];
  const flush = text => {
    const cleaned = text.replace(/\\par\b/g, '\n\n');
    for (const para of cleaned.split(/\n\s*\n/)) {
      const t = inlineText(para, notes);
      if (t) blocks.push({ k: 'p', t });
    }
  };
  // Tokens that become blocks of their own.
  const token = /\\\[|\\begin\{(align\*?|gather\*?|equation\*?|itemize|enumerate|center|minipage|tabular|tabularx|array)\}|(?<!\\)\$\$|\\figc\{|\\(fig[A-Za-z0-9]+)\b/g;
  let pos = 0;
  let m;
  while ((m = token.exec(s))) {
    flush(s.slice(pos, m.index));
    if (m[0] === '\\[') {
      const end = s.indexOf('\\]', m.index);
      if (end < 0) { notes.add('unterminated display maths'); pos = s.length; break; }
      blocks.push({ k: 'math', t: texMath(s.slice(m.index + 2, end)) });
      pos = end + 2;
    } else if (m[0] === '$$') {
      const end = s.indexOf('$$', m.index + 2);
      if (end < 0) { notes.add('unterminated $$'); pos = s.length; break; }
      blocks.push({ k: 'math', t: texMath(s.slice(m.index + 2, end)) });
      pos = end + 2;
    } else if (m[0] === '\\figc{') {
      const arg = readArg(s, m.index + 4);
      for (const name of figNames(arg?.text ?? '')) blocks.push({ k: 'fig', name });
      pos = arg ? arg.end : m.index + m[0].length;
    } else if (m[2]) {
      blocks.push({ k: 'fig', name: m[2] });
      pos = m.index + m[0].length;
    } else {
      const env = m[1];
      const [block] = envBlocks(s.slice(m.index), env);
      if (!block) { notes.add(`unterminated ${env}`); pos = s.length; break; }
      if (/^(align|gather|equation)/.test(env)) {
        blocks.push({ k: 'math', t: texMath(`\\begin{${env}}${block.inner}\\end{${env}}`) });
      } else if (env === 'itemize' || env === 'enumerate') {
        blocks.push({ k: 'list', ordered: env === 'enumerate', items: splitItems(block.inner.replace(/^\s*\[[^\]]*\]/, '')).map(it => inlineText(it, notes)).filter(Boolean) });
      } else if (env === 'center' || env === 'minipage') {
        for (const b of toBlocks(block.inner, notes)) blocks.push(b);
      } else {
        notes.add(`table or array in text (${env}) needs manual structuring`);
        blocks.push({ k: 'p', t: '[table: see the printed paper]' });
      }
      pos = m.index + block.end;
    }
    token.lastIndex = pos;
  }
  flush(s.slice(pos));
  return blocks;
}

/** Plain text of blocks (for tests and search): maths kept as its source. */
export function blocksText(blocks) {
  return blocks.map(b => b.k === 'list' ? b.items.join('; ') : b.k === 'fig' ? `[figure ${b.name}]` : b.t).join('\n');
}

export { figNames };
