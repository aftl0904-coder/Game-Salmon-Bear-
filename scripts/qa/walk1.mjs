import { chromium } from 'playwright'
const [, , cast = 'boy', stageArg = '1'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'easy'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(([c, st]) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', +st); g.registry.set('difficulty', 'easy'); g.registry.set('playMode', 'solo'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, [cast, stageArg])
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.enemies.getChildren().forEach((e) => e.disableBody?.(true, true)) })
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; h.hp = 6; return { x: Math.round(h.x), y: Math.round(h.y), vy: Math.round(h.body.velocity.y), sc: window.__SAKE_GAME__.scene.getScenes(true).map((x) => x.scene.key).join(','), alive: h.alive } })
const out = []
const pts = JSON.parse(process.env.PTS)
for (const [x0, label] of pts) {
  await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; h.x = x; h.y = 150; h.body.setVelocity(0, 0) }, x0)
  await page.waitForTimeout(700)
  let s = await st()
  if (s.sc.includes('minigame')) { await page.keyboard.press('f'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); s = await st() }
  const a = await st()
  await page.keyboard.down('d'); const tr = []
  for (let i = 0; i < +(process.env.N ?? 12); i++) { await page.waitForTimeout(150); const c = await st(); tr.push(c.x) }
  await page.keyboard.up('d'); const e = await st()
  const adv = e.x - a.x
  // stall = x same over last 6 samples
  const stalled = Math.abs(tr[tr.length-1] - tr[Math.max(0,tr.length-7)]) < 3
  out.push({ label, from: a.x, y0: a.y, to: e.x, adv, stalled, yEnd: e.y, alive: e.alive })
}
console.log(JSON.stringify({ cast, out, errs }))
await b.close()
