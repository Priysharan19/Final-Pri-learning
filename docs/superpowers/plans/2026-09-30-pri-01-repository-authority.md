# PRI-01 Repository Authority Implementation Plan

> **For agentic workers:** implement this plan task-by-task and verify each gate before proceeding.

**Goal:** Make `Final-Pri-learning/main` the unambiguous production authority and bind web, server and native builds to one exact release identity.

**Architecture:** Keep the existing local-first learning architecture. Add one release metadata source plus a generated build manifest; web embeds it, server health reports it, and the native shell reads the same bundled manifest. Governance and architecture documents describe only the current runtime.

**Tech Stack:** Node 24, Vite/React, Express, Swift Package iOS shell, GitHub Actions.

**Spec:** PRI-01 execution brief supplied 2026-09-30.

## Global Constraints
- Production repository: `Priysharan19/Final-Pri-learning`.
- Production branch: `main`.
- Do not implement PRI-02 functionality.
- Production identity must include product version, build timestamp, curriculum version and exact 40-hex Git SHA.
- Unknown/placeholder SHA must fail the production verification gate.
- Preserve local-first learning; `/v1` remains the optional cloud control plane.

## Tasks
1. Add failing release-authority tests for metadata, SHA validation, drift, web/server/native exposure and canonical declarations.
2. Add `release/metadata.json`, shared release identity utilities, manifest generation and a production verifier.
3. Wire the generated manifest into Vite/web diagnostics, `/v1/health`, and the native shell without exposing secrets.
4. Reconcile package/native version declarations to the shared product version and gate drift.
5. Add repository-authority, architecture, branch-reconciliation and release-policy documents; link them from current docs.
6. Add the release authority gate to CI and make production container builds receive the exact Git SHA/timestamp.
7. Verify build/server/native structure and clean clone; record exact evidence.
8. Configure GitHub main protection using only real CI check names, or record the exact external blocker.
9. Push the task branch, open the PRI-01 PR, wait for exact-head checks, review the resulting diff, and merge only if governance permits.

## Review Focus
- Builds without `.git` must still obtain exact identity from explicit CI/build inputs.
- Local development may identify itself as development, but production may not ship `unknown`.
- Native duplicate packages must not drift from each other.
- Health/diagnostics must expose only non-sensitive release metadata.
- Stale branches/repositories must never become authority merely because they are newer or contain attractive features.
