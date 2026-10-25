#!/usr/bin/env node
/**
 * Characters + companion (cast 1–2) QA: validators + /bible 角色 tab.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-characters-companion'
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

const chars = JSON.parse(fs.readFileSync('/workspace/data/characters.json', 'utf8'))
const companion = JSON.parse(fs.readFileSync('/workspace/data/companion.json', 'utf8'))
const notes = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  await page.goto(`${BASE}/bible#cast`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('[data-testid="sec-characters"]', { timeout: 15000 })

  for (const id of ['P-01', 'P-02']) {
    if ((await page.locator(`[data-testid="char-${id}"]`).count()) < 1) {
      throw new Error(`missing char card ${id}`)
    }
    say(`found ${id}`)
  }
  const speedBoy = await page.locator('[data-testid="speed-P-01"]').innerText()
  const speedGirl = await page.locator('[data-testid="speed-P-02"]').innerText()
  say(`speeds bible: P-01=${speedBoy} P-02=${speedGirl}`)
  if (Number(speedBoy) !== chars.characters.find((c) => c.id === 'P-01').moveSpeed) {
    throw new Error('P-01 speed mismatch')
  }
  if (Number(speedGirl) !== chars.characters.find((c) => c.id === 'P-02').moveSpeed) {
    throw new Error('P-02 speed mismatch')
  }

  await page.waitForSelector('[data-testid="sec-companion"]')
  const assistRows = await page.locator('[data-testid="companion-assists"] tbody tr').count()
  say(`assist rows: ${assistRows}`)
  if (assistRows !== companion.assists.length) throw new Error('assist count mismatch')

  await page.screenshot({ path: path.join(OUT, 'bible_cast.png'), fullPage: true })
  say('shot bible_cast.png')

  notes.push('coop／控制／滑翔／跟隨／雙人／機械人通關率 未能實測（等項目 3–5）')
  notes.push('攻擊幀同 JSON 一致實測 未能實測（等確認後接 gameplay wiring）')

  const report = {
    ok: true,
    validate: true,
    characters: chars.characters.map((c) => ({
      id: c.id,
      name: c.name,
      moveSpeed: c.moveSpeed,
      hp: c.hp,
      role: c.role,
    })),
    companion: { id: companion.id, assists: companion.assists.map((a) => a.id) },
    speedsOnBible: { 'P-01': Number(speedBoy), 'P-02': Number(speedGirl) },
    shots: ['bible_cast.png'],
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
