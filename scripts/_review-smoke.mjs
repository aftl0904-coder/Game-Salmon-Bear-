/**
 * Review smoke: Boot→Logo→Menu→Play + jump/enemies/HUD notes + screenshots
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4521/'
const OUT = '/tmp/sake-review'
mkdirSync(OUT, { recursive: true })

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
    if (cur === key) return cur
    await page.waitForTimeout(80)
  }
  throw new Error(`timeout waiting for scene ${key}, now=${await activeKey(page)}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console:' + m.text())
})

const notes = []

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 20000 })
  notes.push(`booted scene=${await activeKey(page)}`)

  await waitForScene(page, 'logo')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/01-logo.png` })
  notes.push('logo ok')

  await page.keyboard.press('Enter')
  await waitForScene(page, 'menu')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/02-menu.png` })
  const menuText = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('menu')
    const texts = []
    s.children?.list?.forEach?.((c) => {
      if (c.text) texts.push(c.text)
    })
    return texts
  })
  notes.push('menu texts: ' + JSON.stringify(menuText).slice(0, 500))

  await page.keyboard.press('Enter')
  await waitForScene(page, 'play')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-play-intro.png` })
  notes.push('play intro ok')

  await page.keyboard.press('Space')
  await page.waitForTimeout(350)
  let started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
  if (!started) {
    await page.mouse.click(480, 270)
    await page.waitForTimeout(300)
    started = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene?.('play')?.started)
  }
  notes.push(`started=${started}`)
  await page.screenshot({ path: `${OUT}/04-play-start.png` })

  // settle
  await page.waitForTimeout(600)

  const snap = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const foot = (s) => {
      const b = s.body
      return {
        x: +s.x.toFixed(1),
        y: +s.y.toFixed(1),
        bottom: b ? +b.bottom.toFixed(1) : null,
        blockedDown: !!b?.blocked?.down,
        originY: s.originY,
        hp: s.hp,
        kind: s.kind,
        name: s.texture?.key,
        scale: s.scaleX,
      }
    }
    const enemies = play.enemies.getChildren().filter((e) => e.active).map(foot)
    const kinds = enemies.map((e) => e.kind)
    const hud = {
      hasRoot: !!play.hud?.root || !!play.hudRoot,
      coinStock: play.coinStock,
      coinText: play.hud?.coinText?.text ?? play.coinText?.text ?? null,
      info: play.hudInfo?.text ?? play.hud?.info?.text ?? null,
      heartsL: play.hud?.heartsL?.length ?? play.heartsL?.length ?? null,
      maxHpConst: undefined,
    }
    // sample displayed heart visibility count
    let heartVis = 0
    const hearts = play.hud?.heartsL || play.heartsL
    if (hearts) heartVis = hearts.filter((h) => h.visible !== false && (h.alpha ?? 1) > 0.5).length
    return {
      boy: foot(play.boy),
      girl: foot(play.girl),
      enemies,
      kinds,
      gravity: play.physics.world.gravity.y,
      coinStock: play.coinStock,
      awaitingContinue: play.awaitingContinue,
      hasBeginDie: typeof play.beginDie === 'function',
      hasPlayHurtPose: typeof play.playHurtPose === 'function',
      hud,
      heartVis,
      keys: Object.keys(play).filter((k) => /hud|coin|heart|hp|jump/i.test(k)),
    }
  })
  notes.push('snap ' + JSON.stringify(snap))

  // move + jump
  const y0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.y)
  await page.keyboard.press('k') // jump (B)
  await page.waitForTimeout(180)
  const mid = await page.evaluate(() => {
    const b = window.__SAKE_GAME__.scene.getScene('play').boy
    return { y: b.y, vy: b.body.velocity.y }
  })
  await page.waitForTimeout(500)
  const y1 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.y)
  const jumpRise = y0 - Math.min(y0, mid.y)
  notes.push(`jump y0=${y0.toFixed(1)} midY=${mid.y.toFixed(1)} vy=${mid.vy.toFixed(1)} y1=${y1.toFixed(1)} rise=${jumpRise.toFixed(1)}`)

  // walk toward first enemy, try shoot
  await page.keyboard.down('d')
  await page.waitForTimeout(1400)
  await page.keyboard.up('d')
  await page.keyboard.press('j')
  await page.waitForTimeout(200)
  await page.keyboard.press('j')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/05-play-combat.png` })

  const after = await page.evaluate(() => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    const enemies = play.enemies.getChildren().filter((e) => e.active).map((e) => ({
      kind: e.kind,
      hp: e.hp,
      x: +e.x.toFixed(1),
      state: e.state,
    }))
    return {
      boy: { x: +play.boy.x.toFixed(1), y: +play.boy.y.toFixed(1), hp: play.boy.hp, grace: play.boy.grace },
      girl: { x: +play.girl.x.toFixed(1), y: +play.girl.y.toFixed(1), hp: play.girl.hp },
      enemies,
      ended: play.ended,
      info: play.hudInfo?.text,
      pageTitle: document.title,
    }
  })
  notes.push('after ' + JSON.stringify(after))

  // try W jump as well
  await page.keyboard.press('w')
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/06-play-move.png` })

  console.log(JSON.stringify({ notes, errors }, null, 2))
  console.log('REVIEW_SMOKE_DONE')
  await browser.close()
  process.exit(0)
} catch (err) {
  console.error('REVIEW_FAIL', err)
  console.error(JSON.stringify({ notes, errors }, null, 2))
  await page.screenshot({ path: `${OUT}/fail.png` }).catch(() => {})
  await browser.close()
  process.exit(1)
}
