import { boot } from './owllib.mjs'
import fs from 'fs'
const stage = +process.env.STAGE
const OUT = '/tmp/res2x-on58/docs/qa-bossart'
const { page, b, errs } = await boot('girl', 'normal')
const info = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; return { act: q.act, anim: q.anims.currentAnim?.key, bw: q.body.width, hp: q.hp, fsm: q.fsm, vis: q.visible } })
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; q.lastHitAt = 0; q.hp = Math.round(q.maxHp * 0.3); q.hurtMs = 0; q.receiveHit(1, 1) })
const clip = async () => { const p = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; const c = s.cameras.main; return { x: (q.x - c.scrollX) * 2, y: (q.y - c.scrollY) * 2 } }); const x = Math.min(Math.max(0, p.x - 160), 1280 - 320); const y = Math.min(Math.max(0, p.y - 300), 720 - 330); return { x, y, width: 320, height: 330 } }
const seen = new Map()
for (let i = 0; i < 100; i++) {
  const d = await info()
  const k = `${d.act}|${d.anim}`
  if (!seen.has(k)) { seen.set(k, d); await page.screenshot({ clip: await clip(), path: `${OUT}/c-p3-s${stage}-${String(seen.size).padStart(2, '0')}-${d.act}.png` }); console.log(JSON.stringify(d)) }
  await page.waitForTimeout(200)
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.hp = 6; h.graceUntil = s.time.now + 5000 } })
}
// kill
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; q.lastHitAt = 0; q.hp = 1; q.act = q.act; q.receiveHit(99, 1) })
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); const d = await info(); console.log('dead', JSON.stringify(d)); await page.screenshot({ clip: await clip(), path: `${OUT}/c-p3-s${stage}-dead${i}.png` }) }
console.log('errors', errs)
await b.close()
