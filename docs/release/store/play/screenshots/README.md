# Google Play screenshots — EMULATOR captures

**These are emulator captures, not physical-device screenshots.** They were taken on 19 October 2026 by
`StoreShots` during the real Android instrumented journey (`PRI_STORE_SHOTS=1 android/scripts/run-instrumented.sh product`, `-e priShots 1`).

- **Source:** `task/merge-train-20261019-10` at `c1c972e7d`, plus the opt-in capture hook on `agent/mission/android/m-504-play-screenshots`. The app build is unchanged.
- **Devices:** local AVDs, Android 36 (Google APIs, arm64), with the host GPU and a visible window.
  - `phone/`: Pixel 7 profile, 1080×2400, portrait.
  - `tablet/`: Pixel Tablet profile, 2560×1600, landscape.
- **Server and account:** the local Pri server fixture (`scripts/cloud-fixture-server.mjs`, a throwaway database) and a synthetic test account, "Android Student".
  - The fixture server stands in for staging.
  - No real student, guardian or production data appears.
  - Marks shown are the server's deterministic marks for the server-issued question.
  - The right answer was typed by the test from the server's sealed copy (`scripts/journey-oracle.mjs`).
- **Handwriting:** the Write screen shows synthetic strokes injected by `InkInputTest`, not a person's handwriting.

| File | Screen |
| --- | --- |
| `01-sign-in.png` | Account-first sign-in card (#477) |
| `02-practice-question.png` | Server-issued practice question |
| `03-write.png` | Write (finger/stylus handwriting) |
| `04-photo.png` | Photo answer mode |
| `05-feedback.png` | Server-marked feedback |
| `06-history.png` | History / Review |

Before Play upload, the store listing still needs a review against Play's screenshot rules, the owner's choice
of frames and captions, and physical-device captures if the listing is to show them.
