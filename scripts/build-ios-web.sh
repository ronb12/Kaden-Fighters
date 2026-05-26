#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/ios-web"

rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT"/index.html "$OUT"/
cp "$ROOT"/characters.html "$OUT"/
cp "$ROOT"/controls.html "$OUT"/
cp "$ROOT"/fighter-demo.html "$OUT"/
cp "$ROOT"/leaderboard.html "$OUT"/
cp "$ROOT"/privacy.html "$OUT"/
cp "$ROOT"/sprite-lab.html "$OUT"/
cp "$ROOT"/stages.html "$OUT"/
cp "$ROOT"/site.webmanifest "$OUT"/
cp "$ROOT"/favicon.ico "$OUT"/
cp "$ROOT"/README.md "$OUT"/
rsync -a "$ROOT"/assets/ "$OUT"/assets/
rsync -a "$ROOT"/css/ "$OUT"/css/
rsync -a "$ROOT"/js/ "$OUT"/js/

printf 'iOS web bundle built at %s\n' "$OUT"
