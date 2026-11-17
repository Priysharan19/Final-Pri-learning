# Restore runbook (logical backups)

Nightly, `.github/workflows/nightly-backup.yml` dumps each production database with `pg_dump --format=custom`, encrypts it with `age` to the public key in `scripts/ops-age-recipient.txt`, and keeps it as a workflow artifact for **14 days** (`pri-backup-in` = Priyabhata / Neon Singapore, `pri-backup-au` = Prithagoras / Neon Sydney). The private key is in the owner's macOS Keychain (service `pri-backup-age`, account `owner`) and is never in the repo. This is a logical backup: it is not point-in-time recovery, so up to 24 hours of writes can be lost. Neon's own history window is the finer-grained tool and comes first for a recent mistake.

The same path is exercised on every change to it, and nightly, by the workflow's `restore-test` job (`scripts/ops-restore-test.sh`: seed, back up, encrypt, decrypt, restore into a second database, compare counts and a content hash).

## One-time owner setup

```bash
gh secret set PRI_BACKUP_DB_URL_IN   # paste the Neon Singapore connection string, then Enter
gh secret set PRI_BACKUP_DB_URL_AU   # paste the Neon Sydney connection string, then Enter
```

Use the DIRECT connection string (not the pooled `-pooler` host: `pg_dump` fails through a transaction pooler) and a read-only role if you can (`pg_dump` needs only SELECT). The grants are dumped with the data. Without a secret, that edition's backup is skipped with a notice.

## Restore

Needs `age` and PostgreSQL client 17 (`brew install age postgresql@17`).

1. Download the artifact for the edition and day from the workflow run (Actions, Nightly logical backup), or:
   ```bash
   gh run download <run-id> -n pri-backup-in -D ./restore
   ```
2. Export the private key from Keychain to a temporary file readable only by you:
   ```bash
   umask 077; security find-generic-password -s pri-backup-age -a owner -w > /tmp/pri-age-key.txt
   ```
3. Create an EMPTY target database and the roles the grants name (`create role pri_server;`, then set its password as in `docs/operations/runbook.md`). Never restore over production directly: restore into a new Neon branch or a new database, check it, then repoint `DATABASE_URL` in Railway (owner action).
4. Restore:
   ```bash
   scripts/ops-restore.sh ./restore/pri-in-<timestamp>.dump.age /tmp/pri-age-key.txt "postgresql://USER:PASS@HOST/DBNAME?sslmode=require"
   ```
   It decrypts in a stream into `pg_restore --exit-on-error`; a failure stops with the offending statement.
5. Verify before use: row counts of `accounts` and the main tables against what you expect, and the server's `/v1/ready` after pointing a staging service at the restored database.
6. Delete the key file: `shred -u /tmp/pri-age-key.txt 2>/dev/null || rm -P /tmp/pri-age-key.txt`.

## Try it locally (no production data)

```bash
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=... scripts/ops-restore-test.sh
```

## Key loss and rotation

Without the private key the artifacts are unreadable by design. To rotate: `age-keygen`, store the new private key in Keychain under a new account name, replace `scripts/ops-age-recipient.txt` with the new public key in a PR. Older artifacts need the older key, so keep it until they expire (14 days).

## Outage alerts

`.github/workflows/prod-outage-watch.yml` checks `/v1/ready` on both domains every 10 minutes and opens an issue labelled `outage` after two failures in a row; it closes the issue on recovery. GitHub scheduled runs are best-effort, so treat it as a backstop.
