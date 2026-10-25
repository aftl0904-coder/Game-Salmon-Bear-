import { chromium } from 'playwright'
import fs from 'fs'
const OUT = '/opt/cursor/artifacts/stage0-diag'
fs.mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:4741'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__SAKE_GAME__, { timeout: 20000 })
// skip logo
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  const keys = await page.evaluate(() =>
    window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.sys.settings.key),
  )
  if (keys.includes('menu')) break
}
await page.screenshot({ path: `${OUT}/intro-menu.png` })
await page.keyboard.press('Enter') // start default
await page.waitForTimeout(1200) // menu fade 1s
await page.screenshot({ path: `${OUT}/intro-black-or-beat.png` })
await page.waitForTimeout(1100) // finish opening black
await page.screenshot({ path: `${OUT}/intro-beat1.png` })
await page.keyboard.press('KeyA') // skip beat
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/intro-after-skip-a.png` })
await page.waitForTimeout(1100)
await page.screenshot({ path: `${OUT}/intro-beat2-or-black.png` })
console.log('ok', fs.readdirSync(OUT).filter((f) => f.startsWith('intro')))
await browser.close()
