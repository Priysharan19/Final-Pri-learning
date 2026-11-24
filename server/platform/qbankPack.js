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
import { dotpointById, formDotpointOrdinals } from '../../client/src/engine/curriculum.js';
import { productPlaceOf } from './qbankDotpoints.js';
import { withSafeInputHints } from '../../client/src/engine/inputHint.js';

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

// A question with a figure (qbankFigures.js): its text alternative, its size, and the hash and length of the SVG the server will send.
const diagramShapeOk = d => !!d && typeof d === 'object' && isStr(d.alt) && d.alt.length <= 500 && isNum(d.w) && d.w > 0 && isNum(d.h) && d.h > 0 && SHA.test(d.sha256 ?? '') && Number.isInteger(d.bytes) && d.bytes > 0;

/**
 * A WORKED-SOLUTION question (answerType 'manual'): his show-that, prove, explain, sketch and unkeyed "find" parts. It has NO answer and no
 * trap: nothing can mark it. It carries his hints (the ladder), his steps and his criteria (shown only at the reveal), the kind it is, and
 * whether the deterministic step report may give feedback on the student's working (`lineFeedback`).
 */
export const MANUAL_KINDS = Object.freeze(['prove', 'explain', 'sketch', 'find']);
export function manualProblem(q) {
  if (!q || typeof q !== 'object') return 'not an object';
  if (!isStr(q.id) || q.id.length > 60) return 'id';
  if (!PACK_LEVELS.includes(q.level)) return `${q.id}: level`;
  if (!Number.isInteger(q.authored) || q.authored < 1 || q.authored > 6) return `${q.id}: authored difficulty`;
  if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 6) return `${q.id}: marks`;
  if (!isStr(q.dp) || !/^[A-Za-z0-9.]{1,12}$/.test(q.dp)) return `${q.id}: dot point`;
  if (!isStr(q.prompt) || q.prompt.length > 8000) return `${q.id}: prompt`;
  if (q.answerType !== 'manual' || q.answer !== undefined || q.traps !== undefined) return `${q.id}: a worked-solution question has no answer and no trap`;
  if (!MANUAL_KINDS.includes(q.kind)) return `${q.id}: kind`;
  if (typeof q.lineFeedback !== 'boolean') return `${q.id}: lineFeedback`;
  if (!Array.isArray(q.steps) || !q.steps.length || !q.steps.every(s => isStr(s?.h) && isStr(s?.d))) return `${q.id}: steps`;
  if (!Array.isArray(q.hints) || !q.hints.every(isStr) || q.hints.length > 3) return `${q.id}: hints`;
  if (!q.ladder || typeof q.ladder !== 'object' || Array.isArray(q.ladder) || JSON.stringify(['nudge', 'method', 'worked'].slice(0, q.hints.length).map(k => q.ladder[k])) !== JSON.stringify(q.hints) || Object.keys(q.ladder).length !== q.hints.length) return `${q.id}: ladder is not the hints`;
  if (!Array.isArray(q.criteria) || !q.criteria.length || !q.criteria.every(c => Number.isInteger(c?.marks) && c.marks > 0 && isStr(c?.point))) return `${q.id}: criteria`;
  if (q.criteria.reduce((s, c) => s + c.marks, 0) !== q.marks) return `${q.id}: criteria do not add up to the marks`;
  if (q.stepcheck !== undefined && (!q.stepcheck || typeof q.stepcheck !== 'object')) return `${q.id}: stepcheck`;
  if (q.diagram !== undefined && !diagramShapeOk(q.diagram)) return `${q.id}: diagram`;
  return null;
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
  if (q.ladder !== undefined && (!q.ladder || typeof q.ladder !== 'object' || Array.isArray(q.ladder) || !Object.entries(q.ladder).every(([k, v]) => ['nudge', 'method', 'worked'].includes(k) && isStr(v)))) return `${q.id}: ladder`;
  // The hint ladder is the author's hints and nothing else: 0 to 3 of them, each one rung, in his order (tools/qbank-leak.mjs bankLadder).
  if (q.hints.length > 3 || !q.ladder || JSON.stringify(['nudge', 'method', 'worked'].slice(0, q.hints.length).map(k => q.ladder[k])) !== JSON.stringify(q.hints) || Object.keys(q.ladder).length !== q.hints.length) return `${q.id}: ladder is not the hints`;
  if (!Array.isArray(q.traps) || !q.traps.every(t => t && typeof t === 'object' && isStr(t.why))) return `${q.id}: traps`;
  if (!Array.isArray(q.criteria) || !q.criteria.every(c => Number.isInteger(c?.marks) && isStr(c?.point))) return `${q.id}: criteria`;
  if (q.criteria.reduce((s, c) => s + c.marks, 0) !== q.marks) return `${q.id}: criteria do not add up to the marks`;
  if (q.stepcheck !== undefined && (!q.stepcheck || typeof q.stepcheck !== 'object')) return `${q.id}: stepcheck`;
  if (q.diagram !== undefined && !diagramShapeOk(q.diagram)) return `${q.id}: diagram`;
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
    if ((shard.manual?.length ?? 0) !== (entry.manualQuestions ?? 0) || (shard.manual !== undefined && !Array.isArray(shard.manual))) throw new Error(`qbank pack: ${entry.name} holds a different number of worked-solution questions than the manifest says`);
    for (const q of shard.manual ?? []) {
      const problem = manualProblem(q);
      if (problem) throw new Error(`qbank pack: ${entry.name}: ${problem}`);
      if (ids.has(q.id)) throw new Error(`qbank pack: ${q.id} appears twice`);
      ids.add(q.id);
    }
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
  return Object.freeze({ version: manifest.packVersion, families, product: productIndexOf(families), questionCount: [...families.values()].reduce((n, f) => n + f.questions, 0), manualCount: [...families.values()].reduce((n, f) => n + f.manualQuestions, 0), source: source.kind ?? 'custom' });
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
  // The worked-solution questions are kept apart: nothing that reads `byLevel` or `dotpoints` (the picker, the tests that mark every key) sees them.
  const manual = shard.manual ?? [];
  for (const q of manual) FAMILY_OF.set(q, shard.family);
  return Object.freeze({ family: shard.family, course: shard.course, year: shard.year, topic: shard.topic, questions: shard.questions.length, manualQuestions: manual.length, manual, byLevel, dotpoints });
}

/**
 * The picker's view of a set of families: what may be requested, per family and dot point. Stable order. Only families with a MARKED question
 * (a family of worked-solution questions alone, such as Extension 1 induction, is practised through its product subtopic and is not listed here).
 */
export function indexOf(families) {
  return [...families.values()].filter(f => f.questions > 0).sort((a, b) => (a.family < b.family ? -1 : 1)).map(f => ({
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
export const qbankStatus = () => ({ ...status, version: installed?.version ?? null, questions: installed?.questionCount ?? 0, workedSolutions: installed?.manualCount ?? 0 });

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
export const qbankVersion = () => installed?.version ?? null;
export const qbankFamilies = () => (installed ? indexOf(installed.families) : []);
/** Does the loaded pack hold any question practised in this product subtopic? */
export const qbankServes = subtopic => typeof subtopic === 'string' && !!installed?.product.has(subtopic);

/**
 * The product's view of the pack: for each product subtopic, its questions by level (every dot point of it, topic-level ones included)
 * and, for each product dot point a question is numbered to, its questions by level. Where a question sits is qbankDotpoints.js; a dot
 * point of the pack that table does not hold is not practised anywhere (the test holds the committed pack to the table, so none is).
 */
export function productIndexOf(families) {
  const out = new Map();
  for (const fam of families.values()) {
    for (const list of fam.byLevel.values()) {
      for (const entry of list) {
        const place = productPlaceOf(fam.family, entry.dp);
        if (!place) continue;
        const sub = out.get(place.subtopic) || out.set(place.subtopic, { all: new Map(), ordinals: new Map() }).get(place.subtopic);
        sub.all.set(entry.level, [...(sub.all.get(entry.level) || []), entry]);
        if (place.ordinal !== null) {
          const levels = sub.ordinals.get(place.ordinal) || sub.ordinals.set(place.ordinal, new Map()).get(place.ordinal);
          levels.set(entry.level, [...(levels.get(entry.level) || []), entry]);
        }
      }
    }
  }
  // The worked-solution pool of each product subtopic, by level, and by dot point where numbered to one.
  for (const fam of families.values()) {
    for (const entry of fam.manual) {
      const place = productPlaceOf(fam.family, entry.dp);
      if (!place) continue;
      const sub = out.get(place.subtopic) || out.set(place.subtopic, { all: new Map(), ordinals: new Map() }).get(place.subtopic);
      const m = sub.manual || (sub.manual = { all: new Map(), ordinals: new Map() });
      m.all.set(entry.level, [...(m.all.get(entry.level) || []), entry]);
      if (place.ordinal !== null) {
        const levels = m.ordinals.get(place.ordinal) || m.ordinals.set(place.ordinal, new Map()).get(place.ordinal);
        levels.set(entry.level, [...(levels.get(entry.level) || []), entry]);
      }
    }
  }
  for (const sub of out.values()) {
    for (const list of sub.all.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const levels of sub.ordinals.values()) for (const list of levels.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (sub.manual) {
      for (const list of sub.manual.all.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
      for (const levels of sub.manual.ordinals.values()) for (const list of levels.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
    }
  }
  return out;
}

const mix = (a, b) => { let h = (a ^ 0x9e3779b9) >>> 0; for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 0x01000193) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };

/**
 * THE MIX RULE. Where the pack holds questions for the (subtopic or dot point, level) a student asked for, a seed is an authored question's
 * turn for 3 draws in 4 when the pool has six or more questions and 1 in 2 when it has fewer; every other seed is the generators'. The
 * seed alone decides (no clock, no counter), so the same (subtopic, level, dot point, seed) is always the same question. Which question
 * of the pool an authored turn draws is the seed's too. The practice seek (practice.js seekQuestion) then does the rest, exactly as for a
 * generator: it passes over a question the account has resolved or the device has just been served, so an authored question is never
 * served twice while a fresh one can be found, and when the pool has run dry the seek keeps drawing and is answered by a generator.
 */
export const BANK_TURNS = Object.freeze({ large: 3, small: 2, of: 4, largeFrom: 6 });
export const bankTurn = (poolSize, seed, key) => poolSize > 0 && mix((seed ^ 0x51ed270b) >>> 0, `turn|${key}`) % BANK_TURNS.of < (poolSize >= BANK_TURNS.largeFrom ? BANK_TURNS.large : BANK_TURNS.small);

/**
 * The authored question this draw is, or null when the draw is a generator's (no pool, or not the pool's turn). Same arguments as a
 * generator (practice.js calls this first): the product subtopic, the level asked for, the seed, and a product dot point id or null.
 * A dot point asked for is answered by a question numbered to it, at the level asked for, and never by another (the seek checks too).
 */
export function qbankDraw(generator, level, seed, dotpointId = null, exclude = null, { manual = false } = {}) {
  const sub = installed?.product.get(generator);
  if (!sub) return null;
  // A worked-solution question's turn (below) comes first, and only where the caller allows one (never two in a row, never in a timed mode).
  if (manual && sub.manual) {
    const picked = manualDraw(sub.manual, generator, level, seed, dotpointId, exclude);
    if (picked) return picked;
  }
  let pool;
  if (dotpointId != null) {
    const dp = dotpointById(dotpointId);
    if (!dp || dp.subtopic !== generator) return null;
    pool = sub.ordinals.get(dp.ordinal)?.get(level);
  } else pool = sub.all.get(level);
  if (!pool || !pool.length) return null;
  const key = `${generator}|${dotpointId ?? ''}|${level}`;
  if (!bankTurn(pool.length, seed >>> 0, key)) return null;
  // `exclude`: the authored questions a seek has already found stale. The turn is the pool's (so the rule's share is unchanged); the
  // question is one of the rest, and when none is left the turn is the generators'.
  const rest = exclude && exclude.size ? pool.filter(e => !exclude.has(e.id)) : pool;
  if (!rest.length) return null;
  return productQuestion(rest[mix((seed ^ 0x2545f491) >>> 0, `pick|${key}`) % rest.length], generator, seed, dotpointId);
}

/**
 * THE WORKED-SOLUTION MIX RULE. Where the pack holds worked-solution questions for the (subtopic or dot point, level) asked for, 1 seed in 6
 * is one's turn; every other seed goes on to the rule above. The seed alone decides, so the same arguments are the same question. The
 * caller passes `manual: true` only when the last question the account was dealt was not one, and never in a timed or one-try mode, so a
 * student never meets two in a row and never more than about one in six. A pool the seek has used up is the generators' again.
 */
export const MANUAL_TURNS = Object.freeze({ of: 6, turn: 1 });
export const manualTurn = (seed, key) => mix((seed ^ 0x3c6ef372) >>> 0, `manual|${key}`) % MANUAL_TURNS.of < MANUAL_TURNS.turn;
function manualDraw(manualIndex, generator, level, seed, dotpointId, exclude) {
  let pool;
  if (dotpointId != null) {
    const dp = dotpointById(dotpointId);
    if (!dp || dp.subtopic !== generator) return null;
    pool = manualIndex.ordinals.get(dp.ordinal)?.get(level);
  } else pool = manualIndex.all.get(level);
  if (!pool || !pool.length) return null;
  const key = `${generator}|${dotpointId ?? ''}|${level}`;
  if (!manualTurn(seed >>> 0, key)) return null;
  const rest = exclude && exclude.size ? pool.filter(e => !exclude.has(e.id)) : pool;
  if (!rest.length) return null;
  return manualQuestion(rest[mix((seed ^ 0x6a09e667) >>> 0, `pick|${key}`) % rest.length], generator, seed, dotpointId);
}

/** The worked-solution questions of the loaded pack, with where each is practised. For the tests and the isolation check. */
export function qbankManualEntries() {
  const out = [];
  for (const fam of installed?.families.values() ?? []) for (const entry of fam.manual) out.push({ entry, family: fam.family, place: productPlaceOf(fam.family, entry.dp) });
  return out;
}
export function qbankManualQuestion(id, seed = 0) {
  for (const { entry, family, place } of qbankManualEntries()) if (entry.id === id) {
    if (!place) throw new Error(`Worked-solution question ${id} is placed nowhere`);
    return manualQuestion(entry, place.subtopic, seed, null);
  }
  throw new Error(`No worked-solution question ${id}`);
}

/**
 * One worked-solution entry as the practice path issues it. NO `answer`: nothing about it can mark. The prompt, the hints and the figure's
 * description are public; his steps and criteria are held for the reveal.
 */
function manualQuestion(entry, generator, seed, requestedId) {
  const family = FAMILY_OF.get(entry);
  const place = productPlaceOf(family, entry.dp);
  const ids = place.ordinal !== null ? [`${generator}.${place.ordinal + 1}`] : formDotpointOrdinals(generator, entry.level).map(i => `${generator}.${i + 1}`);
  const contentHash = sha256(Buffer.from(JSON.stringify([entry.id, entry.prompt, 'worked']))).slice(0, 16);
  const q = {
    seed, subtopic: generator, difficulty: entry.level,
    prompt: entry.prompt, answerType: 'manual',
    hints: entry.hints, steps: entry.steps,
    ...(entry.diagram ? { diagram: { alt: entry.diagram.alt, w: entry.diagram.w, h: entry.diagram.h } } : {}),
    ...(entry.ladder ? { ladder: entry.ladder } : {}),
    ...(entry.stepcheck ? { stepcheck: entry.stepcheck } : {}),
    dotpoints: ids, dotpoint: ids.length === 1 ? ids[0] : null, dotpointSource: 'qbank',
    contentId: `qbank:${entry.id}`, contentVersion: `qb.${installed.version}`, contentHash,
    // Private to the server: never in PUBLIC_QUESTION_FIELDS. `_worked` says no mark is ever stored or shown for this question.
    authoredMarks: entry.marks, authoredDifficulty: entry.authored, criteria: entry.criteria, _bank: entry.id, _family: family,
    _worked: entry.kind, _lineFeedback: entry.lineFeedback
  };
  if (requestedId != null) { q.dotpointRequested = requestedId; q.dotpointExact = q.dotpoint === requestedId; }
  return q;
}

/** One pack entry as the practice path issues it, whatever seed (tests, the isolation check). Throws when the table places it nowhere. */
export function qbankEntryQuestion(id, seed = 0) {
  for (const fam of installed?.families.values() ?? []) for (const list of fam.byLevel.values()) {
    const e = list.find(x => x.id === id);
    if (!e) continue;
    const place = productPlaceOf(fam.family, e.dp);
    if (!place) throw new Error(`Bank question ${id} is placed nowhere`);
    return productQuestion(e, place.subtopic, seed, null);
  }
  throw new Error(`No bank question ${id}`);
}

/** The pack entries, with the product subtopic and dot point each is practised in. For the tests and the isolation check. */
export function qbankEntries() {
  const out = [];
  for (const fam of installed?.families.values() ?? []) for (const list of fam.byLevel.values()) for (const entry of list) out.push({ entry, family: fam.family, place: productPlaceOf(fam.family, entry.dp) });
  return out;
}

function productQuestion(entry, generator, seed, requestedId) {
  const family = FAMILY_OF.get(entry);
  const place = productPlaceOf(family, entry.dp);
  // A numbered dot point is the question's one dot point. A topic-level one names the dot points its cell exercises, none of them exact,
  // as a generator's cell that names several does (curriculum.js formDotpointOrdinals).
  const ids = place.ordinal !== null ? [`${generator}.${place.ordinal + 1}`] : formDotpointOrdinals(generator, entry.level).map(i => `${generator}.${i + 1}`);
  const contentHash = sha256(Buffer.from(JSON.stringify([entry.id, entry.prompt, entry.answer]))).slice(0, 16);
  const q = {
    seed, subtopic: generator, difficulty: entry.level,
    prompt: entry.prompt, answerType: entry.answerType, answer: entry.answer,
    ...(entry.answerPrefix ? { answerPrefix: entry.answerPrefix } : {}),
    ...(entry.inputHint ? { inputHint: entry.inputHint } : {}),
    ...(entry.traps.length ? { traps: entry.traps } : {}),
    hints: entry.hints, steps: entry.steps,
    // Public: the text alternative and the size. The figure itself is fetched by the account it was issued to (practice.js GET /:id/figure).
    ...(entry.diagram ? { diagram: { alt: entry.diagram.alt, w: entry.diagram.w, h: entry.diagram.h } } : {}),
    // The rungs the importer chose (tools/qbank-leak.mjs): none states the answer, and the worked rung is never the last step.
    ...(entry.ladder ? { ladder: entry.ladder } : {}),
    ...(entry.stepcheck ? { stepcheck: entry.stepcheck } : {}),
    dotpoints: ids, dotpoint: ids.length === 1 ? ids[0] : null, dotpointSource: 'qbank',
    contentId: `qbank:${entry.id}`, contentVersion: `qb.${installed.version}`, contentHash,
    // Private to the server: never in PUBLIC_QUESTION_FIELDS. `_family` is what the marker sees as the question's subtopic
    // (markerOps.js markerView): the bank was audited against the engine under its own family id, so its marking is never that of
    // a generator that happens to share the subtopic.
    authoredMarks: entry.marks, authoredDifficulty: entry.authored, criteria: entry.criteria, _bank: entry.id, _family: family
  };
  if (requestedId != null) { q.dotpointRequested = requestedId; q.dotpointExact = q.dotpoint === requestedId; }
  // The worked solution states a non-integer numeric key as the fraction it is, not as a binary64 decimal (display only: the key and the marking
  // are the author's and untouched).
  if (entry.answerType === 'numeric' && entry.answer.tol === undefined && !Number.isInteger(entry.answer.value)) {
    const fraction = smallFraction(entry.answer.value);
    if (fraction) q.answerDisplay = `${entry.answerPrefix ? entry.answerPrefix + ' ' : ''}${fraction}`;
  }
  // The answer box shows the FORM a set, interval, equation or point is written in, as the generators' own questions do (the author's
  // bank names none). Neutral shapes only; withSafeInputHints drops any that the marker would accept as the answer.
  if (!q.inputHint) {
    const form = FORM_HINTS[entry.answerType]?.(entry.answer);
    if (form) q.inputHint = form;
  }
  return withSafeInputHints(q);
}

/** n/d for a value that is one with a denominator of at most 200 (to 1e-12) and not a short decimal, else null. */
function smallFraction(v) {
  if (!Number.isFinite(v) || Math.abs(v) > 1e6) return null;
  if (Math.abs(v - Number(v.toFixed(4))) < 1e-12) return null;   // a decimal the author wrote (0.25) stays a decimal
  for (let d = 2; d <= 200; d++) { const n = Math.round(v * d); if (Math.abs(v - n / d) < 1e-12 * Math.max(1, Math.abs(v))) { const g = gcd(Math.abs(n), d); return `${n / g}/${d / g}`; } }
  return null;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

const FORM_HINTS = Object.freeze({
  set: () => 'e.g. 2, 5',
  interval: a => `e.g. 1 < ${/^[A-Za-z]$/.test(a.variable) ? a.variable : 'x'} < 4`,
  equation: a => (/^[A-Za-z]$/.test(a.lhs) ? `e.g. ${a.lhs} = 2x + 1` : null),
  point: () => 'e.g. (3, -4)'
});
