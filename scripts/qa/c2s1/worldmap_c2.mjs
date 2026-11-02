// Stage 6 entry: real menu flow with ?c2=1 (desktop keyboard, Pixel 7 touch, iPhone 13 touch), the clear-card-style direct
// transitions into stage 6, and a regression check that the 第一大陸 map flow still behaves as before.
import { chromium, devices } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47614/'
const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-c2-worldmap'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
const rec = (profile, name, ok, detail) => { results.push({ profile, name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', profile, '|', name, detail ? JSON.stringify(detail) : '') }

async function session(profile, touch) {
  const ctx = await b.newContext(touch ? { ...devices[profile] } : { viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  const cdp = touch ? await ctx.newCDPSession(page) : null
  const geo = () => page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, sc: r.width / 640 } })
  const tapL = async (lx, ly) => {
    const g = await geo(); const x = g.x + lx * g.sc, y = g.y + ly * g.sc
    if (touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await page.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
    else await page.mouse.click(x, y)
  }
  const scenes = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key).join('+'))
  const shot = (n) => page.screenshot({ path: `${OUT}/${profile.split(' ')[0]}-${n}.png` })
  return { ctx, page, errs, tapL, scenes, shot, touch }
}

async function toMenu(S) {
  await S.page.goto(URL + '?c2=1'); await S.page.waitForTimeout(2500)
  for (let i = 0; i < 40; i++) {
    const sc = await S.scenes()
    if (sc.startsWith('menu')) return true
    if (sc.startsWith('difficulty')) { const r = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('difficulty'); const t = s.rows[1].getBounds(); return { x: t.centerX, y: t.centerY } }); await S.tapL(r.x, r.y) } else await S.tapL(320, 180)
    await S.page.waitForTimeout(900)
  }
  return false
}

async function runProfile(profile, touch) {
  // ── A. real menu flow into stage 6 ──
  let S = await session(profile, touch)
  rec(profile, 'reach menu', await toMenu(S))
  await S.page.waitForTimeout(1500)
  const menu = await S.page.evaluate(() => { const m = window.__SAKE_GAME__.scene.getScene('menu'); let n = 0; while (m.stageSel !== 6 && n++ < 8) m.toggleStage(1); return { sel: m.stageSel, label: m.stageText?.text } })
  rec(profile, 'menu offers stage 6 (?c2=1)', menu.sel === 6, menu)
  if (touch) {
    const r = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('menu'); const p = s.plaques[1]; return { x: p.x, y: p.label.y } })
    await S.tapL(r.x, r.y)
  } else { await S.page.keyboard.press('Enter') }
  let seen = []
  let card = null
  for (let i = 0; i < 40; i++) {
    await S.page.waitForTimeout(250)
    const sc = await S.scenes()
    if (!seen.includes(sc)) seen.push(sc)
    if (sc.startsWith('worldmap') && !card) {
      await S.page.waitForTimeout(900)
      card = await S.page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').children.list.filter((o) => o.type === 'Text').map((o) => o.text))
      await S.shot('A-stage6-card')
      break
    }
  }
  rec(profile, 'stage 6 card shows verse + 大陸2・第一關・購物中心 (not 第一關・百畝樹林)', !!card && card.some((t) => t.includes('大陸2・第一關・購物中心')) && card.some((t) => t.includes('加拉太書 5:1')) && !card.some((t) => t.includes('百畝樹林')), card)
  // tap / key through the card
  await S.page.waitForTimeout(700)
  if (touch) await S.tapL(320, 180); else await S.page.keyboard.press('Enter')
  let inPlay = false
  for (let i = 0; i < 30; i++) { await S.page.waitForTimeout(400); const sc = await S.scenes(); if (sc.startsWith('play')) { inPlay = true; break } }
  const stageNo = await S.page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo'))
  rec(profile, 'card -> play, stageNo 6', inPlay && stageNo === 6, { seen, stageNo })
  await S.page.waitForTimeout(2500); await S.shot('A-stage6-play')
  rec(profile, 'no page errors (flow A)', S.errs.length === 0, S.errs)
  // auto-advance: the card must also leave on its own without any input
  await S.page.evaluate(() => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('worldmap', { from: 5, to: 6, next: 'bike', stageNo: 6, pick: true }) })
  let auto = false
  for (let i = 0; i < 40; i++) { await S.page.waitForTimeout(400); if ((await S.scenes()).startsWith('play')) { auto = true; break } }
  rec(profile, 'from=5,to=6,pick:true (clear-card style) auto-advances to play with no input', auto, { errs: S.errs })
  // other stages past the map: 7..10 must not throw either
  for (const n of [7, 10]) {
    await S.page.evaluate((n) => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('worldmap', { from: n - 1, to: n, next: 'play', stageNo: n }) }, n)
    await S.page.waitForTimeout(1200)
    const txt = await S.page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').children.list.filter((o) => o.type === 'Text').map((o) => o.text))
    rec(profile, `to=${n} shows a card, no throw`, txt.some((t) => t.startsWith('大陸2・')) && S.errs.length === 0, { txt, errs: S.errs })
  }
  await S.ctx.close()

  // ── B. regression: 第一大陸 map unchanged ──
  S = await session(profile, touch)
  await S.page.goto(URL); await S.page.waitForTimeout(3500)
  await S.page.evaluate(() => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('stageNo', 2); g.scene.start('worldmap', { from: 1, to: 2, next: 'bike', stageNo: 2, pick: true }) })
  await S.page.waitForTimeout(1500)
  const m = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('worldmap'); return { picking: s.picking, banner: s.bannerLabel.text, icons: Object.keys(s.icons).length, party: [s.party.x, s.party.y] } })
  rec(profile, 'regression: 1->2 map is the pick screen with banner 第二關・蜜樹丘 and 5 badges', m.picking && m.banner.includes('第二關・蜜樹丘') && m.icons === 5, m)
  await S.shot('B-map-1to2')
  const ic = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('worldmap'); const i = s.icons[2]; return { x: i.x, y: i.y } })
  await S.tapL(ic.x, ic.y)
  let next = ''
  for (let i = 0; i < 60; i++) { await S.page.waitForTimeout(500); next = await S.scenes(); if (next.startsWith('bike') || next.startsWith('claw') || next.startsWith('play')) break }
  rec(profile, 'regression: tap badge 2 -> walks road -> bike', next.startsWith('bike'), { next, errs: S.errs })
  await S.ctx.close()
  // stage 5 -> credits hop
  S = await session(profile, touch)
  await S.page.goto(URL); await S.page.waitForTimeout(3500)
  await S.page.evaluate(() => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('worldmap', { from: 5, to: 5, next: 'credits' }) })
  let cr = ''
  for (let i = 0; i < 40; i++) { await S.page.waitForTimeout(500); cr = await S.scenes(); if (cr.startsWith('credits')) break; await S.tapL(320, 180) }
  rec(profile, 'regression: 5 -> credits hop still works', cr.startsWith('credits'), { cr, errs: S.errs })
  await S.ctx.close()
}
await runProfile('Desktop 1280x720', false)
await runProfile('Pixel 7 landscape', true)
await runProfile('iPhone 13 landscape', true)
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} PASS`)
await b.close()
