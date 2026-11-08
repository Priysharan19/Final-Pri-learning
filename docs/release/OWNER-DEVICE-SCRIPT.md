# Owner device script: iPhone and iPad with Apple Pencil (V1, D1)

Owner default D1 launches V1 on iPhone and iPad first. Android follows after Google's closed test,
and its two families are waived by name at the release (`device-matrix:AND` and
`device-matrix:ANT`; `docs/release/evidence/go-no-go/README.md`). With those family waivers the
release still requires **every iPhone and iPad case to pass**, on real hardware, recorded by a named
person. This script runs those cases in a sensible order on your two devices and says where each
result goes. It replaces walking the whole four-family matrix by hand.

- **Who:** you, the owner. You are the named tester on every row. An agent can prepare the build
  and the shell commands; it never records a result (the recorder refuses agent names).
- **Devices:** your iPhone (16 Pro Max) and your iPad Pro 11-inch (4th generation) with its Apple
  Pencil. Have both charged and side by side.
- **Time:** Part A takes about 115 minutes in two sittings: A1–A13 (about 55 minutes), then
  A14–A18 (about 60). The timed paper alone is 30 minutes, and both devices run it at once. Part B takes about
  30 minutes after the promotion.
- **Case ids:** these follow the matrix in L4's #737 (`docs/release/device-matrix.md`): 23 iPhone
  and 26 iPad cases at its head of 9 November (96 cases in all). On a `main` without #737, only the
  18 journey cases (01–09) exist; record those and skip the rest.

## Before you start (10 minutes)

1. **The build.** Part A uses the **development build of the candidate SHA**, run from Xcode on
   both paired devices and pointed at staging. That is the rule of #737's `device-matrix.md` ("Which
   server a device build talks to"); its recorder refuses a TestFlight build recorded against
   staging. The Director's plan instead has the TestFlight build reach staging through
   `app.prilearning.com` before GO. Until the Director and L4 settle that, follow #737.
2. **The SHA.** Open the app's diagnostics on each device. The release SHA shown there must equal
   the candidate (`docs/release/FREEZE-RUNBOOK.md` F1, on #754).
3. **Accounts.** These are test accounts only, never a student's, and every one is deleted in A16:
   - an adult account on your test mailbox;
   - two child accounts, one per device, each with a parent address you can read;
   - the other device, used as "the parent's own device" and as the second device for History.

   Plus-addresses (`you+child1@…`) work if your mailbox supports them.
4. **The recorder.** Run this once, in a terminal at a checkout of the candidate:

   ```bash
   export SHA=<40-hex candidate SHA>
   export ME="<your full name>"
   rec() { node scripts/device-matrix-record.mjs record --sha "$SHA" --tester "$ME" --build-kind development --server staging "$@"; }
   IPH=(--device "iPhone 16 Pro Max" --os "iOS <as Settings shows it>")
   IPD=(--device "iPad Pro 11-inch (4th generation)" --os "iPadOS <as Settings shows it>")
   PEN=(--pencil "<your Apple Pencil model>")
   ```

   A pass is `rec --case DM-IPH-01-INSTALL --result pass "${IPH[@]}"`.
   A fail adds a severity and what you saw: `--result fail --severity P1 --notes "…"`.
   A case you cannot run is `--result blocked --notes "<what is missing>"` (at least five characters).
   The recorder refuses a row it cannot believe, and writes nothing then. Each case's full
   expected result is `node scripts/device-matrix-record.mjs cases --markdown`.

## The same script as a checklist

`docs/release/owner-device-script.json` is this script as data, for the Owner Console's tick-box
checklist. Each item has an id, a family, a title, a precondition, short steps, the expected result,
the evidence to capture, and whether billing must be configured first. The JSON is generated from
the recorder's case list (`node tools/release-owner-device-script.mjs --write`), and a test fails
when it is stale, so it always names the cases the release requires. It holds instructions only;
nothing in it is a result.

When the console exports your results (format `pri-device-evidence-export`, one export per
sitting), import them with:

```bash
node tools/release-device-import.mjs <export.json>
```

The JSON's `evidenceExport.shape` names the fields this checkout's recorder keeps, and every value
in it is a `<placeholder>`: a form filled from it cannot be imported. With #737 the export also
carries the build kind, the server, a fail's severity and the soak (A17, B5) in its `soaks` list.

The importer writes **only through the recorder**, after checking every record by the recorder's
own rules. One bad record refuses the whole file, and nothing is written: an agent or placeholder
tester or a simulator (whatever the result), an unknown case, a short SHA, a missing Pencil model,
a duplicate case, a value that is not text, or a field the recorder does not record. The records
reach the ledger in one append. In-app deletion and the sandbox purchase are not device-matrix
cases on a `main` without #737; they go where the JSON's `recordIn` says.

## Part A — the candidate on staging (development build)

| # | Case ids | Do | You should see | Record |
|---|---|---|---|---|
| A1 | `DM-IPH-01-INSTALL`, `DM-IPD-01-INSTALL` | Install the development build on both devices and open it | the sign-in card; diagnostics show `$SHA` | `rec --case DM-IPH-01-INSTALL --result pass "${IPH[@]}"`, and the same for `IPD` |
| A2 | `DM-IPH-02-OTP`, `DM-IPD-02-OTP` | On each device, sign in to the adult account with the email code. Close the app fully, then reopen it | the 6-digit code arrives in your mailbox; you are still signed in after reopening | `-02-OTP` for each |
| A3 | `DM-IPH-03-GUARDIAN`, `DM-IPD-03-GUARDIAN` | Sign out. On the iPad, create child account 1. On the **iPhone**, approve it in Safari at `/guardian/consent` with the parent's code. Then the reverse: child account 2 on the iPhone, approved from the iPad | each child screen waits at "waiting for your parent", then moves on by itself after approval; until then, questions and sync are refused | `-03-GUARDIAN` for each |
| A4 | `-04-ISSUE` ×2 | Sign back in to the adult account. Open Practice and get a question. Turn on aeroplane mode, then turn it off | the question is the server's; aeroplane mode shows the offline state; the question returns | `-04-ISSUE` for each |
| A5 | `-05-WRITE` ×2 | Write the answer: a finger on the iPhone, the **Pencil** on the iPad, with your palm resting on the screen. Press "Read my answer" | no lag or dropped strokes; the palm does not draw; the **first** read opens the one-time prompt naming OpenAI (D17), and nothing is sent until "Send it to be read" | iPhone: `rec … "${IPH[@]}"`. iPad: `rec --case DM-IPD-05-WRITE --result pass "${IPD[@]}" "${PEN[@]}"` |
| A6 | `-06-PHOTO` ×2 | Photograph a page of working, then once more holding the device sideways | the photo is sent for reading; the sideways one shows the right way up | `-06-PHOTO` for each |
| A7 | `-07-TRANSCRIPT` ×2 | Correct one misread line, then confirm | the transcript, line by line; an unsure reading asks you to confirm before marking | `-07-TRANSCRIPT` for each |
| A8 | `-08-MARK` ×2 | Submit a wrong answer, then the right one | the server's mark (earned / possible) with first-error feedback; a second try; the worked solution after the right answer | `-08-MARK` for each |
| A9 | `-09-HISTORY` ×2 | Close and reopen each app; look at History on **both** devices | each attempt is in History on its own device after reopening, and on the other device after sync | `-09-HISTORY` for each |
| A10 | `-10-VOICEOVER`, `-12-TEXTSIZE`, `-23-VOICEOVERTEXT` ×2 | Settings → Accessibility → Display & Text Size → Larger Text: the **largest** size (AX5). Turn VoiceOver on. Then sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", listen to the transcript, submit, listen to the mark, and find the attempt in History | every control is named and reached in order; focus never lands on an unlabelled element; the writing surface is announced; the OpenAI prompt (D17) is read in full with both buttons reachable; nothing is clipped and nothing scrolls sideways at the largest size | one run covers all three cases on each device: record `-10-VOICEOVER`, `-12-TEXTSIZE` and `-23-VOICEOVERTEXT` (the last only with #737). Turn VoiceOver off afterwards |
| A11 | `-11-KEYBOARD` ×2 | Settings → Accessibility → Keyboards → Full Keyboard Access on, with a hardware keyboard attached | Tab reaches every control of the sign-in card and the question card in order; Space or Return activates it; focus is visible; nothing traps focus | `-11-KEYBOARD` for each. With no hardware keyboard, record `--result blocked --notes "no hardware keyboard"` |
| A12 | `DM-IPD-13-ROTATE`, `-14-SPLITVIEW`, `-15-STAGEMANAGER` | iPad only. With ink, a typed answer and a transcript on the page: rotate; then Split View at a half and a third; then Stage Manager, resizing and dragging the window | everything kept; the Pencil ink stays on the ruled paper and lands where the pen touches; no sideways scroll | three iPad rows |
| A13 | `-16-REINSTALL` ×2 | Sign out, delete the app, reinstall the same build, sign in | History holds every earlier attempt with marks and feedback; Progress unchanged; nothing duplicated | `-16-REINSTALL` for each |
| A14 | `-17-TIMED` ×2 | **Second sitting.** Start a timed paper of at least 30 minutes on **both** devices. Handwrite at least six answers on each, alternating devices. Lock and unlock once. Submit at the end | the clock runs right through the lock; every answer is recorded; the analysis shows them | `-17-TIMED` for each, with `--notes "<minutes> min, <n> handwritten"` |
| A15 | `-18-BACKGROUND`, `-19-STORAGE`, `-20-MEMORY` ×2 | **Background:** leave an unsent handwritten answer and typed working, switch apps for 2 minutes, then return. **Storage:** fill the device to under 500 MB free (a large video download), then write, read, submit and check History. **Memory:** open several heavy apps until Pri is reclaimed, then reopen it | the page exactly as left; plain messages and no crash under low storage; the draft, transcript and session restored without signing in | six rows. Free the storage afterwards |
| A16 | `-21-EXPORT`, `-22-SHARE` ×2, then **in-app deletion** (`-24-DELETE` ×2) | Export the account through the share sheet and open the file. Share and print (or save as PDF) a paper. Then delete **each** test account from the app: Settings → Account → Delete, confirming with a fresh email code; sign in again with the same address; after sync, look at History on the other device | the JSON holds only this account's attempts; the PDF is legible; after deletion you are back at the sign-in card, the account is gone (signing in again starts a new, empty account) and its History is gone on both devices | `-21-EXPORT` and `-22-SHARE` for each. With #737, deletion is the matrix case `-24-DELETE` on each device. Without it, deletion is not a matrix case: write it in the GO/NO-GO record as store-gate evidence (`gates.store.evidence`: "in-app deletion, iPhone and iPad, `$SHA`, by <name>"). Apple requires it (guideline 5.1.1(v)) |
| A17 | soak | The second sitting (A14–A16) on the iPad is the soak window | no crash or lost work in 45 minutes or more | `node scripts/device-matrix-record.mjs soak --device "iPad Pro 11-inch (4th generation)" --os "iPadOS …" --pencil "…" --sha "$SHA" --tester "$ME" --build-kind development --server staging --minutes <n> --failures <n>` (#737) |
| A18 | sandbox purchase and restore (`-25-PURCHASE`, `-26-RESTOREPURCHASE` ×2) | **BLOCKED until billing.** The Paid Apps Agreement is not signed, so the products cannot be priced (`docs/operations/production-config-v1.md` row 8, on #752). When it is: sign in to a Sandbox Apple Account (Settings → App Store), buy the monthly plan on the Premium screen (and once cancel the sheet instead), then delete and reinstall and press "Restore purchases"; restore on the other device too | Premium after the purchase and after each restore, confirmed by the server (`/v1/entitlements`); a cancelled sheet changes nothing; the app shows only the store's price | Today: `--result blocked --notes "Paid Apps Agreement not active; products not priced"` for each. With #737 these are iPhone and iPad matrix cases, which no family waiver covers, so **the release cannot be nominated until billing works and they pass**. The StoreKit certification step 4 scenarios also go in the release record (`ios/PriLearning.swiftpm/RELEASE.md` §11; `docs/billing/storekit-certification.md` step 4) |

Then check the report: `node scripts/device-matrix-record.mjs report --sha "$SHA" --build-kind development` (drop `--build-kind` on a `main` without #737). **Every IPH and
IPD row must read PASS.** A `fail` blocks the release until it is fixed and re-recorded on a new build.

## Part B — the store build on production (after promotion, release held)

#737 asks for a short re-run on the signed TestFlight build once production serves the candidate,
before the store release is approved. Use the same steps, recorded with
`--build-kind testflight --server production` instead of development/staging:

| # | Cases (both devices) | Same as |
|---|---|---|
| B1 | `-01-INSTALL` (from TestFlight), `-02-OTP` | A1, A2 |
| B2 | `-04-ISSUE`, `-05-WRITE`, `-07-TRANSCRIPT`, `-08-MARK`, `-09-HISTORY` | A4–A9 |
| B3 | `-10-VOICEOVER`, `-23-VOICEOVERTEXT` | A10 |
| B4 | `-16-REINSTALL` | A13 |
| B5 | one soak (`soak … --build-kind testflight --server production`) | A17 |
| B6 | in-app deletion of every production test account (`-24-DELETE`) | A16 |
| B7 | sandbox purchase and restore (`-25-PURCHASE`, `-26-RESTOREPURCHASE`): **BLOCKED until billing**, and it also needs the owner's decision on sandbox in production (`docs/operations/production-config-v1.md` note 8, on #752) | A18 |

## What this script does not do

- It does not cover Android. D1 waives the Android families by name, and the waiver is a GitHub
  comment you post yourself.
- It does not replace the real-writer study of the server reader (Gate C), the StoreKit
  certification runs, or the store submission.
- It records nothing for you, and no agent may fill a row.
