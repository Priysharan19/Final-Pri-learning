// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · haptics (UI9b): `haptic(kind)`, kind 'confirm' | 'selection'
//
//   confirm    a Check receipt with a mark, once, after the server replied
//   selection  a segmented control changing segment; accepting a "check this"
//              reading
//
// Native shells only, through the priNative bridge (iOS UIKit feedback
// generators; Android View.performHapticFeedback). On the web it does nothing:
// the web build calls no vibration API. Never imported by the exam room, the desk or
// the exam shell (client/test/haptics-boundary-check.mjs). The system's own
// haptics setting governs both platforms; there is no in-app toggle.
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './index.js';

export function haptic(kind) {
  try { void priNative.haptics.fire(kind); } catch { /* feedback is never worth a failure */ }
}
