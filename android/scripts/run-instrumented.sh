#!/usr/bin/env bash
# Pri Learning · Android instrumented journey with a real process death (CP-06).
#
#   android/scripts/run-instrumented.sh <floor|product|any> [extra am-instrument args]
#
# Installs the debug app + test APKs once (no uninstall between runs, unlike
# connectedAndroidTest), runs ShellJourneyTest#journey, kills the app process
# with `am force-stop`, then runs ShellJourneyTest#relaunchAfterProcessDeath
# against the data the first run left. SYNTHETIC / EMULATOR evidence.
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
  local method="$1" log="$OUT/$1.txt"; shift
  adb shell am instrument -w -r -e class "$CLASS#$method" -e priExpect "$EXPECT" "$@" "$RUNNER" | tee "$log"
  # am instrument exits 0 even when a test fails: decide from its own report.
  if grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$log" || ! grep -q "^OK (" "$log"; then
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
adb logcat -d -s PRITEST > "$OUT/logcat.txt" || true
echo "INSTRUMENTED: PASS — journey, process death, relaunch (expect=$EXPECT)"
