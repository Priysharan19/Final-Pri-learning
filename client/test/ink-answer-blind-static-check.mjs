// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink · answer-blind static check
//
// The recogniser honours ctx.expected (recognizer.js, CTX_EXPECT) so that the
// context-leash regression tests can prove a correct expected answer never
// rewrites a wrong reading. That capability must stay a TEST capability: no
// production caller may hand the recogniser, the hybrid fuser, the native
// consensus or the cloud reader an expected answer, a solution, a mark scheme,
// or a whole question object.
//
// This check parses every file under client/src except client/src/ink/ (the
// engine itself) and fails when:
//   - a recognition context (the `recognitionContext` prop/key, or the context
//     argument of a direct engine call) contains an object key outside the
//     public allowlist, a spread (`...question`), a member access to a hidden
//     field (`question.answer`), or a forbidden identifier;
//   - a whole object (question/item/...) is passed as the context;
//   - <InkAnswer> receives a prop outside its declared contract;
//   - the server /v1/handwriting route has lost its FORBIDDEN_FIELDS list or
//     stops refusing bodies that carry them.
//
// The analyser is exercised on known-bad fixtures first so a scanner regression
// cannot pass vacuously.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const SRC = join(ROOT, 'client/src');
const EXCLUDED_DIRS = [join(SRC, 'ink')];

/** Public, answer-blind context keys a production caller may set. */
export const ALLOWED_CONTEXT_KEYS = Object.freeze(['answerType', 'singleGlyphAlphabet']);
/** Public question fields a context expression may read. */
export const ALLOWED_MEMBERS = Object.freeze(['answerType']);
/** Props InkAnswer accepts. A new prop is a new channel into the engine: review it here. */
export const INK_ANSWER_PROPS = Object.freeze([
  'key', 'onRecognized', 'onReaderState', 'onStrokes', 'initialStrokes', 'height', 'disabled',
  'lineVerdicts', 'focusSymbol', 'recognitionContext'
]);
/** Identifiers that must never appear inside a recognition-context expression. */
export const FORBIDDEN_IDENTIFIERS = Object.freeze([
  'expected', 'expectedAnswer', 'expectedAnswers', 'expectedText', 'answer', 'answers', 'answerText',
  'solution', 'solutions', 'steps', 'marks', 'markScheme', 'marking', 'criteria', 'rubric',
  'correct', 'correctAnswer', 'hint', 'hints', 'tokens', 'alphabet', 'prompt', 'questionText'
]);
/** Objects that are the question (or carry it) and must never be the context. */
const QUESTION_LIKE = /^(question|item|q|problem|card|attempt|submission|exercise|task|props)$/;
/** Engine entry points and the index of their context argument. */
/** The cloud readers take transport options, not a recognition context; only these keys may appear there. */
const CLOUD_OPTION_KEYS = Object.freeze(['user', 'signal', 'timeoutMs', 'requestId']);
const ENGINE_CALLS = Object.freeze({
  recognize: { index: 2 },
  fuseNativeStrokeReading: { index: 3 },
  chooseNativeConsensus: { index: 1 },
  foundationRecognize: { index: 1 },
  readWithCloud: { index: 1, allowedKeys: CLOUD_OPTION_KEYS },
  readPhotoWithCloud: { index: 1, allowedKeys: CLOUD_OPTION_KEYS }
});
const ENGINE_MODULE = /\/ink\/(recognizer|hybrid|nativeConsensus|cloudReader|native)\.js['"]/;
const CONTEXT_NAMES = ['recognitionContext', 'inkContext', 'recognitionCtx'];
const REACT_HOOKS = new Set(['useMemo', 'useCallback', 'useState', 'useRef']);

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── tiny source helpers (no parser dependency; the shapes we accept are small) ─
function balanced(source, start, open, close) {
  // source[start] must be `open`; returns the index just past the matching close.
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

function splitArgs(inner) {
  const args = [];
  let depth = 0, quote = null, cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) { cur += ch; if (ch === '\\') { cur += inner[++i] ?? ''; continue; } if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** Body of a same-file helper: `const name = ...;` or `function name(...) {...}`. */
function helperBody(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = source.match(new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\s*=`));
  if (m) {
    const start = m.index + m[0].length;
    let i = start, depth = 0, quote = null;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if ((ch === ';' || ch === '\n') && depth === 0) break;
    }
    return source.slice(start, i);
  }
  m = source.match(new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\s*\\(`));
  if (m) {
    const paren = m.index + m[0].length - 1;
    const afterParams = balanced(source, paren, '(', ')');
    const brace = source.indexOf('{', afterParams);
    if (brace < 0) return null;
    const end = balanced(source, brace, '{', '}');
    return source.slice(paren, end);
  }
  return null;
}

/**
 * Analyse one recognition-context expression. Returns a list of problems.
 * `source` is the whole file so same-file helpers can be followed (depth 3).
 */
export function analyseContextExpression(expr, source, depth = 0, seen = new Set(), allowedKeys = ALLOWED_CONTEXT_KEYS) {
  const problems = [];
  const text = stripComments(String(expr)).trim();
  if (!text || text === 'null' || text === 'undefined') return problems;

  if (/\.\.\./.test(text)) problems.push(`spread inside a recognition context: ${text.slice(0, 80)}`);

  for (const m of text.matchAll(/\??\.\s*([A-Za-z_$][\w$]*)/g)) {
    const member = m[1];
    if (FORBIDDEN_IDENTIFIERS.includes(member)) problems.push(`reads hidden field .${member}`);
  }
  for (const m of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*:(?!:)/g)) {
    const key = m[1];
    // `a ? b : c` is not a key; a key is preceded by `{` or `,`.
    const before = text.slice(0, m.index).replace(/\s+$/, '');
    if (!/[{,]$/.test(before)) continue;
    if (!allowedKeys.includes(key)) problems.push(`context key "${key}" is not in the public allowlist [${allowedKeys.join(', ')}]`);
  }
  for (const m of text.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\b/g)) {
    const ident = m[2];
    if (FORBIDDEN_IDENTIFIERS.includes(ident)) problems.push(`forbidden identifier "${ident}" in a recognition context`);
  }

  // A bare identifier (optionally called) as the whole context: follow it.
  const bare = text.match(/^([A-Za-z_$][\w$]*)(\s*\((.*)\))?$/s);
  if (bare && REACT_HOOKS.has(bare[1]) && bare[3] !== undefined) {
    // useMemo(() => expr, [deps]): the context is what the factory returns.
    const factory = splitArgs(bare[3])[0] || '';
    const body = factory.replace(/^\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/, '').replace(/^\(([\s\S]*)\)$/, '$1').trim();
    problems.push(...analyseContextExpression(body, source, depth + 1, seen, allowedKeys));
    return [...new Set(problems)];
  }
  if (bare) {
    const name = bare[1];
    if (QUESTION_LIKE.test(name)) {
      problems.push(`the whole "${name}" object is passed as the recognition context`);
      return problems;
    }
    if (depth < 3 && !seen.has(name)) {
      seen.add(name);
      const body = helperBody(source, name);
      if (body === null) problems.push(`"${name}" is not defined in this file; a recognition context must be built from public fields where it is used`);
      else problems.push(...analyseContextExpression(body, source, depth + 1, seen, allowedKeys));
    }
  } else {
    // Object literal / conditional: question-like roots may only be read via allowed members.
    for (const m of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\??\.\s*([A-Za-z_$][\w$]*)/g)) {
      if (QUESTION_LIKE.test(m[1]) && !ALLOWED_MEMBERS.includes(m[2])) {
        problems.push(`reads ${m[1]}.${m[2]}; only [${ALLOWED_MEMBERS.join(', ')}] may feed the recogniser`);
      }
    }
    // Question-like object as a value inside the literal (e.g. { answerType: 'numeric', q })
    for (const m of text.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g)) {
      if (QUESTION_LIKE.test(m[1])) problems.push(`shorthand property "${m[1]}" puts the question into the context`);
    }
    for (const m of text.matchAll(/:\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g)) {
      if (QUESTION_LIKE.test(m[1])) problems.push(`"${m[1]}" is nested inside the recognition context`);
    }
  }
  return [...new Set(problems)];
}

/** Every recognition-context expression a file hands toward the engine. */
export function contextExpressionsIn(source) {
  const out = [];
  const src = stripComments(source);

  // JSX prop: recognitionContext={...}
  const consumed = [];
  for (const name of CONTEXT_NAMES) {
    const re = new RegExp(`\\b${name}\\s*=\\s*\\{`, 'g');
    for (const m of src.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const end = balanced(src, open, '{', '}');
      if (end > 0) { out.push({ kind: `prop ${name}`, expr: src.slice(open + 1, end - 1) }); consumed.push([m.index, end]); }
    }
    // object key / assignment: recognitionContext: expr  |  const recognitionContext = expr
    const re2 = new RegExp(`\\b${name}\\s*[:=](?!=)\\s*`, 'g');
    for (const m of src.matchAll(re2)) {
      if (consumed.some(([a, b]) => m.index >= a && m.index < b)) continue;
      const start = m.index + m[0].length;
      let expr;
      if (src[start] === '{') {
        const end = balanced(src, start, '{', '}');
        expr = end > 0 ? src.slice(start, end) : null;
      } else {
        const call = src.slice(start).match(/^[A-Za-z_$][\w$]*\s*\(/);
        if (call) {
          const end = balanced(src, start + call[0].length - 1, '(', ')');
          expr = end > 0 ? src.slice(start, end) : null;
        } else {
          const rest = src.slice(start);
          const stop = rest.search(/[;\n]/);
          expr = (stop < 0 ? rest : rest.slice(0, stop)).replace(/,\s*$/, '').trim();
        }
      }
      if (expr && !/^[A-Za-z_$][\w$]*\s*=/.test(expr)) out.push({ kind: `key ${name}`, expr });
    }
  }

  // Direct engine calls, only in files that import an engine module or use nativeInk.
  const importsEngine = ENGINE_MODULE.test(src) || /\bnativeInk\b/.test(src);
  if (importsEngine) {
    for (const [fn, { index: argIndex, allowedKeys }] of Object.entries(ENGINE_CALLS)) {
      const re = new RegExp(`(?<![\\w$.])(?:nativeInk\\.)?${fn}\\s*\\(`, 'g');
      for (const m of src.matchAll(re)) {
        const open = m.index + m[0].length - 1;
        const end = balanced(src, open, '(', ')');
        if (end < 0) continue;
        const args = splitArgs(src.slice(open + 1, end - 1));
        if (args[argIndex] !== undefined) out.push({ kind: `call ${fn} arg[${argIndex}]`, expr: args[argIndex], allowedKeys });
        // Every argument must stay free of the hidden fields, whatever position.
        for (const [i, a] of args.entries()) {
          if (i !== argIndex && (/\.\s*(expected|answer|solution|marks|steps)\b/.test(a) || /\.\.\.\s*(question|item|q)\b/.test(a))) {
            out.push({ kind: `call ${fn} arg[${i}]`, expr: a });
          }
        }
      }
    }
  }
  return out;
}

/** <InkAnswer ...> prop names. */
export function inkAnswerProps(source) {
  const found = [];
  const src = stripComments(source);
  for (const m of src.matchAll(/<InkAnswer\b/g)) {
    const end = balanced(src, src.indexOf('<', m.index) , '<', '>');
    if (end < 0) continue;
    const tag = src.slice(m.index, end);
    const propNames = [];
    let i = '<InkAnswer'.length;
    while (i < tag.length) {
      const pm = tag.slice(i).match(/^\s*([A-Za-z_$][\w$-]*)\s*(=|(?=[\s/>]))/);
      if (!pm) break;
      propNames.push(pm[1]);
      i += pm[0].length;
      if (pm[2] === '=') {
        const vs = tag[i];
        if (vs === '{') i = balanced(tag, i, '{', '}');
        else if (vs === '"' || vs === "'") { const close = tag.indexOf(vs, i + 1); i = close < 0 ? tag.length : close + 1; }
        else break;
        if (i < 0) break;
      }
    }
    found.push(propNames);
  }
  return found;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (EXCLUDED_DIRS.some(ex => full === ex || full.startsWith(ex + '/'))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs|tsx?)$/.test(name)) out.push(full);
  }
  return out;
}

// ── 1 · the analyser catches known leaks ─────────────────────────────────────
const BAD = [
  ['recognitionContext={{ expected: question.answer }}', /hidden field|allowlist|forbidden/],
  ['recognitionContext={{ answerType: question.answerType, ...question }}', /spread/],
  ['recognitionContext={question}', /whole "question" object/],
  ['recognitionContext={{ answerType: q.answerType, solution: q.solution }}', /solution/],
  ['recognitionContext={{ answerType: item.answerType, marks: item.marks }}', /marks/],
  ['recognitionContext={{ answerType: item.answerType, item }}', /shorthand property "item"/],
  ['recognitionContext={{ answerType: item.answerType, meta: item }}', /nested inside|allowlist/],
  ['recognitionContext={{ tokens: expectedTokens(question) }}', /tokens|forbidden/],
  ['recognitionContext={{ answerType: question.kind }}', /question\.kind/],
  ['recognitionContext={buildContext(question)}', /not defined in this file/]
];
for (const [snippet, expect] of BAD) {
  const exprs = contextExpressionsIn(`export default function X({ question }) { return <InkAnswer ${snippet} />; }`);
  ok(exprs.length === 1, `fixture extracted: ${snippet}`);
  const problems = exprs.flatMap(e => analyseContextExpression(e.expr, snippet));
  ok(problems.some(p => expect.test(p)), `fixture rejected (${expect}): ${snippet} → ${JSON.stringify(problems)}`);
}
const helperLeak = `
const ctxFor = question => ({ answerType: question.answerType, expected: question.answer });
export default function X({ question }) { return <InkAnswer recognitionContext={ctxFor(question)} />; }`;
{
  const exprs = contextExpressionsIn(helperLeak);
  const problems = exprs.flatMap(e => analyseContextExpression(e.expr, helperLeak));
  ok(problems.some(p => /hidden field \.answer|allowlist/.test(p)), `fixture: leak through a same-file helper is followed → ${JSON.stringify(problems)}`);
}
{
  const callLeak = `import { recognize } from '../ink/recognizer.js';\nconst r = recognize(strokes, {}, { expected: question.answer });`;
  const exprs = contextExpressionsIn(callLeak);
  ok(exprs.length >= 1, 'fixture: direct recognize() call context extracted');
  ok(exprs.some(e => analyseContextExpression(e.expr, callLeak).length > 0), 'fixture: recognize(..., { expected }) rejected');
}
{
  const consensusLeak = `import { chooseNativeConsensus } from '../ink/nativeConsensus.js';\nconst c = chooseNativeConsensus(cands, { answerType: 'numeric', solution: item.solution });`;
  const exprs = contextExpressionsIn(consensusLeak);
  ok(exprs.some(e => analyseContextExpression(e.expr, consensusLeak).length > 0), 'fixture: chooseNativeConsensus(..., { solution }) rejected');
}
{
  const cloudLeak = `import { readWithCloud } from '../ink/cloudReader.js';\nreadWithCloud(strokes, { user, expected: question.answer });`;
  const exprs = contextExpressionsIn(cloudLeak);
  ok(exprs.some(e => analyseContextExpression(e.expr, cloudLeak).length > 0), 'fixture: readWithCloud(..., { expected }) rejected');
}
// and accepts the two production shapes
const GOOD = [
  `const ALPHA = Array.from({ length: 10 }, (_, i) => String(i));
   const recognitionContextForQuestion = question => question?.answerType === 'numeric' ? { answerType: 'numeric', singleGlyphAlphabet: ALPHA } : null;
   export default function X({ question }) { return <InkAnswer recognitionContext={recognitionContextForQuestion(question)} />; }`,
  `export default function X({ item }) { return <InkAnswer recognitionContext={item.answerType === 'numeric' ? { answerType: 'numeric', singleGlyphAlphabet: ALPHA } : null} />; }`,
  `export default function X() { return <InkAnswer recognitionContext={null} />; }`
];
for (const snippet of GOOD) {
  const exprs = contextExpressionsIn(snippet);
  ok(exprs.length === 1, 'good fixture extracted');
  const problems = exprs.flatMap(e => analyseContextExpression(e.expr, snippet));
  ok(problems.length === 0, `good fixture accepted → ${JSON.stringify(problems)}`);
}
ok(inkAnswerProps('<InkAnswer key={k} question={question} onRecognized={f} />')[0].includes('question'), 'fixture: InkAnswer prop names parsed');
{
  const cloudOk = `import { readPhotoWithCloud } from '../ink/cloudReader.js';\nreadPhotoWithCloud(dataUrl, { user: user, signal: ctrl.signal });`;
  const sites = contextExpressionsIn(cloudOk);
  ok(sites.length === 1 && analyseContextExpression(sites[0].expr, cloudOk, 0, new Set(), sites[0].allowedKeys).length === 0, 'fixture: cloud transport options {user, signal} accepted');
  const cloudBad = `import { readPhotoWithCloud } from '../ink/cloudReader.js';\nreadPhotoWithCloud(dataUrl, { user, question: question });`;
  const bad = contextExpressionsIn(cloudBad);
  ok(bad.length === 1 && analyseContextExpression(bad[0].expr, cloudBad, 0, new Set(), bad[0].allowedKeys).length > 0, 'fixture: cloud options carrying the question refused');
}

// ── 2 · the real tree ────────────────────────────────────────────────────────
const files = walk(SRC);
ok(files.length > 50, `scanned ${files.length} files under client/src (excluding client/src/ink/)`);
let contextSites = 0;
let inkAnswerSites = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const site of contextExpressionsIn(source)) {
    contextSites++;
    const problems = analyseContextExpression(site.expr, source, 0, new Set(), site.allowedKeys || ALLOWED_CONTEXT_KEYS);
    ok(problems.length === 0, `${rel} · ${site.kind}: ${problems.join('; ')} ← ${site.expr.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
  for (const props of inkAnswerProps(source)) {
    inkAnswerSites++;
    const unknown = props.filter(p => !INK_ANSWER_PROPS.includes(p));
    ok(unknown.length === 0, `${rel}: <InkAnswer> receives undeclared prop(s) ${unknown.join(', ')}; review the channel into the engine before allowing it`);
  }
}
ok(contextSites >= 2, `found ${contextSites} recognition-context site(s) in production code (QuestionCard, ExamRoom expected)`);
ok(inkAnswerSites >= 3, `found ${inkAnswerSites} <InkAnswer> mount(s)`);

// The engine's own gateway must keep the prop name this check scans for.
const inkAnswerSource = readFileSync(join(SRC, 'ink/InkAnswer.jsx'), 'utf8');
ok(/export default function InkAnswer\(\{[^)]*\brecognitionContext\b/.test(inkAnswerSource), 'InkAnswer still receives its context through the `recognitionContext` prop (the name this check scans)');
const declared = inkAnswerSource.match(/export default function InkAnswer\(\{([^}]*)\}/)?.[1] || '';
const declaredProps = declared.split(',').map(s => s.trim().split(/\s*=/)[0]).filter(Boolean);
for (const p of declaredProps) ok(INK_ANSWER_PROPS.includes(p), `InkAnswer declares prop "${p}" which this check does not know; add it here after reviewing it is answer-blind`);

// ── 3 · the server route stays answer-blind ──────────────────────────────────
const handwritingSource = readFileSync(join(ROOT, 'server/platform/handwriting.js'), 'utf8');
ok(/export const FORBIDDEN_FIELDS = Object\.freeze\(\[/.test(handwritingSource), 'server/platform/handwriting.js exports a frozen FORBIDDEN_FIELDS list');
const { FORBIDDEN_FIELDS, validateRequestBody } = await import('../../server/platform/handwriting.js');
for (const field of ['prompt', 'question', 'questionText', 'expected', 'expectedAnswer', 'answer', 'answerText', 'solution', 'steps', 'marks', 'criteria', 'profile', 'screenshot']) {
  ok(FORBIDDEN_FIELDS.includes(field), `FORBIDDEN_FIELDS still refuses "${field}"`);
}
ok(Object.isFrozen(FORBIDDEN_FIELDS), 'FORBIDDEN_FIELDS is frozen');
for (const field of ['expected', 'answer', 'solution', 'marks']) {
  const verdict = validateRequestBody({ image: 'data:image/png;base64,AAAA', [field]: 'x' });
  ok(verdict.ok === false && verdict.code === 'HANDWRITING_NOT_ANSWER_BLIND', `a body carrying "${field}" is refused with HANDWRITING_NOT_ANSWER_BLIND`);
}
ok(validateRequestBody({ image: 'data:image/png;base64,AAAA', requestId: 'r1' }).ok === true, 'an image-only body is accepted');

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.log(`INK ANSWER-BLIND STATIC: FAIL — ${pass}/${pass + failures.length} checks`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`INK ANSWER-BLIND STATIC: PASS — ${pass}/${pass} checks — ${files.length} files scanned, ${contextSites} context sites, ${inkAnswerSites} InkAnswer mounts`);
