# Pri Learning V1 — launch runbook (the owner's ordered checklist)

Written 2026-10-02 against `main` `b9d798345b982b00009afed6570470b170f39c40`. **Nothing in this
document is complete.** Every step below needs something the repository cannot supply — a real
account, a real iPad, a real person, a real decision — and is therefore `BLOCKED_EXTERNAL`
(`AGENTS.md`, failure handling). What the repository *has* supplied is the command that runs the
step and the gate that checks its evidence; each row names both. A step is done when its evidence
exists where the row says, not when the software for it merged.

Rules that apply to every step:

- Nothing is fabricated. Synthetic, simulator and CI evidence is labelled as such and never
  fills a row that asks for physical, human, store or production evidence.
- Secrets go into Railway variables (or Supabase/App Store Connect) only — never into this file,
  the repository, a ticket or chat. Record *that* a value was set, never the value.
- Destructive production operations (migrations, restores, secret rotation, store publishing)
  need the owner's explicit go-ahead at the time, even when the code is ready (`AGENTS.md`).
- The release candidate is one exact `main` SHA (`docs/release/release-policy.md`). Nominate it
  first (§1), then every later row records evidence **against that SHA**.

Hard blockers referenced as **#n** are `docs/release/PRI_V1_RELEASE_SCOPE.md` §18; their dated
status notes are §18.1 there.

---

## 0. Before anything: what is already true, and how to check it

```bash
npm test                                         # the suites CI pins (see .github/workflows/ci.yml)
npm run test:platform                            # /v1 on SQLite
npm run test:platform:pg                         # expect: PLATFORM ON POSTGRES: PASS — 32/32 suites
npm run test:legal                               # LEGAL PAGES: PASS — 233/233 checks (placeholders still counted)
npm run test:readme                              # README TRUTH: PASS — 16/16 checks
node server/test/production-runtime-image-check.mjs   # PRODUCTION RUNTIME IMAGE — PASS — 85/85 checks
node scripts/check-native-package-sync.mjs       # both iPad packages identical
node scripts/ink-physical-study-status.mjs       # today: collected writers: 0 … NOT MEASURED
node tools/legal-status.mjs                      # today: 7 placeholders across 8 documents
```

Software is not the blocker for V1. The rows below are.

---

## 1. Release identity (blockers #2, #3)

| Step | Who | Action | Evidence it produces | Gate that consumes it |
|---|---|---|---|---|
| 1.1 | owner | Nominate one exact `main` SHA as the candidate; write it into the release record (`ios/PriLearning.swiftpm/RELEASE.md` §11) | the SHA in the release record | every later row |
| 1.2 | owner (Railway) | Change the production service's **source branch** from `task/pri-03-handwriting-production-wiring` to `main` and deploy the nominated SHA | `curl -fsS https://<origin>/v1/health` → `releaseIdentity.releaseSha` = nominated SHA | `docs/release/release-policy.md` "Production must not remain sourced from a feature branch"; `PRI_R1_SCOPE_EVIDENCE.md` §2.10 |
| 1.3 | operator | `npm run build && npm run sync:ios && npm run verify:release:native && npm run release:matrix` on the nominated SHA | matrix output pasted into the release record | CI contexts *Client build and offline-first boundary*, release matrix |
| 1.4 | owner (GitHub) | Set the App Health workflow variable `PRI_APP_URL` to the live origin | `.github/workflows/app-health-agent.yml` runs green against the live origin | release evidence (`docs/production-deployment.md` §6) |

---

## 2. Database: Postgres cutover (blocker #4)

Procedure: `docs/operations/postgres-cutover.md`. Order is fixed: staging, then production.

| Step | Who | Action | Evidence it produces | Gate |
|---|---|---|---|---|
| 2.1 | owner (Supabase) | Confirm the staging project (`orudxrckgxyyraopyzmn`, Mumbai) and create the production project in **`ap-south-1`**; enable *Enforce SSL*; download the CA certificate (cutover §1 TLS) | project refs (not secrets) in the cutover log §7 | cutover §1 |
| 2.2 | operator | `npx supabase@latest login && npx supabase@latest link --project-ref <staging>` then `npx supabase@latest db push --dry-run` — expect exactly the files in `supabase/migrations/`, ending at schema **9** / billing **6** (`server/platform/schemaVersions.js`) — then `db push` (cutover §2) | `migration list` output in the cutover log | `PLATFORM_DB_SCHEMA_MISMATCH` at boot if wrong |
| 2.3 | operator (psql as `postgres`) | Create the login role `pri_app_staging` as a member of `pri_server`, password via `\password` only (cutover §3) | role name in the log (never the password) | cutover §3.3 query: `rolsuper = false, rolbypassrls = false, member = true` |
| 2.4 | operator (Railway staging) | Set `PRI_DATABASE_URL` (sealed, `sslmode=verify-full`, session-mode port 5432), `PRI_DATABASE_SSL_ROOT_CERT`, pool/timeouts; remove `PRI_PLATFORM_DB` (cutover §4.1) | variable **names** recorded | cutover §4.1 |
| 2.5 | operator | `NODE_ENV=production npm run verify:platform:pg-target` with the same values read from a prompt (cutover §4.2) | `POSTGRES TARGET: PASS — n/n` in the log | cutover §4.2 (live schema gate, TLS, role, cursor sequence) |
| 2.6 | operator | Redeploy staging; `GET /v1/health` → `database.engine: "postgres"`, `schemaVersion: "9"`, `billingSchemaVersion: "6"`; `GET /v1/ready` → 200; run the cursor lift once older builds have drained; smoke with **test accounts only** (cutover §4.4) | log §7 rows 4.4 | cutover §4.5: 24 h clean |
| 2.7 | owner | **Decide:** carry the SQLite data across, or start Postgres empty (ADR-0001 "Not decided here") | the decision, dated, in the cutover log | cutover §6a |
| 2.8 | operator (if 2.7 = migrate) | Stop the service; `node server/tools/backup.mjs --db /data/pri-learning-platform.db --out /data/backups`; `node server/tools/sqlite-to-postgres-export.mjs --db <backup> --out <dir> --inserts`; `psql "$PRI_IMPORT_URL" -v ON_ERROR_STOP=1 -f import-copy.sql`; `psql … -f verify.sql` (cutover §6a) | `manifest.json` (row counts, SHA-256s, cursor lift) kept with the log; `verify.sql` all `ok`/`true` | `npm run test:platform:export` is the tool's regression suite; cutover §4.2 re-run must tick "sequence at or above every cursor" |
| 2.9 | owner + operator | Backups: confirm daily backups and **enable PITR** on the production project; take the pre-cutover logical dump; **restore drill** into a scratch project and run §4.2 against it (cutover §6) | restore-drill result in the log | ADR-0001 (restore drill before real student data); blocker #4 |
| 2.10 | owner | Approve the production window; repeat 2.2–2.6 against production with `pri_app_production` (cutover §5.4) | log §7 production rows | blocker #4 closes only with every row filled |

Rollback semantics before and after real data: cutover §5. There is no automatic Postgres→SQLite path.

---

## 3. Handwriting evidence (blocker #5; also the recognition model's real-writer line)

Two separate programmes. Neither can be simulated, and simulator evidence never fills either.

### 3.1 Real-writer corpus (model training/evaluation readiness)

Policy: `tools/ink-foundation/corpus_policy.json` (release lane V17.1, vocabulary 4, split
70/10/10/10; readiness needs **100 train writers × ≥40 samples, 10 validation writers, test split
≥20 writers / ≥1000 samples, 20 final-holdout writers**; synthetic augmentation never counts as
a writer; final-holdout content stays locked).

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 3.1.1 | owner | Recruit real writers under the consent terms counsel approves (§4); each gets a candidate code `P####` from the policy's campaign section | consent records outside the repository | `docs/legal` sign-off |
| 3.1.2 | operator + writers | `npm run ink:collect` (LAN collector) on physical iPads with Apple Pencil; `npm run ink:annotate` for labels | corpus samples under the corpus directories the policy names | `npm run ink:status` (today: real-writer fine-tuning **NOT READY**, frozen test evaluation **NOT READY**) |
| 3.1.3 | operator | Re-run `npm run ink:status` until the readiness targets above are met; only then `npm run ink:next-attempt` | status output showing READY | `.github/workflows/ink-corpus-evidence.yml`, `ink-writer-generalization.yml` |

### 3.2 Physical iPad study on the release candidate (blocker #5)

Plan: `handwriting/v12/PHYSICAL_STUDY_PLAN.json` (study `pri-ink-physical-release-v1`, protocol
`2026-09-02-v1`, prompts `REAL_PENCIL_PROMPTS`; minimums **24 test writers, 6 validation, 6 final-holdout,
12 train, 2 distinct iPad model classes A/B**).

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 3.2.1 | QA + writers | On the TestFlight build of the nominated SHA, each planned writer writes the prompts at `/practice?inkEvidence=1` on the device slot the plan assigns, and exports the release-evidence JSON | `handwriting/v12/evidence/physical/<writer>.json` with `schemaVersion: 1`, `physicalHardware: true`, real iPad model and iPadOS | `node scripts/ink-physical-study-status.mjs --split test` (and `--split validation`, `--split final-holdout`) |
| 3.2.2 | QA | Repeat until the status script reports every planned writer for each split and 2 device classes | status output: `collected writers: 24`, no `missing writers` | `.github/workflows/ink-physical-study.yml`, `ink-physical-evidence.yml` |
| 3.2.3 | release governor | Run the critical-case list of `ios/PriLearning.swiftpm/RELEASE.md` §7 on both device classes (Pencil, finger, VoiceOver, Dynamic Type, offline restart, StoreKit restore) | pass/fail per case, device model, iPadOS and Pencil model in the release record | blockers #5 and #11 |

Handwriting stays answer-blind throughout: no expected answer, solution or mark is ever given to
the recogniser or used to improve a transcription (`AGENTS.md`).

---

## 4. Legal and privacy (blockers #9, #10)

Checklist with the exact rows: `docs/legal/README.md` → "Launch checklist". Summary of the order:

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 4.1 | owner | Decide the legal entity and address; appoint the grievance officer and mailbox; open the support mailbox; choose the jurisdiction | the decisions | — |
| 4.2 | counsel | Review the four English notices (DPDP Act 2023, E-Commerce Rules, IT Rules grievance duty); check the Hindi set against the English; confirm the privacy notice matches the code's data path at the release SHA (handwriting image/photo opt-in, working check, telemetry, deletion survivors) and `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` | written sign-off kept outside the repository, referenced in the release record | blockers #9, #10 |
| 4.3 | operator | Fill `{{OWNER_LEGAL_NAME}}`, `{{OWNER_ADDRESS}}`, `{{GRIEVANCE_OFFICER_NAME}}`, `{{GRIEVANCE_OFFICER_EMAIL}}`, `{{SUPPORT_EMAIL}}`, `{{JURISDICTION_CITY}}`, `{{LAST_UPDATED}}` in **both** languages in one PR | `node tools/legal-status.mjs` → 0 placeholders | `npm run test:legal` (its pinned count line in `ci.yml` changes in the same PR; the "not yet reviewed" banner disappears) |
| 4.4 | owner | Guardian consent: the mailbox-confirmation method is documented as *not* DPDP Rule 10 verifiable consent (`docs/security/accepted-risks.md` R-8); counsel states what V1 may ship with | counsel's instruction in the release record | blocker #9 |

---

## 5. Premium / StoreKit (blocker #7)

Code evidence and the external list: `docs/billing/storekit-certification.md` (status annotations
at its end). Order:

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 5.1 | account holder (App Store Connect) | Create the subscription group, monthly and annual products, grace period, review metadata; give the final product ids to the operator | product ids | `PRI_APPLE_MONTHLY_PRODUCT_ID` / `PRI_APPLE_ANNUAL_PRODUCT_ID` set |
| 5.2 | operator (Railway) | Apple Root CA G3 → `PRI_APPLE_ROOT_CA_PEM` (or `_FILE`); `PRI_APPLE_APP_ID`, `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_ENVIRONMENTS=Production`; `PRI_APPLE_ALLOW_SANDBOX` unset in production (a separate staging deployment may allow Sandbox) | boot no longer reports missing Apple trust; `GET /v1/health` operator view (with `PRI_METRICS_TOKEN`) → `billingProviders.apple: true`; `GET /v1/ready billing` ready | `server/platform/config.js platformConfigStatus` |
| 5.3 | account holder | Register App Store Server Notifications v2 production and sandbox URLs `https://<origin>/v1/billing/webhook/apple`; *Request a Test Notification* | server log + `billing_events` row (`node server/tools/billing-reconcile.mjs --evidence`) | storekit doc item 3 |
| 5.4 | QA (physical iPad, Sandbox Apple ID, TestFlight build) | Purchase, renewal, auto-renew off → expiry, billing retry + grace, refund, upgrade/downgrade, restore after reinstall, account switch on one iPad | per-scenario device result, `/v1/entitlements` snapshot, `billing-reconcile` exit 0 | storekit doc item 4 (S1–S7 physical counterparts) |
| 5.5 | account holder | Keep the In-App Purchase key outside the repository and the server | — | `npm run test:secrets` finds nothing |
| 5.6 | release governor | Final production transaction on a physical iPad after App Review approval | release record | storekit doc item 5 |

Web (Razorpay) purchasing is out of V1 (`PRI_V1_RELEASE_SCOPE.md` §12); its variables stay unset.

---

## 6. TestFlight and App Store (blocker #6)

Procedure: `ios/PriLearning.swiftpm/RELEASE.md` §2–§10. Order:

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 6.1 | operator | On the nominated SHA: `npm run build && npm run sync:ios`; `node scripts/check-native-package-sync.mjs`; `node client/test/ios-bundle-features-check.mjs`; `npm run verify:release:native` | outputs in the release record | `RELEASE.md` §3 |
| 6.2 | Lane D / integrator (before archive) | Ensure `Package.swift` copies `Resources/PrivacyInfo.xcprivacy` into both packages (`.copy("Resources/PrivacyInfo.xcprivacy")`) so the privacy manifest ships in the bundle root | the resource line in both `Package.swift`; `check-native-package-sync.mjs` green | App Store privacy manifest requirement |
| 6.3 | owner (Mac, Xcode, Apple Developer account) | Archive, validate, upload (`RELEASE.md` §6); bundle version increased | App Store Connect build id | `RELEASE.md` §2 version policy |
| 6.4 | QA | TestFlight on both device classes; run §3.2.3 of this runbook | `RELEASE.md` §7 record | blocker #5, #11 |
| 6.5 | owner | App Store submission checklist (`RELEASE.md` §8): privacy nutrition labels must match `PrivacyInfo.xcprivacy` and `docs/legal/privacy.md`; subscription terms and refund policy linked | submission state | blocker #6 |
| 6.6 | owner | Phased rollout and monitoring (`RELEASE.md` §9); rollback semantics §10 | rollout record | `release-policy.md` staged rollout; raise no compatibility floor until 100 % for 14 days |

---

## 7. Operations: alerts, drills, backups (blockers #15, #16)

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 7.1 | operator (Railway) | Set `PRI_METRICS_TOKEN` so `GET /v1/metrics` and the operator detail of `GET /v1/health` open for the monitor; set `PRI_MFA_KEY` before the first staff account (`/v1/ready staffMfa`) | variable names recorded | `docs/production-deployment.md` §4, §6 |
| 7.2 | operator (monitoring tool) | Configure each alert of `docs/operations/alerts.md` — `SERVER_DOWN`, `HTTP_5XX_SPIKE`, `DB_CONNECTIVITY`, `DB_SATURATION`, `AUTH_EMAIL_FAILURES`, `PROVIDER_FAILURE_SPIKE`, `WEBHOOK_FAILURES` — against `/v1/metrics alerts.firing` and `/v1/ready`, each with a real paging route | `alerts.md` §5 rows: tool, route, configured by/date | `server/test/observability-check.mjs` keeps the rule table and the document in step |
| 7.3 | operator (staging) | Run the six drills of `docs/operations/drills.md` — server down, database unreachable, email provider failure, handwriting provider failure, webhook failure, restart mid-sync — and record which alert detected each and the detect/recover times | `drills.md` §4 rows filled (staging/production only; simulator results never fill a row) | blocker #15; `alerts.md` §5 last column ("fired once in a drill") |
| 7.4 | owner (Supabase) | Daily backups confirmed, **PITR enabled** on production; restore drill done (§2.9 above) | cutover log §7 row 6 | blocker #4; ADR-0001 |
| 7.5 | operator | Pre-cutover only: schedule `node server/tools/backup.mjs --keep 14` against the SQLite volume and test `node server/tools/restore.mjs` on a copy | backup/restore output in the operations log | `server/test/platform-db-operations-check.mjs` is the tool's test |
| 7.6 | operator | Email: configure `PRI_AUTH_EMAIL_PROVIDER`, `PRI_RESEND_API_KEY`, `PRI_AUTH_EMAIL_FROM` with a verified sending domain; send and receive a verification and a reset mail on a **test account** | `GET /v1/ready authEmail` ready; the received mails recorded | blocker #13 |

---

## 8. Security sign-off (blocker #14)

Automated evidence: `docs/security/acceptance.md` (`npm run test:platform:acceptance`, the Postgres
runner, `npm run test:secrets`, `node tools/runtime-audit-floor.mjs server` and `client`). The
remaining decisions are the owner's, recorded in `docs/security/accepted-risks.md` (status today:
"proposed — awaiting owner acceptance"):

| Step | Who | Decision / action | Evidence | Gate |
|---|---|---|---|---|
| 8.1 | owner | **R-1** — `POST /v1/account/register` answers `409 EMAIL_EXISTS` (account enumeration; accounts of minors). Accept for V1 and revisit with the sign-up redesign, or require the verify-first UX before launch | signed decision in `accepted-risks.md` | blocker #14 |
| 8.2 | owner + operator | **R-11** — hosted configuration: verify on the staging project that RLS is enabled on every `pri` table for the client API roles, network rules, backups and the Railway WAF/edge; repeat on production before launch | `verify:platform:pg-target` output (RLS and privilege gate) plus the dashboard checks recorded | ADR-0001 §8; blocker #14 |
| 8.3 | owner | **R-12** — schedule an external penetration test before public launch; file its findings as issues | engagement record outside the repository; findings triaged | blocker #14 |
| 8.4 | owner | Confirm R-4 (`PRI_TRUSTED_PROXY_HOPS` is correct for the Railway edge) on the release candidate: one spoofed `X-Forwarded-For` must not get a fresh rate bucket | recorded check | `docs/production-deployment.md` §5 |
| 8.5 | release governor | Re-run the automated suite at the nominated SHA and record the exact output lines | release record | blocker #14 |

---

## 9. Release decision (blockers #1, #8, #12, #17)

| Step | Who | Action | Evidence | Gate |
|---|---|---|---|---|
| 9.1 | release governor | Confirm iPad-only shipping target (`Package.swift` `.pad`; `scripts/apple-shipping-target.mjs`) | `npm run release:matrix` | blocker #1 |
| 9.2 | release governor | Record the disposition of the expression-domain known limitation (far tangential hole of a non-polynomial guard, `client/test/marker-ncert-forms-check.mjs`): release-severity or not | the decision | blocker #8 |
| 9.3 | operator | Delete and recover **test accounts** on production after §1–§2; confirm the survivors list of `docs/privacy/data-retention.md` §2 | recorded | blocker #12 |
| 9.4 | release governor | Review the issue ledger at the nominated SHA; record the P0/P1 count | the count | blocker #17 |
| 9.5 | owner | Go / no-go, written into the release record with every row above referenced | release record | `PRI_V1_RELEASE_SCOPE.md` §21 |

---

## Appendix — what produces what (quick index)

| Evidence file / output | Produced by |
|---|---|
| `docs/operations/postgres-cutover.md` §7 cutover log | §2 |
| `<export>/manifest.json`, `verify.sql` results | `node server/tools/sqlite-to-postgres-export.mjs` (§2.8) |
| `POSTGRES TARGET: PASS — n/n` | `npm run verify:platform:pg-target` (§2.5) |
| `handwriting/v12/evidence/physical/*.json` | physical writers on TestFlight (§3.2) |
| `node scripts/ink-physical-study-status.mjs` output | §3.2 |
| `npm run ink:status` output | §3.1 |
| `node tools/legal-status.mjs` → 0 placeholders | §4.3 |
| `docs/operations/alerts.md` §5, `drills.md` §4 | §7 |
| `docs/security/accepted-risks.md` owner decisions | §8 |
| `ios/PriLearning.swiftpm/RELEASE.md` §11 release record | §1, §3.2.3, §5, §6, §9 |
