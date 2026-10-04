# Pri Learning — Finish-Line Task Ledger

**Date:** 2026-10-05 · **Base:** `main` @ `30d1c56f` · **Owner mandate:** finish Pri Learning end to end; owner only creates the Apple Developer and Google Play accounts and pays for them. Everything else below is ours.

**Benchmark:** Leibniz (leibniz.com.au), observed 2026-10-05 without an account: dark serif "Good Morning." home, a filter rail (Year → Course → Topics → Dot Points → Difficulty → Type) ending in one **Generate** button, pages Home / Tasks / Match (rapid fire) / Progress (mastery + activity history) / Favorites / Settings (Subscription, Appearance with Dark/Light/System + text size slider with live maths preview, Help & Safety, restartable "Getting Started" tutorials, Pricing, Contact, Terms, Privacy), and a **guest mode with 5 free questions** before sign-up. Their weaknesses we beat: no handwriting, no deterministic marking of working, no misconception diagnosis, no offline practice, no India curriculum, no Hindi, no guardian/teacher surfaces, no exam-paper mode.

Legend: **[DONE]** merged on main · **[PR]** open PR, needs merge · **[TODO]** not started · **[EXT]** needs the owner or a third party. Risk classes per AGENTS.md. Every TODO ships through a `task/*` branch + PR with a regression test; nothing goes to `main` directly.

---

## 0. Unblock the pipeline first (do before anything else)

| # | Task | Risk | State |
|---|---|---|---|
| 0.1 | Fix the one red check on main: `test:a11y` cannot open `/teach` (Teacher Studio click/fill timeouts, 33/35). Repair the Teach page semantics, not the test. | R2 | TODO (issue #355) |
| 0.2 | Decide Android emulator CI once: land #330 (software compositing) or demote the phone emulator job to non-blocking with an honest label. Close #278/#327. | R3 | PR #330 (conflicting) |
| 0.3 | Rebase and merge the dream interface #264 (+ research #331). It is the identity of the product; every UI task below depends on it. Independent R4 review already returned FIXED on round 2; re-review 041c98ef only. | R4 | PR #264 (conflicting) |
| 0.4 | Merge the Railway deploy PR #299, then switch Railway production source from `task/pri-03-handwriting-production-wiring` to `main` with wait-for-CI on. | R4 | DONE 2026-10-05 (#299 merged; production trigger now `main`, checkSuites on; first main deploy eb567e82 in progress) |
| 0.5 | Merge the remaining green queue in order: #354 store-compliance reconcile, then the docs integration PR #358 (carries #328, #331, #332, #357, #235). Close superseded #336 in favour of #354 and the five docs originals after #358. | R1–R4 | PR |
| 0.6 | Rebase and merge the conflicting fixes: #335 trap steering, #334 frozen-clock /stats (closes #215), #301 + #290 nav back race (keep one), #325 Android SMS code, #329 stylus eraser, #292 guardian consent suite, #285 KALP-R1 wording, #304 CP-12 store readiness, #307 tutor e2e, #300 syllabus board, #233 parallel gates. | R2–R4 | PR |
| 0.7 | Dependabot: the fleet contract refuses `dependabot/*` branches, so the Actions bumps are re-issued as PR #359 and the minor groups (#340 #346, #344 #345 #347 in `/ad`) follow the same way. Hold React 19 (#348 #351), Express 5 (#342), better-sqlite3 13 (#343), bcryptjs 3 (#341) for a dedicated upgrade task each with full suite. | R1–R3 | PR #359 |
| 0.8 | Close stale drafts that are out of V1 scope (#18, #37, #87, #144, #220, #222, #238) with a one-line "post-V1, tracked in ledger" comment so the queue is only live work. | R1 | DONE 2026-10-05 |
| 0.9 | Make the Pri App Health Agent green and keep it green: it is the single "is the product healthy" signal (24/26 today). Add a `live-origin` run against Railway production once 0.4 lands so it stops being skipped. | R2 | TODO |

---

## 1. Production infrastructure (online-first per ADR-0001)

| # | Task | Risk | State |
|---|---|---|---|
| 1.1 | Railway: production service built from `main` on every merge, health endpoint, post-deploy verifier (from #299) runs automatically and fails loudly. | R4 | DONE (#299 merged; production on `main` since 2026-10-05, first deploy eb567e82 healthy; readiness degraded only by unconfigured billing and a rejected handwriting provider key, which the owner must rotate) |
| 1.2 | Railway staging environment wired to the Supabase staging project; every PR gets a preview or at least a staging deploy before merge. | R3 | TODO |
| 1.3 | Supabase: apply the full `supabase/migrations` set to staging, run `postgres-schema-parity-check` and `postgres-schema-live-check` against it, then production. Record the migration SHA. | R4 | TODO |
| 1.4 | Row-Level Security policies on every student-reachable table (profiles, attempts, ink drafts, submissions, favourites, tasks, consent, billing). Add a live RLS test that tries cross-profile reads with a second JWT. | R4 | TODO |
| 1.5 | Daily automated Postgres backups verified by a restore drill into staging; document RPO/RTO. | R4 | TODO |
| 1.6 | Secrets audit: OpenAI, Supabase service role, Razorpay, email live only in Railway variables; CI secret-scan step fails on any key pattern in the repo or client bundle. | R4 | TODO |
| 1.7 | Observability: structured request logs, error tracking (Sentry or equivalent) for server, web and iPad shell, uptime check on `/health`, alert to the owner's email/Telegram on 5xx rate, provider failure rate, queue depth. | R3 | TODO |
| 1.8 | Rate limiting and abuse protection on auth, OTP, handwriting and tutor endpoints; per-profile daily AI budget with graceful "engine-only" fallback. | R4 | TODO |
| 1.9 | Cost telemetry: OpenAI tokens per student per day, Railway and Supabase usage dashboard; alert at 70% of the owner's monthly budget. | R2 | TODO |
| 1.10 | Custom domain + TLS for web, SPF/DKIM/DMARC for the sending domain. **Owner buys the domain and email provider** (Resend/Postmark); we wire it (#218). | R3 | EXT + TODO |
| 1.11 | CDN/caching headers for the static client, Brotli, immutable asset hashes, font subsetting (Devanagari + Latin). | R2 | TODO |
| 1.12 | Disaster runbook: provider down, DB down, bad deploy rollback, key compromise rotation steps. | R1 | TODO |

---

## 2. Authentication, accounts and privacy (all R4)

| # | Task | State |
|---|---|---|
| 2.1 | Supabase Auth as the single identity authority: email OTP, phone OTP (India SMS provider), Apple sign-in on iPad, Google sign-in on web/Android. Remove any legacy session path. | TODO |
| 2.2 | Production auth email delivery through the owner's provider (#218); transactional templates in EN + HI. | EXT + TODO |
| 2.3 | Guest mode: 5 free questions without an account (parity with Leibniz), progress kept locally and migrated into the account on sign-up. | TODO |
| 2.4 | Guardian consent lifecycle for under-18s: email confirmation, revocation, telemetry stop-on-refusal (#292), stale Children section fix (#274). | PR #292 / #354 |
| 2.5 | In-app account deletion for every sign-in method with re-auth, public deletion-request page, 30-day grace and hard purge job (#354). | PR #354 |
| 2.6 | Data export (DPDP Act 2023 right of access): one-tap JSON/PDF export of a student's attempts, ink and progress. | TODO |
| 2.7 | Session management: device list, sign out everywhere, refresh-token rotation, suspicious-login email. | TODO |
| 2.8 | Privacy notice, terms, children's policy, data-safety declarations finalised in EN + HI, versioned, re-consent on change. | PR #354 |
| 2.9 | Security acceptance suite extended: IDOR on every route, JWT tampering, CSRF on web, CSP + HSTS headers, dependency audit gate. | TODO |

---

## 3. Mathematics engine and marking authority (R3/R4)

| # | Task | State |
|---|---|---|
| 3.1 | Deterministic engine stays bundled in the client; add a contract test that the app marks a typed answer with the network cable pulled. | TODO |
| 3.2 | False-positive hunt: run the full holdout sets (`test:holdout`, `holdout2`, `holdout3`, `test:hard`) on every PR touching `engine/`; publish the confusion table in the PR body. | TODO |
| 3.3 | Equivalence coverage: fractions vs decimals vs surds, degree/radian, unit-bearing answers, interval notation, set notation, matrices, vectors, complex numbers, inequalities with direction, "or" solutions, ± answers. One regression test per class. | TODO |
| 3.4 | Step-level marking of working (method marks): parse each handwritten/typed line, award method marks per CBSE/JEE marking schemes, deterministic rules only. | TODO |
| 3.5 | Trap/misconception steering determinism (#335) merged; misconception catalogue covers every NCERT 7–12 chapter with at least 3 named misconceptions. | PR #335 + TODO |
| 3.6 | Partial-credit explanations: every lost mark names the exact line and the rule broken, in the student's language. | TODO |
| 3.7 | Numeric tolerance policy documented and tested per question type (JEE numeric-value questions use NTA rounding rules). | TODO |
| 3.8 | Engine benchmark report regenerated on main weekly, kept honest (no accuracy claims not backed by the holdout). | TODO |

---

## 4. Handwriting (answer-blind, server-read via OpenAI; R4)

| # | Task | State |
|---|---|---|
| 4.1 | Production handwriting wiring verified from main (not from the old branch): iPad ink → `/v1` → provider → transcript → engine → mark, with the e2e proof from #307 generalised to handwriting. | PR #307 + TODO |
| 4.2 | Answer-blind guard test: the transcription request payload can never contain the expected answer, solution or marks; CI greps the provider adapter and replays a recorded request. | TODO |
| 4.3 | Offline capture: ink saved locally with the sealed IndexedDB row (not plaintext localStorage), queued, read when back online, student told clearly "saved, will be read when online". | TODO |
| 4.4 | Transcript confidence surfaced to the student: low-confidence symbols highlighted, one-tap "I wrote …" correction that re-marks without re-reading. | TODO |
| 4.5 | Pencil quality: palm rejection, hover preview, pressure width, double-tap tool switch, hardware eraser end, S Pen side button (#329), undo/redo 50 deep, lasso-move, ruled/grid/blank paper. | PR #329 + TODO |
| 4.6 | Photo-of-paper path (PractisePhoto): perspective correction, multi-page, crop guide, same answer-blind guard. | TODO |
| 4.7 | Latency budget: ink submit → mark shown under 4 s p95 on Mumbai; measure in the health agent against production. | TODO |
| 4.8 | Synthetic ink corpus gate kept separate from real-Pencil corpus; real-Pencil corpus collection (#33, #110) stays labelled EXT and never claimed. | EXT |
| 4.9 | Student-facing honesty: a visible "read by AI, marked by Pri's engine" line on every handwritten verdict. | TODO |

---

## 5. Curriculum, content and provenance (R3)

| # | Task | State |
|---|---|---|
| 5.1 | NCERT Classes 7–12 complete chapter map with per-chapter question counts, source citation and review status visible in a public "Coverage" page (what Leibniz calls dot points). | TODO |
| 5.2 | Class 8 topper layer and validation docs promoted into the generator; repeat the Class 8 audit pattern for Classes 7, 9, 10, 11, 12. | TODO |
| 5.3 | JEE Main and JEE Advanced: official NTA/JEE Adv papers imported with year, shift, question id; PYQ labelled honestly as "official paper, automated review" tier. 41-year archive stays post-V1 (#238). | TODO |
| 5.4 | Difficulty calibration from real attempt data (Elo-style per question), with cold-start defaults from the generator. | TODO |
| 5.5 | Question quality gate: every generated question passes engine solvability, uniqueness of answer, no-ambiguity lint, KaTeX render test and a reading-level check before it can be served. | TODO |
| 5.6 | Content provenance ledger: `content:certify` digest signed per release; app shows "verified 2026-xx" per chapter. | TODO |
| 5.7 | Board exam blueprints (CBSE sample papers, JEE pattern) encoded so Exam Room builds a true-to-pattern paper. | TODO |
| 5.8 | Hindi medium: every question stem, hint, explanation and glossary term available in Hindi with the NCERT term list; i18n gate at 100% for both languages. | TODO |
| 5.9 | Post-V1 shelf, kept but not advertised: NSW Stage 6 (#219/#221), other Australian curricula, state boards (Maharashtra, UP, Bihar). | TODO |

---

## 6. Learning intelligence (Person-1 loop; R3)

| # | Task | State |
|---|---|---|
| 6.1 | Placement test that sets a per-chapter mastery prior in under 10 minutes and explains the result. | TODO |
| 6.2 | Mastery model per dot point (Bayesian knowledge tracing or equivalent), decaying with time; visible as a single honest number with its uncertainty. | TODO |
| 6.3 | Spaced review queue: "due today" built from forgetting curves; appears on Home as the first card. | TODO |
| 6.4 | Adaptive next-question selector that targets the student's weakest reachable dot point and hunts the named misconception (#335). | PR #335 |
| 6.5 | Hint ladder: four rungs (nudge → method → worked step → full solution) each costing mark weight, logged for the mastery model. | TODO |
| 6.6 | Pri Explain tutor: grounded on the engine's verdict and the student's own working, never invents a mark, caption rule enforced, Hindi supported, streaming replies, cost-capped (#307 e2e). | PR #307 + TODO |
| 6.7 | Error notebook: every wrong attempt auto-filed by misconception, with a "retry a twin question" button. | TODO |
| 6.8 | Study plan: exam date → weekly plan across chapters, re-planned nightly from mastery; visible on Progress and on Home. | TODO |
| 6.9 | Exam prediction kept honest: show predicted score band only when the model has enough attempts and label the confidence. | TODO |

---

## 7. Interface and experience (beat Leibniz; R2)

| # | Task | State |
|---|---|---|
| 7.1 | Dream interface (#264) merged: paper/instrument identity, light + dark + match-device, no AI-generated look. | PR #264 |
| 7.2 | Home as a command centre: greeting by time of day, "due today" review, continue-where-you-left, one-tap Generate rail (Class → Subject → Chapter → Dot point → Difficulty → Type) with a "No filters applied" summary chip exactly as fast as Leibniz, and a visible count of questions remaining for guests. | TODO |
| 7.3 | Examiner margin rail: marks, ticks and comments drawn in the margin next to the student's lines. | TODO |
| 7.4 | Syllabus map / board view on Progress (#300) with mastery heat per chapter and the exam blueprint weight. | PR #300 |
| 7.5 | Favorites: save any question, folders, "practise this folder" and export to PDF worksheet. | TODO |
| 7.6 | Tasks: teacher- or self-assigned task lists with due dates, task history, completion state (Leibniz has this page; ours must also carry handwriting). | TODO |
| 7.7 | Match (rapid fire): timed head-to-head versus a rival profile or a ghost of your own past, with fair question sampling and anti-cheat timing. Rival avatars and emoji picker. | TODO |
| 7.8 | Exam Room: full-length board/JEE paper, OMR-style answer sheet, section timers, post-exam review with per-question time. | TODO |
| 7.9 | Settings parity: Subscription, Appearance (theme + text size slider with a live maths preview), Language EN/HI, Help & Safety, restartable "Getting Started" tutorials, Pricing, Contact, About, Terms, Privacy, Delete account, Export data. | TODO |
| 7.10 | First-run tutorial: three-step coach marks (generate → write → see the verdict), restartable from Settings. | TODO |
| 7.11 | Accessibility: WCAG 2.2 AA, APCA tokens, focus trap in modals, screen-reader readable maths (MathML + aria), reduced motion, 200% text, Dynamic Type on iPad. Keep `test:a11y` green on all 62 views. | TODO |
| 7.12 | Performance budget: LCP < 1.5 s on a mid-range Android, route-level code splitting, KaTeX lazy load, visual regression suite (Playwright screenshots per route in both themes). | TODO |
| 7.13 | Stylesheet consolidation: one token layer, legacy theme files removed, QuestionCard and PriExplain split into focused components. | TODO |
| 7.14 | Micro-copy pass in EN + HI by a human-sounding voice guide; no exclamation-mark gamification, no "AI magic" wording. | TODO |
| 7.15 | Empty, loading, offline, error and "provider slow" states designed for every page. | TODO |
| 7.16 | Keyboard-only and external-keyboard-on-iPad shortcuts (N next, H hint, S submit, ⌘Z undo). | TODO |
| 7.17 | PWA install prompt, app icon set with the P′ mark, splash, offline shell. | TODO |
| 7.18 | Question page parity with Leibniz's sample (seen 2026-10-05): marks badge top-left, running timer top-right, a three-rung hint rail with numbered bulbs, Text / Pen / Photo answer-mode switch, maths editor with a "Tab to insert math" keyboard and Σ palette, undo/redo in the editor header, honest "generated by AI, may be inaccurate" disclosure under every generated item, and a footer strip showing Year · Course · Difficulty · Topic with a Next button. Ours adds the deterministic verdict and handwriting margin. | TODO |
| 7.19 | Diagram-bearing questions: curve sketches rendered by the plot engine with "not to scale" labels and named points, in both themes, readable by screen readers. | TODO |

---

## 8. iPad native shell (R3/R4)

| # | Task | State |
|---|---|---|
| 8.1 | Target genuinely iPad-only for V1 submission (device family, orientation, min iPadOS), signing guard and privacy manifest (#304). | PR #304 |
| 8.2 | PencilKit bridge hardened: lifecycle on background/foreground, memory warnings, scene disconnect, bridge self-check restricted to debug (#260). | TODO |
| 8.3 | Sign in with Apple, StoreKit 2 Premium with server-side receipt validation and entitlement authority tests, restore purchases, family sharing decision. | TODO |
| 8.4 | Keyboard, Stage Manager, split view, external display, pointer hover. | TODO |
| 8.5 | iPad simulator matrix in CI (11", 13", iPadOS n and n-1) with screenshots archived; physical-device certification stays EXT and is never fabricated (#10, #110). | TODO / EXT |
| 8.6 | Crash reporting and TestFlight build pipeline ready to run the moment the owner's Apple account exists (fastlane lane, App Store Connect metadata files, screenshots generator, review notes). | TODO (account EXT) |

---

## 9. Android and web (post-V1 platforms, keep green)

| # | Task | State |
|---|---|---|
| 9.1 | Android shell parity audit items (#328) closed: stylus eraser (#329), SMS code (#325), back-navigation race (#301/#290), WebView compositing (#330). | PR |
| 9.2 | Play Billing with the same entitlement authority as StoreKit; Data Safety form drafted (#354). Store listing files ready for when the owner's Play account exists. | TODO (account EXT) |
| 9.3 | Web: Razorpay UPI/cards/net-banking checkout for Premium, webhooks verified, reconciliation tool (`billing-reconcile`) run nightly. **Owner creates the Razorpay account and KYC.** | EXT + TODO |
| 9.4 | Responsive web on phones for revision-only mode (no handwriting), honest about what needs a stylus. | TODO |

---

## 10. Teacher, guardian and school surfaces (R3)

| # | Task | State |
|---|---|---|
| 10.1 | Teacher Studio fixed (0.1) and finished: classes, roster by join code, assign tasks, see per-student mastery and the actual handwritten working, comment in the margin. | TODO |
| 10.2 | Guardian view: weekly email digest in EN/HI, consent controls, screen-time of practice, no marketing. | TODO |
| 10.3 | School pilot kit: CSV roster import, bulk licences, privacy DPA template, offline-first classroom mode on shared iPads. | TODO |
| 10.4 | Kalp pilot evidence export (#141/#144) made privacy-safe and on-device; pilot itself is EXT. | TODO / EXT |

---

## 11. Commercial and growth (owner-light)

| # | Task | State |
|---|---|---|
| 11.1 | Pricing page and in-app paywall: Free (daily cap, typed answers) vs Premium (handwriting reads, tutor, exams), INR pricing, student-honest copy matching the entitlement authority (#283). | TODO |
| 11.2 | Promo codes and 24-hour passes (#87 logic) re-based onto the current billing module. | TODO |
| 11.3 | Referral: invite a friend → both get a week of Premium; fraud-limited. | TODO |
| 11.4 | Public website: landing, coverage page, pricing, about, blog for NCERT solutions SEO, structured data; built from the same design system, no stock-AI imagery. | TODO |
| 11.5 | Privacy-safe analytics (self-hosted or Plausible-class), funnel dashboard: install → first question → first handwriting → day-7 retention → Premium. | TODO |
| 11.6 | Support: in-app "Contact support" that files a ticket with device logs (consent-gated), help centre articles EN/HI, status page. | TODO |
| 11.7 | Store listing packs (screenshots in both themes, preview video from `/ad`, descriptions EN/HI) ready to upload the day the accounts exist. | TODO |
| 11.8 | Funding pipeline docs (#357, #332) merged; applications themselves are EXT. | PR |

---

## 12. Quality gates, release and governance

| # | Task | State |
|---|---|---|
| 12.1 | Required CI stays the four `ci.yml` jobs; exact-count coverage invariants updated with every added flow (e2e 343/12 today). | ongoing |
| 12.2 | Parallelised deterministic gates (#233) so a full run is under 15 min. | PR #233 |
| 12.3 | Nightly: full engine thorough, ink corpus strict, a11y, visual regression, live-origin health, Lighthouse, dependency audit. Results posted to one issue. | TODO |
| 12.4 | Release candidate procedure: tag, changelog, release identity, `release:matrix`, evidence folder per RC under `docs/release/evidence`. | TODO |
| 12.5 | Independent QA review on every R3/R4 PR per AGENTS.md; writer never self-approves. | ongoing |
| 12.6 | Mission ledger hygiene: close every stale `[PRI-MISSION]` issue, keep exactly one active lease, retire V3/V4 ledger issues (#174–#178). | TODO |
| 12.7 | Weekly honest status page in the repo: what is proven, what is synthetic, what is EXT. No "production-ready" claim until 8.5 physical certification exists. | TODO |

---

## Owner-only items (everything else above is ours)

1. Apple Developer Program enrolment and payment.
2. Google Play Console registration and payment.
3. Razorpay (or chosen PSP) account and KYC.
4. Domain purchase and transactional email provider account.
5. Physical iPad + Apple Pencil hands for the certification session (we script it; a human must hold the device).
6. Legal sign-off of privacy/terms by a lawyer if desired.

## Suggested order of attack

1. Section 0 entirely (pipeline green, dream interface and Railway on main).
2. Sections 1–2 (infra, auth, privacy) because every later feature writes student data.
3. Sections 3–4 (marking and handwriting) because they are the product's claim to be better than Leibniz.
4. Section 7 (interface parity-plus) alongside 5–6 (content and intelligence).
5. Sections 8–11 in parallel streams in `~/Developer/pri-wt-*` worktrees.
6. Section 12 continuously.
