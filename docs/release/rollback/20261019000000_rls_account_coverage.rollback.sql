-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261019000000_rls_account_coverage.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-12
-- server build — a schema-13 server refuses to boot once this has run, and a
-- schema-12 server refuses to boot until it has.
--
-- What it does: removes the RESTRICTIVE pri_account_scope policy the forward
-- migration added to the 15 account-bearing tables that had only
-- pri_scope_required, and moves platform_meta.schema_version back to 12. It
-- touches no row: the forward migration changed only policies and
-- platform_meta.schema_version. pri_scope_required (schema 12) stays, and the
-- 19 tables 20261016000000_rls_fail_closed.sql scoped keep their policies.
--
-- Rolling back re-opens the gap the forward migration closes: a transaction
-- opened in account scope could read and write every account's rows in these
-- 15 tables. No server path opens an account-scope transaction on them today
-- (they are served in system scope with their own authorization), so the
-- exposure is defence in depth. Use it only to restore service.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'classes', 'class_members', 'assignments', 'assignment_submissions',
    'assignment_feedback', 'issue_reports', 'billing_payments', 'billing_events',
    'billing_apple_signed_events', 'otp_challenges', 'audit_log', 'content_revisions',
    'teacher_invites', 'feature_flags'
  ] loop
    execute format('drop policy if exists pri_account_scope on pri.%I', t);
  end loop;
end $$;

update pri.platform_meta set value = '12' where key = 'schema_version';

commit;
