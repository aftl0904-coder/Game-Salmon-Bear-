import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const say = (k, v) => console.log(k, JSON.stringify(v))
await run(`s.coffeeDone = true; s.s2Pending = []; s.physics.resume(); for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }`)
// Part 1: stand beside the drop (60px away): the telegraph + fall + land must happen with no damage to the hero.
await run(`for (const h of [s.boy]) { h.x = 2185; h.y = 300; h.hp = 5; h.graceUntil = 0; h.setVelocity(0,0) } s.cameras.main.centerOn(2245, 180)`)
await page.waitForTimeout(500)
const t0 = await run(`return s.time.now`)
const samples = []
const t1 = Date.now()
while (Date.now() - t1 < 14000) {
  samples.push(await run(`return { t: Math.round(s.time.now), hp: s.boy.hp, phases: s.s6world.debris.filter(d=>d.x===2230||d.x===2430).map(d=>d.x+':'+d.phase) }`))
  await page.waitForTimeout(250)
}
const ev = await run(`return s.s6world.events.map(e=>e.kind+'@'+e.x+'#'+e.at)`)
say('C.events(beside)', ev)
say('C.hpBeside', [...new Set(samples.map(x => x.hp))])
await page.screenshot({ path: `${OUT}/C3-after.png` })
// Part 2: stand directly under a drop: no damage until the 'land' event, damage after.
await run(`s.s6world.events.length = 0; for (const h of [s.boy]) { h.x = 2430; h.y = 300; h.hp = 5; h.graceUntil = 0; h.setVelocity(0,0) } s.cameras.main.centerOn(2490, 180); s.boy.hurtLock = 0; s.boy.hp = 5; window.__hp = []; s.events.on('update', () => { window.__hp.push([Math.round(s.time.now), s.boy.hp, s.s6world.debris.find(d=>d.x===2430).phase]) })`)
let shot = false
const t2 = Date.now()
while (Date.now() - t2 < 20000) {
  const cur = await run(`return { hp: s.boy.hp, ph: s.s6world.debris.find(d=>d.x===2430).phase }`)
  if (cur.ph === 'warn' && !shot) { shot = true; await page.screenshot({ path: `${OUT}/C4-telegraph.png` }) }
  if (cur.hp < 5) break
  await page.waitForTimeout(200)
}
const hp = await run(`return window.__hp`)
const ev2 = await run(`return s.s6world.events.map(e=>[e.kind,e.x,e.at])`)
const firstLoss = hp.find((r) => r[1] < 5)
const firstFall = hp.find((r) => r[2] === 'fall'), firstLand = hp.find((r) => r[2] === 'land')
say('C.under.events', ev2)
say('C.under', { firstWarn: hp.find((r) => r[2] === 'warn')?.[0], firstFall: firstFall?.[0], firstLand: firstLand?.[0], firstHpLoss: firstLoss ? { t: firstLoss[0], phase: firstLoss[2] } : null })
// hp never dropped while in 'warn' or 'fall'
say('C.noDamageBeforeLand', hp.filter((r) => r[1] < 5 && (r[2] === 'warn' || r[2] === 'fall')).length === 0)
say('errs', errs)
await b.close()
