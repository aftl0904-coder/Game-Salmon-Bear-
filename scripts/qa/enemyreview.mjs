import { chromium } from 'playwright'
import fs from 'fs'
const stage = +process.argv[2]
const lvl = JSON.parse(fs.readFileSync(`/tmp/res2x-on58/data/levels/stage${stage}.json`, 'utf8'))
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate((st) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', 'solo'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, stage)
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
const worldW = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').physics.world.bounds.width)
const snap = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.hp = 6; return { hx: s.boy.x, sc: window.__SAKE_GAME__.scene.getScenes(true).map((x) => x.scene.key).join(','), en: s.enemies.getChildren().filter((e) => e.active && e.visible !== false).map((e) => { if (!e.__uid) e.__uid = Math.random().toString(36).slice(2, 7); return { id: e.__uid, sp: e.species ?? e.texture?.key, kind: e.kind, cls: e.constructor.name, x: e.x, y: e.y, vx: e.body?.velocity?.x ?? 0, fsm: e.fsm, st: e.state, flying: !!e.flying, home: e.homeX, boss: !!e.boss } }) } })
const stats = {}
for (let x = 300; x < Math.min(worldW - 200, 4000); x += 260) {
  await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = x; s.boy.y = 150; s.boy.body.setVelocity(0, 0) }, x)
  await page.waitForTimeout(600)
  let a = await snap(); if (a.sc.includes('minigame')) { await page.keyboard.press('f'); await page.keyboard.press('Enter'); await page.waitForTimeout(400); a = await snap() }
  // hold position: keep hero stationary 4s, sample each second
  const ser = {}
  for (let i = 0; i < 5; i++) { const c = await snap(); for (const e of c.en) (ser[e.id] ??= { e, pts: [] }).pts.push([i, e.x, e.y, e.vx, e.fsm, e.st, c.hx]); await page.waitForTimeout(900) }
  for (const [id, v] of Object.entries(ser)) {
    const p = v.pts; if (p.length < 4) continue
    const near = Math.abs(p[0][1] - p[0][6]) < 420
    if (!near) continue
    const disp = Math.abs(p[p.length - 1][1] - p[0][1]); const maxV = Math.max(...p.map((q) => Math.abs(q[3])))
    const key = `${v.e.cls}/${v.e.sp}/${v.e.kind}${v.e.flying ? '/fly' : ''}`
    const s = (stats[key] ??= { n: 0, still: 0, maxV: 0, samples: [] })
    s.n++; if (disp < 8 && maxV < 5) s.still++; s.maxV = Math.max(s.maxV, maxV)
    if (disp < 8 && maxV < 5 && s.samples.length < 4) s.samples.push({ x: Math.round(p[0][1]), hx: Math.round(p[0][6]), fsm: p[0][4], st: p[0][5] })
  }
}
console.log(JSON.stringify({ stage, stats }))
await b.close()
