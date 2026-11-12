# Postgres cutover: Supabase (Mumbai) behind the Railway `/v1` server

Status: **staging has run this procedure; production has not.** Staging
(`https://pri-learning-staging-staging.up.railway.app`) serves `main` on Supabase Postgres at
schema **12** / billing **6** (`/v1/health` and `/v1/ready`, read on 2026-10-19; the schema-12
migration was applied on 2026-10-18 through the placeholder workdir of §2.5). Production
(`https://final-pri-learning-production.up.railway.app`) still runs SQLite on a Railway volume with
no `PRI_DATABASE_URL`; its Supabase project has no `pri` schema. The software side — migrations,
driver, target check, the SQLite data export in §6a, `scripts/release-nominate.mjs` and
`npm run verify:deployment` — is complete; every production step is `BLOCKED_EXTERNAL` on the
owner and is listed in order in `docs/release/LAUNCH-RUNBOOK.md` and
`docs/release/production-cutover-checklist.md`. The promotion order, with its 24-hour soak gate,
is §4.6 below.
Schema version numbers in this document are those of `server/platform/schemaVersions.js`
(`SCHEMA_VERSION`, `BILLING_SCHEMA_VERSION`) and the migrations under `supabase/migrations/`;
if they ever disagree with that module, the module is right and this document is stale.
Authority: ADR-0001 (`docs/architecture/adr-0001-online-first-runtime.md`). Every step that
touches a hosted system needs the owner's explicit go-ahead at the time it is run; production
steps additionally need the backup in §6 to exist first.

The order is fixed: **staging first, then production, never both at once.** Staging is the
Supabase project `orudxrckgxyyraopyzmn` (region `ap-south-1`, Mumbai) and the Railway
*staging* environment. Production repeats §2–§5 against the production project and the
Railway *production* environment only after staging has run cleanly (§5.4).

---

## 1. What the server requires of the database

The `/v1` server selects Postgres when `PRI_DATABASE_URL` is set and then refuses to start
unless all of the following hold (each failure is a coded error on stderr; the URL is never
printed):

| Requirement | Enforced by | Error code |
|---|---|---|
| URL is `postgres://` / `postgresql://` with a host | `config.js` | `PLATFORM_DB_URL_INVALID` |
| **Production:** verified TLS — `sslmode=verify-full` (preferred), or `sslmode=require` **with** `PRI_DATABASE_SSL_ROOT_CERT` | `config.js postgresConnectionSettings` | `PLATFORM_DB_TLS_REQUIRED` (no/weak sslmode) / `PLATFORM_DB_TLS_UNVERIFIED` (`require` without the CA) |
| No `sslrootcert`/`sslcert`/`sslkey`/`ssl=` in the URL (CA goes in `PRI_DATABASE_SSL_ROOT_CERT`) | same | `PLATFORM_DB_TLS_INVALID` |
| **Session mode only:** not Supavisor's transaction port **6543** (authority, `?port=` or `PGPORT`), no `pgbouncer=` (other than `false`), no `pool_mode=transaction`/`statement` | `config.js assertSessionModeUrl` (from `postgresConnectionSettings`, before any pool exists) | `PLATFORM_DB_TRANSACTION_POOLER` |
| Reachable, migrated (`platform_meta.schema_version` present) | `store.js createPostgresStore` | `PLATFORM_DB_UNAVAILABLE` / `PLATFORM_DB_NOT_MIGRATED` |
| `schema_version` = **15** and `billing_schema_version` = **6** exactly (`server/platform/schemaVersions.js`) | `store.js assertSchemaVersions` | `PLATFORM_DB_SCHEMA_MISMATCH` |
| `pri.sync_cursor_seq` exists (migration `20261002000000`) | same | `PLATFORM_DB_SCHEMA_MISMATCH` |
| Timeouts, lock wait and pool size parse as whole numbers in range | `config.js postgresSessionLimits` | `PLATFORM_DB_CONFIG_INVALID` |

### Schema versions and the migrations that set them

`server/platform/schemaVersions.js` is the authority; this table is its reading at schema **15** /
billing **6**. A deployed build boots only against a database at exactly these numbers
(`PLATFORM_DB_SCHEMA_MISMATCH` otherwise), so a schema-changing merge and its migration are one
back-to-back operation (§2.6).

| Version | Migration (`supabase/migrations/`) | What it adds | Rollback |
|---|---|---|---|
| schema 6 / billing 3 | `20261001000000_platform_schema.sql` | every `pri` table, RLS on, the `pri_server` role, `platform_meta`, `sync_cursors` | none written: the first production push runs against an empty schema |
| schema 7 | `20261002000000_sync_cursor_sequence.sql` | `pri.sync_cursor_seq`; `sync_cursors` closed to `pri_server` | §5.3 |
| schema 8 | `20261002010000_tutor_cache.sql` | the 24-hour AI tutor reply cache | §5.2a |
| billing 4 | `20261003000000_billing_payment_retention.sql` | payments outlive their account (`ON DELETE SET NULL`) | §5.3a |
| billing 5 | `20261003010000_storekit_entitlement_state.sql` | subscription lifecycle state, Apple signed-data ledger, support grants | owner-approved, written at the time (§5.2a note) |
| billing 6 | `20261004000000_google_play_billing.sql` | Google Play tables | owner-approved, written at the time |
| schema 9 | `20261005000000_account_age_basis.sql` | `accounts.age_basis`, the age decision at creation | owner-approved, written at the time |
| schema 10 | `20261006000000_otp_sign_in.sql` | `otp_challenges`, `account_phones`, `guardian_consents.guardian_phone` | owner-approved, written at the time |
| schema 11 | `20261007000000_security_hardening.sql` | staff MFA, guardian-withdraw credential, append-only `audit_log`, per-account RLS on the sync tables | owner-approved, written at the time |
| schema 12 | `20261016000000_rls_fail_closed.sql` (#522) | RLS deny-by-default: every `pri` table requires a declared `pri.scope` (`system` or `account`); the 19 account-owned tables admit only system scope or their own account; the store declares the scope on every statement | `docs/release/rollback/20261016000000_rls_fail_closed.rollback.sql` |
| **schema 13** | `20261019000000_rls_account_coverage.sql` (train 10, security P2) | **account RLS on every account-bearing table**: `accounts`, the class/teacher tables, issue reports, the nullable-account billing ledgers, OTP challenges, the audit trail, content authorship, teacher invites and feature-flag provenance get a RESTRICTIVE `pri_account_scope` (system scope, or account scope on the row's own owner column); no row changes | `docs/release/rollback/20261019000000_rls_account_coverage.rollback.sql` |
| **schema 14** | `20261022000000_parent_report.sql` (parent weekly report) | `parent_report_links` (a parent's double-opt-in address, its state and sealed unsubscribe credential) and `parent_report_sends` (one row per account and week); both account-scoped under RLS (`pri_scope_required` + RESTRICTIVE `pri_account_scope`), cascade with the account | `docs/release/rollback/20261022000000_parent_report.rollback.sql` (drops both tables: deletes the links and the send ledger) |
| **schema 15** | `20261113000000_resource_library.sql` (ADR-0002 plan F1) | the shared resource library: `resources` (papers, solutions and notes linked where they are published, each with course, syllabus version, certification state, source, attribution, rights note, disclaimer and review state) and `resource_editions` (which editions offer each); both global, under RLS with the fail-closed `pri_scope_required` only (no account owns a row); seeded with the one published Prithagoras paper | `docs/release/rollback/20261113000000_resource_library.rollback.sql` (drops both tables; no account data) |

Applied on staging: all eleven up to schema 13, in this order (schema 12 on 2026-10-18 by §2.5; schema 13 after train 10). Observed
live on 2026-11-07, read-only: staging `GET /v1/health` reports `schemaVersion "13"`, `billingSchemaVersion "6"`, Postgres, release
`a5778a3`. Applied on production: none (production still serves SQLite at schema 12, release `169bcdf`). Schema 14 (parent report) is applied on staging right after its PR merges; schema 15 (resource library) likewise after its PR.

### Connection: session mode only (mandatory, enforced at boot)

The server holds one connection per transaction, takes **session-level advisory locks**
(per-account sync lock, with `pg_try_advisory_lock`; waiters for the same account queue inside
the server process without holding a connection), runs **SERIALIZABLE / REPEATABLE READ** transactions across several
statements and issues **`SET`** once per connection for `search_path`, `statement_timeout`,
`idle_in_transaction_session_timeout` and the **row-level-security scope** `pri.scope = 'system'`
(every statement outside a transaction runs in it as a single round trip; account transactions
override it with `SET LOCAL` until COMMIT/ROLLBACK — `docs/security/threat-model.md` §7). All of
that needs a real session per connection.

* Use the **direct connection** (`db.<ref>.supabase.co:5432`) if Railway can reach it (Supabase
  direct connections are IPv6 unless the IPv4 add-on is enabled), **or** the Supavisor
  **session-mode** pooler (`aws-0-ap-south-1.pooler.supabase.com`, **port 5432**, user
  `<role>.<ref>`). Staging uses the session pooler on 5432.
* **Never** the transaction-mode pooler (port **6543**): the session settings above — including
  the RLS scope — would apply to whichever backend served the previous transaction, advisory
  locks would be lost between statements, and the per-account cursor ordering guarantee would not
  hold. The server **refuses to start** with such a URL: port 6543 from any source node-postgres
  reads (the authority port, a `?port=` query parameter — which overrides it — or `PGPORT` for a
  URL with neither), `pgbouncer=` with any value but `false`, or `pool_mode=transaction`/`statement`
  (parameter names in any case) stop the boot with
  `PLATFORM_DB_TRANSACTION_POOLER` before a pool is created, and production readiness reports it.
  `server/test/postgres-connection-config-check.mjs` pins the refusals and that the staging shape
  passes.

### TLS

`sslmode` in `PRI_DATABASE_URL` is read by the server, removed from the string handed to `pg`,
and turned into an explicit `ssl` option:

| `sslmode` | Production | Encrypted | Certificate verified |
|---|---|---|---|
| `verify-full` | allowed (**use this**) | yes | yes — chain and host name; against `PRI_DATABASE_SSL_ROOT_CERT` if set, else the system trust store |
| `require` + `PRI_DATABASE_SSL_ROOT_CERT` | allowed | yes | yes — chain and host name against that CA |
| `require` without the CA | **refused** (`PLATFORM_DB_TLS_UNVERIFIED`); allowed outside production only | yes | **no** — encrypted but unauthenticated (libpq semantics), open to an active man-in-the-middle |
| absent / `disable` / `allow` / `prefer` | **refused** | — | — |
| `verify-ca` | refused everywhere | — | — |

**Getting the Supabase CA certificate.** In the Supabase dashboard for the project: *Project
Settings → Database → SSL Configuration → Download certificate*. The file (named like
`prod-ca-2021.crt`) is a PEM certificate: it starts with `-----BEGIN CERTIFICATE-----`. Check it
before use, on the operator's machine:

```bash
openssl x509 -in ~/Downloads/prod-ca-2021.crt -noout -subject -issuer -enddate
```

Set `PRI_DATABASE_SSL_ROOT_CERT` to the **PEM text** of that file. Railway variables are text, so
paste the whole PEM (BEGIN/END lines and newlines included), not a file path. It is a public
certificate, not a secret, but it is what makes the connection authenticated: without it (or
`verify-full` against the system store) production will not boot.

> **To confirm on staging (§4.3), not assumed:** that `verify-full` with that CA succeeds
> against the host name actually used (direct host vs. pooler host). If it does not, record the
> exact TLS error in the cutover log and stop; do not fall back to unverified TLS — production
> refuses it (`PLATFORM_DB_TLS_UNVERIFIED`).

Also turn on **Enforce SSL on incoming connections** in the Supabase database settings so the
server side refuses plaintext as well.

### Session limits and pool size (Railway variables)

| Variable | Default | Range | Meaning |
|---|---|---|---|
| `PRI_DATABASE_STATEMENT_TIMEOUT_MS` | 15000 | 1000–600000 | Any statement, **including a wait for a row or advisory lock**, is cancelled after this. Answered as `503 PLATFORM_DB_TIMEOUT` + `Retry-After: 2`. |
| `PRI_DATABASE_IDLE_TX_TIMEOUT_MS` | 30000 | 1000–3600000 | A session idle inside an open transaction is ended by Postgres; the request gets `503 PLATFORM_DB_TIMEOUT`, the connection is discarded. |
| `PRI_DATABASE_LOCK_WAIT_MS` | 5000 | 100–60000 | How long a push may wait for its account's lock (queued in process, then `pg_try_advisory_lock` if another instance holds it) before `503 PLATFORM_DB_BUSY` + `Retry-After: 1`. One account's burst holds at most one connection per instance. |
| `PRI_DATABASE_POOL_IDLE_MS` | 300000 | 1000–3600000 | How long an unused pooled connection is kept before it is closed (TCP keep-alive is on). A new connection costs several round trips (TCP, TLS, authentication, session setup) before its first statement; at the earlier fixed 30 s nearly every request after a pause paid them. Watch `dbAcquireMs` on the `http_request` log line. |
| `PRI_DATABASE_POOL_MAX` | 10 | 1–50 | Connections per server replica. `POOL_MAX × replicas` must stay **below** the session-mode pool size (or `max_connections` minus Supabase's reserved/dashboard connections for a direct connection). |

Exhausted serialization retries and a pool that cannot hand out a connection within 10 s are
answered `503 PLATFORM_DB_BUSY` + `Retry-After: 1`. None of these is ever a 500.

---

## 2. Apply the migrations to staging

Prerequisites: a repository checkout at the commit being deployed, Node 24, the Supabase CLI via
`npx supabase@latest` (no global install), and an owner logged in to Supabase.

```bash
# 2.1  Authenticate the CLI (opens a browser; the token stays in the CLI's own store).
npx supabase@latest login

# 2.2  Link this checkout to STAGING. Prompts for the database password of the
#      `postgres` role — type it; never put it on the command line or in a file.
npx supabase@latest link --project-ref orudxrckgxyyraopyzmn

# 2.3  See what would be applied. Expect exactly the files in supabase/migrations/
#      that are not yet in the remote history, in filename order:
#        20261001000000_platform_schema.sql              (schema 6, billing 3: every table, RLS, pri_server)
#        20261002000000_sync_cursor_sequence.sql         (schema 7: pri.sync_cursor_seq; sync_cursors closed to pri_server)
#        20261002010000_tutor_cache.sql                  (schema 8: the AI tutor reply cache)
#        20261003000000_billing_payment_retention.sql    (billing 4: payments outlive their account)
#        20261003010000_storekit_entitlement_state.sql   (billing 5: subscription lifecycle state, Apple signed-data ledger, support grants)
#        20261004000000_google_play_billing.sql          (billing 6: Google Play tables)
#        20261005000000_account_age_basis.sql            (schema 9: accounts.age_basis, the age decision at account creation)
#        20261006000000_otp_sign_in.sql                  (schema 10: otp_challenges, account_phones, guardian_consents.guardian_phone)
#        20261007000000_security_hardening.sql           (schema 11: staff MFA, guardian-withdraw credential, append-only audit_log, per-account RLS)
#        20261016000000_rls_fail_closed.sql              (schema 12: every table requires a declared pri.scope; 19 account-owned tables fail closed)
#        20261019000000_rls_account_coverage.sql         (schema 13: account RLS on the 15 other account-bearing tables)
#        20261022000000_parent_report.sql                (schema 14: parent weekly report link + send ledger, account-scoped RLS)
#        20261113000000_resource_library.sql             (schema 15: the shared resource library, global tables, fail-closed RLS)
#      The list must end at the versions schemaVersions.js states (schema 15 / billing 6);
#      `ls supabase/migrations/` at the deployed commit is the authority if this comment lags.
npx supabase@latest migration list
npx supabase@latest db push --dry-run

# 2.4  Apply. The CLI does NOT wrap a file in a transaction; every migration here
#      opens and commits its own (begin; … commit;), so a failure part-way leaves
#      that file unapplied and stops the push there.
npx supabase@latest db push
```

### 2.5 The shared Supabase project: remote-only migration versions

The staging project (and any project shared the same way) also holds the migration history of
the **Pri-Learning-India** repository — on staging, 38 versions `20260910…`–`20260928…` that
this repository does not have. `db push` then refuses ("Remote migration versions not found in
local migrations directory"). Observed on staging on 18 Oct 2026 while applying
`20261016000000_rls_fail_closed.sql`.

* **Never run `supabase migration repair`** for those versions: it rewrites the remote history
  that the other repository owns, and its next push would then re-run or skip the wrong files.
* **Never** add placeholder files to this repository's `supabase/migrations/`.

What worked on staging, and what production must do the same way — a throwaway working
directory holding this repository's migrations plus an **empty** placeholder per remote-only
version (never executed: those versions are already recorded remotely, so the CLI only checks
that a local file with that version exists):

```bash
# 2.5.1  From the checkout at the commit being deployed, list what the remote has that we do not.
npx supabase@latest migration list --linked
#        → note every version with a Remote column and no Local column (the other repo's).

# 2.5.2  A throwaway workdir: our migrations + one empty placeholder per remote-only version.
WORK="$(mktemp -d)"; mkdir -p "$WORK/supabase/migrations"
cp supabase/migrations/*.sql "$WORK/supabase/migrations/"
for v in <each remote-only version from 2.5.1>; do
  : > "$WORK/supabase/migrations/${v}_remote_only_placeholder.sql"
done

# 2.5.3  Link the workdir to the SAME project (password typed at the prompt) and dry-run.
#        The dry run must list ONLY the new file(s) from this repository — nothing else.
#        Any other file listed: stop; do not push.
(cd "$WORK" && npx supabase@latest link --project-ref <project-ref> && npx supabase@latest db push --linked --dry-run)

# 2.5.4  Apply — only as step 1 of the back-to-back sequence in §2.6.
(cd "$WORK" && npx supabase@latest db push --linked)

# 2.5.5  Remove the workdir (it holds the CLI's link state for the project).
rm -rf "$WORK"
```

### 2.6 Migration and redeploy are one back-to-back operation

The server refuses to boot unless `platform_meta.schema_version` equals the build's
(`assertSchemaVersions`), and a build from before a scope-changing migration such as schema 12
cannot read the migrated tables at all (its statements declare no `pri.scope`, so RLS shows them
nothing). Railway deploys `main` automatically when a PR merges, and **a failed post-merge deploy
removes the previous deployment**: on 18 Oct 2026 the post-merge staging deploy of #522 crashed
on schema 11 and staging served nothing until the migration was applied and the service
redeployed. **A short outage between merge and migrate is unavoidable for a scope-changing migration.** The
old build cannot read the migrated schema and the new build will not boot on the old one, so
there is no order in which both work: from the moment the first of the two happens until the
second completes, the service answers nothing useful. The procedure below keeps that window to
the minutes the two steps take; it cannot remove it. Announce it, and pick a quiet hour.

So, for every PR that changes `SCHEMA_VERSION` or `BILLING_SCHEMA_VERSION`:

1. Before merging, have §2.5.1–2.5.3 done (dry run lists only the new file) and the operator at
   the terminal.
2. Merge, then **immediately** apply (§2.5.4, or §2.4 on a project with no foreign history).
3. **Immediately** redeploy the service (Railway → Deployments → Redeploy) — do not wait for a
   crash loop to back off.
4. Verify `GET /v1/ready` → 200 with Postgres ready and the new `schemaVersion`, then a signed-in
   `GET /v1/account/me` → 200 and `GET /v1/sync/pull/0` → 200 with a test account.
5. Record the times of 2–4 in the cutover log. If 2 fails, the rollback file for that migration
   (`docs/release/rollback/`) plus a redeploy of the previous build is the way back.

`db push` reads `supabase/migrations/` from the linked checkout. The migrations create schema
`pri`, the `NOLOGIN` role `pri_server`, every table with RLS on and a single
`pri_server`-only policy, revoke everything from `anon`/`authenticated`, and seed
`platform_meta`, `sync_cursors` and (schema 15) the resource library's seed paper in `resources` /
`resource_editions`. They never touch `public`, `auth` or `storage`. The SQLite export does not copy
those seeded tables, and refuses (`EXPORT_LIBRARY_NOT_SEED`) a source whose library holds anything but
the seed, so no library row is silently left behind.

---

## 3. Create the login role the server uses

`pri_server` is `NOLOGIN` by design. The server logs in as a separate role that is a **member**
of `pri_server` and nothing else. Create it with `psql` connected to staging as `postgres`
(Dashboard → Connect → session pooler string; type the `postgres` password at the prompt), so
the new role's password is set with `\password`: psql hashes it (SCRAM) on the operator's
machine, and the plaintext never reaches the server, its statement log or the SQL editor's
saved history — which a `CREATE ROLE … PASSWORD '…'` statement would.

```sql
-- 3.1  The role, without a password yet.
create role pri_app_staging login connection limit 20;
grant pri_server to pri_app_staging;          -- INHERIT (the default) is required
```

```text
-- 3.2  Generate the password on the operator's machine, e.g.
--        openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48
--      and enter it twice at this prompt. It goes here and into the Railway
--      variable (§4) — nowhere else: not a file, the repository, chat or a ticket.
\password pri_app_staging
```

```sql
-- 3.3  Check: member of pri_server, not superuser, cannot bypass RLS.
select r.rolname, r.rolsuper, r.rolbypassrls, pg_has_role(r.rolname, 'pri_server', 'MEMBER') as member
from pg_roles r where r.rolname = 'pri_app_staging';
-- expect: rolsuper = false, rolbypassrls = false, member = true
```

`connection limit` should be at least `PRI_DATABASE_POOL_MAX × replicas` plus a small margin.

---

## 4. Point Railway staging at it

### 4.1 Variables (Railway → project → **staging** environment → `/v1` service → Variables)

| Variable | Value |
|---|---|
| `PRI_DATABASE_URL` | `postgresql://pri_app_staging.orudxrckgxyyraopyzmn:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=verify-full` (session-mode pooler) — or the direct host `db.orudxrckgxyyraopyzmn.supabase.co:5432` with user `pri_app_staging` |
| `PRI_DATABASE_SSL_ROOT_CERT` | the Supabase root certificate PEM (§1, TLS) |
| `PRI_DATABASE_STATEMENT_TIMEOUT_MS` | `15000` (or leave unset) |
| `PRI_DATABASE_IDLE_TX_TIMEOUT_MS` | `30000` (or leave unset) |
| `PRI_DATABASE_LOCK_WAIT_MS` | `5000` (or leave unset) |
| `PRI_DATABASE_POOL_MAX` | `10` (see §1 sizing) |

Mark `PRI_DATABASE_URL` as **sealed**. Remove `PRI_PLATFORM_DB` from the staging service: with
`PRI_DATABASE_URL` set it is ignored, and leaving it invites confusion during rollback.

### 4.2 Verify the target before the service uses it

From the operator's checkout (not from the container — the tool reads the SQLite schema from
the source tree), with the **same** values as the Railway variables, entered at a prompt rather
than typed into the command line so they stay out of shell history:

```bash
read -rs PRI_DATABASE_URL && export PRI_DATABASE_URL
export PRI_DATABASE_SSL_ROOT_CERT="$(cat ~/Downloads/prod-ca-2021.crt)"   # the downloaded Supabase CA
NODE_ENV=production npm run verify:platform:pg-target
unset PRI_DATABASE_URL PRI_DATABASE_SSL_ROOT_CERT
```

`server/tools/postgres-target-check.mjs` connects exactly as the server does and changes nothing
that persists. It must print `POSTGRES TARGET: PASS` with every line ticked:

* boot checks (TLS policy, `schema_version` 12 / `billing_schema_version` 6, cursor sequence);
* TLS negotiated (`pg_stat_ssl`), `statement_timeout` / `idle_in_transaction_session_timeout` applied;
* login role is a `pri_server` member, not superuser, not BYPASSRLS;
* the live schema gate — every table, column type, key, CHECK expression, index, RLS policy
  (`FOR ALL`, permissive, `true`/`true`), every privilege of `pri_server`, `anon` and
  `authenticated` (including that `pri_server` can only **read** `sync_cursors`), the cursor
  sequence at `CACHE 1`;
* the cursor sequence is at or above every cursor already in the database;
* a write smoke inside a transaction that is rolled back.

### 4.3 What `npm run test:platform:pg` is — and is not — for

`npm run test:platform:pg` is the **pre-merge** gate: it runs every migration and every
engine-agnostic `/v1` suite on a throwaway Postgres (local `initdb`, or CI's `postgres:17`
service). It needs a superuser, creates and drops scratch databases and a passwordless login
role, and therefore **cannot and must not be pointed at Supabase**. Run it on the exact commit
being deployed and keep the output:

```bash
npm run test:platform:pg   # expect the exact line ci.yml pins: PLATFORM ON POSTGRES: PASS — 51/51 suites
```

Against staging itself, the equivalent evidence is §4.2 plus §4.4.

### 4.4 Deploy and smoke — in this order

0. **Order matters.** `db push` (§2) first, then the deploy, then the cursor lift below. From the
   moment migration `20261002000000` commits, a server build from before it (if one is serving
   this database) can no longer write `sync_cursors`: its pushes fail closed (500, nothing
   written) instead of handing out stale cursors. Keep that window short.
1. Redeploy the staging service. The boot log must show `platform_db_open { engine: 'postgres' }`;
   any `platform_db_unavailable {"code":…}` line means the variables or migrations are wrong —
   fix and redeploy, nothing has been written.
2. `GET /v1/health` → `database.engine = "postgres"`, `schemaVersion = "13"` (the version the current build requires; it was "12" before train 10), `billingSchemaVersion = "6"`;
   `GET /v1/ready` → 200 with `database` reported ready (503 + `Retry-After` means the replica
   cannot serve: read its coded state, not the logs' guesses).
3. **Once no instance of an older build is left** (after any overlapping deploy has drained),
   re-run the cursor lift. It only ever raises the sequence, so it is safe to repeat, and it
   covers a cursor an older build issued between its last read of `sync_cursors` and the
   migration:

   ```sql
   select setval('pri.sync_cursor_seq', greatest(
     (select case when is_called then last_value else last_value - 1 end from pri.sync_cursor_seq),
     (select value from pri.sync_cursors where id = 1),
     coalesce((select max(server_cursor) from pri.learning_events), 0),
     coalesce((select max(server_cursor) from pri.sync_entities), 0),
     1), true);
   ```

   Then re-run §4.2: its "sequence at or above every cursor" line must be ticked.
4. Exercise the staging app end to end with **test accounts only**: register, verify email,
   sign in, sync from two devices (push from one, pull on the other), a teacher class and
   assignment, account export and deletion. Record what was done and the result in the cutover
   log. Synthetic/test evidence only — it is not student evidence.
5. Watch the service logs for `platform_error` with `PLATFORM_DB_BUSY` / `PLATFORM_DB_TIMEOUT`
   and Supabase's *Database → Query performance* for slow statements.

### 4.5 Staging is clean when

All of §4.2 and §4.4 pass, and staging has run for at least 24 hours of normal test traffic
with no `500` from `/v1`, no `platform_db_pool_error`, and no unexplained 503s.

### 4.6 Staging → production promotion order (the 24 h soak gate)

Production deploys the branch `deploy/production`, a pointer that is only ever fast-forwarded to an
exact `main` SHA certified on staging (`docs/release/release-policy.md`, "Staging first, production by
promotion"). Staging deploys every push to `main`, so **the soak clock belongs to one SHA**: it starts
when staging first serves that SHA and is reset by the next merge to `main`, because staging then
serves something else. A 24 h soak therefore needs either a 24 h merge freeze on `main` or a
decision that the SHA staging has served for the last 24 h is the candidate. The order, each step a
gate for the next:

| # | Step | Who | Gate / evidence |
|---|---|---|---|
| 1 | **Nominate** one `main` SHA: `node scripts/release-nominate.mjs <sha> --candidate` | anyone | prints `CANDIDATE: PASS` — the SHA is on `origin/main`, every workflow on it completed green (the newest run per workflow and event decides, so a flaky scheduled run that a later schedule passed is listed as superseded while a workflow whose newest run is red still refuses), the four required contexts and Production Container are green, staging serves exactly it on Postgres at the schema versions that commit's `schemaVersions.js` states, and `deploy/production → sha` is a fast-forward. The tool pushes nothing and prints no promotion yet: the release-stage run in step 7 requires the evidence of steps 3–5 |
| 2 | **Verify staging** at that SHA: `npm run verify:deployment -- --origin https://pri-learning-staging-staging.up.railway.app --sha <sha> --engine postgres --auth-email-proven` from a checkout at the SHA | anyone | `DEPLOYMENT VERIFIED: PASS` |
| 3 | **Staging acceptance S0–S8**: `node tools/acceptance/staging-acceptance.mjs --email <owner mailbox> --tester "<name>"` (`tools/acceptance/README.md`) | a named human at the terminal | `STAGING ACCEPTANCE: PASS`; its report labels each step's evidence class (real mailbox / synthetic picture / test accounts) |
| 4 | **Device matrix** on the TestFlight / Play build of the same SHA (`docs/release/device-matrix.md`) | named testers on real hardware | `node scripts/device-matrix-record.mjs report --sha <sha>`: no `fail`; families without hardware recorded `blocked`, never omitted |
| 5 | **24 h soak** on staging at that SHA (§4.5) | operator watches | no `/v1` 500, no `platform_db_pool_error`, no unexplained 503 for 24 h, recorded in §7 with the start and end times |
| 6 | **Production database at the same schema**: first cutover §5.4 (§2–§4 against the production project, backup §6 first); later releases that change `SCHEMA_VERSION` / `BILLING_SCHEMA_VERSION` use §2.6's back-to-back migrate + redeploy against production | owner (`BLOCKED_EXTERNAL`) | `verify:platform:pg-target` → `POSTGRES TARGET: PASS` against production; owner's explicit "Yes" for the window |
| 7 | **Promote**: first the release-stage nomination `node scripts/release-nominate.mjs <sha>` (without `--candidate`: it also requires a passing `Release Candidate` run of `release-candidate.yml` titled and checked out as exactly this SHA — dispatch it on `main` while `main` is at the SHA, or push a `v*` tag at it, with `measure_cloud_reader` — whose two blocking jobs are `success`; the device matrix of step 4 with every case `pass` (blocked is not acceptance); and a real-human reader evaluation naming this SHA that clears Gate C's floors and is that run's `cloud-reader-eval-<sha>` artifact. A public-release override record may waive an evidence row by name when it links an approving GitHub comment by a repository admin (`docs/release/evidence/go-no-go/README.md`); nothing waives the Release Candidate gates; its verify command takes the engine production serves — add `--production-engine postgres` when step 6 ran in this window) and the dossier `node scripts/release-dossier.mjs <sha>`, which must print `DOSSIER: GO-READY` with the owner's GO recorded for exactly this SHA; then the commands the nomination printed — `git merge-base --is-ancestor <sha> origin/main`, `git merge-base --is-ancestor origin/deploy/production <sha>`, `git push origin <sha>:refs/heads/deploy/production` | the approver the release record names | `NOMINATION: PASS`, `DOSSIER: GO-READY`; branch protection on `deploy/production` refuses a commit without the four green contexts; the push is a fast-forward or it is refused |
| 8 | **Verify production**: `npm run verify:deployment -- --origin https://final-pri-learning-production.up.railway.app --sha <sha> --engine postgres --auth-email-proven`; one smoke registration with an owner-controlled address, then delete that account (`staging-acceptance.mjs --target production --sha <sha>` refuses unless step 1 passes and deletes what it creates) | anyone, then the owner for the smoke mailbox | `DEPLOYMENT VERIFIED: PASS`; §7 row filled |
| 9 | **Rollback stance written before traffic**: before real data, remove `PRI_DATABASE_URL` and redeploy (§5.1); after real data, forward-fix only (§5.2); the application build rolls back only to a build with the same schema versions as the database | operator | the stance in §7 |

Nothing in this order is a launch: legal/privacy sign-off, DPDP consent evidence, store certification
and the handwriting evidence programmes remain separate blockers (`PRI_V1_RELEASE_SCOPE.md` §18).

---

## 5. Rollback and forward-fix

### 5.1 Before any data matters (staging, or production before launch)

Rollback is configuration only: remove `PRI_DATABASE_URL` from the Railway service (restoring
`PRI_PLATFORM_DB` if that environment used SQLite) and redeploy. The server goes back to the
SQLite file it used before; nothing in Postgres is read. The Supabase schema can stay as it is.

### 5.2 Once Postgres holds real data

There is **no automatic migration back** from Postgres to SQLite. Writes made on Postgres after
cutover do not exist in the SQLite file. So after real traffic:

* **Prefer forward-fix.** A code bug: deploy the fixed build. A schema mistake: add a *new*
  migration (never edit an applied one — `supabase db push` tracks applied files by name and
  will not re-run it), prove it with `npm run test:platform:pg`, apply it to staging, verify
  (§4.2), then production.
* **Schema-version mismatch at boot** (`PLATFORM_DB_SCHEMA_MISMATCH`): the database and the
  build disagree. Deploy the build that matches the database, or apply the missing migration —
  do not edit `platform_meta` by hand to make the error go away.
* **Rolling back the application build** is safe only to a build with the same
  `SCHEMA_VERSION` / `BILLING_SCHEMA_VERSION` as the database (today 15 / 6; a build from before
  schema 12 declares no `pri.scope`, so under deny-by-default RLS it reads nothing even where it
  boots). Builds with the
  version check refuse a database at any other version. Builds from **before** that check (the #247-era driver) only
  check that a `schema_version` exists, so they **do boot** against this database — but they
  allocate sync cursors from `pri.sync_cursors`, on which `pri_server` no longer has `UPDATE`:
  every sync push they attempt fails (500, nothing written). Do not roll back to such a build;
  it is not a working rollback target. If one ran anyway, re-run the cursor lift (§4.4 step 3)
  after the newer build is back.
* **Restoring data** means restoring the Supabase backup (§6) or PITR to a point before the
  incident — a destructive, owner-approved operation that discards later writes.

### 5.2a Undoing migration `20261002010000_tutor_cache`

Only for a build that predates the AI tutor, and before undoing anything older (migrations come
off newest first: `20261113000000_resource_library` (schema 15; rollback
`docs/release/rollback/20261113000000_resource_library.rollback.sql`, which deletes the library rows), `20261022000000_parent_report` (schema 14; rollback
`docs/release/rollback/20261022000000_parent_report.rollback.sql`, which deletes the report links and send ledger), `20261019000000_rls_account_coverage` (schema 13; rollback
`docs/release/rollback/20261019000000_rls_account_coverage.rollback.sql`), `20261016000000_rls_fail_closed` (schema 12; its reviewed rollback is
`docs/release/rollback/20261016000000_rls_fail_closed.rollback.sql`, owner-approved only),
`20261007000000_security_hardening` (schema 11), `20261006000000_otp_sign_in` (schema 10),
`20261005000000_account_age_basis` (schema 9), `20261004000000_google_play_billing`
(billing 6) and `20261003010000_storekit_entitlement_state` (billing 5) each need their own
owner-approved rollback written at the time, against the exact build being restored; none is
written here because no build that predates them has ever served a Postgres database). The table holds only cached tutor replies keyed by a request digest — no
account data — so dropping it loses nothing a student owns; the next request is simply paid for
again. Owner approval is still required, as for every production schema change:

```sql
begin;
drop table pri.tutor_cache;
update pri.platform_meta set value = '7' where key = 'schema_version';
commit;
```

### 5.3 Undoing migration `20261002000000_sync_cursor_sequence`

Only if a build that predates it must serve the database again — an owner-approved, deliberate
step, because it reopens the row allocator. In one transaction, as `postgres`, with **no**
current build running (otherwise both allocators would issue cursors):

```sql
begin;
lock table pri.sync_cursors in exclusive mode;
update pri.sync_cursors
   set value = greatest(value,
         (select case when is_called then last_value else last_value - 1 end from pri.sync_cursor_seq))
 where id = 1;
grant update on pri.sync_cursors to pri_server;
update pri.platform_meta set value = '6' where key = 'schema_version';
commit;
```

Leave the sequence in place; the older build ignores it. Going forward again is a new migration
(never an edit of `20261002000000`) that repeats its lock / lift / revoke / `schema_version = 7`
steps, followed by the cursor lift in §4.4 step 3.

### 5.3a Undoing migration `20261003000000_billing_payment_retention`

Only to serve a build that expects `billing_schema_version` 3. `NOT NULL` cannot be restored once
an account has been deleted under it (those payments have `account_id` NULL by design), so the
rollback keeps the nullable column and the `ON DELETE SET NULL` key and only reverts the version a
v3 build checks; the database keeps retaining payments either way. Owner-approved only:

```sql
begin;
update pri.platform_meta set value = '3' where key = 'billing_schema_version';
commit;
```

### 5.4 Production

Repeat §2–§4 against the production Supabase project and the Railway production environment
with a **separate** login role (`pri_app_production`) and password — never the staging ones —
only after: staging is clean (§4.5), the backup in §6 exists and has been restore-tested, and
the owner has approved the window. The migrations are additive; the first production `db push`
runs against an empty `pri` schema.

### 5.5 Step 24 rollback: what undoes each stage of the production cutover

The production cutover (issue #686 step 24; §7a is its log) has five stages. Each one has its own
way back, and each way back closes at a known point. **Two things must not be deleted until the
owner closes the rollback window in §7a:** the production SQLite volume (`/data`; write
`PRI_PLATFORM_DB`'s value in §7a) and the stage-1 SQLite backup file. Production serves `169bcdfe`
on SQLite at schema 12 until stage 4. Every step below is the owner's, or is done with the owner's
explicit go-ahead at the time.

| Stage | What changed | Way back | Data lost by going back | The way back closes when |
|---|---|---|---|---|
| 1. SQLite frozen and backed up (§6.2) | the production service scaled to 0; a backup file written | scale the service back up | none | — |
| 2. Migrations pushed to production Supabase (§2 with §2.5) | the `pri` schema created and empty. The `app` and `app_private` schemas already in that project belong to another lane and are not touched | none is needed: the service still reads SQLite. To remove the schema while it holds no student data, run `drop schema pri cascade;` as `postgres` (owner-approved) | none | the first student write to Postgres |
| 3. SQLite data imported (§6a.2–§6a.4, only if the owner chose "migrate") | `pri` tables hold the imported rows | `import-copy.sql` is one transaction, so a failed import leaves nothing. To drop a finished import, remove the schema as in stage 2, then push the migrations again | none (the SQLite file is still the source) | the first student write to Postgres |
| 4. Production serves the candidate on Postgres: the §4.1 variables against production (`PRI_DATABASE_URL`, `PRI_DATABASE_SSL_ROOT_CERT`, login role `pri_app_production`) **deployed with** the fast-forward of `deploy/production` (`docs/release/FREEZE-RUNBOOK.md` F16) | the candidate build boots on Postgres; `app.prilearning.com` moves to production (`production-config-v1.md` note 7) | before the first student write: §5.1. Remove `PRI_DATABASE_URL`, set `PRI_PLATFORM_DB` back to its recorded value and redeploy; the candidate build then serves the SQLite volume and migrates that file forward in place. A full return to `169bcdfe` restores the stage-1 backup into the volume and moves `deploy/production` back, which is break-glass (`release-policy.md`): a build may serve only a database at its own schema versions, and `169bcdfe` is schema 12 | none before the first student write; after it, every write since | the owner closes the window in §7a |
| 5. Real traffic on Postgres | student writes | forward-fix only (§5.2). A data restore (PITR, or a §6.3 dump) is destructive, owner-approved, and discards every later write | everything after the restore point | — |

The order inside stage 4 matters. Deploy the Postgres variables together with the fast-forward,
or after it. If they are deployed first, `169bcdfe` (schema 12) meets a database at 13 or later
and refuses it. `/v1/ready` is the deploy healthcheck (`railway.json`), so Railway keeps the
previous deployment serving. That is safe, but it costs a deploy and looks like an outage on the
dashboard.

Never point `app.prilearning.com` back at staging once real students use production: staging's
database is not theirs.

---

## 6. Backups before production (Step 24)

ADR-0001 requires a restore drill before real student data, and a backup that has never been
restored is not a backup. For the first production cutover there are **two** things to back up,
and they are backed up at different moments:

- **Production's SQLite file.** It holds whatever production holds today. It is backed up before
  anything changes (§6.2).
- **The new Postgres database.** It is backed up once the migrations (and the import, if the owner
  chose "migrate") are in, and before any student uses it (§6.3). A dump taken before the first
  `db push` would be a dump of an empty `pri` schema, because production has none yet (#386).

### 6.1 Owner click-list: Supabase Pro and PITR on the production project

The project is `pri-learning-production-india` (`mgmlvkesbwmipmvnzufk`), in `ap-south-1`
(Mumbai), on Postgres 17.6. Its `app` and `app_private` schemas belong to another lane and are
never touched here (#386, read-only inspection of 8 Oct 2026). The owner does each step in the
Supabase dashboard; no agent does them. Dashboard labels move between releases; the setting names
are what count. Each step fills a row of §7a.

| # | Where | Do | You should see | §7a row |
|---|---|---|---|---|
| 1 | Organization (of the production project) → Billing | Put the organization on **Pro** (or higher) | plan "Pro"; the project listed under it | P1 |
| 2 | Project → Settings → Compute and Disk | Read the compute size. If step 3 says Point in Time Recovery needs a larger size (Supabase has required at least *Small*), raise it first | the compute size, and no warning on step 3 | P2 |
| 3 | Project → Settings → Add-ons → Point in Time Recovery | Enable it with a **7-day** retention, which is enough for V1. The dashboard shows the monthly price before you confirm | "Point in Time Recovery: enabled, 7 days" | P3 |
| 4 | Project → Database → Backups | Open the point-in-time tab | an earliest and a latest recovery point, minutes apart from now | P4 |
| 5 | Project → Settings → Database → SSL configuration | Turn on **Enforce SSL on incoming connections**; download the CA certificate | enforcement on; the certificate is the PEM for `PRI_DATABASE_SSL_ROOT_CERT` (§1, TLS) | P5 |
| 6 | Project → Connect | Copy the **session** pooler string (port 5432), never the transaction pooler (6543, §1) | a host like `aws-0-ap-south-1.pooler.supabase.com:5432` (the number varies by project) and user `postgres.mgmlvkesbwmipmvnzufk` | P6 (host only, never the password) |
| 7 | Project → Settings → (notifications / integrations) | Turn on the database health, connection and disk alerts (`alerts.md` §4) | the owner's address on the alert list | P7 |

Point in Time Recovery restores **in place**: the project's database goes back to the chosen moment
and every later write is lost. A PITR drill therefore runs only before real students use
production, or into a new project if the dashboard offers "restore to a new project". It never
runs in place on a database students are using.

### 6.2 Before anything changes: production's SQLite file (stage 1 of §5.5)

1. Scale the production service to 0 (Railway → production → `/v1` service → Settings), so no
   write is lost after the backup.
2. Take a **Railway volume backup** of `pri-learning-data` (`/data`) and name it
   `pre-cutover-<candidate SHA>`. Railway → volume → Backups → create. This is how
   `ops-staging-log-2026-10-19.md` took `pre-promotion-169bcdfe7-20261019`. A volume backup is a
   restore point, not a readable file.
3. Only if the owner chose **"migrate"** (§6a): take a file copy. `node server/tools/backup.mjs
   --db /data/pri-learning-platform.db --out /data/backups` runs inside the service container, and
   bringing the file down needs `railway ssh`, which needs the owner's SSH key registered with
   Railway (`ops-staging-log-2026-10-20.md` §4). Record `shasum -a 256 <file>` in §7a at once, and
   keep the file encrypted outside the repository.
4. If the owner chose **"start empty"**: step 2 is the whole backup. Record the decision in §7a.
   Students then register again, and the volume backup is kept under
   `docs/privacy/data-retention.md`.

### 6.3 After the migrations, before any student: the Postgres dump and its restore drill

Take this backup once §2 (with §2.5's placeholder workdir for the remote-only `app` migration
versions) has built the `pri` schema and §6a has imported the data, if the owner chose that.
Run the dumps from the operator's machine, and store the files encrypted outside the
repository:

```bash
npx supabase@latest db dump --linked --schema pri -f pri-preflight-schema.sql
npx supabase@latest db dump --linked --schema pri --data-only -f pri-preflight-data.sql
```

`supabase db dump --dry-run` prints the exact script the CLI runs. With CLI 2.121.0 that is
`pg_dump --schema-only --quote-all-identifier --role postgres --schema=pri` piped through `sed`
filters, then `pg_dump --data-only --column-inserts --rows-per-insert 100000 --schema pri`. If the
CLI cannot run it (it brings its own `pg_dump`), run the printed script with a local `pg_dump` 17.

**The restore drill** goes into a scratch Supabase project. The schema dump contains `GRANT …
TO "pri_server"` but no `CREATE ROLE`: roles belong to the cluster, not to the dump. The 9 Nov
rehearsal in §6.5 confirmed this.

```sql
-- 6.3.1  In the scratch project's SQL editor (or psql as postgres), BEFORE the schema file:
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pri_server') then create role pri_server nologin; end if;
end $$;
```

```bash
# 6.3.2  Schema, then data, each as one transaction that stops at the first error.
read -rs PRI_SCRATCH_URL && export PRI_SCRATCH_URL     # scratch project, postgres role, sslmode=verify-full
psql "$PRI_SCRATCH_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f pri-preflight-schema.sql
psql "$PRI_SCRATCH_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f pri-preflight-data.sql
unset PRI_SCRATCH_URL
```

Then create a login role in the scratch project as in §3, and run §4.2's
`verify:platform:pg-target` against it: `POSTGRES TARGET: PASS` is the result to record in §7a.
Delete the scratch project afterwards; it holds a copy of production.

### 6.4 After the cutover: the recovery point exists

Within an hour of stage 4 of §5.5, read Project → Database → Backups again. The latest recovery
point must be **after** the cutover time. Record it in §7a (row P8). From then on, restoring data
is §5.5 stage 5: destructive and owner-approved.

### 6.5 The restore, rehearsed locally on 9 Nov 2026 (LOCAL-SYNTHETIC evidence)

Both rehearsals ran on throwaway local Postgres 17 clusters made by `scripts/with-postgres.mjs`,
never Supabase, under the machine's heavy-job limiter. A real server on a migrated database, as
`pri_server` under RLS, created two students who answered questions; one held Premium. The data is
synthetic. The physical and PITR restore of the hosted project is **not** exercised by either; that
remains §6.3 and §6.4, the owner's.

| Rehearsal | What it restores, and how | Result |
|---|---|---|
| **L2:** #731's `server/test/postgres-restore-rehearsal-check.mjs`, run from #731's head `e42231a36` | `pg_dump --format=custom` of the live source, then `pg_restore --single-transaction --exit-on-error` into an empty database. It then compares every `pri` table's rows, RLS and its policies, `pri_server`'s grants, the sync cursor sequence and the schema versions, and runs a real server on the restore: sessions, passwords, histories, Premium, isolation, and a new answer after the restored cursors | **PASS, 34/34**, 9 Nov 2026, on a throwaway Postgres (`scripts/with-postgres.mjs`): every `pri` table's rows, RLS and its policies, `pri_server`'s grants, the cursor sequence and the schema versions came back identical, and the real server on the restore kept sessions, passwords, histories, marks and Premium, kept the accounts apart and marked new answers after the restored cursors. A logical restore only: the hosted project's physical/PITR restore is not exercised |
| **L3:** the owner's own format | The exact pipelines `supabase db dump --dry-run` prints for `--schema pri` and `--schema pri --data-only` (CLI 2.121.0), then `psql -v ON_ERROR_STOP=1 --single-transaction`, schema first, into an empty database, then the same comparison and the same served checks. It also checks that the schema dump creates no role (`pri_server` must exist first, §6.3.1) and that the data dump carries the cursor sequence | **PASS, 38/38**, 9 Nov 2026, on a throwaway Postgres 17 (the cluster's `postgres` superuser restored the files). Every `pri` table's rows, RLS on every table, the policies, `pri_server`'s grants, its schema and sequence usage, the cursor sequence and the schema versions came back identical. The real server on the restore kept the signed-in device, both passwords, both histories and Premium; it kept the accounts apart and marked a new answer after every restored cursor. The schema dump created `pri` and its grants and **no role**, and the data dump carried `setval` for the cursor sequence |

Both rehearsals are recorded in §7a, rows L2 and L3.

## 6a. Carrying the SQLite data into Postgres (owner's decision; software complete)

`server/tools/sqlite-to-postgres-export.mjs` turns a Pri SQLite platform database into a
COPY-ready export for the `pri` schema. It reads the file **read-only**, connects to nothing,
and writes only into the output directory. Its regression suite is
`server/test/sqlite-to-postgres-export-check.mjs` (`npm run test:platform:export`), which also
runs the import against a throwaway migrated Postgres under `node scripts/with-postgres.mjs`.

What it exports: every table the migrations create in `pri`, in parent-before-child order
(derived from the migrations' `references` clauses), each as `<table>.csv` — header row,
strings always quoted, `NULL` as the empty unquoted field (Postgres CSV semantics, so `''`
and `NULL` stay distinct). Account emails are lower-cased on the way out because the Postgres
schema has `CHECK (email = lower(email))`; SQLite's `UNIQUE COLLATE NOCASE` means that cannot
collide, and `manifest.json` records how many were changed. Not exported: `platform_meta`
(the migrations seed it; the tool refuses a source whose versions are not this build's) and
`sync_cursors` (`pri_server` cannot write it; the import lifts `pri.sync_cursor_seq` instead).

It refuses, with a code on stderr and nothing written: a file that is not a platform database
(`DB_NOT_PLATFORM`), one at another schema/billing version (`EXPORT_SCHEMA_MISMATCH` — start the
current build once against a *copy* so SQLite migrates in place, then export the copy), a SQLite
column the Postgres schema lacks (`EXPORT_COLUMN_UNKNOWN` — a migration is missing; fix that,
never the data), a non-empty output directory, a missing source.

```bash
# 6a.1  Freeze the source. Stop the Railway service (or scale to 0) so no write is lost,
#       then take the final backup — the export reads that copy, never the live file.
node server/tools/backup.mjs --db /data/pri-learning-platform.db --out /data/backups
#       → {"ok":true,"path":"/data/backups/pri-learning-platform-<ts>.db", ...}

# 6a.2  Export (on the operator's machine, from the checkout at the deployed commit, after
#       copying the backup file down). --inserts also writes a plain-SQL import for an SQL
#       console without \copy.
node server/tools/sqlite-to-postgres-export.mjs \
  --db ./pri-learning-platform-<ts>.db --out ./pri-export-<ts> --inserts
#       → {"ok":true,"rows":N,"tablesPresent":…,"tablesAbsent":[…],"syncCursorLiftTo":"…",
#          "accountEmailsLowercased":n,"files":[…]}
#       Read manifest.json: per-table sourceRows == exportedRows, the SHA-256 of every file,
#       syncCursor.liftTo, auditLogMaxId. Keep it with the cutover log.
shasum -a 256 ./pri-export-<ts>/manifest.json
#       → write this digest into §7a row S4 NOW, before the folder moves anywhere. Comparing
#         the files with a manifest that travelled in the same folder proves nothing (#386, 6 Nov).

# 6a.2b Integrity, on the machine that imports, immediately before 6a.3. Both must pass:
#       the manifest is the one recorded at export time, and every file is the one it lists
#       (no changed byte, no missing file, no extra file, no symlink).
test "$(shasum -a 256 ./pri-export-<ts>/manifest.json | cut -d' ' -f1)" = "<digest from §7a S4>" && echo "manifest: as recorded"
node -e '
const fs = require("fs"), crypto = require("crypto"), path = require("path"), dir = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const listed = new Set(["manifest.json", ...manifest.files.map(f => f.file)]);
let bad = 0;
for (const f of manifest.files) {
  const file = path.join(dir, f.file);
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) { console.error(`MISSING OR LINK ${f.file}`); bad++; continue; }
  const bytes = fs.readFileSync(file);
  if (bytes.length !== f.bytes || crypto.createHash("sha256").update(bytes).digest("hex") !== f.sha256) { console.error(`CHANGED ${f.file}`); bad++; }
}
for (const name of fs.readdirSync(dir)) if (!listed.has(name)) { console.error(`NOT IN MANIFEST ${name}`); bad++; }
console.log(bad ? `EXPORT INTEGRITY: FAIL — ${bad} problem(s)` : `EXPORT INTEGRITY: PASS — ${manifest.files.length} files match manifest.json`);
process.exit(bad ? 1 : 0);' ./pri-export-<ts>
#       → EXPORT INTEGRITY: PASS. Anything else: stop, export again from the backup copy.
#       (Interim control. A verifier in server/tools that takes the recorded digest as an
#        argument is L2's follow-up to #386's finding.)

# 6a.3  Import, as the migration owner (Supabase `postgres`), into the MIGRATED, EMPTY
#       production schema — after §2 db push, before §4 points the service at it.
#       The script is one transaction: its preflight raises IMPORT_SCHEMA_MISMATCH or
#       IMPORT_TARGET_NOT_EMPTY and nothing is written; any later error rolls everything back.
cd ./pri-export-<ts>
read -rs PRI_IMPORT_URL && export PRI_IMPORT_URL      # postgres role, sslmode=verify-full
psql "$PRI_IMPORT_URL" -v ON_ERROR_STOP=1 -f import-copy.sql

# 6a.4  Verify. Query 1 must read `ok` on every row; queries 2–5 must return true.
psql "$PRI_IMPORT_URL" -v ON_ERROR_STOP=1 -f verify.sql
unset PRI_IMPORT_URL
```

The import ends by lifting `pri.sync_cursor_seq` above the SQLite allocator and every stored
cursor, and the `audit_log` identity above every imported id, so the first Postgres push cannot
reuse a cursor a device has already seen. Then run §4.2 (`verify:platform:pg-target`): its
"sequence at or above every cursor" line must be ticked before the service is started on
Postgres. The SQLite backup stays the authoritative pre-cutover copy until the owner retires it.

If the owner chooses to start Postgres empty instead, skip 6a.2–6a.4 and record that decision
in the cutover log; students then re-register and the SQLite backup is retained under
`docs/privacy/data-retention.md`.

---

## 7. Cutover log (fill in; do not commit secrets)

| Step | Environment | Commit | Who | When | Result / evidence |
|---|---|---|---|---|---|
| 2.5 `db push --linked` (placeholder workdir), schema 12 | staging | `#522` merge | operator | 2026-10-18 | `/v1/ready` 200 on schema 12 / billing 6 after the redeploy (`LAUNCH-RUNBOOK.md` 2.2a; outage window recorded there) |
| 4.6 step 1 nominate (candidate) | — | | | | `CANDIDATE: PASS` from `scripts/release-nominate.mjs <sha> --candidate` |
| 4.6 step 7 nominate (release) + dossier | — | | | | `NOMINATION: PASS` from `scripts/release-nominate.mjs <sha>`; `DOSSIER: GO-READY` from `scripts/release-dossier.mjs <sha>`; path of `docs/release/evidence/go-no-go/<sha>.md`; any override named |
| 4.6 step 3 staging acceptance S0–S8 | staging | | | | `STAGING ACCEPTANCE: PASS`; report path; tester |
| 4.6 step 4 device matrix | TestFlight / Play build | | | | `device-matrix-record.mjs report --sha` summary line |
| 4.6 step 5 soak 24 h | staging | | | start → end (UTC) | no 500 / pool error / unexplained 503 |
| 2.4 `db push` | staging | | | | |
| 3 login role created | staging | | | | (role name only) |
| 4.2 target check | staging | | | | `POSTGRES TARGET: PASS — n/n` |
| 4.3 `test:platform:pg` | local/CI | | | | `51/51 suites` |
| 4.4 smoke | staging | | | | |
| 6 backup + restore drill | production | | | | |
| 6a export + import + verify.sql | production (if SQLite held real data) | | | | `manifest.json` row totals; `verify.sql` all `ok`/`true` |
| 2–4 | production | | | | |

## 7a. Production cutover log, Step 24 (template, pre-filled 9 Nov 2026)

One copy per cutover window. The owner fills the empty cells on the day; every pre-filled cell is a
fact read before the window and must be checked again at the start of it. Names and non-secret
values only: a password, connection string with a password, key or token never goes in here.
Rows marked LOCAL-SYNTHETIC are rehearsals on throwaway local databases, not evidence about
production.

**Facts at the start of the window**

| Item | Pre-filled (re-check) | At the window |
|---|---|---|
| Production Supabase project | `pri-learning-production-india` (`mgmlvkesbwmipmvnzufk`), `ap-south-1`, Postgres 17.6. No `pri` schema. The `app` (62 tables) and `app_private` (4) schemas are another lane's and are never touched (#386, 8–9 Oct 2026) | |
| Production Railway | project `profound-spontaneity`, environment `production`, service `Final-Pri-learning`, volume `pri-learning-data` at `/data`. It serves `169bcdfe` on SQLite at schema 12 / billing 6 (read by `release-nominate.mjs` on 9 Nov 2026) | |
| `PRI_PLATFORM_DB` value (needed by §5.5 stage 4) | the path on `/data`, read by the owner at the window | |
| Candidate SHA | `docs/release/FREEZE-RUNBOOK.md` F1 | |
| Migrations at the candidate | `ls supabase/migrations/` at the candidate. On `main` `1d3829103` there are 11 files, ending at schema 13 / billing 6; #743 would add schema 14 | |
| Login role | `pri_app_production`: a member of `pri_server`, not superuser, not BYPASSRLS (§3) | |
| Data decision (owner, ADR-0001) | migrate (§6a) or start empty | |
| Owner's Yes for this window (D27) | — | |

**Steps, in order**

| Id | Step | Command or action | Expected | Result | By | When (UTC) |
|---|---|---|---|---|---|---|
| P1–P3 | §6.1 rows 1–3 | Supabase Pro, compute size, PITR 7 days | Pro; PITR enabled | | | |
| P4–P7 | §6.1 rows 4–7 | recovery window; Enforce SSL and the CA certificate; session pooler host; alerts | recovery points listed; SSL enforced; host on port 5432; alerts on | | | |
| S1 | §6.2.1 | scale production to 0 | no running deployment | | | |
| S2 | §6.2.2 | Railway volume backup `pre-cutover-<SHA>` | backup listed, with its size | | | |
| S3 | §6.2.3 (migrate only) | `backup.mjs` then `railway ssh` copy; `shasum -a 256 <file>` | `{"ok":true,…}`; digest | | | |
| S4 | §6a.2 (migrate only) | export; `shasum -a 256 manifest.json` | per-table `sourceRows == exportedRows`; digest | | | |
| M1 | §2.5.3 | placeholder workdir dry run against production | lists **only** this repository's files | | | |
| M2 | §2.4 / §2.5.4 | `supabase db push` | every file applied, none skipped | | | |
| M3 | §2.3 | `supabase migration list` | local and remote agree up to the candidate's last file | | | |
| R1 | §3.1–§3.2 | `create role pri_app_production …`; `\password` | role created (the password goes into Railway only) | | | |
| R2 | §3.3 | the check query | `rolsuper = false`, `rolbypassrls = false`, `member = true` | | | |
| I1 | §6a.2b (migrate only) | the manifest digest equals S4; the file check | `manifest: as recorded`; `EXPORT INTEGRITY: PASS` | | | |
| I2 | §6a.3 (migrate only) | `psql … -f import-copy.sql` | one transaction, committed | | | |
| I3 | §6a.4 (migrate only) | `psql … -f verify.sql` | every row `ok`; queries 2–5 `true` | | | |
| B1 | §6.3 | the two `supabase db dump` files | both written; record their SHA-256 | | | |
| B2 | §6.3.1–§6.3.2 | scratch project: `pri_server`, then schema, then data | both `psql` runs end without error | | | |
| B3 | §6.3 | `verify:platform:pg-target` against the scratch project | `POSTGRES TARGET: PASS — n/n` | | | |
| B4 | §6.3 | delete the scratch project | gone from the organization | | | |
| T1 | §4.2 | `verify:platform:pg-target` against production | `POSTGRES TARGET: PASS — n/n`, including "sequence at or above every cursor" | | | |
| V1 | §4.1 against production | set `PRI_DATABASE_URL` (session pooler, `sslmode=verify-full`, user `pri_app_production`), `PRI_DATABASE_SSL_ROOT_CERT`; keep `PRI_PLATFORM_DB` | variable names listed; nothing deployed yet (§5.5, order inside stage 4) | | | |
| D1 | FREEZE-RUNBOOK F16 | fast-forward `deploy/production`; deploy with V1 | boot log `platform_db_open { engine: 'postgres' }`; `/v1/ready` 200 | | | |
| D2 | §4.4 step 3 | the cursor lift, once no older instance remains | done | | | |
| D3 | `production-config-v1.md` §2 | `verify:deployment … --engine postgres --auth-email-proven --require-handwriting --expect-config …` | `DEPLOYMENT VERIFIED: PASS` | | | |
| D4 | §4.6 step 8 | one owner-controlled registration, then delete it | verification email arrives from `verify@mail.prilearning.com`; account gone | | | |
| P8 | §6.4 | the latest recovery point | later than D1 | | | |
| W1 | §5.5 | the owner closes the rollback window | date; only after it may the SQLite volume and `PRI_PLATFORM_DB` go | | | |

**Rehearsals (filled 9 Nov 2026; LOCAL-SYNTHETIC, see §6.5)**

| Id | What | Result |
|---|---|---|
| L1 | §6a.2b integrity check on a real export of a seeded SQLite platform database | **5/5 as expected**: the untouched export passes (38 files match `manifest.json`); a manifest digest that is not the recorded one fails; a same-size edit of `accounts.csv` (the #386 finding) fails `CHANGED accounts.csv`; the restored file passes again; an extra file fails `NOT IN MANIFEST`. Local, synthetic data, 9 Nov 2026 |
| L2 | #731's `postgres-restore-rehearsal-check.mjs` (`pg_dump -Fc` → `pg_restore` into an empty database, then served) | **PASS 34/34**, 9 Nov 2026, from #731's head `e42231a36` (LOCAL-SYNTHETIC: a throwaway Postgres and synthetic accounts) |
| L3 | the owner's own format: the exact `supabase db dump` pipelines → `psql` into an empty database, then served | **PASS 38/38**, 9 Nov 2026 (LOCAL-SYNTHETIC; restored by a superuser — on Supabase the `postgres` role is not a superuser but holds BYPASSRLS, which the data file's `SET row_security = off` needs; the scratch-project drill of §6.3 proves that part) |
