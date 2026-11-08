#!/bin/sh
# The native journey against the deployed staging service, iPhone then iPad,
# one simulator at a time through the fleet's heavy-job limiter. Evidence class
# SIMULATOR + DEPLOYED; files land in $PRI_STAGING_EVIDENCE_DIR (default
# /tmp/pri-staging-journey/<date>), outside the repository.
#
#   scripts/journey-staging-nightly.sh [<prebuilt DEBUG simulator .app>]
#
# Without an app it builds one (DEBUG, generic iOS Simulator) into a temporary
# directory outside the repository (an untracked file in the checkout would
# make the web build refuse) and removes it afterwards. Exit 0 both families
# passed · 2 NOT MEASURED (no inbox) · 1 otherwise.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOT="$HOME/Developer/.pri-fleet/heavy-slot.sh"
run_heavy() { if [ -x "$SLOT" ]; then "$SLOT" l4 "$@"; else "$@"; fi; }
OUT="${PRI_STAGING_EVIDENCE_DIR:-/tmp/pri-staging-journey/$(date +%Y-%m-%d)}"
mkdir -p "$OUT"
APP="${1:-}"
BUILT=""
if [ -z "$APP" ]; then
  BUILT="$(mktemp -d "${TMPDIR:-/tmp}/pri-staging-dd.XXXXXX")"
  run_heavy sh -c "cd '$ROOT' && npm run build && npm run sync:ios && cd ios/PriLearning.swiftpm && xcodebuild -scheme PriLearning -destination 'generic/platform=iOS Simulator' -derivedDataPath '$BUILT' build -quiet" || exit 1
  APP="$(find "$BUILT/Build/Products" -maxdepth 2 -name '*.app' -path '*iphonesimulator*' | head -1)"
fi
status=0
for family in iphone ipad; do
  run_heavy node "$ROOT/scripts/iphone-journey.mjs" --staging --family "$family" --app "$APP" --evidence "$OUT/journey-staging-$family.json"
  code=$?
  if [ $code -eq 2 ] && [ $status -eq 0 ]; then status=2; elif [ $code -ne 0 ]; then status=1; fi
done
[ -n "$BUILT" ] && rm -rf "$BUILT"
echo "staging journey evidence: $OUT"
exit $status
