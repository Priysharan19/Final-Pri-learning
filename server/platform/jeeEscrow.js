// Answer-private JEE question lane (#395).
//
// The JEE question department's client shards (pack.py) carry answers and
// worked steps, so they can never hold a question whose answer must stay
// private. This lane is the other path: the public source holds the question
// only, and the answer lives in an escrow file that exists only on the server,
// named by PRI_JEE_ESCROW_PATH and kept outside the repository.
//
// The lane fails closed. A question is issuable only when its escrow entry
// exists, is bound to the exact public text by hash, has cleared rights
// evidence recorded by a person, has a person's maths review, and carries a
// keyed answer the deterministic engine can mark. Anything else is an honest
// "unavailable" with a reason; it never falls back to another question.
//
// Nothing here marks an answer. serverQuestion() builds the server's own
// question object, which the existing marker pool marks like any other issued
// question. A model never sets a mark.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

// The only fields a student device ever receives from this lane.
export const ESCROW_PUBLIC_FIELDS = Object.freeze(['id', 'archetypeId', 'track', 'syllabusTopic', 'question', 'firstHint', 'version', 'contentHash']);
const KEYED_TYPES = new Set(['numeric', 'mcq', 'expression', 'set', 'point']);
const NON_PERSON = /^(automated:|ai\b|claude|gpt|model)/i;

export function contentHash(q) {
  return createHash('sha256').update(JSON.stringify([q.id, q.version, q.question, q.firstHint])).digest('hex');
}

export function publicQuestion(q) {
  const out = {};
  for (const k of ESCROW_PUBLIC_FIELDS) out[k] = k === 'contentHash' ? contentHash(q) : q[k];
  return out;
}

// Reads the escrow file. A path inside the repository is refused so an escrow
// can never be committed by accident and then shipped.
export function loadEscrow(env = process.env) {
  const file = env.PRI_JEE_ESCROW_PATH;
  if (!file) return { entries: new Map(), reason: 'escrow-not-configured' };
  let abs;
  try { abs = realpathSync(path.resolve(file)); } catch { return { entries: new Map(), reason: 'escrow-unreadable' }; }
  const rel = path.relative(REPO_ROOT, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return { entries: new Map(), reason: 'escrow-inside-repository' };
  let doc;
  try { doc = JSON.parse(readFileSync(abs, 'utf8')); } catch { return { entries: new Map(), reason: 'escrow-unreadable' }; }
  const entries = new Map();
  for (const e of Array.isArray(doc?.entries) ? doc.entries : []) if (e && typeof e.questionId === 'string') entries.set(e.questionId, e);
  return { entries, reason: null };
}

// Why a question cannot be issued, or null when it can.
export function unavailableReason(q, escrow) {
  if (escrow.reason) return escrow.reason;
  const e = escrow.entries.get(q.id);
  if (!e) return 'no-escrow-entry';
  if (e.contentHash !== contentHash(q)) return 'escrow-not-bound-to-public-text';
  const r = e.rights || {};
  if (r.status !== 'cleared' || !r.evidenceRef || !r.recordedBy || NON_PERSON.test(String(r.recordedBy))) return 'rights-not-cleared';
  const v = e.review || {};
  if (v.tier !== 'human' || !v.reviewedBy || !v.reviewedAt || NON_PERSON.test(String(v.reviewedBy))) return 'no-human-maths-review';
  if (!KEYED_TYPES.has(e.answerType) || e.answer == null || e.answer === '') return 'no-keyed-answer';
  return null;
}

export function issuable(questions, escrow) {
  return questions.map(q => ({ id: q.id, reason: unavailableReason(q, escrow) }));
}

// The server's own question, for the marker pool only. Never serialised to a client.
export function serverQuestion(q, escrow) {
  const reason = unavailableReason(q, escrow);
  if (reason) return { ok: false, reason };
  const e = escrow.entries.get(q.id);
  return {
    ok: true,
    question: {
      id: q.id, prompt: q.question, answerType: e.answerType, answer: e.answer,
      ...(e.mcqOptions ? { mcqOptions: e.mcqOptions } : {}),
      contentHash: e.contentHash
    }
  };
}
