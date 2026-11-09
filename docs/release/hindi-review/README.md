# Hindi review packet (D11)

**Status: No native-speaker review on record.** No native speaker has reviewed the Hindi interface, and this packet does not say otherwise. 2780 of the 2872 catalogue strings were last changed in a commit marked as agent-written ("agent-marked"). The other 92 were last changed in commits that do not record who wrote them ("author not recorded"). Neither marking means a person checked the Hindi, so every row is flagged for review.

Decision D11 (docs/release/V1_DECISIONS_2026-11-01.md) keeps the Hindi switch and requires a native-speaker review before release. `docs/i18n.md` sets the rule: a machine-authored translation is not reviewed until a native speaker who knows the school register has read it on screen.

## What is in the packet

- `screens/`: every one of the **2872** catalogue strings (`client/src/i18n/strings.hi.js` beside `strings.en.js`), grouped into 10 screens.
- `strings.csv`: the same rows as a working sheet, with columns for the reviewer.
- `ncert-terms.md`: the 99 NCERT maths terms and how the catalogue uses each one.
- `other-sources.md`: Hindi from outside the catalogue (16 notices, 20 spoken-maths samples, 137 skill labels, the language picker) and the four legal notices, identified by hash.
- `manifest.json`: hashes of every source this packet was generated from.

| Screen | Tier | Strings |
|---|---|---|
| [Sign-in, sign-up, guardian consent and account](screens/01-account-and-consent.md) | P1 | 477 |
| [App shell, navigation, legal pages and error screens](screens/02-shell-and-navigation.md) | P2 | 261 |
| [Home, study plan, tasks and reminders](screens/03-home-and-plan.md) | P2 | 208 |
| [Practice, writing and photo answers, marking and feedback](screens/04-practice-and-answering.md) | P2 | 558 |
| [Timed papers and exam analysis](screens/05-exams.md) | P2 | 247 |
| [Progress and placement](screens/06-progress-and-placement.md) | P2 | 112 |
| [Notes, the NCERT chapter library and explanations](screens/07-notes-and-ncert.md) | P2 | 332 |
| [Settings, account sync and reading consent](screens/08-settings-and-sync.md) | P2 | 281 |
| [Rush and match games](screens/09-games.md) | P3 | 64 |
| [Surfaces the V1 decisions keep away from students](screens/10-not-in-v1.md) | P4 | 332 |

## Review order

1. **P1, consent and account (486 strings).** Sign-in, sign-up, guardian consent, account deletion, and the settings copy that says what leaves the device. 51 of these are also flagged `consent/legal`. They are legal artefacts as well as translations, so counsel reviews them too. The legal notices in `other-sources.md` go with this tier.
2. **P2, the release journey (1990 strings).** Home, practice, writing and photo answers, marking and feedback, exams, progress, notes, settings. Read these on screen where you can.
3. **P3, games (64 strings).**
4. **P4, not in V1 (332 strings).** Classes, teacher tools, the tutor, calibration and Australian progress. The V1 decisions keep these away from students; they are listed so nothing is left out.

## Flags

- **English changed after this Hindi was last edited** (5 strings): the English line has a later commit than the Hindi. Check that the Hindi still says what the English now says.
- **placeholders differ from English** (0): the `{name}` values do not match. Usually that is a bug.
- **same text as English** (3): the Hindi string equals the English, such as a proper noun or a symbol. Confirm that is right.
- **consent/legal: counsel reviews too** (51).
- Commit marking: 2780 of 2872 strings were last changed in a commit marked as agent-written, and the rest in commits with no author record.

## What to check

The rules the strings were written to are in the header of `strings.hi.js` and in `docs/i18n.md`. They are proposals for you to confirm, not settled facts:

- The register is आप, with -ें on buttons (सहेजें) and -इए in instructions (ज्ञात कीजिए), as in NCERT Hindi-medium books.
- Maths terms are NCERT's (see `ncert-terms.md`). Proper names stay in Latin script: Pri Learning, NCERT, CBSE, JEE.
- Numerals are 0–9, not ०–९. Sentences end with ।. A counted noun takes the oblique form before a postposition (10 अंकों में से).
- Keep every `{name}` placeholder exactly as written. Questions themselves stay in English by design (D11), so only interface text is in scope.

Write findings in `strings.csv` (reviewer columns) or in the OK? / Suggested Hindi / Note columns of the screen files. An agent applies the corrections to `strings.hi.js` in a PR that names you as the source. It does not mark anything reviewed.

## Sign-off

Fill in one row per reviewer when the review is done. A row means that person read the listed scope, at the catalogue hash shown, on screen, and that every correction they asked for has been applied or recorded. Nobody has signed yet.

| Reviewer | Qualification | Scope reviewed | Catalogue sha256 reviewed | Date | Where the signed copy is kept |
|---|---|---|---|---|---|
| — not yet reviewed — | Needed: native Hindi speaker who knows the Hindi-medium school register (for example, a teacher of Classes 7–12 mathematics in Hindi medium) | — | — | — | — |
| — counsel (consent and legal rows only) — | Needed: Indian counsel, as for the English notices | — | — | — | — |

Where the sign-off is kept: the owner records it in this table by a PR, and on the D11 line of the release dossier. The reviewer's signed copy (an email or a signed PDF of this packet) is kept by the owner outside this repository, and the table names where. A reviewer's name goes in this table only with their consent.

## This packet

- Generated by `node tools/hindi-review-packet.mjs` from the catalogue with sha256 `e884566b56dd7f90d09970bd7e76670f889f73ad5966ab64eac527f733a5ab9d` (Hindi) and `582135b43729d0f91546cf1e37d7ad523bccb0b7a92f41dd24cb4dd5f6c1e3e5` (English).
- `node tools/hindi-review-packet.mjs --check` fails if any file here is older than its sources, or if Devanagari appears in a source file the tool has not classified. Run it at the release-candidate freeze, regenerate, and give the reviewer that version.
- Other lanes keep editing the catalogue until the freeze, so this packet goes stale whenever they do. It records provenance and does not judge quality: nothing here is evidence that the Hindi is good.
