// Hero dropped on the floor *inside* a stone (what the old pit respawn did next to the 泥鬃 step): old build keeps him there, fixed build lifts him onto the top.
import { chromium } from 'playwright'
const URL = process.env.URL, X = +process.env.X, LABEL = process.env.LABEL
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(4500)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.storyIntro?.destroy(); s.storyIntro = null; s.started = true; s.startedAt = s.time.now; s.pauseReadyAt = s.time.now + 1200; if (s.scene.get('UIScene')) s.scene.setVisible(true, 'UIScene') })
await page.waitForTimeout(300)
await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = x; s.boy.y = 285 }, X)
const out = []
for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); out.push(await page.evaluate(() => { const h = window.__SAKE_GAME__.scene.getScene('play').boy; return [Math.round(h.x), +h.y.toFixed(1)] })) }
console.log(LABEL, JSON.stringify(out))
await b.close()
