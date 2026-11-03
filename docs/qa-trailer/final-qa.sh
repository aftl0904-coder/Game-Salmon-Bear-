#!/usr/bin/env bash
set -euo pipefail
V=docs/trailer/salmon-bear-trailer-first-cut.mp4
mkdir -p docs/qa-trailer/frames
ffprobe -v error -show_format -show_streams -of json "$V" > docs/qa-trailer/ffprobe.json
ffmpeg -hide_banner -i "$V" -af volumedetect -f null - > docs/qa-trailer/audio-levels.txt 2>&1
sed -i 's/[[:space:]]\+$//' docs/qa-trailer/audio-levels.txt
ffmpeg -v error -i "$V" -f null - > docs/qa-trailer/decode.txt 2>&1
echo 'PASS: complete video and audio streams decoded without ffmpeg error' >> docs/qa-trailer/decode.txt
ffmpeg -y -hide_banner -loglevel error -i "$V" -vf "fps=1,scale=320:180,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{pts\\:hms}':fontcolor=white:fontsize=13:box=1:boxcolor=black@0.7:x=4:y=4,tile=5x3:padding=4:margin=4" -q:v 3 docs/qa-trailer/frames/timeline-%02d.jpg
# Boss sheet labels are relative to 29 s; add 29 s for movie time.
ffmpeg -y -hide_banner -loglevel error -ss 29 -t 12 -i "$V" -vf "fps=5,scale=320:180,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{pts\\:hms}':fontcolor=white:fontsize=13:box=1:boxcolor=black@0.7:x=4:y=4,tile=5x3:padding=4:margin=4" -q:v 3 docs/qa-trailer/frames/boss-%02d.jpg
for ts in 2 5 10 16 22 26 28 38.3 40.3 42 45 46 49 53 56 60.3 63 70; do
 ffmpeg -y -hide_banner -loglevel error -ss "$ts" -i "$V" -frames:v 1 "docs/qa-trailer/frames/frame-$ts.png"
done
python3 docs/qa-trailer/check-media.py
python3 docs/qa-trailer/check-audio-sync.py > docs/qa-trailer/audio-sync-check.txt
sha256sum "$V" > docs/qa-trailer/sha256.txt
find docs/trailer/source -type f -print0 | sort -z | xargs -0 sha256sum >> docs/qa-trailer/sha256.txt
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for p in Path('docs/qa-trailer/frames').glob('*.png'):
    with Image.open(p) as im:
        im.thumbnail((640, 360), Image.Resampling.LANCZOS)
        im.save(p, optimize=True)
PY
