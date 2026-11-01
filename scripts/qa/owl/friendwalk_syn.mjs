import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/tmp/res2x-on58/docs/qa-friendwalk'; fs.mkdirSync(OUT, { recursive: true })
const stage = +(process.env.STAGE || 1); const fx = +(process.env.FX || 760)
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate((st) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, stage)
await page.waitForTimeout(3000)
const press = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(45); await page.keyboard.up(k) }
for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await press('Enter'); await page.waitForTimeout(700) }
await page.evaluate((fx) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }; for (const h of [s.boy, s.girl]) if (h) { h.x = fx - 60; h.y = 200; h.hp = 6; h.graceUntil = s.time.now + 90000 } }, fx)
await page.waitForTimeout(1000)
await page.evaluate((fx) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const p = s.add.sprite(fx, 285, 'friend-ginger').setOrigin(0.5, 1).setDepth(2000); window.__pal = p; s.friendWalk(p, 900, () => {}) }, fx)
const tr = []; let last = null; const t0 = Date.now(); let shots = 0
while (Date.now() - t0 < 26000) {
  const r = await page.evaluate(() => { const p = window.__pal; const s = window.__SAKE_GAME__.scene.getScene('play'); return p.active ? { x: Math.round(p.x), y: Math.round(p.y), sx: Math.round((p.x - s.cameras.main.scrollX) * 2), sy: Math.round((p.y - s.cameras.main.scrollY) * 2), a: Math.round(p.angle) } : null })
  if (!r) { tr.push('destroyed'); break }
  tr.push(r)
  if (last && Math.abs(r.y - last.y) > 6 && shots < 6 && r.sx > 80 && r.sx < 1200) { shots++; await page.screenshot({ path: `${OUT}/s${stage}-${fx}-hop${shots}.png`, clip: { x: Math.max(0, r.sx - 200), y: Math.max(0, r.sy - 220), width: 400, height: 300 } }) }
  last = r; await page.waitForTimeout(100)
}
const ys = tr.filter((r) => r !== 'destroyed').map((r) => r.y)
console.log('samples', tr.length, 'x', tr[0].x, '->', tr[tr.length - 1].x ?? tr[tr.length - 1], 'y min/max', Math.min(...ys), Math.max(...ys), 'angles', [...new Set(tr.map((r) => r.a))].join(','))
let prev = null; for (const r of tr) { if (r === 'destroyed') continue; if (prev && Math.abs(r.y - prev.y) >= 4) console.log('dy', prev.x, prev.y, '->', r.x, r.y); prev = r }
console.log('errors', errs); await b.close()
