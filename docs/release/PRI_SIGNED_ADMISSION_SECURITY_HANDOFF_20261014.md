# P0 signed writer-admission control plane — independent security handoff

Date: 14 October 2026
Repository: Priysharan19/Final-Pri-learning
Target: Issue #489, baseline recovery PR #492; signup PR #478 remains blocked.

## Non-release claim

This stacked implementation is a **DRAFT, unapproved code candidate**. It must not issue a real writer lease, migrate mission status, merge into protected main, promote signup, or deploy. Its signed-event tests use ephemeral in-memory key pairs. No production signing key, protected grant branch, independent reviewer approval, or real authenticated grant transaction has been provisioned.

## Implementation isolation and boundaries

- Trusted controller: `scripts/pri-admission-state.mjs`, `scripts/pri-admission-github.mjs`.
- Manual/task branch authorisation: `scripts/pri-manual-authorization.mjs`.
- GitHub workflows: `pri-writer-authority.yml` and guarded `pri-agent-governance.yml`.
- Event identity is signed using Ed25519 and SHA256-linked to the previous event. An issue body is an untrusted projected view and cannot mint a lease.
- GitHub non-force fast-forward ref update serialises competing commits. Fail on SHA movement, event reorder, forged signature, stale issue/PR, modified main, wrong primary owner, scope escape, expired heartbeat and owner collision.
- The `task/*` / `feature/*` prefix does not provide approval. A trusted-main verifier requires a GitHub-authenticated writer creator, an independent exact-head human APPROVED review, and designated security approval for sensitive paths. A test in candidate source must not be used as the authoritative PR gate.
- Signed authority revocation can be executed against orphaned/expired grants without reopening or trusting the source PR. Issue remediation can still require a separately approved recovery if post-CAS issue synchronization fails.

## Real GitHub transport proof — NOT a live grant

Isolated QA branch: `qa-proof/pri-admission-cas-20261014-1791977743976`, from protected main `ce8d4b06c91736c82a0e9920917914fe086de6d3`.
Two contenders built independent child commits on the same parent: `24bb428db01625197a6e81f009da1b2bb9b33624`, `ef75221fa31be02116bd3e31c74fa2251431b793`.
Concurrent non-force writes: 200 / 422, exactly one committed. Next-parent simulated revocation commit `753865202c6b747ea474c7fb492bba067d77c84e` accepted 200; stale replay denied 422.
This validates GitHub ref CAS transport only, not production grant signing, branch protection, or app authorisation.

## Human / platform configuration blockers (explicit action owners)

1. **Independent reviewer Kalp-Bajpai** (confirmed GitHub `write` collaborator): independently review and submit APPROVED on the **exact candidate head** for this stacked PR, then on the resulting #492 head after integration. Review threat model, GitHub API permissions, link between submitted approval and workflow execution, event-log append-only history, revocation/crash recovery, source scope, branch-prefix bypass, actor impersonation and admissibility invariants. No self-approval; bot COMMENTED is insufficient.
2. **Repository administrator Priysharan19**: configure a new GitHub environment `pri-writer-admission` with required reviewer(s), independent reviewer approval, and `prevent_self_review=true`. Configure a protected `pri-writer-admissions` branch or ruleset disallowing force updates, deletion and ordinary direct pushes; allow **only a dedicated audited governor GitHub App** to perform narrow CAS writes. Record ruleset IDs and a positive/negative permission test. GitHub Actions job currently has no demonstrated ability to update a protected ref safely.
3. **Repository administrator and security reviewer together**: provision the governor's Ed25519 **private key only through the approved protected environment or dedicated KMS**, verify matching PEM public key at `.pri-os/admission-public-key.pem` on protected main, and restrict key access to the independently approved workflow. Provision the app token with necessary ref/issue permissions and administrative metadata-read as required for environment/branch-protection verification. **Do not use the developer's personal GH token or bypass protections**; do not expose private key in a PR, comment, artifact or CI logs.
4. **Independent QA/release reviewer**: verify exact-head required CI and adversarial tests on final #492 merge candidate, including signed log rollback, workflow fork/candidate tampering, duplicate markers, negative grants, controller concurrency, orphan PR revocation, crash after CAS but before issue sync, and replay by a stale workflow run. Do not weaken or drop required checks to progress.
5. **Governor + actual mission owners**: after *protected* merge and explicit release-authority approval, migrate #456 to pinned REVIEW **of PR #457**, not integration PR #458; #483 to pinned REVIEW of PR #484; confirm with authors whether #470's PR #472 and #485's PR #486 are still writing. If no longer writing, move truthfully to pinned REVIEW or REPAIR_PENDING as appropriate. Never declare DONE, certify mathematical content, or invent heartbeat. Exclude historical closed issues #172/#207 from writers. Validate the entire authoritative managed-issue inventory before admission.
6. **Signup owner**: PR #478 currently uses `task/onboarding-activation-gate-20261014` and includes student-experience source, qa-release tests, Android and iOS-derived assets. It is **not a single owner-scoped `agent/mission/*` PR**. Prepare the exact writer-owned signup source slice and a governed mission issue/branch, with QA/native work separately assigned. A signed grant must name an exact canonical agent, paths, issue, PR and head SHA; it must not backdate or turn #478 into a multi-owner lease.

## Remaining release gates

- Full successful protected branch/secret/environment setup with recorded independent reviewer.
- Real protected GitHub signed grant `GRANT` and `REVOKE` proof, not merely simulated transport.
- Crash-after-CAS issue reconciliation and exactly-once semantics tested on GitHub.
- Exact main SHA governance and full mission ledger validation, independently repeated after migration.
- Authenticated exact-scope signup writer receipt, followed by staging and end-to-end signup acceptance.

**Current verdict: CODE REVIEW CANDIDATE ONLY — ISSUE #489 BLOCKED.**
