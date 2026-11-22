import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.QA_URL ?? 'http://127.0.0.1:47510/'
const TAG = process.env.QA_TAG ?? 'measure'
const OUT = 'docs/qa-roe-size'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await context.newPage()
page.on('pageerror', e => console.log('PAGEERROR', e.message))

await page.goto(BASE + '?c2=0', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 60000 })
await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  g.registry.set('stageNo', 1)
  g.registry.set('difficulty', 'normal')
  g.registry.set('playMode', '1p')
  g.registry.set('soloCast', 'boy')
  g.registry.set('stageRound', 1)
  for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
  g.scene.start('play')
})
await page.waitForFunction(() => window.__SAKE_GAME__?.scene.getScene('play')?.scene.isActive(), null, { timeout: 60000 })
await page.waitForTimeout(1000)
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
await page.keyboard.press('Enter')
await page.waitForTimeout(600)

const measured = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  if (s.storyIntro) s.storyIntro = null
  s.started = true
  const hero = s.boy
  const spawn = Object.getPrototypeOf(s).spawnRoe.bind(s)
  const tex = s.textures.get('fx-salmon-shot').get()

  function info(spr) {
    const b = spr.body
    // Force body update so world bounds reflect scale
    b.updateFromGameObject?.()
    return {
      scaleX: spr.scaleX,
      displayW: spr.displayWidth,
      displayH: spr.displayHeight,
      bodyW: b.width,
      bodyH: b.height,
      sourceW: b.sourceWidth,
      sourceH: b.sourceHeight,
      halfW: b.halfWidth,
      halfH: b.halfHeight,
      worldW: b.right - b.left,
      worldH: b.bottom - b.top,
      offsetX: b.offset.x,
      offsetY: b.offset.y,
      left: b.left,
      right: b.right,
      top: b.top,
      bottom: b.bottom,
    }
  }

  const out = { tex: { w: tex.width, h: tex.height }, powers: {} }
  for (const [name, power] of [['p1', 1], ['light', 0.5], ['heavy', 2.2]]) {
    const shot = spawn(hero, hero.x + 40, hero.y - 40, 0, 220, power)
    // advance one frame for body sync
    s.physics.world.update(0, 16)
    out.powers[name] = info(shot)
    // keep one shot visible for screenshot
    if (name !== 'p1') shot.destroy()
    else {
      shot.setVelocity(0, 0)
      out.keptShot = true
    }
  }
  // also fire a real-looking frozen shot near boy for screenshot
  const vis = spawn(hero, hero.x + 50, hero.y - 48, 0, 400, 1)
  vis.setVelocity(0, 0)
  out.visual = info(vis)
  return out
})

fs.writeFileSync(`${OUT}/${TAG}-body.json`, JSON.stringify(measured, null, 2))
console.log(TAG, JSON.stringify(measured, null, 2))
await page.locator('#game-root canvas').screenshot({ path: `${OUT}/${TAG}-shot.png` })
await browser.close()
