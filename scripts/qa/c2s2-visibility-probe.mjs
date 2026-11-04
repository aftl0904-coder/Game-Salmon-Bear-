// Environment probe only: never overrides document.hidden or synthesizes visibilitychange.
// This does not test gameplay, and a failure to observe hidden is NOT a background pass.
import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'

const out = process.env.OUT || 'docs/qa-c2s2/state-checkpoint-visibility-probe.json'
if (fs.existsSync(out)) throw Error(`refusing to overwrite ${out}`)
const report = { description: 'Chromium visibility environment probe only; no game or synthetic hidden event', at: new Date().toISOString(), load: os.loadavg(), modes: [], passed: false }
const flags = ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
for (const headless of [false, true]) {
  const item = { headless, cases: [], errors: [] }
  report.modes.push(item)
  let browser
  try {
    browser = await chromium.launch({ headless, ignoreDefaultArgs: flags, args: ['--no-sandbox'] })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('about:blank')
    await page.evaluate(() => {
      window.__visibilityProbe = []
      document.addEventListener('visibilitychange', () => window.__visibilityProbe.push({ hidden: document.hidden, at: performance.now() }))
    })
    const other = await context.newPage()
    await other.goto('about:blank')
    await other.bringToFront()
    await other.waitForTimeout(700)
    const during = await page.evaluate(() => ({ hidden: document.hidden, events: window.__visibilityProbe.slice() }))
    await page.bringToFront()
    await page.waitForTimeout(700)
    const after = await page.evaluate(() => ({ hidden: document.hidden, events: window.__visibilityProbe.slice() }))
    item.cases.push({ case: 'tab-switch', during, after, observedHidden: after.events.some(e => e.hidden), observedReturn: after.events.some((e, i) => !e.hidden && after.events.slice(0, i).some(x => x.hidden)) })
    await page.evaluate(() => { window.__visibilityProbe.length = 0 })
    const cdp = await context.newCDPSession(page)
    const { windowId } = await cdp.send('Browser.getWindowForTarget')
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } })
    await new Promise(r => setTimeout(r, 700))
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(700)
    const afterMinimize = await page.evaluate(() => ({ hidden: document.hidden, events: window.__visibilityProbe.slice() }))
    item.cases.push({ case: 'window-minimize', after: afterMinimize, observedHidden: afterMinimize.events.some(e => e.hidden), observedReturn: afterMinimize.events.some((e, i) => !e.hidden && afterMinimize.events.slice(0, i).some(x => x.hidden)) })
    await cdp.detach()
    await context.close()
  } catch (error) { item.errors.push(error.stack || String(error)) }
  finally { await browser?.close() }
}
report.passed = report.modes.some(m => m.cases.some(c => c.observedHidden && c.observedReturn))
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, passed: report.passed, modes: report.modes }))
if (!report.passed) process.exitCode = 1
