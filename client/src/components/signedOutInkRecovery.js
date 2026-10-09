// Student-only in-context recovery presentation. Recognition authority,
// account eligibility, sealed IndexedDB writes and marking remain elsewhere.
export const BLOCKED_INK_ACCOUNT_KEYS = new Set([
  'ink.waitingSignIn','ink.waitingVerifyEmail','ink.waitingGuardian'
]);
export function blockedInkRecovery({readerState, mode, inkHasStrokes, resolved}) {
  return mode === 'write' && inkHasStrokes === true && !resolved
    && readerState?.kind === 'ACCOUNT_ACTION_REQUIRED'
    && BLOCKED_INK_ACCOUNT_KEYS.has(readerState.blocker);
}
export function canOpenInkSignIn({readerState, mode, inkHasStrokes, resolved, saveState}) {
  return blockedInkRecovery({readerState, mode, inkHasStrokes, resolved})
    && readerState.blocker === 'ink.waitingSignIn'
    && saveState === 'saved'; // ONLY successful sealed IndexedDB readback, never queued
}
export function inkRecoveryWords(language = 'en') {
  return String(language).toLowerCase().startsWith('hi')
    ? {
        action: 'इस उत्तर की जाँच के लिए साइन इन करें',
        detail: 'आपकी लिखावट अभी जाँची नहीं गई है। इस डिवाइस पर सहेजने की स्थिति नीचे देखें।',
        saveFirst: 'साइन इन करने से पहले लिखावट सुरक्षित सहेजना आवश्यक है।',
      }
    : {
        action: 'Sign in to check this answer',
        detail: 'Your handwriting has not been read or graded. Check its device-save status below.',
        saveFirst: 'Save your handwriting on this device before signing in.',
      };
}
