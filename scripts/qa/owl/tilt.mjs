import { chromium } from 'playwright'
const b = await chromium.launch(); const page = await (await b.newContext()).newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(4000)
const r = await page.evaluate(async () => {
  const m = await import('/src/game/minigames.ts')
  const out = { n: 0, lineBlocked: 0, minStart: 1e9, minHole: 1e9, minPit: 1e9, outOfBounds: 0, maxPits: 0, noLinePit: 0, holeLen: [] }
  const HW = 108, HH = 64, HOLE_R = 16, PIT_R = 15
  for (let round = 1; round <= 4; round++) for (let k = 0; k < 2500; k++) {
    const { hole, pits } = m.tiltLayout(round, HW, HH)
    out.n++
    const len = Math.hypot(hole.x, hole.y)
    let blocked = false
    for (const p of pits) {
      out.minStart = Math.min(out.minStart, Math.hypot(p.x, p.y)); out.minHole = Math.min(out.minHole, Math.hypot(p.x - hole.x, p.y - hole.y))
      if (Math.abs(p.x) > HW - 8 || Math.abs(p.y) > HH - 8) out.outOfBounds++
      // distance of pit to the segment start->hole
      const t = Math.max(0, Math.min(1, (p.x * hole.x + p.y * hole.y) / (len * len)))
      if (Math.hypot(p.x - hole.x * t, p.y - hole.y * t) < PIT_R - 2) blocked = true
    }
    for (let i = 0; i < pits.length; i++) for (let j = i + 1; j < pits.length; j++) out.minPit = Math.min(out.minPit, Math.hypot(pits[i].x - pits[j].x, pits[i].y - pits[j].y))
    if (blocked) out.lineBlocked++
    out.maxPits = Math.max(out.maxPits, pits.length)
    out.holeLen.push(len)
  }
  out.holeLenMin = Math.min(...out.holeLen); delete out.holeLen
  return out
})
console.log(JSON.stringify(r)); await b.close()
