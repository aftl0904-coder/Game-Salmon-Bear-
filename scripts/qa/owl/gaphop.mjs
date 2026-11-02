import { chromium } from 'playwright'
import fs from 'fs'
const stage = +(process.env.STAGE || 1); const TAG = process.env.TAG || 'run'
const lvl = JSON.parse(fs.readFileSync(`/tmp/res2x-on58/data/levels/stage${stage}.json`, 'utf8'))
const only = process.env.PIT ? process.env.PIT.split(',').map(Number) : null
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate((st) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, stage)
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
const out = []
for (const pit of lvl.pits) {
  if (only && !only.includes(pit.x)) continue
  const ex = pit.x - (+process.env.EOFF || 50), hx = pit.x + pit.w + 120
  await page.evaluate(({ ex, hx }) => {
    const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; s.coffeeDone = true; s.physics.resume()
    for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }
    for (const h of [s.boy, s.girl]) if (h) { h.x = hx; h.y = 300; h.hp = 6; h.graceUntil = s.time.now + 900000; h.setVelocity(0, 0) }
    const e = s.mkEnemy(ex, 428, 'chaser'); window.__e = e
  }, { ex, hx })
  const tr = []; const t0 = Date.now(); let crossed = null
  while (Date.now() - t0 < 12000) {
    const r = await page.evaluate(() => { const e = window.__e; return e.active ? { x: Math.round(e.x), y: Math.round(e.y), fsm: e.fsm, lp: !!e.getData('leaping'), hp: e.hp, hx: Math.round(window.__SAKE_GAME__.scene.getScene('play').boy.x) } : null })
    if (!r) { tr.push('gone'); break }
    tr.push(r.x + '[h' + r.hx + ']:' + r.fsm + (r.lp ? ':L' : ''))
    if (r.x > pit.x + pit.w && !crossed) { crossed = Date.now() - t0; break }
    await page.waitForTimeout(250)
  }
  const last = tr.slice(-2).join(' ')
  out.push({ pit: `${pit.x}+${pit.w}`, crossedMs: crossed, last, y: await page.evaluate(() => window.__e.active ? Math.round(window.__e.y) : null) })
  console.log(JSON.stringify(out[out.length - 1]))
}
console.log('errors', errs); await b.close()
