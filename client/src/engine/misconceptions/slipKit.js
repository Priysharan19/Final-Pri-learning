// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the slip kit: how a topic file names a wrong answer
//
// A topic entry reads the question the server issued (its prompt and its right
// answer: nothing else) and lists the wrong answers a named slip would give.
// If the student's answer equals one of them, the entry says which slip it is
// and says so in one plain sentence made from the question's OWN numbers.
//
// AI proposes, the engine decides: this module only chooses WORDS. It never
// reads a mark, never changes one, and is run only after the answer has been
// marked; the right answer is used to rule a slip out, never shown.
// Pure: no I/O, no globals.
// ─────────────────────────────────────────────────────────────────────────────

export const LANGS = Object.freeze(['en', 'hi', 'en-AU']);

/** A number as a student would write it: up to 4 significant figures, no trailing zeros. */
export const n4 = v => (Number.isFinite(v) ? String(Number(Number(v).toPrecision(4))) : String(v));
export const rad = d => (d * Math.PI) / 180;
export const deg = r => (r * 180) / Math.PI;
export const SIN = d => Math.sin(rad(d));
export const COS = d => Math.cos(rad(d));
export const TAN = d => Math.tan(rad(d));

/** The numbers inside the $…$ spans of a prompt, in order, as a flat list of numeric strings. */
export const promptNumbers = prompt => [...String(prompt || '').matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));

/** How close a student's number must be to a slip's value for it to count as that slip. */
export function slipTolerance(question, value) {
  const t = Number(question?.answer?.tol);
  if (Number.isFinite(t) && t > 0) return t * 1.05;
  const mag = Math.abs(value);
  return mag >= 1000 ? mag * 1e-4 : mag >= 1 ? Math.max(0.0051, mag * 5e-4) : 0.0051;
}

export const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/**
 * Run a list of topic entries over one question and one student value.
 * An entry is { id, read(question) → params | null, slips(params) → [{ id, value, say }] }
 * where `say` maps a language to a sentence. Returns { id, entry, say, params } or null.
 * A slip whose value equals the right answer is never reported.
 */
export function diagnoseWith(entries, question, studentValue) {
  const v = Number(studentValue);
  if (!question || !Number.isFinite(v)) return null;
  const right = Number(question?.answer?.value);
  for (const entry of entries) {
    let params = null;
    try { params = entry.read(question); } catch { params = null; }
    if (!params) continue;
    let slips = [];
    try { slips = entry.slips(params) || []; } catch { slips = []; }
    for (const slip of slips) {
      if (!Number.isFinite(slip.value)) continue;
      if (Number.isFinite(right) && near(slip.value, right, slipTolerance(question, right))) continue;
      if (near(v, slip.value, slipTolerance(question, slip.value))) {
        return { id: slip.id, entry: entry.id, say: slip.say, params, value: slip.value };
      }
    }
  }
  return null;
}

/** The sentence for a language, falling back en-AU → en. */
export function sayIn(say, lang) {
  if (!say) return '';
  const l = lang === 'hi' ? 'hi' : lang === 'en-AU' ? 'en-AU' : 'en';
  return (say[l] || say.en || '');
}
