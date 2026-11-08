#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the owner device script as data (docs/release/owner-device-script.json)
//
// docs/release/OWNER-DEVICE-SCRIPT.md is the owner's Apple-only device script
// (owner default D1). The Owner Console renders the same script as a tick-box
// checklist the owner works through on the device. This generator writes that
// checklist from two sources so it can never drift from the matrix:
//
//   · scripts/device-matrix-record.mjs CASES — every iPhone and iPad case id,
//     title and expected result, exactly as the recorder knows them;
//   · OWNER_STEPS below — what the owner does for each step id (precondition,
//     steps, evidence to capture). A matrix step with no entry here fails the
//     generator, so a new case cannot reach the release without instructions.
//
// The checklist holds instructions only. It holds no result, no tester, no
// device: results are the owner's, recorded on real hardware and imported
// with tools/release-device-import.mjs, which writes only through the
// recorder's own validation (simulators, agents and placeholders refused).
// Its evidenceExport.shape comes from the importer, so it names exactly the
// fields this checkout's recorder keeps, and every value in it is a
// <placeholder> the importer refuses.
//
//   node tools/release-owner-device-script.mjs --write   # regenerate the JSON
//   node tools/release-owner-device-script.mjs --check   # exit 1 if it is stale
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CASES } from '../scripts/device-matrix-record.mjs';
import { EXPORT_FORMAT, SOAKS_RECORDED, exportShape } from './release-device-import.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPT_JSON = join(ROOT, 'docs', 'release', 'owner-device-script.json');
export const APPLE_FAMILIES = Object.freeze(['IPH', 'IPD']);
export { EXPORT_FORMAT };

const SIGNED_IN = 'Signed in to the adult test account on this device.';
/** What the owner does for each matrix step id. Keyed by step, shared by both Apple families. */
export const OWNER_STEPS = Object.freeze({
  INSTALL: { precondition: 'The development build of the candidate SHA is installed from Xcode on this device (Part A), or the TestFlight build (Part B).', steps: ['Open the app.', 'Open its diagnostics and read the release SHA.'], evidence: ['The release SHA the diagnostics show (it must equal the candidate).'] },
  OTP: { precondition: 'The test mailbox is open on this device.', steps: ['Sign in to the adult test account with the email code.', 'Close the app fully, then reopen it.'], evidence: ['Whether you were still signed in after reopening.'] },
  GUARDIAN: { precondition: 'Signed out. The other device is to hand as "the parent\'s own device", with the parent mailbox.', steps: ['Create a child test account on this device.', 'On the OTHER device, open /guardian/consent in Safari and approve with the parent\'s code.', 'Watch this device.'], evidence: ['Whether questions and sync were refused before approval.', 'Whether the child screen moved on by itself after approval.'] },
  ISSUE: { precondition: SIGNED_IN, steps: ['Open Practice and get a question.', 'Turn on aeroplane mode, then turn it off.'], evidence: ['Whether the offline state showed and the question came back.'] },
  WRITE: { precondition: SIGNED_IN, steps: ['Write the answer: a finger on iPhone; the Apple Pencil on iPad, with your palm resting on the screen.', 'Press "Read my answer".'], evidence: ['Lag or dropped strokes, if any.', 'Whether the palm drew (iPad).', 'Whether the one-time prompt naming OpenAI (D17) appeared before anything was sent.', 'iPad: the Apple Pencil model.'] },
  PHOTO: { precondition: SIGNED_IN, steps: ['Photograph a page of working.', 'Photograph it again holding the device sideways.'], evidence: ['Whether the photo was sent for reading.', 'Whether the sideways photo shows the right way up.'] },
  TRANSCRIPT: { precondition: 'A handwritten or photographed answer has been read.', steps: ['Correct one misread line.', 'Confirm the transcript.'], evidence: ['Whether an unsure reading asked you to confirm before marking.'] },
  MARK: { precondition: SIGNED_IN, steps: ['Submit a wrong answer.', 'Submit the right answer.'], evidence: ['The mark shown (earned / possible) and its first-error feedback.', 'Whether the worked solution appeared after the right answer.'] },
  HISTORY: { precondition: 'Both devices signed in to the same adult test account.', steps: ['Close and reopen the app.', 'Open History on this device and on the other one.'], evidence: ['Whether every attempt is in History on both devices.'] },
  VOICEOVER: { precondition: 'Settings → Accessibility → Display & Text Size → Larger Text at the largest size; VoiceOver on.', steps: ['Sign in, open Practice, reach the answer box and the mode switch.', 'Press "Read my answer", listen to the transcript, submit, listen to the mark.', 'Turn VoiceOver off afterwards.'], evidence: ['Any control read without a name.', 'Whether the writing surface was announced.'] },
  KEYBOARD: { precondition: 'A hardware keyboard attached; Settings → Accessibility → Keyboards → Full Keyboard Access on.', steps: ['Tab through the sign-in card and the question card.', 'Activate controls with Space or Return.'], evidence: ['Whether every control was reached in order with visible focus.', 'Any focus trap. With no hardware keyboard, record the case blocked.'] },
  TEXTSIZE: { precondition: 'Larger Text at the largest size (run it together with the VoiceOver case).', steps: ['Walk the same path as the VoiceOver case.'], evidence: ['Anything clipped, or any sideways scroll.'] },
  ROTATE: { precondition: 'iPad: ink, a typed answer and a transcript on the page.', steps: ['Rotate the iPad.', 'Scroll, then write again.'], evidence: ['Whether all three were kept and the ink stayed on the ruled paper.'] },
  SPLITVIEW: { precondition: 'iPad: an attempt open.', steps: ['Put Pri in Split View at half the screen, then a third.', 'Write with the Pencil.'], evidence: ['Whether the card and the writing surface fit without sideways scroll.', 'Whether the ink lands where the pen touches.'] },
  STAGEMANAGER: { precondition: 'iPad: Stage Manager on, an attempt open.', steps: ['Resize and drag the Pri window mid-attempt.'], evidence: ['Whether the ink stayed aligned and nothing was lost.'] },
  REINSTALL: { precondition: 'Attempts in History on this device.', steps: ['Sign out.', 'Delete the app.', 'Reinstall the same build and sign in.'], evidence: ['Whether History holds every earlier attempt with marks, nothing duplicated.'] },
  TIMED: { precondition: 'A timed paper of at least 30 minutes available; run it on both devices at once.', steps: ['Start the paper.', 'Handwrite at least six answers.', 'Lock and unlock once.', 'Submit at the end.'], evidence: ['The paper\'s length in minutes and the number of handwritten answers.', 'Whether the analysis shows every answer.'] },
  BACKGROUND: { precondition: 'An unsent handwritten answer and typed working on the page.', steps: ['Switch to another app for two minutes.', 'Return and submit.'], evidence: ['Whether the ink, the working and any transcript were exactly as left.'] },
  STORAGE: { precondition: 'The device filled to under 500 MB free (a large video download).', steps: ['Write, read, submit, and check History.', 'Free the storage afterwards.'], evidence: ['Any crash or lost work; whether the app said plainly when it could not keep a photo.'] },
  MEMORY: { precondition: 'An unsent draft and a transcript on the page.', steps: ['Open several heavy apps until Pri is reclaimed.', 'Reopen Pri.'], evidence: ['Whether the draft, the transcript and the session came back without signing in.'] },
  EXPORT: { precondition: SIGNED_IN, steps: ['Export the account through the share sheet.', 'Open the file.'], evidence: ['Whether the JSON holds only this account\'s attempts.'] },
  SHARE: { precondition: SIGNED_IN, steps: ['Share and print (or save as PDF) a paper or progress page.'], evidence: ['Whether every question, answer and mark is legible and nothing comes from another profile.'] },
  // Matrix steps that #737 adds (96 cases): until it lands they are release-record items below.
  VOICEOVERTEXT: { precondition: 'Larger Text at the largest size (AX5) and VoiceOver on, together.', steps: ['Sign in, open a question and answer it by handwriting or typing.', 'Listen to the transcript and the mark, then find the attempt in History.', 'Turn VoiceOver off afterwards.'], evidence: ['Any control not reached, or not named, in order.', 'Whether the prompt naming OpenAI (D17) was read in full with both of its buttons reachable.', 'Anything clipped off the screen.'] },
  DELETE: { precondition: 'The last step on this device: every other case here is done.', steps: ['Settings → Account → Delete, confirming with a fresh email code, for each test account on this device.', 'Sign in again with the same address.', 'After sync, look at History on the other device.'], evidence: ['Whether the app went back to the sign-in card.', 'Whether signing in again started a new, empty account.', 'Whether the old History is gone on both devices.'] },
  PURCHASE: { billingRequired: true, precondition: 'The Paid Apps Agreement is active and both products are priced (docs/release/OWNER-CLICK-LIST-APPLE-RAILWAY.md A1–A6), and a Sandbox Apple Account is signed in (Settings → App Store). Until then this case is BLOCKED.', steps: ['On the Premium screen, buy the monthly plan through the system sheet.', 'Once, cancel the sheet instead.'], evidence: ['The price the store sheet showed.', 'Whether Premium unlocked only after the server confirmed it (/v1/entitlements).', 'Whether cancelling changed nothing.'] },
  RESTOREPURCHASE: { billingRequired: true, precondition: 'The purchase case passed with the same sandbox account. Until billing is configured this case is BLOCKED.', steps: ['Delete and reinstall the app, sign in and press "Restore purchases".', 'On the other device, signed in to the same store account, press "Restore purchases".'], evidence: ['Whether Premium came back on both devices once the server confirmed it.', 'What a restore with no purchase said.'] }
});

/** Steps that are not matrix cases on a recorder without them: their results go to the release record, not the device ledger. Each names the matrix step that replaces it (#737). */
export const RELEASE_RECORD_ITEMS = Object.freeze([
  ...APPLE_FAMILIES.map(family => ({
    id: `REC-${family}-DELETE`, kind: 'release-record', family, matrixStep: 'DELETE', title: 'In-app account deletion', billingRequired: false,
    precondition: 'The last step: every other case on this device is done.',
    steps: ['Settings → Account → Delete, for each test account on this device.', 'Confirm with the password or the code.', 'Try to sign in with the same address.'],
    expected: 'You are signed out; the account is gone, and signing in again starts a new account.',
    evidence: ['Whether each account is gone.'],
    recordIn: 'GO/NO-GO record gates.store.evidence ("in-app deletion, iPhone and iPad, <SHA>, by <name>"); App Review guideline 5.1.1(v)'
  })),
  {
    id: 'REC-IPD-PURCHASE', kind: 'release-record', family: 'IPD', matrixStep: 'PURCHASE', title: 'Sandbox purchase and restore', billingRequired: true,
    precondition: 'The Paid Apps Agreement is active and both products are priced (docs/release/OWNER-CLICK-LIST-APPLE-RAILWAY.md A1–A6). Until then this item is BLOCKED.',
    steps: ['Settings → App Store → Sandbox Account: sign in to a sandbox Apple Account.', 'Buy the monthly plan on the Premium screen.', 'Delete and reinstall the app, then "Restore purchases".'],
    expected: 'Premium after the purchase and after the restore, confirmed by the server (/v1/entitlements).',
    evidence: ['The /v1/entitlements answer after each step.'],
    recordIn: 'the release record, ios/PriLearning.swiftpm/RELEASE.md §11 (docs/billing/storekit-certification.md step 4)'
  }
]);

/** The device soak (OWNER-DEVICE-SCRIPT.md A17 and B5), where the recorder keeps soak records (#737). */
export const SOAK_ITEM = Object.freeze({
  id: 'SOAK', kind: 'soak', family: 'IPD', title: 'Soak: continuous use through the second sitting', billingRequired: false,
  precondition: 'The second sitting (the TIMED, BACKGROUND, STORAGE, MEMORY, EXPORT and SHARE cases) run on the iPad in one go. Part B runs one more soak on the TestFlight build.',
  steps: ['Note the time the second sitting starts and the time it ends.', 'Note every crash, hang, lost piece of work or wrong mark in between.'],
  expected: 'No crash or lost work in 45 minutes or more.',
  evidence: ['The minutes of continuous use.', 'The number of failures, with a note on each.'],
  recordIn: 'the export\'s soaks list, with the same SHA, tester, build kind and server as its records'
});

/** The checklist, generated. Throws when a matrix step has no owner instructions. */
export function ownerDeviceScript(cases = CASES) {
  const items = [];
  for (const kase of cases.filter(c => APPLE_FAMILIES.includes(c.family))) {
    const owner = OWNER_STEPS[kase.step];
    if (!owner) throw new Error(`no owner steps for matrix step ${kase.step} (${kase.id}): add it to OWNER_STEPS`);
    items.push({
      id: kase.id, kind: 'device-matrix', family: kase.family, title: kase.title, billingRequired: owner.billingRequired === true,
      precondition: owner.precondition, steps: [...owner.steps], expected: kase.expect, evidence: [...owner.evidence],
      ...(kase.pencil ? { pencilRequired: true } : {})
    });
  }
  if (SOAKS_RECORDED) items.push({ ...SOAK_ITEM, steps: [...SOAK_ITEM.steps], evidence: [...SOAK_ITEM.evidence] });
  // A release-record item stays only while the matrix has no case for its step on that family.
  const inMatrix = (family, step) => cases.some(kase => kase.family === family && kase.step === step);
  items.push(...RELEASE_RECORD_ITEMS.filter(item => !inMatrix(item.family, item.matrixStep)).map(({ matrixStep: _step, ...item }) => ({ ...item, steps: [...item.steps], evidence: [...item.evidence] })));
  return {
    format: 'pri-owner-device-script', version: 1,
    generatedBy: 'node tools/release-owner-device-script.mjs --write',
    caseSource: 'scripts/device-matrix-record.mjs CASES (families IPH, IPD)',
    note: 'Instructions only: nothing here is a result. Results are recorded by the named owner on real hardware.',
    evidenceExport: {
      format: EXPORT_FORMAT, version: 1,
      import: 'node tools/release-device-import.mjs <export.json>',
      shape: exportShape(),
      rules: 'One export per sitting. Every value is what a person entered on the device: text (minutes and failures: whole numbers), never a <placeholder> from this shape, and only the fields the shape names. The importer checks every record by scripts/device-matrix-record.mjs\'s own rules and writes only through it. One bad record refuses the WHOLE file and nothing is written: a tester that names an agent, CI, a bot or a placeholder, or a simulator or emulator device (whatever the result), an unknown case, a short SHA, a duplicate case, a value that is not text, a placeholder, or a field the recorder does not record. release-record items are not imported: they go where their recordIn says.'
    },
    matrixCases: items.filter(item => item.kind === 'device-matrix').length,
    items
  };
}

export function scriptText(cases = CASES) { return `${JSON.stringify(ownerDeviceScript(cases), null, 2)}\n`; }

async function main() {
  const flag = process.argv[2];
  const text = scriptText();
  if (flag === '--write') { writeFileSync(SCRIPT_JSON, text); console.log(`wrote docs/release/owner-device-script.json (${ownerDeviceScript().matrixCases} iPhone and iPad cases)`); return; }
  if (flag === '--check') {
    let current = '';
    try { current = readFileSync(SCRIPT_JSON, 'utf8'); } catch { current = ''; }
    if (current !== text) { console.error('OWNER DEVICE SCRIPT: STALE — run node tools/release-owner-device-script.mjs --write'); process.exit(1); }
    console.log(`OWNER DEVICE SCRIPT: CURRENT — ${ownerDeviceScript().matrixCases} iPhone and iPad cases`);
    return;
  }
  console.error('Usage: node tools/release-owner-device-script.mjs --write | --check');
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
