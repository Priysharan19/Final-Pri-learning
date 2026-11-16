// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the progress export (plan F5)
//
// Only what the Progress and History pages already show the student, read
// through `api` (the same two reads the pages make, plus the exam list). Every
// field is copied by name — nothing is spread from a reply — so a hidden field
// added to a reply upstream can never reach a file. There is no answer, no
// solution, no marking plan, no content hash, no other profile, no band, grade
// or score prediction. An open exam is not in the file at all: a paper still
// being sat is sealed. A finished paper carries the score and total the server
// decided (and who marked it); this file never makes one.
// ─────────────────────────────────────────────────────────────────────────────
import { api } from '../api.js';
import { EDITION } from '../platform/edition.js';

const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
const text = (v, max = 160) => (typeof v === 'string' ? v.slice(0, max) : '');

function scopeRows(curriculum, user) {
  if (!curriculum) return [];
  const track = user?.indiaTrack || 'cbse';
  let scope = null;
  if (user?.course === 'in') {
    scope = track === 'cbse'
      ? (curriculum.years || []).find(s => Number(s.year) === Number(user.year))
      : (curriculum.streams || []).find(s => s.track === track && (s.year == null || Number(s.year) === Number(user.year)))
        || (curriculum.streams || []).find(s => s.track === track);
  }
  return scope?.chapters || scope?.subtopics || [];
}

/** Pure: the export from the three reads. */
export function composeProgress({ stats, curriculum, exams, user }) {
  const totals = stats?.totals || {};
  const chapters = scopeRows(curriculum, user).map(row => ({
    id: text(row.id, 80),
    name: text(row.name || row.title),
    attempts: num(row.attempts ?? row.evidence?.attempts) ?? 0,
    correct: num(row.correct ?? row.evidence?.correct) ?? 0
  })).filter(c => c.id && c.attempts > 0);
  const finished = (Array.isArray(exams) ? exams : []).filter(e => e && e.finished_at && !e.pending);
  return {
    exportVersion: 1,
    kind: 'progress',
    source: 'app',
    edition: EDITION,
    profile: { name: text(user?.name || user?.displayName, 80), year: num(user?.year), course: text(user?.course, 8) },
    notice: 'Practice counts and results the app showed this student. Not a prediction. A mark appears only where the server marked a paper.',
    totals: { attempts: num(totals.attempts) ?? 0, correct: num(totals.correct) ?? 0, repeats: num(totals.repeats) ?? 0 },
    chapters,
    exams: finished.map(e => ({
      title: text(e.title), finishedAt: num(e.finished_at), score: num(e.score), total: num(e.total),
      markedBy: text(e.marked_by, 24), provisional: e.provisional === true
    }))
  };
}

/** The reads, then the composition. Offline, a read that fails leaves its part empty and says so. */
export async function exportProgress(user) {
  const [stats, curriculum, examList] = await Promise.all([
    api.get('/stats'), api.get('/curriculum').catch(() => null), api.get('/exams').catch(() => ({ exams: [] }))
  ]);
  return composeProgress({ stats, curriculum, exams: examList?.exams, user });
}
