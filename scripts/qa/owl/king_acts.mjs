import { boot } from './owllib.mjs'
import fs from 'fs'
const OUT = '/tmp/res2x-on58/docs/qa-king'; fs.mkdirSync(OUT, { recursive: true })
const { page, b, errs, press } = await boot('girl', 'normal')
const info = () => page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen
  const h = s.boy?.active ? s.boy : s.girl
  return { act: q?.act, anim: q?.anims.currentAnim?.key, ph: q?.qphase, hp: q?.hp, max: q?.maxHp, qx: Math.round(q?.x), hx: Math.round(h.x), shots: s.enemyShots.countActive(), mobs: s.enemies.getChildren().filter((e) => e.active && e !== q && e.fsm !== 'DEAD').length, bar: !!s.bossBar, bossOn: s.bossOn, sc: q?.scaleX, bw: q?.body.width }
})
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const keepAlive = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.hp = 6; h.graceUntil = s.time.now + 5000 } })
const log = (...a) => console.log(...a)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const e of [...s.enemies.getChildren()]) if (e !== s.queen) { e.disableBody(true, true); e.destroy() } })
await page.waitForTimeout(500)
log('start', JSON.stringify(await info()))
await shot('00-reveal')
const seen = new Set()
async function watch(ms, tag) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const d = await info(); const k = `${d.ph}|${d.act}|${d.anim}`
    if (!seen.has(k)) { seen.add(k); log(tag, JSON.stringify(d)); await shot(`${tag}-${d.act}-${d.anim}`.replace(/[^\w-]/g, '_')) }
    await keepAlive(); await page.waitForTimeout(120)
  }
}
await watch(9000, 'p1')
const setHit = (hp, d = 1) => page.evaluate(([hp, d]) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; q.lastHitAt = 0; q.hp = hp; q.receiveHit(d, 1); return q.hp }, [hp, d])
log('P2 hit ->', await setHit(34), JSON.stringify(await info()))
await page.waitForTimeout(300)
await shot('p2-entry')
await watch(12000, 'p2')
log('P3 hit ->', await setHit(18), JSON.stringify(await info()))
await page.waitForTimeout(300)
await shot('p3-entry')
await watch(12000, 'p3')
// exposed window: wait for it, then hit once and compare damage with a normal-window hit
for (let i = 0; i < 80; i++) { const d = await info(); if (d.act === 'exposed') break; await keepAlive(); await page.waitForTimeout(100) }
const e0 = await info(); log('exposed act', e0.act); const e1 = await setHit(e0.hp, 3)
log('exposed hit dmg', e0.hp, '->', e1)
for (let i = 0; i < 80; i++) { const d = await info(); if (d.act === 'stalk') break; await keepAlive(); await page.waitForTimeout(100) }
const n0 = await info(); const n1 = await setHit(n0.hp, 3)
log('normal hit dmg', n0.hp, '->', n1, 'act', n0.act)
// defeat
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; q.lastHitAt = 0; q.hp = 1; q.receiveHit(2, 1) })
await page.waitForTimeout(400); await shot('defeat-0')
log('defeat +0.4s', JSON.stringify(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { bossOn: s.bossOn, bf: s.bossFight, bar: !!s.bossBar, mobs: s.enemies.getChildren().filter((e) => e.active && e.fsm !== 'DEAD' && e.boss !== undefined).length, ended: s.ended } })))
await page.waitForTimeout(2600); await shot('defeat-1')
log('defeat +3s', JSON.stringify(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { bossOn: s.bossOn, bf: s.bossFight, bar: !!s.bossBar, alive: s.enemies.getChildren().filter((e) => e.active && e.fsm !== 'DEAD').length, ended: s.ended, goalX: s.goal.x, hx: s.girl?.x ?? s.boy.x } })))
// walk to goal
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = s.goal.x - 6 } })
await page.waitForTimeout(1500)
log('at goal', JSON.stringify(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { ended: s.ended, outro: s.outroOn } })))
await page.waitForTimeout(3500); await shot('outro')
log('errors', errs)
await b.close()
