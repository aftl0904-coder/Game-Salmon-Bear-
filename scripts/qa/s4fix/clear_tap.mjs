import { chromium, devices } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47612/'
const OUT = process.env.OUT || '/tmp/fix4/docs/qa-s4fix'; fs.mkdirSync(OUT, { recursive: true })
const STAGE = Number(process.env.STAGE || 4)
const profiles = {
  iphone13L: { ...devices['iPhone 13 landscape'] },
  pixel7L: { ...devices['Pixel 7 landscape'] },
  smallAndroidL: { viewport: { width: 640, height: 320 }, screen: { width: 640, height: 320 }, userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const res = {}
for (const [name, prof] of Object.entries(profiles)) {
  const ctx = await b.newContext({ ...prof })
  await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(URL); await page.waitForTimeout(5000)
  const cdp = await ctx.newCDPSession(page)
  const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await page.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
  await page.evaluate((st) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, STAGE)
  await page.waitForTimeout(3500)
  for (let i = 0; i < 12; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await tap(10, 10); await page.keyboard.press('Enter'); await page.waitForTimeout(500) }
  if (process.env.REAL) {
    await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.playOutro() })
    for (let i = 0; i < 80; i++) {
      const st = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { card: !!s.clearBtns?.length, tally: s.tallyDone, intro: !!s.storyIntro } })
      if (st.card && st.tally) break
      await tap(320, 180)
      await page.waitForTimeout(700)
    }
    await page.waitForTimeout(1500)
  } else {
    await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.ended = true; s.win() })
    await page.waitForTimeout(5000)
  }
  await page.screenshot({ path: `${OUT}/${name}-clear.png` })
  const info = await page.evaluate(() => {
    const g = window.__SAKE_GAME__; const s = g.scene.getScene('play')
    const c = document.querySelector('canvas').getBoundingClientRect()
    return { canvas: { x: c.x, y: c.y, w: c.width, h: c.height }, vw: innerWidth, vh: innerHeight, tally: s.tallyDone, ui: g.scene.isActive('UIScene'), btns: s.clearBtns.map((b) => { const r = b.bg.getBounds(); return { id: b.id, on: b.on, x: r.centerX, y: r.centerY, w: r.width, h: r.height, interactive: !!b.bg.input?.enabled } }), cam: { zoom: s.cameras.main.zoom, sx: s.cameras.main.scrollX, w: s.cameras.main.width } }
  })
  const sc = info.canvas.w / 640
  const next = info.btns.find((x) => x.id === 'next')
  const pt = { x: info.canvas.x + next.x * sc, y: info.canvas.y + next.y * sc }; console.log('tapping', JSON.stringify(pt))
  const before = await page.evaluate(() => ({ leaving: window.__SAKE_GAME__.registry.get('leavingToMenu'), active: window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key) }))
  await tap(pt.x, pt.y)
  await page.waitForTimeout(2500)
  const after = await page.evaluate(() => ({ leaving: window.__SAKE_GAME__.registry.get('leavingToMenu'), stageNo: window.__SAKE_GAME__.registry.get('stageNo'), active: window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key) }))
  await page.screenshot({ path: `${OUT}/${name}-after-tap.png` })
  res[name] = { info, pt, before, after, errs }
  console.log(name, JSON.stringify({ canvas: info.canvas, vw: info.vw, vh: info.vh, tally: info.tally, next, pt, before, after, errs }))
  await ctx.close()
}
fs.writeFileSync(`${OUT}/clear_tap.json`, JSON.stringify(res, null, 1)); await b.close()
