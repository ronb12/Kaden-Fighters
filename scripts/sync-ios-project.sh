#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/build-ios-web.sh"
rm -rf "$ROOT/ios/App/Kaden Fighters/public"
mkdir -p "$ROOT/ios/App/Kaden Fighters"
rsync -a "$ROOT/dist/ios-web/" "$ROOT/ios/App/Kaden Fighters/public/"

printf 'iOS Xcode project synced at %s\n' "$ROOT/ios/App/Kaden Fighters/public"
