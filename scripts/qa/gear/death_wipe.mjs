import { chromium } from 'playwright'
const OUT = '/tmp/res2x-on58/docs/qa-gear'
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-gear-v1', JSON.stringify({ boy: { heart: 2, sword: 0, gun: 3, armour: 3, boots: 1, charm: 0 }, girl: { heart: 3, sword: 3, gun: 0, armour: 2, boots: 3, charm: 2 } })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
const start = async (cast) => {
  await page.evaluate((c) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 2); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, cast)
  await page.waitForTimeout(3000)
  for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
}
await start('girl')
const info = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; return { role: h.role, hp: h.hp, fx: s.gearFx.length } })
console.log('girl start', info)
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/girl-gear.png` })
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.knockOut(s.boy) })
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/death-float.png` })
console.log('gear after death', await page.evaluate(() => localStorage.getItem('sake-kuma-gear-v1')))
console.log('errors', errs)
await b.close()
