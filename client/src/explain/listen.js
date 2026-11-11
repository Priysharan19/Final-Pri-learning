// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Listen" on a worked step or a tutor reply (F9)
//
// Pure decisions, so the Node suites hold them:
//   - ON-DEVICE ONLY. Only voices the platform marks `localService` are used.
//     A network voice would send the student's maths to a speech service; the
//     control simply does not appear rather than doing that.
//   - The voice and the spoken language come from speech.js (hi-IN / en-IN with
//     its same-language-then-English fallback), and the maths is verbalised by
//     speech.js's deterministic speechText. The board's text is never changed.
//   - No usable voice → no control. Nothing is shown that cannot work.
// ─────────────────────────────────────────────────────────────────────────────
import { narrationPlan, speechText } from './speech.js';

/** Voices that run on the device. */
export function localVoices(voices) {
  return (Array.isArray(voices) ? voices : []).filter(v => v && v.lang && v.localService === true);
}

/** How to read text aloud in `language`, or null when no on-device voice can. */
export function listenPlan(voices, language, { region } = {}) {
  const plan = narrationPlan(localVoices(voices), language, { region });
  return plan.voice ? plan : null;
}

/**
 * The words to hand the speech engine. `textFor(spoken)` returns the text in
 * the language that will actually be spoken (English when only an English
 * voice exists, so a Hindi sentence is never read by an English voice).
 */
export function listenText(textFor, plan) {
  if (!plan) return '';
  const raw = typeof textFor === 'function' ? textFor(plan.spoken) : textFor;
  return speechText(raw, plan.spoken);
}
