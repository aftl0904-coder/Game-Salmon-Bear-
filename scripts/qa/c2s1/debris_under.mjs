import { boot, OUT } from './lib.mjs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
await run(`s.coffeeDone = true; s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }; s.enemyShots.clear(true,true)`)
console.log(JSON.stringify(await run(`return {y:s.boy.y, floor:s.floorY}`)))
await run(`const h = s.boy; h.x = 2430; h.y = 285; h.graceUntil = 0; h.setVelocity(0,0); s.cameras.main.centerOn(2430, 180)
 window.__log = []; const orig = s.hazardHit.bind(s); s.hazardHit = (hh, o) => { window.__log.push({ t: Math.round(s.time.now), label: o.label }); return orig(hh, o) }`)
let shot = false, shot2=false
for (let i = 0; i < 60; i++) {
  const r = await run(`const ev = s.s6world.events.filter(e=>e.x===2430); return {now:Math.round(s.time.now), hp: s.boy.hp, x: Math.round(s.boy.x), y: Math.round(s.boy.y), last: ev.length? ev[ev.length-1].kind:'' , ev: ev.map(e=>e.kind+'@'+Math.round(e.at))}`)
  if (!shot && r.last==='debris-warn') { await page.screenshot({ path: OUT + '/C4-telegraph.png' }); shot = true }
  if (!shot2 && r.last==='debris-land') { await page.screenshot({ path: OUT + '/C5-landed-hit.png' }); shot2 = true }
  if (i % 4 === 0) console.log(JSON.stringify(r))
  await page.waitForTimeout(250)
}
console.log(JSON.stringify(await run(`return window.__log`)), JSON.stringify(await run(`return s.s6world.events.filter(e=>e.x===2430)`)), errs)
await b.close()
