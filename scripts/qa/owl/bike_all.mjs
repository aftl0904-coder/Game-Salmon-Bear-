import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })))
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
const act = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key).join(','))
for (const [from, to] of [[1, 2], [2, 3], [3, 4], [4, 5]]) {
  await page.evaluate(([f, t]) => { const g = window.__SAKE_GAME__; g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('carryCoins', 5); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('worldmap', { from: f, to: t, next: 'bike', stageNo: t, pick: true }) }, [from, to])
  await page.waitForTimeout(2000); await page.keyboard.press('Enter')
  let a = ''
  for (let i = 0; i < 40; i++) { a = await act(); if (a.includes('bike')) break; await page.waitForTimeout(500) }
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('bike'); return s ? { toStage: s.toStage, dest: s.destName(), song: window.__SAKE_GAME__.registry.get('stageNo') } : null })
  await page.screenshot({ path: `/opt/cursor/artifacts/owl/bike-${from}-${to}.png` })
  await page.keyboard.press('Enter')
  let a2 = ''
  for (let i = 0; i < 30; i++) { a2 = await act(); if (a2.includes('play')) break; await page.waitForTimeout(500) }
  const sn = await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo'))
  console.log(from, '->', to, a, JSON.stringify(info), 'then', a2, 'stageNo', sn)
}
console.log(errs)
await b.close()
