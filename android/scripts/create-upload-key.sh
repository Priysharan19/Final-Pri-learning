#!/usr/bin/env bash
# Pri Learning · create the Google Play UPLOAD key (once per developer account).
#
# Play App Signing keeps the app signing key; this upload key only proves an
# upload came from us, and Play can reset it if it is lost. It is written to
# ~/.pri-secrets/android/ (outside the repository, mode 600) with a random
# password, and is never committed, printed or pasted anywhere. Refuses to
# overwrite an existing key.
#
# Usage: android/scripts/create-upload-key.sh [secrets-dir]
set -euo pipefail
dir="${1:-$HOME/.pri-secrets/android}"
store="$dir/upload.jks"
props="$dir/upload-signing.properties"
alias="pri-upload"
if [[ -e "$store" || -e "$props" ]]; then
  echo "refusing: $store or $props already exists (an upload key is created once)" >&2
  exit 1
fi
command -v keytool >/dev/null || { echo "keytool not found (install a JDK 17)" >&2; exit 1; }
umask 077
mkdir -p "$dir"
chmod 700 "$dir"
pass="$(openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-32)"
# Passed to keytool through the environment, never on its command line (ps).
export PRI_KS_PASS="$pass"
# PKCS12 uses one password for the store and the key.
keytool -genkeypair -v -storetype PKCS12 -keystore "$store" -alias "$alias" \
  -keyalg RSA -keysize 4096 -validity 10000 -sigalg SHA256withRSA \
  -storepass:env PRI_KS_PASS -keypass:env PRI_KS_PASS \
  -dname "CN=Pri Learning Upload, O=Pri Learning, C=IN" >/dev/null 2>&1
cat > "$props" <<PROPS
# Pri Learning Play upload key — secret, never commit or share.
storeFile=$store
storePassword=$pass
keyAlias=$alias
keyPassword=$pass
PROPS
chmod 600 "$store" "$props"
echo "upload key written to $store (properties: $props)"
echo "upload certificate SHA-256 (register in Play Console → App integrity if asked):"
keytool -list -v -keystore "$store" -storepass:env PRI_KS_PASS -alias "$alias" 2>/dev/null | grep -E 'SHA256:' | sed 's/^[[:space:]]*//'
