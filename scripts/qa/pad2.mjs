import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/opt/cursor/artifacts/pad'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 }))
  const mk = (i) => ({ index: i, id: 'Mock Xbox Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) })
  window.__pads = [mk(0), mk(1)]; window.__padsOn = [false, false]
  navigator.getGamepads = () => [window.__padsOn[0] ? window.__pads[0] : null, window.__padsOn[1] ? window.__pads[1] : null, null, null]
  window.__set = (p, i, v) => { window.__pads[p].buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 } }
  window.__axis = (p, a, v) => { window.__pads[p].axes[a] = v }
})
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
const res = {}
const scenes = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key).join(','))
const pad = (p, i, ms = 120) => page.evaluate(([p, i]) => window.__set(p, i, 1), [p, i]).then(() => page.waitForTimeout(ms)).then(() => page.evaluate(([p, i]) => window.__set(p, i, 0), [p, i])).then(() => page.waitForTimeout(150))
await page.evaluate(() => { window.__padsOn = [true, false] })
res.titleScene = await scenes()
await pad(0, 9); await page.waitForTimeout(1200); res.afterStart1 = await scenes()
await pad(0, 0); await page.waitForTimeout(1200); res.afterA1 = await scenes()
await page.screenshot({ path: `${OUT}/menu-after-pad.png` })
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 1); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '2p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
for (let i = 0; i < 12; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(500) }
res.introCleared = !(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro)); res.scenesAfterIntro = await page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key).join(','))
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); 0 })
res.scenePlay = await scenes()
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { bx: Math.round(s.boy.x), by: Math.round(s.boy.y), bvy: Math.round(s.boy.body.velocity.y), bw: s.boy.getData('wmode') ?? 'normal', gx: Math.round(s.girl.x), gvy: Math.round(s.girl.body.velocity.y), gw: s.girl.getData('wmode') ?? 'normal', shots: s.shots?.countActive?.() ?? null, sp: s.specialCharges, bcd: s.boy.atkCd, gcd: s.girl.atkCd, crouchB: s.boy.crouching, crouchG: s.girl.crouching } })

await page.evaluate(() => { window.__padsOn = [true, true] }); await page.waitForTimeout(300)
const info = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().filter((o) => o.active && o.fsm !== 'DEAD'); if (e[0]) { s.girl.x = e[0].x - 150; s.boy.x = e[0].x - 200 } s.specialCharges = 1; return { enemies: e.length } })
await page.waitForTimeout(400)
const sp0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').specialCharges)
await pad(1, 3); const sp1 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').specialCharges)
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/p2-special.png` })
await page.evaluate(() => { window.__SAKE_GAME__.scene.getScene('play').specialCharges = 1 }); await page.waitForTimeout(1500)
await pad(0, 3); const sp2 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').specialCharges)
console.log(JSON.stringify({ info, p2: [sp0, sp1], p1: [1, sp2], errs }))
await b.close()
