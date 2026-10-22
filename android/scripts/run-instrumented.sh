#!/usr/bin/env bash
# Pri Learning · Android instrumented journey with a real process death (CP-06).
#
#   android/scripts/run-instrumented.sh <floor|product|any> [extra am-instrument args]
#
# Installs the debug app + test APKs once (no uninstall between runs, unlike
# connectedAndroidTest), runs ShellJourneyTest#journey, kills the app process
# with `am force-stop`, then runs ShellJourneyTest#relaunchAfterProcessDeath
# against the data the first run left (no server: only the sign-in card or the
# gate may show — the app is account-first, issue #477). With
# PRI_CLOUD_ORIGIN/EMAIL/DB set (scripts/cloud-fixture-server.mjs), it then runs
# the cloud journey against that real server: a new account on the card (the
# server's emailed code, read by scripts/journey-oracle.mjs from its test
# outbox) deleted with a code; the fixture account on the card, Sync now and a
# server-marked answer (the right answer from the oracle, outside the page);
# then, signed in, the shell checks (routing, Back, rotation), share/picker/
# camera/print, finger + stylus ink and the accessibility smoke; the server
# stopped: the gate says retry and nothing is lost; restart, force-stop, the
# session survives and Disconnect clears it. Without a server only the
# no-account journey runs. SYNTHETIC / EMULATOR evidence.
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
# adb answers before Android has finished booting (#278/#327: "adb daemon
# unreachable", the emulator lost mid-journey). The package manager and the
# system UI the journey needs come up with sys.boot_completed; wait for it,
# bounded, and name a boot that never completes as infrastructure.
booted() { [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; }
for _ in $(seq 1 150); do booted && break; sleep 2; done
if ! booted; then
  echo "INFRASTRUCTURE: the emulator did not finish booting (sys.boot_completed != 1 after 300 s); not a product failure" >&2
  exit 1
fi
adb uninstall com.prilearning.app >/dev/null 2>&1 || true
adb uninstall com.prilearning.app.test >/dev/null 2>&1 || true
adb install -r -t "$APP" >/dev/null
adb install -r -t "$TEST" >/dev/null
adb logcat -c || true

run() {
  local target="$1" method="${1##*#}" log; shift
  [[ "$target" == *.* ]] || target="$CLASS#$target"
  log="$OUT/$method.txt"
  adb shell am instrument -w -r -e class "$target" -e priExpect "$EXPECT" ${PRI_STORE_SHOTS:+-e priShots 1} "$@" "$RUNNER" | tee "$log"
  # am instrument exits 0 even when a test fails: decide from its own report.
  # A skipped test (assumption failure, status -4) only counts on the floor image.
  if grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$log" || ! grep -q "^OK (" "$log" ||
     { [ "$EXPECT" != "floor" ] && grep -q "INSTRUMENTATION_STATUS_CODE: -4" "$log"; }; then
    echo "INSTRUMENTED: FAIL in $method" >&2
    adb logcat -d -s PRITEST PriBridge AndroidRuntime chromium > "$OUT/logcat.txt" || true
    [ -n "${PRI_CLOUD_SERVER_LOG:-}" ] && cp "$PRI_CLOUD_SERVER_LOG" "$OUT/server.log" 2>/dev/null || true
    exit 1
  fi
}

run journey "$@"
adb shell am force-stop com.prilearning.app
sleep 2
if adb shell pidof com.prilearning.app >/dev/null 2>&1; then echo "the app process survived force-stop" >&2; exit 1; fi
run relaunchAfterProcessDeath "$@"
summary="journey, process death, relaunch"
# Account-first (#477): nothing behind the shell opens without an account, so
# the share/ink/accessibility tests run below, against the fixture server,
# after CloudJourneyTest has signed the student in on the card.

if [ -n "${PRI_CLOUD_ORIGIN:-}" ] && [ "$EXPECT" != "floor" ]; then
  CLOUD="com.prilearning.app.CloudJourneyTest"
  cloud_args=(-e priCloud "$PRI_CLOUD_ORIGIN" -e priCloudEmail "$PRI_CLOUD_EMAIL" -e priCloudPassword "$PRI_CLOUD_PASSWORD"
    -e priCloudNewEmail "${PRI_CLOUD_NEW_EMAIL:-}" -e priCloudNewPassword "${PRI_CLOUD_NEW_PASSWORD:-}")
  # The right answer of a server-issued question exists only on the server.
  # scripts/journey-oracle.mjs reads the sealed copy from the throwaway fixture
  # database (read-only) and answers the TEST PROCESS on this machine's
  # loopback, which the emulator reaches at the same host as the server.
  ORACLE_PID=""; RESTARTED_PID=""
  # Installed before anything is started, so a half-started process is still stopped.
  trap '[ -n "${ORACLE_PID:-}" ] && kill "$ORACLE_PID" 2>/dev/null || true; [ -n "${RESTARTED_PID:-}" ] && kill "$RESTARTED_PID" 2>/dev/null || true' EXIT
  [ -n "${PRI_CLOUD_DB:-}" ] || { echo "the cloud journey needs PRI_CLOUD_DB (scripts/cloud-fixture-server.mjs --out)" >&2; exit 2; }
  ORACLE_PORT="${PRI_ORACLE_PORT:-4311}"
  ORACLE_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(18).toString('base64url'))")"
  ORACLE_READY="$(mktemp)"; rm -f "$ORACLE_READY"
  # -987654 is the wrong answer CloudJourneyTest types: never a usable sealed answer.
  node "$HERE/../scripts/journey-oracle.mjs" --serve --db "$PRI_CLOUD_DB" --email "$PRI_CLOUD_EMAIL" --port "$ORACLE_PORT" \
    --token "$ORACLE_TOKEN" --avoid -987654 --out "$ORACLE_READY" > "$OUT/oracle.log" 2>&1 &
  ORACLE_PID=$!
  for _ in $(seq 1 40); do [ -f "$ORACLE_READY" ] && break; kill -0 "$ORACLE_PID" 2>/dev/null || break; sleep 0.25; done
  [ -f "$ORACLE_READY" ] || { echo "the sealed-answer oracle did not start:" >&2; cat "$OUT/oracle.log" >&2; exit 1; }
  rm -f "$ORACLE_READY"
  ORACLE_HOST="$(printf '%s' "$PRI_CLOUD_ORIGIN" | sed -E 's#^https?://([^:/]+).*#\1#')"
  cloud_args+=(-e priOracle "http://$ORACLE_HOST:$ORACLE_PORT" -e priOracleToken "$ORACLE_TOKEN")
  run "$CLOUD#cloudSignUpThenDeleteAccount" "${cloud_args[@]}" "$@"
  run "$CLOUD#cloudSignInAndSync" "${cloud_args[@]}" "$@"
  # Signed in on the card (the server's emailed code): the shell's own checks.
  run "$CLASS#shellRoutingBackAndRotationSignedIn" "${cloud_args[@]}" "$@"
  run "com.prilearning.app.FileExchangeTest#shareFilePickerCameraAndPrint" "${cloud_args[@]}" "$@"
  run "com.prilearning.app.InkInputTest#fingerAndStylusWriteThroughTheSharedCanvas" "${cloud_args[@]}" "$@"
  run "com.prilearning.app.WebViewAccessibilityTest#theProductPassesTheAccessibilitySmokeInTheShell" "${cloud_args[@]}" "$@"
  run "com.prilearning.app.WebViewAccessibilityTest#theSystemFontScaleReachesThePage" "${cloud_args[@]}" "$@"
  run "com.prilearning.app.WebViewAccessibilityTest#noScreenClipsHorizontally" "${cloud_args[@]}" "$@"
  summary="$summary, signed-in routing/Back/rotation, share/picker/camera/print, finger + stylus ink, accessibility smoke"
  summary="$summary, card sign-up + code delete, card sign-in + sync and a server-marked answer (sealed-answer oracle) against the real server"
  if [ -n "${PRI_CLOUD_DB:-}" ] && [ -n "${PRI_CLOUD_SERVER_PID:-}" ]; then
    # Offline: the cloud server goes away.
    kill "$PRI_CLOUD_SERVER_PID" 2>/dev/null || true
    sleep 2
    run "$CLOUD#offlineWorkIsKeptUnmarkedAndSyncIsNotOffered" "${cloud_args[@]}" -e priCloudOffline true "$@"
    # Reconnect: the same server and database come back.
    node "$HERE/../scripts/cloud-fixture-server.mjs" --port "$PRI_CLOUD_PORT" --db "$PRI_CLOUD_DB" --restart $( [ "${PRI_CLOUD_READER:-}" = synthetic ] && echo --synthetic-reader ) --out "$OUT/restart.env"
    RESTARTED_PID="$(sed -n 's/^PRI_CLOUD_SERVER_PID=//p' "$OUT/restart.env")"
    summary="$summary, opened offline: the gate says retry and the server's record is unchanged"
  fi
  adb shell am force-stop com.prilearning.app
  sleep 2
  run "$CLOUD#cloudSessionSurvivesProcessDeathThenDisconnectClearsIt" "${cloud_args[@]}" "$@"
  summary="$summary, reconnect + session and History after process death, disconnect"
fi
adb logcat -d -s PRITEST > "$OUT/logcat.txt" || true
[ -n "${PRI_CLOUD_SERVER_LOG:-}" ] && cp "$PRI_CLOUD_SERVER_LOG" "$OUT/server.log" 2>/dev/null || true
echo "INSTRUMENTED: PASS — $summary (expect=$EXPECT)"
