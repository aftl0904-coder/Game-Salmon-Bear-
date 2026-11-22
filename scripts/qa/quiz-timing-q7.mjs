import { chromium } from 'playwright'
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../../src/game/membershipQuiz.ts', import.meta.url), 'utf8')
const m = src.match(/answerPlayer:\s*(\d+)/)
const h = src.match(/answerHardExtra:\s*(\d+)/)
const fileOk = m && h && Number(m[1]) === 5800 && Number(h[1]) === 3000
console.log(JSON.stringify({ file: { answerPlayer: Number(m?.[1]), answerHardExtra: Number(h?.[1]) }, fileOk }))

const port = process.env.QA_PORT || '47640'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 }).catch(() => {})
const runtime = await page.evaluate(async () => {
  try {
    const mod = await import('/src/game/membershipQuiz.ts')
    return {
      answerPlayer: mod.QUIZ_TIMING?.answerPlayer,
      answerHardExtra: mod.QUIZ_TIMING?.answerHardExtra,
    }
  } catch (e) {
    return { error: String(e) }
  }
})
console.log('runtime', runtime)
await browser.close()
const pass = fileOk && runtime.answerPlayer === 5800 && runtime.answerHardExtra === 3000
console.log(pass ? 'Q7 PASS' : 'Q7 FAIL')
process.exit(pass ? 0 : 1)
