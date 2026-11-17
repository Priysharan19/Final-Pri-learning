#!/usr/bin/env bash
# End-to-end proof: seed a source DB, back it up with an ephemeral age key,
# restore into a fresh DB, and compare row data. Needs a reachable Postgres.
# Env: PGHOST PGPORT PGUSER PGPASSWORD (standard libpq).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"; psql -d postgres -qc "drop database if exists pri_restore_src" -c "drop database if exists pri_restore_dst" || true' EXIT
age-keygen -o "$tmp/id.txt" 2>"$tmp/pub.txt"
pub="$(sed 's/^Public key: //' "$tmp/pub.txt")"
psql -d postgres -qc "drop database if exists pri_restore_src" -c "drop database if exists pri_restore_dst" -c "create database pri_restore_src" -c "create database pri_restore_dst"
psql -d postgres -qc "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'pri_server') then create role pri_server; end if; end \$\$"
psql -d pri_restore_src -q -v ON_ERROR_STOP=1 <<'SQL'
create table accounts (id serial primary key, email text not null, created timestamptz default now());
create table attempts (id serial primary key, account_id int references accounts(id), body jsonb, ok boolean);
grant select, insert on accounts, attempts to pri_server;
insert into accounts(email) select 'user' || g || '@example.test' from generate_series(1,50) g;
insert into attempts(account_id, body, ok) select (g % 50) + 1, jsonb_build_object('n', g, 'hi', 'हिन्दी'), g % 2 = 0 from generate_series(1,200) g;
SQL
DB_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/pri_restore_src" AGE_RECIPIENT="$pub" "$here/ops-backup.sh" "$tmp/b.dump.age"
grep -q "PGDMP" "$tmp/b.dump.age" && { echo "FAIL: backup is not encrypted"; exit 1; }
"$here/ops-restore.sh" "$tmp/b.dump.age" "$tmp/id.txt" "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/pri_restore_dst"
q='select (select count(*) from accounts)||"/"||(select count(*) from attempts)||"/"||(select md5(string_agg(body::text, ",") ) from (select body from attempts order by id) s)'
q="${q//\"/\'}"
a="$(psql -d pri_restore_src -Atc "$q")"; b="$(psql -d pri_restore_dst -Atc "$q")"
echo "source: $a"; echo "restored: $b"
g="select count(*) from information_schema.role_table_grants where grantee = 'pri_server'"
[ "$(psql -d pri_restore_dst -Atc "$g")" = "$(psql -d pri_restore_src -Atc "$g")" ] && [ "$(psql -d pri_restore_dst -Atc "$g")" != "0" ] || { echo "FAIL: grants not restored"; exit 1; }
[ "$a" = "$b" ] && [ "${a%%/*}" = "50" ] || { echo "FAIL: restored data differs"; exit 1; }
echo "restore test OK"
