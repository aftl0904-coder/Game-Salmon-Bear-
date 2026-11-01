import { chromium } from 'playwright'
const OUT = '/tmp/res2x-on58/docs/qa-gear'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
const gear = { boy: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }, girl: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 } }
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
for (const cast of ['girl', 'boy']) {
  await page.evaluate((c) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 2); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, cast)
  await page.waitForTimeout(3000)
  for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
  const w = cast === 'girl' ? 'sword' : 'gun'
  const crops = []
  for (const tier of [0, 1, 2, 3]) {
    await page.evaluate(([c, w, t]) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const g = { heart: 0, sword: 0, gun: 0, armour: t, boots: 0, charm: 0 }; g[w] = t; const all = { boy: g, girl: g }; localStorage.setItem('sake-kuma-gear-v1', JSON.stringify(all)); s.gearFx.forEach((f) => f.refresh()) }, [cast, w, tier])
    await page.waitForTimeout(900)
    const pos = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const c = s.cameras.main; return { x: (s.boy.x - c.scrollX) * 2, y: (s.boy.y - c.scrollY) * 2 } })
    await page.screenshot({ path: `${OUT}/${cast}-t${tier}.png`, clip: { x: Math.max(0, pos.x - 90), y: Math.max(0, pos.y - 190), width: 180, height: 210 } })
  }
}
await b.close()
