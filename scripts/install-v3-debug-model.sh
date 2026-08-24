#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="${1:-$HOME/Downloads/PriInkFoundation-V3-DEBUG-Test.zip}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ ! -f "$ZIP" ]]; then
  echo "Pri Ink V3 DEBUG artifact not found: $ZIP" >&2
  echo "Usage: $0 /path/to/PriInkFoundation-V3-DEBUG-Test.zip" >&2
  exit 2
fi

unzip -q "$ZIP" -d "$TMP"
MODEL="$(find "$TMP" -type d -name 'PriInkFoundation.mlpackage' -print -quit)"
if [[ -z "${MODEL:-}" || ! -f "$MODEL/Manifest.json" ]]; then
  echo "Artifact does not contain a valid PriInkFoundation.mlpackage" >&2
  exit 3
fi

for PACKAGE in "ios/PriLearning.swiftpm" "ios/PriLearning 2.swiftpm"; do
  DEST="$ROOT/$PACKAGE/Resources/Models/PriInkFoundation.mlpackage"
  mkdir -p "$(dirname "$DEST")"
  rm -rf "$DEST"
  cp -R "$MODEL" "$DEST"
  test -f "$DEST/Manifest.json"
  echo "Installed V3 DEBUG model -> $PACKAGE/Resources/Models/PriInkFoundation.mlpackage"
done

echo
echo "Pri Learning V3 DEBUG model is bundled in both SwiftPM apps."
echo "Open ios/PriLearning.swiftpm/Package.swift in Xcode and run a DEBUG build on the iPad."
echo "DEBUG now shows the Pri Foundation result first; native recognition is fallback only."
echo "RELEASE promotion gates are unchanged."
