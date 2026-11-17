// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · public landing configuration
//
// SOCIAL PROOF. The design reserves three slots: verified student results,
// partner schools and a teacher's comment. A public page never shows an empty
// placeholder and never invents any of the three, so the slots render only
// when this flag is on AND a slot has real, consented content. Both are false
// today. Turning the flag on without content still renders nothing
// (client/test/landing-demo-check.mjs).
//
// TEACHERS. "For teachers" opens a simple page until the teacher workspace's
// onboarding route ships; then it points there instead.
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIAL_PROOF_ENABLED = false;

/**
 * Each slot: { kind: 'results' | 'schools' | 'teacher', consentRef, body } —
 * consentRef names the signed consent record. Empty until real content exists.
 */
export const SOCIAL_PROOF = Object.freeze([]);

/** The slots a page may render: none unless the flag is on and the content is consented. */
export function socialProofSlots(enabled = SOCIAL_PROOF_ENABLED, slots = SOCIAL_PROOF) {
  if (!enabled || !Array.isArray(slots)) return [];
  return slots.filter(s => s && typeof s.body === 'string' && s.body.trim() && typeof s.consentRef === 'string' && s.consentRef.trim());
}

/** Where "For teachers" goes. */
export const TEACHER_ONBOARDING_ROUTE = '/welcome/teachers';

/** The public routes this module serves signed out. */
export const LANDING_ROUTES = Object.freeze({
  home: '/welcome',
  marking: '/welcome/marking',
  syllabus: '/welcome/syllabus',
  teachers: '/welcome/teachers'
});
