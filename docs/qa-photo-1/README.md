# photo-1 + bike-c2 art QA

Branch `cursor/photo-1-bike-art-2610`（base `claude/photo-s5-2611` + polish-1 chase）.

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 4751 --strictPort
QA_PORT=4751 node scripts/qa/photo-1-bike-art.mjs
```

| Check | Result |
| --- | --- |
| Stage5 photo 1P | PASS — flash + polaroid + `2026・聖誕` |
| Stage5 photo 2P (girl crosses) | PASS |
| Stage5 photo mobile | PASS |
| Chase uses `bike-c2-far/mid/goal` | PASS |
| Near-end goal scale-up | PASS |

Photo texture uses LINEAR filter (not pixelated). Mid L/R seam matched for seamless tile scroll.
