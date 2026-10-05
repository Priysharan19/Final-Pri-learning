// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the provider adapters are answer-blind — proved on the wire
//
// Handwriting recognition must never be improved with the hidden expected
// answer, and the working checker must never be told where the working is
// supposed to end (AGENTS.md invariants; release ledger task 4.2). The route
// tests next door prove the routes REFUSE a body that names an answer. This
// check proves the stronger thing: that the bytes which actually leave this
// server for the model provider cannot carry one, whatever the caller does.
//
// Method. A question fixture is built whose hidden fields — the expected
// answer, the worked solution, the marks, the marking criteria and the
// misconception labels — are unmistakable canary strings. The fixture is live
// in the test process while every provider call is made, both directly through
// the adapters and end to end through the mounted /v1 routes with a session.
// A recording fetch captures the exact request body each adapter sends. Every
// recorded body is then searched for every canary. The only hidden field that
// may appear anywhere is the question's prompt, and only in the WORKING body,
// because step checking is question-aware by design and the route says so.
//
// Then the static half: the two adapters are read as source and may import
// nothing but the allowlisted modules. A question bank, the curriculum, the
// deterministic checker, the solution generators — none of those may ever be
// reachable from an adapter, so a future edit cannot "helpfully" look the
// answer up on its own.
//
// No network call is made. The canaries are chosen so a substring search is
// exact; the test is deterministic and runs with no API key.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformDb } from '../platform/db.js';
import { createHandwritingRouter } from '../platform/handwriting.js';
import { createWorkingRouter } from '../platform/working.js';
import { transcribeHandwriting } from '../platform/handwritingProvider.js';
import { checkWorkingWithModel } from '../platform/workingProvider.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM = join(HERE, '../platform');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── The fixture: every hidden field is a canary ──────────────────────────────
// Each value is a token that cannot occur by accident in a prompt, a schema, a
// model name or a system instruction. `CANARY_` + the field it stands for.
const QUESTION = Object.freeze({
  id: 'q-canary-0001',
  prompt: 'Solve 2x + 3 = 11. CANARY_PROMPT_7f3a',
  answerType: 'numeric',
  expectedAnswer: 'CANARY_EXPECTED_ANSWER_4b9e',
  expected: 'CANARY_EXPECTED_4b9e',
  answerText: 'x = CANARY_ANSWER_TEXT_1c2d',
  solution: Object.freeze({
    solutionText: 'CANARY_SOLUTION_TEXT_8a1f',
    steps: Object.freeze(['CANARY_STEP_ONE_5e6d', 'CANARY_STEP_TWO_9c0b'])
  }),
  marks: 'CANARY_MARKS_3d7c',
  totalMarks: 2,
  criteria: Object.freeze([{ id: 'c1', text: 'CANARY_CRITERION_6b2a', marks: 1 }]),
  markScheme: 'CANARY_MARK_SCHEME_0e4f',
  misconceptions: Object.freeze([{ id: 'sides-mismatched', label: 'CANARY_MISCONCEPTION_LABEL_2f8d' }]),
  hints: Object.freeze(['CANARY_HINT_7d1e'])
});
/** The strings that may never leave for a provider. */
const HIDDEN_CANARIES = Object.freeze([
  QUESTION.expectedAnswer, QUESTION.expected, 'CANARY_ANSWER_TEXT_1c2d',
  QUESTION.solution.solutionText, ...QUESTION.solution.steps,
  QUESTION.marks, QUESTION.criteria[0].text, QUESTION.markScheme,
  QUESTION.misconceptions[0].label, QUESTION.hints[0]
]);
const PROMPT_CANARY = 'CANARY_PROMPT_7f3a';
ok(HIDDEN_CANARIES.length === 11 && new Set(HIDDEN_CANARIES).size === 11, 'eleven distinct hidden canaries are planted');
// The planted strings really are what the fixture carries (a renamed field
// would otherwise silently take its canary out of the search).
ok(JSON.stringify(QUESTION).split('CANARY_').length - 1 === HIDDEN_CANARIES.length + 1, 'every canary in the fixture is in the search list (plus the prompt)');

// Student ink and working, as a client would send them: nothing from the fixture.
const PNG = 'data:image/png;base64,' + Buffer.from('ink-bytes-'.repeat(60)).toString('base64');
const WORKING_LINES = ['2x + 3 = 11', '2x = 8', 'x = 4'];

const env = {
  PRI_HANDWRITING_API_KEY: 'test-key-not-real',
  PRI_HANDWRITING_MODEL: 'test-primary',
  PRI_HANDWRITING_FALLBACK_MODEL: 'test-fallback',
  PRI_WORKING_MODEL: 'test-working',
  PRI_PAID_CALLS_PER_HOUR: '10000',
  PRI_PAID_CALLS_PER_DAY: '100000'
};

// ── A recording provider: every body that would reach the model ─────────────
const wire = [];   // { via, kind, url, headers, body (string) }
function recorder(via) {
  return async (url, init) => {
    const body = String(init?.body ?? '');
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const kind = parsed?.text?.format?.name === 'pri_handwriting_transcription' ? 'transcription'
      : parsed?.text?.format?.name ? 'working' : 'unknown';
    wire.push({ via, kind, url: String(url), headers: { ...(init?.headers || {}) }, body });
    const reply = kind === 'transcription'
      ? { lines: [{ text: '2x = 8', latex: '2x = 8', confidence: 0.97 }], confidence: 0.97, needs_confirmation: false }
      : {
          lines: WORKING_LINES.map((_, index) => ({ index, status: 'ok', carried: false, why: '' })),
          first_break: -1, hint: '', confidence: 0.9, misconception_id: null, needs_confirmation: false
        };
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify(reply) }) };
  };
}

// ── 1 · Directly through the adapters ────────────────────────────────────────
// The fixture is in scope and in memory; the adapters are handed exactly what
// production hands them: an image, and a prompt plus lines.
const direct = await transcribeHandwriting(PNG, { env, fetchImpl: recorder('adapter') });
eq(direct.text, '2x = 8', 'the transcription adapter answers from the stub');
const directWorking = await checkWorkingWithModel(QUESTION.prompt, WORKING_LINES, { env, fetchImpl: recorder('adapter') });
ok(directWorking && Array.isArray(directWorking.lines), 'the working adapter answers from the stub');

// ── 2 · End to end through the mounted routes, with a session ────────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-canary', 'canary@example.test', 'Canary', 'student', now, now, now);
db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
  VALUES (?,?,?,?,?,?,?,?)`).run('ses-canary', 'acct-canary', sha256('raw-canary'), 'ipad', null, now, now, now + 86400000);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
// The real adapters, with only the network swapped for the recorder, so the
// body the route builds is the body the provider would receive.
app.use('/handwriting', createHandwritingRouter(db, {
  env,
  transcribe: (image, options) => transcribeHandwriting(image, { ...options, env, fetchImpl: recorder('route') })
}));
app.use('/working', createWorkingRouter(db, {
  env,
  check: (prompt, lines, options) => checkWorkingWithModel(prompt, lines, { ...options, env, fetchImpl: recorder('route') })
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const post = async (path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-canary` },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

try {
  const read = await post('/handwriting/transcribe', { image: PNG });
  eq(read.status, 200, 'the handwriting route reads the ink');
  const checked = await post('/working/check', { prompt: QUESTION.prompt, lines: WORKING_LINES });
  eq(checked.status, 200, 'the working route checks the lines');

  // A caller that tries to hand the whole question over is refused before any
  // provider call: the wire count must not move.
  const before = wire.length;
  const leakyRead = await post('/handwriting/transcribe', { image: PNG, expectedAnswer: QUESTION.expectedAnswer, marks: QUESTION.marks });
  eq([leakyRead.status, leakyRead.json?.error?.code], [400, 'HANDWRITING_NOT_ANSWER_BLIND'], 'a transcription body naming the answer is refused');
  const leakyCheck = await post('/working/check', { prompt: QUESTION.prompt, lines: WORKING_LINES, solution: QUESTION.solution.solutionText, criteria: QUESTION.criteria });
  eq([leakyCheck.status, leakyCheck.json?.error?.code], [400, 'WORKING_NOT_ANSWER_BLIND'], 'a working body naming the solution or criteria is refused');
  const wholeQuestion = await post('/handwriting/transcribe', { image: PNG, question: QUESTION });
  eq(wholeQuestion.status, 400, 'the whole question object is refused as a transcription field');
  eq(wire.length, before, 'and none of the refused bodies reached the provider');
} finally {
  await new Promise(resolve => server.close(resolve));
}

// ── 3 · Search every recorded body for every canary ──────────────────────────
eq(wire.map(w => `${w.via}:${w.kind}`).sort(), ['adapter:transcription', 'adapter:working', 'route:transcription', 'route:working'],
  'four provider bodies were recorded: both adapters, directly and through their routes');
for (const sent of wire) {
  const where = `${sent.via} ${sent.kind}`;
  for (const canary of HIDDEN_CANARIES) {
    ok(!sent.body.includes(canary), `${where}: the provider body carries ${canary}`);
  }
  ok(!JSON.stringify(sent.headers).includes('CANARY_'), `${where}: no canary travels in a header`);
  ok(!sent.url.includes('CANARY_'), `${where}: no canary travels in the URL`);
  // Field names, not only values: a request must not even have a slot for them.
  const parsed = JSON.parse(sent.body);
  const keys = new Set();
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); }
  })(parsed);
  for (const forbidden of ['expected', 'expectedAnswer', 'answer', 'answerText', 'solution', 'solutionText', 'steps', 'marks', 'markScheme', 'criteria', 'misconceptions', 'hints']) {
    ok(!keys.has(forbidden), `${where}: the provider body has a "${forbidden}" field`);
  }
  if (sent.kind === 'transcription') {
    ok(!sent.body.includes(PROMPT_CANARY), `${where}: transcription is question-blind too — the prompt never travels`);
    ok(sent.body.includes(PNG), `${where}: the picture of the ink is what travels`);
  } else {
    ok(sent.body.includes(PROMPT_CANARY), `${where}: step checking sends the question, by design`);
    ok(WORKING_LINES.every(line => sent.body.includes(line)), `${where}: and the student's own lines`);
  }
}

// ── 4 · Static: the adapters cannot reach a question module ─────────────────
// What each adapter is allowed to import. Anything else — a bank, the
// curriculum, a checker, a generator, content, the database — is a way for an
// adapter to learn the answer on its own and is refused by name.
const IMPORT_ALLOWLIST = Object.freeze({
  'handwritingProvider.js': [],
  'workingProvider.js': ['./misconceptionIds.js']
});
const QUESTION_MODULE = /(question|answer|solution|content|curriculum|generator|checker|engine|marking|bank|syllabus|misconceptions\.js|store\.js|db\.js|sync)/i;
const importsOf = source => [...source.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]);
for (const [file, allowed] of Object.entries(IMPORT_ALLOWLIST)) {
  const source = readFileSync(join(PLATFORM, file), 'utf8');
  const imports = importsOf(source);
  eq(imports, allowed, `${file} imports exactly its allowlist`);
  for (const spec of imports) ok(!QUESTION_MODULE.test(spec) || allowed.includes(spec), `${file}: import "${spec}" is not a question/answer module`);
  ok(!/\bimport\s*\(/.test(source), `${file}: no dynamic import() that a static allowlist could not see`);
  ok(!/\brequire\s*\(/.test(source), `${file}: no require() either`);
  ok(!/\b(expectedAnswer|markScheme|solutionText|correctAnswer)\b/.test(source), `${file}: never names an expected-answer field`);
}
// The one allowed import is an ID list for the schema enum, not a label table:
// nothing in it can describe a particular question.
const idsSource = readFileSync(join(PLATFORM, 'misconceptionIds.js'), 'utf8');
eq(importsOf(idsSource), [], 'misconceptionIds.js is a leaf module');
ok(!/label|explanation|detector|prompt/i.test(idsSource.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')),
  'misconceptionIds.js carries ids only — no labels, explanations or detectors');

// The scanner itself is exercised on a known-bad fixture so a regression in the
// import parser cannot pass vacuously.
const badAdapter = "import { questionById } from './content.js';\nimport { sha256 } from './security.js';\nconst x = await import('./store.js');";
eq(importsOf(badAdapter), ['./content.js', './security.js'], 'the import parser reads static imports');
ok(QUESTION_MODULE.test('./content.js') && /\bimport\s*\(/.test(badAdapter), 'and the scanner would refuse a content import and a dynamic import');

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.log(`PROVIDER ANSWER-BLIND: FAIL — ${pass}/${pass + failures.length} checks`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`PROVIDER ANSWER-BLIND: PASS — ${pass}/${pass} checks — ${wire.length} provider bodies recorded, ${HIDDEN_CANARIES.length} planted canaries absent from every one, adapters import only their allowlist.`);
