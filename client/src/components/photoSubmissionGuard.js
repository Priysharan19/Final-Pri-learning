// The online photo grading receipt currently covers exactly one image.
// A multi-page PDF may be transcribed for review, but only its first page
// would be sent to /practice/:id/recognize. Never use that receipt to mark
// working from any additional page. Keep this pure for adversarial testing.
export function photoEligibleForGrading({
  mode, photo, ocrPhase, unreadPages = null, pdfPageCount = 0, reattachRequired = false
}) {
  if (mode !== 'photo') return true;
  if (!photo || ocrPhase !== 'done' || unreadPages) return false;
  // Until the server accepts every page in a single bound receipt, fail shut.
  if (pdfPageCount > 1) return false;
  if (reattachRequired && !photo) return false;
  return true;
}

// HTTP 401/403 are not authoritative grades: an eligible account can renew
// its session or obtain guardian approval and replay the SAME submission key.
// Likewise connection/rate-limit timeouts are not proof of non-commit.
export function definitiveSubmissionRefusal(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status < 500 &&
    ![401, 403, 408, 425, 429].includes(status);
}

// Temporary student-owned bilingual copy until the central language-catalogue
// owner can move these P0 diagnostics into parity-checked keys. Neither branch
// of this copy can claim a PDF has been fully verified when only page 1 was.
const hindi = lang => String(lang || '').toLowerCase().startsWith('hi');
export function pdfReceiptWarning(language, pages) {
  return hindi(language)
    ? `इस PDF में ${pages} पेज हैं। आप पढ़े गए हल को देख सकते हैं, लेकिन अभी ऑनलाइन फ़ोटो-जाँच केवल एक तस्वीर की पुष्टि कर सकती है। जाँच के लिए एक पेज की फ़ोटो लगाएँ, या उत्तर जाँचकर टाइप करें।`
    : `This PDF has ${pages} pages. You can review the transcription, but online Photo grading currently verifies only one image. Attach a single-page photo or switch to Type after checking your answer.`;
}

export function draftPersistenceWarning(language) {
  return hindi(language)
    ? 'यह डिवाइस आपके उत्तर और जमा करने की पहचान को सुरक्षित नहीं रख पाया। जगह खाली करें या साइट डेटा चालू करें, फिर कोशिश करें। उत्तर अभी जमा नहीं हुआ है।'
    : 'This device could not safely save the attempt. Check available storage and site data, then try again. Nothing has been submitted.';
}
