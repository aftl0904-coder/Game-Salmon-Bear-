import { chromium } from 'playwright'
import fs from 'fs'
const [, , name, stageArg, diff = 'easy', tmo = '240', forceHp = '0'] = process.argv
let forced = false
const stage = +stageArg, PORT = 47313
const OUT = `/opt/cursor/artifacts/boss2p-${name}`; fs.mkdirSync(OUT, { recursive: true })
const lvl = JSON.parse(fs.readFileSync(`/tmp/res2x-on58/data/levels/stage${stage}.json`, 'utf8'))
const trig = lvl.boss.triggerX
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript((d) => { localStorage.setItem('sake-kuma-difficulty-v1', d); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) }, diff)
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
await page.goto(`http://127.0.0.1:${PORT}/`); await page.waitForTimeout(5000)
await page.evaluate(([st, d]) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', st); g.registry.set('difficulty', d); g.registry.set('playMode', '2p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, [stage, diff])
await page.waitForTimeout(3000)
const press = async (k, h = 45) => { await page.keyboard.down(k); await page.waitForTimeout(h); await page.keyboard.up(k) }
const st = () => page.evaluate(() => { const g = window.__SAKE_GAME__; const s = g.scene.getScene('play'); if (!s || !s.cameras || !s.cameras.main) return { gone: true, scenes: g.scene.getScenes(true).map((x) => x.scene.key).join(','), bx: 0, qhp: 0 }; const q = s.queen; const comp = s.pupu ?? s.companion ?? s.bear; return { bx: Math.round(s.boy.x), bhp: s.boy.hp, gx: s.girl ? Math.round(s.girl.x) : null, ghp: s.girl ? s.girl.hp : null, balive: s.boy.alive, galive: s.girl?.alive, intro: !!s.storyIntro, bf: !!s.bossFight, qhp: q ? q.hp : null, qmax: q ? q.maxHp : null, qx: q ? Math.round(q.x) : null, act: q?.act ?? null, scenes: g.scene.getScenes(true).map((x) => x.scene.key).join(','), ended: !!s.ended, cont: !!s.awaitingContinue, coins: s.coinStock, camx: Math.round(s.cameras.main.scrollX), px: comp ? Math.round(comp.x) : null } })
for (let i = 0; i < 10; i++) { const s = await st(); if (!s.intro) break; await press('Enter'); await page.waitForTimeout(700) }
await page.evaluate((x) => { const s = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [s.boy, s.girl]) if (h) { h.x = x; h.y = 200 } }, trig + 20)
const t0 = Date.now(), T = () => (Date.now() - t0) / 1000
let fightT0 = null, phase = 'pre', deaths = { boy: 0, girl: 0 }, series = [], lastSer = -9, held = new Set(), defeatAt = null, sceneLog = [], prevScenes = '', maxDesync = 0, stuckAt = null, lastQ = null, lastQT = 0
const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k) } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k) } }
const releaseAll = async () => { for (const k of [...held]) await hold(k, false) }
let nc = 0, continues = 0; const contLog = []
let lastBA = true, lastGA = true
while (T() < +tmo) {
  const s = await st()
  if (s.scenes !== prevScenes) { prevScenes = s.scenes; sceneLog.push([+T().toFixed(1), s.scenes]) }
  if (s.qhp !== lastQ) { lastQ = s.qhp; lastQT = T() }
  if (s.intro || (s.bf && s.act === 'intro') || s.scenes.includes('minigame')) { await releaseAll(); await press('Enter', 80); await page.waitForTimeout(500); continue }
  if (s.gone && fightT0 && !defeatAt) { defeatAt = T(); break }
  if (!s.bf && !defeatAt) { await releaseAll(); await page.evaluate((x) => { const q = window.__SAKE_GAME__.scene.getScene('play'); for (const h of [q.boy, q.girl]) if (h) { h.x = x; h.y = 200 } }, trig + 20); await page.waitForTimeout(500); if (T() > 40 && !fightT0) { phase = 'never-started'; break } continue }
  if (fightT0 === null && s.bf) { fightT0 = T(); phase = 'fight'; await page.screenshot({ path: `${OUT}/start.png` }) }
  if (s.balive === false && lastBA) deaths.boy++; if (s.galive === false && lastGA) deaths.girl++
  lastBA = s.balive !== false; lastGA = s.galive !== false
  if (s.gx !== null) maxDesync = Math.max(maxDesync, Math.abs(s.bx - s.gx))
  if (T() - lastSer > 3) { lastSer = T(); series.push({ t: +(T() - (fightT0 ?? T())).toFixed(1), bhp: s.bhp, ghp: s.ghp, qhp: s.qhp, act: s.act, bx: s.bx, gx: s.gx, qx: s.qx, scenes: s.scenes }); if (series.length % 5 == 1) await page.screenshot({ path: `${OUT}/f-${series.length}.png` }) }
  if (+forceHp && !forced && fightT0 && T() - fightT0 > 10 && s.qhp > +forceHp) { forced = true; await page.evaluate((n) => { const q = window.__SAKE_GAME__.scene.getScene('play').queen; q.hp = n }, +forceHp) }
  if (s.qhp !== null && s.qhp <= 0 && !defeatAt) { defeatAt = T(); await page.screenshot({ path: `${OUT}/defeat.png` }) }
  if (defeatAt) break
  if (T() - lastQT > 45 && fightT0) { stuckAt = T(); await page.screenshot({ path: `${OUT}/softlock-suspect.png` }); break }
  if (s.cont) { continues = (typeof continues === 'undefined' ? 0 : continues); await releaseAll(); await page.screenshot({ path: `${OUT}/continue-${nc++}.png` }); await press('Enter', 80); await page.waitForTimeout(900); const a = await st(); contLog.push({ t: +T().toFixed(1), bx: a.bx, gx: a.gx, bhp: a.bhp, ghp: a.ghp, balive: a.balive, galive: a.galive, cont: a.cont, coins: a.coins }); lastQT = T(); continue }
  if (s.balive === false && s.galive === false || s.scenes.includes('gameover') || s.scenes.includes('continue')) { await releaseAll(); await press('Enter', 80); await page.waitForTimeout(600); continue }
  if (s.balive === false || s.galive === false) { /* one down: keep fighting, mash Enter only if a prompt shows */ }
  // P1 boy: ranged (a/d/f/g), P2 girl: melee (arrows , .)
  const dxb = (s.qx ?? s.bx + 100) - s.bx, dxg = (s.qx ?? (s.gx ?? 0) + 100) - (s.gx ?? 0)
  const mid = (lvl.boss.arenaX0 + lvl.boss.arenaX1) / 2
  const nav = async (x, dx, want, L, R) => { if (x < lvl.boss.arenaX0 + 60 || x > lvl.boss.arenaX1 - 60) { await hold(L, false); await hold(R, false); await hold(x < mid ? R : L, true); return } await hold(L, false); await hold(R, false); if (Math.abs(dx) > want + 25) await hold(dx > 0 ? R : L, true); else if (Math.abs(dx) < want - 40) await hold(dx > 0 ? L : R, true) }
  if (s.balive !== false) await nav(s.bx, dxb, 120, 'a', 'd'); else { await hold('a', false); await hold('d', false) }
  if (s.galive !== false && s.gx !== null) await nav(s.gx, dxg, 45, 'ArrowLeft', 'ArrowRight'); else { await hold('ArrowLeft', false); await hold('ArrowRight', false) }
  if (s.balive !== false) await page.keyboard.press('f')
  if (s.galive !== false) await page.keyboard.press(',')
  if (Math.random() < 0.1) { await page.keyboard.press('g'); }
  if (Math.random() < 0.1) { await page.keyboard.press('.') }
  await page.waitForTimeout(80)
}
await releaseAll()
// post-boss flow: advance cutscenes/clear card with the keys a player would use
const post = []
if (defeatAt) {
  for (let i = 0; i < 120; i++) {
    const s = await st(); if (s.scenes !== prevScenes) { prevScenes = s.scenes; sceneLog.push([+T().toFixed(1), s.scenes]) }
    if (i % 6 === 0) { await page.screenshot({ path: `${OUT}/post-${String(i).padStart(2, '0')}.png` }) }
    post.push([+T().toFixed(1), s.scenes, s.ended, s.qhp])
    if (!s.scenes.includes('play') && (s.scenes.includes('worldmap') || s.scenes.includes('menu'))) break
    await page.keyboard.press('f'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(600)
  }
}
const fin = await st().catch(() => null)
const res = { name, stage, diff, phase, defeated: !!defeatAt, tFight: fightT0 ? +((defeatAt ?? T()) - fightT0).toFixed(1) : null, deaths, maxDesyncPx: maxDesync, softlockSuspect: stuckAt, contLog, finalScenes: fin?.scenes, sceneLog, series, errs: errs.slice(0, 8), postLen: post.length, forced, post: post.slice(-12) }
fs.writeFileSync(`${OUT}/res.json`, JSON.stringify(res, null, 1))
console.log(JSON.stringify({ ...res, series: res.series.length, sceneLog: res.sceneLog.slice(-8) }))
await b.close()
