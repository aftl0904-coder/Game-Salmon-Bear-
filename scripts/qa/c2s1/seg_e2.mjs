import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const mode = process.env.MODE || '1p'
const { b, page, errs } = await boot({ mode })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const res = { mode }
const shot = (n) => page.screenshot({ path: `${OUT}/E2-${n}.png` })
await run(`s.coffeeDone = true; window.__hz=[]; const o = s.hazardHit.bind(s); s.hazardHit = (h, op) => { window.__hz.push({ t: Math.round(s.time.now), label: op.label }); return o(h, op) }`)
await run(`for (const h of [s.boy, s.girl]) if (h) { h.x = 4700; h.y = 285; h.graceUntil = s.time.now + 5000 }; s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true,true); e.destroy() }; s.cameras.main.centerOn(4700,180)`)
res.pet = await run(`return s.pet ? { x: Math.round(s.pet.x), hx: Math.round(s.boy.x) } : null`)
// wait for a barrage with bolts, and for a sweep run
let gotShot = { bolt: false, sweep: false }
for (let i = 0; i < 200 && !(gotShot.bolt && gotShot.sweep); i++) {
  await run(`for (const h of [s.boy, s.girl]) if (h) { h.hp = 5; h.graceUntil = s.time.now + 3000 }`)
  const st = await run(`const q = s.queen; return { act: q && q.act, shots: s.enemyShots.getChildren().length, ev: s.s6world.events.slice(-1)[0]?.kind, evs: s.s6world.events.slice(-3).map(e=>e.kind), sw: s.s6world.sweeps.length }`)
  if (!gotShot.bolt && st.shots > 0) { await shot('barrage-bolts'); gotShot.bolt = true }
  if (!gotShot.sweep && (st.evs||[]).includes('sweep-run')) { await shot('sweep-run'); gotShot.sweep = true }
  await page.waitForTimeout(120)
}
res.gotShot = gotShot
res.petDuring = await run(`return s.pet ? { x: Math.round(s.pet.x), hx: Math.round(s.boy.x), vis: s.pet.visible } : null`)
// defeat
await run(`s.queen.hp = 1`)
for (let i = 0; i < 4; i++) { await run(`s.queen && s.queen.active && s.queen.receiveHit(5, 1)`); await page.waitForTimeout(500) }
for (let i = 0; i < 120; i++) { const j = await run(`return s.honeyPickups.getChildren().filter(o=>o.active && o.getData('bossJar')).length`); if (j) break; await page.waitForTimeout(250) }
await shot('jar')
res.dbg = await run(`return { paused: s.scene.isPaused(), now: s.time.now, pw: s.physics.world.isPaused, tscale: s.time.timeScale,  q: !!s.queen, hp: s.queen?.hp, fsm: s.queen?.fsm, act: s.queen?.act, active: s.queen?.active, ended: s.ended, jars: s.honeyPickups.getChildren().map(o=>[Math.round(o.x), o.active, o.getData('bossJar')]) }`)
console.log(JSON.stringify(res.dbg))
res.jar = await run(`const j = s.honeyPickups.getChildren().find(o=>o.getData('bossJar')); return j ? { x: Math.round(j.x), y: Math.round(j.y) } : null`)
res.cleared_before_pick = await run(`return { ended: s.ended, outro: s.outroOn }`)
await run(`const j = s.honeyPickups.getChildren().find(o=>o.getData('bossJar')); s.boy.x = j.x; s.boy.y = 285`)
await page.waitForTimeout(6000)
await shot('clear-card')
res.after = await run(`return { ended: s.ended, outro: s.outroOn, texts: s.children.list.filter(o => o.type === 'Text' && o.text).map(o => o.text).slice(-25) }`)
res.errs = errs
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(`${OUT}/seg_e2_${mode}.log.json`, JSON.stringify(res, null, 1))
await b.close()
