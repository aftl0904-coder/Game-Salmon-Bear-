// Touch-only walk through every transition screen, stage 1 -> credits.
// Gameplay itself is NOT played: once a stage is running the bot calls playOutro() (as the boss-kill would).
// Every menu / cutscene / clear-card / world-map / bike / credits step is a real touch event (CDP).
const GW2 = 320, GH2 = 180
import { chromium, devices } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47613/'
const OUT = process.env.OUT || '/tmp/fix4b/docs/qa-s4fix'; fs.mkdirSync(OUT, { recursive: true })
const PROFILE = process.env.PROFILE || 'Pixel 7 landscape'
const LAST = Number(process.env.LAST || 5)
const SHOP = process.env.SHOP !== '0'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ ...devices[PROFILE] })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify({})) })
const page = await ctx.newPage(); const errs = []
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(URL); await page.waitForTimeout(2500)
const cdp = await ctx.newCDPSession(page)
const geo = () => page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, sc: r.width / 640 } })
const tapL = async (lx, ly, hold = 80) => { const g = await geo(); const x = g.x + lx * g.sc, y = g.y + ly * g.sc; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await page.waitForTimeout(hold); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
const scenes = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key))
let sigAt = Date.now(); const log = []; let shots = 0
const note = async (what, extra = {}) => { sigAt = Date.now(); const sc = await scenes(); const stage = await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo')); const e = { t: Math.round((Date.now() - T0) / 1000), scenes: sc.join('+'), stage, what, ...extra }; log.push(e); console.log(JSON.stringify(e)) }
const shot = async (n) => page.screenshot({ path: `${OUT}/T-${PROFILE.split(' ')[0]}-${String(++shots).padStart(2, '0')}-${n}.png` })
const T0 = Date.now()
const forced = {}; let sceneSince = {}; let lastSig = ''; let stuckTicks = 0
let visitedCredits = false; let shopDone = false
const bounds = (expr) => page.evaluate(expr)
for (let tick = 0; tick < 3000; tick++) {
  const sc = await scenes(); const key = sc.find((k) => k !== 'UIScene') ?? sc[0]
  const stage = await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo') ?? 1)
  const sig = sc.join('+') + ':' + stage
  if (sig !== lastSig) { await note('enter'); lastSig = sig; stuckTicks = 0; sigAt = Date.now() } else stuckTicks++
  if (Date.now() - sigAt > 90000) { await note('STUCK'); await shot('stuck'); break }
  if (key === 'studio' || key === 'logo' || key === 'credits') {
    if (key === 'credits') { visitedCredits = true; if (stuckTicks === 1) await shot('credits') }
    await tapL(320, 180); await page.waitForTimeout(900)
  } else if (key === 'difficulty') {
    const r = await bounds(() => { const s = window.__SAKE_GAME__.scene.getScene('difficulty'); const t = s.rows[1].getBounds(); return { x: t.centerX, y: t.centerY } })
    await shot('difficulty'); await tapL(r.x, r.y); await page.waitForTimeout(1200)
  } else if (key === 'menu') {
    if (visitedCredits) { await note('BACK-AT-MENU-AFTER-CREDITS'); await shot('menu-after-credits'); break }
    const r = await bounds(() => { const s = window.__SAKE_GAME__.scene.getScene('menu'); const p = s.plaques[1]; return { x: p.x, y: p.label.y } })
    await shot('menu'); await tapL(r.x, r.y); await page.waitForTimeout(1500)
  } else if (key === 'worldmap') {
    const st = await bounds(() => { const s = window.__SAKE_GAME__.scene.getScene('worldmap'); const ic = s.icons[s.pickIndex]; return { picking: s.picking, x: ic?.x, y: ic?.y } })
    if (stuckTicks === 1) await shot('worldmap')
    if (st.picking && st.x) await tapL(st.x, st.y); else await tapL(320, 180)
    await page.waitForTimeout(1200)
  } else if (key === 'bike') {
    if (stuckTicks === 1) await shot('bike')
    await tapL(532, 312); await page.waitForTimeout(500); await tapL(584, 320); await page.waitForTimeout(500)
  } else if (key === 'play') {
    const st = await bounds(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { card: !!s.clearBtns?.length && !!s.clearOverlay, tally: s.tallyDone, intro: !!s.storyIntro, modal: s.clearModal, outro: s.outroOn, started: s.started, sleepOn: s.clearBtns?.find((x) => x.id === 'sleep')?.on, gambleOn: s.clearBtns?.find((x) => x.id === 'gamble')?.on, stageNo: s.stageNo } })
    if (st.card) {
      if (!st.tally) { await tapL(320, 100); await page.waitForTimeout(700); continue }
      if (stuckTicks === 1 || stuckTicks === 2) await shot(`clear-s${st.stageNo}`)
      if (SHOP && !shopDone && st.stageNo === 4) {
        shopDone = true
        for (const id of ['shop', 'sleep', 'gamble']) {
          const r = await bounds(`(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const b = s.clearBtns.find((x) => x.id === '${id}'); const t = b.bg.getBounds(); return { on: b.on, x: t.centerX, y: t.centerY } })()`)
          if (!r.on) { await note(`${id}-greyed`); continue }
          await tapL(r.x, r.y); await page.waitForTimeout(1200); await shot(`modal-${id}`)
          const m = await bounds(() => window.__SAKE_GAME__.scene.getScene('play').clearModal)
          await note(`${id}-opened`, { modal: m })
          // leave the pop-up by touch: tap the leave / no / 走 button
          const exits = { shop: [null], sleep: [[GW2 + 66, GH2 + 54]], gamble: [[GW2 + 66, GH2 + 54]] }
          if (id === 'shop') { await tapL(566, 78); await page.waitForTimeout(500) }
          else { const [ex, ey] = exits[id][0]; await tapL(ex, ey); await page.waitForTimeout(500) }
          await page.waitForTimeout(700)
          const m2 = await bounds(() => window.__SAKE_GAME__.scene.getScene('play').clearModal)
          await note(`${id}-closed-by-touch`, { modalAfter: m2 })
        }
      }
      const r = await bounds(`(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const b = s.clearBtns.find((x) => x.id === 'next' || x.id === 'credits'); const t = b.bg.getBounds(); return { id: b.id, on: b.on, x: t.centerX, y: t.centerY } })()`)
      await note('tap-' + r.id, { on: r.on }); await tapL(r.x, r.y); await page.waitForTimeout(1800)
    } else if (st.intro || st.outro || !st.started) {
      await tapL(320, 180); await page.waitForTimeout(700)
    } else {
      // gameplay: prove the on-screen pad responds, then trigger the boss-kill outro
      if (!forced[st.stageNo]) {
        forced[st.stageNo] = true
        const x0 = await bounds(() => Math.round(window.__SAKE_GAME__.scene.getScene('play').boy?.x ?? window.__SAKE_GAME__.scene.getScene('play').girl?.x))
        const g = await geo(); const x = g.x + 92 * g.sc, y = g.y + 324 * g.sc
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await page.waitForTimeout(900)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        const x1 = await bounds(() => Math.round(window.__SAKE_GAME__.scene.getScene('play').boy?.x ?? window.__SAKE_GAME__.scene.getScene('play').girl?.x))
        await note('pad-right-moved', { dx: x1 - x0 })
        await bounds(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.coinStock = 200; if (s.purse) { s.purse.boy = 200; s.purse.girl = 200 }; s.playOutro() })
        await note('forced-outro')
      }
      await page.waitForTimeout(700)
    }
  } else { if (stuckTicks === 1) await shot('scene-' + key); await tapL(320, 180); await page.waitForTimeout(900) }
}
fs.writeFileSync(`${OUT}/touch_flow_${PROFILE.split(' ')[0]}.json`, JSON.stringify({ profile: PROFILE, log, errs, visitedCredits }, null, 1))
console.log('DONE credits:', visitedCredits, 'errs:', errs.length, errs.slice(0, 3))
await b.close()
