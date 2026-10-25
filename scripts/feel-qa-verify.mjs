/**
 * Feel QA verify: spawn / run / hit canvas shots + cast meta dump.
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

async function waitForScene(page, key, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if ((await activeKey(page)) === key) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timeout waiting for ${key}, now=${await activeKey(page)}`)
}

async function enterPlay(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 25000 })
  await waitForScene(page, 'logo')
  await page.keyboard.press('Enter')
  await waitForScene(page, 'menu')
  await page.keyboard.press('Enter')
  await waitForScene(page, 'play')
  await page.waitForTimeout(400)
  for (let i = 0; i < 6; i++) {
    const started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
    if (started) return
    await page.keyboard.press('Space')
    await page.mouse.click(480, 270)
    await page.waitForTimeout(180)
  }
  await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (play && !play.started) {
      play.started = true
      play.startedAt = play.time.now
    }
  })
}

async function shot(page, name) {
  const file = path.join(OUT, name)
  await page.locator('#game-root canvas').first().screenshot({ path: file })
  console.log('wrote', file, fs.statSync(file).size)
  return file
}

async function dumpMeta(page) {
  return page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (!play) return null
    const boy = play.boy
    const girl = play.girl
    const pet = play.pet
    const signs = typeof play.zoneSignData === 'function' ? play.zoneSignData() : null
    return {
      scene: play.sys?.settings?.key,
      debugOverlay: !!play.debugOverlay?.enabled,
      zoneSigns: signs,
      boy: boy && { x:+boy.x.toFixed(1), y:+boy.y.toFixed(1), lane:boy.lane, scale:boy.scaleX, angle:boy.angle, fsm:boy.fsm, pose:boy.pose },
      girl: girl && { x:+girl.x.toFixed(1), y:+girl.y.toFixed(1), lane:girl.lane, scale:girl.scaleX, angle:girl.angle, fsm:girl.fsm, pose:girl.pose },
      pet: pet && { x:+pet.x.toFixed(1), y:+pet.y.toFixed(1), scale:pet.scaleX, angle:pet.angle },
    }
  })
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
try {
  await enterPlay(page)
  await page.waitForTimeout(700)
  console.log('meta-spawn', JSON.stringify(await dumpMeta(page), null, 2))
  await shot(page, 'feel-qa-verify-01-spawn.png')
  await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD')
  await shot(page, 'feel-qa-verify-02-run.png')
  console.log('meta-run', JSON.stringify(await dumpMeta(page), null, 2))
  await page.keyboard.press('KeyK'); await page.waitForTimeout(80)
  await shot(page, 'feel-qa-verify-03-hit.png')
  await page.keyboard.down('KeyD')
  for (let i = 0; i < 8; i++) { await page.keyboard.press('KeyK'); await page.waitForTimeout(180) }
  await page.keyboard.up('KeyD')
  await shot(page, 'feel-qa-verify-04-combat.png')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(350) }
  console.log('meta-jump', JSON.stringify(await dumpMeta(page), null, 2))
  await shot(page, 'feel-qa-verify-05-jump.png')
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2500); await page.keyboard.up('KeyD')
  await shot(page, 'feel-qa-verify-06-scroll.png')
  console.log('meta-scroll', JSON.stringify(await dumpMeta(page), null, 2))
} finally {
  await browser.close()
}
console.log('DONE')
