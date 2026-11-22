/**
 * Q9 acceptance: 20 rounds — developer+hanglung ≥ 40%, hr+labour ≤ 15%; no dupes in a round.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const port = process.env.QA_PORT || '47640'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })

const stats = await page.evaluate(async () => {
  localStorage.removeItem('quizSeen')
  const mod = await import('/src/game/membershipQuiz.ts')
  const pick = mod.pickRoundForQa
  const catCount = {}
  const rounds = []
  let dupRounds = 0
  for (let i = 0; i < 20; i++) {
    const round = pick(Math.random)
    const ids = round.map((q) => q.id)
    if (new Set(ids).size !== ids.length) dupRounds++
    const cats = round.map((q) => q.category)
    rounds.push(cats)
    for (const c of cats) catCount[c] = (catCount[c] || 0) + 1
  }
  const total = 20 * 7
  const devHl = (catCount.developer || 0) + (catCount.hanglung || 0)
  const hrLab = (catCount.hr || 0) + (catCount.labour || 0)
  return {
    catCount,
    total,
    devHlPct: devHl / total,
    hrLabPct: hrLab / total,
    dupRounds,
    sample: rounds.slice(0, 3),
  }
})

await browser.close()

const pass =
  stats.devHlPct >= 0.4 &&
  stats.hrLabPct <= 0.15 &&
  stats.dupRounds === 0

const out = { ...stats, pass }
fs.mkdirSync('docs/qa-quiz-mix', { recursive: true })
fs.writeFileSync('docs/qa-quiz-mix/summary.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
console.log(pass ? 'Q9 PASS' : 'Q9 FAIL')
process.exit(pass ? 0 : 1)
