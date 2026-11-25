#!/usr/bin/env bash
set -uo pipefail
OUT=docs/qa-m910-art/lockbot
mkdir -p "$OUT/game-desktop" "$OUT/game-mobile"
failed=0
run() {
  local label="$1" logfile="$2"; shift 2
  echo "=== $label ==="
  if "$@" >"$logfile" 2>&1; then echo "PASS: $label"; else echo "FAIL: $label (see $logfile)"; failed=1; fi
}
run 'tsc + Vite build' "$OUT/build.txt" npm run build
run 'validate data' "$OUT/validate-data.txt" npm run validate:data
run 'atlas and animation indices' "$OUT/image-check.txt" python3 docs/qa-m910-art/image-check.py public/art/stage9/enemies/s9lockbot.png public/art/stage9/enemies/s9lockbot.json "$OUT/image-check.json"
run 'desktop and mobile touch standalone preview' "$OUT/preview-run.txt" env M910_QA_OUT="$OUT" M910_ID=lockbot M910_STEM=s9lockbot node docs/qa-m910-art/preview.cjs
run 'desktop game smoke' "$OUT/game-desktop/run.txt" env QA_OUT="$OUT/game-desktop" QA_BASE_URL=http://127.0.0.1:47315/ node docs/qa-m910-art/desktop-current.mjs
run 'mobile touch game controls' "$OUT/game-mobile/run.txt" env QA_OUT="$OUT/game-mobile" QA_BASE_URL=http://127.0.0.1:47315/ node scripts/qa/mobile.mjs --controls-only
echo "=== QA finished: exit $failed ==="
exit "$failed"
