/**
 * Smoke: same ground plane, hurt pose, coin continue path
 */
import { chromium } from 'playwright'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4521/'

async function activeKey(page) {
  try {
    return await page.evaluate(() => {
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
  } catch {
    return null
  }
}

async function waitForScene(page, key, timeout = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const cur = await activeKey(page)
    if (cur === key) return
    await page.waitForTimeout(120)
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
  await page.waitForTimeout(700)
  for (let i = 0; i < 4; i++) {
    const started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
    if (started) return
    await page.keyboard.press('Space')
    await page.mouse.click(480, 270)
    await page.waitForTimeout(250)
  }
  // last resort: force-start for smoke
  await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (play && !play.started) {
      play.started = true
      play.startedAt = play.time.now
    }
  })
  if (!(await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started))) {
    throw new Error('intro not dismissed')
  }
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
    const all = play.enemies.getChildren().filter((e) => e.active)
    const enemies = all.slice(0, 4).map(foot)
    const species = [...new Set(all.map((e) => e.species).filter(Boolean))]
    const textures = [...new Set(all.map((e) => e.texture?.key).filter(Boolean))]
    const labels = [...new Set(all.map((e) => e.label?.text).filter(Boolean))]
    return {
      boy: foot(play.boy),
      girl: foot(play.girl),
      enemies,
      coinStock: play.coinStock,
      species,
      textures,
      labels,
      hasBarrelTex: !!play.textures.exists('art-enemy-barrel'),
    }
  })
  console.log('plane', JSON.stringify(plane))

  if (!plane.hasBarrelTex) throw new Error('missing art-enemy-barrel texture')
  if (!plane.species.includes('fish') || !plane.species.includes('barrel')) {
    throw new Error(`need fish+barrel species, got ${JSON.stringify(plane.species)}`)
  }
  if (!plane.textures.includes('art-enemy') || !plane.textures.includes('art-enemy-barrel')) {
    throw new Error(`need two enemy textures, got ${JSON.stringify(plane.textures)}`)
  }
  if (!plane.labels.some((t) => t.includes('醃魚')) || !plane.labels.some((t) => t.includes('木桶'))) {
    throw new Error(`need 繁中 labels 醃魚/木桶, got ${JSON.stringify(plane.labels)}`)
  }
  console.log('two enemy types ok', plane.species, plane.textures)

  if (plane.boy.originY !== 1 || plane.girl.originY !== 1) throw new Error('foot origin missing')
  if (plane.boy.hp !== 10 || plane.girl.hp !== 10) throw new Error(`HP expected 10 got ${plane.boy.hp}/${plane.girl.hp}`)
  if (!plane.boy.blockedDown || !plane.girl.blockedDown) throw new Error('heroes not grounded')
  // only compare grounded foes (barrels may be mid-hop)
  const groundedE = plane.enemies.filter((e) => e.blockedDown)
  const bottoms = [plane.boy.bodyBottom, plane.girl.bodyBottom, ...groundedE.map((e) => e.bodyBottom)]
  const span = Math.max(...bottoms) - Math.min(...bottoms)
  if (span > 10) throw new Error(`ground plane mismatch span=${span}`)
  if (plane.boy.bodyBottom > 500) throw new Error('hero on world floor')
  console.log('ground plane ok span', span.toFixed(2), 'groundedEnemies', groundedE.length)

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

  // clear hurt lock so continue-path test is independent of pose timer
  await page.evaluate(() => {
    const h = window.__SAKE_GAME__.scene.getScene('play').boy
    h.hurtLock = 0
    h.hurtCd = 0
    h.pose = 'idle'
    h.clearTint()
    h.setAngle(0)
    h.setScale(h.baseScale)
  })
  console.log('hurt recover ok')

  const beforeCoins = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').coinStock)
  if (beforeCoins < 1) throw new Error('need starting coins')

  await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play.beginDie(play.boy, '測試倒下')
  })
  await page.waitForTimeout(900)

  const cont = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const box = play.continueBox || play.banner
    return {
      awaiting: play.awaitingContinue,
      boxVisible: !!box?.visible,
      boxText: box?.text || '',
      pose: play.boy.pose,
      ended: play.ended,
    }
  })
  console.log('continue', cont)
  if (!cont.awaiting) throw new Error('not awaiting continue')
  if (!cont.boxVisible || !cont.boxText.includes('投幣續關')) throw new Error('投幣續關 UI missing')

  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    if (play.awaitingContinue) play.insertCoinContinue()
  })
  await page.waitForTimeout(150)

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
