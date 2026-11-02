import { chromium } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47612/'
const OUT = process.env.OUT || '/tmp/fix4/docs/qa-s4fix'
fs.mkdirSync(OUT, { recursive: true })
const START_X = +(process.env.START_X || 3250)
const LABEL = process.env.LABEL || 'repro'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto(URL); await page.waitForTimeout(4500)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
const press = async (k, h = 60) => { await page.keyboard.down(k); await page.waitForTimeout(h); await page.keyboard.up(k) }
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.storyIntro?.destroy(); s.storyIntro = null; s.started = true; s.startedAt = s.time.now; s.pauseReadyAt = s.time.now + 1200; if (s.scene.get('UIScene')) s.scene.setVisible(true, 'UIScene') })
await page.waitForTimeout(500)
await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.girl ?? s.boy; s.__h = h; h.x = x; h.y = 285; h.hp = h.maxHp = 99 }, 3262)
for (let i = 0; i < 80; i++) {
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); if (s.coffeeStall) {} })
  const o = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { q: !!s.queen, intro: !!s.storyIntro } })
  if (o.q && !o.intro) break
  await page.keyboard.press('f'); await page.waitForTimeout(400)
}
await page.waitForTimeout(300)
await page.evaluate(([x, y]) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.__h; h.x = x; h.y = y }, [START_X, +(process.env.START_Y||261)])
await page.waitForTimeout(500)
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.__h; const q = s.queen; return { px: +h.x.toFixed(1), py: +h.y.toFixed(1), hp: h.hp, jumping: !!h.laneJumping, bf: !!s.bossFight, qx: q ? +q.x.toFixed(1) : null, act: q?.act ?? null, floor: s.floorY ? s.floorY() : null } })

const trace = []
const t0 = Date.now()
let jumped = 0, lastJump = -9
while (Date.now() - t0 < 14000) {
  const s = await st(); s.t = (Date.now() - t0) / 1000; trace.push(s)
  if (s.bf && s.act === 'charge' && s.qx !== null) {
    const gap = s.qx - s.px
    const dir = process.env.DIR === 'right' ? -1 : 1
    if (gap > 0 && gap < +(process.env.GAP||150) && s.t - lastJump > 1.2 && !s.jumping) { lastJump = s.t; jumped++; await page.keyboard.down(process.env.JK||'d'); await page.keyboard.down('g'); await page.waitForTimeout(300); await page.keyboard.up('g'); await page.waitForTimeout(+(process.env.AIR||450)); await page.keyboard.up(process.env.JK||'d') }
  }
  await page.waitForTimeout(40)
}
await page.screenshot({ path: `${OUT}/${LABEL}.png` })
fs.writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ errs, jumped, trace }, null, 0))
const mn = (k) => Math.min(...trace.map((t) => t[k])), mx = (k) => Math.max(...trace.map((t) => t[k]))
console.log(JSON.stringify({ jumped, pyMin: mn('py'), pyMax: mx('py'), minHp: mn('hp'), errs, n: trace.length }))
console.log(trace.filter((_, i) => i % +(process.env.EVERY||1) === 0 && i>+(process.env.FROM||0) && i<+(process.env.TO||999)).map((t) => `${t.t.toFixed(1)} p=${t.px},${t.py} hp${t.hp} q=${t.qx} ${t.act}${t.jumping ? ' J' : ''}`).join('\n'))
await b.close()
