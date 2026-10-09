// An authored criterion count and diagnostic partial.awarded are NOT a
// committed numerical grade. Only a bounded matched immutable server receipt
// can supply the marks shown to a learner.
export function attestedGrade(res, questionId, attempt) {
  if (res?.authoritative !== true || res?.resolved !== true ||
      !attempt || !res?.attemptId || !res?.submissionId ||
      res.attemptId !== attempt.attemptId ||
      res.submissionId !== attempt.submissionId ||
      // The local practice adapter verified the server-issued question, but
      // does not always forward the raw question ID; pin to card binding.
      attempt.questionId !== String(questionId || '') ||
      (res.questionId != null && String(res.questionId) !== String(questionId))) return null;
  const awarded = res.marksEarned, possible = res.marksPossible;
  // Method marks may be fractional. Preserve server amounts without any
  // client-generated reweighting or rounding; reject NaN/Infinity/coercion.
  if (typeof awarded !== 'number' || typeof possible !== 'number' ||
      !Number.isFinite(awarded) || !Number.isFinite(possible) ||
      possible <= 0 || awarded < 0 || awarded > possible) return null;
  return { awarded, possible };
}

// Student-owned EN/HI safety fallback until central i18n owner adds parity
// keys. Do not label a server verdict 'marked on this device' and do not call
// an absent award 0 marks.
export function gradingReceiptMismatch(language) {
  return String(language || '').toLowerCase().startsWith('hi')
    ? 'सर्वर से आया परिणाम इस उत्तर से मेल नहीं खाता। आपका काम सुरक्षित है; इसी उत्तर को फिर भेजें।'
    : 'The server response did not match this submission. Your working is retained for a safe retry.';
}

export function numericalGradeUnavailable(language) {
  return String(language || '').toLowerCase().startsWith('hi')
    ? 'इस परिणाम के लिए सर्वर से सत्यापित संख्यात्मक अंक उपलब्ध नहीं हैं।'
    : 'No server-attested numerical marks are available for this result.';
}

// The grade endpoint must answer the exact submitted key and issued question.
// A stale but successful HTTP 200 for another attempt must not clear the
// current recovery record or replace the displayed result.
export function matchingGradeResponse(result, questionId, submittedId) {
  return result?.authoritative === true &&
    // Missing raw question ID is allowed only after the local adapter's
    // server-issued-question check; an explicit mismatch always fails.
    (result.questionId == null || String(result.questionId) === String(questionId || '')) &&
    typeof result.submissionId === 'string' && result.submissionId === submittedId &&
    typeof result.attemptId === 'string' && result.attemptId.length > 0;
}

// The server may issue diagnostic method feedback on an unresolved try. That
// note can contain text such as '1 mark for correct working', but it is not a
// certified grade until a committed resolved receipt has a matching mark pair.
export function showCommittedMethodAwardNote(result, grade) {
  return result?.authoritative === true && result?.resolved === true &&
    result?.correct !== true && grade != null &&
    typeof result?.partial?.awarded === 'number' &&
    Number.isFinite(result.partial.awarded) &&
    result.partial.awarded === grade.awarded;
}
