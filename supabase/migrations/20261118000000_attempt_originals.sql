-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — the student's original work (schema 18)
--
-- Standard #08 and the owner's rule: the final marking checks the student's
-- own handwriting, not a computer's version of it. A marked handwritten or
-- photographed answer keeps its ORIGINAL here, written in the same
-- transaction as the mark (server/platform/originalWork.js):
--
-- attempt_originals   one row per marked submission that carried its
--                     original: the pen strokes (pri-ink-v1, gzip as the device
--                     sent them) or the photographed / PDF page (its own image
--                     bytes), the SHA-256 of the canonical bytes that the grade
--                     reply and the graded-attempt event name, each reading
--                     line's strokes (lines_json), and the reading layer beside
--                     the original (reading_json: what was read, what the
--                     student confirmed, their edits). Insert-once: nothing is
--                     ever updated. expires_at is the edition's retention.
--
-- Storage is bytea in this database: no object store is provisioned (free
-- tier). Per-account quotas bound it (originalWork.js ORIGINAL_QUOTA).
--
-- Account-owned: pri_scope_required (fail closed without a declared scope)
-- and a RESTRICTIVE pri_account_scope policy of exactly the shape of
-- 20261016000000_rls_fail_closed.sql, plus the permissive pri_server policy.
-- Cascades with the account (account deletion removes every original).
-- schema_version moves to 18 so a server that expects this table refuses to
-- boot without it (fail closed).
-- Rollback: docs/release/rollback/20261118000000_attempt_originals.rollback.sql
-- (drops the table: deletes every kept original; schema_version back to 17).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.attempt_originals (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  edition text not null check (edition in ('priyabhata','prithagoras')),
  question_id text not null,
  submission_id text not null,
  attempt_id text not null,
  kind text not null check (kind in ('strokes','image')),
  origin text not null check (origin in ('ink','photo','pdf-page')),
  format text not null check (format in ('pri-ink-v1','image/png','image/jpeg','image/webp')),
  encoding text not null check (encoding in ('gzip','identity')),
  sha256 text not null check (length(sha256) = 64),
  byte_length bigint not null check (byte_length >= 1 and byte_length <= 1048576),
  canonical_bytes bigint not null check (canonical_bytes >= 1 and canonical_bytes <= 1048576),
  content bytea not null,
  lines_json text not null,
  reading_json text not null,
  created_at bigint not null,
  expires_at bigint not null,
  unique (account_id, question_id, submission_id)
);
create index idx_attempt_originals_attempt on pri.attempt_originals (account_id, attempt_id);
create index idx_attempt_originals_expiry on pri.attempt_originals (expires_at);

grant select, insert, update, delete on pri.attempt_originals to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.attempt_originals from anon, authenticated';
  end if;
end $$;

alter table pri.attempt_originals enable row level security;
create policy pri_server_all on pri.attempt_originals as permissive for all to pri_server using (true) with check (true);
create policy pri_scope_required on pri.attempt_originals as restrictive for all to pri_server
  using (current_setting('pri.scope', true) in ('system', 'account'))
  with check (current_setting('pri.scope', true) in ('system', 'account'));
create policy pri_account_scope on pri.attempt_originals as restrictive for all to pri_server
  using (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> '' and account_id = current_setting('pri.account_id', true)))
  with check (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> '' and account_id = current_setting('pri.account_id', true)));

update pri.platform_meta set value = '18' where key = 'schema_version';

commit;
