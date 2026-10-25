#!/usr/bin/env node
/**
 * Stage 3–5 visual unify smoke: measure cast displayHeights + capture menu/play.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-visual-unify'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

// Skip logo → menu
await page.keyboard.press('Space')
await page.waitForTimeout(800)
await page.keyboard.press('Space')
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(OUT, 'stage3_menu_1280.png') })

// Start 1P boy
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
await page.keyboard.press('Enter')
await page.waitForTimeout(2000)
await page.keyboard.press('Space')
await page.waitForTimeout(1200)

const measures = await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  if (!g) return { error: 'no game' }
  const sc = g.scene.getScene('play') || g.scene.getScenes(true).find((s) => s.sys?.settings?.key === 'play')
  if (!sc) return { error: 'no game scene', scenes: g.scene.getScenes(true).map((s) => s.sys?.settings?.key) }
  const boy = sc.boy
  const girl = sc.girl
  const pet = sc.pet
  const scale = window.__SAKE_SCALE__
  return {
    game: { w: g.scale.width, h: g.scale.height },
    css: scale,
    boy: boy
      ? { dh: Math.round(boy.displayHeight), dw: Math.round(boy.displayWidth), sx: boy.scaleX, tex: boy.texture?.key }
      : null,
    girl: girl
      ? { dh: Math.round(girl.displayHeight), dw: Math.round(girl.displayWidth), sx: girl.scaleX }
      : null,
    pet: pet
      ? { dh: Math.round(pet.displayHeight), dw: Math.round(pet.displayWidth), sx: pet.scaleX }
      : null,
  }
})

fs.writeFileSync(path.join(OUT, 'stage3_measures.json'), JSON.stringify(measures, null, 2))
await page.screenshot({ path: path.join(OUT, 'stage3_play_1280.png') })

// 1× phone-ish
await page.setViewportSize({ width: 844, height: 390 })
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(OUT, 'stage3_play_844.png') })

console.log(JSON.stringify(measures, null, 2))
await browser.close()
