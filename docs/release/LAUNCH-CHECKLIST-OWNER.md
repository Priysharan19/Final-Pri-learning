# Launch checklist — owner-only actions, in order

**Prepared:** 2026-10-18 against `main` `7bef402f7`. This lists only what the owner (or someone
the owner authorises) must do with real accounts, money, hardware or legal authority. Engineering
steps, gates and evidence rules are in `docs/release/LAUNCH-RUNBOOK.md`,
`docs/release/production-cutover-checklist.md` and `docs/billing/storekit-certification.md`; this
file points at them rather than repeating them.

Rules: secrets go only into Railway / Supabase / App Store Connect, never into the repository or
chat. Record *that* a value was set, not the value. Every destructive or irreversible step
(production migration, store submission, pricing) is done by the owner at the time.

---

## A. Already done (each row cites where it can be checked — re-check before relying on it)

| Item | State | Recorded in |
|---|---|---|
| Bundle id `com.prilearning.app`; build ships on iPhone and iPad | Done in code (#523) | `ios/PriLearning.swiftpm/Package.swift`; `PRI_V1_RELEASE_SCOPE.md` §22 |
| App Store subscription products `com.prilearning.app.premium.monthly` and `.annual` | **Created, not priced** (stated by the owner; check in App Store Connect → Subscriptions) | App Store Connect |
| Railway Pro, Supabase, OpenAI chosen as the platform | Decided | `docs/architecture/adr-0001-online-first-runtime.md` |
| Supabase projects `pri-learning-staging` and `pri-learning-production-india`, both `ap-south-1`, `ACTIVE_HEALTHY` | Created (observed 2026-10-04) | `docs/release/production-cutover-checklist.md` "Observed state" |
| Staging on Supabase Postgres, deploying `main` | Running | `production-cutover-checklist.md` |
| Production | Deploys branch `deploy/production` on **SQLite** (Railway volume); production Supabase has no `pri` schema yet | `V1_COMPLETION_LEDGER.md` surface 16, 22 |
| Auth email on staging | Ready (`/v1/ready` auth-email check `ok`, 2026-10-04) | `production-cutover-checklist.md`; re-check with `GET <staging>/v1/ready`. Production email readiness is not recorded in the repository — verify it the same way after cutover |
| Logo (P′) | Chosen | `docs/release/PRI_FINISH_LINE_TASK_LEDGER.md` |
| Store listing, privacy label, Data safety, counsel pack, examiner email | Drafted (this PR) | `docs/release/store/`, `docs/release/app-store-privacy-labels.md`, `play-data-safety.md`, `docs/legal/counsel/COUNSEL-INFORMATION-PACK.md`, `EXAMINER-REQUEST.md` |

---

## B. Start now — long lead time (in parallel with everything below)

| # | Action | Where | Done when |
|---|---|---|---|
| B1 | Decide the legal entity, registered address, grievance officer and support mailbox | — | The seven placeholders can be filled (`docs/legal/README.md`) |
| B2 | Engage a lawyer qualified in Indian law (DPDP Act); send `docs/legal/counsel/COUNSEL-INFORMATION-PACK.md` | email | Counsel's written answers to §11 and rewritten notices |
| B3 | Send the examiner request (`docs/release/EXAMINER-REQUEST.md`) with the exported dossier | email; issue <https://github.com/Priysharan19/Final-Pri-learning/issues/499> | Signed sign-off form received |
| B4 | Decide whether to ask OpenAI for zero data retention, and record the answer | <https://platform.openai.com/settings/organization/general> (organisation settings; contact OpenAI sales/support for ZDR) | Decision recorded; counsel told |
| B5 | Choose the SMS provider (MSG91 or Twilio Verify), or confirm SMS stays off for launch | provider sites | Choice recorded in `docs/release/otp-sign-in.md` |
| B6 | Decide whether the AI tutor is on at launch (default: off) | — | Recorded; listing and privacy answers follow |
| B7 | Decide the launch values of the paid-call ceilings `PRI_PAID_CALLS_PER_HOUR` / `PRI_PAID_CALLS_PER_DAY` on production, and confirm what is set now | Railway → production → Variables (names only) | Values recorded in the release record |

---

## C. Apple — agreements and subscriptions

| # | Action | Link | Done when |
|---|---|---|---|
| C1 | Accept the **Paid Apps Agreement**; complete tax forms and banking | <https://appstoreconnect.apple.com/business> (Business → Agreements) | Agreement status "Active". Without it, subscriptions cannot be sold or tested in the sandbox against your account |
| C2 | Price the two subscriptions: monthly ₹199, annual ₹1,499 (India base; let Apple derive other storefronts or restrict availability to India) | <https://appstoreconnect.apple.com/apps> → Pri Learning → Monetization → Subscriptions | Both products "Ready to Submit", with display name, description and review screenshot |
| C3 | Create the In-App Purchase key / App Store Server API key | <https://appstoreconnect.apple.com/access/integrations/api> (Users and Access → Integrations) | Key downloaded and stored safely |
| C4 | Set the App Store Server Notifications V2 URL (production and sandbox) to `<PRODUCTION_ORIGIN>/v1/billing/webhook/apple` | App Store Connect → app → App Information → App Store Server Notifications | URLs saved |
| C5 | Set the Apple variables on Railway production: `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_APP_ID`, `PRI_APPLE_MONTHLY_PRODUCT_ID`, `PRI_APPLE_ANNUAL_PRODUCT_ID`, `PRI_APPLE_ENVIRONMENTS`, the root CA (`PRI_APPLE_ROOT_CA_FILE` or `_PEM`) | <https://railway.com/dashboard> → `profound-spontaneity` → production | `/v1/health` operator view shows `billingProviders.apple: true` (`storekit-certification.md`) |
| C6 | Decide the first App Store version number (source says 4.0 (2)) | — | Recorded in `ios/PriLearning.swiftpm/RELEASE.md` |

---

## D. Production database — Supabase Pro and the cutover "Yes"

| # | Action | Link | Done when |
|---|---|---|---|
| D1 | Put the production project `pri-learning-production-india` on **Supabase Pro** (backups and point-in-time recovery) | <https://supabase.com/dashboard/project/mgmlvkesbwmipmvnzufk/settings/billing> (or the organisation's Billing page) | Plan shows Pro; PITR enabled if chosen |
| D2 | Decide: migrate the existing production SQLite data, or start production Postgres empty | — | Decision written in the cutover log (`docs/operations/postgres-cutover.md` §6a) |
| D3 | Give the explicit **"Yes, run the production cutover"** — the go-ahead for applying the platform migrations to production Supabase and switching Railway production to Postgres | reply in the session that runs `production-cutover-checklist.md` | Cutover log §7 filled; `/v1/health` reports `database.engine: "postgres"` |
| D4 | Point Railway production at `main` (or keep `deploy/production` as the promotion branch, as now) with *Wait for CI* on, and deploy the nominated SHA | <https://railway.com/dashboard> → production service → Settings → Source | `/v1/health` `releaseIdentity.releaseSha` = nominated SHA |
| D5 | Choose the production public origin (Railway domain or `prilearning.com` custom domain) | Railway → Settings → Networking; DNS at Vercel | Origin recorded; fills `<PRI_PUBLIC_ORIGIN>` in the store drafts |
| D6 | If Google sign-in is wanted: create the OAuth client and set `PRI_GOOGLE_WEB_CLIENT_ID` / `PRI_GOOGLE_CLIENT_IDS`; redirect `<origin>/auth/callback.html` | <https://console.cloud.google.com/apis/credentials> | Google button works on staging |

---

## E. Build, TestFlight and physical testing

| # | Action | Link | Done when |
|---|---|---|---|
| E1 | Nominate the release SHA on `main` | — | Written in `RELEASE.md` §11 |
| E2 | Archive and upload from Xcode on the nominated SHA (`npm run build && npm run sync:ios` first) | Xcode → Product → Archive → Distribute | Build appears in App Store Connect |
| E3 | **TestFlight internal testing** with the owner's own Apple ID and test accounts | <https://appstoreconnect.apple.com/apps> → Pri Learning → TestFlight | Installed on a physical iPhone and a physical iPad |
| E4 | Physical iPad + Apple Pencil and physical iPhone finger-writing checks; VoiceOver / Dynamic Type; sandbox purchase, restore, cancel, reinstall | sandbox tester: <https://appstoreconnect.apple.com/access/users> → Sandbox | Results recorded in the release record (never as simulator evidence) |
| E5 | Create the **App Review demo accounts** on production (adult, verified; optional confirmed child account) | the app | Credentials entered only in App Store Connect's App Review fields |

---

## F. Store metadata and submission

| # | Action | Link | Done when |
|---|---|---|---|
| F1 | Counsel-approved privacy notice and terms published at `<origin>/privacy` and `/terms`; placeholders filled | — | `node tools/legal-status.mjs` → 0 placeholders; banner gone |
| F2 | Enter the App Privacy answers | App Store Connect → app → App Privacy | Matches `docs/release/app-store-privacy-labels.md` |
| F3 | Enter name, subtitle, description, keywords, URLs, category, age rating | App Store Connect → app → the version page; App Information | Matches `docs/release/store/app-store-listing.md` |
| F4 | Upload iPad 13-inch and iPhone 6.9-inch screenshots (shot list §7) | same | All required slots filled |
| F5 | Attach the two subscriptions to the version (first subscription must be submitted with a binary) | version page → In-App Purchases and Subscriptions | Both attached |
| F6 | **Submit for Review**, with release set to "Manually release this version" | version page → Add for Review → Submit | Status "Waiting for Review" |
| F7 | After approval, release manually when production is verified | same | Live |

---

## G. Google Play (Android is in V1 since §22 / #504; Play Billing certification blocks release)

| # | Action | Link |
|---|---|---|
| G1 | Register a Play developer account (organisation account recommended; identity verification) | <https://play.google.com/console/signup> |
| G2 | Create the app `com.prilearning.app`; complete Data safety, content rating, target audience (`docs/release/store/play-listing.md` §5) | <https://play.google.com/console> |
| G3 | Create and price the Play subscriptions; link Play Billing server credentials | Play Console → Monetize → Subscriptions |
| G4 | Internal testing, then closed testing (12 testers / 14 days if a personal account), then production | Play Console → Testing |
