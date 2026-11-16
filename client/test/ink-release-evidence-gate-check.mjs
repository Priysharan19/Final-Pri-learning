// Regression check for Gate C (client/test/ink-release-evidence-gate.mjs),
// re-based on the server reader.
//
// Every corpus and record written here is SYNTHETIC and lives in a temporary
// directory: it proves the gate passes a sufficient, writer-disjoint,
// committed-corpus record of the server reader and refuses everything else.
// Nothing here is evidence about any reader.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'ink-release-evidence-gate.mjs');

const WRITERS = 20;
const SAMPLES = 50;
const FLOOR = 0.82;

const writerId = w => `T${String(w + 1).padStart(4, '0')}`;
const targetFor = (w, i) => {
  const n = w * SAMPLES + i;
  // ≥ 200 critical-structure prompts (a relation or a power) among 1000.
  if (n % 4 === 0) return `x^(2)=${n + 1}`;
  if (n % 4 === 1) return `${n + 1}x+3=${2 * n + 5}`;
  return `${n + 1}`;
};
const strokesFor = (w, i) => [{ points: [{ x: w + 1, y: i + 1, t: 0 }, { x: w + 2.5, y: i + 3.5, t: 0.02 }, { x: w + 4, y: i + 1.25, t: 0.04 }] }];

function corpusFile(w, { split = 'test', pen = true } = {}) {
  return {
    format: 'pri-ink-corpus', version: 2, split,
    writer: { id: writerId(w), sessionId: `S${w}`, pen: true, device: 'fixture' },
    samples: Array.from({ length: SAMPLES }, (_, i) => ({ target: targetFor(w, i), pen, strokes: strokesFor(w, i) }))
  };
}

function evalRecord(files, { wrong = new Set(), lowConfidence = new Set(), split = 'test', evidenceClass = 'real-human', providerKind = 'openai', rows = true, errors = new Set() } = {}) {
  const allRows = [];
  for (let w = 0; w < WRITERS; w++) {
    for (let i = 0; i < SAMPLES; i++) {
      const n = w * SAMPLES + i;
      const want = targetFor(w, i);
      allRows.push({
        writer: writerId(w), file: files[w], index: i, pen: true,
        want, got: wrong.has(n) ? `${want}9` : want,
        confidence: lowConfidence.has(n) ? 0.6 : 0.95, needsConfirmation: lowConfidence.has(n),
        engine: 'cloud-fixture', latencyMs: 1500, error: errors.has(n) ? 'HANDWRITING_TIMEOUT' : null
      });
    }
  }
  const record = {
    format: 'pri-cloud-reader-eval', version: 1, evidenceClass, measuredAt: '2026-11-02T00:00:00.000Z',
    provider: { kind: providerKind, primaryModel: 'fixture-model', confidenceFloor: FLOOR },
    corpus: { dir: 'client/test/ink-corpus', split, writers: WRITERS, files, samples: allRows.length, pencilOnly: true },
    results: { lines: allRows.length }
  };
  if (rows) record.rows = allRows;
  return record;
}

function scenario(name, { corpus = w => corpusFile(w), record = files => evalRecord(files), extraCorpus = [], records = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), `pri-gate-c-${name}-`));
  const corpusDir = join(root, 'corpus');
  const evalDir = join(root, 'eval');
  mkdirSync(corpusDir); mkdirSync(evalDir);
  const files = [];
  for (let w = 0; w < WRITERS; w++) {
    const file = `pri-real-ink-${writerId(w)}.json`;
    files.push(file);
    writeFileSync(join(corpusDir, file), JSON.stringify(corpus(w)));
  }
  for (const [file, body] of extraCorpus) writeFileSync(join(corpusDir, file), JSON.stringify(body));
  const list = records ? records(files) : [['2026-11-02.json', record(files)]];
  for (const [file, body] of list) if (body) writeFileSync(join(evalDir, file), JSON.stringify(body));
  const r = spawnSync(process.execPath, [GATE, '--corpus', corpusDir, '--eval-dir', evalDir], { encoding: 'utf8' });
  rmSync(root, { recursive: true, force: true });
  return r;
}

let passed = 0;
const expect = (label, r, { status, pattern }) => {
  const ok = r.status === status && (!pattern || pattern.test(r.stdout));
  if (ok) { passed++; return; }
  console.log(`FAIL ${label}\n--- status ${r.status}\n${r.stdout}\n${r.stderr}`);
  process.exit(1);
};

// A complete record of the server reader on a sufficient test corpus passes.
expect('sufficient, exact, writer-disjoint record passes', scenario('pass'), { status: 0, pattern: /REAL-WRITER RELEASE EVIDENCE — PASS \(measurable Gate C subset, server reader\)/ });
const pass = scenario('pass-figures');
assert.match(pass.stdout, /test writers: 20/);
assert.match(pass.stdout, /scored test expressions: 1000/);
assert.match(pass.stdout, /exact expression accuracy: 100\.00%/);
assert.match(pass.stdout, /safe-auto precision: 100\.000% \(1000\/1000/);
assert.match(pass.stdout, /critical-structure exact: 100\.00% \(500\/500\)/);
passed++;

// Mutations: each floor and refusal must bite on its own.
expect('no record → FAIL', scenario('none', { records: () => [] }), { status: 1, pattern: /no server-reader evaluation of the test split/ });
expect('a dry run is refused and never scored', scenario('dry', { record: files => evalRecord(files, { evidenceClass: 'synthetic-dry-run', providerKind: 'FAKE — pipeline test only' }) }), { status: 1, pattern: /may not live under the real-human evaluation directory[\s\S]*no server-reader evaluation/ });
expect('a train-split record does not stand in for the test split', scenario('train', { record: files => evalRecord(files, { split: 'train' }) }), { status: 1, pattern: /no server-reader evaluation of the test split/ });
expect('a summary-only record cannot be re-scored', scenario('rows', { record: files => evalRecord(files, { rows: false }) }), { status: 1, pattern: /carries no per-sample rows/ });
expect('21 misreads in 1000 fail the 98% exact floor', scenario('exact', { record: files => evalRecord(files, { wrong: new Set(Array.from({ length: 21 }, (_, i) => i * 7 + 2)) }) }), { status: 1, pattern: /exact 97\.90% < 98\.0%/ });
expect('20 misreads in 1000 are inside the exact floor but a wrong confident read fails safe-auto precision', scenario('safe', { record: files => evalRecord(files, { wrong: new Set([2, 3]) }) }), { status: 1, pattern: /safe-auto precision 99\.800% < 99\.9%/ });
expect('a wrong read the server flagged for confirmation does not count against safe-auto precision', scenario('flagged', { record: files => evalRecord(files, { wrong: new Set([2]), lowConfidence: new Set([2]) }) }), { status: 1, pattern: /safe-auto precision: 100\.000% \(999\/999[\s\S]*requires >=1000 reads the server declared safe; measured 999/ });
expect('a provider error counts as a misread, never as a dropped sample', scenario('error', { record: files => evalRecord(files, { errors: new Set(Array.from({ length: 21 }, (_, i) => i)) }) }), { status: 1, pattern: /21 provider error\(s\), counted as misreads[\s\S]*exact 97\.90%/ });
expect('a record scoring a writer outside the test split is refused', scenario('leak', { corpus: w => corpusFile(w, { split: w === 0 ? 'validation' : 'test' }) }), { status: 1, pattern: /row 0 is by writer "T0001", who is not a committed test-split writer/ });
expect('a record whose prompt differs from the committed sample is refused', scenario('prompt', { record: files => { const r = evalRecord(files); r.rows[5].want = '999=999'; r.rows[5].got = '999=999'; return r; } }), { status: 1, pattern: /target "999=999" differs from the committed sample/ });
expect('a partial run is not release evidence', scenario('partial', { record: files => { const r = evalRecord(files); r.rows = r.rows.slice(0, 990); return r; } }), { status: 1, pattern: /scores 990 of the 1000 committed test expressions/ });
expect('a record about files the corpus does not hold is refused', scenario('files', { record: files => { const r = evalRecord(files); r.corpus.files = [...files, 'pri-real-ink-GHOST.json']; return r; } }), { status: 1, pattern: /pri-real-ink-GHOST\.json, which is not a committed corpus file/ });
expect('a non-Pencil sample is refused', scenario('pen', { corpus: w => corpusFile(w, { pen: w !== 3 }) }), { status: 1, pattern: /50 scored test expression\(s\) are not Pencil-labelled/ });
expect('derived ink in the corpus is refused', scenario('dup', { extraCorpus: [['pri-real-ink-COPY.json', { ...corpusFile(2), writer: { id: 'T9999', pen: true } }]] }), { status: 1, pattern: /duplicate\/derived ink detected/ });
expect('the newest test-split record is the one scored', scenario('newest', { records: files => [['2026-10-01.json', { ...evalRecord(files, { wrong: new Set([1, 2, 3]) }), measuredAt: '2026-10-01T00:00:00.000Z' }], ['2026-11-02.json', evalRecord(files)]] }), { status: 0, pattern: /evaluation record: 2026-11-02\.json/ });

console.log(`INK RELEASE EVIDENCE GATE (server reader) — PASS — ${passed} scenarios`);
