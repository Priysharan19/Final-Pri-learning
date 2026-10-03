#!/usr/bin/env bash
# Pri Learning · Android instrumented journey with a real process death (CP-06).
#
#   android/scripts/run-instrumented.sh <floor|product|any> [extra am-instrument args]
#
# Installs the debug app + test APKs once (no uninstall between runs, unlike
# connectedAndroidTest), runs ShellJourneyTest#journey, kills the app process
# with `am force-stop`, then runs ShellJourneyTest#relaunchAfterProcessDeath
# against the data the first run left. Regenerate the fixture for every run
# (the run stops its servers). With PRI_CLOUD_ORIGIN/EMAIL/PASSWORD set
# (scripts/cloud-fixture-server.mjs), it then runs the cloud journey
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
    # A "Process crashed." result names no cause: keep the crash buffer and the
    # warnings/errors around it (native crashes, LMK kills, renderer deaths), and
    # print the crash buffer so it is in the CI log even without the artifact.
    adb logcat -d -b crash > "$OUT/logcat-crash.txt" 2>/dev/null || true
    adb logcat -d -b main,system,crash '*:W' | tail -n 400 > "$OUT/logcat-warnings.txt" 2>/dev/null || true
    sed -n '1,80p' "$OUT/logcat-crash.txt" >&2 || true
    exit 1
  fi
}

run journey "$@"
adb shell am force-stop com.prilearning.app
sleep 2
if adb shell pidof com.prilearning.app >/dev/null 2>&1; then echo "the app process survived force-stop" >&2; exit 1; fi
run relaunchAfterProcessDeath "$@"
summary="journey, process death, relaunch"
if [ "$EXPECT" != "floor" ]; then
  run "com.prilearning.app.FileExchangeTest#shareFilePickerCameraAndPrint" "$@"
  run "com.prilearning.app.InkInputTest#fingerAndStylusWriteThroughTheSharedCanvas" "$@"
  run "com.prilearning.app.WebViewAccessibilityTest#theProductPassesTheAccessibilitySmokeInTheShell" "$@"
  run "com.prilearning.app.WebViewAccessibilityTest#theSystemFontScaleReachesThePage" "$@"
  summary="$summary, share/picker/camera/print, finger + stylus ink, accessibility smoke"
fi

if [ -n "${PRI_CLOUD_ORIGIN:-}" ] && [ "$EXPECT" != "floor" ]; then
  CLOUD="com.prilearning.app.CloudJourneyTest"
  cloud_args=(-e priCloud "$PRI_CLOUD_ORIGIN" -e priCloudEmail "$PRI_CLOUD_EMAIL" -e priCloudPassword "$PRI_CLOUD_PASSWORD"
    -e priCloudNewEmail "${PRI_CLOUD_NEW_EMAIL:-}" -e priCloudNewPassword "${PRI_CLOUD_NEW_PASSWORD:-}")
  run "$CLOUD#cloudSignUpThenDeleteAccount" "${cloud_args[@]}" "$@"
  run "$CLOUD#cloudSignInAndSync" "${cloud_args[@]}" "$@"
  summary="$summary, sign-up + delete and sign-in + sync against the real server"
  if [ -n "${PRI_CLOUD_DB:-}" ] && [ -n "${PRI_CLOUD_SERVER_PID:-}" ]; then
    RESTARTED_PID=""
    # Installed before the restart, so a server that half-started is still stopped.
    trap '[ -n "${RESTARTED_PID:-}" ] && kill "$RESTARTED_PID" 2>/dev/null || true' EXIT
    # Offline: the cloud server goes away.
    kill "$PRI_CLOUD_SERVER_PID" 2>/dev/null || true
    sleep 2
    run "$CLOUD#offlineLearningContinuesAndSyncIsNotOffered" "${cloud_args[@]}" -e priCloudOffline true "$@"
    # Reconnect: the same server and database come back.
    node "$HERE/../scripts/cloud-fixture-server.mjs" --port "$PRI_CLOUD_PORT" --db "$PRI_CLOUD_DB" --restart --out "$OUT/restart.env"
    RESTARTED_PID="$(sed -n 's/^PRI_CLOUD_SERVER_PID=//p' "$OUT/restart.env")"
    summary="$summary, offline attempt"
  fi
  adb shell am force-stop com.prilearning.app
  sleep 2
  run "$CLOUD#cloudSessionSurvivesProcessDeathThenDisconnectClearsIt" "${cloud_args[@]}" "$@"
  summary="$summary, reconnect + session after process death, disconnect"
fi
adb logcat -d -s PRITEST > "$OUT/logcat.txt" || true
[ -n "${PRI_CLOUD_SERVER_LOG:-}" ] && cp "$PRI_CLOUD_SERVER_LOG" "$OUT/server.log" 2>/dev/null || true
echo "INSTRUMENTED: PASS — $summary (expect=$EXPECT)"
