// Pri Learning · historical append-only learning events for full reconciliation
//
// A first cloud link (and an explicit account relink) must not migrate only
// practice attempts while silently dropping exam/Rush/Match history. These event
// ids and sequences are deterministic from local record ids so a repeated full
// reconciliation to the same account is idempotent.

import { byIndex } from '../local/idb.js';

const EXAM_BASE = 6_500_000_000_000_000;
const RUSH_BASE = 7_000_000_000_000_000;
const MATCH_BASE = 7_500_000_000_000_000;
const RANGE = 400_000_000_000_000n;
const MASK_64 = (1n << 64n) - 1n;

function source(value, fallback) {
  const raw = String(value ?? fallback ?? 'row');
  return raw.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 72) || String(fallback || 'row');
}

function stableOffset(value, fallbackIndex) {
  const n = Number(value);
  if (Number.isSafeInteger(n) && n > 0 && n < Number(RANGE)) return n;
  const text = String(value ?? `row-${fallbackIndex}`);
  let hash = 1469598103934665603n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * 1099511628211n) & MASK_64;
  }
  return Number(hash % RANGE) + 1;
}

function sorted(rows) {
  return [...rows].sort((a, b) => {
    const ta = Number(a.createdAt || a.finishedAt || 0);
    const tb = Number(b.createdAt || b.finishedAt || 0);
    if (ta !== tb) return ta - tb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function sequence(base, row, index, used) {
  let seq = base + stableOffset(row?.id, index + 1);
  while (used.has(seq)) seq++;
  if (!Number.isSafeInteger(seq)) throw new Error('Historical sync sequence exceeded JavaScript safe integer range');
  used.add(seq);
  return seq;
}

function eventId(deviceId, kind, row, index) {
  return `hist:${deviceId}:${kind}:${source(row?.id, index + 1)}`.slice(0, 160);
}

function examPayload(exam, occurredAt) {
  return {
    state: exam.finishedAt ? 'finished' : 'started',
    year: Number(exam.year) || null,
    title: String(exam.title || '').slice(0, 120),
    score: exam.score == null ? null : Number(exam.score),
    total: exam.total == null ? null : Number(exam.total),
    createdAt: Number(exam.createdAt) || occurredAt,
    finishedAt: Number(exam.finishedAt) || null,
    indiaExam: exam.indiaExam && typeof exam.indiaExam === 'object' && !Array.isArray(exam.indiaExam)
      ? { ...exam.indiaExam }
      : null
  };
}

function pickPayload(row, fields) {
  const payload = {};
  for (const field of fields) if (row?.[field] !== undefined) payload[field] = row[field];
  return payload;
}

export async function historicalSupplementalEvents(pid, deviceId) {
  const used = new Set();
  const events = [];

  const exams = sorted(await byIndex('exams', 'pid', pid).catch(() => []));
  exams.forEach((exam, index) => {
    const occurredAt = Number(exam.createdAt || exam.finishedAt) || null;
    events.push({
      id: eventId(deviceId, 'exam', exam, index),
      deviceId,
      deviceSeq: sequence(EXAM_BASE, exam, index, used),
      kind: 'exam-attempt',
      entityId: exam.id == null ? null : String(exam.id),
      occurredAt,
      payload: examPayload(exam, occurredAt)
    });
  });

  const rushRuns = sorted(await byIndex('rushRuns', 'pid', pid).catch(() => []));
  rushRuns.forEach((run, index) => {
    events.push({
      id: eventId(deviceId, 'rush', run, index),
      deviceId,
      deviceSeq: sequence(RUSH_BASE, run, index, used),
      kind: 'rush-history',
      entityId: run.id == null ? null : String(run.id),
      occurredAt: Number(run.createdAt || run.finishedAt) || null,
      payload: pickPayload(run, ['score', 'correct', 'total', 'bestCombo', 'createdAt'])
    });
  });

  const matchRuns = sorted(await byIndex('matchRuns', 'pid', pid).catch(() => []));
  matchRuns.forEach((run, index) => {
    events.push({
      id: eventId(deviceId, 'match', run, index),
      deviceId,
      deviceSeq: sequence(MATCH_BASE, run, index, used),
      kind: 'match-history',
      entityId: run.id == null ? null : String(run.id),
      occurredAt: Number(run.createdAt || run.finishedAt) || null,
      payload: pickPayload(run, ['won', 'playerScore', 'rivalScore', 'rival', 'ms', 'createdAt'])
    });
  });

  return events.sort((a, b) => a.deviceSeq - b.deviceSeq);
}
