/**
 * Finish ST-06 verification: junk toast, 2P rebound buzz, boss fan, god-clear to win.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.URL || 'http://127.0.0.1:4533/'
const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-finish'
fs.mkdirSync(OUT, { recursive: true })

const results = []
const pass = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', id, typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 200))
}

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 }))
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message)))

const boot = async (mode = '1p') => {
  await page.goto(URL)
  await page.waitForTimeout(4000)
  await page.evaluate((mode) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', mode)
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.registry.set('winScreenShown', false)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, mode)
  await page.waitForTimeout(2500)
  for (let i = 0; i < 16; i++) {
    if (!(await page.evaluate(() => !!window.__SAKE_GAME__?.scene.getScene('play')?.storyIntro))) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
}

const run = (code, a) =>
  page.evaluate(({ code, a }) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return new Function('s', 'a', code)(s, a)
  }, { code, a })

const snap = async (tag) => page.screenshot({ path: path.join(OUT, `${tag}.png`) })

// --- 1P: junk toast ---
await boot('1p')
await run(`s.coffeeDone=true; s.physics.resume(); s.storyIntro=null; for (const h of [s.boy,s.girl]) if(h){ h.hp=6; h.graceUntil=s.time.now+9e5; if(h.body?.reset) h.body.reset(1180,300) }; s.cameras.main.centerOn(1180,180)`)
await page.waitForTimeout(400)
await run(`for (const h of [s.boy,s.girl]) if(h){ if(h.body?.reset) h.body.reset(1220,300) }; s.cameras.main.centerOn(1220,180)`)
await page.waitForTimeout(800)
const junkTip = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const texts = s.children.list.filter((o) => o.type === 'Text').map((o) => o.text)
  return {
    taught: !!s.s6world?.junkTaught,
    tip: texts.find((t) => /地下雜物|雜物/.test(t)),
    vis: s.s6world?.junk?.map((j) => j.root.visible),
  }
})
await snap('F01-junk-toast')
pass('junk-teach-toast', junkTip.taught || /雜物/.test(junkTip.tip || ''), junkTip)

// --- Boss fan ---
await run(`s.coffeeDone=true; s.bossOn=true; for (const h of [s.boy,s.girl]) if(h){ if(h.body?.reset) h.body.reset(4900,300); h.hp=6; h.graceUntil=s.time.now+9e5 }; s.cameras.main.centerOn(4900,180)`)
await page.waitForTimeout(1500)
const fan = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const q = s.queen
  if (q && typeof q.go === 'function') {
    try {
      q.go('windup')
    } catch {}
  }
  if (q) q.act = 'windup'
  s.s6world?.setFan(true)
  const before = s.boy.body.velocity.x
  s.boy.setVelocity(160, 0)
  const mul = s.s6world?.headwindMul(s.boy.x, true)
  // simulate one tick of headwind
  const body = s.boy.body
  body.setVelocityX(body.velocity.x * (mul ?? 1))
  return {
    fanOn: !!s.s6world?.fanOn,
    mul,
    vx: body.velocity.x,
    before,
    act: q?.act,
  }
})
await snap('F02-boss-fan')
pass('boss-fan-headwind', fan.fanOn && fan.mul < 0.9 && fan.vx < 160, fan)

// --- God clear to win ---
await run(`
  s.coffeeDone=true; s.physics.resume(); s.storyIntro=null;
  for (const h of [s.boy,s.girl]) if(h){ h.hp=6; h.graceUntil=s.time.now+9e5; if(h.body?.reset) h.body.reset(5000,300) }
  s.cameras.main.centerOn(5000,180);
  s.bossOn=true;
  // Kill all non-boss, then boss
  for (const o of s.enemies.getChildren()) {
    const e = o;
    if (!e.active) continue;
    e.hp = 0;
    try { e.die?.(1) } catch { try { e.destroy() } catch {} }
  }
`)
await page.waitForTimeout(800)
// Ensure honey / win path — trigger queenDefeated if needed
const win = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const bossAlive = s.enemies.getChildren().some((o) => o.active && o.boss)
  if (bossAlive) {
    const boss = s.enemies.getChildren().find((o) => o.active && o.boss)
    boss.hp = 0
    try {
      boss.die?.(1)
    } catch {
      boss.destroy()
    }
  }
  try {
    s.queenDefeated?.()
  } catch {}
  try {
    s.checkWin?.()
  } catch {}
  return {
    ended: !!s.ended,
    win: !!s.registry.get('winScreenShown'),
    clearModal: !!s.clearModal,
    bossLeft: s.enemies.getChildren().filter((o) => o.active && o.boss).length,
  }
})
await page.waitForTimeout(1500)
const win2 = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  return {
    ended: !!s.ended,
    win: !!s.registry.get('winScreenShown'),
    clearModal: !!s.clearModal,
    overlay: !!s.clearOverlay,
  }
})
await snap('F03-clear')
pass('stage6-clear-path', win2.ended || win2.win || win2.clearModal || win2.overlay || win.ended, { win, win2 })

// --- 2P goldfish rebound ---
await boot('2p')
const twoP = await page.evaluate(async () => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  s.coffeeDone = true
  s.physics.resume()
  s.storyIntro = null
  const { goldfishQuiz } = await import('/src/game/membershipQuiz.ts')
  const mini = goldfishQuiz(s)
  window.__gf = mini
  s.storyIntro = mini
  return { mode: s.registry.get('playMode'), started: true }
})
await page.waitForTimeout(400)
// P1 buzz + wrong answer (pick last choice often wrong) then P2 rebound
await page.keyboard.press('Enter')
await page.waitForTimeout(150)
await page.keyboard.press('Digit4')
await page.keyboard.press('KeyD')
await page.waitForTimeout(600)
const afterWrong = await page.evaluate(() => {
  const texts = []
  const walk = (n) => {
    for (const o of n || []) {
      if (o.type === 'Text' && o.text) texts.push(String(o.text))
      if (o.list) walk(o.list)
    }
  }
  walk(window.__SAKE_GAME__.scene.getScene('play').children.list)
  return {
    rebound: texts.some((t) => /可以搶返|琪寶寶可以|倫寶可以|搶返中/.test(t)),
    sample: texts.filter((t) => /搶|錯|琪|倫|幣/.test(t)).slice(0, 10),
    hasP2: texts.some((t) => t === 'P2'),
  }
})
await snap('F04-2p-rebound')
// P2 buzz with Shift
await page.keyboard.down('Shift')
await page.waitForTimeout(100)
await page.keyboard.up('Shift')
await page.waitForTimeout(200)
await page.keyboard.press('Digit1')
await page.keyboard.press('KeyA')
await page.waitForTimeout(500)
pass('2p-buzz-ui', twoP.mode === '2p' && afterWrong.hasP2, { twoP, afterWrong })
pass('2p-rebound-after-wrong', afterWrong.rebound, afterWrong)

pass('no-pageerror', errs.length === 0, errs.slice(0, 5))

const summary = { results, fails: results.filter((r) => !r.ok).length, errs, out: OUT }
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('SUMMARY', JSON.stringify({ fails: summary.fails, n: results.length }, null, 2))
await b.close()
process.exit(summary.fails ? 1 : 0)
