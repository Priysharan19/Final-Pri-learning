-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema v9 — security hardening
--
-- Mirrors the SQLite changes in server/platform/db.js (schema 9), column for
-- column, plus two Postgres-only controls that SQLite expresses in code:
--
--   1. Staff second factor (server/platform/mfa.js): pri.account_mfa holds each
--      admin/support account's TOTP secret ENCRYPTED under PRI_MFA_KEY (never in
--      clear), pri.account_mfa_recovery_codes holds SHA-256 hashes of the eight
--      recovery codes, and pri.account_sessions.mfa_verified_at records when a
--      session last presented a code.
--   2. The guardian's long-lived withdrawal link: account_tokens.purpose and
--      auth_delivery_outbox.kind admit 'guardian-withdraw'.
--   3. pri.audit_log is append-only for the server: UPDATE and DELETE are
--      revoked from pri_server. (The ON DELETE SET NULL on actor_account_id
--      still applies on account deletion: referential actions run as the
--      table owner, not as pri_server.) The SQLite path exposes no update or
--      delete of audit_log in code (server/test/security-hardening-check.mjs).
--   4. Defence in depth under the handlers' own account filters: a RESTRICTIVE
--      row-level policy on the three account-scoped sync tables. When a
--      transaction has set the session GUC pri.account_id
--      (store.js transaction({ accountScope })), every row of another account
--      is invisible and unwritable to it; when the GUC is unset (or '' after a
--      transaction ended on a pooled connection) the policy is a no-op and the
--      existing permissive policy decides, so no unscoped path changes behaviour.
--      Sync push and pull set the scope; everything else is unchanged.
--
-- Additive only; schema_version moves to 9 so a server build that expects
-- these objects refuses to boot against a database without them.
-- Same access model as 20261001000000_platform_schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Staff second factor.
create table pri.account_mfa (
  account_id text primary key references pri.accounts(id) on delete cascade,
  secret_ciphertext text not null,
  created_at bigint not null,
  confirmed_at bigint,
  last_used_counter bigint,
  updated_at bigint not null
);

create table pri.account_mfa_recovery_codes (
  account_id text not null references pri.accounts(id) on delete cascade,
  code_hash text not null,
  created_at bigint not null,
  used_at bigint,
  primary key (account_id, code_hash)
);

alter table pri.account_sessions add column mfa_verified_at bigint;

grant select, insert, update, delete on pri.account_mfa, pri.account_mfa_recovery_codes to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.account_mfa, pri.account_mfa_recovery_codes from anon, authenticated';
  end if;
end $$;

alter table pri.account_mfa enable row level security;
create policy pri_server_all on pri.account_mfa as permissive for all to pri_server using (true) with check (true);
alter table pri.account_mfa_recovery_codes enable row level security;
create policy pri_server_all on pri.account_mfa_recovery_codes as permissive for all to pri_server using (true) with check (true);

-- 2. The guardian's withdrawal link.
alter table pri.account_tokens drop constraint account_tokens_purpose_check;
alter table pri.account_tokens add constraint account_tokens_purpose_check
  check (purpose in ('verify-email','reset-password','guardian-consent','guardian-withdraw'));
alter table pri.auth_delivery_outbox drop constraint auth_delivery_outbox_kind_check;
alter table pri.auth_delivery_outbox add constraint auth_delivery_outbox_kind_check
  check (kind in ('verify-email','reset-password','guardian-consent','guardian-withdraw'));

-- 3. audit_log is append-only for the server.
revoke update, delete on pri.audit_log from pri_server;

-- 4. Per-account restrictive policies on the sync tables.
create policy pri_account_scope on pri.learning_events as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));
create policy pri_account_scope on pri.sync_entities as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));
create policy pri_account_scope on pri.idempotency_keys as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));

update pri.platform_meta set value = '9' where key = 'schema_version';

commit;
