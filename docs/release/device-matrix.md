# Physical-device matrix — the §22.2 journey on real hardware

**Evidence class: PHYSICAL-HUMAN only.** Every row that is ever marked passed or failed here was run
by a named person on a real device at a named build SHA. Simulator and emulator runs are CI evidence
(`native-ink.yml`, `android-shell.yml`) and are never written into this matrix; the recorder refuses
them. Nothing here is inferred from a script, a screenshot of a simulator or an agent's run
(`AGENTS.md`: never fabricate physical iPad, Apple Pencil, student or human-review evidence).

What this matrix proves, when complete for a build: the cross-device V1 journey of
`docs/release/PRI_V1_RELEASE_SCOPE.md` §22.2 works on each of the four device families of §22.1:

> install → email sign-in / OTP → required guardian consent → account-bound sync → server-issued
> question → finger or stylus handwriting, or camera photo → explicit transcript correction /
> confirmation → server-authoritative grading and criterion feedback → History and persistent sync.

and, since 2 November 2026, the groups issue #10 and scope §18 #11 asked for: **ACCESSIBILITY**
(VoiceOver / TalkBack, Full Keyboard Access, largest text size), **ORIENTATION** (rotation, Split View,
Stage Manager), **RESTORE** (sign out, delete, reinstall, sign in), **EXAM** (a timed paper with
handwriting), **LIFECYCLE** (background and return, low storage, low-memory recovery) and **EXPORT**
(account export, share and print), with a defect severity on every fail and a separate soak record.

It does **not** replace the handwriting evidence programmes (`LAUNCH-RUNBOOK.md` §3: corpus and the
physical iPad study of the server reader), the StoreKit / Play Billing certification runs, or
`ios/PriLearning.swiftpm/RELEASE.md` §7's TestFlight evidence gate; it is the device check those rows
point at.

## Which server a device build talks to

Two kinds of run, never merged into one verdict (the recorder refuses a row without `--build-kind`
and `--server`, and `report --build-kind …` shows one kind at a time):

1. **Development build → staging, first.** An Xcode (or Gradle) run of the frozen SHA on the owner's
   paired devices, DEBUG, pointed at staging through `PRI_CLOUD_ORIGIN`. This is the only build that may
   talk to staging (`NativeCloudBridge.swift` accepts a staging origin in DEBUG only), and staging is the
   only server that runs the candidate before promotion (`scripts/release-nominate.mjs` lists the
   device matrix before promotion; production still serves an older SHA). The **full** matrix and the
   soak run here: `--build-kind development --server staging`.
2. **Store build → production, after promotion, release held.** The signed TestFlight / Play internal
   build carries a production origin (`scripts/check-native-archive.mjs` refuses a staging one). Re-run
   the short list — `INSTALL`, `OTP`, `ISSUE`, `WRITE`, `TRANSCRIPT`, `MARK`, `HISTORY`, `VOICEOVER` /
   `TALKBACK`, `REINSTALL` — and one soak as `--build-kind testflight` (or `play-internal`) `--server
   production` before the store release is approved.

A release needs the store-build rows against production with **zero open P0 and P1**
(`V1_DECISIONS_2026-11-01.md` D6); the development-build rows are the evidence that the candidate was
right before it was promoted, not a substitute. The recorder refuses a store build on staging and a
development build on production.

## Defect severity (required on every fail)

| Severity | Means | Release |
|---|---|---|
| `P0` | data loss, a wrong or missing mark, a security or privacy breach, or a crash that stops the journey | blocks |
| `P1` | a journey step cannot be completed on this device and there is no workaround | blocks |
| `P2` | the step completes with a workaround, or a visible defect that misleads | triaged, reason recorded |
| `P3` | cosmetic: wording, spacing or alignment with no effect on what the student can do | triaged, reason recorded |

## Soak record

A soak is at least 30 minutes of continuous use on one device, one build, by one named person
(a timed paper with handwriting is the natural shape; `DM-*-17-TIMED` is its case). It is recorded
separately from the cases, with the duration and the number of failures seen (crashes, hangs, lost
work, wrong marks), and each failure also gets its own `fail` row on the case it broke:

```bash
node scripts/device-matrix-record.mjs soak --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" \
  --pencil "Apple Pencil Pro" --sha <40-hex> --tester "Full Name" --build-kind development --server staging \
  --minutes 45 --failures 0 --notes "30-min timed paper, 6 handwritten answers, then review"
```

## Before a session

1. The build is a nominated `main` SHA (`node scripts/release-nominate.mjs <sha> --candidate`; the
   release-stage run without `--candidate` later requires this matrix to be complete for the SHA): a
   development build of it on your paired device pointed at staging, or, after promotion, the store build
   from its test track (TestFlight; Play internal testing). Write down the SHA the app's diagnostics show —
   it is recorded with every case and must equal the nominated one — and the build kind and server.
2. The server side of the same journey already passed on staging without a device:
   `node tools/acceptance/staging-acceptance.mjs --email <mailbox> --tester "<name>"` (steps 0, A–E).
   A device case that fails where the staging acceptance passed is a shell or input defect; one that
   fails in both is a server defect.
3. You have: a real mailbox on the device (step 02), a second mailbox or phone for the parent (step 03,
   on the parent's **own** device), a second signed-in device for step 09, and for `IPD` an Apple Pencil
   whose model you record. For the ACCESSIBILITY cases: VoiceOver / TalkBack and Full Keyboard Access
   turned on in the device's own Settings, and the largest accessibility text size.
4. Test accounts only; never a student's account. Delete the accounts afterwards from the app.

## Device families

| Family | Means | Handwriting input to use | Store track |
|---|---|---|---|
| `IPH` | iPhone | finger; camera photo | TestFlight, then App Store |
| `IPD` | iPad **with Apple Pencil** | Apple Pencil (record the Pencil model); camera photo | TestFlight, then App Store |
| `AND` | Android phone | finger; camera photo | Play internal testing, then closed testing |
| `ANT` | Android tablet | S Pen / USI stylus where the tablet has one, else finger; camera photo | Play internal testing, then closed testing |

The owner has an iPhone 16 Pro Max and an iPad Pro 11-inch (4th generation) and **no Android
device** (`docs/release/android-parity.md` "BLOCKED_EXTERNAL"); the `AND` and `ANT` rows stay
`blocked` with that reason until someone with the hardware records them. No row of any family has
been recorded yet (0 of 80 cases); that is the truthful state.

## Cases

Case ids are stable: `DM-<family>-<seq>-<step>`. The table below is generated from
`scripts/device-matrix-record.mjs` (`node scripts/device-matrix-record.mjs cases --markdown`) and a
test keeps the two equal; edit the script, not the table.

<!-- device-matrix-cases:start -->
| Case | Group | Family | Step | What the tester must see |
|---|---|---|---|---|
| `DM-IPH-01-INSTALL` | JOURNEY | iPhone | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-IPH-02-OTP` | JOURNEY | iPhone | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-IPH-03-GUARDIAN` | JOURNEY | iPhone | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-IPH-04-ISSUE` | JOURNEY | iPhone | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-IPH-05-WRITE` | JOURNEY | iPhone | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw. The first "Read my answer" opens the one-time prompt naming OpenAI (D17) above the ink, its two buttons answer a finger, nothing is read until "Send it to be read", and only then is the picture sent; "No, I'll type my answers" leaves the student typing. |
| `DM-IPH-06-PHOTO` | JOURNEY | iPhone | 06 Photo of working | The camera or picker captures a page of working; a profile that has not yet answered the D17 prompt is asked before the photo is sent; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-IPH-07-TRANSCRIPT` | JOURNEY | iPhone | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-IPH-08-MARK` | JOURNEY | iPhone | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-IPH-09-HISTORY` | JOURNEY | iPhone | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-IPD-01-INSTALL` | JOURNEY | iPad + Apple Pencil | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-IPD-02-OTP` | JOURNEY | iPad + Apple Pencil | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-IPD-03-GUARDIAN` | JOURNEY | iPad + Apple Pencil | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-IPD-04-ISSUE` | JOURNEY | iPad + Apple Pencil | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-IPD-05-WRITE` | JOURNEY | iPad + Apple Pencil | 05 Handwriting input (Apple Pencil) | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw. The first "Read my answer" opens the one-time prompt naming OpenAI (D17) above the ink, its two buttons answer a finger, nothing is read until "Send it to be read", and only then is the picture sent; "No, I'll type my answers" leaves the student typing. |
| `DM-IPD-06-PHOTO` | JOURNEY | iPad + Apple Pencil | 06 Photo of working | The camera or picker captures a page of working; a profile that has not yet answered the D17 prompt is asked before the photo is sent; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-IPD-07-TRANSCRIPT` | JOURNEY | iPad + Apple Pencil | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-IPD-08-MARK` | JOURNEY | iPad + Apple Pencil | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-IPD-09-HISTORY` | JOURNEY | iPad + Apple Pencil | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-AND-01-INSTALL` | JOURNEY | Android phone | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-AND-02-OTP` | JOURNEY | Android phone | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-AND-03-GUARDIAN` | JOURNEY | Android phone | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-AND-04-ISSUE` | JOURNEY | Android phone | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-AND-05-WRITE` | JOURNEY | Android phone | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw. The first "Read my answer" opens the one-time prompt naming OpenAI (D17) above the ink, its two buttons answer a finger, nothing is read until "Send it to be read", and only then is the picture sent; "No, I'll type my answers" leaves the student typing. |
| `DM-AND-06-PHOTO` | JOURNEY | Android phone | 06 Photo of working | The camera or picker captures a page of working; a profile that has not yet answered the D17 prompt is asked before the photo is sent; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-AND-07-TRANSCRIPT` | JOURNEY | Android phone | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-AND-08-MARK` | JOURNEY | Android phone | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-AND-09-HISTORY` | JOURNEY | Android phone | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-ANT-01-INSTALL` | JOURNEY | Android tablet | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-ANT-02-OTP` | JOURNEY | Android tablet | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-ANT-03-GUARDIAN` | JOURNEY | Android tablet | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-ANT-04-ISSUE` | JOURNEY | Android tablet | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-ANT-05-WRITE` | JOURNEY | Android tablet | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw. The first "Read my answer" opens the one-time prompt naming OpenAI (D17) above the ink, its two buttons answer a finger, nothing is read until "Send it to be read", and only then is the picture sent; "No, I'll type my answers" leaves the student typing. |
| `DM-ANT-06-PHOTO` | JOURNEY | Android tablet | 06 Photo of working | The camera or picker captures a page of working; a profile that has not yet answered the D17 prompt is asked before the photo is sent; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-ANT-07-TRANSCRIPT` | JOURNEY | Android tablet | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-ANT-08-MARK` | JOURNEY | Android tablet | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-ANT-09-HISTORY` | JOURNEY | Android tablet | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-IPH-10-VOICEOVER` | ACCESSIBILITY | iPhone | 10 VoiceOver | With VoiceOver on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element; the writing surface is announced. |
| `DM-IPD-10-VOICEOVER` | ACCESSIBILITY | iPad + Apple Pencil | 10 VoiceOver | With VoiceOver on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element; the writing surface is announced. |
| `DM-AND-10-TALKBACK` | ACCESSIBILITY | Android phone | 10 TalkBack | With TalkBack on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element. |
| `DM-ANT-10-TALKBACK` | ACCESSIBILITY | Android tablet | 10 TalkBack | With TalkBack on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element. |
| `DM-IPH-11-KEYBOARD` | ACCESSIBILITY | iPhone | 11 Full Keyboard Access / hardware keyboard | With Full Keyboard Access on (iPhone/iPad: Settings → Accessibility → Keyboards) or a hardware keyboard attached (Android tablet), Tab reaches every control of the sign-in card and the question card in order, Space/Return activates it, focus is visible, and nothing traps focus. |
| `DM-IPD-11-KEYBOARD` | ACCESSIBILITY | iPad + Apple Pencil | 11 Full Keyboard Access / hardware keyboard | With Full Keyboard Access on (iPhone/iPad: Settings → Accessibility → Keyboards) or a hardware keyboard attached (Android tablet), Tab reaches every control of the sign-in card and the question card in order, Space/Return activates it, focus is visible, and nothing traps focus. |
| `DM-ANT-11-KEYBOARD` | ACCESSIBILITY | Android tablet | 11 Full Keyboard Access / hardware keyboard | With Full Keyboard Access on (iPhone/iPad: Settings → Accessibility → Keyboards) or a hardware keyboard attached (Android tablet), Tab reaches every control of the sign-in card and the question card in order, Space/Return activates it, focus is visible, and nothing traps focus. |
| `DM-IPH-12-TEXTSIZE` | ACCESSIBILITY | iPhone | 12 Largest text size | At the largest accessibility text size the app stays usable with nothing clipped and no sideways scroll. What to expect today: on iPhone and iPad the WHOLE PAGE scales through the viewport, capped so the layout never drops below 360 CSS px wide (about 1.12× on a 402 pt iPhone, up to 1.5× on iPad); on Android the WebView follows the system font scale. Record the scale you saw; a pass is "usable at that scale", not "text reflowed like a native app". |
| `DM-IPD-12-TEXTSIZE` | ACCESSIBILITY | iPad + Apple Pencil | 12 Largest text size | At the largest accessibility text size the app stays usable with nothing clipped and no sideways scroll. What to expect today: on iPhone and iPad the WHOLE PAGE scales through the viewport, capped so the layout never drops below 360 CSS px wide (about 1.12× on a 402 pt iPhone, up to 1.5× on iPad); on Android the WebView follows the system font scale. Record the scale you saw; a pass is "usable at that scale", not "text reflowed like a native app". |
| `DM-AND-12-TEXTSIZE` | ACCESSIBILITY | Android phone | 12 Largest text size | At the largest accessibility text size the app stays usable with nothing clipped and no sideways scroll. What to expect today: on iPhone and iPad the WHOLE PAGE scales through the viewport, capped so the layout never drops below 360 CSS px wide (about 1.12× on a 402 pt iPhone, up to 1.5× on iPad); on Android the WebView follows the system font scale. Record the scale you saw; a pass is "usable at that scale", not "text reflowed like a native app". |
| `DM-ANT-12-TEXTSIZE` | ACCESSIBILITY | Android tablet | 12 Largest text size | At the largest accessibility text size the app stays usable with nothing clipped and no sideways scroll. What to expect today: on iPhone and iPad the WHOLE PAGE scales through the viewport, capped so the layout never drops below 360 CSS px wide (about 1.12× on a 402 pt iPhone, up to 1.5× on iPad); on Android the WebView follows the system font scale. Record the scale you saw; a pass is "usable at that scale", not "text reflowed like a native app". |
| `DM-IPD-13-ROTATE` | ORIENTATION | iPad + Apple Pencil | 13 Rotate mid-attempt | Rotating the device with ink, a typed answer and a transcript on the page keeps all three; the writing surface stays aligned with the ruled paper after rotation and after scrolling; nothing is re-issued or lost. (iPhone is portrait-only by design and has no case.) |
| `DM-AND-13-ROTATE` | ORIENTATION | Android phone | 13 Rotate mid-attempt | Rotating the device with ink, a typed answer and a transcript on the page keeps all three; the writing surface stays aligned with the ruled paper after rotation and after scrolling; nothing is re-issued or lost. (iPhone is portrait-only by design and has no case.) |
| `DM-ANT-13-ROTATE` | ORIENTATION | Android tablet | 13 Rotate mid-attempt | Rotating the device with ink, a typed answer and a transcript on the page keeps all three; the writing surface stays aligned with the ruled paper after rotation and after scrolling; nothing is re-issued or lost. (iPhone is portrait-only by design and has no case.) |
| `DM-IPD-14-SPLITVIEW` | ORIENTATION | iPad + Apple Pencil | 14 Split View | With Pri in Split View beside another app (half and a third of the screen), the question card, the writing surface and the mode switch fit without sideways scroll; Pencil ink lands where the pen touches; resizing the split keeps the ink aligned. |
| `DM-IPD-15-STAGEMANAGER` | ORIENTATION | iPad + Apple Pencil | 15 Stage Manager | With Stage Manager on, a resized Pri window keeps the question card, the writing surface and the mode switch usable; dragging the window and resizing it mid-attempt keeps the ink aligned with the paper and loses nothing. |
| `DM-IPH-16-REINSTALL` | RESTORE | iPhone | 16 Sign out, delete the app, reinstall, sign in | After signing out, deleting the app, reinstalling the same build and signing in, History holds every earlier attempt with its marks and feedback, Progress is unchanged, and the next question continues from the same place. Nothing is duplicated. |
| `DM-IPD-16-REINSTALL` | RESTORE | iPad + Apple Pencil | 16 Sign out, delete the app, reinstall, sign in | After signing out, deleting the app, reinstalling the same build and signing in, History holds every earlier attempt with its marks and feedback, Progress is unchanged, and the next question continues from the same place. Nothing is duplicated. |
| `DM-AND-16-REINSTALL` | RESTORE | Android phone | 16 Sign out, delete the app, reinstall, sign in | After signing out, deleting the app, reinstalling the same build and signing in, History holds every earlier attempt with its marks and feedback, Progress is unchanged, and the next question continues from the same place. Nothing is duplicated. |
| `DM-ANT-16-REINSTALL` | RESTORE | Android tablet | 16 Sign out, delete the app, reinstall, sign in | After signing out, deleting the app, reinstalling the same build and signing in, History holds every earlier attempt with its marks and feedback, Progress is unchanged, and the next question continues from the same place. Nothing is duplicated. |
| `DM-IPH-17-TIMED` | EXAM | iPhone | 17 Timed paper with handwriting | A timed paper of at least 30 minutes is started, at least six answers are handwritten (and read) across it, the clock runs correctly through a lock-and-unlock, submission at the end records every answer, and the analysis shows them. Record the duration and the number of handwritten answers in --notes. |
| `DM-IPD-17-TIMED` | EXAM | iPad + Apple Pencil | 17 Timed paper with handwriting | A timed paper of at least 30 minutes is started, at least six answers are handwritten (and read) across it, the clock runs correctly through a lock-and-unlock, submission at the end records every answer, and the analysis shows them. Record the duration and the number of handwritten answers in --notes. |
| `DM-AND-17-TIMED` | EXAM | Android phone | 17 Timed paper with handwriting | A timed paper of at least 30 minutes is started, at least six answers are handwritten (and read) across it, the clock runs correctly through a lock-and-unlock, submission at the end records every answer, and the analysis shows them. Record the duration and the number of handwritten answers in --notes. |
| `DM-ANT-17-TIMED` | EXAM | Android tablet | 17 Timed paper with handwriting | A timed paper of at least 30 minutes is started, at least six answers are handwritten (and read) across it, the clock runs correctly through a lock-and-unlock, submission at the end records every answer, and the analysis shows them. Record the duration and the number of handwritten answers in --notes. |
| `DM-IPH-18-BACKGROUND` | LIFECYCLE | iPhone | 18 Background and return | With an unsent handwritten answer and typed working on the page, switch to another app for at least two minutes, take a call or a notification, and return: the ink, the working and any transcript are exactly as left, and submitting then marks them. |
| `DM-IPD-18-BACKGROUND` | LIFECYCLE | iPad + Apple Pencil | 18 Background and return | With an unsent handwritten answer and typed working on the page, switch to another app for at least two minutes, take a call or a notification, and return: the ink, the working and any transcript are exactly as left, and submitting then marks them. |
| `DM-AND-18-BACKGROUND` | LIFECYCLE | Android phone | 18 Background and return | With an unsent handwritten answer and typed working on the page, switch to another app for at least two minutes, take a call or a notification, and return: the ink, the working and any transcript are exactly as left, and submitting then marks them. |
| `DM-ANT-18-BACKGROUND` | LIFECYCLE | Android tablet | 18 Background and return | With an unsent handwritten answer and typed working on the page, switch to another app for at least two minutes, take a call or a notification, and return: the ink, the working and any transcript are exactly as left, and submitting then marks them. |
| `DM-IPH-19-STORAGE` | LIFECYCLE | iPhone | 19 Low storage | With the device under 500 MB free, an attempt can be written, read, submitted and found in History; the app says so plainly if a photo cannot be kept; nothing crashes and nothing already recorded is lost. |
| `DM-IPD-19-STORAGE` | LIFECYCLE | iPad + Apple Pencil | 19 Low storage | With the device under 500 MB free, an attempt can be written, read, submitted and found in History; the app says so plainly if a photo cannot be kept; nothing crashes and nothing already recorded is lost. |
| `DM-AND-19-STORAGE` | LIFECYCLE | Android phone | 19 Low storage | With the device under 500 MB free, an attempt can be written, read, submitted and found in History; the app says so plainly if a photo cannot be kept; nothing crashes and nothing already recorded is lost. |
| `DM-ANT-19-STORAGE` | LIFECYCLE | Android tablet | 19 Low storage | With the device under 500 MB free, an attempt can be written, read, submitted and found in History; the app says so plainly if a photo cannot be kept; nothing crashes and nothing already recorded is lost. |
| `DM-IPH-20-MEMORY` | LIFECYCLE | iPhone | 20 Low-memory recovery | After the system reclaims the app in the background (open several heavy apps, or on Android force the process with the developer "background process limit"), reopening Pri restores the unsent draft, the transcript and the session without a sign-in; nothing marked is lost. |
| `DM-IPD-20-MEMORY` | LIFECYCLE | iPad + Apple Pencil | 20 Low-memory recovery | After the system reclaims the app in the background (open several heavy apps, or on Android force the process with the developer "background process limit"), reopening Pri restores the unsent draft, the transcript and the session without a sign-in; nothing marked is lost. |
| `DM-AND-20-MEMORY` | LIFECYCLE | Android phone | 20 Low-memory recovery | After the system reclaims the app in the background (open several heavy apps, or on Android force the process with the developer "background process limit"), reopening Pri restores the unsent draft, the transcript and the session without a sign-in; nothing marked is lost. |
| `DM-ANT-20-MEMORY` | LIFECYCLE | Android tablet | 20 Low-memory recovery | After the system reclaims the app in the background (open several heavy apps, or on Android force the process with the developer "background process limit"), reopening Pri restores the unsent draft, the transcript and the session without a sign-in; nothing marked is lost. |
| `DM-IPH-21-EXPORT` | EXPORT | iPhone | 21 Account export | The account export produces a file through the system share sheet (Files, AirDrop, Drive…) that opens as JSON and contains this account's attempts and no other account's data. |
| `DM-IPD-21-EXPORT` | EXPORT | iPad + Apple Pencil | 21 Account export | The account export produces a file through the system share sheet (Files, AirDrop, Drive…) that opens as JSON and contains this account's attempts and no other account's data. |
| `DM-AND-21-EXPORT` | EXPORT | Android phone | 21 Account export | The account export produces a file through the system share sheet (Files, AirDrop, Drive…) that opens as JSON and contains this account's attempts and no other account's data. |
| `DM-ANT-21-EXPORT` | EXPORT | Android tablet | 21 Account export | The account export produces a file through the system share sheet (Files, AirDrop, Drive…) that opens as JSON and contains this account's attempts and no other account's data. |
| `DM-IPH-22-SHARE` | EXPORT | iPhone | 22 Share and print | A paper or progress page shares through the system sheet and prints (or saves as PDF) with every question, answer and mark legible; the share holds nothing from another profile. |
| `DM-IPD-22-SHARE` | EXPORT | iPad + Apple Pencil | 22 Share and print | A paper or progress page shares through the system sheet and prints (or saves as PDF) with every question, answer and mark legible; the share holds nothing from another profile. |
| `DM-AND-22-SHARE` | EXPORT | Android phone | 22 Share and print | A paper or progress page shares through the system sheet and prints (or saves as PDF) with every question, answer and mark legible; the share holds nothing from another profile. |
| `DM-ANT-22-SHARE` | EXPORT | Android tablet | 22 Share and print | A paper or progress page shares through the system sheet and prints (or saves as PDF) with every question, answer and mark legible; the share holds nothing from another profile. |
<!-- device-matrix-cases:end -->

## Recording a result

```bash
# one case, one device, one build kind, one server, one named human
node scripts/device-matrix-record.mjs record \
  --case DM-IPD-05-WRITE --result pass \
  --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" --pencil "Apple Pencil Pro" \
  --sha <40-hex nominated SHA> --tester "Full Name" --build-kind development --server staging \
  --build "Xcode run 1.0 (3)" --notes "palm rejected; no dropped strokes over 3 lines"

# a fail carries its severity and what was seen
node scripts/device-matrix-record.mjs record --case DM-IPH-12-TEXTSIZE --result fail --severity P2 \
  --device "iPhone 16 Pro Max" --os "iOS 26.1" --sha <40-hex> --tester "Full Name" \
  --build-kind development --server staging --notes "at AX5 the page scaled 1.12x; the mode switch labels clip"

# a case nobody can run yet (no device, no account, no build): say why
node scripts/device-matrix-record.mjs record --case DM-AND-01-INSTALL --result blocked \
  --sha <40-hex> --notes "no Android device available; Kalp to run on the Play device check"

# the table for the release record, one build kind at a time
node scripts/device-matrix-record.mjs report --sha <40-hex> --build-kind development --markdown
node scripts/device-matrix-record.mjs report --sha <40-hex> --build-kind testflight --markdown
node scripts/device-matrix-record.mjs validate      # every ledger line re-checked; runs in npm test
```

The recorder appends to `docs/release/evidence/device-matrix/results.jsonl` (soaks to `soak.jsonl`
beside it; that directory holds a README naming the ledgers, and the ledgers themselves are created by
the first recorded row) and **refuses, writing nothing**, when:

- a `pass` or `fail` has no `--tester`, or the tester is not a person (agent, Claude, CI, bot,
  simulator, placeholder names). The word list is `NOT_A_HUMAN` in the recorder and is matched as
  whole words, case-insensitively, so a real person whose name contains one of them (a surname
  "Test" or "Tester", initials "CI") is refused too; the message names the word. There is no
  override: write the name another way (a middle name, or "Tester, A." becomes "A. Tester-Smith"
  only if that is their name) or ask a colleague to record the row;
- the `--device` is a simulator, emulator or browser automation;
- `--os` is missing, or `--sha` is not a full 40-hex commit;
- `--build-kind` or `--server` is missing, a store build names staging, or a development build names
  production;
- a `fail` has no `--severity` (P0–P3) or no `--notes`; a pass or a blocked row carries a severity;
- `DM-IPD-05-WRITE` is passed without `--pencil`;
- a `blocked` row has no reason in `--notes`;
- a soak is under 30 minutes, has no failure count, or reports failures without notes;
- the case id is not in the table above.

`validate` re-applies the same rules to every stored line of both ledgers, so a hand-edited ledger
cannot smuggle in evidence the recorder would have refused. The latest record per case (per SHA and
build kind with `--sha` / `--build-kind`) is what `report` shows; a re-run on a newer build is a new
row, never an edit.

## Reading the report

- A build is **device-complete for a build kind** when every case of a family is `pass` for that SHA
  and kind. Families that are entirely `blocked` for lack of hardware are reported as such, never as
  passed and never omitted. Development-build and store-build rows are never added together.
- A `fail` blocks the release while it is P0 or P1 until fixed and re-recorded on a new build (new SHA,
  new rows); a P2 or P3 is triaged with its reason in the release record. The old row stays in the
  ledger as history.
- The release record (`ios/PriLearning.swiftpm/RELEASE.md` §11, "physical-device evidence IDs") cites
  the case ids, the SHA, the build kind, the server, the soak and the tester from these ledgers.

## What this matrix still does not cover

- The TestFlight cohort protocol itself (`ios/PriLearning.swiftpm/RELEASE.md` §7) and the Play closed
  test (`docs/release/store/play-closed-testing-runbook.md`).
- Real-writer handwriting accuracy: that is the physical study of the server reader
  (`handwriting/v12/REAL_PENCIL_RELEASE_EVIDENCE.md`), not a device case.
- StoreKit / Play Billing certification runs (`docs/billing/storekit-certification.md`).
