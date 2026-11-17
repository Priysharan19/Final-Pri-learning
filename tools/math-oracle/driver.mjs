#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Mathematical intelligence lab · SymPy differential oracle
// Node side: the only part of the lab that touches the deterministic engine.
//
//   node tools/math-oracle/driver.mjs dump --draws=2 --out=questions.jsonl
//   node tools/math-oracle/driver.mjs mark --in=candidates.jsonl --out=verdicts.jsonl
//
// `dump` draws seeded questions from every authored generator bank of both
// editions (Priyabhata · India and Prithagoras · NSW) and writes the answer key
// each one carries. `mark` re-draws the same questions by (generator,
// difficulty, seed) and records the engine's own verdict — checkAnswer() from
// client/src/engine/checker.js, exactly as the server calls it — for every
// candidate answer the Python oracle wrote.
//
// This is offline tooling. It never runs in the server or the client, and no
// verdict it records is used to set a mark: the oracle measures the engine, the
// engine stays the authority (AGENTS.md: the AI proposes, the engine decides).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [mode, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));

const { generateQuestion, loadAllBanks, GENERATORS, bankOf } = await import(join(ROOT, 'client/src/engine/generators/index.js'));
const { checkAnswer } = await import(join(ROOT, 'client/src/engine/checker.js'));
await loadAllBanks();

/** The edition a bank is written for. India banks are Priyabhata; the NSW year/stream banks are Prithagoras. */
export function editionOf(bank) {
  const b = String(bank || '');
  if (b.startsWith('india') || b.startsWith('jee') || b.startsWith('pyq')) return 'priyabhata';
  if (/^(year\d+|streams-)/.test(b)) return 'prithagoras';
  return 'unknown';
}

// The answer types whose truth is a mathematical value SymPy can decide. MCQ
// (an option index), working (a derivation) and the structured forms are
// measured by their own suites and are counted here as out of scope.
const IN_SCOPE = new Set(['numeric', 'expression', 'set', 'point']);
const KEY_FIELDS = ['value', 'tol', 'simplestFraction', 'surdForm', 'requireExact', 'requireFraction', 'canonicalInput',
  'percent', 'rounding', 'angle', 'forbid', 'expr', 'anyOf', 'domain', 'positiveOnly', 'stripC', 'strictDomain', 'values', 'x', 'y'];

const qid = (id, d, seed) => `${id}|${d}|${seed}`;

function draw(id, d, seed) {
  try { return generateQuestion(id, d, seed); } catch { return null; }
}

if (mode === 'dump') {
  const draws = Math.max(1, Number(args.draws) || 2);
  const out = resolve(typeof args.out === 'string' ? args.out : 'questions.jsonl');
  const lines = [];
  const skipped = {};
  for (const id of Object.keys(GENERATORS).sort()) {
    const bank = bankOf(id);
    for (let d = 1; d <= 4; d++) {
      for (let seed = 1; seed <= draws; seed++) {
        const s = 7000 * d + seed;                     // fixed, and disjoint from engine-benchmark's 1000·d + k
        const q = draw(id, d, s);
        if (!q) continue;
        const type = q.multipart ? 'multipart' : q.answerType;
        if (!IN_SCOPE.has(type)) { skipped[type] = (skipped[type] || 0) + 1; continue; }
        const key = {};
        for (const f of KEY_FIELDS) if (q.answer && q.answer[f] !== undefined) key[f] = q.answer[f];
        lines.push(JSON.stringify({ qid: qid(id, d, s), id, d, seed: s, bank, edition: editionOf(bank), type, key, suffix: q.answerSuffix ?? null }));
      }
    }
  }
  writeFileSync(out, lines.join('\n') + '\n');
  writeFileSync(out.replace(/\.jsonl$/, '') + '.skipped.json', JSON.stringify(skipped, null, 2));
  console.error(`dump: ${lines.length} in-scope questions → ${out}; out of scope by type: ${JSON.stringify(skipped)}`);
} else if (mode === 'mark') {
  const inp = resolve(String(args.in));
  const out = resolve(typeof args.out === 'string' ? args.out : 'verdicts.jsonl');
  const cache = new Map();
  const lines = [];
  for (const raw of readFileSync(inp, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const c = JSON.parse(raw);
    if (!cache.has(c.qid)) { const [id, d, seed] = c.qid.split('|'); cache.set(c.qid, draw(id, Number(d), Number(seed))); }
    const q = cache.get(c.qid);
    let r;
    try { r = q ? checkAnswer(q, c.input) : { correct: false, invalid: true, feedback: 'question not reproducible' }; }
    catch (err) { r = { correct: false, invalid: true, feedback: `engine threw: ${err?.message}` }; }
    lines.push(JSON.stringify({ cid: c.cid, correct: r.correct === true, invalid: r.invalid === true, feedback: r.feedback ?? null, slip: r.slip ?? null }));
  }
  writeFileSync(out, lines.join('\n') + '\n');
  console.error(`mark: ${lines.length} verdicts → ${out}`);
} else {
  console.error('usage: driver.mjs dump --draws=N --out=questions.jsonl | mark --in=candidates.jsonl --out=verdicts.jsonl');
  process.exit(2);
}
