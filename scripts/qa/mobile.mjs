import { chromium, devices } from 'playwright'
import fs from 'fs'
const OUT = '/opt/cursor/artifacts/mobile'; fs.mkdirSync(OUT, { recursive: true })
const profiles = {
  iphone13L: { ...devices['iPhone 13 landscape'] },
  pixel7L: { ...devices['Pixel 7 landscape'] },
  smallAndroidL: { viewport: { width: 640, height: 320 }, screen: { width: 640, height: 320 }, userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iphone13P: { ...devices['iPhone 13'] },
}
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const all = {}
for (const [name, prof] of Object.entries(profiles)) {
  const ctx = await b.newContext({ ...prof })
  await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
  const cdp = await ctx.newCDPSession(page)
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) })
  const r = { isPhonePlay: await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, touch: 'ontouchstart' in window, w: innerWidth, h: innerHeight })) }
  await page.screenshot({ path: `${OUT}/${name}-title.png` })
  await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 1); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '2p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
  await page.waitForTimeout(3500)
  for (let i = 0; i < 12; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await touch('touchStart', [{ x: 10, y: 10 }]); await touch('touchEnd', []); await page.keyboard.press('Enter'); await page.waitForTimeout(500) }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${name}-play.png` })
  const geo = await page.evaluate(() => { const c = document.querySelector('canvas'); const rc = c.getBoundingClientRect(); return { x: rc.x, y: rc.y, w: rc.width, h: rc.height, vw: innerWidth, vh: innerHeight, bufW: c.width, bufH: c.height } })
  r.canvas = geo
  const sc = geo.w / 640
  const P = (lx, ly) => ({ x: geo.x + lx * sc, y: geo.y + ly * sc })
  const btns = { left: [12, 324, 44, 40], right: [92, 324, 44, 40], crouch: [52, 280, 48, 40], jump: [584, 320, 48, 48], attack: [532, 312, 44, 44], special: [584, 264, 44, 40], weaponSwitch: [532, 264, 46, 40], start: [610, 52, 40, 28] }
  r.touchTargetsCssPx = Object.fromEntries(Object.entries(btns).map(([k, v]) => [k, `${Math.round(v[2] * sc)}x${Math.round(v[3] * sc)}`]))
  r.offscreen = Object.entries(btns).filter(([, v]) => { const p = P(v[0], v[1]); return p.x - v[2] * sc / 2 < 0 || p.x + v[2] * sc / 2 > geo.vw || p.y - v[3] * sc / 2 < 0 || p.y + v[3] * sc / 2 > geo.vh }).map(([k]) => k)
  const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { bx: Math.round(s.boy.x), bvy: Math.round(s.boy.body.velocity.y), cd: s.boy.atkCd, crouch: s.boy.crouching, sp: s.specialCharges, wm: s.boy.getData('wmode') ?? 'normal', paused: window.__SAKE_GAME__.scene.isActive('pause') } })
  const hold = async (k, ms = 700) => { const v = btns[k]; const p = P(v[0], v[1]); await touch('touchStart', [p]); await page.waitForTimeout(ms); const s = await st(); await touch('touchEnd', []); return s }
  let a = await st(); let c = await hold('right'); r.right = c.bx - a.bx
  a = await st(); c = await hold('left'); r.left = c.bx - a.bx
  await page.waitForTimeout(500); a = await st(); c = await hold('crouch', 400); r.crouch = c.crouch
  await page.waitForTimeout(500); const tj = P(btns.jump[0], btns.jump[1]); await touch('touchStart', [tj]); let mv = 0; for (let i = 0; i < 8; i++) { await page.waitForTimeout(60); mv = Math.min(mv, (await st()).bvy) } await touch('touchEnd', []); r.jumpMinVy = mv
  await page.waitForTimeout(900); c = await hold('attack', 120); r.attackCd = c.cd
  await page.evaluate(() => { window.__SAKE_GAME__.scene.getScene('play').specialCharges = 1 }); await page.waitForTimeout(900)
  a = await st(); c = await hold('weaponSwitch', 120); r.weapon = [a.wm, (await st()).wm]
  // multi-touch: hold right + tap jump simultaneously
  await page.waitForTimeout(800); a = await st(); const pr = P(btns.right[0], btns.right[1]); const pj = P(btns.jump[0], btns.jump[1])
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pr.x, y: pr.y, id: 0 }] }); await page.waitForTimeout(150)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pr.x, y: pr.y, id: 0 }, { x: pj.x, y: pj.y, id: 1 }] }); let mv2 = 0; for (let i = 0; i < 8; i++) { await page.waitForTimeout(60); mv2 = Math.min(mv2, (await st()).bvy) } c = await st()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  r.multitouch = { dx: c.bx - a.bx, jumpMinVy: mv2 }
  await page.waitForTimeout(600); const ps = P(btns.start[0], btns.start[1]); await touch('touchStart', [ps]); await touch('touchEnd', []); await page.waitForTimeout(600); r.pauseByTouch = (await st()).paused; await page.screenshot({ path: `${OUT}/${name}-pause.png` })
  r.errs = errs.slice(0, 3); all[name] = r; console.log(name, JSON.stringify(r)); await ctx.close()
}
fs.writeFileSync(`${OUT}/res.json`, JSON.stringify(all, null, 1)); await b.close()
