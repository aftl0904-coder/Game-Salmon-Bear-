// Historical pre-change probe: use only against the original c99b98e implementation.
// Disposable browser profile; deliberately demonstrates data loss, never use player storage.
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext()
const page = await context.newPage()
await page.goto(process.env.QA_BASE_URL ?? 'http://127.0.0.1:47947/')
const key = 'sake-kuma-run-v1'
const result = await page.evaluate(async key => {
  const r = await import('/src/game/run.ts')
  const bad = '{corrupt fixture, NOT player data'
  localStorage.setItem(key, bad)
  const loaded = r.getRun()
  r.startNewRun(1, false, '1p', 'boy', { set() {} })
  return { bad, loaded, after: localStorage.getItem(key), warning: document.querySelector('#save-warning')?.textContent }
}, key)
console.log(JSON.stringify({ scenario: 'isolated corrupt fixture followed by new run', result, preserved: result.after === result.bad }, null, 2))
await browser.close()
if (result.after !== result.bad) process.exitCode = 1
