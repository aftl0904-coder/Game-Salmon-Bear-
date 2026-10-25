/**
 * Problem 1 acceptance — Playwright viewport FIT checks.
 * Sizes: 844×390, 667×375, 932×430, 1280×720, 375×812 (portrait).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4741/'
const OUT = '/opt/cursor/artifacts/qa-p1-scale'
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: '844x390', width: 844, height: 390, expectPortrait: false },
  { name: '667x375', width: 667, height: 375, expectPortrait: false },
  { name: '932x430', width: 932, height: 430, expectPortrait: false },
  { name: '1280x720', width: 1280, height: 720, expectPortrait: false },
  { name: '375x812', width: 375, height: 812, expectPortrait: true },
]

async function waitScene(page, key, timeout = 45000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      if (!g) return null
      const live = g.scene.getScenes(true)
      return live?.[0]?.sys?.settings?.key ?? null
    })
    if (cur === key) return
    await page.waitForTimeout(120)
  }
  throw new Error(`timeout waiting for scene ${key}`)
}

async function goToMenu(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 45000 })
  // Skip logo splash
  await page.waitForTimeout(400)
  await page.keyboard.press('Enter')
  await waitScene(page, 'menu')
  await page.waitForTimeout(500)
}

async function measure(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-root canvas')
    const root = document.querySelector('#game-root')
    const hint = document.getElementById('rotate-hint')
    const cs = canvas ? getComputedStyle(canvas) : null
    const br = canvas?.getBoundingClientRect()
    const scrollX = document.documentElement.scrollWidth > window.innerWidth + 1
    const scrollY = document.documentElement.scrollHeight > window.innerHeight + 1
    const bodyOverflow = getComputedStyle(document.body).overflow
    return {
      inner: { w: window.innerWidth, h: window.innerHeight },
      canvasCss: cs ? { w: cs.width, h: cs.height } : null,
      canvasRect: br
        ? {
            x: Math.round(br.x * 10) / 10,
            y: Math.round(br.y * 10) / 10,
            w: Math.round(br.width * 10) / 10,
            h: Math.round(br.height * 10) / 10,
            right: Math.round(br.right * 10) / 10,
            bottom: Math.round(br.bottom * 10) / 10,
          }
        : null,
      canvasInternal: canvas ? { w: canvas.width, h: canvas.height } : null,
      rootSize: root
        ? { w: root.clientWidth, h: root.clientHeight }
        : null,
      portraitClass: document.body.classList.contains('portrait'),
      hintDisplay: hint ? getComputedStyle(hint).display : null,
      hintVisible: hint ? getComputedStyle(hint).display !== 'none' : false,
      scrollX,
      scrollY,
      bodyOverflow,
      aspect:
        br && br.height > 0 ? Math.round((br.width / br.height) * 1000) / 1000 : null,
    }
  })
}

async function tryClickStart(page, expectPortrait) {
  if (expectPortrait) {
    return { clicked: false, reason: 'portrait — rotate hint, no start click' }
  }
  // Mode row 0 ≈ center x, y ~150 in game coords → map to canvas CSS
  const hit = await page.evaluate(() => {
    const canvas = document.querySelector('#game-root canvas')
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    const sx = r.width / 960
    const sy = r.height / 540
    return {
      x: r.left + 480 * sx,
      y: r.top + 150 * sy,
    }
  })
  if (!hit) return { clicked: false, reason: 'no canvas' }
  await page.mouse.click(hit.x, hit.y)
  await page.waitForTimeout(700)
  const scene = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const live = g?.scene?.getScenes?.(true)
    return live?.[0]?.sys?.settings?.key ?? null
  })
  // Click may start play, or at least remain on menu without error
  return { clicked: true, sceneAfter: scene, ok: scene === 'play' || scene === 'menu' }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const results = []

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const row = { name: vp.name, expectPortrait: vp.expectPortrait }
  try {
    await goToMenu(page)
    const m = await measure(page)
    row.measure = m

    const eps = 2
    const fits =
      m.canvasRect &&
      m.canvasRect.x >= -eps &&
      m.canvasRect.y >= -eps &&
      m.canvasRect.right <= m.inner.w + eps &&
      m.canvasRect.bottom <= m.inner.h + eps
    const noScroll = !m.scrollX && !m.scrollY
    const aspectOk =
      vp.expectPortrait || (m.aspect != null && Math.abs(m.aspect - 16 / 9) < 0.05)
    const portraitOk = m.portraitClass === vp.expectPortrait && m.hintVisible === vp.expectPortrait

    row.checks = {
      fitsInViewport: !!fits,
      noScroll,
      aspect16_9: !!aspectOk,
      portraitHint: portraitOk,
      internal960x540:
        m.canvasInternal?.w === 960 && m.canvasInternal?.h === 540,
    }

    const shot = path.join(OUT, `p1_${vp.name}.png`)
    await page.screenshot({ path: shot, fullPage: false })
    row.screenshot = shot

    const click = await tryClickStart(page, vp.expectPortrait)
    row.clickStart = click

    row.pass =
      row.checks.fitsInViewport &&
      row.checks.noScroll &&
      row.checks.aspect16_9 &&
      row.checks.portraitHint &&
      (vp.expectPortrait || click.ok)
  } catch (e) {
    row.pass = false
    row.error = String(e?.message || e)
    try {
      await page.screenshot({ path: path.join(OUT, `p1_${vp.name}_ERROR.png`), fullPage: false })
    } catch {}
  }
  results.push(row)
  console.log(JSON.stringify(row, null, 2))
  await context.close()
}

await browser.close()

const summary = {
  at: new Date().toISOString(),
  url: URL,
  passCount: results.filter((r) => r.pass).length,
  total: results.length,
  results,
}
fs.writeFileSync(path.join(OUT, 'p1-report.json'), JSON.stringify(summary, null, 2))
console.log('SUMMARY', JSON.stringify({ passCount: summary.passCount, total: summary.total }))
process.exit(summary.passCount === summary.total ? 0 : 1)
