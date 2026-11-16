// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where the time went on a timed paper (premium-intelligence
// plan F10)
//
//   timeReport(detail) → null | { totalMs, marks, awarded, sections: [...] }
//
// One pure function over a server-marked paper's detail rows. Shared by the
// server (which decides who receives it: the premium-exams capability) and
// the tests. It DESCRIBES one sitting, section by section:
//
//   · how long was spent there, and that as a share of the time measured;
//   · what the section was worth, and that as a share of the paper's marks;
//   · marks earned per minute spent there;
//   · the last question reached in the section, and the marks lost on it.
//
// It never prescribes. No "do Section B first", no ideal split, no target
// pace: those are unvalidated strategy claims, and time on a question is
// process evidence whose meaning is limited
// (docs/research/AI_ERA_ASSESSMENT_INTEGRITY_PROCESS_EVIDENCE_V7.md, V7-48).
// Time is reported only when the room measured it per question for the whole
// paper (`timed` on every row); an even split of the paper's clock is not a
// measurement, and then the report is null.
// ─────────────────────────────────────────────────────────────────────────────

const share = (n, d) => (d > 0 ? Math.round(1000 * n / d) / 10 : null);
const perMinute = (marks, ms) => (ms > 0 ? Math.round(100 * marks / (ms / 60000)) / 100 : null);

/** Whether a question was reached: time was spent on it, or it was answered. */
export function reached(d) {
  return (Number(d?.ms) || 0) > 0 || d?.unanswered === false;
}

export function timeReport(detail) {
  const rows = Array.isArray(detail) ? detail.filter(d => d && typeof d === 'object') : [];
  if (!rows.length || !rows.every(d => d.timed === true) || rows.some(d => d.section === undefined || d.section === null)) return null;
  const sorted = [...rows].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const order = [];
  const bySection = new Map();
  for (const d of sorted) {
    const id = String(d.section);
    if (!bySection.has(id)) {
      order.push(id);
      bySection.set(id, { id, label: d.sectionLabel || `Section ${id}`, questions: 0, reached: 0, ms: 0, marks: 0, awarded: 0, last: null });
    }
    const s = bySection.get(id);
    const marks = Number(d.marks) || 0;
    const awarded = Number(d.awarded) || 0;
    s.questions++;
    s.ms += Math.max(0, Number(d.ms) || 0);
    s.marks += marks;
    s.awarded += awarded;
    if (reached(d)) {
      s.reached++;
      s.last = { order: Number(d.order) || null, marks, awarded, lost: Math.max(0, marks - awarded), answered: d.unanswered === false };
    }
  }
  const totalMs = order.reduce((n, id) => n + bySection.get(id).ms, 0);
  const marks = order.reduce((n, id) => n + bySection.get(id).marks, 0);
  const awarded = order.reduce((n, id) => n + bySection.get(id).awarded, 0);
  if (totalMs <= 0) return null;
  return {
    totalMs, marks, awarded,
    sections: order.map(id => {
      const s = bySection.get(id);
      return {
        id: s.id, label: s.label, questions: s.questions, reached: s.reached,
        ms: s.ms, timeShare: share(s.ms, totalMs),
        marks: s.marks, marksShare: share(s.marks, marks),
        awarded: s.awarded, lost: Math.max(0, s.marks - s.awarded),
        marksPerMinute: perMinute(s.awarded, s.ms),
        lastReached: s.last
      };
    })
  };
}
