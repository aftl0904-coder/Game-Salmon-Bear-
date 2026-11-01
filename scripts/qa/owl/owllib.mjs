import { chromium } from 'playwright'
import fs from 'fs'
export const OUT = '/tmp/owl-artifacts'
export async function boot(cast = 'girl', diff = 'normal') {
  const lvl = JSON.parse(fs.readFileSync('/tmp/res2x-on58/data/levels/stage'+(process.env.STAGE||3)+'.json', 'utf8'))
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript((d) => { localStorage.setItem('sake-kuma-difficulty-v1', d); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) }, diff)
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
  await page.evaluate((s) => { window.__STG = s }, +(process.env.STAGE||3)); await page.evaluate(([c, d]) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', +(window.__STG||3)); g.registry.set('difficulty', d); g.registry.set('playMode', '1p'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, [cast, diff])
  await page.waitForTimeout(3000)
  const press = async (k, h = 45) => { await page.keyboard.down(k); await page.waitForTimeout(h); await page.keyboard.up(k) }
  const S = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); if (!s || !s.cameras) return { gone: true }; const h = s.boy?.active ? s.boy : s.girl; const q = s.queen; return { hx: Math.round(h.x), hy: Math.round(h.y), hp: h.hp, alive: h.alive, pose: h.pose, intro: !!s.storyIntro, bf: !!s.bossFight, qhp: q?.hp, qmax: q?.maxHp, qx: q ? Math.round(q.x) : null, qy: q ? Math.round(q.y) : null, act: q?.act, ph: q?.qphase, gap: q?.gapX, dest: q?.destX, wh: q?.windowHits, cued: q?.cued, face: s.boy?.active ? s.boy.facing : s.girl?.facing, cont: !!s.awaitingContinue, ended: !!s.ended, now: Math.round(s.time.now) } })
  for (let i = 0; i < 10; i++) { const s = await S(); if (!s.intro) break; await press('Enter'); await page.waitForTimeout(700) }
  await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = x; h.y = 200 } }, lvl.boss.triggerX + 20)
  for (let i = 0; i < 40; i++) { const s = await S(); if (s.bf && s.act && s.act !== 'intro') break; if (s.intro) await press('Enter'); await page.waitForTimeout(500) }
  return { page, b, lvl, S, press, errs, ev: (f, a) => page.evaluate(f, a) }
}
export async function startRec(page) {
  await page.evaluate(() => {
    window.__rec = []
    const g = window.__SAKE_GAME__
    setInterval(() => {
      const s = g.scene.getScene('play'); if (!s || !s.cameras) return
      const h = s.boy?.active ? s.boy : s.girl; const q = s.queen
      window.__rec.push([Math.round(s.time.now), q?.act ?? null, h.hp, Math.round(h.x), Math.round(h.y), q ? Math.round(q.x) : null, q?.qhp ?? q?.hp, h.pose, q?.windowHits ?? null, Math.round(h.body.velocity.x)])
    }, 30)
  })
}
export const getRec = (page) => page.evaluate(() => window.__rec)
export function summarize(rec) {
  const ev = []; let pa = null, php = null
  for (const r of rec) {
    if (r[1] !== pa) { ev.push(`${r[0]} act ${pa}->${r[1]} qhp=${r[6]} hx=${r[3]} qx=${r[5]}`); pa = r[1] }
    if (r[2] !== php) { if (php !== null) ev.push(`${r[0]} HERO HP ${php}->${r[2]} during ${r[1]} hx=${r[3]} qx=${r[5]}`); php = r[2] }
  }
  return ev
}
