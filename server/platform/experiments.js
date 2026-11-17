// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · pre-registered experiments: definitions, assignment, stamp
//
// An experiment is a JSON definition in server/platform/experiments/, written
// and frozen BEFORE any data is read (EXPERIMENTATION_REPRODUCIBILITY_
// STATISTICAL_GOVERNANCE_V7 §12): hypothesis, arms and weights, unit, primary
// outcome, guardrails, minimum sample, analysis and stopping rule. Its digest
// is pinned in experiments/registry.lock.json; changing a definition without a
// new version fails validation (and the suite), so a definition cannot be
// edited after the fact to fit a result.
//
// OFF BY DEFAULT. Every definition says status "off", and nothing reads that
// as a switch: an experiment runs only when the deployment lists its id in
// PRI_EXPERIMENTS and every server flag it `requires` is on. That is an owner
// decision (a deployment change), never a code change.
//
// ASSIGNMENT. Per account, from a SHA-256 of (salt, account id): stable for an
// account across devices, sessions and restarts, independent between
// experiments (each has its own salt), and recomputable by the readout, which
// checks every logged arm against it. While an experiment is active its arm is
// stamped on each graded-attempt event (intention to treat). With no
// experiment active the stamp is empty and events are byte-for-byte as before.
//
// Nothing here touches a mark, a credit weight or a receipt: the stamp is
// added to the event payload after the mark and credit are computed.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DIR = new URL('./experiments/', import.meta.url);

/** The registered definition files. Adding one is a reviewed change. */
export const EXPERIMENT_FILES = Object.freeze(['aa-assignment-v1.json', 'tutor-first-help-v1.json']);

const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const REQUIRED = ['id', 'version', 'status', 'title', 'preregisteredAt', 'activation', 'requires', 'prerequisites', 'hypothesis', 'unit', 'salt',
  'arms', 'eligibility', 'trigger', 'primaryOutcome', 'guardrails', 'minimumSample', 'analysis', 'limitations', 'claims'];

/** Canonical JSON (keys sorted at every depth), the input of the frozen digest. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const definitionDigest = def => createHash('sha256').update(canonicalJson(def)).digest('hex');

/** Problems with one definition; an empty list means it is well-formed. */
export function validateDefinition(def) {
  const out = [];
  if (!def || typeof def !== 'object' || Array.isArray(def)) return ['definition is not an object'];
  for (const k of REQUIRED) if (!(k in def)) out.push(`missing ${k}`);
  if (!ID.test(String(def.id || ''))) out.push('id is not kebab-case');
  if (!Number.isInteger(def.version) || def.version < 1) out.push('version is not a positive integer');
  if (def.status !== 'off') out.push('status must be "off": activation is the deployment\'s PRI_EXPERIMENTS, never the file');
  if (def.unit !== 'account') out.push('unit must be account');
  if (typeof def.salt !== 'string' || def.salt.length < 8) out.push('salt is missing or short');
  if (!Array.isArray(def.requires) || !def.requires.every(f => /^PRI_[A-Z_]+$/.test(f))) out.push('requires is not a list of PRI_ flags');
  const arms = Array.isArray(def.arms) ? def.arms : [];
  if (arms.length < 2) out.push('fewer than two arms');
  if (new Set(arms.map(a => a?.id)).size !== arms.length || !arms.every(a => /^[a-z][a-z0-9-]{0,31}$/.test(String(a?.id || '')))) out.push('arm ids are missing, malformed or repeated');
  if (!arms.every(a => Number.isFinite(a?.weight) && a.weight > 0)) out.push('every arm needs a positive weight');
  if (Math.abs(arms.reduce((s, a) => s + (Number(a?.weight) || 0), 0) - 1) > 1e-9) out.push('arm weights do not sum to 1');
  const po = def.primaryOutcome || {};
  if (po.id !== 'delayed-independent-transfer') out.push('primary outcome must be delayed-independent-transfer');
  if (!Number.isFinite(po.delayHours) || po.delayHours < 24) out.push('primary outcome delay is under 24 hours');
  const ids = (Array.isArray(def.guardrails) ? def.guardrails : []).map(g => g?.id);
  for (const g of ['time-on-task', 'give-up-rate']) if (!ids.includes(g)) out.push(`guardrail ${g} is missing`);
  if (!Number.isInteger(def.minimumSample?.perArm) || def.minimumSample.perArm < 30) out.push('minimumSample.perArm is missing or below 30');
  for (const k of ['estimand', 'interval', 'srm', 'stoppingRule', 'decision']) if (typeof def.analysis?.[k] !== 'string' || !def.analysis[k]) out.push(`analysis.${k} is missing`);
  if (!Array.isArray(def.limitations) || !def.limitations.length) out.push('limitations are missing');
  return out;
}

let cache = null;
/** Every registered definition, frozen, read once. */
export function experimentDefinitions() {
  if (cache) return cache;
  cache = Object.freeze(EXPERIMENT_FILES.map(f => Object.freeze(JSON.parse(readFileSync(new URL(f, DIR), 'utf8')))));
  return cache;
}
export const experimentById = id => experimentDefinitions().find(d => d.id === id) || null;

/** The frozen digests (registry.lock.json). */
export function lockedDigests() {
  return JSON.parse(readFileSync(new URL('registry.lock.json', DIR), 'utf8')).digests || {};
}

/** Problems across the registry: each definition, its file name, and its frozen digest. */
export function validateRegistry({ definitions = experimentDefinitions(), locked = lockedDigests() } = {}) {
  const out = [];
  const seen = new Set();
  for (const def of definitions) {
    for (const p of validateDefinition(def)) out.push(`${def?.id}: ${p}`);
    if (seen.has(def.id)) out.push(`${def.id}: registered twice`);
    seen.add(def.id);
    const key = `${def.id}@${def.version}`;
    if (!locked[key]) out.push(`${key}: not frozen in registry.lock.json`);
    else if (locked[key] !== definitionDigest(def)) out.push(`${key}: changed after it was frozen — a new version is required`);
  }
  return out;
}

/** The experiments this deployment runs: listed in PRI_EXPERIMENTS and every required flag on. */
export function activeExperiments(env = process.env, definitions = experimentDefinitions()) {
  const listed = new Set(String(env?.PRI_EXPERIMENTS || '').split(',').map(s => s.trim()).filter(Boolean));
  return definitions.filter(d => listed.has(d.id) && d.requires.every(flag => String(env?.[flag] || '').trim() === '1'));
}

/** A number in [0, 1) from (salt, account id). */
export function assignmentPoint(salt, accountId) {
  const h = createHash('sha256').update(`${salt}\u0000${accountId}`).digest();
  return h.readUInt32BE(0) / 2 ** 32;
}

/** The arm of one account in one experiment. Deterministic; null for no account. */
export function assignArm(def, accountId) {
  if (!def || typeof accountId !== 'string' || !accountId) return null;
  const u = assignmentPoint(def.salt, accountId);
  let edge = 0;
  for (const arm of def.arms) {
    edge += arm.weight;
    if (u < edge) return arm.id;
  }
  return def.arms[def.arms.length - 1].id;
}

/** Arm of `accountId` in experiment `id` if it is active here, else null. */
export function activeArm(id, accountId, env = process.env) {
  const def = activeExperiments(env).find(d => d.id === id);
  return def ? assignArm(def, accountId) : null;
}

/**
 * What a graded-attempt event carries while any experiment is active: the
 * account's arm in each, the item family the outcome analysis needs (the
 * generator — the event otherwise carries only an opaque content id), and the
 * device-reported time on the item. Empty with nothing active.
 */
export function experimentStamp(active, accountId, { family = null, ms = null } = {}) {
  if (!Array.isArray(active) || !active.length || typeof accountId !== 'string') return {};
  return {
    experiment: {
      assignments: active.map(def => ({ id: def.id, version: def.version, arm: assignArm(def, accountId) })),
      family: typeof family === 'string' && family ? family : null,
      ms: Number.isSafeInteger(ms) && ms >= 0 ? ms : null
    }
  };
}
