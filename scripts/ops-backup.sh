#!/usr/bin/env bash
# Logical backup: pg_dump (custom format) piped straight into age, so no
# plaintext dump ever touches disk. Usage: ops-backup.sh <out.dump.age>
# Env: DB_URL (secret, never echoed), AGE_RECIPIENT (public key, default scripts/ops-age-recipient.txt)
set -euo pipefail
out="${1:?usage: ops-backup.sh <out.dump.age>}"
: "${DB_URL:?DB_URL not set}"
here="$(cd "$(dirname "$0")/.." && pwd)"
recipient="${AGE_RECIPIENT:-$(tr -d '[:space:]' < "$here/scripts/ops-age-recipient.txt")}"
pg_dump --format=custom --no-owner --dbname="$DB_URL" | age -r "$recipient" -o "$out"
test -s "$out"
echo "backup written: $(basename "$out") ($(wc -c < "$out") bytes, encrypted)"
