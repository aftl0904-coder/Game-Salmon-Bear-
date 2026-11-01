import { chromium } from 'playwright'
const [, , hx = '1060', tele = '1', secs = '10'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'easy'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(() => { window.__ST = +(window.__ST0 ?? 1); const g = window.__SAKE_GAME__; g.registry.set('stageNo', +(window.__ST ?? 1)); g.registry.set('difficulty', 'easy'); g.registry.set('playMode', 'solo'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = +x; s.boy.y = 200; s.boy.facing = 1 }, hx)
const snap = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.hp = 6; return { h: [Math.round(s.boy.x), Math.round(s.boy.y)], sc: window.__SAKE_GAME__.scene.getScenes(true).map((x) => x.scene.key).join(','), en: s.enemies.getChildren().filter((e) => e.active).map((e) => [e.species, Math.round(e.x), Math.round(e.y), Math.round(e.body.velocity.x), e.fsm]).filter((e) => Math.abs(e[1] - s.boy.x) < 700) } })
console.log(JSON.stringify(await page.evaluate(() => { const t = window.__SAKE_TERRAIN__; return t.terrainSolids().filter((s) => s.x1 > 900 && s.x0 < 1200).map((s) => [s.kind, s.x0, s.x1, s.top]) })))
for (let i = 0; i < +secs; i++) { const s = await snap(); if (s.sc.includes('minigame')) { await page.keyboard.press('f'); await page.keyboard.press('Enter') } console.log(i, JSON.stringify(s)); await page.waitForTimeout(1000) }
await page.screenshot({ path: '/opt/cursor/artifacts/enemy1.png' })
await b.close()
