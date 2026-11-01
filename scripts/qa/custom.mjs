import { chromium } from 'playwright'
import fs from 'fs'
const PORT = process.env.PORT ?? 47313, OUT = process.env.OUTD ?? '/opt/cursor/artifacts/custom'; fs.mkdirSync(OUT, { recursive: true })
const cfg = { pupu: { height: 60, anims: { idle: ['pupu-idle.png'], walk: ['pupu-walk-1.png', 'pupu-walk-2.png', 'pupu-walk-3.png'] }, portrait: 'pupu-portrait.png' }, stills: {} }
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
if (process.env.CUSTOM !== '0') await page.route('**/art/custom/custom.json*', (r) => r.fulfill({ json: cfg }))
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
await page.goto(`http://127.0.0.1:${PORT}/`); await page.waitForTimeout(6000)
const info = await page.evaluate(() => { const g = window.__SAKE_GAME__; const T = g.textures; const o = {}; for (const k of ['anim-pupu', 'art-bear', 'portrait-pupu', 'portrait-pupu-hollow']) { const t = T.get(k); o[k] = { res: t.source[0].resolution, w: t.source[0].width, f1: t.get(1)?.width ?? null, base: t.get('__BASE')?.width } } return o })
console.log(JSON.stringify(info))
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 1); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '2p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
for (let i = 0; i < 3; i++) { await page.keyboard.press('f'); await page.waitForTimeout(400) }
await page.keyboard.down('d'); await page.waitForTimeout(2500)
const sp = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const c = s.pet; return c ? { x: Math.round(c.x), y: Math.round(c.y), tex: c.texture?.key, w: c.displayWidth, h: c.displayHeight, anim: c.anims?.currentAnim?.key } : null })
console.log('pupu sprite', JSON.stringify(sp))
await page.screenshot({ path: `${OUT}/play.png` }); if (sp) { const cam = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').cameras.main.scrollX); const px = (sp.x - cam) * 2, py = sp.y * 2; await page.screenshot({ path: `${OUT}/pet-zoom.png`, clip: { x: Math.max(0, px - 120), y: Math.max(0, py - 160), width: 240, height: 200 } }) }
await page.keyboard.up('d')
console.log('errs', JSON.stringify(errs.slice(0, 5)))
await b.close()
