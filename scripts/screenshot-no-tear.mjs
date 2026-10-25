/**
 * Capture mid-run / mid-jump / mid-hit frames proving sprites are whole (no tear).
 * Uses canvas.toDataURL (WebGL buffer) to avoid Playwright compositor artifacts.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4733/'
const OUT = '/opt/cursor/artifacts/screenshots'
fs.mkdirSync(OUT, { recursive: true })

async function activeKey(page) {
  return page.evaluate(() => {
    const g = window.__SAKE_GAME__
    if (!g) return null
    const live = g.scene.getScenes(true)
    if (live?.[0]) return live[0].sys.settings.key
    for (const k of ['play', 'menu', 'logo', 'boot']) {
      const s = g.scene.getScene(k)
      if (s?.sys?.isActive?.()) return k
    }
    return null
  })
}

async function waitForScene(page, key, timeout = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if ((await activeKey(page)) === key) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timeout waiting for ${key}, now=${await activeKey(page)}`)
}

async function enterPlay(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 20000 })
  await waitForScene(page, 'logo')
  await page.keyboard.press('Enter')
  await waitForScene(page, 'menu')
  await page.keyboard.press('Enter')
  await waitForScene(page, 'play')
  await page.waitForTimeout(500)
  for (let i = 0; i < 5; i++) {
    const started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
    if (started) return
    await page.keyboard.press('Space')
    await page.mouse.click(480, 270)
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (play && !play.started) {
      play.started = true
      play.startedAt = play.time.now
    }
  })
}

async function shotCanvas(page, name) {
  const file = path.join(OUT, name)
  // Prefer element screenshot (compositor) — reliable without preserveDrawingBuffer races.
  await page.locator('#game-root canvas').first().screenshot({ path: file })
  const st = fs.statSync(file)
  if (st.size < 20000) {
    const dataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('#game-root canvas')
      return canvas.toDataURL('image/png')
    })
    fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
  }
  console.log('wrote', file, fs.statSync(file).size)
  return file
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

try {
  await enterPlay(page)
  console.log('play started')

  await page.keyboard.down('KeyD')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await shotCanvas(page, 'sake-kuma-no-tear-run.png')

  await page.keyboard.press('KeyK')
  await page.waitForTimeout(160)
  await shotCanvas(page, 'sake-kuma-no-tear-jump.png')
  await page.waitForTimeout(450)

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('KeyJ')
    await page.keyboard.press('Digit1')
    await page.waitForTimeout(80)
  }
  await shotCanvas(page, 'sake-kuma-no-tear-hit.png')

  await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const e = play.enemies?.getChildren?.()?.find((o) => o.active)
    if (e && play.juice) play.juice.solidHit(e.x, e.y - 18, true, e, 1)
    play.boy?.setVelocityY(-420)
    play.girl?.setVelocityY(-380)
  })
  await page.waitForTimeout(50)
  await shotCanvas(page, 'sake-kuma-no-tear-fx.png')

  await page.keyboard.up('KeyD')
  await page.keyboard.up('ArrowRight')

  const meta = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const info = (s) =>
      s
        ? {
            x: s.x,
            y: s.y,
            intX: Number.isInteger(s.x),
            intY: Number.isInteger(s.y),
            oy: s.originY,
            sx: s.scaleX,
            sy: s.scaleY,
            ang: s.angle,
          }
        : null
    return {
      boy: info(play.boy),
      girl: info(play.girl),
      pet: info(play.pet),
      scrollX: play.cameras.main.scrollX,
      roundPixels: play.cameras.main.roundPixels,
      enemy0: info(play.enemies?.getChildren?.()?.find((e) => e.active)),
    }
  })
  console.log('META', JSON.stringify(meta, null, 2))
} finally {
  await browser.close()
}
