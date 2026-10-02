-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · one-time-code sign-in and a parent's approval by code
--
-- Mirrors the SQLite tables otpCore.js creates (server/platform/otpCore.js),
-- column for column:
--   otp_challenges   one row per code sent. Neither the code nor the address is
--                    stored: both are HMACs under a key derived from
--                    PRI_AUTH_DELIVERY_KEY. 10-minute expiry, 5-attempt ceiling,
--                    single use.
--   account_phones   the verified mobile number of an account that signed up by
--                    phone (E.164), unique across accounts.
--   guardian_consents.guardian_phone   a parent who approves by SMS code.
--
-- One transaction. Additive only: two new tables and one nullable column; no
-- existing row or constraint changes. schema_version moves to 9 so a server
-- build that expects these tables refuses to boot against a database that does
-- not have them. Same access model as 20261001000000_platform_schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.otp_challenges (
  id text primary key,
  channel text not null check (channel in ('email','sms')),
  purpose text not null check (purpose in ('sign-in','reauth','guardian-consent','guardian-withdraw')),
  destination_hash text not null,
  account_id text references pri.accounts(id) on delete cascade,
  code_hash text not null,
  provider text not null,
  attempts integer not null default 0,
  created_at bigint not null,
  expires_at bigint not null,
  consumed_at bigint
);
create index idx_otp_challenges_destination on pri.otp_challenges (destination_hash, purpose, consumed_at);
create index idx_otp_challenges_expires on pri.otp_challenges (expires_at);

create table pri.account_phones (
  account_id text primary key references pri.accounts(id) on delete cascade,
  phone_e164 text not null unique,
  verified_at bigint not null
);

alter table pri.guardian_consents add column guardian_phone text;

grant select, insert, update, delete on pri.otp_challenges to pri_server;
grant select, insert, update, delete on pri.account_phones to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.otp_challenges from anon, authenticated';
    execute 'revoke all on pri.account_phones from anon, authenticated';
  end if;
end $$;

alter table pri.otp_challenges enable row level security;
create policy pri_server_all on pri.otp_challenges as permissive for all to pri_server using (true) with check (true);
alter table pri.account_phones enable row level security;
create policy pri_server_all on pri.account_phones as permissive for all to pri_server using (true) with check (true);

update pri.platform_meta set value = '9' where key = 'schema_version';

commit;
