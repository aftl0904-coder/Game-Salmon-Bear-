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
const tp = (x) => page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = x; h.y = 200; h.hp = 6; h.graceUntil = s.time.now + 60000 } }, x)
const mobs = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.enemies.getChildren().filter((e) => e.active && e.species).map((e) => ({ sp: e.species, x: Math.round(e.x), anim: e.anims?.currentAnim?.key, tex: e.texture.key, w: Math.round(e.displayWidth), h: Math.round(e.displayHeight), bw: Math.round(e.body.width), bh: Math.round(e.body.height), hp: e.hp, ph: e.phase })) })
const seen = new Set()
async function watch(sp, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const m = (await mobs()).filter((e) => e.sp === sp)
    for (const e of m) { const k = `${sp}|${e.anim}`; if (!seen.has(k)) { seen.add(k); console.log(JSON.stringify(e)); const cam = await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.cameras.main.scrollX }, 0); await page.screenshot({ path: `${OUT}/${sp}-${e.anim}.png`.replace(/[^\w/.-]/g, '_') }) } }
    await page.waitForTimeout(100)
  }
}
await tp(330); await page.waitForTimeout(1500)
await watch('honeyzombie', 9000)
await tp(790); await page.waitForTimeout(800)
await watch('clockpunch', 8000)
await tp(960); await page.waitForTimeout(800)
await watch('taximonster', 9000)
// hit + die each
for (const sp of ['honeyzombie', 'clockpunch', 'taximonster']) {
  const r = await page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.active && o.species === sp); if (!e) return 'none'; e.receiveHit(1, 1); return [e.anims.currentAnim?.key, e.fsm, e.hp] }, sp)
  console.log('hit', sp, JSON.stringify(r)); await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/hit-${sp}.png` })
  const d = await page.evaluate((sp) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const e = s.enemies.getChildren().find((o) => o.active && o.species === sp && o.fsm !== 'DEAD'); if (!e) return 'none'; e.hp = 1; e.receiveHit(3, 1); return e.fsm }, sp)
  await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/die-${sp}.png` })
  console.log('die', sp, d)
}
console.log('errors', errs)
await b.close()
