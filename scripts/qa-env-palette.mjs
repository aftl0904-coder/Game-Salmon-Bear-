#!/usr/bin/env node
/**
 * Environment + palette (feel 1–2) QA: validators + /bible 場景／色板 Playwright.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-env-palette'
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

const v = spawnSync(process.execPath, ['scripts/validate/all-data.mjs'], {
  cwd: '/workspace',
  encoding: 'utf8',
})
say(v.stdout || '')
if (v.stderr) say(v.stderr)
if (v.status !== 0) {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, step: 'validate', log }, null, 2))
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const notes = []

try {
  await page.goto(`${BASE}/bible`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('[data-testid="sec-environment"]', { timeout: 15000 })

  for (const id of ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05']) {
    const card = page.locator(`[data-testid="stage-${id}"]`)
    if ((await card.count()) < 1) throw new Error(`missing stage card ${id}`)
    say(`found stage ${id}`)
  }
  await page.screenshot({ path: path.join(OUT, 'bible_scenes.png'), fullPage: true })
  say('shot bible_scenes.png')

  await page.click('[data-tab="palette"]')
  await page.waitForSelector('[data-testid="sec-palette"]')
  const awaiting = await page.locator('[data-testid="palette-awaiting"]').count()
  say(`palette awaiting badge: ${awaiting > 0}`)
  const swatches = await page.locator('.swatch-grid .swatch').count()
  say(`swatch count: ${swatches}`)
  if (swatches !== 32) throw new Error(`expected 32 swatches, got ${swatches}`)
  for (const id of ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05']) {
    if ((await page.locator(`[data-testid="tint-${id}"]`).count()) < 1) {
      throw new Error(`missing tint ${id}`)
    }
  }
  await page.screenshot({ path: path.join(OUT, 'bible_palette.png'), fullPage: true })
  say('shot bible_palette.png')

  await page.click('[data-tab="music"]')
  await page.waitForSelector('[data-testid="music-pending"]')
  await page.screenshot({ path: path.join(OUT, 'bible_music_pending.png'), fullPage: true })
  say('shot bible_music_pending.png (項目 3 未做)')
  notes.push('音樂分頁僅佔位；loop／播放 未能實測（等項目 3）')
  notes.push('每關開頭／中段／Boss 前截圖 未能實測（等美術接入 environment）')

  const report = {
    ok: true,
    validate: true,
    stages: ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05'],
    swatches,
    paletteAwaitingConfirmation: awaiting > 0,
    shots: ['bible_scenes.png', 'bible_palette.png', 'bible_music_pending.png'],
    notes,
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n') + '\n')
  say(JSON.stringify(report, null, 2))
} catch (e) {
  notes.push(String(e))
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify({ ok: false, error: String(e), log, notes }, null, 2),
  )
  try {
    await page.screenshot({ path: path.join(OUT, 'bible_error.png'), fullPage: true })
  } catch {
    /* ignore */
  }
  throw e
} finally {
  await browser.close()
}
