import { boot } from './owllib.mjs'
import fs from 'fs'
const stage = +process.env.STAGE
const OUT = '/tmp/res2x-on58/docs/qa-bossart'; fs.mkdirSync(OUT, { recursive: true })
const { page, b, errs } = await boot('girl', 'normal')
const info = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; return { act: q.act, anim: q.anims.currentAnim?.key, fr: q.anims.currentFrame?.index, w: q.displayWidth, h: q.displayHeight, bw: q.body.width, bx: Math.round(q.x), hp: q.hp, vis: q.visible, tex: q.texture.key } })
const clip = async () => { const p = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; const c = s.cameras.main; return { x: (q.x - c.scrollX) * 2, y: (q.y - c.scrollY) * 2 } }); const x = Math.min(Math.max(0, p.x - 160), 1280 - 320); const y = Math.min(Math.max(0, p.y - 300), 720 - 330); return { x, y, width: 320, height: 330 } }
const seen = new Map()
for (let i = 0; i < 160; i++) {
  const d = await info()
  const k = `${d.act}|${d.anim}`
  if (!seen.has(k)) { seen.set(k, d); await page.screenshot({ clip: await clip(), path: `${OUT}/c-s${stage}-${String(seen.size).padStart(2, '0')}-${d.act}.png` }); console.log(JSON.stringify(d)) }
  await page.waitForTimeout(250)
  // keep hero alive & away from harm
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.hp = 6; h.graceUntil = s.time.now + 5000 } })
}
console.log('errors', errs)
await b.close()
