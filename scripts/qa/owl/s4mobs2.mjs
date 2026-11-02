import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/tmp/res2x-on58/docs/qa-s4mobs'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3000)
const press = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(45); await page.keyboard.up(k) }
for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await press('Enter'); await page.waitForTimeout(700) }
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }; for (const h of [s.boy, s.girl]) if (h) { h.x = 300; h.y = 200; h.hp = 6; h.graceUntil = s.time.now + 90000 } })
await page.waitForTimeout(1200)
const info = (sp) => page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.active && o.species === sp); if (!e) return null; const h = s.boy?.active ? s.boy : s.girl; return { x: Math.round(e.x), hx: Math.round(h.x), anim: e.anims.currentAnim?.key, ph: e.phase, fsm: e.fsm, hp: e.hp, vx: Math.round(e.body.velocity.x), blockedHurt: e.canHurtPlayer() } }, sp)
const spawn = (sp, x) => page.evaluate(([sp, x]) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.spawnS2(sp, x, false) }, [sp, x])
const clear = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() } })
let curSp = 'honeyzombie'; let lastX = 600
const shot = async (n) => { const p = await page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.species === sp); const c = s.cameras.main; return e ? { x: (e.x - c.scrollX) * 2 } : null }, curSp); if (p) lastX = p.x; const x = Math.min(Math.max(0, lastX - 160), 1280 - 320); await page.screenshot({ path: `${OUT}/${n}.png`, clip: { x, y: 440, width: 320, height: 260 } }) }
for (const [sp, x, hx] of (process.env.ONLY ? [['taximonster', 600, 420]] : [['honeyzombie', 520, 300], ['clockpunch', 520, 300], ['taximonster', 600, 420]])) {
  curSp = sp; await clear(); await page.evaluate((hx) => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = hx; h.y = 200 } }, hx)
  await spawn(sp, x); const seen = new Set(); const t0 = Date.now()
  while (Date.now() - t0 < 8500) {
    const d = await info(sp); if (!d) break
    if (!seen.has(d.anim)) { seen.add(d.anim); console.log(sp, JSON.stringify(d)); await shot(`${sp}-${d.anim.split('-')[1]}`) }
    await page.waitForTimeout(80)
  }
  // hit + death
  const r = await page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.active && o.species === sp); if (!e) return null; e.receiveHit(1, 1); return [e.anims.currentAnim?.key, e.hp] }, sp)
  console.log(sp, 'after hit', JSON.stringify(r)); await page.waitForTimeout(120); await shot(`${sp}-hit-now`)
  await page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.active && o.species === sp); if (e) { e.hp = 1; e.lastHit = 0; e.receiveHit(3, 1) } }, sp)
  await page.waitForTimeout(500); await shot(`${sp}-die1`); await page.waitForTimeout(500); await shot(`${sp}-die2`)
  console.log(sp, 'alive after kill', JSON.stringify(await info(sp)))
}
console.log('errors', errs); await b.close()
