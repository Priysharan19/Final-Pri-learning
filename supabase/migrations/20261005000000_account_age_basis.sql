-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · the age decision an account was created under (schema 9)
--
-- Before this the only record of a learner's age was a guardian_consents row
-- for a child, so an account created with no declaration at all (provider
-- sign-in did exactly that) read as "no row, not required" and passed the DPDP
-- guardian gate. Every account-creating path now writes 'adult' or 'child';
-- NULL means nothing was decided and the gate refuses it.
--
-- Existing rows are backfilled once, in this transaction: a consent row means
-- 'child', anything else 'legacy', which passes exactly as before. Nobody is
-- locked out by applying it. Additive only.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table pri.accounts add column age_basis text check (age_basis in ('adult','child','legacy'));

update pri.accounts a set age_basis = case
  when exists (select 1 from pri.guardian_consents g where g.account_id = a.id) then 'child'
  else 'legacy' end
where age_basis is null;

update pri.platform_meta set value = '9' where key = 'schema_version';

commit;
