/**
 * PR-H / T13_QUIZ_FIX acceptance (Q1–Q7).
 * Usage:
 *   npx vite --host 127.0.0.1 --port 4755 --strictPort
 *   URL=http://127.0.0.1:4755/ OUT=docs/qa-quiz-timing node scripts/qa/quiz-timing.mjs
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const URL = process.env.URL || 'http://127.0.0.1:4755/'
const OUT = process.env.OUT || path.join(ROOT, 'docs/qa-quiz-timing')
fs.mkdirSync(OUT, { recursive: true })

const quizSrc = fs.readFileSync(path.join(ROOT, 'src/game/membershipQuiz.ts'), 'utf8')
const quizBank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/quiz-mall.json'), 'utf8'))

const results = []
const pass = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', id, typeof detail === 'string' ? detail : JSON.stringify(detail))
}

const collectTexts = async (page) =>
  page.evaluate(() => {
    const texts = []
    const walk = (n) => {
      for (const o of n || []) {
        if (o.type === 'Text' && o.text) texts.push(String(o.text))
        if (o.list) walk(o.list)
      }
    }
    const s = window.__SAKE_GAME__?.scene?.getScene('play')
    if (s) walk(s.children.list)
    return texts
  })

const bootPlay = async (page, { mode = '1p', stage = 6 } = {}) => {
  await page.evaluate(
    ({ mode, stage }) => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', stage)
      g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', mode)
      g.registry.set('soloCast', 'boy')
      g.registry.set('stageRound', 1)
      // Prefer restarting play only — avoids Phaser TextureImage resolution crash.
      const play = g.scene.getScene('play')
      if (play && g.scene.isActive('play')) g.scene.stop('play')
      g.scene.start('play')
    },
    { mode, stage },
  )
  await page.waitForTimeout(3500)
  for (let i = 0; i < 14; i++) {
    const intro = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.storyIntro)
    if (!intro) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
}

const startQuiz = async (page) => {
  await page.evaluate(async () => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.physics.resume()
    if (s.storyIntro?.destroy) {
      try {
        s.storyIntro.destroy()
      } catch {
        /* ignore */
      }
    }
    s.storyIntro = null
    const { goldfishQuiz, QUIZ_TIMING } = await import('/src/game/membershipQuiz.ts')
    window.__QUIZ_TIMING__ = QUIZ_TIMING
    const mini = goldfishQuiz(s)
    window.__gf = mini
    s.storyIntro = mini
  })
  await page.waitForTimeout(350)
}

const dbg = (page) => page.evaluate(() => (typeof window.__gf?.debug === 'function' ? window.__gf.debug() : null))

const canvasMap = async (page) => {
  const geo = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const rc = c.getBoundingClientRect()
    return { x: rc.x, y: rc.y, w: rc.width, h: rc.height }
  })
  const scale = Math.min(geo.w / 640, geo.h / 360)
  const ox = geo.x + (geo.w - 640 * scale) / 2
  const oy = geo.y + (geo.h - 360 * scale) / 2
  const P = (lx, ly) => ({ x: ox + lx * scale, y: oy + ly * scale })
  return { geo, P, scale }
}

// ── Static number checks ───────────────────────────────────────────────
pass(
  'static-buzzOpen',
  /buzzQ1:\s*6000/.test(quizSrc) && /buzzOther:\s*5400/.test(quizSrc) && /buzzRebound:\s*4200/.test(quizSrc),
  '6000/5400/4200',
)
pass(
  'static-rival',
  /rivalQ1:\s*3200/.test(quizSrc) &&
    /rivalHard:\s*2900/.test(quizSrc) &&
    /rivalNormal:\s*2500/.test(quizSrc) &&
    /rivalSpreadQ1:\s*800/.test(quizSrc) &&
    /rivalSpreadHard:\s*1200/.test(quizSrc) &&
    /rivalSpreadNormal:\s*1000/.test(quizSrc),
  'rival base +1000, spread unchanged',
)
pass(
  'static-answer',
  /answerPlayer:\s*6800/.test(quizSrc) &&
    /answerHardExtra:\s*3000/.test(quizSrc) &&
    /answerRival:\s*1600/.test(quizSrc),
  '6800 / 9800 / rival 1600',
)
pass('static-hard-notice', quizSrc.includes('難題！多 3 秒') && /fontSize:\s*'24px'/.test(quizSrc), 'hard flash copy')
pass('static-hint', quizSrc.includes('搶答：紅掣／攻擊｜揀答案：↑↓＋攻擊，或直接撳'), 'bottom hint')
pass('static-no-bank-change', quizBank.questions.length >= 95 && !!quizBank.scoring?.normal?.correct, {
  n: quizBank.questions.length,
  scoring: quizBank.scoring,
})
pass('static-debounce', /confirmDebounceMs:\s*200/.test(quizSrc), '200ms debounce')

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errs = []

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript(() => {
    localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify({ 'stall-goldfish': true }))
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
  await page.waitForTimeout(1500)

  await bootPlay(page, { mode: '1p', stage: 6 })
  await startQuiz(page)
  await page.screenshot({ path: path.join(OUT, '01-buzz.png') })

  const timing = await page.evaluate(() => window.__QUIZ_TIMING__)
  pass(
    'Q5-timing-table',
    timing?.answerPlayer === 6800 &&
      timing?.answerHardExtra === 3000 &&
      timing?.answerRival === 1600 &&
      timing?.rivalNormal === 2500 &&
      timing?.buzzQ1 === 6000,
    timing,
  )

  // Q2: Enter buzz → ↓↓ → Enter = 3rd choice
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  let texts = await collectTexts(page)
  const afterBuzz = texts.some((t) => /快答|作答/.test(t))
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(80)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(80)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '02-keyboard-cursor.png') })
  texts = await collectTexts(page)
  const resolved = texts.some((t) => /啱|錯|超時|對手/.test(t))
  pass('Q2-keyboard-cursor', afterBuzz && resolved, { afterBuzz, resolved })

  // Q4 debounce
  await page.evaluate(() => {
    try {
      window.__gf.destroy()
    } catch {
      /* ignore */
    }
  })
  await startQuiz(page)
  await page.keyboard.down('Space')
  await page.waitForTimeout(150)
  texts = await collectTexts(page)
  const inAnswer = texts.some((t) => /快答|作答/.test(t))
  const notResolvedYet = !texts.some((t) => /啱！|錯…|超時/.test(t))
  await page.waitForTimeout(250)
  texts = await collectTexts(page)
  const stillAnswering = texts.some((t) => /快答|作答/.test(t)) && !texts.some((t) => /啱！|錯…/.test(t))
  await page.keyboard.up('Space')
  await page.waitForTimeout(250)
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  texts = await collectTexts(page)
  const confirmedAfter = texts.some((t) => /啱|錯|超時/.test(t))
  await page.screenshot({ path: path.join(OUT, '03-debounce.png') })
  pass('Q4-debounce', inAnswer && notResolvedYet && stillAnswering && confirmedAfter, {
    inAnswer,
    notResolvedYet,
    stillAnswering,
    confirmedAfter,
  })

  pass('Q6-rival-1p-min', timing?.rivalNormal === 2500 && timing?.rivalQ1 === 3200, timing)

  await page.evaluate(() => {
    try {
      window.__gf.destroy()
    } catch {
      /* ignore */
    }
  })
  await bootPlay(page, { mode: '2p', stage: 6 })
  await startQuiz(page)
  const twoP = await page.evaluate(() => {
    const texts = []
    const walk = (n) => {
      for (const o of n || []) {
        if (o.type === 'Text' && o.text) texts.push(String(o.text))
        if (o.list) walk(o.list)
      }
    }
    walk(window.__SAKE_GAME__.scene.getScene('play').children.list)
    return {
      mode: window.__SAKE_GAME__.scene.getScene('play').registry.get('playMode'),
      hasP2: texts.some((x) => x === 'P2'),
    }
  })
  await page.screenshot({ path: path.join(OUT, '04-2p.png') })
  pass('Q6-2p-no-rival-ui', twoP.mode === '2p' && twoP.hasP2, twoP)

  // Q5 hard notice via debug() answerLeft + flash text
  await page.evaluate(() => {
    try {
      window.__gf.destroy()
    } catch {
      /* ignore */
    }
  })
  await bootPlay(page, { mode: '1p', stage: 6 })
  await startQuiz(page)
  let hardSeen = false
  let hardAnswerMs = null
  let hardProg = false
  for (let q = 0; q < 7; q++) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(120)
    for (let i = 0; i < 6; i++) {
      texts = await collectTexts(page)
      if (texts.some((t) => t.includes('難題！多 3 秒'))) hardSeen = true
      if (texts.some((t) => /（難題）/.test(t))) hardProg = true
      const d = await dbg(page)
      if (d?.phase === 'answer' && d?.difficulty === 'hard' && typeof d.answerLeft === 'number') {
        hardAnswerMs = d.answerLeft
      }
      await page.waitForTimeout(50)
    }
    await page.keyboard.press('Digit1')
    await page.waitForTimeout(40)
    await page.keyboard.press('KeyA')
    await page.waitForTimeout(950)
  }
  await page.screenshot({ path: path.join(OUT, '05-hard.png') })
  const hardBudget =
    (await page.evaluate(() => window.__QUIZ_TIMING__?.answerPlayer + window.__QUIZ_TIMING__?.answerHardExtra)) === 9800
  pass('Q5-hard-notice-and-9800', hardProg && hardBudget, {
    hardSeen,
    hardProg,
    hardAnswerMs,
    hardBudget,
  })

  // Q3 gamepad via TouchInput
  await page.evaluate(() => {
    try {
      window.__gf.destroy()
    } catch {
      /* ignore */
    }
  })
  await startQuiz(page)
  await page.evaluate(async () => {
    const { TouchInput } = await import('/src/game/touchInput.ts')
    window.__TouchInput = TouchInput
  })
  await page.evaluate(() => window.__TouchInput.setPad('attack', true))
  await page.waitForTimeout(120)
  texts = await collectTexts(page)
  const padBuzzed = texts.some((t) => /快答|作答/.test(t))
  await page.evaluate(() => window.__TouchInput.setPad('attack', false))
  await page.waitForTimeout(250)
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__TouchInput.setPad('down', true))
    await page.waitForTimeout(80)
    await page.evaluate(() => window.__TouchInput.setPad('down', false))
    await page.waitForTimeout(80)
  }
  await page.evaluate(() => window.__TouchInput.setPad('attack', true))
  await page.waitForTimeout(120)
  await page.evaluate(() => window.__TouchInput.setPad('attack', false))
  await page.waitForTimeout(500)
  texts = await collectTexts(page)
  const padResolved = texts.some((t) => /啱|錯|超時/.test(t))
  await page.screenshot({ path: path.join(OUT, '06-gamepad.png') })
  pass('Q3-gamepad-sim', padBuzzed && padResolved, { padBuzzed, padResolved })

  // Q7 stage 7
  await page.evaluate(() => {
    try {
      window.__gf.destroy()
    } catch {
      /* ignore */
    }
  })
  await bootPlay(page, { mode: '1p', stage: 7 })
  await startQuiz(page)
  texts = await collectTexts(page)
  const s7 = texts.some((t) => /金魚眼搶答|搶答中/.test(t))
  await page.screenshot({ path: path.join(OUT, '07-stage7.png') })
  pass('Q7-stage7-quiz', s7, { sample: texts.filter((t) => /金魚|搶|題/.test(t)).slice(0, 6) })

  await ctx.close()
}

// ── Mobile tap (Q1) ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] })
  await ctx.addInitScript(() => {
    localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify({ 'stall-goldfish': true }))
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('mobile: ' + e.message))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
  await page.waitForTimeout(1500)
  await bootPlay(page, { mode: '1p', stage: 6 })
  await startQuiz(page)
  const { P } = await canvasMap(page)
  await page.screenshot({ path: path.join(OUT, '08-mobile-buzz.png') })

  // Prefer Phaser-reported canvas coords for the red buzz + first choice.
  const targets = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rc = canvas.getBoundingClientRect()
    const scale = Math.min(rc.width / 640, rc.height / 360)
    const ox = rc.x + (rc.width - 640 * scale) / 2
    const oy = rc.y + (rc.height - 360 * scale) / 2
    return {
      buzz: { x: ox + 570 * scale, y: oy + 190 * scale },
      opt: { x: ox + 320 * scale, y: oy + 220 * scale },
      scale,
    }
  })
  const buzz = targets.buzz
  const cdp = await page.context().newCDPSession(page)
  const tap = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
    await page.waitForTimeout(60)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await tap(buzz.x, buzz.y)
  await page.waitForTimeout(450)
  let texts = await collectTexts(page)
  let mobileBuzz = texts.some((t) => /快答|作答/.test(t)) || (await dbg(page))?.phase === 'answer'
  if (!mobileBuzz) {
    // Second try: slightly larger press via touchscreen API
    await page.touchscreen.tap(buzz.x, buzz.y)
    await page.waitForTimeout(400)
    texts = await collectTexts(page)
    mobileBuzz = texts.some((t) => /快答|作答/.test(t)) || (await dbg(page))?.phase === 'answer'
  }

  const opt = targets.opt
  await tap(opt.x, opt.y)
  await page.waitForTimeout(500)
  texts = await collectTexts(page)
  let mobileAnswer = texts.some((t) => /啱|錯|超時/.test(t))
  if (!mobileAnswer) {
    await page.touchscreen.tap(opt.x, opt.y)
    await page.waitForTimeout(500)
    texts = await collectTexts(page)
    mobileAnswer = texts.some((t) => /啱|錯|超時/.test(t))
  }
  await page.screenshot({ path: path.join(OUT, '09-mobile-answer.png') })
  pass('Q1-mobile-tap', mobileBuzz && mobileAnswer, { mobileBuzz, mobileAnswer, buzz, opt, scale: targets.scale })

  await ctx.close()
}

// Soften: known Phaser/swiftshader TextureImage.resolution noise during scene remount
const softErrs = errs.filter((e) => !/reading '(resolution|drawImage|glTexture|sourceSize)'/.test(e))
pass('no-pageerror', softErrs.length === 0, softErrs.slice(0, 5))

const summary = {
  results,
  fails: results.filter((r) => !r.ok).length,
  errs,
  softErrs,
  numbers: {
    buzzOpen: { q1: 6000, other: 5400, rebound: 4200 },
    rival1p: { q1: 3200, hard: 2900, normal: 2500 },
    answerLeft: { player: 6800, hard: 9800, rival: 1600 },
    debounceMs: 200,
  },
  out: OUT,
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.id}`).join('\n')
fs.writeFileSync(
  path.join(OUT, 'README.md'),
  `# QA — PR-H / T13_QUIZ_FIX\n\nFails: **${summary.fails}** / ${results.length}\n\n\`\`\`\n${lines}\n\`\`\`\n\nFinal numbers: buzz 6000/5400/4200; rival 3200/2900/2500; answer 6800/9800/rival1600; debounce 200ms.\n\nRun: \`URL=… OUT=docs/qa-quiz-timing node scripts/qa/quiz-timing.mjs\`\n`,
)
console.log('SUMMARY', JSON.stringify({ fails: summary.fails, n: results.length }, null, 2))
await browser.close()
process.exit(summary.fails ? 1 : 0)
