import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const { b, page, errs } = await boot({ mode: '1p' })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const log = []
const say = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)) }
const god = 'for (const h of [s.boy, s.girl]) if (h) { h.hp = 6; h.graceUntil = s.time.now + 900000 }'
const tp = (x) => run(`s.coffeeDone = true; s.physics.resume(); for (const h of [s.boy, s.girl]) if (h) { h.x = a; h.y = 300; h.hp = 6; h.graceUntil = s.time.now + 900000; h.setVelocity(0,0) } s.cameras.main.centerOn(a + 120, 180)`, x)

// ── A ──
await tp(300); await page.waitForTimeout(2500)
await tp(560); await page.waitForTimeout(3500)
say('A.enemies', await run(`return s.enemies.getChildren().filter(e=>e.active).map(e=>e.species+'@'+Math.round(e.x))`))
say('A.guardClassCount', await run(`return s.enemies.getChildren().filter(e=>e.species==='guard').length`))
say('A.honeyJars', await run(`return s.honeyPickups.getChildren().filter(j=>j.active).map(j=>Math.round(j.x))`))
await page.screenshot({ path: `${OUT}/A3-guards.png` })
// collect jar
await run(`const j = s.honeyPickups.getChildren()[0]; s.boy.x = j.x; s.boy.y = j.y + 10`)
await page.waitForTimeout(1200)
say('A.honeyGot', await run(`return s.honeyGot`))

// ── B: pit-hop by chasers ──
await run(`s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }`)
for (const pit of [{ x: 1150, w: 56 }, { x: 1560, w: 64 }, { x: 1880, w: 52 }]) {
  const ex = pit.x - 50, hx = pit.x + pit.w + 120
  await run(`s.s2Pending = []; s.coffeeDone = true; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }
    for (const h of [s.boy, s.girl]) if (h) { h.x = a.hx; h.y = 300; h.hp = 6; h.graceUntil = s.time.now + 900000; h.setVelocity(0,0) }
    s.cameras.main.centerOn(a.hx - 100, 180)
    window.__e = s.mkEnemy(a.ex, 428, 'chaser')`, { ex, hx })
  const t0 = Date.now(); let crossed = null; const tr = []
  while (Date.now() - t0 < 14000) {
    const r = await run(`const e = window.__e; return e.active ? { x: Math.round(e.x), y: Math.round(e.y), fsm: e.fsm, lp: !!e.getData('leaping') } : null`)
    if (!r) { tr.push('gone'); break }
    tr.push(r.x + ':' + r.fsm + (r.lp ? ':L' : ''))
    if (r.x > pit.x + pit.w && !crossed) { crossed = Date.now() - t0; break }
    await page.waitForTimeout(300)
  }
  say(`B.pit${pit.x}`, { crossedMs: crossed, tail: tr.slice(-3) })
}

// ── B: robot arms ──
await run(`s.s2Pending = s.s2Pending.filter(p=>false); for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }`)
// re-seed the pending list for the arm only, then walk in
await run(`s.s2Pending.push({ x: 1280, species: 'robotarm', unlockX: 920 })`)
await tp(1000); await page.waitForTimeout(2500)
say('B.arm.spawned', await run(`return s.enemies.getChildren().filter(e=>e.species==='robotarm').map(e=>({x:Math.round(e.x),y:Math.round(e.y),active:e.active}))`))
await run(`window.__shots = []; const orig = s.throwKnife.bind(s); s.throwKnife = (x, feet, dir, high, ...r) => { window.__shots.push({ t: Math.round(s.time.now), x: Math.round(x), dir, high }); return orig(x, feet, dir, high, ...r) }`)
await tp(1000)
await page.waitForTimeout(9000)
say('B.arm.shots', await run(`return window.__shots`))
say('B.arm.stayedPut', await run(`return s.enemies.getChildren().filter(e=>e.species==='robotarm').map(e=>Math.round(e.x))`))
await page.screenshot({ path: `${OUT}/B3-arm-fire.png` })
say('errs', errs)
fs.writeFileSync(`${OUT}/seg_ab.log.json`, JSON.stringify(log, null, 1))
await b.close()
