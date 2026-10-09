// The authoritative server already commits exactly one graded-attempt per
// immutable attemptId. A browser callback or replay must never increment the
// device's *session banner* twice for that same attempt, even after a lost ACK.
// Session counters are presentation only; this never changes server progress.
export function consumeSessionReceipt(receipt, seen) {
  if (!seen || typeof seen.has !== 'function' || typeof seen.add !== 'function' ||
      receipt?.authoritative !== true || receipt?.resolved !== true ||
      typeof receipt.attemptId !== 'string' || receipt.attemptId.length < 8 ||
      seen.has(receipt.attemptId)) return false;
  seen.add(receipt.attemptId);
  return true;
}
