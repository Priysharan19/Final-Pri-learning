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

It does **not** replace the handwriting evidence programmes (`LAUNCH-RUNBOOK.md` §3: corpus and the
physical iPad study), the StoreKit / Play Billing certification runs, or `ios/PriLearning.swiftpm/RELEASE.md`
§7's TestFlight evidence gate; it is the journey check those rows point at.

## Before a session

1. The build is a nominated `main` SHA (`node scripts/release-nominate.mjs <sha>`) installed from its
   test track (TestFlight; Play internal testing). Write down the SHA the app's diagnostics show — it is
   recorded with every case and must equal the nominated one.
2. The server side of the same journey already passed on staging without a device:
   `node tools/acceptance/staging-acceptance.mjs --email <mailbox> --tester "<name>"` (steps 0, A–E).
   A device case that fails where the staging acceptance passed is a shell or input defect; one that
   fails in both is a server defect.
3. You have: a real mailbox on the device (step 02), a second mailbox or phone for the parent (step 03,
   on the parent's **own** device), a second signed-in device for step 09, and for `IPD` an Apple Pencil
   whose model you record.
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
`blocked` with that reason until someone with the hardware records them.

## Cases

Case ids are stable: `DM-<family>-<seq>-<step>`. The table below is generated from
`scripts/device-matrix-record.mjs` (`node scripts/device-matrix-record.mjs cases --markdown`) and a
test keeps the two equal; edit the script, not the table.

<!-- device-matrix-cases:start -->
| Case | Family | Step | What the tester must see |
|---|---|---|---|
| `DM-IPH-01-INSTALL` | iPhone | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-IPH-02-OTP` | iPhone | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-IPH-03-GUARDIAN` | iPhone | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-IPH-04-ISSUE` | iPhone | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-IPH-05-WRITE` | iPhone | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw; "Read my answer" sends the picture. |
| `DM-IPH-06-PHOTO` | iPhone | 06 Photo of working | The camera or picker captures a page of working; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-IPH-07-TRANSCRIPT` | iPhone | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-IPH-08-MARK` | iPhone | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-IPH-09-HISTORY` | iPhone | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-IPD-01-INSTALL` | iPad + Apple Pencil | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-IPD-02-OTP` | iPad + Apple Pencil | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-IPD-03-GUARDIAN` | iPad + Apple Pencil | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-IPD-04-ISSUE` | iPad + Apple Pencil | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-IPD-05-WRITE` | iPad + Apple Pencil | 05 Handwriting input (Apple Pencil) | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw; "Read my answer" sends the picture. |
| `DM-IPD-06-PHOTO` | iPad + Apple Pencil | 06 Photo of working | The camera or picker captures a page of working; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-IPD-07-TRANSCRIPT` | iPad + Apple Pencil | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-IPD-08-MARK` | iPad + Apple Pencil | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-IPD-09-HISTORY` | iPad + Apple Pencil | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-AND-01-INSTALL` | Android phone | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-AND-02-OTP` | Android phone | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-AND-03-GUARDIAN` | Android phone | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-AND-04-ISSUE` | Android phone | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-AND-05-WRITE` | Android phone | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw; "Read my answer" sends the picture. |
| `DM-AND-06-PHOTO` | Android phone | 06 Photo of working | The camera or picker captures a page of working; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-AND-07-TRANSCRIPT` | Android phone | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-AND-08-MARK` | Android phone | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-AND-09-HISTORY` | Android phone | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
| `DM-ANT-01-INSTALL` | Android tablet | 01 Install and first launch | The build installs from its test track and opens to the sign-in card. The release identity shown in the app's diagnostics equals the build SHA being recorded. |
| `DM-ANT-02-OTP` | Android tablet | 02 Email one-time-code sign-in | A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app. |
| `DM-ANT-03-GUARDIAN` | Android tablet | 03 Guardian consent for a child account | A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then. |
| `DM-ANT-04-ISSUE` | Android tablet | 04 Server-issued question | A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns. |
| `DM-ANT-05-WRITE` | Android tablet | 05 Handwriting input | Writing with this family's input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw; "Read my answer" sends the picture. |
| `DM-ANT-06-PHOTO` | Android tablet | 06 Photo of working | The camera or picker captures a page of working; the picture is sent for reading; a photo taken sideways is shown the right way up. |
| `DM-ANT-07-TRANSCRIPT` | Android tablet | 07 Transcript shown; explicit correction or confirmation | The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking. |
| `DM-ANT-08-MARK` | Android tablet | 08 Server mark and criterion feedback | The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution. |
| `DM-ANT-09-HISTORY` | Android tablet | 09 History and persistent sync | The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync. |
<!-- device-matrix-cases:end -->

## Recording a result

```bash
# one case, one device, one build, one named human
node scripts/device-matrix-record.mjs record \
  --case DM-IPD-05-WRITE --result pass \
  --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" --pencil "Apple Pencil Pro" \
  --sha <40-hex nominated SHA> --tester "Full Name" --build "TestFlight 4.0 (2)" \
  --notes "palm rejected; no dropped strokes over 3 lines"

# a case nobody can run yet (no device, no account, no build): say why
node scripts/device-matrix-record.mjs record --case DM-AND-01-INSTALL --result blocked \
  --sha <40-hex> --notes "no Android device available; Kalp to run on the Play device check"

# the table for the release record
node scripts/device-matrix-record.mjs report --sha <40-hex> --markdown
node scripts/device-matrix-record.mjs validate      # every ledger line re-checked; runs in npm test
```

The recorder appends to `docs/release/evidence/device-matrix/results.jsonl` and **refuses, writing
nothing**, when:

- a `pass` or `fail` has no `--tester`, or the tester is not a person (agent, Claude, CI, bot,
  simulator, placeholder names);
- the `--device` is a simulator, emulator or browser automation;
- `--os` is missing, or `--sha` is not a full 40-hex commit;
- `DM-IPD-05-WRITE` is passed without `--pencil`;
- a `blocked` row has no reason in `--notes`;
- the case id is not in the table above.

`validate` re-applies the same rules to every stored line, so a hand-edited ledger cannot smuggle in
evidence the recorder would have refused. The latest record per case (per SHA with `--sha`) is what
`report` shows; a re-run on a newer build is a new row, never an edit.

## Reading the report

- A build is **device-complete** when every case of a family is `pass` for that SHA. Families that are
  entirely `blocked` for lack of hardware are reported as such, never as passed and never omitted.
- A `fail` blocks the release until fixed and re-recorded on a new build (new SHA, new rows); the old
  row stays in the ledger as history.
- The release record (`ios/PriLearning.swiftpm/RELEASE.md` §11, "physical-device evidence IDs") cites
  the case ids, the SHA and the tester from this ledger.
