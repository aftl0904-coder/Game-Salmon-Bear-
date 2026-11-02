import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const res = {}
await run(`s.coffeeDone = true; s.boy.hp = 5`)
const tp = async (x) => { await run(`const h = s.boy; h.x = a; h.y = 285; h.graceUntil = s.time.now + 60000; h.setVelocity(0,0); s.cameras.main.centerOn(a, 180)`, x) }
res.textures = await run(`return ['s6-factory-wall','s6-conveyor','s6-boxstack'].map(k => [k, s.textures.exists(k)])`)
res.placed = await run(`return s.children.list.filter(o => ['s6-factory-wall','s6-conveyor','s6-boxstack'].includes(o.texture?.key)).map(o => [o.texture.key, o.x, o.y, o.depth, !!o.body])`)
await tp(3100); await page.waitForTimeout(800)
await run(`for (const e of [...s.enemies.getChildren()]) { e.disableBody(true,true); e.destroy() }`)
const shots = [[3262, 'D-sign'], [3496, 'D-conveyor-a'], [3352, 'D-boxes-a'], [4096, 'D-conveyor-b'], [3990, 'D-boxes-b'], [4410, 'D-boxes-c']]
for (const [x, name] of shots) {
  await tp(x); await page.waitForTimeout(900)
  await run(`s.boy.hp = 5`)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}
res.errs = errs
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(OUT + '/props_d.log.json', JSON.stringify(res, null, 1))
await b.close()
