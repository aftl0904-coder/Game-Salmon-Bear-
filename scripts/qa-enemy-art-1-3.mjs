#!/usr/bin/env node
/**
 * Enemy art 1–3 QA: before/after shots at ~30% stage + densest enemy pack.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const PHASE = process.env.QA_PHASE || 'after' // before | after
const OUT = `/opt/cursor/artifacts/qa-enemy-sprites/${PHASE}`
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

async function enterPlay(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1800)
  for (const k of ['Space', 'Space', 'Enter']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(400)
  }
  await page.mouse.click(640, 360)
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play') || g?.scene?.getScene('game')
    if (!sc) return
    sc.started = true
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
  })
  await page.waitForTimeout(400)
}

async function snapAtProgress(page, progress, name, { wake = false } = {}) {
  const info = await page.evaluate(
    ({ p, wake }) => {
      const g = window.__SAKE_GAME__
      const sc = g?.scene?.getScene('play') || g?.scene?.getScene('game')
      if (!sc) return { ok: false }
      const W = sc.physics?.world?.bounds?.width || 2850
      const x = Math.round(W * p)
      if (sc.boy) {
        if (sc.boy.body) sc.boy.body.reset(x, sc.boy.y)
        else sc.boy.setPosition(x, sc.boy.y)
      }
      // Wake nearby enemies so placeholders are visible (sleep until camera otherwise).
      const all = sc.enemies?.getChildren?.() || []
      if (wake) {
        for (const e of all) {
          if (Math.abs(e.x - x) < 360) {
            e.setActive(true)
            e.setVisible(true)
            e.alpha = 1
            if (typeof e.wake === 'function') e.wake()
            if (e.fsm === 'SLEEP' || e.fsm === 'idle' || e.asleep) {
              try {
                e.fsm = 'PATROL'
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
      if (sc.cameras?.main) {
        sc.cameras.main.centerOn(x, sc.cameras.main.midPoint?.y ?? 180)
        sc.cameras.main.setScroll(Math.max(0, x - 320), sc.cameras.main.scrollY)
      }
      const enemies = all
        .filter((e) => e.visible)
        .map((e) => ({
          x: Math.round(e.x),
          tex: e.texture?.key,
          sp: e.species,
          active: e.active,
        }))
      const near = enemies.filter((e) => Math.abs(e.x - x) < 320)
      return {
        ok: true,
        x,
        W,
        enemyCount: enemies.length,
        near,
        boyTex: sc.boy?.texture?.key,
        placeholders: sc.registry?.get('enemyPlaceholders'),
        groundTiles: (sc.children?.list || []).filter((o) =>
          String(o.texture?.key || '').startsWith('tile-ground'),
        ).length,
      }
    },
    { p: progress, wake },
  )
  say(`${name}: ${JSON.stringify(info)}`)
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  return info
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
try {
  say(`phase=${PHASE}`)
  await enterPlay(page)
  await page.screenshot({ path: path.join(OUT, '00_start.png') })
  const a = await snapAtProgress(page, 0.3, '01_stage_30pct', { wake: true })
  // Wave-1 pack around world x ~400–600
  const b = await snapAtProgress(page, 0.14, '02_enemy_dense', { wake: true })
  const report = { ok: true, phase: PHASE, shots: ['00_start.png', '01_stage_30pct.png', '02_enemy_dense.png'], a, b }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n') + '\n')
  say(JSON.stringify(report, null, 2))
} catch (e) {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, error: String(e), log }, null, 2))
  try {
    await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true })
  } catch {
    /* ignore */
  }
  throw e
} finally {
  await browser.close()
}
