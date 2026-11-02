// Real run of 泥鬃 phase 1: a keyboard-only bot (move + jump) that tries to dodge every charge by jumping
// over him, waiting on the stone farthest from where he starts. Logs every hit it takes.
//   LAG=ms models a slow thumb (reaction delay); GAP=px is how close he must be before the bot jumps.
import { chromium } from 'playwright'
import fs from 'fs'
const URL = process.env.URL || 'http://127.0.0.1:47613/'
const OUT = process.env.OUT || '/tmp/fix4b/docs/qa-s4fix'
const LABEL = process.env.LABEL || 'dodge'
const RUN_S = +(process.env.RUN_S || 40)
const LAG = +(process.env.LAG || 0)
const GAP = +(process.env.GAP || 120)
const DIFF = process.env.DIFF || 'normal'
const START_X = +(process.env.START_X || 3335)
const START_Y = +(process.env.START_Y || 261)
const STAY = process.env.STAY === '1'
const FORCE_HP = +(process.env.FORCE_HP || 0)
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript((d) => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', d) }, DIFF)
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' | ' + (e.stack||'').split('\n').slice(0,6).join(' <- ')))
await page.goto(URL); await page.waitForTimeout(4500)
await page.evaluate((d) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', d); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, DIFF)
await page.waitForTimeout(3500)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.storyIntro?.destroy(); s.storyIntro = null; s.started = true; s.startedAt = s.time.now; s.pauseReadyAt = s.time.now + 1200; if (s.scene.get('UIScene')) s.scene.setVisible(true, 'UIScene') })
await page.waitForTimeout(300)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.girl ?? s.boy; s.__h = h; s.coffeeDone = true; s.lastCheckpointX = 3100; h.x = 3340; h.y = 285; h.hp = h.maxHp = 99 })
for (let i = 0; i < 80; i++) {
  const o = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { q: !!s.queen, intro: !!s.storyIntro } })
  if (o.q && !o.intro) break
  await page.keyboard.press('f'); await page.waitForTimeout(400)
}
await page.waitForTimeout(200)
await page.evaluate(([x, y]) => { const h = window.__SAKE_GAME__.scene.getScene('play').__h; h.x = x; h.y = y }, [START_X, START_Y])
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.__h; const q = s.queen; return { px: +h.x.toFixed(1), py: +h.y.toFixed(1), hp: h.hp, air: !!h.laneJumping, qx: q ? +q.x.toFixed(1) : null, act: q?.act ?? null, qhp: q?.hp ?? null } })
const down = new Set()
const key = async (k, on) => { if (on && !down.has(k)) { down.add(k); await page.keyboard.down(k) } else if (!on && down.has(k)) { down.delete(k); await page.keyboard.up(k) } }
const STONE = { L: +(process.env.STONE_L || 3335), R: +(process.env.STONE_R || 3625) }
const NOCLIMB = process.env.NOCLIMB === '1'
const trace = []; const hits = []; const charges = []
const t0 = Date.now(); let lastShotT = -1, forced = false, shotAnt = false, lastClimb = 0, prevQx = null, jumpRelease = 0, lastJump = -9, prev = null, prevAct = null, pendingJumpAt = 0
while ((Date.now() - t0) / 1000 < RUN_S) {
  const s = await st(); const t = (Date.now() - t0) / 1000; s.t = +t.toFixed(2); trace.push(s)
  if (prev && s.hp < prev.hp) hits.push({ t: s.t, px: s.px, py: s.py, qx: s.qx, act: s.act, air: s.air })
  if (s.act === 'charge' && prevAct !== 'charge') charges.push({ t: s.t, qx: s.qx, px: s.px, py: s.py, air: s.air, hp: s.hp })
  const prevQx0 = prevQx; prevQx = s.qx; prev = s; prevAct = s.act
  if (FORCE_HP && t > 3 && !forced) { forced = true; await page.evaluate((n) => { const q = window.__SAKE_GAME__.scene.getScene('play').queen; q.hp = n; q.updatePhase() }, FORCE_HP) }
  if (s.act === 'anticip' && !shotAnt && t > 4) { shotAnt = true; console.log('SCENES@anticip', JSON.stringify(await page.evaluate(() => { const g = window.__SAKE_GAME__; return { scenes: g.scene.getScenes(true).map((x) => x.scene.key), storyIntro: !!g.scene.getScene('play').storyIntro, paused: g.scene.getScene('play').physics.world.isPaused, texts: g.scene.getScene('play').children.list.filter((o) => o.type === 'Text' && o.visible && /傾斜|第 /.test(o.text)).map((o) => [o.text, o.depth, o.scrollFactorX]), coffeeDone: g.scene.getScene('play').coffeeDone, uiTexts: g.scene.getScene('UIScene').children.list.filter((o) => o.type === 'Text' && o.visible && /傾斜/.test(o.text)).length } }))); await page.screenshot({ path: `${OUT}/${LABEL}_anticip-warning.png` }) }
  if (process.env.SHOTS && Math.floor(t) !== lastShotT) { lastShotT = Math.floor(t); await page.screenshot({ path: `/tmp/shots/s${lastShotT}.png` }) }
  if (jumpRelease && Date.now() > jumpRelease) { jumpRelease = 0; await key('g', false) }
  if (s.act === 'charge' && s.qx !== null) {
    const gap = Math.abs(s.qx - s.px)
    const dirB = prevQx0 === null ? 0 : Math.sign(s.qx - prevQx0)
    const closing = dirB !== 0 && Math.sign(s.px - s.qx) === dirB
    if (closing && gap < GAP && !s.air && !jumpRelease && t - lastJump > 1.0) {
      if (!pendingJumpAt) pendingJumpAt = Date.now() + LAG
      if (Date.now() >= pendingJumpAt) {
        pendingJumpAt = 0; lastJump = t
        await key('d', s.qx > s.px); await key('a', s.qx < s.px)
        await key('g', true); jumpRelease = Date.now() + 230
      }
    }
  }
  if (!STAY) {
    const tx = s.qx !== null && s.qx > 3480 ? STONE.L : STONE.R
    if (!s.air && !jumpRelease) {
      await key('d', s.px < tx - 8); await key('a', s.px > tx + 8)
      const edge = tx === STONE.R ? 3580 : 3380
      if (!NOCLIMB && s.py > 270 && Math.abs(s.px - edge) < 16 && Math.abs(s.px - tx) > 20 && Date.now() - lastClimb > 700) { lastClimb = Date.now(); await key('g', true); jumpRelease = Date.now() + 230 }
    }
  }
  await page.waitForTimeout(20)
}
for (const k of [...down]) await key(k, false)
await page.screenshot({ path: `${OUT}/${LABEL}.png` })
fs.writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ errs, charges, hits, trace }))
console.log(JSON.stringify({ label: LABEL, lagMs: LAG, gap: GAP, charges: charges.length, hits: hits.length, lastAct: trace[trace.length - 1]?.act, lastQhp: trace[trace.length - 1]?.qhp, errs, hitDetail: hits.slice(0, 8), chargeDetail: charges }))
await b.close()
