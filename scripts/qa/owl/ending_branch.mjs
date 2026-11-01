import { chromium } from 'playwright'
const ids = process.argv[2] === 'all' ? ['huihui','guard','denim','brownie','snowcat','shiba','ginger','fleecy','gnome','tigercub','kuro'] : process.argv[2] === 'ten' ? ['huihui','guard','denim','brownie','snowcat','shiba','ginger','fleecy','gnome','tigercub'] : []
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(([f]) => { localStorage.setItem('sake-kuma-friends-v1', JSON.stringify(f)); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) }, [ids])
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 5); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3000)
for (let i = 0; i < 8; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
console.log('perfectEnding():', await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').perfectEnding()))
await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').playOutro())
await page.waitForTimeout(9000)
await page.screenshot({ path: `/opt/cursor/artifacts/owl/ending-${process.argv[2]}.png` })
console.log(errs)
await b.close()
