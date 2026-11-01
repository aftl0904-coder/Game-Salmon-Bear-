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
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.enemies.getChildren().forEach((e) => e.disableBody?.(true, true)) })
res.scenePlay = await scenes()
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { bx: Math.round(s.boy.x), by: Math.round(s.boy.y), bvy: Math.round(s.boy.body.velocity.y), bw: s.boy.getData('wmode') ?? 'normal', gx: Math.round(s.girl.x), gvy: Math.round(s.girl.body.velocity.y), gw: s.girl.getData('wmode') ?? 'normal', shots: s.shots?.countActive?.() ?? null, sp: s.specialCharges, bcd: s.boy.atkCd, gcd: s.girl.atkCd, crouchB: s.boy.crouching, crouchG: s.girl.crouching } })
// P1 only connected: boy moves with pad0, girl must not
let a = await st()
await page.evaluate(() => window.__set(0, 15, 1)); await page.waitForTimeout(800); let c = await st(); await page.evaluate(() => window.__set(0, 15, 0))
res.p1_dpadRight = { dBoyX: c.bx - a.bx, dGirlX: c.gx - a.gx }
a = await st(); await page.evaluate(() => window.__axis(0, 0, -1)); await page.waitForTimeout(700); c = await st(); await page.evaluate(() => window.__axis(0, 0, 0))
res.p1_stickLeft = { dBoyX: c.bx - a.bx, dGirlX: c.gx - a.gx }
// jump
await page.evaluate(() => window.__set(0, 0, 1)); let maxUp = 0; for (let i = 0; i < 12; i++) { await page.waitForTimeout(60); const x = await st(); maxUp = Math.min(maxUp, x.bvy) } await page.evaluate(() => window.__set(0, 0, 0)); await page.waitForTimeout(800)
res.p1_A_jump_minVy = maxUp
// attack B and X
for (const [i, n] of [[1, 'B'], [2, 'X']]) { await page.waitForTimeout(700); const before = await st(); await page.evaluate((i) => window.__set(0, i, 1), i); await page.waitForTimeout(100); const mid = await st(); await page.evaluate((i) => window.__set(0, i, 0), i); res['p1_attack_' + n] = { cdBefore: before.bcd, cdAfter: mid.bcd, girlCd: mid.gcd } }
// special Y with charge
await page.evaluate(() => { window.__SAKE_GAME__.scene.getScene('play').specialCharges = 1 }); a = await st(); await pad(0, 3); c = await st(); res.p1_Y_special = { before: a.sp, after: c.sp }
// weapon switch LT(6)
a = await st(); await pad(0, 6); c = await st(); res.p1_LT_switch = { boy: [a.bw, c.bw], girl: [a.gw, c.gw] }
// crouch via dpad down
a = await st(); await page.evaluate(() => window.__set(0, 13, 1)); await page.waitForTimeout(400); c = await st(); await page.evaluate(() => window.__set(0, 13, 0)); res.p1_down_crouch = c.crouchB
// Now connect P2 pad (second pad)
await page.evaluate(() => { window.__padsOn = [true, true] }); await page.waitForTimeout(300)
a = await st(); await page.evaluate(() => window.__set(1, 15, 1)); await page.waitForTimeout(800); c = await st(); await page.evaluate(() => window.__set(1, 15, 0)); res.p2_dpadRight = { dBoyX: c.bx - a.bx, dGirlX: c.gx - a.gx }
a = await st(); await page.evaluate(() => window.__axis(1, 0, -1)); await page.waitForTimeout(700); c = await st(); await page.evaluate(() => window.__axis(1, 0, 0)); res.p2_stickLeft = { dBoyX: c.bx - a.bx, dGirlX: c.gx - a.gx }
await page.evaluate(() => window.__set(1, 0, 1)); maxUp = 0; for (let i = 0; i < 12; i++) { await page.waitForTimeout(60); const x = await st(); maxUp = Math.min(maxUp, x.gvy) } await page.evaluate(() => window.__set(1, 0, 0)); await page.waitForTimeout(800)
res.p2_A_jump_minVy = maxUp
for (const [i, n] of [[1, 'B'], [2, 'X']]) { await page.waitForTimeout(800); const before = await st(); await page.evaluate((i) => window.__set(1, i, 1), i); await page.waitForTimeout(100); const mid = await st(); await page.evaluate((i) => window.__set(1, i, 0), i); res['p2_attack_' + n] = { gcdBefore: before.gcd, gcdAfter: mid.gcd, boyCd: mid.bcd } }
await page.evaluate(() => { window.__SAKE_GAME__.scene.getScene('play').specialCharges = 1 }); a = await st(); await pad(1, 3); c = await st(); res.p2_Y_special = { before: a.sp, after: c.sp }
a = await st(); await pad(1, 6); c = await st(); res.p2_LT_switch = { boy: [a.bw, c.bw], girl: [a.gw, c.gw] }
// both simultaneously: P1 right + P2 left + both jump
a = await st(); await page.evaluate(() => { window.__set(0, 15, 1); window.__set(1, 14, 1); window.__set(0, 0, 1); window.__set(1, 0, 1) }); let vyb = 0, vyg = 0; for (let i = 0; i < 10; i++) { await page.waitForTimeout(60); const x = await st(); vyb = Math.min(vyb, x.bvy); vyg = Math.min(vyg, x.gvy) } await page.waitForTimeout(500); c = await st(); await page.evaluate(() => { for (const [p, i] of [[0, 15], [1, 14], [0, 0], [1, 0]]) window.__set(p, i, 0) })
res.simul = { dBoyX: c.bx - a.bx, dGirlX: c.gx - a.gx, vyb, vyg }
// pause via Start
await page.waitForTimeout(500); await pad(0, 9); await page.waitForTimeout(500); res.pause_start = await scenes(); await page.screenshot({ path: `${OUT}/pause.png` })
await pad(0, 9); await page.waitForTimeout(500); res.pause_start_again = await scenes()
// disconnect P1 pad while holding right -> must stop
await page.evaluate(() => window.__set(0, 15, 1)); await page.waitForTimeout(300); await page.evaluate(() => { window.__padsOn = [false, false] }); await page.waitForTimeout(200); a = await st(); await page.waitForTimeout(700); c = await st(); res.disconnect_hold_stops = { dBoyX: c.bx - a.bx }
res.errs = errs.slice(0, 5)
fs.writeFileSync(`${OUT}/res.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res))
await b.close()
