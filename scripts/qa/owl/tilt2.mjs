import { chromium } from 'playwright'
const b = await chromium.launch(); const page = await (await b.newContext()).newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(4000)
const r = await page.evaluate(async () => {
  const m = await import('/src/game/minigames.ts')
  const HW = 108, HH = 64, BALL = 8, step = 2
  const bx0 = -HW + BALL, bx1 = HW - BALL, by0 = -HH + BALL, by1 = HH - BALL
  const res = {}
  for (const margin of [0, 4]) for (let round = 1; round <= 4; round++) {
    let fail = 0
    for (let k = 0; k < 600; k++) {
      const { hole, pits } = m.tiltLayout(round, HW, HH)
      const blockedAt = (x, y) => pits.some((p) => Math.hypot(x - p.x, y - p.y) < 13 + margin)
      const W = Math.floor((bx1 - bx0) / step) + 1, H = Math.floor((by1 - by0) / step) + 1
      const seen = new Uint8Array(W * H); const q = [[Math.round((0 - bx0) / step), Math.round((0 - by0) / step)]]
      seen[q[0][1] * W + q[0][0]] = 1; let ok = false
      while (q.length) {
        const [ix, iy] = q.pop(); const x = bx0 + ix * step, y = by0 + iy * step
        if (Math.hypot(x - hole.x, y - hole.y) < 12) { ok = true; break }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue; if (blockedAt(bx0 + nx * step, by0 + ny * step)) continue; seen[ny * W + nx] = 1; q.push([nx, ny]) }
      }
      if (!ok) fail++
    }
    res[`margin${margin}-round${round}`] = fail
  }
  return res
})
console.log(JSON.stringify(r)); await b.close()
