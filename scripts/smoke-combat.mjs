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

  // settle on ground
  await page.waitForTimeout(700)

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
      maxHp: 10,
    }
  })
  console.log('plane', JSON.stringify(plane))

  if (plane.boy.originY !== 1 || plane.girl.originY !== 1) {
    throw new Error('heroes must use foot origin (originY=1)')
  }
  if (plane.boy.hp !== 10 || plane.girl.hp !== 10) {
    throw new Error(`expected HP 10, got boy=${plane.boy.hp} girl=${plane.girl.hp}`)
  }
  if (!plane.boy.blockedDown || !plane.girl.blockedDown) {
    throw new Error('heroes not grounded')
  }
  const bottoms = [plane.boy.bodyBottom, plane.girl.bodyBottom, ...plane.enemies.map((e) => e.bodyBottom)]
  const minB = Math.min(...bottoms)
  const maxB = Math.max(...bottoms)
  if (maxB - minB > 8) {
    throw new Error(`ground plane mismatch bodyBottoms span=${maxB - minB} bottoms=${bottoms}`)
  }
  // must NOT be on world floor
  if (plane.boy.bodyBottom > 500 || plane.girl.bodyBottom > 500) {
    throw new Error('heroes still on world floor — physics plane bug')
  }
  console.log('ground plane ok, span', (maxB - minB).toFixed(2))

  // hurt pose
  const hurt = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const h = play.boy
    h.grace = 0
    h.hurtCd = 0
    // call private via prototype path — expose by direct damage flow
    play.playHurtPose(h, -1)
    return { pose: h.pose, angle: h.angle, scaleY: h.scaleY, base: h.baseScale }
  })
  console.log('hurt', hurt)
  if (hurt.pose !== 'hurt') throw new Error('hurt pose not set')
  if (Math.abs(hurt.angle) < 5) throw new Error('hurt pose angle missing')
  if (hurt.scaleY >= hurt.base * 0.95) throw new Error('hurt squash missing')
  console.log('hurt pose ok')

  await page.waitForTimeout(400)
  const afterHurt = await page.evaluate(() => {
    const h = window.__SAKE_GAME__.scene.getScene('play').boy
    return { pose: h.pose, angle: h.angle }
  })
  if (afterHurt.pose !== 'idle') throw new Error(`hurt pose stuck: ${afterHurt.pose}`)
  console.log('hurt recover ok')

  // coin continue path: force die → continue UI → insert coin
  const beforeCoins = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').coinStock)
  console.log('coins before', beforeCoins)
  if (beforeCoins < 1) throw new Error('need starting coins')

  await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play.boy.hp = 1
    play.boy.grace = 0
    play.boy.hurtCd = 0
    play.beginDie(play.boy, '測試倒下')
  })

  // wait die pose then continue UI
  await page.waitForTimeout(900)
  const cont = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    return {
      awaiting: play.awaitingContinue || play.boy.awaitingContinue,
      alive: play.boy.alive,
      pose: play.boy.pose,
      boxVisible: play.continueBox?.visible ?? play.banner?.visible,
      boxText: play.continueBox?.text ?? play.banner?.text ?? '',
    }
  })
  console.log('continue ui', cont)
  if (!cont.awaiting) throw new Error('not awaiting continue')
  if (!cont.boxVisible) throw new Error('continue box not visible')
  if (!cont.boxText.includes('投幣續關')) throw new Error('missing 投幣續關 copy')

  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)

  const revived = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    return {
      alive: play.boy.alive,
      awaiting: play.awaitingContinue || play.boy.awaitingContinue,
      hp: play.boy.hp,
      coins: play.coinStock,
      pose: play.boy.pose,
      y: play.boy.y,
      bodyBottom: play.boy.body.bottom,
    }
  })
  console.log('revived', revived)
  if (!revived.alive || revived.awaiting) throw new Error('coin continue did not revive')
  if (revived.coins !== beforeCoins - 1) throw new Error(`coin not spent: ${beforeCoins} -> ${revived.coins}`)
  if (revived.hp < 6) throw new Error(`respawn HP too low: ${revived.hp}`)
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
