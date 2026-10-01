-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · sync cursors from a sequence on Postgres (ADR-0001 go-live)
--
-- Before: every sync push advanced the single pri.sync_cursors row inside its
-- SERIALIZABLE transaction. Every concurrent push therefore conflicted with
-- every other one on that row; a burst of ~120 pushes exhausted the store's
-- retry budget and answered 500.
--
-- After: the server allocates cursors with nextval('pri.sync_cursor_seq')
-- (server/platform/db.js nextSyncCursor). nextval takes no row lock and causes
-- no serialization conflict. The ordering guarantee pull pagination relies on —
-- per account, cursors are allocated in commit order — is kept by a per-account
-- advisory lock the push holds from before BEGIN until after COMMIT
-- (store.transaction(fn, { lock })), not by this object.
--
-- CACHE 1 is required, not a tuning choice: with a per-session cache two
-- sessions hand out interleaved ranges, so a later commit could receive a lower
-- cursor than an earlier one. The live schema gate checks it.
--
-- pri.sync_cursors stays: SQLite still allocates from it, and the two schemas
-- keep the same tables. On Postgres it is no longer written — and can no
-- longer BE written by the server: pri_server keeps only SELECT on it.
--
-- WHY THE REVOKE. A server build from before this migration allocates from the
-- sync_cursors row and checks only that schema_version exists. Left able to
-- write, such a build running against this database — in the gap between `db
-- push` and the deploy, during an overlapping deploy, or after an application
-- rollback — would hand out cursors from a row that stopped at, say, 42 while
-- the sequence had issued up to 78: a pulling device that has seen 78 never
-- sees the new rows at 43…78 (server_cursor is not unique across the two
-- tables). Without UPDATE its pushes fail closed (42501, nothing written)
-- instead. schema_version moves to 7 so a build that DOES check the version
-- (this one and later) refuses a database without this migration.
--
-- Continuation: the sequence starts above every cursor already handed out —
-- under an EXCLUSIVE lock on sync_cursors, so an old build's push that is
-- mid-flight finishes (and is counted) or waits and then fails on the revoke.
-- ─────────────────────────────────────────────────────────────────────────────

-- Blocks any concurrent UPDATE of the row until this migration commits.
lock table pri.sync_cursors in exclusive mode;

create sequence pri.sync_cursor_seq as bigint
  increment by 1 minvalue 1 no maxvalue start with 1 cache 1 no cycle;

comment on sequence pri.sync_cursor_seq is
  'Sync cursor allocator (nextSyncCursor). CACHE 1 is required for per-account commit-ordered cursors; see the migration header.';
comment on table pri.sync_cursors is
  'SQLite allocator, kept for schema parity. Not written on Postgres since 20261002000000_sync_cursor_sequence (pri.sync_cursor_seq).';

do $$
declare high bigint;
begin
  select greatest(
    coalesce((select value from pri.sync_cursors where id = 1), 0),
    coalesce((select max(server_cursor) from pri.learning_events), 0),
    coalesce((select max(server_cursor) from pri.sync_entities), 0)
  ) into high;
  if high > 0 then
    perform setval('pri.sync_cursor_seq', high, true);
  end if;
end $$;

-- ── The row allocator is closed to the server (see WHY THE REVOKE) ──────────
revoke insert, update, delete, truncate on pri.sync_cursors from pri_server;

-- ── This build's schema version (server/platform/schemaVersions.js) ─────────
update pri.platform_meta set value = '7' where key = 'schema_version';

-- ── Privileges: the server may draw from it; client API roles may not see it ──
revoke all on sequence pri.sync_cursor_seq from public;
grant usage, select on sequence pri.sync_cursor_seq to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on sequence pri.sync_cursor_seq from anon, authenticated';
  end if;
end $$;
