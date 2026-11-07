# Security policy

Pri Learning is a mathematics practice product for students in India, many of them under 18.
Reports about its security or privacy are welcome and are handled by the operator named in
`docs/legal/privacy.md`.

## Reporting a vulnerability

Please report privately. Do not open a public issue for a security problem.

1. **GitHub private vulnerability reporting**:
   <https://github.com/Priysharan19/Final-Pri-learning/security/advisories/new>. This is the
   preferred route; it keeps the report, the fix and the credit in one place.
2. **Email**: the contact address published in `docs/legal/privacy.md` ("Questions"), with
   `[security]` at the start of the subject line.

Include what you found, where (host, route, file or build), how to reproduce it, and what you
think the impact is. A proof of concept is helpful; a working exploit against live users is
not needed and must not be run (see the scope below).

## What to expect

- An acknowledgement within five working days. This is a small team; there is no 24-hour desk.
- Triage against the release gates in `AGENTS.md`: a confirmed security regression is
  release-blocking, and a fix lands through the ordinary pull-request path with required CI,
  never by direct push.
- A fix or a mitigation, then a note in the advisory. Credit is given if you want it.
- No payment programme exists at this time.

## Scope

In scope:

- the web client (`client/`), the server (`server/`), the iOS and Android shells (`ios/`,
  `android/`), the database policies (`supabase/`) and the GitHub Actions workflows;
- the staging host `https://pri-learning-staging-staging.up.railway.app` and the production host
  `https://final-pri-learning-production.up.railway.app` (their `/v1/health` reads name the
  commit they run).

Please do not:

- test against accounts you do not own, or read, change or delete another person's data —
  the product holds children's learning records;
- run denial-of-service, volumetric or automated scanning against the live hosts;
- send handwriting or photo uploads in bulk to the live reader (it is a paid provider call);
- use social engineering, phishing or physical access against the operator or testers.

A good-faith report that follows these rules will not be treated as a breach of the terms of
use, and no legal action will be taken over it.

## What is already enforced

These are the controls a report is measured against, with the code that enforces them:

| Control | Where |
|---|---|
| Row-Level Security on every client-reachable table plus server authorisation on every route | `supabase/migrations/`, `server/platform/`, `docs/security/route-inventory.json` |
| Provider and database credentials only in server environment variables, never in the client, the repository or logs | `tools/secret-scan.mjs` (CI), `docs/security/threat-model.md` |
| Handwriting recognition is answer-blind: no expected answer, solution or mark is ever sent to a reader | `server/platform/handwritingProvider.js`, `client/test/ink-answer-blind-static-check.mjs` |
| A model proposes, the deterministic marker decides | `client/src/engine/`, `server/platform/markerOps.js` |
| Runtime dependency advisories fail CI at any level | `tools/runtime-audit-floor.mjs` |
| CodeQL on the JavaScript client, server and tooling | `.github/workflows/codeql.yml` |
| Workflow supply chain: least-privilege permissions, actions pinned to full commit SHAs, no privileged execution of pull-request code | `tools/ci-workflow-policy-check.mjs` |
| Accepted, documented residual risks | `docs/security/accepted-risks.md` |

## Supported versions

Only the commit production serves (`deploy/production`, visible at
`/v1/health` → `releaseIdentity.releaseSha`) and the current `main` are supported. Store builds
carry the same commit in their diagnostics; an older build is asked to update rather than
patched in place.
