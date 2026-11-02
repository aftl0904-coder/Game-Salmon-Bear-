import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/tmp/res2x-on58/docs/qa-combo'; fs.mkdirSync(OUT, { recursive: true })
const cast = process.env.CAST || 'boy'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate((c) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 1); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, cast)
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
const ev = (f, a) => page.evaluate(f, a)
const log = (k, v) => console.log(k, JSON.stringify(v))
const setup = (hp = 60, mode = 'fall') => ev(({ hp, mode }) => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; s.coffeeDone = true; s.physics.resume()
  for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }
  const h = s.boy; h.x = 400; h.y = 285; h.hp = 6; h.grace = 0; h.hurtCd = 0; h.hurtLock = 0; h.facing = 1; h.setVelocity(0, 0); h.stompBoosted = true; h.stompAt = -9999; h.lastJumpPressAt = -9999
  h.setData('stompSafeUntil', 0); h.laneJumping = false
  const e = s.mkEnemy(mode === 'none' ? 900 : 400, 428, 'blocker'); e.hp = e.maxHp = hp; e.setData('spdMul', 0.01); window.__e = e
  window.__trk = { minY: 999, stompY: null, stomps: 0, peakAfter: null, hpDuring: [] }
  if (s.__stompHook) s.events.off('update', s.__stompHook)
  s.__stompHook = () => { const t = window.__trk; if (h.stompAt > 0 && t.stompY === null) { t.stompY = h.y; t.stomps++ } if (t.stompY !== null) t.minY = Math.min(t.minY, h.y); t.hpDuring.push(h.hp) }
  s.events.on('update', s.__stompHook)
  if (mode === 'fall') { h.y = 160; h.laneJumping = true; const b = h.body; b.allowGravity = true; h.setVelocityY(120) }
}, { hp, mode })
const state = () => ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; const e = window.__e; return { heroY: Math.round(h.y), vy: Math.round(h.body.velocity.y), hp: h.hp, enemyHp: e.active ? e.hp : 'dead', stompY: window.__trk.stompY && Math.round(window.__trk.stompY), minY: Math.round(window.__trk.minY), boosted: h.stompBoosted, safe: h.getData('stompSafeUntil') > s.time.now } })

// 1. normal stomp
await setup(); await page.waitForTimeout(2500); const n1 = await state(); log('1.normal_stomp', n1)
const normalApex = n1.stompY - n1.minY
// 2. super bounce via jump pressed ~before landing (real key via synthetic event in update hook)
await setup(); await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; const e = window.__e; let fired = false
  const fn = () => { if (fired) return; const top = e.body.top; if (h.body.velocity.y > 40 && top - h.y < 22) { fired = true; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', keyCode: 71, which: 71, bubbles: true })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', code: 'KeyG', keyCode: 71, which: 71, bubbles: true })), 90) } }
  s.events.on('update', fn) })
await page.waitForTimeout(2500); const n2 = await state(); log('2.super_pre_press', n2)
const superApex = n2.stompY - n2.minY
// 3. normal ground jump apex (real G)
await setup(60, 'none'); await page.waitForTimeout(600)
const jy = await ev(async () => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; let minY = 999; const fn = () => { minY = Math.min(minY, h.y) }; s.events.on('update', fn); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', keyCode: 71, which: 71, bubbles: true })); await new Promise((r) => setTimeout(r, 700)); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', code: 'KeyG', keyCode: 71, which: 71, bubbles: true })); await new Promise((r) => setTimeout(r, 1200)); s.events.off('update', fn); return { start: 285, minY: Math.round(minY), apex: Math.round(285 - minY) } })
log('3.ground_jump', jy)
log('apex_px', { normalJump: jy.apex, stomp: normalApex, superStomp: superApex })
// 4. defeat weak enemy by stomp (hp 2 -> 2 dmg)
await setup(2); await page.waitForTimeout(2500); log('4.kill_weak', await state())
// 5. no contact damage on landing: hero hp unchanged during test 1/2 already (hp field); also enemy ATTACK strike while stomping
await setup(); await ev(() => { const e = window.__e; e.fsm = 'ATTACK'; e.atkPhase = 'strike'; e.hitThis = false }); await page.waitForTimeout(2500); log('5.stomp_vs_striking_enemy', await state())
await page.screenshot({ path: `${OUT}/${cast}-stomp.png` })
console.log('errors', errs); await b.close()
