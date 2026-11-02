import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto('http://127.0.0.1:47411/'); await page.waitForTimeout(5000)
for (const st of [1, 5]) {
  await page.evaluate((st) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, st)
  await page.waitForTimeout(4000)
  console.log(st, JSON.stringify(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { mall: s.mall, tower: s.tower, enemies: s.enemies.getChildren().length, pend: s.s2Pending.length, s6: !!s.s6world } })))
}
// stage-5 clear card
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.ended = true; s.win() })
await page.waitForTimeout(3000)
console.log(JSON.stringify(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o => o.type === 'Text' && o.text).map(o => o.text).slice(-12))))
await page.screenshot({ path: '/tmp/c2s1/docs/qa-c2s1/R-stage5-clear.png' })
console.log(errs)
await b.close()
