// Pri Learning: the author question bank, served from a compiled CONTENT PACK that lives outside this repository.
//
// The owner has said the bank may be public (24 November 2026), so the compiled pack is committed under server/content/qbank/ and is the
// default source. It is SERVER-SIDE ONLY: no client code imports it and no build copies it into client/dist (tools/qbank-isolation-check.mjs
// fails the build if either happens). PRI_QBANK_DIR names another pack directory; PRI_QBANK_DIR=off turns the bank off. Only a Prithagoras
// server loads it: on any other edition there is no bank, no family, no curriculum entry, and every path is exactly what it was.
//
// A pack is  manifest.json + index.json + shards/<family>.json  (format pri-qbank-pack-v1). The manifest carries the sha256 and size
// of the index and of every shard and the pack version (a digest of those), so a changed or damaged file is refused at load, whole:
// a pack either loads completely or the bank does not exist (qbankStatus() says why).
//
// The loader reads through ONE small interface, a PACK SOURCE: `read(name) -> Promise<Buffer | null>`. The directory source is the only
// one today; a database or object store can replace it by implementing the same function, with no change to issuance or marking.
//
// What the pack is, to the rest of the server: a set of BANK FAMILIES, one per course and topic (`qb-a11-ma-f1`), each a pool of
// authored questions. A family is drawn exactly as a generator is: the practice path asks for (family, level, seed, dot point) and gets a
// question object of the generator's shape, sealed at issue like any other (editionBanks.sealForEdition). Prithagoras only (the edition
// policy decides; this module knows no edition). Nothing here marks anything: the engine's checkAnswer decides, as ever.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverEdition } from './edition.js';
import { LEGACY_CROSSWALK, NSW_OUTCOME_BY_CODE, NSW_SYLLABUS_BY_ID } from '../../client/src/engine/curriculum-nsw/index.js';
import { dotpointsFor } from '../../client/src/engine/curriculum.js';

/** The committed pack: server content, never reachable from the client. */
export const DEFAULT_PACK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'qbank');
export const PACK_FORMAT = 'pri-qbank-pack-v1';
export const PACK_AUTO_TYPES = Object.freeze(['numeric', 'expression', 'set', 'interval', 'equation', 'point']);
/** The question a student may be asked at, in the product's own levels (the author's 5 and 6 are level 4; his number is kept as `authored`). */
export const PACK_LEVELS = Object.freeze([1, 2, 3, 4]);
const FAMILY = /^qb-[a-z]1[12]-m[ae]-[a-z]+[0-9]$/;
const SHARD_NAME = /^shards\/qb-[a-z0-9-]{3,40}\.json$/;
const SHA = /^[0-9a-f]{64}$/;

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/** A pack source over a directory. Reads inside it only: a name with a parent or absolute part is refused. */
export function directorySource(dir) {
  const root = path.resolve(dir);
  return {
    kind: 'directory',
    async read(name) {
      if (typeof name !== 'string' || name.includes('..') || path.isAbsolute(name)) return null;
      const file = path.join(root, name);
      if (!file.startsWith(root + path.sep)) return null;
      try { return await fs.promises.readFile(file); } catch { return null; }
    }
  };
}

const isStr = v => typeof v === 'string' && v.length > 0;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function keyShapeOk(type, a) {
  switch (type) {
    case 'numeric': return isNum(a?.value) && (a.tol === undefined || (isNum(a.tol) && a.tol >= 0));
    case 'expression': return isStr(a?.expr);
    case 'set': return Array.isArray(a?.values) && a.values.length > 0 && a.values.every(isNum);
    case 'interval': return isStr(a?.region) && isStr(a?.variable);
    case 'equation': return isStr(a?.lhs) && isStr(a?.rhs);
    case 'point': return isNum(a?.x) && isNum(a?.y);
    default: return false;
  }
}

/** Why one pack question is not well formed, or null. The loader refuses the whole pack on the first. */
export function questionProblem(q, family) {
  if (!q || typeof q !== 'object') return 'not an object';
  if (!isStr(q.id) || q.id.length > 60) return 'id';
  if (!PACK_LEVELS.includes(q.level)) return `${q.id}: level`;
  if (!Number.isInteger(q.authored) || q.authored < 1 || q.authored > 6) return `${q.id}: authored difficulty`;
  if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 6) return `${q.id}: marks`;
  if (!isStr(q.dp) || !/^[A-Za-z0-9.]{1,12}$/.test(q.dp)) return `${q.id}: dot point`;
  if (!isStr(q.prompt) || q.prompt.length > 8000) return `${q.id}: prompt`;
  if (!PACK_AUTO_TYPES.includes(q.answerType) || !keyShapeOk(q.answerType, q.answer)) return `${q.id}: answer`;
  if (!Array.isArray(q.steps) || !q.steps.every(s => isStr(s?.h) && isStr(s?.d))) return `${q.id}: steps`;
  if (!Array.isArray(q.hints) || !q.hints.every(isStr)) return `${q.id}: hints`;
  if (!Array.isArray(q.traps) || !q.traps.every(t => t && typeof t === 'object' && isStr(t.why))) return `${q.id}: traps`;
  if (!Array.isArray(q.criteria) || !q.criteria.every(c => Number.isInteger(c?.marks) && isStr(c?.point))) return `${q.id}: criteria`;
  if (q.criteria.reduce((s, c) => s + c.marks, 0) !== q.marks) return `${q.id}: criteria do not add up to the marks`;
  if (q.stepcheck !== undefined && (!q.stepcheck || typeof q.stepcheck !== 'object')) return `${q.id}: stepcheck`;
  return null;
}

/**
 * Load a pack from a source. Returns a pack object, or throws an Error whose message says why the pack is refused
 * (missing or malformed manifest, a hash or size that is not the manifest's, a malformed question, a repeated id, an index that
 * disagrees with the shards). Nothing partial is ever returned.
 */
export async function loadPack(source) {
  const bytes = await source.read('manifest.json');
  if (!bytes) throw new Error('qbank pack: no manifest.json');
  let manifest;
  try { manifest = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('qbank pack: manifest.json is not JSON'); }
  if (manifest?.format !== PACK_FORMAT) throw new Error(`qbank pack: format is not ${PACK_FORMAT}`);
  if (!isStr(manifest.packVersion) || !/^[0-9a-f]{12}$/.test(manifest.packVersion)) throw new Error('qbank pack: bad pack version');
  if (!Array.isArray(manifest.shards) || !manifest.shards.length || !manifest.index || !SHA.test(manifest.index.sha256 ?? '')) throw new Error('qbank pack: manifest lists no shards or no index');
  const read = async (entry, label) => {
    const buf = await source.read(entry.name);
    if (!buf) throw new Error(`qbank pack: ${label} is missing`);
    if (buf.length !== entry.bytes || sha256(buf) !== entry.sha256) throw new Error(`qbank pack: ${label} does not match the manifest`);
    return buf;
  };
  const indexBuf = await read({ name: 'index.json', ...manifest.index }, 'index.json');
  // The pack version is a digest of what it holds: a manifest that names a version its files do not make is refused.
  const expectVersion = sha256(Buffer.from([manifest.index.sha256, ...manifest.shards.map(s => `${s.name}:${s.sha256}`)].join('\n'))).slice(0, 12);
  if (expectVersion !== manifest.packVersion) throw new Error('qbank pack: pack version is not the digest of its files');
  let index;
  try { index = JSON.parse(indexBuf.toString('utf8')); } catch { throw new Error('qbank pack: index.json is not JSON'); }
  const families = new Map();
  const ids = new Set();
  for (const entry of manifest.shards) {
    if (!SHARD_NAME.test(entry.name ?? '') || !SHA.test(entry.sha256 ?? '') || !Number.isInteger(entry.bytes)) throw new Error('qbank pack: a shard entry is malformed');
    const shardBuf = await read(entry, entry.name);
    let shard;
    try { shard = JSON.parse(shardBuf.toString('utf8')); } catch { throw new Error(`qbank pack: ${entry.name} is not JSON`); }
    if (!FAMILY.test(shard?.family ?? '') || entry.name !== `shards/${shard.family}.json` || families.has(shard.family)) throw new Error(`qbank pack: ${entry.name} names a bad or repeated family`);
    if (!isStr(shard.topic) || ![11, 12].includes(shard.year) || !['ADV', 'EXT1'].includes(shard.course) || shard.family !== `qb-${shard.course === 'ADV' ? 'a' : 'x'}${shard.year}-${shard.topic.toLowerCase()}`) throw new Error(`qbank pack: ${entry.name} is malformed`);
    if (!Array.isArray(shard.questions) || shard.questions.length !== entry.questions) throw new Error(`qbank pack: ${entry.name} holds a different number of questions than the manifest says`);
    for (const q of shard.questions) {
      const problem = questionProblem(q, shard.family);
      if (problem) throw new Error(`qbank pack: ${entry.name}: ${problem}`);
      if (ids.has(q.id)) throw new Error(`qbank pack: ${q.id} appears twice`);
      ids.add(q.id);
    }
    families.set(shard.family, buildFamily(shard));
  }
  // The index is the picker's view (what may be asked for); it must say exactly what the shards hold.
  const fromShards = JSON.stringify(indexOf(families));
  if (JSON.stringify(index.families) !== fromShards) throw new Error('qbank pack: index.json does not match the shards');
  return Object.freeze({ version: manifest.packVersion, families, questionCount: ids.size, source: source.kind ?? 'custom' });
}

const FAMILY_OF = new WeakMap();
export function buildFamily(shard) {
  for (const q of shard.questions) FAMILY_OF.set(q, shard.family);
  const dotpoints = new Map();
  for (const q of shard.questions) {
    const id = `${shard.family}.${q.dp}`;
    if (!dotpoints.has(id)) dotpoints.set(id, { id, code: q.dp, levels: new Map() });
    const levels = dotpoints.get(id).levels;
    levels.set(q.level, [...(levels.get(q.level) || []), q]);
  }
  const byLevel = new Map();
  for (const q of shard.questions) byLevel.set(q.level, [...(byLevel.get(q.level) || []), q]);
  for (const list of byLevel.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const dp of dotpoints.values()) for (const list of dp.levels.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
  return Object.freeze({ family: shard.family, course: shard.course, year: shard.year, topic: shard.topic, questions: shard.questions.length, byLevel, dotpoints });
}

/** The picker's view of a set of families: what may be requested, per family and dot point. Stable order. */
export function indexOf(families) {
  return [...families.values()].sort((a, b) => (a.family < b.family ? -1 : 1)).map(f => ({
    family: f.family, course: f.course, year: f.year, topic: f.topic, questions: f.questions,
    requestable: [...f.byLevel.keys()].sort((a, b) => a - b),
    dotpoints: [...f.dotpoints.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map(dp => ({ id: dp.id, code: dp.code, requestable: [...dp.levels.keys()].sort((a, b) => a - b) }))
  }));
}

// ── The installed pack (process wide) ────────────────────────────────────────
let installed = null;
let status = { configured: false, loaded: false, error: null };
let loading = null;

/** Install a loaded pack (tests, and the env loader below). */
export function installPack(pack) { installed = pack; status = { configured: true, loaded: !!pack, error: null }; }
/** Remove the installed pack and forget any load: the bank does not exist. */
export function resetQbank() { installed = null; loading = null; status = { configured: false, loaded: false, error: null }; }
export const qbankStatus = () => ({ ...status, version: installed?.version ?? null, questions: installed?.questionCount ?? 0 });

/** Where the pack is read from: PRI_QBANK_DIR, else the committed pack; null when the bank is off (PRI_QBANK_DIR=off) or this is not Prithagoras. */
export function packDirFor(env = process.env) {
  if (serverEdition(env) !== 'prithagoras') return null;
  const dir = String(env.PRI_QBANK_DIR ?? '').trim();
  if (dir.toLowerCase() === 'off') return null;
  if (dir) return dir;
  return fs.existsSync(path.join(DEFAULT_PACK_DIR, 'manifest.json')) ? DEFAULT_PACK_DIR : null;
}

/**
 * Load the pack once. On a Prithagoras server that is the one PRI_QBANK_DIR names or, by default, the committed pack; with
 * PRI_QBANK_DIR=off, or on any other edition, nothing happens and the bank does not exist. A pack that is refused leaves no bank and
 * `qbankStatus().error` says why; `strict` makes that an exception, which is what the server's start-up asks for, so a deployment with a
 * damaged pack fails to start instead of silently serving none.
 */
export function ensureQbank(env = process.env, { strict = false, source = null } = {}) {
  const dir = source ? null : packDirFor(env);
  if (!source && !dir) return Promise.resolve(null);
  if (!loading) {
    status = { configured: true, loaded: false, error: null };
    loading = loadPack(source ?? directorySource(dir)).then(pack => { installed = pack; status = { configured: true, loaded: true, error: null }; return pack; })
      .catch(error => { installed = null; status = { configured: true, loaded: false, error: String(error?.message ?? error) }; if (strict) throw error; return null; });
  } else if (strict) {
    return loading.then(pack => { if (!pack) throw new Error(status.error || 'qbank pack not loaded'); return pack; });
  }
  return loading;
}

// ── What the rest of the server asks ─────────────────────────────────────────
export const isQbankFamily = id => typeof id === 'string' && !!installed && installed.families.has(id);
export const qbankVersion = () => installed?.version ?? null;
export const qbankFamilies = () => (installed ? indexOf(installed.families) : []);

const mix = (a, b) => { let h = (a ^ 0x9e3779b9) >>> 0; for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 0x01000193) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };

/**
 * One question of a family, drawn the way a generator draws one: the same (family, level, seed, dot point) is always the same question.
 * `dotpointId` is `<family>.<code>`; a dot point or level with no question throws, as a generator with no such form does. Returns a
 * question object of the generator's shape plus the sealed private fields (`criteria`, `authoredMarks`).
 */
export function qbankGenerate(family, level, seed, dotpointId = null) {
  const fam = installed?.families.get(family);
  if (!fam) throw new Error(`No question bank ${family}`);
  let pool;
  if (dotpointId != null) {
    const dp = fam.dotpoints.get(dotpointId);
    if (!dp) throw new Error(`No dot point ${dotpointId} in ${family}`);
    pool = dp.levels.get(level);
  } else pool = fam.byLevel.get(level);
  if (!pool || !pool.length) throw new Error(`No question of ${family} at level ${level}`);
  return questionOf(pool[mix(seed >>> 0, `${family}|${dotpointId ?? ''}|${level}`) % pool.length], seed, dotpointId);
}

/** The question object of one pack entry (see qbankGenerate). Tests and the isolation check use it to visit every question. */
export function qbankEntryQuestion(id, seed = 0) {
  for (const fam of installed?.families.values() ?? []) for (const list of fam.byLevel.values()) { const e = list.find(x => x.id === id); if (e) return questionOf(e, seed, null); }
  throw new Error(`No bank question ${id}`);
}

function questionOf(entry, seed, dotpointId) {
  const family = FAMILY_OF.get(entry);
  const level = entry.level;
  const dpId = `${family}.${entry.dp}`;
  const contentHash = sha256(Buffer.from(JSON.stringify([entry.id, entry.prompt, entry.answer]))).slice(0, 16);
  const q = {
    seed, subtopic: family, difficulty: level,
    prompt: entry.prompt, answerType: entry.answerType, answer: entry.answer,
    ...(entry.answerPrefix ? { answerPrefix: entry.answerPrefix } : {}),
    ...(entry.inputHint ? { inputHint: entry.inputHint } : {}),
    ...(entry.traps.length ? { traps: entry.traps } : {}),
    hints: entry.hints, steps: entry.steps,
    ...(entry.stepcheck ? { stepcheck: entry.stepcheck } : {}),
    dotpoints: [dpId], dotpoint: dpId, dotpointSource: 'qbank',
    contentId: `qbank:${entry.id}`, contentVersion: `qb.${installed.version}`, contentHash,
    // Private to the server: never in PUBLIC_QUESTION_FIELDS.
    authoredMarks: entry.marks, authoredDifficulty: entry.authored, criteria: entry.criteria, _bank: entry.id
  };
  if (dotpointId != null) { q.dotpointRequested = dotpointId; q.dotpointExact = true; }
  return q;
}

// ── Curriculum identity (ADR-0002 decision 7) ────────────────────────────────
// The outcome codes the crosswalk locates a TOPIC at: the codes of every dot point of the registry whose topic code is this one
// (a composite code such as MA-C3/C4 counts for each). "Located at" is the crosswalk's claim, never that the question covers the outcome.
let topicCodes = null;
function outcomesOfTopic(topic) {
  if (!topicCodes) {
    topicCodes = new Map();
    for (const row of LEGACY_CROSSWALK) {
      if (row.status !== 'mapped') continue;
      for (const dp of dotpointsFor(row.subtopicId)) {
        const pieces = String(dp.code).split('/');
        // A composite code names its second topic without the prefix: MA-C3/C4 is MA-C3 and MA-C4.
        for (const part of pieces.map((x, i) => (i > 0 && !x.includes('-') ? `${pieces[0].split('-')[0]}-${x}` : x))) {
          const set = topicCodes.get(part) || topicCodes.set(part, new Set()).get(part);
          for (const code of row.dotpoints[dp.ordinal] || []) if (Object.hasOwn(NSW_OUTCOME_BY_CODE, code)) set.add(code);
        }
      }
    }
  }
  return [...(topicCodes.get(topic) || [])].sort();
}
export const qbankTopicOutcomes = outcomesOfTopic;

/** The identity sealed with a bank question, or null (then it is not issued). */
export function qbankIdentity(q) {
  const fam = installed?.families.get(q?.subtopic);
  if (!fam || typeof q?._bank !== 'string') return null;
  const codes = outcomesOfTopic(fam.topic);
  if (!codes.length) return null;
  const outcomes = codes.map(code => ({ code, syllabus: NSW_OUTCOME_BY_CODE[code].syllabus, syllabusVersion: NSW_SYLLABUS_BY_ID[NSW_OUTCOME_BY_CODE[code].syllabus]?.version ?? null }));
  const want = fam.course === 'EXT1' ? 'extension1-11-12' : 'advanced-11-12';
  const owner = outcomes.find(o => String(o.syllabus).includes(want)) || outcomes[0];
  return {
    jurisdiction: NSW_SYLLABUS_BY_ID[owner.syllabus].jurisdiction,
    authority: NSW_SYLLABUS_BY_ID[owner.syllabus].authority,
    syllabus: owner.syllabus, syllabusVersion: owner.syllabusVersion, labelledSyllabus: owner.syllabus,
    outcomes, dotpoints: [...(q.dotpoints || [])], exact: true
  };
}

/** May this bank question be issued? (A bank question has its final answer by construction; the loader refused any that had none.) */
export const qbankAdmits = q => !!q && typeof q._bank === 'string' && qbankIdentity(q) !== null;

/**
 * What the curriculum response adds for the loaded pack, under ONE new key (`authorBank`) and nothing else: the generators' own entries
 * (`subtopics`, each outcome's `practice`) are exactly what they were, so what the device and the suites hold for them stays true. Each
 * family says what may be requested (levels, dot points and their levels) and the outcome codes its topic is located at. No question text.
 * Null when no pack is loaded.
 */
export function qbankCurriculum() {
  if (!installed) return null;
  return {
    version: installed.version, questions: installed.questionCount,
    families: indexOf(installed.families).map(f => ({ ...f, outcomes: outcomesOfTopic(f.topic) }))
  };
}
