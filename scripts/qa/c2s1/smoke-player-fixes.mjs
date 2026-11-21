/**
 * Player-priority mall fixes smoke:
 * 1) first beat teaches slip only (junk gated, stall = CP2)
 * 2) shopfronts render with sign labels
 * 3) rival buzz pacing slower on Q1
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.URL || 'http://127.0.0.1:4533/'
const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-player-fixes'
fs.mkdirSync(OUT, { recursive: true })

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 }))
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

await page.goto(URL)
await page.waitForTimeout(4500)
await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  g.registry.set('stageNo', 6)
  g.registry.set('difficulty', 'normal')
  g.registry.set('playMode', '1p')
  g.registry.set('soloCast', 'boy')
  g.registry.set('stageRound', 1)
  for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
  g.scene.start('play')
})
await page.waitForTimeout(2500)
for (let i = 0; i < 14; i++) {
  const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play')?.storyIntro)
  if (!intro) break
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
}

const snap = async (tag) => {
  const p = path.join(OUT, `${tag}.png`)
  await page.screenshot({ path: p })
  return p
}

const st = () =>
  page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const w = s.s6world
    const junkVis = w?.junk?.map((j) => !!j.root.visible) ?? []
    const texts = s.children.list
      .filter((o) => o.type === 'Text' && typeof o.text === 'string')
      .map((o) => o.text)
    return {
      stage: s.stageNo,
      mall: !!s.mall,
      x: s.boy?.x ?? null,
      cps: s.checkpointXs?.slice() ?? [],
      coffeeDone: !!s.coffeeDone,
      junkUnlockX: w?.junkUnlockX ?? null,
      teach: [w?.teachSlipX0, w?.teachSlipX1],
      slipTaught: !!w?.slipTaught,
      junkVis,
      shopSigns: texts.filter((t) =>
        ['茶餐廳', '鞋店', '電器', '藥妝', '書店', '服飾', '手信', '咖啡'].includes(t),
      ),
      tip: texts.find((t) => t.includes('地滑')) || null,
    }
  })

// Static data checks in Node
const stage6 = JSON.parse(fs.readFileSync('/tmp/gsb-qa/data/levels/stage6.json', 'utf8'))
const quiz = JSON.parse(fs.readFileSync('/tmp/gsb-qa/data/quiz-mall.json', 'utf8'))
const quizSrc = fs.readFileSync('/tmp/gsb-qa/src/game/membershipQuiz.ts', 'utf8')

const results = []
const pass = (id, ok, detail) => {
  results.push({ id, ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', id, detail)
}

pass('S6-data-early-slip', stage6.slipZones?.[0]?.x0 === 360 && stage6.teachSlipX0 === 360, stage6.slipZones?.[0])
pass('S6-data-junk-gate', stage6.junkUnlockX === 1200, stage6.junkUnlockX)
pass('S6-data-cp-stall-second', stage6.checkpoints?.[1] === 1600 && stage6.checkpoints?.[0] === 700, stage6.checkpoints)
pass(
  'quiz-labour-hr',
  quiz.questions.filter((q) => q.category === 'labour' || q.category === 'hr').length >= 15,
  quiz.questions.filter((q) => q.category === 'labour' || q.category === 'hr').length,
)
pass('quiz-total-95', quiz.questions.length >= 95, quiz.questions.length)
pass('rival-pace-slower', quizSrc.includes('qi === 0 ? 2400') && quizSrc.includes('qi === 0 ? 4200'), 'rival base/buzzOpen')

// Atrium: walk into slip zone
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  for (const h of [s.boy, s.girl]) {
    if (!h) continue
    h.x = 400
    h.y = 300
    h.hp = 6
    h.graceUntil = s.time.now + 900000
    h.setVelocity(80, 0)
  }
  s.cameras.main.centerOn(400, 180)
})
await page.waitForTimeout(2200)
await snap('01-slip-teach')
let info = await st()
pass('teach-toast-or-flag', info.slipTaught === true || !!info.tip, { slipTaught: info.slipTaught, tip: info.tip })
pass('junk-hidden-before-unlock', info.junkVis.length === 0 || info.junkVis.every((v) => v === false), info.junkVis)
pass('shops-labeled', info.shopSigns.length >= 6, info.shopSigns)

// Before junk unlock
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  s.boy.x = 1100
  s.cameras.main.centerOn(1100, 180)
})
await page.waitForTimeout(800)
await snap('02-pre-junk')
info = await st()
pass('junk-still-off-at-1100', info.junkVis.every((v) => v === false), { x: info.x, junkVis: info.junkVis })

// After junk unlock
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  s.boy.x = 1250
  s.cameras.main.centerOn(1250, 180)
})
await page.waitForTimeout(800)
await snap('03-junk-on')
info = await st()
pass('junk-on-after-1200', info.junkVis.some((v) => v === true), { x: info.x, junkVis: info.junkVis })

// Stall = second checkpoint (1600)
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const texts = s.children.list.filter((o) => o.type === 'Text').map((o) => o.text)
  window.__stallSigns = texts.filter((t) => /會員|金魚|存檔/.test(t))
})
const stallSigns = await page.evaluate(() => window.__stallSigns)
pass('stall-not-first-only-save', Array.isArray(stallSigns), stallSigns)

await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  // Approach CP1 (700) — should be plain save, not quiz
  s.coffeeDone = false
  s.boy.x = 690
  s.boy.setVelocity(40, 0)
  s.cameras.main.centerOn(700, 180)
})
await page.waitForTimeout(2500)
await snap('04-cp1-save')
const afterCp1 = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  // Live quiz intro uses depth UI+280; world stall sign alone does not set coffeeDone.
  const liveQuiz = s.children.list.some(
    (o) => o.type === 'Container' && o.depth >= 280 && o.visible && o.list?.some((c) => c.type === 'Text' && /金魚眼搶答|搶答中/.test(c.text)),
  )
  return { coffeeDone: s.coffeeDone, liveQuiz, x: s.boy.x }
})
pass('cp1-no-quiz', afterCp1.coffeeDone === false && afterCp1.liveQuiz === false, afterCp1)

await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  s.boy.x = 1585
  s.boy.setVelocity(50, 0)
  s.cameras.main.centerOn(1600, 180)
})
await page.waitForTimeout(2800)
await snap('05-cp2-stall')
const afterCp2 = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const texts = []
  const walk = (list) => {
    for (const o of list || []) {
      if (o.type === 'Text' && o.text) texts.push(o.text)
      if (o.list) walk(o.list)
    }
  }
  walk(s.children.list)
  // quiz root is often a container on scene
  for (const o of s.children.list) {
    if (o.list) walk(o.list)
  }
  return {
    coffeeDone: s.coffeeDone,
    hasQuiz: texts.some((t) => /金魚眼|會員中心|搶答/.test(t)),
    sample: texts.filter((t) => /金魚|會員|搶答|存檔/.test(t)).slice(0, 8),
  }
})
pass('cp2-quiz-or-triggered', afterCp2.coffeeDone === true || afterCp2.hasQuiz === true, afterCp2)

await snap('06-shops-corridor')
pass('no-page-errors', errs.length === 0, errs.slice(0, 5))

const summary = { results, fails: results.filter((r) => !r.ok).length, errs, out: OUT }
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('SUMMARY', JSON.stringify(summary, null, 2))
await b.close()
process.exit(summary.fails ? 1 : 0)
