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
        otpAction: 'फ़ोन या ईमेल कोड का उपयोग करें',
        otpNotice: 'पुष्टि किया गया Pri खाता इसी प्रोफ़ाइल की सहेजी गई लिखावट से जुड़ जाएगा।',
        detail: 'आपकी लिखावट अभी जाँची नहीं गई है। इस डिवाइस पर सहेजने की स्थिति नीचे देखें।',
        saveFirst: 'साइन इन करने से पहले लिखावट सुरक्षित सहेजना आवश्यक है।',
        blocker: {
          'ink.waitingGuardian': 'हैंडराइटिंग पढ़ने से पहले किसी अभिभावक को आपके खाते की पुष्टि करनी होगी।',
          'ink.waitingVerifyEmail': 'हैंडराइटिंग पढ़वाने के लिए अपना ईमेल पता सत्यापित करें।',
        },
      }
    : {
        action: 'Sign in to check this answer',
        otpAction: 'Use a phone or email code',
        otpNotice: 'This connects the saved working on this profile to the Pri account you verify.',
        detail: 'Your handwriting has not been read or graded. Check its device-save status below.',
        saveFirst: 'Save your handwriting on this device before signing in.',
        // What is actually in the way, without the generic sentence's
        // unverified "your working is saved" claim (the save status below is
        // the only place that claim is made, from an IndexedDB readback).
        blocker: {
          'ink.waitingGuardian': 'A parent or guardian needs to confirm your account before handwriting can be read.',
          'ink.waitingVerifyEmail': 'Verify your email address to have handwriting read.',
        },
      };
}

// Reuse the existing OTP account flow without moving an already-written
// student page onto another local profile. The platform retains sole authority
// for account linkage, guardian eligibility, sessions and grading.
export async function completeInkOtpRecovery({
  localProfileId, currentProfileId, account, verifiedSaved,
  getLinked, linkAccount, refreshProfile
}) {
  if (!localProfileId || String(localProfileId) !== String(currentProfileId)) {
    throw Object.assign(new Error('The student profile changed. Return to your original profile to recover its working.'), { code: 'INK_PROFILE_CHANGED' });
  }
  if (verifiedSaved !== true) {
    throw Object.assign(new Error('Save the handwriting on this device before connecting an account.'), { code: 'INK_DRAFT_NOT_SAVED' });
  }
  if (!account?.id) throw Object.assign(new Error('A verified Pri account is required.'), { code: 'INK_ACCOUNT_NOT_VERIFIED' });
  const prior = await getLinked(localProfileId);
  if (prior?.accountId && String(prior.accountId) !== String(account.id)) {
    throw Object.assign(new Error('This profile is linked to another Pri account. Return to its original account.'), { code: 'INK_ACCOUNT_MISMATCH' });
  }
  await linkAccount(localProfileId, account);
  await refreshProfile();
  return true;
}
