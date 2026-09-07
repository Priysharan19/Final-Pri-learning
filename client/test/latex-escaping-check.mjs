// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · LaTeX survives the JavaScript string
//
// Every formula a student reads is authored as LaTeX inside an ordinary
// JavaScript string, and an ordinary JavaScript string eats a lone backslash.
// So '$\sqrt2$' is not the source that KaTeX receives — the parser strips the
// backslash first and hands KaTeX '$sqrt2$', which it renders as the italic
// letters s-q-r-t-2. The chapter still loads, the tests still pass, and a
// Class 9 student reading about irrational numbers is shown "sqrt2".
//
// That is the whole defect: it is silent, it is invisible to a schema check,
// and it degrades exactly the content that matters most — the formula line of
// a topper note, the classification prompt, the worked step.
//
// This check reads the strings the app actually renders — the exported NCERT
// content objects and the live output of every registered generator — and
// fails when a LaTeX command name appears with its backslash already eaten.
// It deliberately works on rendered values rather than on source text, so it
// stays true through a refactor and never fires on a prose comment that
// happens to mention \sqrt.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { makeRng } from '../src/engine/qhelpers.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── What a swallowed backslash looks like ────────────────────────────────────
//
// ALWAYS: command names that are never English words, so seeing one bare is
// proof on its own, wherever in the string it appears.
const ALWAYS = ['sqrt','mathbb','mathrm','mathbf','mathcal','dfrac','tfrac','frac','cdot','cdots',
  'ldots','vdots','Rightarrow','Leftarrow','leftrightarrow',
  'rightarrow','longrightarrow','infty','overline','underline','widehat','widetilde','qquad',
  'equiv','notin','neq','leq','geq','propto','perp','cong','gtrless','binom','operatorname',
  'displaystyle','boxed','pmatrix','bmatrix','varepsilon','varphi','circ','nmid'];
//
// IN_MATH: command names that are also ordinary English ("times", "sum", "min",
// "angle"), so they only convict inside maths — between $…$ delimiters, or in a
// `formula` field, which is rendered as maths without delimiters.
const IN_MATH = ['pi','phi','alpha','beta','gamma','delta','theta','lambda','mu','sigma','omega',
  'Delta','Sigma','Omega','Gamma','Lambda','Theta','Phi','times','div','angle','triangle','quad',
  'le','ge','ne','cap','cup','sum','prod','int','min','max','sin','cos','tan','sec','csc','cot',
  'log','ln','pm','mp','mid','bar','vec','hat','dots','sim','parallel','text','left','right','iff',
  'subset','supset','subseteq','supseteq'];

// A `formula` field is rendered as maths without $…$ delimiters — but some are
// written as an English sentence ("Sector angle = category frequency / total
// × 360°"), where "angle" is the English word. Treat one as maths only when it
// carries maths syntax; a swallowed command in a prose formula is still caught
// by ALWAYS, which needs no maths context.
const looksLikeMaths = s => /[\\^_{}]/.test(s) || !/\s/.test(s);

const bounded = words => new RegExp(String.raw`(?<![A-Za-z\\])(?<!_\{)(?<!\^\{)(?<!\\begin\{)(?<!\\end\{)(${words.join('|')})(?![A-Za-z])`, 'g');
const ALWAYS_RE = bounded(ALWAYS);
const IN_MATH_RE = bounded(IN_MATH);

// The prose inside \text{…} is prose, not commands — "right triangle" there is
// English and must not be read as a swallowed \right.
const stripProse = s => s.replace(/\\+(?:text|mathrm|textbf|textit|operatorname)\{[^{}]*\}/g, ' ');

/** Every LaTeX command name in `str` whose backslash has been eaten. */
function bareLatex(str, { wholeStringIsMath = false } = {}) {
  const hits = new Set();
  const body = stripProse(str);
  for (const m of body.matchAll(ALWAYS_RE)) hits.add(m[1]);
  const mathSpans = wholeStringIsMath ? [body] : [...body.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
  for (const span of mathSpans) for (const m of span.matchAll(IN_MATH_RE)) hits.add(m[1]);
  return [...hits];
}

// ── The detector has to actually detect ──────────────────────────────────────
// A check that silently stops looking would pass forever, so prove it fires on
// the exact strings this defect produced before it convicts anything else.
eq(bareLatex('Which is the most specific listed classification of $sqrt2$?'), ['sqrt'],
  'a swallowed \\sqrt inside $…$ is caught');
eq(bareLatex('mathbb Nsubsetmathbb Zsubsetmathbb Qsubsetmathbb R', { wholeStringIsMath: true }), ['mathbb'],
  'a swallowed \\mathbb in a bare formula field is caught');
eq(bareLatex('Find $dfrac{1}{2}$ of the class.'), ['dfrac'], 'a swallowed \\dfrac is caught');
eq(bareLatex('n=prod p_i^{a_i}', { wholeStringIsMath: true }), ['prod'], 'a swallowed \\prod is caught');
eq(bareLatex('Which is the most specific listed classification of $\\sqrt2$?'), [],
  'correctly escaped LaTeX is left alone');
eq(bareLatex('$\\mathbb N\\subset\\mathbb Z$', { wholeStringIsMath: true }), [],
  'a correct formula field is left alone');
eq(bareLatex('Multiply the base by the height, then halve it.'), [],
  'ordinary English prose is left alone');
eq(bareLatex('A proper subset is any subset except the whole set.'), [],
  '"subset" as an English word is left alone');
eq(bareLatex('$|\\ddot{x}|_{max} = n^2 A$'), [], 'a literal subscript label like _{max} is not a command');
eq(bareLatex('$\\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix}$'), [], 'an environment name is not a command');
eq(bareLatex('$x_{sqrt} + frac{1}{2}$'), ['frac'], 'a label is exempt but a real swallowed command beside it is not');
eq(bareLatex('$P(\\text{not blue})$ counts the red and green sectors.'), [],
  'English inside \\text{…} is not read as commands');
eq(bareLatex('A chord subtends $${a}^\\circ$ at the centre of the circumference.'.replace('${a}', '60')), [],
  '"circumference" is not read as a swallowed \\circ');

// ── Sweep 1: the NCERT content the chapter screens render ────────────────────
const ncertDir = 'client/src/engine/ncert';
const ncertFiles = fs.readdirSync(ncertDir).filter(f => f.endsWith('.js')).sort();
ok(ncertFiles.length >= 13, `every NCERT source module is swept — found ${ncertFiles.length}`);

let contentStrings = 0;
const contentFaults = [];
for (const file of ncertFiles) {
  const mod = await import(path.resolve(ncertDir, file));
  const seen = new Set();
  const walk = (value, trail, mathField) => {
    if (typeof value === 'string') {
      contentStrings++;
      const bare = bareLatex(value, { wholeStringIsMath: mathField });
      if (bare.length) contentFaults.push(`${file} ${trail}: ${bare.join(', ')} — ${JSON.stringify(value.slice(0, 90))}`);
      return;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${trail}[${i}]`, mathField)); return; }
    for (const key of Object.keys(value)) walk(value[key], `${trail}.${key}`, key === 'formula' && looksLikeMaths(String(value[key])));
  };
  for (const [name, value] of Object.entries(mod)) walk(value, name, false);
}
ok(contentStrings > 5000, `the sweep reached the content — ${contentStrings} strings read`);
ok(contentFaults.length === 0,
  `NCERT content renders its LaTeX — ${contentFaults.length} swallowed backslashes:\n      ${contentFaults.slice(0, 12).join('\n      ')}`);

// ── Sweep 1b: a formula only renders if something puts it in maths mode ──────
//
// `formula` carries bare maths with no $…$ of its own (`PQ=\sqrt{…}`), so it
// renders only if its component wraps it. Class 10's did and Class 9's did not,
// which printed the backslashes to the student — the same defect as a swallowed
// one, arrived at from the other side. Class 8 is the deliberate opposite: its
// formulas are English sentences with Unicode symbols, and wrapping those would
// turn readable prose into italic letters. So the rule is per class, and both
// halves — the data and the component — have to agree.
const WRAPS = 'client/src/components/NcertClass9ChapterSection.jsx';
const WRAPS10 = 'client/src/components/Class10NCERTLibrary.jsx';
const PLAIN8 = 'client/src/components/NcertClass8ChapterSection.jsx';
const src = f => fs.readFileSync(f, 'utf8');
ok(/<MathText text=\{`\$\$\{n\.formula\}\$`\}/.test(src(WRAPS)),
  'the Class 9 section puts `formula` in maths mode');
ok(/<MathText text=\{`\$\$\{n\.formula\}\$`\}/.test(src(WRAPS10)),
  'the Class 10 library puts `formula` in maths mode');
ok(/<Text>\{note\.formula\}<\/Text>/.test(src(PLAIN8)),
  'the Class 8 section leaves `formula` as prose, which is right for its Unicode sentences');

const formulasOf = async file => {
  const mod = await import(path.resolve(ncertDir, file));
  const found = []; const seen = new Set();
  const walk = (v, key) => {
    if (typeof v === 'string') { if (key === 'formula') found.push(v); return; }
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) return v.forEach(x => walk(x, key));
    for (const k of Object.keys(v)) walk(v[k], k);
  };
  Object.values(mod).forEach(v => walk(v, null));
  return found;
};

// Wrapped classes: every formula must survive KaTeX, or maths mode renders an error.
const wrapped = ['class9-content.js', 'class9-chapters-production.js', 'class10-content.js', 'class10-chapters-production.js'];
let wrappedFormulas = 0;
const unparsable = [];
for (const file of wrapped) {
  for (const f of await formulasOf(file)) {
    wrappedFormulas++;
    try { katex.renderToString(f, { throwOnError: true, strict: false }); }
    catch (e) { unparsable.push(`${file}: ${JSON.stringify(f.slice(0, 70))} — ${e.message.slice(0, 80)}`); }
  }
}
ok(wrappedFormulas >= 200, `every wrapped formula is checked — ${wrappedFormulas} found`);
ok(unparsable.length === 0,
  `every Class 9/10 formula parses as maths — ${unparsable.length} do not:\n      ${unparsable.slice(0, 8).join('\n      ')}`);

// Unwrapped class: a LaTeX command here would print its own backslash.
const plainFiles = ['class8-chapters-3-13-production.js', 'class8-linear-equations.js', 'class8-linear-production.js',
  'class8-rational-numbers.js', 'class8-rational-production.js'];
let plainFormulas = 0;
const wouldPrintBackslash = [];
for (const file of plainFiles) {
  for (const f of await formulasOf(file)) {
    plainFormulas++;
    // Strip the $…$ spans it delimits itself; whatever is left is rendered as prose.
    const prose = f.split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g).filter((_, i) => i % 2 === 0).join(' ');
    if (/\\[A-Za-z]/.test(prose)) wouldPrintBackslash.push(`${file}: ${JSON.stringify(f.slice(0, 70))}`);
  }
}
ok(plainFormulas >= 8, `every unwrapped formula is checked — ${plainFormulas} found`);
ok(wouldPrintBackslash.length === 0,
  `no Class 8 formula hides LaTeX its renderer will not run — ${wouldPrintBackslash.length}:\n      ${wouldPrintBackslash.join('\n      ')}`);

// ── Sweep 2: what every registered generator actually emits ──────────────────
const bankModules = ['year7','year8','year9','year10','year11','year12','streams-standard','streams-ext',
  'india-algebra','india-coordinate','india-calculus','india-olympiad','india-foundation',
  'india-junior-overlay','india-class10','india-senior','india-class11','india-class12'];
const SEEDS = [0x51a10001, 0x51a10002, 0x51a10003, 0x51a10004, 0x51a10005];

let forms = 0, formStrings = 0, generators = 0;
const formFaults = [];
for (const name of bankModules) {
  const mod = await import(`../src/engine/generators/${name}.js`);
  const bank = Object.values(mod).find(v => v && typeof v === 'object' && Object.values(v).some(f => typeof f === 'function'));
  ok(!!bank, `${name}: exports a generator bank`);
  if (!bank) continue;
  for (const [id, fn] of Object.entries(bank)) {
    if (typeof fn !== 'function') continue;
    generators++;
    for (let diff = 1; diff <= 4; diff++) for (const seed of SEEDS) {
      let form;
      try { form = fn(makeRng((seed + diff * 7919) >>> 0), diff); } catch { continue; }
      if (!form) continue;
      forms++;
      const walk = (value, trail) => {
        if (typeof value === 'string') {
          formStrings++;
          const bare = bareLatex(value);
          if (bare.length) formFaults.push(`${name}/${id} D${diff}${trail}: ${bare.join(', ')} — ${JSON.stringify(value.slice(0, 90))}`);
          return;
        }
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${trail}[${i}]`)); return; }
        for (const key of Object.keys(value)) walk(value[key], `${trail}.${key}`);
      };
      // `answer` is skipped on purpose: canonicalInput is the plain form a student
      // types ("sqrt(3)"), which is deliberately not LaTeX and never rendered as maths.
      for (const key of ['prompt', 'hints', 'steps', 'mcqOptions', 'parts']) {
        if (form[key] !== undefined) walk(form[key], `.${key}`);
      }
    }
  }
}
ok(generators >= 200, `every registered generator is exercised — ${generators} generators`);
ok(forms > 3000, `the sweep reached real forms — ${forms} generated`);
ok(formFaults.length === 0,
  `generated questions render their LaTeX — ${formFaults.length} swallowed backslashes:\n      ${formFaults.slice(0, 12).join('\n      ')}`);

console.log(failures.length
  ? `LATEX ESCAPING: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LATEX ESCAPING: PASS — ${pass}/${pass} checks — ${contentStrings} NCERT content strings and ${formStrings} strings from ${forms} generated forms across ${generators} generators carry their backslashes into KaTeX.`);
process.exit(failures.length ? 1 : 0);
