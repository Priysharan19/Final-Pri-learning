# Paper Generator (both editions)

A student picks topics (from their year's course in the edition's own curriculum model), a length (10/20/40 marks or 30/60/90 minutes, 1.5 minutes a mark), a difficulty mix (Foundation, Standard, Challenge, "like the real exam") and optionally "focus on my weak topics" (Premium, as targeted papers are).

- **Server-authoritative.** `server/platform/paperGenerator.js` assembles the paper only from the edition's approved, issued banks (`indiaBank` / `nswBank` plus the edition's sealing, `editionBanks.js`). Its seed is the server's and never leaves it (a caller's seed is refused outside a test), because the bundled engine could regenerate the answers from it.
- **Deterministic and exact.** One seeded RNG; the plan is a composition of the requested total, so marks add up exactly. Recently seen questions are passed over (a repeat is used only when nothing fresh is left, and counted).
- **No padding.** If the banks cannot fill a request: `409 PAPER_BANK_INSUFFICIENT` with the nearest valid paper (easier mix, then shorter), found by assembling it.
- **Sections.** Prithagoras: Section I multiple choice (only where the topics' banks issue multiple choice), Section II extended. Priyabhata: CBSE-style sections by marks (A–D), or JEE-style for the JEE Main track. Never called a CBSE, NTA or NESA paper: "Pri practice paper".
- **Marking unchanged.** Sat through the Exam Desk's room (kind `generated`); final-answer marking, method marks off until certified.
- **PDF.** `POST /v1/exams/generator/pdf` returns the paper only, text-only (questions that depend on a figure are left out of the printed paper). The marking guide, `GET /v1/exams/:id/guide`, is 403 `GUIDE_LOCKED` until the paper has a result. The printable paper is unmarked, text-only practice: it is rate-limited (60 an hour) but is not counted against the free exam allowance, which counts sealed papers. A paper printed without sitting has no guide until a paper is sat and submitted. A teacher/guardian unlock is not built (the exam router serves students only).

Evidence: `server/test/paper-generator-check.mjs`, `client/test/tour-paper-generator.js` (both editions, simulator-free browser tour with a synthetic student), the accessibility walk step "paper generator". Screenshots: `docs/content/paper-generator/`.
