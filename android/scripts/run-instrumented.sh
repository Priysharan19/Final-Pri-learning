#!/usr/bin/env bash
# Pri Learning · Android instrumented journey with a real process death (CP-06).
#
#   android/scripts/run-instrumented.sh <floor|product|any> [extra am-instrument args]
#
# Installs the debug app + test APKs once (no uninstall between runs, unlike
# connectedAndroidTest), runs ShellJourneyTest#journey, kills the app process
# with `am force-stop`, then runs ShellJourneyTest#relaunchAfterProcessDeath
# against the data the first run left. With PRI_CLOUD_ORIGIN/EMAIL/PASSWORD set
# (android/scripts/cloud-fixture-server.mjs), it then runs the cloud journey
# against that real server the same way: sign in + sync, force-stop, then the
# session survives and Disconnect clears it. SYNTHETIC / EMULATOR evidence.
set -euo pipefail
EXPECT="${1:-any}"; shift || true
HERE="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HERE/app/build/outputs/apk/debug/app-debug.apk"
TEST="$HERE/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
OUT="$HERE/app/build/outputs/pri-instrumented"
RUNNER="com.prilearning.app.test/androidx.test.runner.AndroidJUnitRunner"
CLASS="com.prilearning.app.ShellJourneyTest"
mkdir -p "$OUT"
[ -f "$APP" ] && [ -f "$TEST" ] || { echo "build first: ./gradlew assembleDebug assembleDebugAndroidTest" >&2; exit 2; }

adb wait-for-device
adb uninstall com.prilearning.app >/dev/null 2>&1 || true
adb uninstall com.prilearning.app.test >/dev/null 2>&1 || true
adb install -r -t "$APP" >/dev/null
adb install -r -t "$TEST" >/dev/null
adb logcat -c || true

run() {
  local target="$1" method="${1##*#}" log; shift
  [[ "$target" == *.* ]] || target="$CLASS#$target"
  log="$OUT/$method.txt"
  adb shell am instrument -w -r -e class "$target" -e priExpect "$EXPECT" "$@" "$RUNNER" | tee "$log"
  # am instrument exits 0 even when a test fails: decide from its own report.
  # A skipped test (assumption failure, status -4) only counts on the floor image.
  if grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$log" || ! grep -q "^OK (" "$log" ||
     { [ "$EXPECT" != "floor" ] && grep -q "INSTRUMENTATION_STATUS_CODE: -4" "$log"; }; then
    echo "INSTRUMENTED: FAIL in $method" >&2
    adb logcat -d -s PRITEST PriBridge AndroidRuntime chromium > "$OUT/logcat.txt" || true
    exit 1
  fi
}

run journey "$@"
adb shell am force-stop com.prilearning.app
sleep 2
if adb shell pidof com.prilearning.app >/dev/null 2>&1; then echo "the app process survived force-stop" >&2; exit 1; fi
run relaunchAfterProcessDeath "$@"
summary="journey, process death, relaunch"

if [ -n "${PRI_CLOUD_ORIGIN:-}" ] && [ "$EXPECT" != "floor" ]; then
  CLOUD="com.prilearning.app.CloudJourneyTest"
  cloud_args=(-e priCloud "$PRI_CLOUD_ORIGIN" -e priCloudEmail "$PRI_CLOUD_EMAIL" -e priCloudPassword "$PRI_CLOUD_PASSWORD")
  run "$CLOUD#cloudSignInAndSync" "${cloud_args[@]}" "$@"
  adb shell am force-stop com.prilearning.app
  sleep 2
  run "$CLOUD#cloudSessionSurvivesProcessDeathThenDisconnectClearsIt" "${cloud_args[@]}" "$@"
  summary="$summary, cloud sign-in + sync against the real server, session after process death, disconnect"
fi
adb logcat -d -s PRITEST > "$OUT/logcat.txt" || true
echo "INSTRUMENTED: PASS — $summary (expect=$EXPECT)"
