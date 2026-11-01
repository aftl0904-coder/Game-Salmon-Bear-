import { boot } from './owllib.mjs'
const { page, S, b, ev } = await boot('girl')
const kind = process.argv[2] ?? 'boss'
await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.queen.act = 'rest'; s.queen.x = 3600; s.queen.y = 285 })
await page.waitForTimeout(300)
const rows = await page.evaluate(async (kind) => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy?.active ? s.boy : s.girl
  h.x = 3400; h.hurtCd = 0; h.hp = 6; h.setVelocity(0, 0)
  await new Promise((r) => setTimeout(r, 200))
  const out = []
  const t0 = s.time.now
  const id = setInterval(() => out.push([Math.round(s.time.now - t0), +h.x.toFixed(1), Math.round(h.body.velocity.x), h.pose, Math.round(h.hurtLock), h.hurtDamp, Math.round(h.y)]), 25)
  if (kind === 'boss') { const sh = s.enemyShots.create(h.x + 20, h.y - 10, 'coin'); sh.setData('boss', true); sh.setData('dmg', 1); s.hitByFishBullet(h, sh) }
  else if (kind === 'owl') { s.queen.act = 'dive'; s.queen.x = h.x + 30; s.queen.contactCd = 0; s.hurtHero(h, s.queen) }
  else { const sh = s.enemyShots.create(h.x + 20, h.y - 10, 'coin'); sh.setData('dmg', 1); s.hitByFishBullet(h, sh) }
  await new Promise((r) => setTimeout(r, 1300))
  clearInterval(id); return { rows: out, x0: 3400 }
}, kind)
console.log(kind, 'final dx', (rows.rows.at(-1)[1] - 3400).toFixed(1))
console.log(rows.rows.filter((_, i) => true).slice(0, 26).map((r) => r.join(' ')).join('\n'))
await b.close()
