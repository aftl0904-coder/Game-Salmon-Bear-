/**
 * mini-1: desktop + mobile (landscape) screenshots for upgraded minigames.
 * Expects Vite on QA_BASE (default http://127.0.0.1:47691/).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/mini-1'
const BASE = process.env.QA_BASE || 'http://127.0.0.1:47691/'
fs.mkdirSync(OUT, { recursive: true })

const GAMES = [
  { id: 'gacha', kind: 'scene', scene: 'gacha' },
  { id: 'flag', kind: 'overlay', fn: 'flagRace' },
  { id: 'pour', kind: 'overlay', fn: 'pourGame' },
  { id: 'tilt', kind: 'overlay', fn: 'tiltGame' },
  { id: 'quiz', kind: 'overlay', mod: 'membershipQuiz', fn: 'goldfishQuiz' },
  { id: 'memory', kind: 'overlay', fn: 'memoryGame' },
  { id: 'claw', kind: 'overlay', fn: 'clawGame' },
  { id: 'shake', kind: 'overlay', fn: 'shakeHoney' },
  { id: 'chase', kind: 'scene', scene: 'bike', data: { to: 7 } },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  // Landscape phone — game hides canvas in portrait
  { name: 'mobile', width: 844, height: 390, isMobile: true, hasTouch: true },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})

async function shot(page, file) {
  // Prefer canvas; fall back to game-root / page
  const canvas = page.locator('#game-root canvas').first()
  try {
    if (await canvas.isVisible({ timeout: 1500 })) {
      await canvas.screenshot({ path: file, timeout: 8000 })
      return
    }
  } catch {
    /* fall through */
  }
  const root = page.locator('#game-root')
  if (await root.count()) {
    await root.screenshot({ path: file, timeout: 8000 }).catch(() => page.screenshot({ path: file }))
  } else {
    await page.screenshot({ path: file })
  }
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
    page.on('pageerror', (e) => console.error('PAGEERROR', e.message))
    await page.addInitScript(() => {
      localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
      localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
      localStorage.setItem('sake-kuma-mg-seen-v1', '{}')
      document.documentElement.classList.remove('portrait')
    })
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 60000 })
    // Let Boot finish loading assets (logo/menu)
    await page.waitForTimeout(2500)
    await page.evaluate(() => {
      document.body.classList.remove('portrait')
      const hint = document.getElementById('rotate-hint')
      if (hint) hint.setAttribute('aria-hidden', 'true')
    })

    for (const g of GAMES) {
      const file = path.join(OUT, `${g.id}-${vp.name}.png`)
      try {
        if (g.kind === 'scene') {
          await page.evaluate(
            ({ scene, data }) => {
              const game = window.__SAKE_GAME__
              game.registry.set('playMode', '1p')
              game.registry.set('difficulty', 'normal')
              game.registry.set('soloCast', 'boy')
              for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key)
              game.scene.start(scene, data || {})
            },
            { scene: g.scene, data: g.data || null },
          )
          await page.waitForTimeout(800)
          const active = await page.evaluate((key) => {
            const g = window.__SAKE_GAME__
            return {
              want: key,
              active: g.scene.getScenes(true).map((s) => s.scene.key),
              isActive: g.scene.isActive(key),
            }
          }, g.scene)
          if (!active.isActive) {
            // Retry once after a moment (Boot may still be loading textures)
            await page.waitForTimeout(1500)
            await page.evaluate(
              ({ scene, data }) => {
                const game = window.__SAKE_GAME__
                for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key)
                game.scene.start(scene, data || {})
              },
              { scene: g.scene, data: g.data || null },
            )
            await page.waitForTimeout(1200)
          }
          if (g.id === 'gacha') {
            await page.keyboard.press('Enter')
            await page.waitForTimeout(1200)
          } else {
            await page.waitForTimeout(1000)
          }
        } else {
          await page.evaluate(() => {
            const game = window.__SAKE_GAME__
            game.registry.set('stageNo', 2)
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
            const ok = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.isActive('play'))
            if (ok) break
          }
          await page.waitForTimeout(350)
          await page.evaluate(
            async ({ mod, fn }) => {
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
              const m = await import(mod === 'membershipQuiz' ? '/src/game/membershipQuiz.ts' : '/src/game/minigames.ts')
              window.__QA_MINI__ = m[fn](s)
            },
            { mod: g.mod || 'minigames', fn: g.fn },
          )
          await page.waitForTimeout(900)
        }
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
console.log(JSON.stringify({ total: log.length, failed: failed.length, out: OUT }, null, 2))
if (failed.length) process.exitCode = 1
