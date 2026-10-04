-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema v12 — session re-authentication stamp
--
-- Mirrors the SQLite change in server/platform/db.js (schema 12):
-- pri.account_sessions.reauthenticated_at records when a session last proved
-- its credential afresh — at sign-in, or through POST /v1/account/reauth
-- (password, a code to the account's own address, or a linked Apple/Google
-- identity). GET /v1/account/export (the DPDP right of access) refuses a
-- session whose stamp is older than REAUTH_FRESH_MS (server/platform/security.js)
-- with 401 REAUTH_REQUIRED. NULL — every row written before this migration —
-- reads as "not fresh", so an existing session re-proves before exporting.
--
-- Applies on top of 20261007000000_security_hardening.sql (schema 11).
-- Additive only; schema_version moves to 12 so a server build that expects
-- this column refuses to boot against a database without it.
-- Same access model as 20261001000000_platform_schema.sql: pri_server already
-- holds select/insert/update/delete on pri.account_sessions.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table pri.account_sessions add column reauthenticated_at bigint;

update pri.platform_meta set value = '12' where key = 'schema_version';

commit;
