# Handwriting is read automatically after a pause

**Status:** owner decision, 18 November 2026.
**Supersedes:** the read-on-request rule of #440 / #942 ("a read happens only when the student presses Read my answer; no timer or automatic read").
**Owner, verbatim:** "make it automatically read handwriting in the background, dont need to press read."

## What it is

Where the student has already agreed to the reader (D17), is signed in and is online, the page they are writing is read on its own once the pen has rested for about 1.3 seconds (`AUTO_READ_IDLE_MS`). The reading is kept quietly and is not shown (19 Nov 2026); it is available on demand from the marked page ("See how Pri read this line"). **Read my answer** is no longer a step the student takes.

## What did not change

- **Answer-blind.** The reader receives the picture and nothing else, exactly as for a press of Read my answer. No expected answer, solution or mark ever reaches it.
- **A read never marks.** Marking is asked for only by **Mark my working**. **Superseded 19 Nov 2026 (owner decision, ADR-0001 amendment):** the student no longer confirms the reading ("Check what Pri read", #999 / #1016, is removed) and the reading is no longer shown before marking. The automatic reading runs silently; one press marks the page; a line the reader was not sure of is never judged (reading floor) and is shown as not checked.
- **Consent first.** An automatic read never opens the permission prompt; only a press of Read my answer can. Until the student has said yes, nothing is sent.
- **Exam room.** It does not ask for automatic reading. Exam reads follow the exam rules (taken at submission, nothing shown before).
- **Writing is never slowed.** The read is a network request off the canvas path; the ink surface does no work for it.

## Behaviour

| Situation | What happens |
| --- | --- |
| Pen rests ~1.3 s on a page not yet read | One read of the page as it stands |
| The page changes while a read is out | That read is cancelled; the pause starts again |
| The page is unchanged since its last read, or was already tried | Not read again |
| More than 12 automatic reads of one page in a visit | Stops (the server also caps a question at 60 reads a day) |
| Offline | "Offline: will read when you're online"; reading resumes when the connection returns |
| Signed out, no consent, reader off | Nothing is read; the existing reason is shown |

States shown: Reading… · Read · Read · check highlighted parts · Couldn't read this part · Offline: will read when you're online.

A student can turn it off (Settings → Reading my handwriting). The preference stays on the device.

## Cost and abuse guard

- Per account: 120 reads an hour (`/practice/:id/recognize`), 240 an hour (`/handwriting/transcribe`), both existing.
- **New:** per account per question, 60 paid reads a day on `/handwriting/transcribe` (`READ_QUESTION_LIMIT`, keyed by the question id the client sends), refused before any provider work with a coded 429 and `Retry-After`.
- Deployment-wide: the daily paid-call ceiling (`spendCeiling.js`) still applies and is unchanged.
- Client: one read in flight, an unchanged page is never read twice, 12 automatic reads of a page per visit.
- Provider usage is logged as before.

**Estimate of the per-student cost (an assumption, not a measurement).** One page read is one vision call. Assuming roughly US$0.004–0.01 a call, a student who writes by hand on 25 questions a day with about 3 automatic reads on each (a pause after each line or two) makes about 75 reads, about **US$0.30–0.75 a day** on a heavy day, against about 25 reads, US$0.10–0.25, when reads were pressed. The hard bounds above limit the worst case to 60 reads a question and 120 an hour (about US$0.50–1.20 an hour). The figures must be replaced with the real per-call price from the provider invoice before they are quoted anywhere; what the code guarantees is the caps, not the price.

## Not done

- Reads are of the whole page, not only changed regions: region-level incremental reads need a server API that accepts a partial picture and merges the result, which does not exist. The "only when changed" part is page-level (an unchanged page is not read again).
- No physical iPad or Apple Pencil evidence; the tours drive a real browser and the real server with a scripted reader.
