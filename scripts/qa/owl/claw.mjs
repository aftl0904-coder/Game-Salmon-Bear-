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
// 1) routing: 2->3 goes to claw, 1->2 goes to bike
for (const [from, to, want] of [[2, 3, 'claw'], [1, 2, 'bike'], [3, 4, 'bike']]) {
  await page.evaluate(([from, to]) => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('leavingToMenu', false); g.scene.start('worldmap', { from, to, next: 'bike', stageNo: to }) }, [from, to])
  let seen = []
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); seen = await active(); if (seen.includes('claw') || seen.includes('bike')) break; await press('Enter') }
  console.log(`route ${from}->${to}:`, seen.join(','), seen.includes(want) ? 'PASS' : 'FAIL')
}
// 2) the game
await page.evaluate(() => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('carryCoins', 5); g.scene.start('claw', { to: 3 }) })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-tutorial.png` })
await press('Enter'); await page.waitForTimeout(300) // skip would end; use space to advance instead
console.log('after Enter:', (await active()).join(','))
