#!/usr/bin/env bash
# Restore an encrypted backup into a target database (must already exist, empty).
# Usage: ops-restore.sh <backup.dump.age> <identity-file> <target-db-url>
set -euo pipefail
src="${1:?backup file}"; id="${2:?age identity file}"; target="${3:?target db url}"
age -d -i "$id" "$src" | pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target"
echo "restore complete"
