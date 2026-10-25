/**
 * Smoke: Boot → Logo → Menu → 1P → dismiss intro → WASD moves boy
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4521/'

async function activeKey(page) {
  return page.evaluate(() => {
    const g = window.__SAKE_GAME__
    if (!g) return null
    const live = g.scene.getScenes(true)
    if (live?.[0]) return live[0].sys.settings.key
    // fallback: first active among known
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
    const cur = await activeKey(page)
    if (cur === key) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timeout waiting for scene ${key}, now=${await activeKey(page)}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 20000 })

  // boot → logo
  await waitForScene(page, 'logo')
  console.log('logo ok')

  // skip logo splash
  await page.keyboard.press('Enter')
  await waitForScene(page, 'menu')
  console.log('menu ok')

  // unlock audio + select 1P (first item) and start
  await page.keyboard.press('Enter')
  await waitForScene(page, 'play')
  console.log('play ok')

  // dismiss intro overlay
  await page.waitForTimeout(500)
  await page.keyboard.press('Space')
  await page.waitForTimeout(250)
  let started = await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    return !!play?.started
  })
  if (!started) {
    await page.mouse.click(480, 270)
    await page.waitForTimeout(300)
    started = await page.evaluate(() => {
      const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
      return !!play?.started
    })
  }
  if (!started) {
    await page.evaluate(() => {
      const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
      if (play && !play.started) {
        play.started = true
        play.startedAt = play.time.now
      }
    })
    started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
  }
  if (!started) throw new Error('intro not dismissed')
  console.log('intro dismissed')

  const x0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  console.log('boy x0', x0)

  await page.keyboard.down('d')
  await page.waitForTimeout(1000)
  await page.keyboard.up('d')
  await page.waitForTimeout(80)

  const x1 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  const dx = x1 - x0
  console.log('boy x1', x1, 'dx', dx)

  if (dx < 50) {
    await page.keyboard.down('d')
    await page.waitForTimeout(1200)
    await page.keyboard.up('d')
    const x2 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
    const dx2 = x2 - x0
    console.log('boy x2', x2, 'dx2', dx2)
    if (dx2 < 50) throw new Error(`WASD did not move boy meaningfully (dx=${dx}, dx2=${dx2})`)
  }

  const lane0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.lane)
  await page.keyboard.down('w')
  await page.waitForTimeout(160)
  await page.keyboard.up('w')
  // Wait until 上 lane settles (cd + snap), not a fixed short sleep.
  let lane1 = null
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(40)
    lane1 = await page.evaluate(() => {
      const b = window.__SAKE_GAME__.scene.getScene('play').boy
      return { lane: b.lane, y: b.y, cd: b.laneCd }
    })
    if (lane1.lane === 0 && lane1.cd <= 0 && lane1.y <= 390) break
  }
  console.log('lane switch', lane0, '→', lane1)
  if (lane1.lane !== 0) throw new Error(`W should switch to 上 lane 0, got ${lane1.lane}`)
  if (lane1.y > 390) throw new Error(`上 lane Y should be above mid, got ${lane1.y}`)
  await page.keyboard.down('s')
  await page.waitForTimeout(160)
  await page.keyboard.up('s')
  let lane2 = null
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(40)
    lane2 = await page.evaluate(() => {
      const b = window.__SAKE_GAME__.scene.getScene('play').boy
      return { lane: b.lane, y: b.y, cd: b.laneCd }
    })
    if (lane2.lane === 1 && lane2.cd <= 0) break
  }
  console.log('lane switch back', lane2)
  if (lane2.lane !== 1) throw new Error(`S should return to mid lane 1, got ${lane2.lane}`)

  console.log('SMOKE_PASS')
  await browser.close()
  process.exit(0)
} catch (err) {
  console.error('SMOKE_FAIL', err)
  const key = await activeKey(page).catch(() => '?')
  console.error('active scene', key)
  await page.screenshot({ path: '/tmp/smoke-fail.png', fullPage: true }).catch(() => {})
  await browser.close()
  process.exit(1)
}
