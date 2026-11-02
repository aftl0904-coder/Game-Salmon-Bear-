import { boot } from './owllib.mjs'
const stage = +process.env.STAGE
const OUT = '/tmp/res2x-on58/docs/qa-bossart'
const { page, b, errs } = await boot('girl', 'normal')
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; q.lastHitAt = 0; q.hp = 1; if (q.act !== undefined) q.act = q.qphase === 3 && q.maxHp === 48 ? 'crack' : q.act; q.receiveHit(99, 1) })
for (let i = 0; i < 8; i++) {
  const d = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; const c = s.cameras.main; return { x: (q.x - c.scrollX) * 2, y: (q.y - c.scrollY) * 2, anim: q.anims.currentAnim?.key, fr: q.anims.currentFrame?.index, vis: q.visible, hp: q.hp, win: !!s.registry.get('winScreenShown') } })
  console.log(JSON.stringify(d))
  await page.screenshot({ path: `${OUT}/die-${stage}-${i}.png`, clip: { x: Math.min(Math.max(0, d.x - 160), 960), y: Math.min(Math.max(0, d.y - 260), 400), width: 320, height: 300 } })
  await page.waitForTimeout(350)
}
console.log('errors', errs); await b.close()
