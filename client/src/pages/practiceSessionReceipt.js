// The authoritative server already commits exactly one graded-attempt per
// immutable attemptId. A browser callback or replay must never increment the
// device's *session banner* twice for that same attempt, even after a lost ACK.
// Session counters are presentation only; this never changes server progress.
//
// A device question (marked by the bundled deterministic engine when no
// signed-in account reaches the server) has no server attempt. It resolves
// exactly once, so it is counted once per question id. A result that mixes the
// two shapes (not authoritative, yet naming an attempt or certified marks) is
// neither and is never counted.
export function consumeSessionReceipt(receipt, seen, questionId = null) {
  if (!seen || typeof seen.has !== 'function' || typeof seen.add !== 'function' ||
      receipt?.resolved !== true) return false;
  let key;
  if (receipt.authoritative === true) {
    if (typeof receipt.attemptId !== 'string' || receipt.attemptId.length < 8) return false;
    key = receipt.attemptId;
  } else if (receipt.authoritative === false) {
    if (receipt.attemptId != null || receipt.marksEarned != null || receipt.marksPossible != null ||
        typeof questionId !== 'string' || !questionId) return false;
    key = 'device-question:' + questionId;
  } else return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
