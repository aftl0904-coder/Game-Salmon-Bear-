import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.QA_URL ?? 'http://127.0.0.1:47510/'
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
await page.waitForTimeout(800)

const measured = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  if (s.storyIntro) s.storyIntro = null
  s.started = true

  function bodyInfo(spr, label) {
    if (!spr) return { label, missing: true }
    const body = spr.body
    return {
      label,
      scaleX: spr.scaleX,
      scaleY: spr.scaleY,
      displayWidth: spr.displayWidth,
      displayHeight: spr.displayHeight,
      frameW: spr.width,
      frameH: spr.height,
      bodyWidth: body?.width,
      bodyHeight: body?.height,
      bodyHalfW: body?.halfWidth,
      bodyHalfH: body?.halfHeight,
      sourceWidth: body?.sourceWidth,
      sourceHeight: body?.sourceHeight,
      offsetX: body?.offset?.x,
      offsetY: body?.offset?.y,
    }
  }

  const results = { method: null, heroFound: false }

  let heroObj = null
  for (const key of Object.keys(s)) {
    const v = s[key]
    if (v && typeof v === 'object' && v.role === 'boy' && v.body) {
      heroObj = v
      break
    }
    if (Array.isArray(v)) {
      const found = v.find((x) => x?.role === 'boy' && x?.body)
      if (found) {
        heroObj = found
        break
      }
    }
  }
  if (!heroObj) {
    for (const g of Object.values(s).filter((v) => v && typeof v.getChildren === 'function')) {
      const found = g.getChildren().find((x) => x?.role === 'boy')
      if (found) {
        heroObj = found
        break
      }
    }
  }
  results.heroFound = !!heroObj
  results.heroRole = heroObj?.role
  results.heroXY = heroObj ? { x: heroObj.x, y: heroObj.y } : null

  const spawn = Object.getPrototypeOf(s).spawnRoe?.bind(s)
  results.hasSpawn = typeof spawn === 'function'

  const tex = s.textures.get('fx-salmon-shot')
  const fr = tex.get()
  results.texSize = { w: fr.width, h: fr.height }

  if (heroObj && typeof spawn === 'function') {
    const a = spawn(heroObj, heroObj.x + 30, heroObj.y - 36, 0, 180, 1)
    results.power1 = bodyInfo(a, 'power1')
    a.destroy()
    const b = spawn(heroObj, heroObj.x + 30, heroObj.y - 36, 0, 180, 0.5)
    results.powerLight = bodyInfo(b, 'powerLight')
    b.destroy()
    const c = spawn(heroObj, heroObj.x + 30, heroObj.y - 36, 0, 180, 2.2)
    results.powerHeavy = bodyInfo(c, 'powerHeavy')
    c.destroy()
    results.method = 'spawnRoe'
  } else {
    const spr = s.physics.add.sprite(200, 200, 'fx-salmon-shot')
    spr.setScale(1.7)
    results.power1 = bodyInfo(spr, 'manual-1.7')
    spr.setScale(1.7 * 0.8)
    results.powerLight = bodyInfo(spr, 'manual-1.36')
    spr.setScale(1.7 * 1.4)
    results.powerHeavy = bodyInfo(spr, 'manual-2.38')
    spr.destroy()
    results.method = 'manual'
  }

  return results
})

fs.writeFileSync(`${OUT}/before-body.json`, JSON.stringify(measured, null, 2))
console.log(JSON.stringify(measured, null, 2))

await page.locator('#game-root canvas').screenshot({ path: `${OUT}/before-stage.png` })

// Fire a real attack for visual
await page.keyboard.press('j')
await page.waitForTimeout(120)
await page.locator('#game-root canvas').screenshot({ path: `${OUT}/before-shot.png` })

await browser.close()
console.log('DONE')
