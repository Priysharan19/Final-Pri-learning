#!/usr/bin/env node
// Pri Learning · read out a pre-registered experiment from exported events.
//
//   node tools/experiment-readout.mjs --experiment tutor-first-help-v1 --events events.jsonl [--json]
//
// `events` is an export of the server grader's graded-attempt rows, one JSON
// object per line (or a JSON array): { account_id, occurred_at, payload_json }
// as stored, e.g.
//
//   SELECT account_id, occurred_at, payload_json FROM learning_events
//   WHERE device_id = 'server-grader' AND kind = 'graded-attempt'
//     AND payload_json LIKE '%"experiment"%';
//
// The export holds account ids: keep it on the operator's machine and delete
// it after the readout. The readout itself (server/platform/experimentReadout.js)
// refuses to estimate an effect below the definition's minimum sample, stops on
// an arm-integrity failure or a sample-ratio mismatch, and never names a winner.
// Exit code: 0 for a readout produced (whatever its verdict), 2 for bad input.

import { readFileSync } from 'node:fs';
import { experimentById, validateRegistry } from '../server/platform/experiments.js';
import { readout } from '../server/platform/experimentReadout.js';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const id = flag('experiment');
const file = flag('events');
if (!id || !file) {
  console.error('usage: node tools/experiment-readout.mjs --experiment <id> --events <file.jsonl|file.json> [--json]');
  process.exit(2);
}
const problems = validateRegistry();
if (problems.length) { console.error(`The experiment registry is not valid:\n  ${problems.join('\n  ')}`); process.exit(2); }
const def = experimentById(id);
if (!def) { console.error(`No experiment ${JSON.stringify(id)} is registered.`); process.exit(2); }
const text = readFileSync(file, 'utf8').trim();
let rows;
try { rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map(line => JSON.parse(line)); }
catch (e) { console.error(`Could not read ${file}: ${e.message}`); process.exit(2); }

const r = readout(def, rows);
if (args.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
const pct = v => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
console.log(`${def.id} v${def.version} — ${def.title}`);
console.log(`verdict: ${r.verdict}`);
console.log(r.message);
console.log(`arm integrity: ${r.integrity.mismatchedArms} mismatched event(s)`);
console.log(`sample ratio: chi² ${r.srm.chi2.toFixed(3)}, p ${r.srm.p.toPrecision(3)}${r.srm.mismatch ? '  ← MISMATCH' : ''}`);
for (const [arm, c] of Object.entries(r.counts)) console.log(`  ${arm}: ${c.assigned} accounts, ${c.observedOutcomes} observed outcomes (minimum ${r.minimumPerArm}), ${c.resolvedAttempts} resolved attempts, help asked on ${pct(c.helpRequestRate)}`);
for (const g of r.guardrails) {
  const shown = g.id === 'time-on-task' ? `median ms ${g.control ?? '—'} vs ${g.treatment ?? '—'}` : `reveal share ${pct(g.control)} vs ${pct(g.treatment)}`;
  console.log(`guardrail ${g.id}: ${shown}${g.breached ? '  ← BREACHED' : ''}`);
}
for (const g of r.manualGuardrails) console.log(`guardrail ${g.id}: ${g.note}${g.instrumented ? '' : ' (no product channel yet)'}`);
if (r.primary) {
  const [lo, hi] = r.primary.interval95;
  console.log(`primary (delayed independent different-family success): difference ${pct(r.primary.difference)}, 95% interval [${pct(lo)}, ${pct(hi)}]`);
}
