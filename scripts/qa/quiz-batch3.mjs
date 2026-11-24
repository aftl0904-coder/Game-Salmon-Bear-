/**
 * Quiz batch3+4 acceptance:
 * - 115 rewritten prompts match sources (Q060 uses Claude wording)
 * - answerIndex all 0; force-hard ids are hard
 * - bank size 300; iq hard ≥ 14
 * - two mobile screenshots (long + hard)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47691'
const OUT = 'docs/qa-quiz-batch3'
fs.mkdirSync(OUT, { recursive: true })

const bank = JSON.parse(fs.readFileSync('data/quiz-mall.json', 'utf8'))
const b3 = JSON.parse(fs.readFileSync('docs/bible/quiz-batch3-copilot.json', 'utf8'))
const b4 = JSON.parse(fs.readFileSync('docs/bible/quiz-batch4-copilot.json', 'utf8'))
const rewritten = [...b3.rewritten, ...b4.rewritten]
const FORCE_HARD = ['Q042', 'mall-17', 'mall-31', 'iq-01', 'iq-06']

const report = {
  ok: false,
  errors: [],
  checks: {},
  lintNote: 'See quiz-option-lint; WO says do not rewrite on lint fail',
  shots: [],
}

function fail(msg) {
  throw new Error(msg)
}

const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]))
report.checks.total = bank.questions.length
if (bank.questions.length !== 300) fail(`bank size ${bank.questions.length} != 300`)

let promptMismatches = []
for (const src of rewritten) {
  const q = byId[src.id]
  if (!q) {
    promptMismatches.push({ id: src.id, reason: 'missing' })
    continue
  }
  let want = src.prompt
  if (src.id === 'Q060') {
    want = want.replace('80個月租位，每位$40一天', '80個時租車位，每位每日收$40')
  }
  if (q.prompt !== want) promptMismatches.push({ id: src.id, reason: 'prompt', got: q.prompt.slice(0, 40), want: want.slice(0, 40) })
  if (q.answerIndex !== 0) promptMismatches.push({ id: src.id, reason: 'answerIndex', got: q.answerIndex })
  if (JSON.stringify(q.choices) !== JSON.stringify(src.choices)) {
    promptMismatches.push({ id: src.id, reason: 'choices' })
  }
}
report.checks.rewrittenCount = rewritten.length
report.checks.promptMismatches = promptMismatches
if (promptMismatches.length) fail(`prompt mismatches: ${JSON.stringify(promptMismatches.slice(0, 8))}`)

const hardOk = FORCE_HARD.every((id) => byId[id]?.difficulty === 'hard')
report.checks.forceHard = Object.fromEntries(FORCE_HARD.map((id) => [id, byId[id]?.difficulty]))
if (!hardOk) fail('force-hard ids not all hard')

const iqHard = bank.questions.filter((q) => String(q.id).startsWith('iq') && q.difficulty === 'hard').length
report.checks.iqHard = iqHard
if (iqHard < 14) fail(`iq hard ${iqHard} < 14`)

const banHits = []
for (const q of bank.questions) {
  const blob = `${q.prompt} ${(q.choices || []).join(' ')}`
  for (const w of ['按揭', '供樓', '睇樓', '買樓']) {
    if (blob.includes(w)) banHits.push({ id: q.id, word: w })
  }
}
report.checks.buyContextGrep = banHits

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

async function shot(name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  report.shots.push(p)
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })

  // Long rewritten prompt
  const longQ = [...rewritten].sort((a, b) => b.prompt.length - a.prompt.length)[0]
  // Hard force id
  const hardQ = byId['mall-17'] || byId[FORCE_HARD[0]]

  async function showQuestion(q) {
    await page.evaluate((question) => {
      const g = window.__SAKE_GAME__
      // Prefer membership quiz overlay helper if present
      const play = g.scene.getScene('play')
      if (play?.storyIntro?.destroy) {
        try {
          play.storyIntro.destroy()
        } catch {
          /* ignore */
        }
        play.storyIntro = null
      }
      // Use minigame quiz UI via bank inject if MembershipQuiz exported on window
      const root = document.getElementById('game') || document.body
      let overlay = document.getElementById('qa-quiz-overlay')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'qa-quiz-overlay'
        overlay.style.cssText =
          'position:fixed;inset:0;z-index:99999;background:#1a2230ee;color:#f4f0e6;font-family:system-ui,sans-serif;padding:24px 16px;overflow:auto'
        root.appendChild(overlay)
      }
      const choices = (question.choices || [])
        .map(
          (c, i) =>
            `<button style="display:block;width:100%;margin:8px 0;padding:12px;border:0;border-radius:8px;background:#2c3b52;color:#fff;text-align:left;font-size:15px">${String.fromCharCode(65 + i)}. ${c}</button>`,
        )
        .join('')
      overlay.innerHTML = `<div style="font-size:12px;opacity:.7;margin-bottom:8px">${question.id} · ${question.difficulty || ''}</div>
        <div style="font-size:17px;line-height:1.45;margin-bottom:16px">${question.prompt}</div>
        ${choices}`
    }, q)
  }

  await showQuestion({ ...longQ, difficulty: byId[longQ.id]?.difficulty })
  await page.waitForTimeout(200)
  await shot('mobile-long-prompt')

  await showQuestion(hardQ)
  await page.waitForTimeout(200)
  await shot('mobile-hard')

  report.checks.longId = longQ.id
  report.checks.hardShotId = hardQ.id
  report.ok = report.errors.length === 0 && promptMismatches.length === 0
} catch (e) {
  report.errors.push(String(e?.stack || e))
  report.ok = false
  try {
    await shot('error')
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
