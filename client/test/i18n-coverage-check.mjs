// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · interface-language coverage
//
// client/test/i18n-check.mjs proves the catalogue contract for the screens it
// lists. This suite is the ratchet that keeps the rest of the interface from
// drifting back into English: it parses EVERY page and component and fails on
// any string a reader could see that is not routed through t()/tx().
//
// What counts as "a string a reader could see":
//
//   - every JSX text node with a word in it;
//   - every string or template literal anywhere in the file that reads as
//     prose — a capitalised word followed by more words ("Watch explanation"),
//     or a multi-word phrase ending in sentence punctuation. That includes
//     literals parked in a lookup table or a variable and rendered later, which
//     is exactly what the narrower JSX-only scan used to let through
//     (`const status = playing ? 'Paused' : …` then `{status}`).
//
// What does not: imports, console output, thrown Error messages, equality
// operands (`mode === 'Exam'` compares against an internal name), object
// property KEYS, and machinery attributes (className, style, id, role, href…).
//
// Exceptions are explicit and carry a reason, in one of two places:
//
//   client/test/i18n-hardcoded-allowlist.json
//     "files"    — a whole file that is not student/teacher interface (a staff
//                  console, a hidden physical-device study harness);
//     "literals" — an exact string that is correctly the same in every
//                  language (the product name, a board name, a symbol).
//
//   an in-source region:
//       // i18n-exempt-start: <reason>
//       …
//       // i18n-exempt-end
//     for mathematics content (NCERT topper notes, worked-example text) that
//     stays in English by design — see the head of i18n-check.mjs for why the
//     mathematics is English and the interface is not.
//
// It also proves the two things a catalogue can get wrong at a call site:
//   - every t('key', { … }) passes every {placeholder} the English template
//     names (and `count` for a counted string), so a Hindi sentence cannot
//     render with a hole where the number should be;
//   - en and every registered language have identical key sets (parity is
//     also asserted in i18n-check; it is repeated here for every language
//     languages.js registers, not just Hindi).
//
// Usage:
//   node client/test/i18n-coverage-check.mjs            the gate
//   node client/test/i18n-coverage-check.mjs --list X    findings in files matching X
//   node client/test/i18n-coverage-check.mjs --report    per-file counts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';

import en from '../src/i18n/strings.en.js';
import { LANGUAGES } from '../src/i18n/languages.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const ALLOW = JSON.parse(read('test/i18n-hardcoded-allowlist.json'));

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── Which files ──────────────────────────────────────────────────────────────
const jsxIn = dir => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.jsx')).map(f => `${dir}/${f}`);
export const SCANNED = ['src/App.jsx', ...jsxIn('src/pages'), ...jsxIn('src/components')];

// ── What reads as prose ──────────────────────────────────────────────────────
// A capitalised word followed by at least one more token, or a phrase with a
// space that ends a sentence. "btn btn-primary", "mcq-opt", "cbse" and
// "c8-rational-numbers" are machinery and match neither.
const PROSE = (raw) => {
  const v = String(raw).trim();
  return /^[A-Z][a-z’']*[a-z]\b[^\n]*\s\S/.test(v) || (/\s/.test(v) && /[a-z]{2}[.!?…]$/.test(v));
};
const HAS_WORD = /[A-Za-z]{2,}|[A-Za-z](?=\s|$)/;
const MACHINERY_ATTRS = new Set(['className', 'style', 'id', 'role', 'href', 'to', 'type', 'name', 'key', 'htmlFor',
  'data-testid', 'inputMode', 'autoComplete', 'pattern', 'lang', 'rel', 'target', 'method', 'action', 'accept', 'src', 'd', 'viewBox']);
const SPOKEN = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'title', 'placeholder', 'alt', 'label']);
const SILENT_CALLS = new Set(['t', 'tx', 'console.log', 'console.warn', 'console.error', 'console.info', 'console.debug']);

function exemptRegions(source, rel, problems) {
  const regions = [];
  const re = /\/\/\s*i18n-exempt-(start|end)(?::\s*(.*))?$/gm;
  let open = null;
  for (const m of source.matchAll(re)) {
    if (m[1] === 'start') {
      if (open) problems.push(`${rel}: nested i18n-exempt-start`);
      if (!m[2] || m[2].trim().length < 20) problems.push(`${rel}: i18n-exempt-start at offset ${m.index} has no written reason`);
      open = m.index;
    } else {
      if (open == null) problems.push(`${rel}: i18n-exempt-end without a start`);
      else regions.push([open, m.index]);
      open = null;
    }
  }
  if (open != null) problems.push(`${rel}: i18n-exempt-start never closed`);
  return regions;
}

/** Every hard-coded user-visible string in one file, as `{ kind, text }`. */
export function findingsIn(rel, problems = []) {
  const source = read(rel);
  const regions = exemptRegions(source, rel, problems);
  const exempt = node => regions.some(([a, b]) => node.start >= a && node.end <= b);
  const literals = ALLOW.literals || {};
  const hits = [];
  const push = (kind, text, node) => {
    const clean = String(text).replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!clean || clean in literals || exempt(node)) return;
    hits.push({ kind, text: clean });
  };
  const ast = parseAst(source, { lang: 'jsx' });
  // `drawn` is true inside an expression a JSX element renders as a child, or
  // inside a spoken attribute. There, any multi-word string is visible text,
  // even lower-case: {done ? 'replay complete' : 'replaying…'} is read by a
  // student exactly as a text node is.
  const visit = (n, parent, drawn = false) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(c => visit(c, parent, drawn)); return; }
    switch (n.type) {
      case 'ImportDeclaration': case 'ExportAllDeclaration': return;
      case 'CallExpression': {
        const c = n.callee;
        const name = c?.name || `${c?.object?.name}.${c?.property?.name}`;
        if (SILENT_CALLS.has(name)) return;
        break;
      }
      case 'NewExpression':
        if (/Error$/.test(n.callee?.name || '')) return;
        break;
      case 'ThrowStatement': return;
      case 'BinaryExpression':
        if (['===', '!==', '==', '!='].includes(n.operator)) return;
        break;
      case 'SwitchCase': visit(n.consequent, n, drawn); return;
      case 'JSXAttribute':
        if (MACHINERY_ATTRS.has(n.name?.name) || /^data-/.test(n.name?.name || '')) return;
        visit(n.value, n, SPOKEN.has(n.name?.name));
        return;
      case 'JSXExpressionContainer':
        visit(n.expression, n, drawn || parent?.type === 'JSXElement' || parent?.type === 'JSXFragment');
        return;
      case 'JSXElement': case 'JSXFragment':
        for (const k of Object.keys(n)) {
          if (k === 'type' || k === 'start' || k === 'end') continue;
          const c = n[k];
          if (c && typeof c === 'object') visit(c, n, false);
        }
        return;
      case 'ObjectExpression': case 'ArrowFunctionExpression': case 'FunctionExpression':
        drawn = false;
        break;
      case 'Property':
        visit(n.value, n, drawn);
        if (n.computed) visit(n.key, n, drawn);
        return;
      case 'JSXText':
        if (HAS_WORD.test(n.value.replace(/&[a-z]+;/gi, ' '))) push('text', n.value, n);
        return;
      case 'Literal':
        if (typeof n.value === 'string' && (PROSE(n.value) || (drawn && /\s/.test(n.value.trim()) && /[A-Za-z]{2}/.test(n.value)))) push('string', n.value, n);
        return;
      case 'TemplateLiteral': {
        const joined = n.quasis.map(q => q.value.cooked).join('{}');
        const plain = joined.replace(/\{\}/g, 'X');
        if (PROSE(plain) || (drawn && /\s/.test(plain.trim()) && /[A-Za-z]{2}/.test(joined))) push('template', joined, n);
        n.expressions.forEach(e => visit(e, n, drawn));
        return;
      }
      default: break;
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const c = n[k];
      if (c && typeof c === 'object') visit(c, n, drawn);
    }
  };
  visit(ast, null);
  return hits;
}

// ── Interpolation: every placeholder the template names is passed ────────────
const PLACEHOLDERS = /\{(\w+)\}/g;
const slotsOf = value => new Set(
  (typeof value === 'string' ? [value] : Object.values(value || {}))
    .flatMap(s => [...String(s).matchAll(PLACEHOLDERS)].map(m => m[1]))
);

function callsIn(rel) {
  const out = [];
  const ast = parseAst(read(rel), { lang: rel.endsWith('.jsx') ? 'jsx' : 'js' });
  const visit = n => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.type === 'CallExpression' && ['t', 'tx', 'translate'].includes(n.callee?.name)) {
      const [k, v] = n.arguments;
      if (k?.type === 'Literal' && typeof k.value === 'string') {
        let passed = null;   // null = cannot know statically (a variable, a spread)
        if (!v) passed = new Set();
        else if (v.type === 'ObjectExpression' && !v.properties.some(p => p.type !== 'Property')) {
          passed = new Set(v.properties.map(p => p.key?.name ?? p.key?.value));
        }
        out.push({ key: k.value, passed });
      }
    }
    for (const key of Object.keys(n)) {
      if (key === 'type') continue;
      const c = n[key];
      if (c && typeof c === 'object') visit(c);
    }
  };
  visit(ast);
  return out;
}

function sourceFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceFiles(rel);
    return /\.jsx?$/.test(e.name) ? [rel] : [];
  });
}

// ── CLI helpers ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv[0] === '--list' || argv[0] === '--report') {
  let total = 0;
  for (const rel of SCANNED) {
    if (argv[0] === '--list' && !rel.includes(argv[1] || '')) continue;
    if (rel in (ALLOW.files || {})) continue;
    const hits = findingsIn(rel);
    total += hits.length;
    if (argv[0] === '--list') hits.forEach(h => console.log(`${rel}: ${h.kind} “${h.text.slice(0, 100)}”`));
    else if (hits.length) console.log(`${String(hits.length).padStart(4)}  ${rel}`);
  }
  console.log(`TOTAL ${total}`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · No page or component draws hard-coded English
// ─────────────────────────────────────────────────────────────────────────────
const problems = [];
const leftInEnglish = [];
let scanned = 0;
for (const rel of SCANNED) {
  if (rel in (ALLOW.files || {})) continue;
  scanned++;
  for (const h of findingsIn(rel, problems)) leftInEnglish.push(`${rel}: ${h.kind} “${h.text.slice(0, 80)}”`);
}
ok(scanned >= 35, `the scan covers every page and component (${scanned} files)`);
eq(problems, [], 'every i18n-exempt region is well-formed and states its reason');
eq(leftInEnglish, [], 'no page or component draws a hard-coded English string');

for (const [file, reason] of Object.entries(ALLOW.files || {})) {
  ok(existsSync(join(ROOT, file)), `the file allowlist does not name a file that is gone: ${file}`);
  ok(String(reason).length > 30, `the file allowlist states a reason for ${file}`);
}
for (const [text, reason] of Object.entries(ALLOW.literals || {})) {
  ok(String(reason).length > 15, `the literal allowlist states a reason for “${text}”`);
}
ok(Object.keys(ALLOW.files || {}).length <= 4, 'whole-file exemptions stay few enough to read');

// The student-facing screens named in the brief may never be file-exempt.
for (const rel of ['src/pages/PracticeBase.jsx', 'src/components/QuestionCard.jsx', 'src/pages/Exams.jsx',
  'src/pages/ExamRoom.jsx', 'src/pages/IndiaProgress.jsx', 'src/pages/Home.jsx', 'src/pages/SettingsLegacy.jsx',
  'src/pages/Login.jsx', 'src/components/PriExplainV5.jsx', 'src/pages/Teach.jsx', 'src/pages/Classes.jsx']) {
  ok(!(rel in (ALLOW.files || {})), `${rel} is scanned, not exempted`);
  ok(!/i18n-exempt-start/.test(read(rel)), `${rel} carries no exempt region`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Every call passes every placeholder its template needs
// ─────────────────────────────────────────────────────────────────────────────
const missingParams = [];
let callsChecked = 0;
for (const rel of sourceFiles('src')) {
  if (rel.includes('/i18n/strings.')) continue;
  for (const { key, passed } of callsIn(rel)) {
    if (!(key in en) || passed == null) continue;
    callsChecked++;
    const need = [...slotsOf(en[key])];
    if (typeof en[key] === 'object') need.push('count');
    const absent = need.filter(slot => !passed.has(slot));
    if (absent.length) missingParams.push(`${rel}: t('${key}') is missing {${absent.join(', ')}}`);
  }
}
ok(callsChecked > 800, `the interpolation check read the call sites (${callsChecked} statically checkable calls)`);
eq(missingParams, [], 'every t() call passes every placeholder its English template names');

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Every registered language has exactly the English keys
// ─────────────────────────────────────────────────────────────────────────────
const enKeys = Object.keys(en).sort();
for (const lang of LANGUAGES) {
  if (lang.id === 'en') continue;
  const rel = `src/i18n/strings.${lang.id}.js`;
  ok(existsSync(join(ROOT, rel)), `${lang.english} has a catalogue at ${rel}`);
  const strings = (await import(`../src/i18n/strings.${lang.id}.js`)).default;
  const keys = Object.keys(strings).sort();
  eq(enKeys.filter(k => !(k in strings)), [], `every English key exists in ${lang.english}`);
  eq(keys.filter(k => !(k in en)), [], `${lang.english} has no key English lacks`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Engine copy shown through the catalogue cannot drift from the engine
//
// The India exam blueprints' labels and release notes, and the exam claim
// reasons, have their English source of truth in engine/indiaExams.js (other
// suites hold those sentences to strict wording about authenticity). Exams.jsx
// shows them through catalogue keys so they can be read in Hindi; the English
// catalogue must say exactly what the engine says.
// ─────────────────────────────────────────────────────────────────────────────
const exams = await import('../src/engine/indiaExams.js');
const examsPage = read('src/pages/Exams.jsx');
const blueprintKeys = Object.fromEntries([...examsPage.matchAll(/'([a-z0-9-]+)': \['(exams\.bp\.\w+)', '(exams\.bp\.\w+)'\]/g)].map(m => [m[1], [m[2], m[3]]]));
const blueprints = Object.values(exams).filter(v => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.label === 'string' && 'releaseNote' in v);
ok(blueprints.length >= 8, `the engine's exam blueprints were found (${blueprints.length})`);
for (const bp of blueprints) {
  const keys = blueprintKeys[bp.id];
  ok(Boolean(keys), `Exams.jsx has catalogue keys for blueprint ${bp.id}`);
  if (!keys) continue;
  eq(en[keys[0]], bp.label, `the English label of ${bp.id} matches the engine`);
  eq(en[keys[1]], bp.releaseNote, `the English release note of ${bp.id} matches the engine`);
}
eq(en['exams.claim.none'], exams.indiaExamClaim(null).reason, 'the no-blueprint claim matches the engine');
for (const [authenticity, key] of [['official-mathematics-section', 'exams.claim.officialSection'], ['official-structure-dynamic-marking', 'exams.claim.officialStructure']]) {
  const bp = blueprints.find(b => b.authenticity === authenticity);
  ok(Boolean(bp), `a blueprint with ${authenticity} exists`);
  if (bp) eq(en[key], exams.indiaExamClaim(bp).reason, `the ${authenticity} claim matches the engine`);
}

const total = pass + failures.length;
if (failures.length) {
  console.error(`I18N COVERAGE: FAIL — ${failures.length}/${total} checks failed`);
  for (const f of failures.slice(0, 200)) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`I18N COVERAGE: PASS — ${pass}/${total} checks — ${scanned} files scanned, 0 hard-coded strings, ${callsChecked} call sites checked for placeholders, ${enKeys.length} keys × ${LANGUAGES.length} languages.`);
