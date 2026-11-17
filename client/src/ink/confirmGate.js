// Explicit ambiguity resolution (standard P0 #11). Before an authoritative
// handwriting submit the student sees the whole recognised answer and confirms
// it: one combined "Confirm and submit" tap on a reading they have not doubted,
// the existing check-this-reading step on a reading the reader doubted. A stale
// reading is not gated here: it is re-read first (the ink changed since it was
// read), and the confirmation belongs to the reading that comes back.
//
// Pure. The card holds the state; this decides.

/**
 * Whether the current reading still needs the student's confirmation before it
 * may be sent. `vouched` is the exact reading the student stood behind. An
 * edited line changes the reading, so it must be confirmed again.
 */
export function needsConfirmation({ writeMode, resolved = false, reading, stale = false, vouched = null }) {
  if (!writeMode || resolved) return false;
  if (!reading || stale) return false;
  return vouched !== reading;
}

/** The record kept with the submission of which revision of the reading was confirmed. */
export function confirmedRevision({ reading, signature, text = '', edited = false, now = Date.now() }) {
  return Object.freeze({
    reading: String(reading || '').slice(0, 400),
    signature: signature ? String(signature).slice(0, 80) : null,
    transcript: String(text || '').slice(0, 4000),
    edited: edited === true,
    at: now
  });
}
