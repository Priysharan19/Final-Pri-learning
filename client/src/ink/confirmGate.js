// The record kept with a submission of which revision of the reading it was made from.
//
// Superseded 19 Nov 2026 (owner decision, ADR-0001 amendment): the student no longer confirms a reading before
// marking (standard P0 #11, PRs #999 and #1016, is retired). Nothing here gates a submission any more. A
// handwritten or photographed submission records the reading it was made from and says plainly that the
// student did not confirm it (`studentConfirmed: false`); the server's reading floor decides what is judged.
//
// Pure.

/** The record kept with the submission: the revision of the reading used, never marked as student-confirmed. */
export function confirmedRevision({ reading, signature, text = '', edited = false, now = Date.now() }) {
  return Object.freeze({
    reading: String(reading || '').slice(0, 400),
    signature: signature ? String(signature).slice(0, 80) : null,
    transcript: String(text || '').slice(0, 4000),
    edited: edited === true,
    studentConfirmed: false,
    at: now
  });
}
