import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/tmp/res2x-on58/docs/qa-claw'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.removeItem('sake-kuma-mg-seen-v1') })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
const active = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key))
const press = async (k, h = 60) => { await page.keyboard.down(k); await page.waitForTimeout(h); await page.keyboard.up(k) }
const dbg = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('claw'); return s.mini ? s.mini.debug() : null })
await page.evaluate(() => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('carryCoins', 5); g.scene.start('claw', { to: 3 }) })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-tutorial.png` })
await press('Space'); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/02-tutorial2.png` }); await press('Space'); await page.evaluate(() => { window.__carry = []; window.__SAKE_GAME__.registry.events.on('changedata-carryCoins', (_p, v) => window.__carry.push(v)) })
await page.waitForTimeout(1200)
let d = await dbg(); console.log('game started', JSON.stringify(d && { state: d.state, left: Math.round(d.left), n: d.belt.length }))
await page.screenshot({ path: `${OUT}/03-game.png` })
// keyboard move: hold ArrowRight 600ms
const x0 = (await dbg()).clawX; await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight'); const x1 = (await dbg()).clawX
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft'); const x2 = (await dbg()).clawX
console.log('move right', Math.round(x0), '->', Math.round(x1), 'then left ->', Math.round(x2))
// a deliberate miss: aim at empty belt gap
const aim = async (pick) => {
  for (let tries = 0; tries < 40; tries++) {
    const s = await dbg(); if (s.state !== 'idle') { await page.waitForTimeout(100); continue }
    const t = pick(s.belt); if (!t) { await page.waitForTimeout(100); continue }
    const lead = t.x + t.vx * 0.43
    await page.evaluate((x) => window.__SAKE_GAME__.scene.getScene('claw').mini.setClawX(x), lead)
    await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space')
    return t
  }
}
const before = (await dbg()).res
const t1 = await aim((belt) => belt.find((p) => p.kind === 'lobster' || p.kind === 'shrimp') ?? belt[0])
await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/04-down.png` })
await page.waitForTimeout(1300)
let a = (await dbg()); console.log('aimed at', t1.kind, '=> res', JSON.stringify(a.res), 'state', a.state)
await page.screenshot({ path: `${OUT}/05-after-catch.png` })
// miss: choose x with no item within 40px
for (let tries = 0; tries < 30; tries++) { const s = await dbg(); if (s.state !== 'idle') { await page.waitForTimeout(100); continue }
  let x = null; for (let c = 100; c < 540; c += 10) if (s.belt.every((p) => Math.abs(p.x + p.vx * 0.43 - c) > 45)) { x = c; break }
  if (x === null) { await page.waitForTimeout(150); continue }
  await page.evaluate((x) => window.__SAKE_GAME__.scene.getScene('claw').mini.setClawX(x), x); await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); break }
await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/06-miss.png` }); await page.waitForTimeout(900)
a = await dbg(); console.log('after miss', JSON.stringify(a.res))
// mash: spam the drop key + random aim for the rest of the time; hold Space to confirm no double drops while busy
const t0 = Date.now(); let n = 0; let shot = false
while (Date.now() - t0 < 40000) {
  const leaving = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('claw')?.leaving)
  if (leaving && !shot) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/07-result.png` }); shot = true; break }
  const s = await dbg(); if (!s) { await page.waitForTimeout(100); continue }
  if (s.state === 'idle') { const p = s.belt[n % s.belt.length]; await page.evaluate((x) => window.__SAKE_GAME__.scene.getScene('claw').mini?.setClawX(x), p.x + p.vx * 0.43); await page.keyboard.down('Space'); await page.waitForTimeout(30); await page.keyboard.up('Space'); n++ } else await page.keyboard.press('Space')
  await page.waitForTimeout(120)
}
const final = await page.evaluate(() => ({ carry: window.__carry, res: window.__SAKE_GAME__.scene.getScene('claw').mini.debug().res }))
console.log('result card shot', shot, 'final', JSON.stringify(final))
await page.waitForTimeout(3600)
console.log('scenes later', (await active()).join(','), 'stageNo', await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo')))
console.log('errors', errs); await b.close()
