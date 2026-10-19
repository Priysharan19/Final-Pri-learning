-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — account RLS covers every account-bearing table
--
-- 20261016000000_rls_fail_closed.sql made every pri table require a declared
-- pri.scope and gave the 19 tables with a NOT NULL account_id a RESTRICTIVE
-- pri_account_scope policy. The other tables that name an account — accounts
-- itself, the class/teacher tables, issue reports, the billing ledgers whose
-- account_id is nullable, OTP challenges, the audit trail, content authorship,
-- teacher invites, feature-flag provenance — had only pri_scope_required, so a transaction opened with
-- { accountScope } could read and write every account's rows there.
--
-- This migration gives each of them a RESTRICTIVE pri_account_scope policy of
-- the same shape as the existing one:
--
--   system scope                       every row (unchanged: teacher, guardian,
--                                      admin, worker, webhook, deletion and
--                                      export flows all run in system scope and
--                                      keep their own WHERE clauses and server
--                                      authorization)
--   account scope, non-empty account   only the rows this account owns through
--                                      the column(s) named below
--   anything else                      nothing (already true via
--                                      pri_scope_required; repeated here so the
--                                      policy is fail-closed on its own)
--
-- Ownership is a direct column comparison — never a sub-select on another
-- policied table — so no policy can recurse (42P17). Cross-account relations
-- (a student reading their class, a teacher reading a member's submission) are
-- therefore NOT granted in account scope: they are served in system scope by
-- the class/assignment handlers, which check ownership or active membership
-- (docs/security/threat-model.md T3). No server path opens an accountScope
-- transaction on these tables today; this is deny-by-default defence in depth.
-- A row with a NULL owner column (a pseudonymised payment, a system audit
-- entry) is visible to system scope only.
--
-- content_revisions and feature_flags are global, but they name an account
-- (author/reviewer, updated_by), so they fail closed in account scope too: only
-- admin/content handlers read them, in system scope. Tables with no account
-- column (login_attempts, oidc_nonces, platform_meta, rate_limits,
-- sync_cursors, tutor_cache) keep only pri_scope_required; rate_limits is read
-- and written inside account scope by practice issuing.
--
-- Additive and Postgres-only: RLS has no SQLite counterpart and the store's
-- statements are unchanged, so there is no SQLite structural change and no
-- schema_version move (a schema-12 build runs unchanged against it).
-- Same access model as 20261001000000_platform_schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  t record;
  scoped text;
begin
  for t in select * from (values
    ('accounts',                    'id = current_setting(''pri.account_id'', true)'),
    ('classes',                     'teacher_account_id = current_setting(''pri.account_id'', true)'),
    ('class_members',               'student_account_id = current_setting(''pri.account_id'', true)'),
    ('assignments',                 'teacher_account_id = current_setting(''pri.account_id'', true)'),
    ('assignment_submissions',      'student_account_id = current_setting(''pri.account_id'', true)'),
    ('assignment_feedback',         'student_account_id = current_setting(''pri.account_id'', true) or teacher_account_id = current_setting(''pri.account_id'', true)'),
    ('issue_reports',               'account_id = current_setting(''pri.account_id'', true)'),
    ('billing_payments',            'account_id = current_setting(''pri.account_id'', true)'),
    ('billing_events',              'account_id = current_setting(''pri.account_id'', true)'),
    ('billing_apple_signed_events', 'account_id = current_setting(''pri.account_id'', true)'),
    ('otp_challenges',              'account_id = current_setting(''pri.account_id'', true)'),
    ('audit_log',                   'actor_account_id = current_setting(''pri.account_id'', true)'),
    ('content_revisions',           'author_account_id = current_setting(''pri.account_id'', true) or reviewer_account_id = current_setting(''pri.account_id'', true)'),
    ('teacher_invites',             'created_by = current_setting(''pri.account_id'', true) or used_by = current_setting(''pri.account_id'', true)'),
    ('feature_flags',               'updated_by = current_setting(''pri.account_id'', true)')
  ) as v(tablename, owner) loop
    scoped := 'current_setting(''pri.scope'', true) = ''system'' or (current_setting(''pri.scope'', true) = ''account'' '
      || 'and coalesce(current_setting(''pri.account_id'', true), '''') <> '''' and (' || t.owner || '))';
    execute format(
      'create policy pri_account_scope on pri.%I as restrictive for all to pri_server using (%s) with check (%s)',
      t.tablename, scoped, scoped);
  end loop;
end $$;

commit;
