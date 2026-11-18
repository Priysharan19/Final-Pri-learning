// Pri Learning · topic slip catalogues (smart-feedback blitz, after #943).
//
// The step checker (checker.js) asks for a named slip only when a line is
// already a BREAK with no diagnosis of its own: everything here names a
// mistake the deterministic check has found. It never changes a status, a
// mark or a first-break index, and never decides anything; it only replaces
// the generic note with a specific one.
//
// A topic file registers itself (one import line each in ./index.js, so lanes
// never edit the same line):
//
//   import { registerTopic } from './registry.js';
//   registerTopic({
//     topic: 'trig',                         // unique id
//     appliesTo: meta => boolean,            // which questions this topic reads
//     slips: [{
//       code: 'trig-exact-value-swap',       // unique diagnosis code
//       misconceptionId: 'optional-ontology-id',
//       name: { en: 'short name of the slip', hi: '…' },   // optional: names it in the "same slip again" note
//       socratic: { en: 'One question about THAT step?', hi: '…' },   // optional: the Hint nudge
//         (no digit, operator or value; client/test/slip-hint-check.mjs holds every registered one to it)
//       // ctx: { line, previous, index, meta } — `previous` is the line before
//       // (or the question's source for the first line). Return null, or:
//       detect: ctx => ({ message, messages: { hi, 'en-AU' }, notesSectionId }),
//     }],
//   });
//
// `message` is the English (en) text, built from the question's own numbers;
// `messages` carries hi and en-AU where they differ. Detectors must be pure
// and deterministic, and must never reveal the final answer.

const TOPICS = [];

export function registerTopic(def) {
  if (!def || typeof def.topic !== 'string' || !Array.isArray(def.slips)) throw new Error('registerTopic: { topic, appliesTo, slips } required');
  if (TOPICS.some(t => t.topic === def.topic)) throw new Error(`registerTopic: duplicate topic ${def.topic}`);
  const codes = new Set(TOPICS.flatMap(t => t.slips.map(s => s.code)));
  for (const s of def.slips) {
    if (typeof s.code !== 'string' || typeof s.detect !== 'function') throw new Error(`registerTopic(${def.topic}): each slip needs code and detect`);
    if (codes.has(s.code)) throw new Error(`registerTopic(${def.topic}): duplicate slip code ${s.code}`);
    codes.add(s.code);
  }
  TOPICS.push(Object.freeze({ ...def, appliesTo: typeof def.appliesTo === 'function' ? def.appliesTo : () => true }));
}

export function registeredTopics() { return TOPICS.slice(); }

export function topicDiagnosisCodes() { return TOPICS.flatMap(t => t.slips.map(s => s.code)); }

/**
 * The first registered slip that names this broken line, or null.
 * Returns { code, message, messages, notesSectionId, misconceptionId, topic }.
 */
export function diagnoseTopicLine(ctx) {
  for (const t of TOPICS) {
    let applies = false;
    try { applies = !!t.appliesTo(ctx.meta || {}); } catch { applies = false; }
    if (!applies) continue;
    for (const s of t.slips) {
      let hit = null;
      try { hit = s.detect(ctx); } catch { hit = null; }
      if (hit && typeof hit.message === 'string' && hit.message) {
        return { code: s.code, title: (typeof hit.title === 'string' && hit.title) ? hit.title : 'a slip in this line', fix: typeof hit.fix === 'string' ? hit.fix : null, confidence: hit.confidence || 'medium', message: hit.message, messages: hit.messages || {}, notesSectionId: hit.notesSectionId || null, misconceptionId: s.misconceptionId || null, topic: t.topic };
      }
    }
  }
  return null;
}

/** The registered slip with this diagnosis code: { topic, misconceptionId, name, socratic }, or null. */
export function slipInfo(code) {
  if (typeof code !== 'string') return null;
  for (const t of TOPICS) {
    const s = t.slips.find(x => x.code === code);
    if (s) return { topic: t.topic, misconceptionId: s.misconceptionId || null, name: s.name || null, socratic: s.socratic || null };
  }
  return null;
}
