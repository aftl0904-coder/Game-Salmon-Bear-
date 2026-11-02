// 瞓覺 on the clear card by touch only: hurt hero + coins -> tap 瞓覺 -> tap 唔瞓 (modal closes) -> tap 瞓覺 again -> tap 瞓 (hp refilled, coins spent).
import { chromium, devices } from 'playwright'
const URL = process.env.URL || 'http://127.0.0.1:47613/'
const PROFILE = process.env.PROFILE || 'Pixel 7 landscape'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ ...devices[PROFILE] })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(4500)
const cdp = await ctx.newCDPSession(page)
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) })
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.storyIntro?.destroy(); s.storyIntro = null; s.started = true; s.coinStock = 200; if (s.purse) { s.purse.boy = 200; s.purse.girl = 200 } s.boy.hp = 1; s.ended = true; s.win() })
await page.waitForTimeout(4500)
const geo = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, sc: r.width / 640 } })
const tapL = async (lx, ly) => { const px = geo.x + lx * geo.sc, py = geo.y + ly * geo.sc; await T('touchStart', [[px, py, 0]]); await page.waitForTimeout(90); await T('touchEnd', []); await page.waitForTimeout(900) }
const info = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const bb = (id) => { const b = s.clearBtns.find((x) => x.id === id); const t = b.bg.getBounds(); return { on: b.on, x: t.centerX, y: t.centerY } }; return { modal: !!s.clearModal, hp: s.boy.hp, max: s.boy.maxHp, coins: s.purse?.boy ?? s.coinStock, sleep: bb('sleep') } })
const log = []
let i = await info(); log.push(['start', i])
await tapL(i.sleep.x, i.sleep.y); i = await info(); log.push(['after tap 瞓覺 (modal should be open)', i])
await page.screenshot({ path: '/tmp/fix4b/docs/qa-s4fix/sleep_modal.png' })
const GW = 320, GH = 180
await tapL(GW + 66, GH + 54); i = await info(); log.push(['after tap 唔瞓 (modal should be closed, hp unchanged)', i])
await tapL(i.sleep.x, i.sleep.y); i = await info(); log.push(['after tap 瞓覺 again', i])
await tapL(GW - 66, GH + 54); await page.waitForTimeout(800); i = await info(); log.push(['after tap 瞓 (hp should refill, coins drop)', i])
for (const [k, v] of log) console.log(PROFILE, '|', k, JSON.stringify(v))
await b.close()
