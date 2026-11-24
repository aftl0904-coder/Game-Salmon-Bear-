/**
 * Manus scrubber-art-v2 acceptance shots → docs/qa-scrubber-art-v2/
 * Boss 6 poses + face L/R, blower on, clean-cart, foam.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47661'
const OUT = 'docs/qa-scrubber-art-v2'
fs.mkdirSync(OUT, { recursive: true })

const report = { ok: false, errors: [], checks: {}, shots: [] }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => {
  const msg = String(e.message)
  if (/drawImage|Cannot read properties of null/.test(msg)) return
  report.errors.push(msg)
})

async function bootStage(stageNo) {
  await page.evaluate((n) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', n)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  const start = Date.now()
  while (Date.now() - start < 25000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })
    if (st) return
    await page.waitForTimeout(120)
  }
  throw new Error(`stage ${stageNo} did not start`)
}

async function shot(name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  report.shots.push(p)
}

async function prepArtView() {
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    if (s.s6world) s.s6world.elevDone = true
    if (s.storyIntro?.destroy) {
      try {
        s.storyIntro.destroy()
      } catch {
        /* ignore */
      }
    }
    s.storyIntro = null
    try {
      s.physics.resume()
    } catch {
      /* ignore */
    }
    s.paused = false
    for (const go of s.children.list) {
      if (go?.texture?.key === '__MISSING') go.setVisible(false)
      if (go?.type === 'Text' && go.depth >= 8000 && go.text && /新機制|會員中心姐姐|WARNING|電梯|陰層|暫停/.test(go.text)) {
        go.setVisible(false)
      }
      if (go?.depth > 5000 && go?.type === 'Container') {
        let hide = false
        if (typeof go.iterate === 'function') {
          go.iterate((c) => {
            if (c?.text && /WARNING|電梯|金魚眼|搶答|深層潔淨|撳一下 Skip|跳過|暫停/.test(c.text)) hide = true
          })
        }
        if (hide) go.setVisible(false)
      }
    }
  })
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await page.waitForFunction(
    () => {
      const g = window.__SAKE_GAME__
      return !!(
        g?.textures?.exists('c2-scrubber') &&
        g?.textures?.exists('c2-blower') &&
        g?.textures?.exists('c2-clean-cart') &&
        g?.textures?.exists('c2-foam')
      )
    },
    null,
    { timeout: 45000 },
  )

  const texMeta = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const frameCount = (key) => {
      const t = g.textures.get(key)
      return t ? t.frameTotal : 0
    }
    return {
      scrubberFrames: frameCount('c2-scrubber'),
      blowerFrames: frameCount('c2-blower'),
      cartFrames: frameCount('c2-clean-cart'),
      foamFrames: frameCount('c2-foam'),
    }
  })
  report.checks.texMeta = texMeta
  // Phaser counts __BASE + frames → expect 13 / 5 / 3 / 3
  if (texMeta.scrubberFrames < 12) throw new Error(`scrubber frames ${texMeta.scrubberFrames}`)
  if (texMeta.blowerFrames < 4) throw new Error(`blower frames ${texMeta.blowerFrames}`)

  await bootStage(6)

  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    if (s.s6world) s.s6world.elevDone = true
    s.boy.x = 4900
    s.checkpointsDone = true
    s.checkIndex = 99
    s.bossFight = true
    s.bossOn = true
    Object.getPrototypeOf(s).queenReveal.call(s, {
      kind: 'mall-scrubber',
      triggerX: 4680,
      arenaX0: 4640,
      arenaX1: 5280,
    })
  })
  await page.waitForFunction(
    () => window.__SAKE_GAME__?.scene?.getScene('play')?.queen?.species === 'mall-scrubber',
    null,
    { timeout: 10000 },
  )
  await page.waitForTimeout(300)
  await prepArtView()

  const body = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    const b = q.body
    return {
      texture: q.texture?.key,
      bodyW: b ? Number(b.width) : null,
      bodyH: b ? Number(b.height) : null,
      offsetX: b?.offset ? Number(b.offset.x) : null,
      offsetY: b?.offset ? Number(b.offset.y) : null,
      blowerTex: q.blower?.texture?.key,
    }
  })
  report.checks.body = body
  if (body.texture !== 'c2-scrubber') throw new Error(`boss texture ${body.texture}`)
  if (body.blowerTex !== 'c2-blower') throw new Error(`blower texture ${body.blowerTex}`)
  if (body.bodyW !== 96 || body.bodyH !== 58) throw new Error(`body size ${body.bodyW}x${body.bodyH}`)
  if (body.offsetX !== 8 || body.offsetY !== 20) throw new Error(`body offset ${body.offsetX},${body.offsetY}`)

  // Boss 6 states (v2 indices)
  const poses = [
    ['idle', 0],
    ['warn', 2],
    ['charge', 4],
    ['recover', 6],
    ['spray', 8],
    ['spin', 9],
    ['defeated', 11],
  ]
  for (const [name, frame] of poses) {
    await page.evaluate(
      ({ frame, name }) => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        const q = s.queen
        q.setFlipX(false) // face left (art default)
        q.setFrame(frame)
        q.pose = name
        q.blower?.setFrame?.(name === 'warn' ? 1 : name === 'spray' || name === 'spin' ? 2 : 0)
        q.blower?.setFlipX?.(false)
        s.boy.x = q.x - 100
        s.cameras.main.centerOn(q.x - 10, 200)
      },
      { frame, name },
    )
    await prepArtView()
    await page.waitForTimeout(120)
    await shot(`boss-${name}`)
  }

  // Face left / right
  for (const [tag, flip] of [
    ['face-L', false],
    ['face-R', true],
  ]) {
    await page.evaluate((flipX) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const q = s.queen
      q.setFrame(0)
      q.setFlipX(flipX)
      q.blower?.setFrame?.(0)
      q.blower?.setFlipX?.(flipX)
      s.boy.x = flipX ? q.x + 110 : q.x - 110
      s.cameras.main.centerOn(q.x, 200)
    }, flip)
    await prepArtView()
    await page.waitForTimeout(120)
    await shot(`boss-${tag}`)
  }

  // Blower blasting (on frames 2–3)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    q.setFrame(0)
    q.setFlipX(false)
    q.blower.setFrame(2)
    q.blower.setFlipX(false)
    q.blowerPhase = 'blast'
    s.boy.x = q.x - 120
    s.cameras.main.centerOn(q.blower.x, 200)
  })
  await prepArtView()
  await page.waitForTimeout(120)
  await shot('blower-on')

  // Clean cart push + broken
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const floor = q.hooks6?.floorY?.() ?? q.y
    if (q.cart?.img) {
      q.cart.img.destroy()
      q.cart.label?.destroy()
    }
    const img = s.add.image(q.x - 80, floor, 'c2-clean-cart', 0).setOrigin(0.5, 1).setDepth(600)
    const label = s.add.text(img.x, floor - 48, '清潔車', { fontSize: '10px', color: '#203040', backgroundColor: '#e0e8f0' }).setOrigin(0.5)
    q.cart = { img, label, dir: 1, hp: 3, hitAt: 0 }
    window.__qaCart = img
    s.cameras.main.centerOn(img.x, 200)
  })
  await prepArtView()
  await page.waitForTimeout(100)
  await shot('clean-cart-push')
  await page.evaluate(() => {
    window.__qaCart.setFrame(1)
  })
  await page.waitForTimeout(80)
  await shot('clean-cart-broken')

  // Foam strip
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const floor = q.y
    const foam = s.add
      .image(q.x, floor - 6, 'c2-foam', 0)
      .setOrigin(0.5, 1)
      .setDisplaySize(160, 12)
      .setDepth(500)
    window.__qaFoam = foam
    s.cameras.main.centerOn(foam.x, 220)
  })
  await prepArtView()
  await page.waitForTimeout(80)
  await shot('foam-0')
  const foamOk = await page.evaluate(() => {
    const f = window.__qaFoam
    if (!f?.active) return false
    f.setFrame(1)
    return true
  })
  if (!foamOk) throw new Error('foam sprite missing before foam-1 shot')
  await page.waitForTimeout(80)
  await shot('foam-1')

  report.ok = report.errors.length === 0
} catch (e) {
  report.errors.push(String(e?.stack || e))
  report.ok = false
  try {
    await shot('error')
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
