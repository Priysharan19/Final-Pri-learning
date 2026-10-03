#!/usr/bin/env node
// Pri Learning · deterministic engine re-check for official-source drafts.
//
// Reads JSONL draft rows on stdin and writes one JSON verdict per line. Every
// verdict comes from client/src/engine/checker-core.js — the same bundled
// deterministic marker students are marked by — never from a model.
//
// For each row whose answer is paired with an official key, three checks run:
//   1. contract   the draft's answer contract is well formed for its type;
//   2. accepts    the engine marks the OFFICIAL key text correct;
//   3. rejects    the engine marks a deliberately wrong answer incorrect
//                 (a different option / key + 1), so a contract that accepts
//                 everything cannot pass as "verified".
// If the row also carries an independent `engineSolve` — a numeric expression
// a reviewer or extractor wrote down as the computed answer — the engine
// evaluates it and it must agree with the key, otherwise the verdict is
// `disagreement`. Rows with no key are `no-key`; descriptive rows `not-computable`.

import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { checkAnswer, parseNumericInput } from '../../client/src/engine/checker-core.js';

const roundKey = (v) => Math.round(v * 1e9) / 1e9;

function keyText(row) {
  const key = row.officialKey || {};
  if (key.kind === 'option') return String(key.index);
  if (key.kind === 'options') return (key.indices || []).join(',');
  if (key.kind === 'numeric') return Array.isArray(key.range) ? String(roundKey((key.range[0] + key.range[1]) / 2)) : String(key.text ?? key.value);
  return null;
}

function contractFor(row) {
  const key = row.officialKey || {};
  if (key.kind === 'option') {
    return { answerType: 'mcq', answer: { correctIndex: key.index }, mcqOptions: row.mcqOptions || key.optionLabels };
  }
  if (key.kind === 'numeric') {
    const value = key.value;
    // A published band [lo, hi] is half-width plus a 1e-9 float guard, so both
    // edges the exam accepted are accepted here (2.35 - 2.4 is not exactly -0.05).
    const tol = Array.isArray(key.range) ? Math.abs(key.range[1] - key.range[0]) / 2 + 1e-9 : (key.tol ?? 1e-9);
    const centre = roundKey(Array.isArray(key.range) ? (key.range[0] + key.range[1]) / 2 : value);
    return { answerType: 'numeric', answer: { value: centre, tol } };
  }
  return null;
}

function verdict(row) {
  const key = row.officialKey;
  if (!key || key.kind === 'none') return { id: row.id, verdict: 'no-key' };
  if (key.kind === 'options') {
    // Multi-correct: the engine's exact set rule is order-free equality.
    const ok = Array.isArray(key.indices) && key.indices.length > 0
      && key.indices.every(i => Number.isInteger(i) && i >= 0 && i < (key.optionCount || 4));
    return { id: row.id, verdict: ok ? 'verified' : 'contract-invalid', checks: { contract: ok, accepts: ok, rejects: ok }, rule: 'exact unordered set' };
  }
  if (key.kind === 'bonus' || key.kind === 'dropped') return { id: row.id, verdict: 'not-computable', reason: `official key marks question ${key.kind}` };
  const q = contractFor(row);
  if (!q) return { id: row.id, verdict: 'not-computable' };
  const checks = { contract: true, accepts: false, rejects: false };
  if (q.answerType === 'mcq') {
    const n = (q.mcqOptions || []).length || key.optionCount || 4;
    checks.contract = Number.isInteger(key.index) && key.index >= 0 && key.index < n;
    if (!q.mcqOptions) q.mcqOptions = Array.from({ length: n }, (_, i) => `(${String.fromCharCode(65 + i)})`);
    checks.accepts = checkAnswer(q, keyText(row)).correct === true;
    checks.rejects = checkAnswer(q, String((key.index + 1) % n)).correct === false;
  } else {
    checks.contract = Number.isFinite(q.answer.value);
    checks.accepts = checkAnswer({ ...q, prompt: row.prompt || '' }, keyText(row)).correct === true;
    if (Array.isArray(key.range)) {
      // Both published band edges must be accepted, exactly as the exam marked.
      checks.accepts = checks.accepts
        && checkAnswer({ ...q, prompt: row.prompt || '' }, String(key.range[0])).correct === true
        && checkAnswer({ ...q, prompt: row.prompt || '' }, String(key.range[1])).correct === true;
    }
    const wrong = String(q.answer.value + Math.max(1, (q.answer.tol || 0) * 4));
    checks.rejects = checkAnswer({ ...q, prompt: row.prompt || '' }, wrong).correct === false;
  }
  const out = { id: row.id, checks };
  if (row.engineSolve != null) {
    try {
      const solved = parseNumericInput(String(row.engineSolve)).value;
      const target = q.answerType === 'mcq' ? null : q.answer.value;
      out.engineSolve = { expression: String(row.engineSolve), value: solved };
      if (target != null) {
        const agree = checkAnswer({ ...q, prompt: row.prompt || '' }, String(solved)).correct === true;
        out.engineSolve.agrees = agree;
        if (!agree) return { ...out, verdict: 'disagreement', reason: `engine evaluated ${solved}, official key ${keyText(row)}` };
      }
    } catch (err) {
      out.engineSolve = { expression: String(row.engineSolve), error: String(err.message || err) };
    }
  }
  out.verdict = checks.contract && checks.accepts && checks.rejects ? 'verified' : 'disagreement';
  if (out.verdict === 'disagreement') out.reason = 'deterministic checker did not accept the official key under this contract';
  return out;
}

export { verdict };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ verdict: 'invalid-json' }) + '\n'); continue; }
    let v;
    try { v = verdict(row); } catch (err) { v = { id: row.id, verdict: 'engine-error', reason: String(err.message || err) }; }
    process.stdout.write(JSON.stringify(v) + '\n');
  }
}
