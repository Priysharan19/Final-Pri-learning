// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · OpenAI strict structured-output schema contract
//
// Every schema the server sends as `{ type: 'json_schema', strict: true }` must
// satisfy OpenAI's strict-mode rules, or the provider rejects the request with a
// 400 before any work is done. This shipped once: TRANSCRIPTION_SCHEMA left
// `latex` out of `lines.items.required`, and every real handwriting request
// failed on staging while the stubbed suites stayed green.
//
// Rules checked recursively (objects, array items, anyOf branches, $defs):
//   · every object declares additionalProperties: false;
//   · every object's `required` is an array naming exactly every key in
//     `properties` (optional fields must be nullable, never omitted).
// The provider sources are also scanned so a new strict schema cannot be sent
// without being registered here.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSCRIPTION_SCHEMA, normalizeResult } from '../platform/handwritingProvider.js';
import { HELP_SCHEMA, CAPTION_SCHEMA } from '../platform/tutorProvider.js';
import { WORKING_SCHEMA } from '../platform/workingProvider.js';

export function strictSchemaViolations(schema, path = '$') {
  const out = [];
  if (!schema || typeof schema !== 'object') return out;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('object') || schema.properties) {
    if (schema.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    const keys = Object.keys(schema.properties || {});
    if (!Array.isArray(schema.required)) {
      out.push(`${path}: required must be an array`);
    } else {
      const req = new Set(schema.required);
      for (const key of keys) if (!req.has(key)) out.push(`${path}: required is missing '${key}'`);
      for (const key of req) if (!keys.includes(key)) out.push(`${path}: required names unknown '${key}'`);
      if (req.size !== schema.required.length) out.push(`${path}: required has duplicates`);
    }
    for (const key of keys) out.push(...strictSchemaViolations(schema.properties[key], `${path}.properties.${key}`));
  }
  if (schema.items) out.push(...strictSchemaViolations(schema.items, `${path}.items`));
  for (const k of ['anyOf', 'oneOf', 'allOf']) {
    (schema[k] || []).forEach((s, i) => out.push(...strictSchemaViolations(s, `${path}.${k}[${i}]`)));
  }
  for (const k of ['$defs', 'definitions']) {
    for (const [name, s] of Object.entries(schema[k] || {})) out.push(...strictSchemaViolations(s, `${path}.${k}.${name}`));
  }
  return out;
}

// The checker itself must catch the exact defect that reached staging.
const broken = {
  type: 'object', additionalProperties: false, required: ['lines'],
  properties: { lines: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['text', 'confidence'],
    properties: { text: { type: 'string' }, latex: { type: 'string' }, confidence: { type: 'number' } }
  } } }
};
assert.deepEqual(strictSchemaViolations(broken), ["$.properties.lines.items: required is missing 'latex'"]);
assert.ok(strictSchemaViolations({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] })
  .some(v => v.includes('additionalProperties')));

const SCHEMAS = {
  pri_handwriting_transcription: TRANSCRIPTION_SCHEMA,
  pri_tutor_help: HELP_SCHEMA,
  pri_tutor_captions: CAPTION_SCHEMA,
  pri_working_check: WORKING_SCHEMA
};
for (const [name, schema] of Object.entries(SCHEMAS)) {
  assert.deepEqual(strictSchemaViolations(schema), [], `${name} violates OpenAI strict json_schema rules`);
}

// Every strict json_schema the providers send must be one registered above.
let sent = 0;
for (const file of ['handwritingProvider.js', 'tutorProvider.js', 'workingProvider.js']) {
  const src = readFileSync(new URL(`../platform/${file}`, import.meta.url), 'utf8');
  for (const m of src.matchAll(/type:\s*'json_schema',\s*name:\s*'([^']+)'/g)) {
    sent += 1;
    assert.ok(m[1] in SCHEMAS, `${file} sends unregistered strict schema '${m[1]}'`);
  }
}
assert.equal(sent, Object.keys(SCHEMAS).length, 'every registered schema is actually sent, and nothing else');

// latex is required; the model is told to send '' when nothing is
// display-worthy, and that must normalise to "no latex", not an empty render.
const r = normalizeResult(
  { lines: [{ text: 'x = 2', latex: '', confidence: 0.9 }], confidence: 0.9, needs_confirmation: false },
  { model: 'stub', confidenceFloor: 0.5 }
);
assert.equal(r.lines[0].latex, null);
assert.equal(r.lines[0].text, 'x = 2');

console.log(`PASS — ${Object.keys(SCHEMAS).length} strict json_schemas satisfy OpenAI strict-mode rules recursively; empty latex normalises to null.`);
