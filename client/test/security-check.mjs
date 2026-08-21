// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Security suite — every payload asserted dead, every real
// figure asserted intact.
//
// Task packs, backups and progress files are files. They arrive by AirDrop from
// someone the student may never have met, and what is inside them is drawn as
// markup: question figures go into dangerouslySetInnerHTML, prompts and working
// lines go through lib/latex.jsx. That is the whole attack surface of a local
// app, and this suite is the proof it is closed.
//
// THE BRANCH THAT MATTERS. lib/sanitize.js has two paths: a DOMParser path in
// the browser and a scanning fallback for Node. Every user runs the DOMParser
// path. A suite that runs in bare Node runs only the fallback — so the entire
// browser path could be replaced with `return parent.innerHTML`, shipping a
// total pass-through, and a green suite would say nothing. So DOMParser is
// installed here (the parser lives in backend-check.mjs, one definition for
// both suites), the first group proves the browser path is the one being taken
// by making the two paths disagree on a case whose answer only the DOM path
// gets right, and every payload below is then driven through it.
//
// Nothing here is a source-code grep for a string: a refactor that keeps the
// behaviour has to keep passing, and a change that breaks the behaviour has to
// fail. lib/latex.jsx is therefore rendered, not read — the JSX is compiled
// here so the component can be called in Node and the markup it hands to
// dangerouslySetInnerHTML can be read back and asserted on.
//
// A hole this suite proves by driving it is a failure, never a printed note.
//
// Usage: node client/test/security-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { installBrowserEnv, resetStorage, rawRows, domParseCount } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));

// ── Assertions ───────────────────────────────────────────────────────────────

const groups = [];
let group = null;
const failures = [];
const notes = [];

const section = (name) => { group = { name, pass: 0, fail: 0 }; groups.push(group); };

function ok(name, condition, detail = '') {
  if (condition) { group.pass++; return true; }
  group.fail++;
  failures.push(`${group.name} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}

const show = v => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));
const crashed = err => ok('the group ran to the end', false, `threw: ${err?.stack || err}`);
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);

// ── What "dead" means ────────────────────────────────────────────────────────
// Stated here rather than imported from lib/sanitize.js on purpose. If this
// suite asked the sanitiser what it allows and then checked that it allowed
// only that, widening the allowlist would widen the test with it and prove
// nothing. This is the independent statement: the vocabulary a question figure
// is permitted, and nothing that can run, fetch or navigate.

const SAFE_TAGS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'text']);

const SAFE_ATTRS = new Set([
  'viewbox', 'role', 'aria-label', 'style',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
  'd', 'points',
  'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'font-size', 'font-family', 'font-style', 'font-weight', 'text-anchor'
]);

const SCHEME = /(?:javascript|vbscript|livescript|mocha)\s*(?::|&#)|data\s*:\s*text\/html/i;
const HANDLER = /\son[a-z]+\s*=/i;
const RUNNABLE = /<\s*\/?\s*(script|iframe|object|embed|img|image|svg|math|foreignobject|use|animate|animatetransform|set|style|link|meta|base|form|input|button|video|audio|source|track|applet|marquee|frame|frameset|template|portal|body|html)\b/i;
const TAG_IN = /<\/?([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
const ATTR_IN = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/**
 * Everything left in a piece of figure markup that a browser could act on.
 * Strict: anything outside the figure vocabulary counts, because a figure that
 * has grown a new tag has grown a new way to be interesting.
 */
function violations(html) {
  const found = [];
  const text = String(html ?? '');
  if (SCHEME.test(text)) found.push(`carries a scheme: ${show(text.match(SCHEME)[0])}`);
  if (HANDLER.test(text)) found.push(`carries an event handler: ${show(text.match(HANDLER)[0])}`);
  TAG_IN.lastIndex = 0;
  let m;
  while ((m = TAG_IN.exec(text))) {
    const tag = m[1].toLowerCase();
    if (!SAFE_TAGS.has(tag)) { found.push(`emits <${tag}>`); continue; }
    ATTR_IN.lastIndex = 0;
    let a;
    while ((a = ATTR_IN.exec(m[2]))) {
      const name = a[1].toLowerCase();
      if (!SAFE_ATTRS.has(name)) found.push(`<${tag}> keeps ${name}`);
    }
  }
  return found;
}

/**
 * The same question asked of a finished piece of HTML. A prompt escaped for
 * the page still reads "&lt;img src=x onerror=…&gt;", and that is the correct
 * answer, not a finding — so this looks for constructs a browser would act on:
 * a live tag that can fetch or run, a handler inside a real tag, a real tag
 * navigating to a scheme.
 */
function canRun(html) {
  const found = [];
  const text = String(html ?? '');
  if (RUNNABLE.test(text)) found.push(`carries a live ${show(text.match(RUNNABLE)[0])}`);
  TAG_IN.lastIndex = 0;
  let m;
  while ((m = TAG_IN.exec(text))) {
    if (HANDLER.test(` ${m[2]}`)) found.push(`<${m[1].toLowerCase()}> carries ${show(` ${m[2]}`.match(HANDLER)[0].trim())}`);
    if (SCHEME.test(m[2])) found.push(`<${m[1].toLowerCase()}> navigates to ${show(m[2].match(SCHEME)[0])}`);
  }
  return found;
}

/**
 * Everything a response carries, judged where it lands. Figures go into the
 * page as markup, so they answer to the figure vocabulary. Every other string
 * reaches the page through the prompt renderer, so it is put through the real
 * renderer here and the HTML that comes out is what gets judged — which is the
 * whole chain, from the file that was imported to the markup on the screen.
 */
function scan(value, render) {
  const figures = [];
  const texts = [];
  JSON.stringify(value, (key, v) => {
    if (typeof v === 'string') {
      if (key === 'figure') figures.push(v);
      else if (/[<>&$\\]/.test(v)) texts.push(v);
    }
    return v;
  });
  const found = [];
  for (const fig of figures) for (const bad of violations(fig)) found.push(`figure ${bad}`);
  if (render) {
    for (const text of texts) {
      for (const bad of canRun(render(text))) found.push(`${show(text.slice(0, 60))} renders to something that ${bad}`);
    }
  }
  return found;
}

// ── Compiling lib/latex.jsx so it can be called ──────────────────────────────
// The prompt renderer is a React component in a .jsx file, and testing it by
// reading its source is exactly the mistake this suite exists to avoid — a
// behaviour-preserving refactor would fail such a check and a behaviour-
// breaking change would pass it. So the JSX is compiled to plain calls here,
// its imports are pointed at stand-ins the suite controls, and the component is
// called as the function it is. What it hands to dangerouslySetInnerHTML is
// then a value, and can be asserted on like any other.

const IDENT = /[A-Za-z0-9_$.]/;
const BEFORE_JSX = /[([{,;:=?&|!><+\n]/;

/** Skip a quoted string, template literal or comment; returns the index after it. */
function skipLiteral(src, i) {
  const ch = src[i];
  if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); return nl < 0 ? src.length : nl; }
  if (ch === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); return end < 0 ? src.length : end + 2; }
  if (ch !== '"' && ch !== '\'' && ch !== '`') return i;
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === ch) return j + 1;
    j++;
  }
  return src.length;
}

/** Read a balanced {...} run, respecting nested braces and literals. */
function balancedBraces(src, i) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '"' || ch === '\'' || ch === '`' || (ch === '/' && (src[j + 1] === '/' || src[j + 1] === '*'))) { j = skipLiteral(src, j); continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return j + 1; }
    j++;
  }
  throw new Error('unbalanced { } in JSX');
}

/** Compile one JSX element starting at `i`; returns [code, indexAfter]. */
function compileElement(src, i) {
  let j = i + 1;
  let name = '';
  while (j < src.length && IDENT.test(src[j])) { name += src[j]; j++; }
  const props = [];
  for (; ;) {
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] === '/' && src[j + 1] === '>') { j += 2; return [`__h(${tagExpr(name)}${propsExpr(props)})`, j]; }
    if (src[j] === '>') { j++; break; }
    if (src[j] === '{') { const end = balancedBraces(src, j); props.push(src.slice(j + 1, end - 1).replace(/^\s*\.\.\./, '...')); j = end; continue; }
    let attr = '';
    while (j < src.length && /[-A-Za-z0-9_:]/.test(src[j])) { attr += src[j]; j++; }
    if (!attr) throw new Error(`unreadable JSX attribute at ${show(src.slice(j, j + 24))}`);
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '=') { props.push(`${JSON.stringify(attr)}: true`); continue; }
    j++;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] === '{') { const end = balancedBraces(src, j); props.push(`${JSON.stringify(attr)}: (${src.slice(j + 1, end - 1)})`); j = end; continue; }
    const end = skipLiteral(src, j);
    props.push(`${JSON.stringify(attr)}: ${JSON.stringify(src.slice(j + 1, end - 1))}`);
    j = end;
  }
  const children = [];
  for (; ;) {
    if (j >= src.length) throw new Error(`unterminated JSX element <${name}>`);
    if (src[j] === '<' && src[j + 1] === '/') {
      const close = src.indexOf('>', j);
      if (close < 0) throw new Error(`unterminated JSX close tag for <${name}>`);
      j = close + 1;
      break;
    }
    if (src[j] === '<') { const [code, next] = compileElement(src, j); children.push(code); j = next; continue; }
    if (src[j] === '{') { const end = balancedBraces(src, j); children.push(`(${src.slice(j + 1, end - 1)})`); j = end; continue; }
    let text = '';
    while (j < src.length && src[j] !== '<' && src[j] !== '{') { text += src[j]; j++; }
    const trimmed = text.replace(/\s*\n\s*/g, ' ').trim();
    if (trimmed) children.push(JSON.stringify(trimmed));
  }
  return [`__h(${tagExpr(name)}${propsExpr(props)}${children.length ? `, ${children.join(', ')}` : ''})`, j];
}

const tagExpr = name => (!name ? '"#fragment"' : /^[a-z][-a-z0-9]*$/.test(name) ? JSON.stringify(name) : name);
const propsExpr = props => (props.length ? `, { ${props.join(', ')} }` : ', null');

/** Rewrite a .jsx source into plain JavaScript that calls __h for every element. */
function compileJsx(src) {
  let out = '';
  let i = 0;
  let lastCode = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === '\'' || ch === '`' || (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*'))) {
      const end = skipLiteral(src, i);
      out += src.slice(i, end);
      if (ch !== '/') lastCode = ch;
      i = end;
      continue;
    }
    const opensElement = ch === '<' && (/[A-Za-z_$]/.test(src[i + 1] || '') || src[i + 1] === '>') &&
      (lastCode === '' || BEFORE_JSX.test(lastCode) || /\breturn$/.test(out.trimEnd()));
    if (opensElement) {
      const [code, next] = compileElement(src, i);
      out += code;
      lastCode = ')';
      i = next;
      continue;
    }
    out += ch;
    if (!/\s/.test(ch)) lastCode = ch;
    i++;
  }
  return out;
}

const H_SHIM = 'const __h = (type, props, ...kids) => ({ type, props: { ...(props || {}), ...(kids.length ? { children: kids.length === 1 ? kids[0] : kids } : {}) } });\n';

/**
 * Compile lib/latex.jsx into a module that can be imported in Node: React is a
 * stand-in whose useMemo simply runs the function, KaTeX is a stand-in the
 * suite can make behave — or misbehave — on demand, and the stylesheet import
 * goes away. The component's own code is untouched.
 */
function buildRenderer() {
  const dir = mkdtempSync(join(tmpdir(), 'pri-latex-'));
  const source = readFileSync(new URL('lib/latex.jsx', SRC), 'utf8');
  const compiled = compileJsx(source)
    .replace(/^\s*import\s+[^;]*?['"][^'"]*\.css['"];?\s*$/gm, '')
    .replace(/(['"])(\.[^'"]*)\1/g, (whole, q, rel) => `'${new URL(rel, `${SRC}lib/`).href}'`)
    .replace(/(['"])react\1/g, '\'./react.mjs\'')
    .replace(/(['"])katex\1/g, '\'./katex.mjs\'');

  writeFileSync(join(dir, 'react.mjs'), 'export const useMemo = (fn) => fn();\nexport default { useMemo };\n');
  writeFileSync(join(dir, 'katex.mjs'), `
// A stand-in for KaTeX with the two behaviours latex.jsx has to survive: the
// ordinary render, and the throw that is not a ParseError. KaTeX only swallows
// ParseError when throwOnError is false; anything else — a RangeError from a
// deeply nested input, for one — comes straight back out at the caller.
export const control = { throwOn: null, calls: [] };
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function renderToString(tex, options) {
  control.calls.push({ tex, options });
  if (control.throwOn !== null && String(tex).includes(control.throwOn)) throw new RangeError('Maximum call stack size exceeded');
  return \`<span class="katex">\${escape(tex)}</span>\`;
}
export default { renderToString };
`);
  writeFileSync(join(dir, 'latex.mjs'), H_SHIM + compiled);
  return dir;
}

// ── Figures the app really draws ─────────────────────────────────────────────
// A sanitiser that deletes real content is a broken sanitiser, so every builder
// in engine/figures.js is driven with parameters covering the shapes it emits,
// and each figure has to come back byte for byte.

function realFigures(F) {
  const out = [];
  const add = (name, html) => out.push([name, html]);
  const boxes = [
    { min: 2, q1: 5, med: 8, q3: 12, max: 19, axisMin: 0, axisMax: 20 },
    { min: -4, q1: 0, med: 3, q3: 7, max: 11, axisMin: -5, axisMax: 12 }
  ];
  for (const anglePos of ['base', 'top']) {
    add('rightTriangle', F.figRightTriangle({ base: '3 cm', height: '4 cm', hyp: '? cm', angle: '35°', anglePos }));
    add('rightTriangle-sparse', F.figRightTriangle({ base: '12 m', height: null, hyp: 'x', anglePos }));
  }
  add('rightTriangle-bare', F.figRightTriangle());
  for (const kind of ['alternate', 'corresponding', 'cointerior']) {
    add(`parallel-${kind}`, F.figParallelLines({ given: '65°', unknown: 'θ', kind }));
  }
  add('parallel-bare', F.figParallelLines());
  add('anglesAtPoint-3', F.figAnglesAtPoint([120, 150, 90]));
  add('anglesAtPoint-4', F.figAnglesAtPoint([70, 110, 90, 90]));
  add('anglesAtPoint-labelled', F.figAnglesAtPoint(['x', '2x', '3x']));
  add('rect', F.figRect({ l: '12 cm', w: '7 cm' }));
  add('rect-bare', F.figRect());
  add('rect-unknown', F.figRect({ l: '? cm', w: '4.5 cm' }));
  add('lShape', F.figLShape({ W1: 14, H1: 9, w2: 5, h2: 4 }));
  add('lShape-bare', F.figLShape());
  add('circle-radius', F.figCircle({ label: 'r = 7 cm' }));
  add('circle-diameter', F.figCircle({ label: 'd = 14 cm', diameter: true }));
  add('circle-bare', F.figCircle());
  for (const b of boxes) add('boxPlot', F.figBoxPlot(b));
  for (const p of [{ a: 1, h: 0, k: 0 }, { a: -2, h: 3, k: -4 }, { a: 0.5, h: -2, k: 1, xInts: [-4, 0] }, { a: 1, h: 1, k: 1, showVertex: false }]) {
    add('parabola', F.figParabola(p));
  }
  add('parabola-bare', F.figParabola());
  for (const bearing of [30, 120, 210, 300]) add('bearing', F.figBearing({ bearing, dist: '40 km', to: 'B' }));
  add('bearing-bare', F.figBearing());
  add('network-4', F.figNetwork({ nodes: ['A', 'B', 'C', 'D'], edges: [[0, 1, 5], [1, 3, 7], [0, 2, 3], [2, 3, 9]] }));
  add('network-6', F.figNetwork({ nodes: ['A', 'B', 'C', 'D', 'E', 'F'], edges: [[0, 1, 4], [1, 2, 6], [2, 3, 2], [3, 4, 8], [4, 5, 5], [5, 0, 3]] }));
  add('straightLine', F.figStraightLineAngles({ known: 50, unknown: 'θ' }));
  add('straightLine-obtuse', F.figStraightLineAngles({ known: 125, unknown: 'x' }));
  return out.filter(([, html]) => typeof html === 'string' && html.length > 0);
}

// ── The payload table ────────────────────────────────────────────────────────

const PAYLOADS = [
  ['a bare script', '<script>alert(1)</script>'],
  ['a script inside the figure', '<svg><script>alert(1)</script></svg>'],
  ['an image with onerror', '<img src=x onerror=alert(1)>'],
  ['an image smuggled into the figure', '<svg><img src=x onerror=alert(1)></svg>'],
  ['onload on the svg itself', '<svg onload=alert(1)></svg>'],
  ['onload in mixed case', '<svg ONLOAD=alert(1)></svg>'],
  ['a whole payload in mixed case', '<SVG OnLoad="alert(1)"><TEXT>hi</TEXT></SVG>'],
  ['a javascript: link', '<a href="javascript:alert(1)">tap here</a>'],
  ['a javascript: link inside the figure', '<svg><a xlink:href="javascript:alert(1)"><text>tap</text></a></svg>'],
  ['xlink:href on use', '<svg><use xlink:href="#payload"/></svg>'],
  ['href on use', '<svg><use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/></svg>'],
  ['foreignObject hiding a script', '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject></svg>'],
  ['foreignObject hiding an iframe', '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>'],
  ['a bare iframe', '<iframe src="javascript:alert(1)"></iframe>'],
  ['an object element', '<object data="javascript:alert(1)"></object>'],
  ['an embed element', '<embed src="javascript:alert(1)">'],
  ['a nested tag that reassembles', '<scr<script>ipt>alert(1)</script>'],
  ['a doubly nested tag', '<<script>script>alert(1)<</script>/script>'],
  ['reassembly inside the figure', '<svg><sc<script>ript>alert(1)</script></svg>'],
  ['an encoded handler body', '<img src=x onerror=&#97;lert(1)>'],
  ['an encoded scheme', '<a href="&#106;avascript:alert(1)">tap</a>'],
  ['a scheme split by a newline entity', '<a href="jav&#x0A;ascript:alert(1)">tap</a>'],
  ['a hex-encoded scheme', '<a href="&#x6a;&#x61;vascript:alert(1)">tap</a>'],
  ['a scheme in a style url', '<svg><text style="background:url(javascript:alert(1))">x</text></svg>'],
  ['an expression in a style', '<svg style="width:expression(alert(1))"></svg>'],
  ['a style element', '<svg><style>* { background: url(\'javascript:alert(1)\') }</style></svg>'],
  ['an animate that rewrites href', '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>'],
  ['a set that writes an attribute', '<svg><set attributeName="onload" to="alert(1)"/></svg>'],
  ['a body onload', '<body onload=alert(1)>'],
  ['onclick on a group', '<svg><g onclick="alert(1)"><text>x</text></g></svg>'],
  ['onmouseover on text', '<svg><text onmouseover=alert(1)>x</text></svg>'],
  ['mathml wrapping a script', '<math><mtext><script>alert(1)</script></mtext></math>'],
  ['a script inside desc', '<svg><desc><script>alert(1)</script></desc></svg>'],
  ['an image inside title', '<svg><title><img src=x onerror=alert(1)></title></svg>'],
  ['xlink on an image element', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="x" onerror="alert(1)"/></svg>'],
  ['an animation handler on a path', '<svg><path d="M0 0 L10 10" onbegin="alert(1)"/></svg>'],
  ['a figure wrapped in a div', '<div><svg><script>alert(1)</script></svg></div>'],
  ['a handler where a slash should be', '<svg/onload=alert(1)>'],
  ['a script that is already escaped', '<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>'],
  ['a script hidden in a comment', '<svg><!--<script>alert(1)</script>--></svg>'],
  ['an attribute break-out', '"><svg onload=alert(1)>'],
  ['a scheme in a fill url', '<svg><rect width="10" height="10" fill="url(javascript:alert(1))"/></svg>'],
  ['a css break-out in font-family', '<svg><text x="1" y="1" font-family="a;} * {background:url(javascript:alert(1))">x</text></svg>']
];

/** One string carrying a payload, for fields that are text rather than markup. */
const EVIL = '<img src=x onerror=alert(1)><script>alert(2)</script>';

// ── The suite ────────────────────────────────────────────────────────────────

async function run() {
  installBrowserEnv();
  const { sanitizeFigure, sanitizeText } = await import(`${SRC}lib/sanitize.js`);
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const idb = await import(`${SRC}local/idb.js`);
  const F = await import(`${SRC}engine/figures.js`);
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();

  // lib/latex.jsx compiled and callable. Every group below that reads a value
  // back out of an endpoint pushes it through this, because a stored string is
  // only dangerous once it has been rendered.
  const built = buildRenderer();
  const katex = await import(pathToFileURL(join(built, 'katex.mjs')).href);
  const { MathText } = await import(pathToFileURL(join(built, 'latex.mjs')).href);
  const render = text => String(MathText({ text })?.props?.dangerouslySetInnerHTML?.__html ?? '');

  const GET = (path, body) => dispatch('GET', path, body);
  const POST = (path, body) => dispatch('POST', path, body);

  let figureCount = 0;
  let sinkCount = 0;

  // ── The path a user actually runs ──────────────────────────────────────────
  section('browser parse path');
  try {
    ok('DOMParser is installed for this run', typeof globalThis.DOMParser === 'function',
      'without it every check below would test the Node fallback and none would test the shipped branch');

    // A case the two paths cannot agree on. The DOM decodes the entities into a
    // text node and the sanitiser escapes them again; the scanning fallback
    // never decodes, so it escapes the ampersands instead. <title> and the id
    // are dropped either way — unless the browser path is passing markup
    // through, in which case they survive and this says so.
    const CANARY = '<svg id="x"><title>t</title><text>&lt;b&gt;</text></svg>';
    const before = domParseCount();
    const domResult = sanitizeFigure(CANARY);
    ok('sanitising a figure goes through DOMParser', domParseCount() > before,
      'the parser was never called — the fallback ran instead');
    eq('the browser path decodes the entity and re-escapes it', domResult, '<svg><text>&lt;b&gt;</text></svg>');

    delete globalThis.DOMParser;
    const nodeResult = sanitizeFigure(CANARY);
    installBrowserEnv();
    eq('the Node fallback gives a different answer', nodeResult, '<svg>t<text>&amp;lt;b&amp;gt;</text></svg>');
    ok('so the two paths are genuinely distinguishable', domResult !== nodeResult,
      'both paths returned the same string, so this check could not tell which one ran');
    eq('and DOMParser is back for the rest of the suite', sanitizeFigure(CANARY), domResult);
  } catch (err) { crashed(err); }

  // ── Payloads ──────────────────────────────────────────────────────────────
  section('payload table');
  try {
    for (const [name, payload] of PAYLOADS) {
      const out = sanitizeFigure(payload);
      const bad = violations(out);
      ok(name, bad.length === 0, `${bad.join('; ')}\n      in: ${show(payload)}\n      out: ${show(out)}`);
    }
    eq('a script in a figure leaves nothing behind', sanitizeFigure('<svg><script>alert(1)</script></svg>'), '<svg/>');
    eq('an escaped script stays escaped text',
      sanitizeFigure('<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>'),
      '<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>');
    eq('a payload with no figure in it at all comes back empty', sanitizeFigure('<script>alert(1)</script>'), '');
  } catch (err) { crashed(err); }

  // ── The edges of the sanitiser ─────────────────────────────────────────────
  section('sanitiser edges');
  try {
    for (const [name, value] of [['null', null], ['undefined', undefined], ['a number', 42], ['an object', {}], ['an array', []], ['empty', '   ']]) {
      eq(`${name} sanitises to nothing`, sanitizeFigure(value), '');
    }
    eq('an oversized figure is dropped whole', sanitizeFigure(`<svg>${'<g>'.repeat(9000)}</svg>`), '');
    ok('a deeply nested figure is cut off rather than followed down',
      violations(sanitizeFigure(`<svg>${'<g>'.repeat(60)}<script>alert(1)</script>${'</g>'.repeat(60)}</svg>`)).length === 0, 'nesting carried a payload through');
    ok('a figure with thousands of nodes is capped',
      violations(sanitizeFigure(`<svg>${'<circle r="1"/>'.repeat(2000)}<script>alert(1)</script></svg>`)).length === 0, 'the node budget let a payload through');

    eq('a presentational style survives',
      sanitizeFigure('<svg style="max-width:440px;width:100%;height:auto;display:block"><text>x</text></svg>'),
      '<svg style="max-width:440px;width:100%;height:auto;display:block"><text>x</text></svg>');
    eq('a positioning style is dropped', sanitizeFigure('<svg style="position:fixed;top:0"><text>x</text></svg>'), '<svg><text>x</text></svg>');
    eq('a style with a function call is dropped', sanitizeFigure('<svg style="width:calc(100% - 2px)"><text>x</text></svg>'), '<svg><text>x</text></svg>');
    eq('viewBox keeps its case', sanitizeFigure('<svg viewbox="0 0 10 10"/>'), '<svg viewBox="0 0 10 10"/>');
    eq('an unknown attribute is dropped and a known one kept',
      sanitizeFigure('<circle cx="5" cy="5" r="4" data-payload="x" onclick="alert(1)"/>'), '<circle cx="5" cy="5" r="4"/>');

    eq('sanitizeText strips control characters', sanitizeText('one\u0007two\u0000three'), 'onetwothree');
    eq('sanitizeText caps the length', sanitizeText('x'.repeat(500), 20).length, 20);
    eq('sanitizeText turns nothing into an empty string', sanitizeText(null), '');
    ok('sanitizeText leaves ordinary text alone', sanitizeText('Find x when 3x + 2 = 11') === 'Find x when 3x + 2 = 11', 'plain text was damaged');
  } catch (err) { crashed(err); }

  // ── Real content must survive ─────────────────────────────────────────────
  section('real figures survive');
  try {
    const figures = realFigures(F);
    figureCount = figures.length;
    ok('the figure builders produced figures to test', figures.length >= 25, `${figures.length} figures built`);

    // The one thing rebuilding a figure is allowed to change: figures.js writes
    // `<path d="…" />` and an HTML serialiser writes `<path d="…"/>`. Every tag,
    // attribute, value and text node still has to come back exactly as it went
    // in — a sanitiser that quietly drops a label is as broken as one that lets
    // a payload through.
    const canonical = html => String(html).replace(/\s+\/>/g, '/>');
    const damaged = figures.filter(([, html]) => canonical(sanitizeFigure(html)) !== canonical(html));
    eq('every figure engine/figures.js draws comes back intact',
      damaged.map(([name, html]) => {
        const out = sanitizeFigure(html);
        let i = 0;
        while (i < Math.min(html.length, out.length) && canonical(html)[i] === canonical(out)[i]) i++;
        return `${name} diverges at ${i}: wanted ${show(canonical(html).slice(i, i + 70))}, got ${show(canonical(out).slice(i, i + 70))}`;
      }), []);
    ok('nothing is lost from a figure on the way through',
      figures.every(([, html]) => sanitizeFigure(html).length >= html.length - 200), 'a figure came back materially shorter');
    ok('the figures are not trivially empty', figures.every(([, html]) => html.length > 80), 'a builder returned almost nothing');
  } catch (err) { crashed(err); }

  // ── A poisoned task pack, driven through the real endpoint ────────────────
  section('poisoned task pack');
  try {
    resetStorage();
    await POST('/profiles', { name: 'Ms Reid', year: 12, role: 'teacher' });
    const good = F.figRightTriangle({ base: '3 cm', height: '4 cm', hyp: '? cm' });

    const pack = {
      format: 'pri-task-pack', version: 1, teacher: EVIL,
      task: { title: `Homework ${EVIL}`, mode: 'custom', subtopics: [], customIds: ['a', 'b'], count: 3 },
      customQs: [
        { id: 'a', name: `Q1 ${EVIL}`, difficulty: 2, q: { prompt: `Solve ${EVIL}`, answerType: 'numeric', answer: { value: 3 }, figure: '<svg><script>alert(1)</script><img src=x onerror=alert(1)></svg>', solutionText: EVIL, hints: [EVIL] } },
        { id: 'b', name: 'Q2', difficulty: 2, q: { prompt: 'Find the hypotenuse', answerType: 'numeric', answer: { value: 5 }, figure: good } }
      ]
    };
    const task = (await POST('/tasks/import-pack', structuredClone(pack))).task;

    eq('nothing in the imported task renders to anything that can run', scan(task, render), []);
    const stored = await idb.all('customQs');
    eq('two questions came out of the pack', stored.length, 2);
    eq('nothing in storage renders to anything that can run', scan(stored, render), []);
    const poisoned = stored.find(c => /Solve/.test(c.q.prompt));
    eq('the poisoned figure was stripped to nothing dangerous', violations(poisoned.q.figure ?? ''), []);
    ok('the poisoned prompt survives as text a student can read',
      poisoned.q.prompt.includes('Solve'), show(poisoned.q.prompt));
    const clean = stored.find(c => c.q.prompt === 'Find the hypotenuse');
    eq('the legitimate figure in the same pack survives intact', clean.q.figure, good);

    // Read it back the way a student does: the task serves the question.
    const served = await POST('/practice/next', { taskId: task.id });
    eq('the served question carries nothing that can run', scan(served, render), []);
    const listed = await GET('/tasks');
    eq('the task list carries nothing that can run', scan(listed, render), []);
    const customs = await GET('/custom-questions');
    eq('the custom question list carries nothing that can run', scan(customs, render), []);
  } catch (err) { crashed(err); }

  // ── A poisoned backup, driven through the real endpoint ───────────────────
  section('poisoned backup');
  try {
    resetStorage();
    const victim = (await POST('/profiles', { name: 'Sam', year: 10 })).user;
    const good = F.figCircle({ label: 'r = 7 cm' });
    const q = (await POST('/practice/next', { mode: 'smart' })).question;
    await POST(`/practice/${q.id}/reveal`, { ms: 900 });
    await POST(`/history/${q.id}/bookmark`, {});
    const exam = (await POST('/exams', { length: 10 })).exam;
    await POST(`/exams/${exam.id}/submit`, { answers: {}, ms: 60000 });

    const backup = structuredClone(await GET('/data/export'));
    backup.profile.name = `Mallory ${EVIL}`;
    backup.profile.avatar = EVIL;
    backup.profile.role = 'teacher';
    // Export order is random-uuid order and a multipart question's payload
    // carries `stem`, not `prompt` — poisoning a field history never reads
    // would make this group pass for the wrong reason, roughly one run in ten.
    // Pick the target by shape, not by position.
    const target = backup.stores.questions.findIndex(r => typeof r.payload?.prompt === 'string');
    ok('the backup holds a single-part question to poison', target >= 0,
      show(backup.stores.questions.map(r => Object.keys(r.payload || {}).slice(0, 4))));
    backup.stores.questions[target].payload.prompt = `Poisoned ${EVIL}`;
    backup.stores.questions[target].payload.figure = '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>';
    backup.stores.questions[target].payload.steps = [{ h: EVIL, d: EVIL }];
    const clean = structuredClone(backup.stores.questions[target]);
    clean.id = `${clean.id}-clean`;
    clean.payload.prompt = 'A perfectly ordinary question';
    clean.payload.figure = good;
    backup.stores.questions.push(clean);
    if (backup.stores.exams[0]?.detail?.[0]) {
      backup.stores.exams[0].detail[0].figure = '<svg onload=alert(1)><text>x</text></svg>';
      backup.stores.exams[0].detail[0].prompt = `Exam ${EVIL}`;
    }
    backup.stores.attempts[0].answerGiven = EVIL;
    backup.stores.inks = [{ id: backup.stores.questions[target].id, pid: 'anything', strokes: [{ points: [{ x: 1, y: 2 }] }], recognized: EVIL, photo: 'javascript:alert(1)', scribble: null, createdAt: 1 }];
    backup.stores.badges.push({ key: 'zzz:__proto__', pid: 'zzz', badgeId: '__proto__', earnedAt: 1 });

    const restored = (await POST('/data/import', backup)).user;
    ok('the restored name is plain text', !/[<>]/.test(restored.name), show(restored.name));
    eq('nothing that can run reached the restored profile', scan(restored, render), []);
    eq('the import did not touch Object.prototype', [{}.badgeId, {}.earnedAt, {}.pid], [undefined, undefined, undefined]);

    const disk = rawRows();
    eq('nothing that can run reached storage', scan(disk, render), []);
    const survivor = disk.questions.find(r => r.payload?.figure === good);
    ok('the legitimate figure in the same backup survives intact', !!survivor,
      `no restored question kept its figure: ${show(disk.questions.map(r => String(r.payload?.figure).slice(0, 40)))}`);
    ok('the poisoned photo was rejected', disk.inks.every(r => r.photo === null || /^data:image\//.test(String(r.photo))),
      show(disk.inks.map(r => String(r.photo).slice(0, 40))));

    // Read it all back the way a student does.
    const list = await POST('/history/list', { pageSize: 200 });
    eq('history carries nothing that can run', scan(list, render), []);
    ok('the poisoned question is still in history to be read',
      list.items.some(i => /Poisoned/.test(String(i.prompt ?? ''))),
      `neutralising it deleted it: ${show(list.items.map(i => String(i.prompt).slice(0, 40)).slice(0, 4))}`);
    for (const item of list.items.slice(0, 6)) {
      const detail = await GET(`/history/${item.id}/detail`);
      const bad = scan(detail, render);
      if (!ok(`history detail for ${show(String(item.subtopicName).slice(0, 24))} carries nothing that can run`,
        bad.length === 0, show(bad))) break;
    }
    const exams = await GET('/exams');
    for (const e of exams.exams) {
      eq('exam review carries nothing that can run', scan(await GET(`/exams/${e.id}`), render), []);
      eq('the printable paper carries nothing that can run', scan(await GET(`/exams/${e.id}/paper`), render), []);
    }
    eq('stats carry nothing that can run', scan(await GET('/stats'), render), []);
    eq('the report carries nothing that can run', scan(await GET('/report'), render), []);
    ok('the profile that imported it is a new one', restored.id !== victim.id, 'the import overwrote the profile it was imported into');
    ok('a backup cannot carry a password or a vault onto this device',
      disk.profiles.every(r => r.id !== restored.id || (!r.auth && !r.vault)),
      show(disk.profiles.find(r => r.id === restored.id) && Object.keys(disk.profiles.find(r => r.id === restored.id))));
  } catch (err) { crashed(err); }

  // ── A poisoned progress file, driven through the real endpoint ────────────
  section('poisoned progress file');
  try {
    resetStorage();
    await POST('/profiles', { name: 'Ada', year: 10 });
    const sq = (await POST('/practice/next', { mode: 'smart' })).question;
    await POST(`/practice/${sq.id}/reveal`, { ms: 900 });
    const progress = structuredClone(await GET('/data/progress-file'));

    await POST('/profiles', { name: 'Mr Reid', year: 12, role: 'teacher' });
    const klass = (await POST('/classes', { name: 'Year 10 Maths' })).class;

    progress.student.name = `Trudy ${EVIL}`;
    progress.student.avatar = EVIL;
    progress.student.year = 'nine';
    progress.predicted = { mark: '<svg onload=alert(1)>', low: 0, high: 100 };
    progress.totals = { attempts: 1e12, correct: -5 };
    progress.ratings.__proto__ = { rating: 9999 };
    progress.ratings['not-a-subtopic'] = { rating: 1, attempts: 1, correct: 1 };
    progress.ratings[EVIL] = { rating: 1, attempts: 1, correct: 1 };
    progress.taskProgress = [{ taskId: EVIL, done: 1, correct: 1, finished: true }];

    await POST(`/classes/${klass.id}/import-progress`, progress);
    const rows = await idb.all('progressImports');
    eq('the imported file reached storage as one row', rows.length, 1);
    eq('nothing that can run reached storage', scan(rows, render), []);
    ok('the imported name is plain text', !/[<>]/.test(String(rows[0].data?.student?.name)), show(rows[0].data?.student?.name));
    eq('the import did not touch Object.prototype', [{}.rating, {}.attempts], [undefined, undefined]);
    ok('ratings keyed to nothing real were dropped',
      Object.keys(rows[0].data?.ratings || {}).every(k => k !== '__proto__' && k !== 'not-a-subtopic' && !/[<>]/.test(k)),
      show(Object.keys(rows[0].data?.ratings || {})));

    const analytics = await GET(`/classes/${klass.id}/analytics`);
    eq('class analytics carries nothing that can run', scan(analytics, render), []);
    ok('the imported student appears in the analytics', analytics.students.some(s => s.imported), show(analytics.students.map(s => s.name)));
    ok('their name is plain text there too', analytics.students.every(s => !/[<>]/.test(String(s.name))), show(analytics.students.map(s => s.name)));
    eq('the classes list carries nothing that can run', scan(await GET('/classes'), render), []);
  } catch (err) { crashed(err); }

  // ── Where raw markup is written to the page ───────────────────────────────
  section('raw-markup sinks');
  try {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full);
      }
    };
    walk(SRC_DIR);
    const sinks = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const re = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*([^}]*?)\s*\}\}/g;
      let m;
      while ((m = re.exec(text))) sinks.push({ file: file.slice(SRC_DIR.length), expr: m[1].trim() });
    }
    sinkCount = sinks.length;
    ok('the app still writes raw markup somewhere worth guarding', sinks.length > 0,
      'no dangerouslySetInnerHTML found at all — this check has stopped measuring anything');

    // Two shapes are accounted for: a figure that came from the API (sanitised
    // before it was ever stored, and again on the way out) and the prompt
    // renderer's own output. A third shape is a sink nobody has looked at.
    const unaccounted = sinks.filter(s => !/(^|[.\s])figure\b/.test(s.expr) && !(s.file === 'lib/latex.jsx' && s.expr === 'html'));
    eq('every place raw markup is written comes from a figure or the prompt renderer',
      unaccounted.map(s => `${s.file}: ${s.expr}`), []);
  } catch (err) { crashed(err); }

  // ── The prompt renderer ───────────────────────────────────────────────────
  // lib/latex.jsx renders every prompt, option and working line in the app,
  // including the ones that arrived in an AirDropped pack. It is compiled and
  // called here, and what it hands to dangerouslySetInnerHTML is read back.
  section('prompt renderer');
  try {
    ok('the component compiled and returned an element', typeof MathText === 'function' && !!MathText({ text: 'x' })?.props,
      'lib/latex.jsx could not be compiled and called — this group is measuring nothing');
    eq('plain text comes through unchanged', render('Solve for x'), 'Solve for x');
    eq('markup in a prompt is escaped', render('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    eq('bold survives', render('**mass**'), '<strong>mass</strong>');
    eq('italic survives', render('*mass*'), '<em>mass</em>');
    ok('an escaped dollar stays a dollar', render('costs \\$4,000').includes('$4,000'), show(render('costs \\$4,000')));
    const mathHtml = render('area is $x^2$ units');
    ok('a maths segment reaches KaTeX', katex.control.calls.some(c => c.tex === 'x^2'), show(katex.control.calls.at(-1)));
    ok('and its rendering is what comes back', mathHtml.includes('class="katex"'), show(mathHtml));
    ok('the text around it is still text', mathHtml.startsWith('area is ') && mathHtml.endsWith(' units'), show(mathHtml));
    const insideMath = render('$<img src=x onerror=alert(1)>$');
    ok('markup inside a maths segment cannot run', canRun(insideMath).length === 0, show(insideMath));
    const eitherSide = render('<b>a</b> $x$ <img src=y onerror=alert(1)>');
    ok('markup either side of a maths segment cannot run', canRun(eitherSide).length === 0, show(eitherSide));

    // KaTeX only swallows ParseError when throwOnError is false. Anything else
    // — a RangeError from an input nested thousands of braces deep, which a
    // pack can carry — comes back out at renderMath(), whose catch hands the
    // TeX back unescaped and straight into dangerouslySetInnerHTML.
    katex.control.throwOn = 'onerror';
    const thrown = render('$<img src=x onerror=alert(1)>$');
    katex.control.throwOn = null;
    ok('a prompt that makes KaTeX throw is still escaped before it is written',
      canRun(thrown).length === 0,
      `lib/latex.jsx renderMath() catches the throw and returns the TeX unescaped; MathText wrote ${show(thrown)} into dangerouslySetInnerHTML.\n` +
      '      Fix in lib/latex.jsx: the `catch { return tex; }` must escape or drop the string, the way the text branch below it already does.');
    eq('and the renderer still works afterwards', render('**bold**'), '<strong>bold</strong>');

    // The throw the check above depends on is not hypothetical. Where KaTeX is
    // installed, it is driven for real; where it is not, that is said out loud
    // rather than counted as anything.
    try {
      const real = (await import('katex')).default;
      const deep = '{'.repeat(2000) + 'x' + '}'.repeat(2000);
      let raised = null;
      try { real.renderToString(deep, { throwOnError: false, strict: false }); } catch (e) { raised = e; }
      ok('the real KaTeX throws a non-ParseError on an input a pack can carry',
        !!raised && raised.constructor?.name !== 'ParseError', `KaTeX raised ${show(raised && raised.constructor?.name)}`);
    } catch {
      notes.push('katex is not installed here, so the reachability of the throw above was not driven against the real library (it is driven against a stand-in either way)');
    }
  } catch (err) { crashed(err); }

  rmSync(built, { recursive: true, force: true });
  return report({ figureCount, sinkCount });
}

// ── Summary ──────────────────────────────────────────────────────────────────

function report({ figureCount = 0, sinkCount = 0 } = {}) {
  const total = groups.reduce((n, g) => n + g.pass + g.fail, 0);
  const failed = groups.reduce((n, g) => n + g.fail, 0);

  console.log('\nSecurity — every payload asserted dead, every real figure asserted intact\n');
  for (const g of groups) {
    const n = g.pass + g.fail;
    console.log(`  ${g.name.padEnd(24)} ${String(g.pass).padStart(3)}/${String(n).padEnd(3)} ${g.fail ? `✖ ${g.fail} FAILED` : '✔'}`);
  }
  console.log(`\n  ${PAYLOADS.length} XSS payloads · ${figureCount} engine figures · ${sinkCount} raw-markup sinks`);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
  }
  for (const n of notes) console.log(`\n  not measured: ${n}`);
  const verdict = failed ? '✖ SECURITY SUITE FAILED' : '✔ SECURITY SUITE PASSED';
  console.log(`\n${verdict} — ${total - failed}/${total} checks across ${groups.length} groups`);
  return failed;
}

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === launched) {
  run().then(failed => process.exit(failed ? 1 : 0)).catch(err => {
    if (!group) section('startup');
    ok('the suite ran to the end', false, `crashed: ${err?.stack || err}`);
    report();
    console.log('\n  the groups above are only what ran before the crash — the rest never got a verdict');
    process.exit(1);
  });
}
