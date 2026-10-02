-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · a payment outlives the account that made it (billing schema 4)
--
-- Before: pri.billing_payments.account_id was NOT NULL and ON DELETE CASCADE,
-- so deleting an account deleted the record of money actually taken. A refund
-- webhook arriving afterwards found no payment, and the business lost the
-- ledger it has to keep for tax and accounting.
--
-- After: the row is kept and only the link goes (ON DELETE SET NULL). What
-- remains is the provider's own payment and subscription ids, the amount,
-- currency, status and timestamps — no name, email or Pri account id. See
-- docs/privacy/data-retention.md for the retention period and its basis.
--
-- Non-destructive: no row is changed by this migration; it relaxes a NOT NULL
-- and replaces one foreign key with a weaker one. The server checks
-- billing_schema_version at boot, so a build expecting 3 refuses this database
-- rather than running against a ledger it does not understand, and this build
-- refuses a database without the migration.
-- ─────────────────────────────────────────────────────────────────────────────
begin;

alter table pri.billing_payments alter column account_id drop not null;
alter table pri.billing_payments drop constraint billing_payments_account_id_fkey;
alter table pri.billing_payments
  add constraint billing_payments_account_id_fkey
  foreign key (account_id) references pri.accounts(id) on delete set null;

comment on column pri.billing_payments.account_id is
  'NULL once the account is deleted: the payment is retained pseudonymously (billing schema 4).';

update pri.platform_meta set value = '4' where key = 'billing_schema_version';

commit;
