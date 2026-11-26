/**
 * s7-look evidence: gallery enemies tab + S7 four composites strip.
 * Unlock via localStorage maxStage so stage-7+ cards show colour.
 */
import { chromium } from 'playwright'
import { mkdirSync, copyFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const OUT = join(ROOT, 'artifacts/s7-look')
const ART = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })
mkdirSync(ART, { recursive: true })

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4747'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
  localStorage.setItem('sake-kuma-c2-cleared-v1', '1')
})

await page.goto(`${BASE}/gallery/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.tab, button, #app', { timeout: 15000 })

// Click enemies tab (label 敵人)
const enemiesTab = page.locator('button, .tab, [role="tab"]').filter({ hasText: '敵人' }).first()
await enemiesTab.click()
await page.waitForTimeout(800)

// Scroll to stage 7 group if needed
const s7 = page.locator('text=第7關').first()
if (await s7.count()) {
  await s7.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
}

const galleryPath = join(OUT, 'gallery-enemies.png')
await page.screenshot({ path: galleryPath, fullPage: true })
copyFileSync(galleryPath, join(ART, 's7-look-gallery-enemies.png'))
console.log('wrote', galleryPath)

// Focus stage 7 cards region — crop-ish second shot
const charge = page.locator('text=衝刺蜜殭').first()
if (await charge.count()) {
  await charge.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const s7shot = join(OUT, 'gallery-s7-cards.png')
  await page.screenshot({ path: s7shot })
  copyFileSync(s7shot, join(ART, 's7-look-gallery-s7-cards.png'))
  console.log('wrote', s7shot)
}

copyFileSync(
  join(ROOT, 'public/art/stage7/_preview-s7-look.png'),
  join(ART, 's7-look-four-side-by-side.png'),
)
console.log('copied four-side-by-side preview')

await browser.close()
console.log('OK')
