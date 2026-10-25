#!/usr/bin/env node
/**
 * Data pack 1–4 QA: /bible catalog + JSON-driven lookAhead proof.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-data-1-4'
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

try {
  // validators
  const v = spawnSync(process.execPath, ['scripts/validate/all-data.mjs'], {
    cwd: '/workspace',
    encoding: 'utf8',
  })
  say(v.stdout || '')
  if (v.stderr) say(v.stderr)
  if (v.status !== 0) throw new Error('validate:data failed')

  await page.goto(`${BASE}/bible`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('#cam-lookahead')
  const before = await page.locator('#cam-lookahead').innerText()
  say(`bible lookAhead before: ${before}`)
  const body = await page.locator('body').innerText()
  for (const id of ['T-01', 'H-09', 'E-06', 'SG-02', 'ST-01']) {
    if (!body.includes(id)) throw new Error(`bible missing ${id}`)
    say(`found ${id}`)
  }
  await page.screenshot({ path: path.join(OUT, 'bible_before.png'), fullPage: true })

  // Patch lookAheadPx to prove JSON drives the page (rebuild required for bundle)
  const camPath = '/workspace/data/camera.json'
  const cam = JSON.parse(fs.readFileSync(camPath, 'utf8'))
  const original = cam.lookAheadPx
  cam.lookAheadPx = 77
  fs.writeFileSync(camPath, JSON.stringify(cam, null, 2) + '\n')
  say(`patched lookAheadPx ${original} → 77`)

  const build = spawnSync('npm', ['run', 'build'], { cwd: '/workspace', encoding: 'utf8' })
  if (build.status !== 0) {
    say(build.stderr || build.stdout)
    throw new Error('rebuild failed')
  }
  say('rebuild ok')

  // Preview may still serve old assets until hard reload — bust cache
  await page.goto(`${BASE}/bible?v=77`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('#cam-lookahead')
  const after = await page.locator('#cam-lookahead').innerText()
  say(`bible lookAhead after: ${after}`)
  await page.screenshot({ path: path.join(OUT, 'bible_after.png'), fullPage: true })

  // restore
  cam.lookAheadPx = original
  fs.writeFileSync(camPath, JSON.stringify(cam, null, 2) + '\n')
  spawnSync('npm', ['run', 'build'], { cwd: '/workspace', encoding: 'utf8' })
  say(`restored lookAheadPx → ${original}`)

  const changed = after.includes('77') && !before.includes('77')
  const report = {
    ok: changed && v.status === 0,
    before,
    after,
    changed,
    ids: ['T-01', 'H-09', 'E-06', 'SG-02', 'ST-01'],
    notes: changed
      ? []
      : ['lookAheadPx change not reflected — preview cache?'],
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  say(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
} catch (e) {
  say(String(e?.stack || e))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
