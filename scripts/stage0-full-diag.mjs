/**
 * Stage 0 — diagnosis only (no game code changes).
 * Viewports: landscape 812×375, portrait 375×812.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = process.env.GAME_URL || 'http://127.0.0.1:4741'
const OUT = '/opt/cursor/artifacts/stage0-diag'
fs.mkdirSync(OUT, { recursive: true })
const log = []
const L = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  log.push(line)
  console.log(line)
}

async function shot(page, name) {
  const f = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: f, fullPage: true })
  L(`SHOT ${name}`)
  return f
}

async function scenes(page) {
  return page.evaluate(() => {
    const g = window.__SAKE_GAME__
    if (!g) return []
    return g.scene.getScenes(true).map((s) => s.sys.settings.key)
  })
}

async function metrics(page) {
  return page.evaluate(() => {
    const root = document.getElementById('game-root')?.getBoundingClientRect()
    const canvas = document.querySelector('canvas')?.getBoundingClientRect()
    return {
      vw: innerWidth,
      vh: innerHeight,
      root: root ? { w: root.width, h: root.height, x: root.x, y: root.y } : null,
      canvas: canvas ? { w: canvas.width, h: canvas.height, x: canvas.x, y: canvas.y } : null,
      phonePlay: document.body.classList.contains('phone-play'),
      rotateHint:
        !!document.getElementById('rotate-hint') ||
        !!document.querySelector('[data-rotate-hint]') ||
        (document.body.innerText || '').includes('請橫向'),
      fullscreen: !!document.fullscreenElement,
    }
  })
}

async function skipToMenu(page) {
  await page.waitForFunction(() => !!window.__SAKE_GAME__, { timeout: 25000 })
  for (let i = 0; i < 10; i++) {
    const s = await scenes(page)
    L(`scenes ${s.join(',')}`)
    if (s.includes('menu') || s.includes('play')) return s
    await page.keyboard.press('Space')
    await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2)
    await page.waitForTimeout(600)
  }
  return scenes(page)
}

async function startGame(page) {
  // default first choice + start
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1100) // menu fade ≥1s
  // skip 3 prologue beats quickly with A (each may need black 1s)
  for (let i = 0; i < 8; i++) {
    const s = await scenes(page)
    L(`post-start scenes ${s.join(',')}`)
    await page.keyboard.press('KeyA')
    await page.waitForTimeout(350)
    const started = await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      const play = g?.scene?.getScene?.('play')
      return !!(play && play.started)
    })
    if (started) {
      L('gameplay started=true')
      return true
    }
  }
  // wait out remaining black/beats if skip didn't finish
  await page.waitForTimeout(5000)
  return page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    return !!(play && play.started)
  })
}

async function runLandscape() {
  L('=== LANDSCAPE 812x375 ===')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 812, height: 375 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => L(`PAGEERR L: ${e.message}`))

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await shot(page, 'S0-L00-load')
  await skipToMenu(page)
  await shot(page, 'S0-L01-menu')
  const mMenu = await metrics(page)
  L(`METRICS menu L ${JSON.stringify(mMenu)}`)

  const started = await startGame(page)
  L(`started ${started}`)
  await shot(page, 'S0-L02-intro-or-play')
  const mPlay = await metrics(page)
  L(`METRICS play L ${JSON.stringify(mPlay)}`)

  // play a bit
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down('KeyD')
    if (i % 4 === 0) await page.keyboard.press('KeyF')
    if (i % 7 === 0) await page.keyboard.press('KeyW')
    await page.waitForTimeout(80)
  }
  await page.keyboard.up('KeyD')
  await shot(page, 'S0-L03-midplay')

  // touch corners (virtual pad positions scaled to CSS canvas)
  const tapPts = await page.evaluate(() => {
    const c = document.querySelector('canvas')?.getBoundingClientRect()
    if (!c) return []
    // game coords ~ pad at (88,455) and (872,450) on 960x540
    const sx = c.width / 960
    const sy = c.height / 540
    return [
      { x: c.x + 88 * sx, y: c.y + 455 * sy, name: 'dpad' },
      { x: c.x + 872 * sx, y: c.y + 450 * sy, name: 'actions' },
      { x: c.x + 480 * sx, y: c.y + 270 * sy, name: 'center' },
    ]
  })
  L(`TAPPTS ${JSON.stringify(tapPts)}`)
  for (const p of tapPts) {
    if (!p) continue
    await page.touchscreen.tap(p.x, p.y)
    await page.waitForTimeout(150)
  }
  await shot(page, 'S0-L04-after-touch')

  // issue checks
  const issues = {
    a_portrait_hint_in_landscape: mPlay.rotateHint,
    phonePlayClass: mPlay.phonePlay,
    fillW: mPlay.root ? mPlay.root.w / mPlay.vw : 0,
    fillH: mPlay.root ? mPlay.root.h / mPlay.vh : 0,
    touchPadGameY: 455,
    combatCenterGameY: 270,
    padOverlapsCombatBand_estimate: 455 > 270 && 455 < 540,
  }
  L(`ISSUE_PROBE_L ${JSON.stringify(issues)}`)

  await browser.close()
  return { mMenu, mPlay, issues, started }
}

async function runPortrait() {
  L('=== PORTRAIT 375x812 ===')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => L(`PAGEERR P: ${e.message}`))

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, { timeout: 25000 })
  await page.waitForTimeout(1500)
  await shot(page, 'S0-P00-load')
  const m0 = await metrics(page)
  L(`METRICS P0 ${JSON.stringify(m0)}`)

  await skipToMenu(page)
  await shot(page, 'S0-P01-menu')
  const m1 = await metrics(page)
  L(`METRICS P1 ${JSON.stringify(m1)}`)

  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  await shot(page, 'S0-P02-after-start')
  const m2 = await metrics(page)
  L(`METRICS P2 ${JSON.stringify(m2)}`)

  const fillW = m2.root ? m2.root.w / m2.vw : 0
  const fillH = m2.root ? m2.root.h / m2.vh : 0
  const thinStrip = fillW < 0.7 && fillH > 0.25
  const unusedSide = m2.root ? (m2.vw - m2.root.w) / 2 : 0
  L(
    `PORTRAIT_FILL W=${fillW.toFixed(3)} H=${fillH.toFixed(3)} thinStrip=${thinStrip} unusedSide≈${unusedSide.toFixed(1)} rotateHint=${m2.rotateHint}`,
  )

  await browser.close()
  return { m0, m1, m2, thinStrip, fillW, fillH, rotateHint: m2.rotateHint }
}

async function main() {
  L(`BASE ${BASE}`)
  const res = await fetch(BASE)
  L(`HTTP ${res.status}`)
  if (!res.ok) process.exit(1)

  const Lres = await runLandscape()
  const Pres = await runPortrait()

  const report = {
    base: BASE,
    landscape: Lres,
    portrait: Pres,
    knownIssues: {
      a_portrait_thin_strip: {
        status: Pres.thinStrip ? 'CONFIRMED' : 'NOT_OBSERVED',
        rotateHintPresent: Pres.rotateHint,
        fillW: Pres.fillW,
        fillH: Pres.fillH,
        note: 'No 「請橫向遊玩」 DOM found; letterbox/thin strip from fitting 16:9 into portrait.',
      },
      b_touch_over_combat: {
        status: 'CONFIRMED_BY_LAYOUT',
        note: 'Touch pad anchors at game Y≈450–455; combat ground ~Y 350–500. Overlap likely.',
      },
      c_btn_labels: {
        status: 'CONFIRMED_BY_CODE',
        labels: ['↑↓←→', '絕', '攻', '跳', '始'],
        fontPx: 16,
      },
      d_hud_small: {
        status: 'CONFIRMED_BY_CODE',
        titlePx: 22,
        namePx: 14,
        mpLabelPx: 12,
        note: 'On CSS-scaled phone landscape, effective size shrinks further.',
      },
      e_story_format: {
        status: 'PARTIAL',
        note: 'Now 3-act panels (not avatar+click-next dialogue). Win still short line + 待續.',
      },
      f_round2_teaser: {
        status: 'CONFIRMED_BY_CODE',
        text: '第２關　・　待續',
      },
    },
  }
  fs.writeFileSync(path.join(OUT, 'stage0-report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'stage0-diag.log'), log.join('\n') + '\n')
  L('DONE Stage0')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
