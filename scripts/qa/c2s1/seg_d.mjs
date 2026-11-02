import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const res = {}
await run(`s.coffeeDone = true; s.boy.hp = 5; window.__seen = new Map(); window.__emits = []; const oe = s.emitScore.bind(s); s.emitScore = (t) => { window.__emits.push(String(t)); return oe(t) }`)
const tp = async (x) => { await run(`const h = s.boy; h.x = a; h.y = 285; h.graceUntil = s.time.now + 60000; h.setVelocity(0,0); s.cameras.main.centerOn(a, 180)`, x) }
const sample = () => run(`for (const e of s.enemies.getChildren()) if (e.active) { const k = e.__id ??= Math.random(); if (!window.__seen.has(k) && e.x >= 3135 && e.x < 4560 && e.species !== "guard" && e.species !== "fish") window.__seen.set(k, e.species+'@'+Math.round(e.x)) }; return [window.__seen.size, s.s2Pending.length]`)
const kill = () => run(`for (const e of [...s.enemies.getChildren()]) if (e.x < 3100) { e.disableBody(true,true); e.destroy() }`)
await tp(3100); await page.waitForTimeout(800); await kill()
for (const x of [3200, 3330, 3480, 3620, 3760, 3900, 4040, 4180, 4300, 4420]) {
  await tp(x); for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); await sample() }
  if (x === 3330) await page.screenshot({ path: OUT + '/D3-darkveil.png' })
  if (x === 3900) await page.screenshot({ path: OUT + '/D4-cage.png' })
  await run(`s.boy.hp = 5`)
}
res.D = await run(`return { seen: [...window.__seen.values()], pending: s.s2Pending.length }`)
res.dark = await run(`return { dark: s.s3world.dark, zones: s.s3world.d.darkZones }`)
// cage trigger once
res.cage1 = await run(`return window.__emits.filter(t => t.includes('籠')).length`)
await tp(3880); await page.waitForTimeout(600)
await tp(3300); await page.waitForTimeout(600)
await tp(3880); await page.waitForTimeout(600)
res.cage2 = await run(`return { count: window.__emits.filter(t => t.includes('籠')).length, said: s.cageSaid }`)
// dark off outside zone
await tp(2800); await page.waitForTimeout(2500)
res.darkOutside = await run(`return s.s3world.dark`)
res.errs = errs
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(OUT + '/seg_d.log.json', JSON.stringify(res, null, 1))
await b.close()
