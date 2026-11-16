# Region isolation: what to verify on the real Australian deployment

Status: **NOT YET VERIFIED.** The Prithagoras (Australia) deployment does not exist yet (plan H1, owner decision O1). Nothing on this page has been checked against a real deployment. Every row below stays `NOT YET VERIFIED` until a named person records real evidence for it; a local or simulated run never changes a row.

ADR-0002 §9: each edition runs as its own deployment, with its own accounts, database, storage, secrets, backups and budgets, and a request never chooses the edition. Plan H2 made the software half of that enforceable and tested before the region exists:

| Control | Where | Proven by |
| --- | --- | --- |
| A database is bound to one edition (`platform_meta.edition`); a server pointed at the other edition's database stops before it listens | `server/platform/edition.js` `bindDatabaseEdition`, called by `createServerApp` | `server/test/region-isolation-check.mjs` (SQLite and, in `npm run test:platform:pg`, Postgres as `pri_server`) |
| Two servers over separate databases share no account, session, CSRF token, verification or reset token, idempotency key, resource, desk attempt or payment event | each deployment's own database and `PRI_AUTH_DELIVERY_KEY` | `server/test/region-isolation-check.mjs` (two local instances) |
| A client-supplied edition (header, query, cookie, body) only ever refuses | `refuseOtherEdition` (E2), the only reader | runtime probe over every route in `docs/security/route-inventory.json` and a static scan of `server/`, same suite |
| Live probes needing no credential | `tools/verify-region-isolation.mjs` | `tools/verify-region-isolation.test.mjs` (stubbed fetch and two local instances — simulated) |

A database that predates the binding (production India today) is bound to `priyabhata` by the first Priyabhata server that starts on it; a Prithagoras server meeting a database with accounts and no binding refuses to start.

**Changing a database's edition is not possible through the application.** It is a manual, owner-authorised operation: a written decision naming the database, the reason and the person, then `UPDATE pri.platform_meta SET value = '<edition>' WHERE key = 'edition'` run by the database owner, recorded in the ops log. There is no legitimate routine reason to do it.

## The checklist for the day H1 lands

Run each line once the Australian region exists, record the evidence (command output or console screenshot with the project name and region visible, the date, and who ran it) in an ops log under `docs/operations/`, and only then change that row's status. The owner signs the record. Simulated, local or staging results are labelled as such and never recorded against a production row.

| # | Check | Evidence to record | Signed by | Status |
| --- | --- | --- | --- | --- |
| R1 | Two separate Supabase projects; India's in Mumbai (`ap-south-1`), Australia's in Sydney (`ap-southeast-2`) | Supabase console: each project's name, reference and region | Owner | NOT YET VERIFIED |
| R2 | Each Railway service's `PRI_DATABASE_URL` points at its own project only (host and project reference differ) | Railway variables page per service (password redacted); reference matches R1 | Owner | NOT YET VERIFIED |
| R3 | Each database is bound to its edition | `SELECT value FROM pri.platform_meta WHERE key = 'edition'` on each: `priyabhata` / `prithagoras` | Owner | NOT YET VERIFIED |
| R4 | The binding refuses a crossed URL on the real infrastructure | Start a throwaway Prithagoras service (no traffic) against the India database URL; its log shows `edition_binding: … refusing to start` and it never becomes healthy; delete the service | Owner | NOT YET VERIFIED |
| R5 | Live probes pass between the two production origins | `node tools/verify-region-isolation.mjs --a <india origin> --b <australia origin>` output, all PASS | Owner | NOT YET VERIFIED |
| R6 | A session from one region is unauthorised on the other | Same command with `PRI_REGION_PROBE_COOKIE_A` set to a throwaway test account's session cookie (only where the test-mailbox policy allows a test account); the row reads PASS, not NOT RUN; delete the account afterwards | Owner | NOT YET VERIFIED |
| R7 | Separate storage buckets, each in its own region; no bucket shared or cross-readable | Storage console per project: bucket names, region, access policy | Owner | NOT YET VERIFIED |
| R8 | Separate backup targets, each in its own region | Backup settings per project (target, region, retention) | Owner | NOT YET VERIFIED |
| R9 | A restore rehearsal per region, into a scratch project in the same region | Rehearsal log per region: snapshot time, restored row counts, `platform_meta.edition` of the restored copy | Owner | NOT YET VERIFIED |
| R10 | Separate admin accounts with MFA on each platform (Supabase, Railway, email provider, model provider) | Member lists per project; MFA shown enabled | Owner | NOT YET VERIFIED |
| R11 | No service credential is shared: `PRI_AUTH_DELIVERY_KEY`, session and CSRF secrets, `PRI_METRICS_TOKEN`, operator tokens, database passwords and provider keys differ between the two services | Compare digests, not values: `printf %s "$VALUE" \| shasum -a 256 \| cut -c1-12` per variable per service, recorded side by side | Owner | NOT YET VERIFIED |
| R12 | Separate model-provider keys and AI budgets per region | Provider console: two keys, two projects or limits; `PRI_PAID_CALLS_PER_HOUR` set on each (docs/operations/ai-budgets-per-region.md) | Owner | NOT YET VERIFIED |
| R13 | Separate payment configuration: Prithagoras carries no Razorpay or India price variable (the server refuses them in production, E5) | Railway variables list for the Australian service | Owner | NOT YET VERIFIED |
| R14 | Separate email sending identity and domain per edition | Email provider console: sending domain per service | Owner | NOT YET VERIFIED |
| R15 | Legal confirmation that the separation meets Australian and Indian requirements (O4) | Counsel's written note | Owner and counsel | NOT YET VERIFIED |

## What one server cannot check

A single server cannot see the other deployment's secrets, so reuse of a secret across the two deployments (R11) is detectable only by the comparison above. Row-Level Security confines account-scope transactions to the caller's rows but is no boundary against a compromised `pri_server` credential (`docs/security/threat-model.md` §7): separate databases and separate credentials are the boundary between regions.
