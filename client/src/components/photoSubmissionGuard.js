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

// Readiness/session/transport adapters can reject outside their own provider
// try/catch (for example a dropped connection while loading provider status).
// An unhandled rejection must never strand Photo at phase='reading' forever.
// Keep error bytes/private handwriting out of student logs and UI.
export function photoReadFailure() {
  return { blocked: 'verdict.photoReadingServiceDown' };
}

// A recoverable connection failure should not force the learner to choose a
// fresh image (or lose the original PDF). Auth/guardian refusal is not a
// reason to offer a bypassing Retry button; those have their own account flow.
export function canRetryPhotoReading(blockedKey, hasImage, hasPdf) {
  return Boolean(hasImage || hasPdf) &&
    ['verdict.photoReadingOffline', 'verdict.photoReadingServiceDown'].includes(blockedKey);
}

// These online-only student notices are temporary source-adjacent EN/HI copy.
// Central i18n owner should relocate them into parity-checked translations.
export function photoSupportedFormats(language) {
  return hindi(language)
    ? 'ऑनलाइन जाँच के लिए एक फ़ोटो या एक पेज की PDF चुनें। कई पेज की PDF पढ़ी जा सकती है, लेकिन अभी पूरी PDF के अंक नहीं दिए जा सकते।'
    : 'For online grading, use one photo or a single-page PDF. A multi-page PDF can be transcribed but cannot yet receive a verified Photo grade.';
}
export function photoAwaitingOnlineReader(language) {
  return hindi(language)
    ? 'तस्वीर सुरक्षित रूप से इसी स्क्रीन पर है। इसकी लिखावट पढ़ने और जाँचने के लिए इंटरनेट, सही खाता और आवश्यक अभिभावक अनुमति चाहिए।'
    : 'The attachment remains on this screen. Reading and grading it require an online eligible account and any required guardian consent.';
}
export function pdfReaderNeedsOnlineDownload(language) {
  return hindi(language)
    ? 'इस डिवाइस पर PDF खोलने की सुविधा पहले डाउनलोड करनी होगी। इंटरनेट से जुड़कर फिर कोशिश करें। फ़ोटो और PDF की गणित-जाँच भी ऑनलाइन ही होती है।'
    : 'This device needs a one-time online download to open PDFs. Reconnect and try again. Photo and PDF mathematical grading also requires an online server.';
}
