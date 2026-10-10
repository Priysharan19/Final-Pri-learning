// A cloud login or consent response is not a request to abandon live working.
// Auth ownership is handled upstream; read/grade readiness updates inside Ink.
export function shouldReloadPracticeOnCloudSignIn(event, profileId, activeQuestionId) {
  if (event?.detail?.connected !== true) return false;
  if (!profileId || String(event.detail.localProfileId) !== String(profileId)) return false;
  // A restored question, even one that began before sign-in, remains mounted:
  // reissuing on this event could silently replace its ink/attempt identity.
  return !activeQuestionId;
}
