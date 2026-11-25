#!/usr/bin/env bash
set -uo pipefail
OUT=docs/qa-m910-art/chief
mkdir -p "$OUT/game-desktop" "$OUT/game-mobile"
failed=0
run() {
  local label="$1" logfile="$2"; shift 2
  echo "=== $label ==="
  if "$@" >"$logfile" 2>&1; then echo "PASS: $label"; else echo "FAIL: $label (see $logfile)"; failed=1; fi
}
run 'tsc + Vite build' "$OUT/build.txt" npm run build
run 'validate data' "$OUT/validate-data.txt" npm run validate:data
run 'atlas and animation indices' "$OUT/image-check.txt" python3 docs/qa-m910-art/image-check.py public/art/stage9/enemies/s9chief.png public/art/stage9/enemies/s9chief.json "$OUT/image-check.json"
for pair in 'baton_warning baton_sweep' 'key_warning key_throw' 'gate_warning gate_action' 'key_drop weakpoint_glow' 'defeat open_cage'; do
  read -r warn attack <<<"$pair"
  dest="$OUT/preview-$warn-$attack"; mkdir -p "$dest"
  run "standalone desktop / touch $warn to $attack" "$dest/run.txt" env M910_ID=chief M910_STEM=s9chief M910_WARN="$warn" M910_ATTACK="$attack" M910_QA_OUT="$dest" node docs/qa-m910-art/preview.cjs
done
run 'desktop game smoke' "$OUT/game-desktop/run.txt" env QA_OUT="$OUT/game-desktop" QA_BASE_URL=http://127.0.0.1:47315/ node docs/qa-m910-art/desktop-current.mjs
run 'mobile touch game controls' "$OUT/game-mobile/run.txt" env QA_OUT="$OUT/game-mobile" QA_BASE_URL=http://127.0.0.1:47315/ node scripts/qa/mobile.mjs --controls-only
echo "=== QA finished: exit $failed ==="
exit "$failed"
