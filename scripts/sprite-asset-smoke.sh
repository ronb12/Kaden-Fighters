#!/usr/bin/env bash
# HTTP smoke: sprite-related assets and boot files return 200 from a local static server.
# Run from project root: bash scripts/sprite-asset-smoke.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VER=$(sed -n "s/.*ASTRA_ASSET_VER = '\([^']*\)'.*/\1/p" js/kfr-game.js | head -1)
if [[ -z "$VER" ]]; then
  echo "Could not read ASTRA_ASSET_VER from js/kfr-game.js" >&2
  exit 1
fi

python3 -m http.server 8765 --bind 127.0.0.1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
sleep 0.4
BASE="http://127.0.0.1:8765"

urls=(
  "$BASE/index.html"
  "$BASE/js/kfr-game.js?v=$VER"
  "$BASE/assets/reigen_classic_row.png?v=$VER"
  "$BASE/assets/astra_fighter_sheet.png?v=$VER"
  "$BASE/assets/astra_raijin.png?v=$VER"
  "$BASE/assets/astra_hikari.png?v=$VER"
  "$BASE/assets/astra_ren.png?v=$VER"
  "$BASE/assets/astra_yuki.png?v=$VER"
  "$BASE/assets/kaden-gameplay.png?v=$VER"
  "$BASE/assets/kaden_taekwondo_sheet.png?v=$VER"
  "$BASE/assets/raijin_taekwondo_sheet.png?v=$VER"
  "$BASE/assets/hikari_wushu_sheet.png?v=$VER"
  "$BASE/assets/ren_aikido_sheet.png?v=$VER"
  "$BASE/assets/yuki_judo_sheet.png?v=$VER"
  "$BASE/assets/main-menu-hero.png"
  "$BASE/assets/stages-strip.png"
  "$BASE/assets/game-over.png"
)

failed=0
for u in "${urls[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$u" || echo "000")
  if [[ "$code" != "200" ]]; then
    echo "FAIL $code $u" >&2
    failed=1
  else
    echo "OK   $u"
  fi
done
if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
echo "sprite-asset-smoke: all ${#urls[@]} requests returned 200"
