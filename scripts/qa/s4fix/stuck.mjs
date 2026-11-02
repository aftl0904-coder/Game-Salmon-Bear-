import { chromium, devices } from 'playwright'
const URL = 'http://127.0.0.1:47612/'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ONLY = process.env.ONLY
async function trial(label, steps) {
  if (ONLY && !label.includes(ONLY)) return
  const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] })
  await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
  const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(4500)
  const cdp = await ctx.newCDPSession(page)
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) })
  await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
  await page.waitForTimeout(3500)
  for (let i = 0; i < 12; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await T('touchStart', [[10, 10, 0]]); await T('touchEnd', []); await page.waitForTimeout(500) }
  const geo = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, sc: r.width / 640 } })
  const P = (lx, ly) => [geo.x + lx * geo.sc, geo.y + ly * geo.sc]
  await steps({ page, T, P, cdp })
  const info = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const c = document.querySelector('canvas').getBoundingClientRect(); const n = s.clearBtns.find((b) => b.id === 'next').bg.getBounds(); const pm = s.input.manager; return { nx: n.centerX, ny: n.centerY, pointers: pm.pointers.map((p) => [p.id, p.isDown, p.touchId ?? null]) } })
  const [px, py] = P(info.nx, info.ny)
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); window.__ev = []; for (const e of ['pointerdown','pointerup','gameobjectdown','gameobjectup']) s.input.on(e, (p, o) => window.__ev.push(e + (o && o.type ? ':' + o.type : ''))); const nb = s.clearBtns.find((b) => b.id === 'next'); nb.bg.on('pointerup', () => window.__ev.push('NEXT-pointerup')); window.__st = () => ({ modal: s.clearModal, leaving: window.__SAKE_GAME__.registry.get('leavingToMenu'), on: nb.on, inputEnabled: nb.bg.input?.enabled, sceneInputEnabled: s.input.enabled, topOnly: s.input.topOnly, active: s.scene.isActive(), paused: s.scene.isPaused() }) })
  await T('touchStart', [[px, py, 0]]); await page.waitForTimeout(80); await T('touchEnd', [])
  await page.waitForTimeout(2500)
  const after = await page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key))
  const dbg = await page.evaluate(() => ({ ev: window.__ev, st: window.__st() }))
  console.log(label, JSON.stringify({ after, dbg }))
  await ctx.close()
}
await trial('baseline', async ({ page }) => { await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.ended = true; s.win() }); await page.waitForTimeout(4500) })
await trial('3 fingers held on pad at win()', async ({ page, T, P }) => {
  await T('touchStart', [[...P(92, 324), 0], [...P(584, 320), 1], [...P(532, 312), 2]]); await page.waitForTimeout(300)
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.ended = true; s.win() }); await page.waitForTimeout(1000)
  await T('touchEnd', []); await page.waitForTimeout(3500)
})
await trial('fingers never released (cancel)', async ({ page, T, P }) => {
  await T('touchStart', [[...P(92, 324), 0], [...P(584, 320), 1], [...P(532, 312), 2]]); await page.waitForTimeout(300)
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.ended = true; s.win() }); await page.waitForTimeout(1000)
  await T('touchCancel', []); await page.waitForTimeout(3500)
})
await trial('cutscene tapped at the next-button spot (card builds under the finger)', async ({ page, T, P }) => {
  await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.playOutro() })
  for (let i = 0; i < 80; i++) {
    const st = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { card: !!s.clearBtns?.length, tally: s.tallyDone } })
    if (st.card) break
    await T('touchStart', [[...P(435, 332), 0]]); await page.waitForTimeout(90); await T('touchEnd', []); await page.waitForTimeout(500)
  }
  await page.waitForTimeout(3000)
})
await b.close()
