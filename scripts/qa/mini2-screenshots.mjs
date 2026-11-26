/** mini-2: desktop + landscape-mobile screenshots for lantern / sashimi / recipe. */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/mini-2'
const BASE = process.env.QA_BASE || 'http://127.0.0.1:47692/'
fs.mkdirSync(OUT, { recursive: true })

const GAMES = [
  { id: 'lantern', fn: 'lanternPickGame' },
  { id: 'sashimi', fn: 'sashimiCutGame' },
  { id: 'recipe', fn: 'recipeMatchGame' },
]
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 844, height: 390, isMobile: true, hasTouch: true },
]

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})

async function shot(page, file) {
  const canvas = page.locator('#game-root canvas').first()
  try {
    if (await canvas.isVisible({ timeout: 1500 })) {
      await canvas.screenshot({ path: file, timeout: 8000 })
      return
    }
  } catch {
    /* */
  }
  await page.locator('#game-root').screenshot({ path: file, timeout: 8000 }).catch(() => page.screenshot({ path: file }))
}

const log = []
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
    })
    await page.addInitScript(() => {
      localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
      localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
      localStorage.setItem('sake-kuma-mg-seen-v1', '{}')
    })
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 60000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => document.body.classList.remove('portrait'))

    for (const g of GAMES) {
      const file = path.join(OUT, `${g.id}-${vp.name}.png`)
      try {
        await page.evaluate(() => {
          const game = window.__SAKE_GAME__
          game.registry.set('stageNo', 3)
          game.registry.set('playMode', '1p')
          game.registry.set('difficulty', 'normal')
          game.registry.set('soloCast', 'boy')
          for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key)
          game.scene.start('play')
        })
        const t0 = Date.now()
        while (Date.now() - t0 < 20000) {
          await page.keyboard.press('Enter')
          await page.waitForTimeout(120)
          if (await page.evaluate(() => window.__SAKE_GAME__?.scene?.isActive('play'))) break
        }
        await page.waitForTimeout(400)
        await page.evaluate(async (fn) => {
          const s = window.__SAKE_GAME__.scene.getScene('play')
          try {
            s.physics?.pause?.()
          } catch {
            /* */
          }
          if (window.__QA_MINI__?.destroy) {
            try {
              window.__QA_MINI__.destroy()
            } catch {
              /* */
            }
          }
          const m = await import('/src/game/stallMinigamesV2.ts')
          window.__QA_MINI__ = m[fn](s)
        }, g.fn)
        await page.waitForTimeout(1200)
        await shot(page, file)
        const size = fs.statSync(file).size
        console.log('OK', path.basename(file), size)
        log.push({ id: g.id, vp: vp.name, file, size, ok: size > 1500 })
      } catch (e) {
        console.error('FAIL', g.id, vp.name, e.message)
        log.push({ id: g.id, vp: vp.name, ok: false, error: String(e.message) })
        await page.screenshot({ path: file.replace('.png', '-fallback.png') }).catch(() => {})
      }
    }
    await page.close()
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ log, out: OUT }, null, 2))
  await browser.close()
}
const failed = log.filter((x) => !x.ok)
console.log(JSON.stringify({ total: log.length, failed: failed.length }, null, 2))
if (failed.length) process.exitCode = 1
