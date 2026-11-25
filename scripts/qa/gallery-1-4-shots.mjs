/**
 * gallery-1 #4 evidence: full-unlock enemies + bosses screenshots.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const PORT = process.env.PORT || '4747'
const OUT = process.env.OUT || '/opt/cursor/artifacts/gallery-1-4'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 11 }))
  localStorage.setItem('sake-kuma-c2-cleared-v1', '1')
  localStorage.setItem(
    'sake-kuma-gallery-v1',
    JSON.stringify({ heroes: [], friends: [], enemies: [], bosses: [], scenes: [], stories: [] }),
  )
})
const page = await ctx.newPage()
page.setDefaultTimeout(20000)
await page.goto(`http://127.0.0.1:${PORT}/gallery/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.card canvas')
await page.waitForTimeout(600)

async function openTab(id) {
  await page.click(`.tab[data-tab="${id}"]`)
  await page.waitForTimeout(800)
}

await openTab('enemies')
await page.screenshot({ path: join(OUT, 'enemies-full.png'), fullPage: true })

// Scroll stage 7 into view
const s7 = page.locator('text=第7關').first()
await s7.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, 'enemies-s7-row.png') })

const s8 = page.locator('text=第8關').first()
await s8.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, 'enemies-s8-row.png') })

const s10 = page.locator('text=第10關').first()
await s10.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, 'enemies-s9s10.png') })

await openTab('bosses')
await page.screenshot({ path: join(OUT, 'bosses-full.png'), fullPage: true })
const trainer = page.locator('.card[data-id="trainer"]')
await trainer.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, 'bosses-trainer-row.png') })

// Crop helper: render cards alone via evaluate
const cardShot = async (id, file) => {
  const buf = await page.evaluate(async (cid) => {
    const card = document.querySelector(`.card[data-id="${cid}"]`)
    if (!card) return null
    const canvas = card.querySelector('canvas')
    return canvas ? canvas.toDataURL('image/png') : null
  }, id)
  if (!buf) {
    console.warn('missing card', id)
    return
  }
  const { writeFileSync } = await import('fs')
  writeFileSync(join(OUT, file), Buffer.from(buf.split(',')[1], 'base64'))
}

for (const id of ['s7charge', 's7hop', 's7shield', 's7can']) {
  await openTab('enemies')
  await page.locator(`.card[data-id="${id}"]`).scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await cardShot(id, `card-${id}.png`)
}
await openTab('bosses')
await cardShot('triboss', 'card-triboss.png')
await cardShot('trainer', 'card-trainer.png')
await cardShot('mall-scrubber', 'card-scrubber.png')

console.log('wrote shots to', OUT)
await browser.close()
