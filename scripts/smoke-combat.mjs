/**
 * Smoke: same ground plane, hurt pose, coin continue path
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4521/'

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
    const cur = await activeKey(page)
    if (cur === key) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timeout waiting for scene ${key}, now=${await activeKey(page)}`)
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
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  let started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
  if (!started) {
    await page.mouse.click(480, 270)
    await page.waitForTimeout(300)
    started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
  }
  if (!started) throw new Error('intro not dismissed')
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

try {
  await enterPlay(page)
  console.log('play started')
  await page.waitForTimeout(800)

  const plane = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const foot = (s) => {
      const b = s.body
      return {
        y: s.y,
        bodyBottom: b.bottom,
        blockedDown: b.blocked.down,
        originY: s.originY,
        hp: s.hp,
        pose: s.pose,
      }
    }
    const enemies = play.enemies.getChildren().filter((e) => e.active).slice(0, 4).map(foot)
    return {
      boy: foot(play.boy),
      girl: foot(play.girl),
      enemies,
      coinStock: play.coinStock,
    }
  })
  console.log('plane', JSON.stringify(plane))

  if (plane.boy.originY !== 1 || plane.girl.originY !== 1) throw new Error('foot origin missing')
  if (plane.boy.hp !== 10 || plane.girl.hp !== 10) throw new Error(`HP expected 10 got ${plane.boy.hp}/${plane.girl.hp}`)
  if (!plane.boy.blockedDown || !plane.girl.blockedDown) throw new Error('heroes not grounded')
  const bottoms = [plane.boy.bodyBottom, plane.girl.bodyBottom, ...plane.enemies.map((e) => e.bodyBottom)]
  const span = Math.max(...bottoms) - Math.min(...bottoms)
  if (span > 10) throw new Error(`ground plane mismatch span=${span}`)
  if (plane.boy.bodyBottom > 500) throw new Error('hero on world floor')
  console.log('ground plane ok span', span.toFixed(2))

  const hurt = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play.playHurtPose(play.boy, -1)
    return { pose: play.boy.pose, angle: play.boy.angle, scaleY: play.boy.scaleY, base: play.boy.baseScale }
  })
  console.log('hurt', hurt)
  if (hurt.pose !== 'hurt') throw new Error('hurt pose not set')
  if (Math.abs(hurt.angle) < 5) throw new Error('hurt angle missing')
  if (hurt.scaleY >= hurt.base * 0.95) throw new Error('hurt squash missing')
  console.log('hurt pose ok')

  await page.waitForTimeout(400)
  const after = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.pose)
  if (after !== 'idle') throw new Error(`hurt stuck: ${after}`)

  const beforeCoins = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').coinStock)
  if (beforeCoins < 1) throw new Error('need starting coins')

  await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play.beginDie(play.boy, '測試倒下')
  })
  await page.waitForTimeout(900)

  const cont = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    return {
      awaiting: play.awaitingContinue,
      boxVisible: play.continueBox.visible,
      boxText: play.continueBox.text,
      pose: play.boy.pose,
    }
  })
  console.log('continue', cont)
  if (!cont.awaiting) throw new Error('not awaiting continue')
  if (!cont.boxVisible || !cont.boxText.includes('投幣續關')) throw new Error('投幣續關 UI missing')

  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const revived = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    return {
      alive: play.boy.alive,
      awaiting: play.awaitingContinue,
      hp: play.boy.hp,
      coins: play.coinStock,
      bodyBottom: play.boy.body.bottom,
    }
  })
  console.log('revived', revived)
  if (!revived.alive || revived.awaiting) throw new Error('continue failed')
  if (revived.coins !== beforeCoins - 1) throw new Error('coin not spent')
  if (revived.hp < 6) throw new Error('respawn HP low')
  if (revived.bodyBottom > 500) throw new Error('revived on world floor')

  console.log('SMOKE_PASS combat')
  await browser.close()
  process.exit(0)
} catch (err) {
  console.error('SMOKE_FAIL', err)
  await page.screenshot({ path: '/tmp/smoke-combat-fail.png', fullPage: true }).catch(() => {})
  await browser.close()
  process.exit(1)
}
