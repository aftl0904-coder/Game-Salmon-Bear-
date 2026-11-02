import { boot, OUT } from './lib.mjs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
await run(`s.coffeeDone = true; s.s2Pending=[]; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true,true); e.destroy() }; s.boy.x = 800; s.boy.y = 285; s.cameras.main.centerOn(800,180); s.s6world.drone(700, 1000, 1, 85); window.__hz=[]; const o = s.hazardHit.bind(s); s.hazardHit = (h, op) => { window.__hz.push(op.label); return o(h, op) }`)
for (let i = 0; i < 24; i++) { console.log(JSON.stringify(await run(`const d = s.s6world.drones[0]; return { dx: d && Math.round(d.img.x), lock: d && [...d.lock.values()], cd: d&&d.cooldown, hx: Math.round(s.boy.x), hp: s.boy.hp, shots: s.enemyShots.getChildren().length, ev: s.s6world.events.slice(-2).map(e=>e.kind), hz: window.__hz }`))); await page.waitForTimeout(500); if (i==8) await page.screenshot({path: OUT+'/E-drone.png'}) }
await b.close()
