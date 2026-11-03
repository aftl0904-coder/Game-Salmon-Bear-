// ART-17 code part: 大陸2 world map (dark/green), trips pier→6…9→10 (walk, duo sheet, lift), stage picking per continent,
// 第一大陸 regression, unknown-stage fallback, HUD plaque fit. Desktop keyboard + Pixel 7 / iPhone 13 touch.
import { chromium, devices } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47631/'
const OUT = process.env.OUT || '/tmp/c2map/docs/qa-c2map'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
const rec = (profile, name, ok, detail) => { results.push({ profile, name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', profile, '|', name, detail !== undefined ? JSON.stringify(detail) : '') }

async function session(profile, touch, extraInit) {
  const ctx = await b.newContext(touch ? { ...devices[profile] } : { viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript((x) => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); if (x) for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v) }, extraInit)
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
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

/** Start the map with arrival recorded instead of entering the next scene (stages 7+ have no level yet). */
async function startMap(S, data, { hook = true } = {}) {
  await S.page.evaluate(({ data, hook }) => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    window.__arr = null
    window.__hookOn = hook
    window.__t0 = performance.now()
    window.__trace = { minY: 1e9, tex: new Set(), car: false }
    g.scene.start('worldmap', data)
    if (!window.__poll) {
      window.__poll = setInterval(() => {
        const s = g.scene.getScene('worldmap')
        if (!s || s.__hooked || !s.party) return
        s.__hooked = true
        s.events.on('update', () => {
          if (!window.__hookOn || !s.party) return
          window.__trace.minY = Math.min(window.__trace.minY, s.party.y)
          window.__trace.tex.add(s.party.texture.key)
          if (s.children.list.some((o) => o.type === 'Rectangle' && o.visible && o.width === 12 && o.height === 14)) window.__trace.car = true
        })
        const orig = s.goNext.bind(s)
        s.goNext = () => { if (!window.__hookOn) return orig(); window.__arr = { ms: Math.round(performance.now() - window.__t0), x: s.party.x, y: s.party.y, to: s.data_.to, next: s.data_.next, tex: s.party.texture.key } }
      }, 20)
    }
  }, { data, hook })
}
const waitArrive = async (S, ms = 60000) => { for (let i = 0; i < ms / 200; i++) { const a = await S.page.evaluate(() => window.__arr); if (a) return a; await S.page.waitForTimeout(200) } return null }
const info = (S) => S.page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('worldmap')
  const bg = s.children.list.find((o) => o.type === 'Image' && /^map-(world|c2)/.test(o.texture.key))
  return { bg: bg?.texture.key, banner: s.bannerLabel?.text, party: s.party ? [s.party.x, s.party.y, s.party.texture.key] : null, open: s.openStages, picking: s.picking, icons: Object.keys(s.icons ?? {}).map((k) => [k, s.icons[k].texture.key, s.icons[k].frame.name]), cm: s.cm?.id, texts: s.children.list.filter((o) => o.type === 'Text').map((o) => o.text) }
})
const near = (a, b, tol = 4) => Math.abs(a - b) <= tol

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
  // ── A. real menu flow into stage 6 → C2 map (dark), pier → 6, then play ──
  let S = await session(profile, touch)
  rec(profile, 'A reach menu', await toMenu(S))
  await S.page.waitForTimeout(1500)
  await S.page.evaluate(() => { const m = window.__SAKE_GAME__.scene.getScene('menu'); let n = 0; while (m.stageSel !== 6 && n++ < 8) m.toggleStage(1) })
  if (touch) { const r = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('menu'); const p = s.plaques[1]; return { x: p.x, y: p.label.y } }); await S.tapL(r.x, r.y) } else await S.page.keyboard.press('Enter')
  let inf = null; const seen = []
  for (let i = 0; i < 40; i++) { await S.page.waitForTimeout(250); const sc = await S.scenes(); if (!seen.includes(sc)) seen.push(sc); if (sc.startsWith('worldmap')) { await S.page.waitForTimeout(400); inf = await info(S); break } }
  rec(profile, 'A menu→stage 6 shows C2 dark map, banner/title 大陸2・第一關・購物中心, party starts at pier (trio sheet)', !!inf && inf.cm === 2 && inf.bg === 'map-c2-dark' && inf.banner === '大陸2・第一關・購物中心' && !inf.texts.some((t) => t.includes('百畝樹林')) && inf.party[2] === 'map-walk' && near(inf.party[0], 125, 20), inf)
  await S.page.waitForTimeout(1300); await S.shot('A-c2-walk-mid')
  let inPlay = false
  for (let i = 0; i < 80; i++) { await S.page.waitForTimeout(400); if ((await S.scenes()).startsWith('play')) { inPlay = true; break } }
  const stageNo = await S.page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo'))
  rec(profile, 'A map → play with stageNo 6 (no input needed after confirm)', inPlay && stageNo === 6, { seen, stageNo })
  await S.page.waitForTimeout(2500); await S.shot('A-stage6-play')
  // HUD plaque
  const plaque = await S.page.evaluate(() => {
    const ui = window.__SAKE_GAME__.scene.getScene('UIScene')
    const walk = (o, out = []) => { if (o.type === 'Text' && /大陸2/.test(o.text)) out.push(o); o.list?.forEach((c) => walk(c, out)); return out }
    const all = []; for (const o of ui.children.list) walk(o, all)
    const shown = all[0]
    const forms = (t) => { const p = t.split('・'); return p.length >= 3 ? [t, p[0] + '・' + p[1]] : [t] }
    const titles = ['大陸2・第一關・購物中心', '大陸2・第二關・森友展銷中心', '大陸2・第三關・配方控制中心', '大陸2・第四關・地底監禁層', '大陸2・第五關・頂層控制室']
    const m = ui.add.text(0, 0, '', shown.style).setVisible(false)
    const w = titles.map((t) => { let pick = null; for (const f of forms(t)) { m.setText(f); pick = [f, Math.ceil(m.width)]; if (m.width <= 150) break } return pick })
    return { shown: shown.text, shownW: Math.ceil(shown.width), w }
  })
  rec(profile, 'HUD plaque shows full 大陸2・第一關・購物中心, and every C2 title fits ≤150 art px (shortened display only when needed)', plaque.shown === '大陸2・第一關・購物中心' && plaque.w.every(([, px]) => px <= 150), plaque)
  rec(profile, 'A no page/console errors', S.errs.length === 0, S.errs)
  await S.ctx.close()

  // ── B. trips on the C2 map ──
  S = await session(profile, touch)
  await S.page.goto(URL); await S.page.waitForTimeout(3000)
  const trips = [
    { from: 6, to: 6, name: 'pier → 6 (from=to=6, as the menu does)', place: [375, 410], tex: 'map-walk', min: 1500 },
    { from: 6, to: 7, name: '6 → 7', place: [550, 585], tex: 'map-walk' },
    { from: 7, to: 8, name: '7 → 8 (duo)', place: [1078, 369], tex: 'map-walk-duo' },
    { from: 8, to: 9, name: '8 → 9 (duo)', place: [988, 300], tex: 'map-walk-duo' },
    { from: 9, to: 10, name: '9 → 10 (lift)', place: [1050, 74], tex: 'map-walk', lift: true },
    { from: 6, to: 10, name: '6 → 10 chain (walk, duo-free, lift)', place: [1050, 74], tex: 'map-walk', lift: true, shotMid: true },
  ]
  for (const t of trips) {
    await startMap(S, { from: t.from, to: t.to, next: 'play' })
    await S.page.waitForTimeout(700)
    const i0 = await info(S)
    if (t.shotMid) { await S.page.waitForTimeout(2500); await S.shot('B-chain-mid') }
    if (t.to === 8 && t.from === 7) { await S.page.waitForTimeout(1200); await S.shot('B-duo-7-8') }
    const arr = await waitArrive(S)
    const tr = await S.page.evaluate(() => ({ minY: window.__trace.minY, tex: [...window.__trace.tex], car: window.__trace.car }))
    const px = t.place[0] * 0.5, py = t.place[1] * 0.5 + 4
    const ok = !!arr && near(arr.x, px, 3) && near(arr.y, py, 3) && arr.to === t.to && (t.lift ? tr.car : true) && (t.tex === 'map-walk-duo' ? tr.tex.includes('map-walk-duo') : !tr.tex.includes('map-walk-duo')) && i0.bg === 'map-c2-dark'
    rec(profile, `B ${t.name}: arrives at place, sheet=${t.tex}${t.lift ? ', lift car seen' : ''}`, ok, { arr, trace: tr, startParty: i0.party })
  }
  // skipping with touch/key mid-walk
  await startMap(S, { from: 7, to: 8, next: 'play' })
  await S.page.waitForTimeout(4200)
  const walkingNow = await S.page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').walking)
  if (touch) await S.tapL(320, 180); else await S.page.keyboard.press('Enter')
  const sk = await waitArrive(S, 8000)
  rec(profile, 'B tap/Enter mid-walk skips straight to the place (≈ 2 s dive, not the 10 s walk)', walkingNow && !!sk && near(sk.x, 1078 * 0.5, 3) && sk.ms < 8500, { walkingNow, sk })
  // pick: C2 map offers C2 stages only
  await startMap(S, { from: 6, to: 8, next: 'play', pick: true }, { hook: true })
  await S.page.waitForTimeout(1200)
  const pk = await info(S)
  rec(profile, 'B pick on C2: only 6–8 open, 5 icon frames from map-icons-c2, banner is ◀ 大陸2・第三關・配方控制中心 ▶', pk.picking && JSON.stringify(pk.open) === JSON.stringify([6, 7, 8]) && pk.icons.length === 5 && pk.icons.every(([, k]) => k === 'map-icons-c2') && pk.banner === '◀　大陸2・第三關・配方控制中心　▶', pk)
  await S.shot('B-pick-c2')
  const b7 = await S.page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('worldmap'); const i = s.icons[7]; return { x: i.x, y: i.y } })
  await S.tapL(b7.x, b7.y)
  const pa = await waitArrive(S)
  rec(profile, 'B tapping badge 7 travels to 7 (touch alone is enough)', !!pa && pa.to === 7, pa)
  await S.ctx.close()

  // ── C. green map after the 大陸2通關 flag ──
  S = await session(profile, touch, { 'sake-kuma-c2-cleared-v1': '1' })
  await S.page.goto(URL); await S.page.waitForTimeout(3000)
  await startMap(S, { from: 6, to: 7, next: 'play' })
  await S.page.waitForTimeout(1200)
  const gi = await info(S); await S.shot('C-green-map')
  rec(profile, 'C flag set → C2 map is the green texture; places/roads unchanged (arrives at same place)', gi.bg === 'map-c2-green', gi)
  const ga = await waitArrive(S)
  rec(profile, 'C green trip 6 → 7 arrives', !!ga && near(ga.x, 275, 3), ga)
  await S.ctx.close()

  // ── D. 第一大陸 regression + fallback ──
  S = await session(profile, touch)
  await S.page.goto(URL); await S.page.waitForTimeout(3000)
  await startMap(S, { from: 1, to: 2, next: 'bike', stageNo: 2, pick: true }, { hook: false })
  await S.page.waitForTimeout(1000)
  const c1 = await info(S); await S.shot('D-c1-pick')
  rec(profile, 'D C1 pick screen: map-world, banner ◀ 第二關・蜜樹丘 ▶, icons from map-icons, open [1,2], 5 badges', c1.cm === 1 && c1.bg === 'map-world' && c1.banner === '◀　第二關・蜜樹丘　▶' && JSON.stringify(c1.open) === '[1,2]' && c1.icons.length === 5 && c1.icons.every(([, k]) => k === 'map-icons'), c1)
  const bd = await S.page.evaluate(() => { const i = window.__SAKE_GAME__.scene.getScene('worldmap').icons[2]; return { x: i.x, y: i.y } })
  await S.tapL(bd.x, bd.y)
  let nxt = null
  for (let i = 0; i < 60; i++) { await S.page.waitForTimeout(300); const sc = await S.scenes(); if (/bike|claw|play/.test(sc)) { nxt = sc; break } }
  rec(profile, 'D tap badge 2 → bike (unchanged)', !!nxt && nxt.startsWith('bike'), nxt)
  await startMap(S, { from: 2, to: 3, next: 'bike' })
  await S.page.waitForTimeout(800)
  const w23 = await info(S)
  const a23 = await waitArrive(S)
  rec(profile, 'D C1 2 → 3 walks the road with the trio sheet and arrives at place 3', !!a23 && near(a23.x, 360, 3) && w23.party[2] === 'map-walk' && w23.bg === 'map-world', { a23, w23party: w23.party })
  await startMap(S, { from: 1, to: 3, next: 'play' })
  const a13 = await waitArrive(S, 8000)
  rec(profile, 'D C1 1 → 3 (no road mapped) behaves as before: no chained walk, party stays put, then arrives', !!a13 && near(a13.x, 150, 1) && near(a13.y, 239, 1), a13)
  await startMap(S, { from: 5, to: 5, next: 'credits' })
  const a55 = await waitArrive(S, 10000)
  rec(profile, 'D C1 5 → credits hop still works', !!a55 && a55.next === 'credits', a55)
  for (const to of [11, 0]) {
    await S.page.evaluate((to) => { const g = window.__SAKE_GAME__; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('worldmap', { from: 5, to, next: 'play' }) }, to)
    await S.page.waitForTimeout(1200)
    const txt = await S.page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').children.list.filter((o) => o.type === 'Text').map((o) => o.text))
    rec(profile, `D unknown stage ${to}: plain title card, no throw`, txt.length >= 2 && (await S.scenes()).startsWith('worldmap'), txt)
  }
  rec(profile, 'D no page/console errors', S.errs.length === 0, S.errs)
  await S.ctx.close()
}

await runProfile('Desktop', false)
if (!process.env.DESKTOP_ONLY) await runProfile('Pixel 7 landscape', true)
if (!process.env.DESKTOP_ONLY) await runProfile('iPhone 13 landscape', true)
await b.close()
const failed = results.filter((r) => !r.ok)
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
if (failed.length) console.log('FAILED:\n' + failed.map((f) => `${f.profile} | ${f.name}`).join('\n'))
