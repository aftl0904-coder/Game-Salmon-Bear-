#!/usr/bin/env node
// QA-only: run against this locally served worktree, never against production.
// No scene or game-state manipulation: the only shortcut is the explicit localStorage
// C2-cleared flag. Navigation is by Playwright keyboard or touch, with read-only
// inspection of the game's existing __SAKE_GAME__ diagnostic hook.
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const preview = process.env.PREVIEW_DIR || process.cwd()
const url = process.env.QA_URL || 'http://127.0.0.1:18473/'
const require = createRequire(join(preview, 'package.json'))
const { chromium } = require('playwright')
const cards = JSON.parse(await readFile(join(preview, 'data/ending-c2.json'), 'utf8'))
const output = join(here, 'c2-screenshots')
await mkdir(output, { recursive: true })
const logs = []
const log = (...args) => { const s = args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); logs.push(s); console.log(s) }
function assert(value, message) { if (!value) throw new Error(message) }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })

async function state(page) {
  return await page.evaluate(() => {
    const game = window.__SAKE_GAME__
    if (!game) return { active: [] }
    const active = game.scene.getScenes(true).map(s => s.scene.key)
    if (!active.includes('ending-c2')) return { active }
    const scene = game.scene.getScene('ending-c2')
    const image = scene.image
    const source = image?.texture?.getSourceImage()
    return {
      active, index: scene.index, count: scene.countText?.text,
      title: scene.titleText?.text, fallback: scene.descText?.text,
      key: image?.texture?.key, visible: image?.visible,
      displayWidth: image?.displayWidth, displayHeight: image?.displayHeight,
      sourceWidth: source?.naturalWidth || source?.width,
      sourceHeight: source?.naturalHeight || source?.height,
      ready: !!image && scene.textures.exists(`ending-c2-${scene.index + 1}`),
    }
  })
}
async function waitScene(page, key) {
  await page.waitForFunction(k => window.__SAKE_GAME__?.scene.getScenes(true).some(s => s.scene.key === k), key, { timeout: 60000 })
}
async function tapGame(page, x, y) {
  const box = await page.locator('#game-root canvas').boundingBox()
  assert(box, 'Canvas is not visible')
  await page.touchscreen.tap(box.x + box.width * x / 640, box.y + box.height * y / 360)
}
async function run(mode) {
  const mobile = mode === 'mobile-touch'
  const config = mobile ? {
    viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
  const context = await browser.newContext(config)
  const page = await context.newPage()
  const responses = []
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('requestfailed', req => errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`))
  page.on('response', response => { if (/\/art\/story\/ending-c2-\d\d\.png(?:\?|$)/.test(response.url())) responses.push({ url: response.url(), status: response.status() }) })
  // This bypasses stage completion; it does not simulate or prove a complete playthrough.
  await page.addInitScript(() => localStorage.setItem('sake-kuma-c2-cleared-v1', '1'))
  log(`\n=== ${mode} ===`)
  log('CONFIG', { url, ...config, explicitUnlock: 'localStorage sake-kuma-c2-cleared-v1=1' })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitScene(page, 'logo')
    await page.waitForTimeout(800)
    if (mobile) await tapGame(page, 242, 330); else await page.keyboard.press('Enter')
    await waitScene(page, 'difficulty')
    await page.waitForTimeout(700)
    if (mobile) await tapGame(page, 320, 160); else await page.keyboard.press('Enter')
    await waitScene(page, 'menu')
    await page.waitForTimeout(800)
    if (mobile) await tapGame(page, 96, 143); else await page.keyboard.press('r')
    await waitScene(page, 'ending-c2')
    await page.waitForTimeout(800)
    const flag = await page.evaluate(() => localStorage.getItem('sake-kuma-c2-cleared-v1'))
    assert(flag === '1', 'expected explicit flag')
    for (let i = 0; i < 10; i++) {
      const id = i + 1
      const observed = await state(page)
      const expectedKey = `ending-c2-${id}`
      assert(observed.index === i, `card ${id}: wrong index ${JSON.stringify(observed)}`)
      assert(observed.count === `${id} / 10`, `card ${id}: wrong counter ${JSON.stringify(observed)}`)
      assert(observed.title === cards[i].title, `card ${id}: wrong title ${JSON.stringify(observed)}`)
      assert(observed.key === expectedKey && observed.visible && observed.ready && observed.sourceWidth > 0 && observed.sourceHeight > 0, `card ${id}: missing/incorrect image ${JSON.stringify(observed)}`)
      assert(observed.displayWidth > 0 && observed.displayHeight > 0 && observed.fallback === '', `card ${id}: hidden image/fallback ${JSON.stringify(observed)}`)
      const name = `${mode}-${String(id).padStart(2, '0')}.jpg`
      await page.locator('#game-root canvas').screenshot({ path: join(output, name), type: 'jpeg', quality: 78, timeout: 15000 })
      log('CARD', { ordinal: id, expectedPath: cards[i].image, screenshot: `c2-screenshots/${name}`, ...observed })
      if (i < 9) {
        if (mobile) await tapGame(page, 435, 300); else await page.keyboard.press('ArrowRight')
        await page.waitForFunction(n => window.__SAKE_GAME__?.scene.getScene('ending-c2')?.index === n, i + 1, { timeout: 5000 })
        await page.waitForTimeout(180)
      }
    }
    const statuses = cards.map(c => ({ path: c.image, matching: responses.filter(r => new URL(r.url).pathname === c.image).map(r => r.status) }))
    for (const s of statuses) assert(s.matching.includes(200), `image did not load with HTTP 200: ${JSON.stringify(s)}`)
    log('IMAGE_HTTP', statuses)
    log('PAGE_ERRORS', errors)
    assert(errors.length === 0, `page/request errors: ${JSON.stringify(errors)}`)
    // Final UI interaction leaves the replay back to menu.
    if (mobile) await tapGame(page, 435, 300); else await page.keyboard.press('ArrowRight')
    await waitScene(page, 'menu')
    log('RESULT', { mode, result: 'PASS', cards: 10, finalAction: 'back to menu', physicalDevice: false, fullStage10Clear: false })
  } finally { await context.close() }
}

let exitCode = 0
try { for (const mode of ['desktop-keyboard', 'mobile-touch']) await run(mode) }
catch (e) { exitCode = 1; log('RESULT FAIL', e.stack || String(e)) }
finally { await browser.close(); await writeFile(join(here, 'c2-playwright.txt'), logs.join('\n') + '\n') }
process.exitCode = exitCode
