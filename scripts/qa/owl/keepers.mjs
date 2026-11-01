import { chromium } from 'playwright'
const OUT = '/tmp/res2x-on58/docs/qa-keepers'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
for (const st of [1, 2, 3, 4, 5]) {
  await page.evaluate((n) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', n); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, st)
  await page.waitForTimeout(3000)
  for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
  const info = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const x = s.checkpointXs[0]; for (const h of [s.boy, s.girl]) if (h) { h.x = x - 60; h.y = 200 } s.cameras.main.scrollX = x - 280; return { x, tex: s.checkpointMamas[0]?.texture.key, w: s.checkpointMamas[0]?.displayWidth, h: s.checkpointMamas[0]?.displayHeight } })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/stage${st}-before.png` })
  await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = x + 4 } }, info.x)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/stage${st}-reached.png` })
  console.log(st, JSON.stringify(info))
}
console.log('errors', errs)
await b.close()
