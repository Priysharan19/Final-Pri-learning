#!/usr/bin/env bash
# Step 20: actual Gradle regression, not a static source-text assertion.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DIST="client/dist/release.json"
if [[ ! -f "$DIST" ]]; then
  echo "FAIL: build the canonical client first (npm run build)" >&2
  exit 1
fi
BACKUP="$(mktemp)"
LOG="$(mktemp)"
cleanup() { cp "$BACKUP" "$DIST"; rm -f "$BACKUP" "$LOG"; }
trap cleanup EXIT
cp "$DIST" "$BACKUP"
# Positive control: the checkout's exact SHA must pass.
(cd android && ./gradlew :app:verifyPriWeb --offline --no-daemon -q)
# Negative control: a well-formed but incorrect SHA MUST be rejected.
node -e 'const fs=require("node:fs"); const p="client/dist/release.json"; const data=JSON.parse(fs.readFileSync(p,"utf8")); data.releaseSha="0000000000000000000000000000000000000000"; fs.writeFileSync(p,JSON.stringify(data));'
if (cd android && ./gradlew :app:verifyPriWeb --offline --no-daemon -q) >"$LOG" 2>&1; then
  echo "FAIL: Android accepted a stale web release SHA" >&2
  exit 1
fi
if ! grep -q 'Stale Android web bundle:' "$LOG"; then
  echo "FAIL: negative control failed for an unrelated reason" >&2
  tail -20 "$LOG" >&2
  exit 1
fi
echo "ANDROID WEB PROVENANCE: PASS — current source accepted, forged 40-hex release SHA rejected"
