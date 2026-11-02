import { boot, OUT } from './lib.mjs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
console.log('stage', await run('return [s.stageNo, s.mall, s.started, Object.keys(s).length>0]'))
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/A0-start.png` })
// god mode & teleport helper
const tp = async (x, tag, wait = 1800) => {
  await run('s.coffeeDone = true; s.physics.resume(); for (const h of [s.boy, s.girl]) if (h) { h.x = a; h.y = 300; h.hp = 6; h.graceUntil = s.time.now + 900000; h.setVelocity(0,0) } s.cameras.main.centerOn(a + 120, 180)', x)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}/${tag}.png` })
}
await tp(400, 'A1-dome')
await tp(800, 'A2-exit')
await tp(1200, 'B1-corridor')
await tp(1700, 'B2-robotarm')
await tp(2300, 'C1-construction', 2500)
await tp(2900, 'C2-concrete', 3500)
await tp(3500, 'D1-factory', 3500)
await tp(4000, 'D2-factory', 2500)
console.log('errs', errs)
await b.close()
