# Postgres cutover: Supabase (Mumbai) behind the Railway `/v1` server

Status: **procedure only — nothing here has been run against Supabase or Railway** (as of
2026-10-02; the live service still logs `platform_db_open { engine: 'sqlite' }`, see
`docs/release/PRI_R1_SCOPE_EVIDENCE.md` §2.10). The software side — migrations, driver, target
check, the SQLite data export in §6a and its tests — is complete; every hosted step is
`BLOCKED_EXTERNAL` on the owner and is listed in order in `docs/release/LAUNCH-RUNBOOK.md`.
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
| Reachable, migrated (`platform_meta.schema_version` present) | `store.js createPostgresStore` | `PLATFORM_DB_UNAVAILABLE` / `PLATFORM_DB_NOT_MIGRATED` |
| `schema_version` = **9** and `billing_schema_version` = **6** exactly (`server/platform/schemaVersions.js`) | `store.js assertSchemaVersions` | `PLATFORM_DB_SCHEMA_MISMATCH` |
| `pri.sync_cursor_seq` exists (migration `20261002000000`) | same | `PLATFORM_DB_SCHEMA_MISMATCH` |
| Timeouts, lock wait and pool size parse as whole numbers in range | `config.js postgresSessionLimits` | `PLATFORM_DB_CONFIG_INVALID` |

### Connection: session mode only

The server holds one connection per transaction, takes **session-level advisory locks**
(per-account sync lock, with `pg_try_advisory_lock`; waiters for the same account queue inside
the server process without holding a connection), runs **SERIALIZABLE / REPEATABLE READ** transactions across several
statements and issues **`SET`** for `search_path`, `statement_timeout` and
`idle_in_transaction_session_timeout` once per connection. All of that needs a real session.

* Use the **direct connection** (`db.<ref>.supabase.co:5432`) if Railway can reach it (Supabase
  direct connections are IPv6 unless the IPv4 add-on is enabled), **or** the Supavisor
  **session-mode** pooler (`aws-0-ap-south-1.pooler.supabase.com`, **port 5432**, user
  `<role>.<ref>`).
* **Never** the transaction-mode pooler (port **6543**): advisory locks and `SET` would leak
  between clients and the per-account cursor ordering guarantee would not hold.

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
#      The list must end at the versions schemaVersions.js states (schema 11 / billing 6);
#      `ls supabase/migrations/` at the deployed commit is the authority if this comment lags.
npx supabase@latest migration list
npx supabase@latest db push --dry-run

# 2.4  Apply. The CLI does NOT wrap a file in a transaction; every migration here
#      opens and commits its own (begin; … commit;), so a failure part-way leaves
#      that file unapplied and stops the push there.
npx supabase@latest db push
```

`db push` reads `supabase/migrations/` from the linked checkout. The migrations create schema
`pri`, the `NOLOGIN` role `pri_server`, every table with RLS on and a single
`pri_server`-only policy, revoke everything from `anon`/`authenticated`, and seed
`platform_meta` and `sync_cursors`. They never touch `public`, `auth` or `storage`.

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

* boot checks (TLS policy, `schema_version` 13 / `billing_schema_version` 6, cursor sequence);
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
npm run test:platform:pg   # expect the exact line ci.yml pins: PLATFORM ON POSTGRES: PASS — 35/35 suites
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
2. `GET /v1/health` → `database.engine = "postgres"`, `schemaVersion = "9"`, `billingSchemaVersion = "6"`;
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
  `SCHEMA_VERSION` / `BILLING_SCHEMA_VERSION` as the database (today 11 / 6). Builds with the
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
off newest first: `20261007000000_security_hardening` (schema 11), `20261006000000_otp_sign_in` (schema 10),
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

---

## 6. Backups before production

1. Confirm the production project's plan includes daily backups, and enable **Point-in-Time
   Recovery** before launch (ADR-0001 requires a restore drill before real student data).
2. Immediately before the production `db push`, take a logical backup from the operator's
   machine and store it encrypted outside the repository:

   ```bash
   npx supabase@latest db dump --linked --schema pri -f pri-preflight-schema.sql
   npx supabase@latest db dump --linked --schema pri --data-only -f pri-preflight-data.sql
   ```

3. **Restore drill:** restore that dump (or a PITR point) into a scratch Supabase project, run
   §4.2 against it, and record the result. A backup that has not been restored is not a backup.
4. If SQLite held real data before cutover, keep the final SQLite file
   (`server/tools/backup.mjs`) as the authoritative pre-cutover copy and carry it across with
   §6a. ADR-0001 leaves "migrate or start empty" to the owner; §6a is the tooling for the
   "migrate" answer and is **not run** unless the owner chooses it.

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
| 2.4 `db push` | staging | | | | |
| 3 login role created | staging | | | | (role name only) |
| 4.2 target check | staging | | | | `POSTGRES TARGET: PASS — n/n` |
| 4.3 `test:platform:pg` | local/CI | | | | `35/35 suites` |
| 4.4 smoke | staging | | | | |
| 6 backup + restore drill | production | | | | |
| 6a export + import + verify.sql | production (if SQLite held real data) | | | | `manifest.json` row totals; `verify.sql` all `ok`/`true` |
| 2–4 | production | | | | |
