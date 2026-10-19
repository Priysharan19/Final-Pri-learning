#!/usr/bin/env bash
# Pri Learning · build the signed Google Play release bundle (AAB).
#
# 1. refuses a dirty tree (the web build's release identity names the commit);
# 2. builds the shared web product (client/dist) at the repository root;
# 3. runs the release unit tests and release lint, then bundleRelease signed
#    with the upload key from ~/.pri-secrets (see create-upload-key.sh);
# 4. verifies the bundle is signed by that upload key and prints its SHA-256.
#
# Usage: android/scripts/build-release-aab.sh <versionCode> [cloudOrigin]
#   versionCode  positive integer, strictly greater than any already uploaded
#   cloudOrigin  https origin of the production cloud (empty = cloud off)
set -euo pipefail
code="${1:?usage: build-release-aab.sh <versionCode> [https://cloud.origin]}"
origin="${2:-}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
props="${PRI_UPLOAD_SIGNING:-$HOME/.pri-secrets/android/upload-signing.properties}"
[[ -f "$props" ]] || { echo "no upload key at $props — run android/scripts/create-upload-key.sh" >&2; exit 1; }
if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
  echo "refusing: the working tree is dirty; commit first so the release identity is exact" >&2
  exit 1
fi
if [[ -z "${JAVA_HOME:-}" && -d "$HOME/.sdkman/candidates/java/17.0.20-tem" ]]; then export JAVA_HOME="$HOME/.sdkman/candidates/java/17.0.20-tem"; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
(cd "$root" && npm run build)
(cd "$root/android" && ./gradlew --no-daemon -Ppri.versionCode="$code" -Ppri.cloudOrigin="$origin" -Ppri.uploadSigning="$props" \
  testReleaseUnitTest lintRelease bundleRelease)
aab="$root/android/app/build/outputs/bundle/release/app-release.aab"
[[ -f "$aab" ]] || { echo "no bundle at $aab" >&2; exit 1; }
store="$(sed -n 's/^storeFile=//p' "$props")"
pass="$(sed -n 's/^storePassword=//p' "$props")"
alias="$(sed -n 's/^keyAlias=//p' "$props")"
want="$(keytool -list -v -keystore "$store" -storepass "$pass" -alias "$alias" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p')"
got="$(keytool -printcert -jarfile "$aab" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)"
jarsigner -verify "$aab" >/dev/null || { echo "bundle signature does not verify" >&2; exit 1; }
[[ -n "$want" && "$want" == "$got" ]] || { echo "bundle is not signed by the upload key (want $want, got ${got:-none})" >&2; exit 1; }
echo "signed release bundle: $aab"
echo "versionCode $code · commit $(git -C "$root" rev-parse HEAD) · upload cert SHA-256 $got"
shasum -a 256 "$aab"
