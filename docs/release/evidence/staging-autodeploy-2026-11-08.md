# Staging auto-deploys every main merge: evidence for #646 (8 November 2026)

Read-only. Collected by lane L8 from GitHub (merge records, Release Staging Proof runs and their artifacts) and from staging's public `/release.json`, `/v1/health` and `/v1/ready`. No Railway setting, variable or log was read or changed, and production was not touched (it still serves `169bcdfe`).

#646 acceptance item 6 asks that a further independently approved main merge reach staging on its own, with no manual redeploy. Item 6 was the only one still open after 22 October. Each of the five merges since then reached staging, and staging was serving the merged SHA by the time its proof finished:

| Merge | Merged (UTC) | Main SHA | Release Staging Proof | Proof result | Proof finished |
|---|---|---|---|---|---|
| #712 Train 1 | 02:51:58 | `ef8e19698227847b58c02b5c86f5fcd05beca202` | [42331713325](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42331713325) | 14/14 | 03:00:16 |
| #716 Train 2 | 03:32:22 | `db201ad1befd2fa15d55582e9dc2f80a22196976` | [42334501487](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42334501487) | 14/14 | 03:34:23 |
| #718 Train 3 | 04:00:38 | `f1c838df72c825b68ba656df9557fc5a361c242c` | [42336526663](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42336526663) | 14/14 | 04:01:58 |
| #722 | 06:53:39 | `e0866931df746de4097f515983bc6f9cbc08e1f8` | [42348972016](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348972016) | 14/14 | 06:54:51 |
| #724 | 07:11:44 | `1d3829103eccaf470621de7124ec1755370c460e` | [42350255235](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42350255235) | 14/14 | 07:12:44 |

All on 7 November 2026. Each proof is the unmodified `tools/verify-deployment.mjs` run from a checkout at that SHA. It requires the server release SHA, the `/v1/ready` SHA and the web client's `release.json` to equal the merged SHA. It also requires Postgres reachable at schema 13 / billing 6, and verification email proven. The `staging-proof-<run>` artifacts hold the 14 lines for each run.

- **Live identity:** staging's `/release.json` read on 8 November gives `releaseSha 1d3829103…` and `buildTimestamp 2026-11-07T07:12:14Z`. That is 30 s after #724 merged at 07:11:44Z. `/v1/health` and `/v1/ready` report the same SHA, Postgres, schema 13, billing 6, `authEmail ok`.
- **Time from merge to staging, upper bounds:** 8 min 18 s, 2 min 1 s, 1 min 20 s, 1 min 12 s and 60 s. These are measured to when the proof finished. The proof only starts once Main Integrity passes, which took 5.5 minutes for #712. The one build time staging still exposes is 30 s after its merge (#724).
- **What this does and does not show:** five consecutive merges, each serving the exact merged SHA, with no deploy step in the merge record. That fits GitHub-triggered autodeploy. Railway's deployment-trigger metadata (GitHub push or CLI) was not read, because the CLI here is logged out. Anyone with Railway access can confirm it in the staging service's deployment history.
- **The proof's patience is unchanged:** the 50-minute bounded wait added after the 22 October outage is still there. Each of the five proof runs finished within 3 minutes of starting.

Verdict for #646: items 1–5 were met on 22 October. Item 6 is met as far as GitHub and the public endpoints can show: five consecutive merges deployed with no deploy step in the merge record. One confirmation remains for someone with Railway access: the staging deployment history should list those five deployments as GitHub-triggered. Closing the issue is the Director's call.
