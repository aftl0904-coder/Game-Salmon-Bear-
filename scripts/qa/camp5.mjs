import { chromium } from 'playwright'
import fs from 'fs'
const [, , phase = '3', secs = '45', cast = 'girl'] = process.argv
const lvl = JSON.parse(fs.readFileSync('/tmp/res2x-on58/data/levels/stage5.json', 'utf8')); const trig = lvl.boss.triggerX
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate((c) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 5); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', 'solo'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, cast)
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = x; s.boy.y = 200 }, trig + 20)
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; return { bhp: s.boy.hp, bx: Math.round(s.boy.x), qx: q ? Math.round(q.x) : null, qhp: q?.hp, act: q?.act, ph: q?.qphase, ended: s.ended, bf: !!s.bossFight, intro: !!s.storyIntro, sc: window.__SAKE_GAME__.scene.getScenes(true).map((x) => x.scene.key).join(',') } })
for (let i = 0; i < 20; i++) { const s = await st(); if (s.bf && !s.intro && s.act && s.act !== 'intro') break; if (s.intro || s.act === 'intro') await page.keyboard.press('Enter'); await page.waitForTimeout(500) }
await page.evaluate((ph) => { const q = window.__SAKE_GAME__.scene.getScene('play').queen; q.hp = ph == 3 ? 16 : ph == 2 ? 30 : q.hp; q.updatePhase?.() ; if (ph == 3) { q.qphase = 3; q.go('shield') } else if (ph == 2) { q.qphase = 2; q.go('proj1') } }, +phase)
const t0 = Date.now(); const log = []; let last = null, hpLoss = 0, prevHp = null
// camper: stand 60px in front of the boss, face it, mash attack, never dodge
while ((Date.now() - t0) / 1000 < +secs) {
  const s = await st(); if (s.sc.includes('pause') || s.ended) { log.push(['ended/pause', s.sc, s.ended, s.bhp]); if (s.ended) break }
  if (prevHp !== null && s.bhp < prevHp) { hpLoss += prevHp - s.bhp; log.push([+((Date.now() - t0) / 1000).toFixed(1), 'HP', s.bhp, s.act]) }
  prevHp = s.bhp
  if (s.act !== last) { last = s.act; log.push([+((Date.now() - t0) / 1000).toFixed(1), s.act, 'qhp', s.qhp]) }
  const dx = s.qx - s.bx
  if (Math.abs(dx) > 70) await page.keyboard.down(dx > 0 ? 'd' : 'a'); else { await page.keyboard.up('a'); await page.keyboard.up('d') }
  if (Math.abs(dx) > 70) await page.keyboard.up(dx > 0 ? 'a' : 'd')
  await page.keyboard.press('f'); await page.waitForTimeout(100)
}
await page.screenshot({ path: `/opt/cursor/artifacts/camp5-p${phase}.png` })
console.log(JSON.stringify({ phase, hpLoss, final: await st(), errs, log: log.slice(0, 60) }))
await b.close()
