import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const mode = process.env.MODE || '1p'
const { b, page, errs } = await boot({ mode })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const res = { mode, timeline: [] }
const shot = (n) => page.screenshot({ path: `${OUT}/E-${n}.png` })
await run(`s.coffeeDone = true; window.__hz = []; const o = s.hazardHit.bind(s); s.hazardHit = (h, op) => { window.__hz.push({ t: Math.round(s.time.now), label: op.label, boss: !!op.boss }); return o(h, op) }; window.__emits=[]; const oe = s.emitScore.bind(s); s.emitScore = (t) => { window.__emits.push(String(t)); return oe(t) }`)
await run(`for (const h of [s.boy, s.girl]) if (h) { h.x = 4650; h.y = 285; h.graceUntil = s.time.now + 5000 }; s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true,true); e.destroy() }; s.cameras.main.centerOn(4700,180)`)
res.beforeTrigger = await run(`return { bossFight: s.bossFight, lead: s.leadX() }`)
await run(`for (const h of [s.boy, s.girl]) if (h) h.x = 4700`)
const state = () => run(`const q = s.queen; return { bossFight: s.bossFight, now: Math.round(s.time.now), q: q ? { act: q.act, ph: q.qphase, hp: q.hp, x: Math.round(q.x), fsm: q.fsm } : null, hero: s.boy ? [Math.round(s.boy.x), s.boy.hp] : null, drones: s.s6world.droneCount(), ev: s.s6world.events.slice(-3).map(e => e.kind), hz: window.__hz.length }`)
let last = ''
const poll = async (ms, tag) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    await run(`for (const h of [s.boy, s.girl]) if (h && h.hp < 3) h.hp = 5`)
    const st = await state()
    const key = st.q ? `${st.q.ph}/${st.q.act}` : 'noq'
    if (key !== last) { res.timeline.push({ tag, key, ...st }); last = key; await shot(`${tag}-${key.replace('/', '-')}`) }
    await page.waitForTimeout(150)
  }
}
await poll(14000, 'p1')
res.p1Hazards = await run(`return { hz: window.__hz.slice(), ev: s.s6world.events.map(e => e.kind) }`)
// phase 2
await run(`s.queen.hp = Math.floor(s.queen.maxHp*0.65)+1; s.queen.receiveHit(1, 1)`)
res.afterP2force = await state()
await poll(14000, 'p2')
res.p2 = await run(`return { drones: s.s6world.droneCount(), ev: [...new Set(s.s6world.events.map(e => e.kind))], hz: window.__hz.length }`)
await run(`s.queen.hp = Math.floor(s.queen.maxHp*0.29); s.queen.receiveHit(1, 1)`)
res.afterP3force = await state()
await poll(14000, 'p3')
res.p3 = await run(`return { ev: [...new Set(s.s6world.events.map(e => e.kind))], hz: window.__hz.length, labels: [...new Set(window.__hz.map(x => x.label))] }`)
// kill
await run(`s.queen.hp = 2`)
for (let i = 0; i < 6; i++) { await run(`s.queen && s.queen.receiveHit(5, 1)`); await page.waitForTimeout(450) }
await page.waitForTimeout(500)
res.afterKill = await run(`return { queen: !!s.queen, bossFight: s.bossFight, jars: s.honeyPickups ? s.honeyPickups.getChildren?.().length : 'n/a', emits: window.__emits.slice(-6), drones: s.s6world.droneCount() }`)
await page.waitForTimeout(3500); await shot('after-defeat')
res.errs = errs
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(`${OUT}/seg_e_${mode}.log.json`, JSON.stringify(res, null, 1))
await b.close()
