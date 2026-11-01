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
const reset = async (n = 2, hp = 60) => ev(({ n, hp }) => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; s.coffeeDone = true; s.physics.resume()
  for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }
  const h = s.boy; h.x = 400; h.y = 285; h.hp = 6; h.grace = 0; h.hurtCd = 0; h.hurtLock = 0; h.combo = 0; h.comboCasting = false; h.stam = 1; h.facing = 1; h.setFlipX(false)
  window.__es = []
  for (let i = 0; i < n; i++) { const e = s.mkEnemy(400 + 70 + i * 36, 428, 'blocker'); e.hp = e.maxHp = hp; e.setData('spdMul', 0.01); window.__es.push(e) }
}, { n, hp })
const snap = () => ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; return { combo: +h.combo.toFixed(2), casting: h.comboCasting, stam: +h.stam.toFixed(2), hp: h.hp, pose: h.pose, hurtLock: Math.round(h.hurtLock), enemies: window.__es.map((e) => e.active ? e.hp : 'dead') } })
const press = async (k, ms = 60) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }

// A. meter gain from real attacks
await reset(); await page.waitForTimeout(600)
const before = await snap()
for (let i = 0; i < 6; i++) { await press('f'); await page.waitForTimeout(500) }
const after = await snap(); log('A.gain', { before, after })
// decay
await ev(() => { const h = window.__SAKE_GAME__.scene.getScene('play').boy; h.combo = 0.6; h.comboHitAt = window.__SAKE_GAME__.scene.getScene('play').time.now })
await page.waitForTimeout(1200); const d1 = await snap()
await page.waitForTimeout(3500); const d2 = await snap(); log('A.decay', { at1_2s: d1.combo, at4_7s: d2.combo })

// B. hold with non-full meter does nothing
await reset(); await ev(() => { window.__SAKE_GAME__.scene.getScene('play').boy.combo = 0.5 })
await page.keyboard.down('f'); await page.waitForTimeout(900); const nf = await snap(); await page.keyboard.up('f'); log('B.notfull_hold', nf)

// C. full meter hold -> cast
await reset(2, 60); await ev(() => { const h = window.__SAKE_GAME__.scene.getScene('play').boy; h.combo = 1; h.comboHitAt = window.__SAKE_GAME__.scene.getScene('play').time.now })
await page.waitForTimeout(300)
const c0 = await snap()
await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); window.__armor = null
  const fn = () => { const h = s.boy; if (!h.comboCasting || window.__armor) return; const e = window.__es[0]; const hp0 = h.hp; h.hurtCd = 0; h.grace = 0; e.fsm = 'ATTACK'; e.atkPhase = 'strike'; e.hitThis = false
    const vx0 = Math.round(h.body.velocity.x); s.hurtHero(h, e); window.__armor = { hp0, hp1: h.hp, pose: h.pose, hurtLock: Math.round(h.hurtLock), vx0, vx1: Math.round(h.body.velocity.x), casting: h.comboCasting }; s.events.off('update', fn) }
  s.events.on('update', fn) })
await page.keyboard.down('f')
let fired = null; const t0 = Date.now()
const samples = []
while (Date.now() - t0 < 3500) {
  const r = await snap()
  if (r.casting && fired === null) { fired = Date.now() - t0; await page.screenshot({ path: `${OUT}/${cast}-cast-start.png` }) }
  samples.push({ t: Date.now() - t0, c: r.combo, cast: r.casting, e: r.enemies.join('/') })
  if (r.casting && Date.now() - t0 - fired > 500 && !globalThis.shot2) { globalThis.shot2 = 1; await page.screenshot({ path: `${OUT}/${cast}-cast-mid.png` }) }
  if (!r.casting && fired !== null) break
  await page.waitForTimeout(100)
}
await page.keyboard.up('f')
log('C.armor_hit_during_cast', await ev(() => window.__armor))
const c1 = await snap(); log('C.cast', { c0, firedAfterMs: fired, castDurationMs: Date.now() - t0 - fired, c1 })
log('C.samples', samples.filter((_, i) => i % 3 === 0))
// D. after cast: normal hurt should lock again
const dres = await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; h.hurtCd = 0; h.grace = 0; const e = window.__es.find((e) => e.active) ?? window.__es[0]; e.fsm = 'ATTACK'; e.atkPhase = 'strike'; e.hitThis = false; e.contactCd = 0; s.hurtHero(h, e); return { pose: h.pose, hurtLock: Math.round(h.hurtLock) } })
log('D.after_cast_hurt_normal', dres)
// E. direct fire: damage per special on 2 clustered enemies (no other attacks)
await reset(2, 60); await page.waitForTimeout(500)
const e0 = await snap()
await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); window.__dl = []; for (const e of window.__es) { const orig = e.receiveHit.bind(e); e.receiveHit = (d, dir) => { window.__dl.push(d); return orig(d, dir) } } const h = s.boy; h.combo = 1; s.fireComboSpecial(h) })
await page.waitForTimeout(250); log('E.shots', await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { facing: s.boy.facing, x: Math.round(s.boy.x), shots: s.shots.getChildren().map((o) => [Math.round(o.x), Math.round(o.y), Math.round(o.body.velocity.x), o.getData('power'), o.getData('combo')]) } })); await page.screenshot({ path: `${OUT}/${cast}-E-mid.png` })
let t1 = Date.now(); let endState = null
while (Date.now() - t1 < 6000) { const r = await snap(); if (!r.casting) { endState = r; break } await page.waitForTimeout(150) }
await page.waitForTimeout(600)
const e1 = await snap(); log('E.hits', await ev(() => window.__dl)); log('E.direct', { enemiesBefore: e0.enemies, enemiesAfter: e1.enemies, end: e1 })
console.log('errors', errs); await b.close()
