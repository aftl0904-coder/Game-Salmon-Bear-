import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const mode = process.env.MODE || '2p'
const MINUTES = Number(process.env.MINUTES || 5)
const { b, page, errs } = await boot({ mode })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX', 'KeyC', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyL']
const stops = [300, 1000, 2200, 3300, 3900, 4700]
const log = { stops: [], restarts: 0, samples: [] }
const t0 = Date.now(); let i = 0, held = null
while (Date.now() - t0 < MINUTES * 60000) {
  i++
  const k = keys[Math.floor(Math.random() * keys.length)]
  if (Math.random() < 0.15) { held = k; await page.keyboard.down(k) } else if (held && Math.random() < 0.3) { await page.keyboard.up(held); held = null }
  else await page.keyboard.press(k).catch(() => {})
  if (i % 40 === 0) {
    const st = stops[Math.floor(Math.random() * stops.length)]
    const info = await run(`const alive = [s.boy, s.girl].filter(h => h && h.alive); return { ended: s.ended, x: alive[0] ? Math.round(alive[0].x) : null, now: Math.round(s.time.now), actors: s.enemies.getChildren().length, shots: s.enemyShots.getChildren().length, q: !!s.queen }`).catch((e) => ({ err: String(e) }))
    log.samples.push(info)
    if (i % 120 === 0) { await run(`for (const h of [s.boy, s.girl]) if (h) { h.x = a; h.y = 285; h.hp = Math.max(h.hp, 3) }; s.cameras.main.centerOn(a, 180)`, st).catch(() => {}); log.stops.push(st) }
  }
  await page.waitForTimeout(60)
}
if (held) await page.keyboard.up(held)
log.errs = errs
fs.writeFileSync(`${OUT}/soak_${mode}.log.json`, JSON.stringify(log, null, 1))
console.log('done', log.samples.length, 'samples', log.stops.join(','), 'errs', errs.length, errs.slice(0, 5))
await b.close()
