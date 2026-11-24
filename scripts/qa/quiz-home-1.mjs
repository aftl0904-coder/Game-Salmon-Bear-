/**
 * quiz-home-1: stage-6 first open pins Q1 from simple developer (地產發展) pool.
 * Evidence → docs/qa-quiz-home-1/
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47531'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const OUT = path.join(ROOT, 'docs/qa-quiz-home-1')
fs.mkdirSync(OUT, { recursive: true })

const HOME_BAN = ['按揭', '買樓', '睇樓', '供樓']
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/quiz-mall.json'), 'utf8'))
const byId = new Map(bank.questions.map((q) => [q.id, q]))

const report = {
  ok: false,
  checks: {},
  modes: {},
  errors: [],
}

function assertPinned(q, label) {
  assert.ok(q, `${label}: missing question`)
  assert.equal(q.category, 'developer', `${label}: category=${q.category}`)
  assert.equal(q.difficulty, 'normal', `${label}: difficulty=${q.difficulty}`)
  const blob = `${q.prompt}\n${(q.choices || []).join('\n')}`
  for (const k of HOME_BAN) {
    assert.ok(!blob.includes(k), `${label}: banned keyword ${k} in ${q.id}`)
  }
}

async function bootPlay(page, { mode = '1p', stage = 6 } = {}) {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await page.evaluate(({ stageNo, playMode }) => {
    try {
      localStorage.removeItem('quizSeen')
    } catch {
      /* */
    }
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stageNo)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', playMode)
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.registry.set('quizHomeFirstDone', false)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, { stageNo: stage, playMode: mode })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__?.scene?.getScene('play')
        if (!s?.started) return false
        if (s.storyIntro) {
          try {
            s.storyIntro.destroy?.()
          } catch {
            /* */
          }
          s.storyIntro = null
        }
        return true
      })
    )
      return
    await page.waitForTimeout(120)
  }
  throw new Error('play did not start')
}

async function openQuizSnapshot(page) {
  return page.evaluate(async () => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play.physics?.pause?.()
    const { goldfishQuiz } = await import('/src/game/membershipQuiz.ts')
    const quiz = goldfishQuiz(play)
    await new Promise((r) => setTimeout(r, 200))
    const dbg = quiz.debug()
    window.__QUIZ_HOME_MINI__ = quiz
    return {
      questionIds: dbg.questionIds,
      firstId: dbg.questionIds?.[0] ?? null,
      difficulty: dbg.difficulty,
      pinDone: !!window.__SAKE_GAME__.registry.get('quizHomeFirstDone'),
    }
  })
}

async function destroyQuiz(page) {
  await page.evaluate(() => {
    try {
      window.__QUIZ_HOME_MINI__?.destroy?.()
    } catch {
      /* */
    }
    window.__QUIZ_HOME_MINI__ = null
    const play = window.__SAKE_GAME__?.scene?.getScene('play')
    play?.physics?.resume?.()
  })
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  // Unit: pickRoundForQa pinHomeFirst
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
    const unit = await page.evaluate(async () => {
      try {
        localStorage.removeItem('quizSeen')
      } catch {
        /* */
      }
      const { pickRoundForQa } = await import('/src/game/membershipQuiz.ts')
      const pinned = []
      const unpinned = []
      for (let i = 0; i < 12; i++) {
        pinned.push(pickRoundForQa(Math.random, { pinHomeFirst: true })[0])
        unpinned.push(pickRoundForQa(Math.random, { pinHomeFirst: false })[0])
      }
      return { pinned, unpinned }
    })
    for (const q of unit.pinned) assertPinned(q, 'unit-pin')
    report.checks.unitPinAllDevNormal = true
    report.checks.unitPinSampleIds = unit.pinned.map((q) => q.id)
    // Without pin, first can be any category — just record
    report.checks.unitUnpinnedFirstCats = [...new Set(unit.unpinned.map((q) => q.category))]
    await page.close()
  }

  for (const mode of ['1p', '2p']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    page.on('pageerror', (e) => report.errors.push(`${mode}: ${e.message}`))
    await bootPlay(page, { mode, stage: 6 })

    const first = await openQuizSnapshot(page)
    const q1 = byId.get(first.firstId)
    assertPinned(q1, `${mode}-first-open`)
    await page.screenshot({
      path: path.join(OUT, `${mode}-first-q.png`),
      timeout: 8000,
      animations: 'disabled',
    })
    await destroyQuiz(page)

    // Second open same play: should NOT force pin (may still randomly be developer)
    const second = await openQuizSnapshot(page)
    await page.screenshot({
      path: path.join(OUT, `${mode}-second-open.png`),
      timeout: 8000,
      animations: 'disabled',
    })
    await destroyQuiz(page)

    // Stage 7 must not set pin flag / not require developer first
    await bootPlay(page, { mode, stage: 7 })
    const s7flag = await page.evaluate(() => !!window.__SAKE_GAME__.registry.get('quizHomeFirstDone'))
    // stage 7 create should not clear/set the pin path; goldfish not used on s7 stalls
    report.modes[mode] = {
      firstId: first.firstId,
      firstPrompt: q1?.prompt ?? null,
      firstCategory: q1?.category,
      firstDifficulty: q1?.difficulty,
      pinDoneAfterFirst: first.pinDone,
      secondFirstId: second.firstId,
      secondAlsoPinnedDev:
        byId.get(second.firstId)?.category === 'developer' &&
        byId.get(second.firstId)?.difficulty === 'normal',
      stage7quizHomeFirstDone: s7flag,
      shots: [`${mode}-first-q.png`, `${mode}-second-open.png`],
    }
    assert.equal(first.pinDone, true, `${mode}: pin flag after first open`)
    await page.close()
  }

  report.ok = report.errors.length === 0
} catch (e) {
  report.ok = false
  report.errors.push(String(e?.stack || e))
} finally {
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}
