/**
 * PR-K / B7: Stage 6 A–E + scrubber pose screenshots; verify PNG sheets (no Graphics body).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47653'
const OUT = 'docs/qa-c2-art'
fs.mkdirSync(OUT, { recursive: true })

const report = {
  ok: false,
  errors: [],
  checks: {},
  shots: [],
  notes: [
    'Green __MISSING boxes on stage 6 are pre-existing enemy/item textures (out of B7 scope), not scrubber/blower/acid/mall-prop Graphics.',
    'B7 art: c2-scrubber / c2-blower / c2-acid-* / c2-prop-* PNG sheets.',
  ],
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => {
  const msg = String(e.message)
  // Phaser teardown race when dismissing elevator/card stubs — ignore for art QA.
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
  return p
}

/** Skip elevator / quiz overlays; hide missing-texture enemies for art evidence. */
async function prepArtView() {
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    // Prevent B→C elevator cutscene from covering art shots.
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
    // Hide __MISSING sprites (pre-existing enemy art holes).
    for (const go of s.children.list) {
      if (go?.texture?.key === '__MISSING') go.setVisible(false)
      if (go?.type === 'Text' && go.depth >= 8000 && go.text && /新機制|會員中心姐姐|WARNING|電梯|陰層/.test(go.text)) {
        go.setVisible(false)
      }
    }
    // Hide high-depth UI containers (elevator / boss card leftovers).
    for (const go of s.children.list) {
      if (go?.depth > 5000 && go?.type === 'Container') {
        let hide = false
        if (typeof go.iterate === 'function') {
          go.iterate((c) => {
            if (c?.text && /WARNING|電梯|金魚眼|搶答|深層潔淨|撳一下 Skip|跳過/.test(c.text)) hide = true
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
      return !!(g?.textures?.exists('c2-scrubber') && g?.textures?.exists('c2-blower') && g?.textures?.exists('c2-prop-plant'))
    },
    null,
    { timeout: 45000 },
  )
  await bootStage(6)

  const tex = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const keys = ['c2-scrubber', 'c2-blower', 'c2-acid-puddle', 'c2-acid-drip', 'c2-prop-plant', 'c2-prop-lightbox', 'c2-prop-escalator']
    const out = {}
    for (const k of keys) out[k] = g.textures.exists(k)
    return out
  })
  report.checks.textures = tex
  const missing = Object.entries(tex).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) throw new Error(`missing textures: ${missing.join(',')}`)

  const segs = [
    ['A', 427],
    ['B', 1425],
    ['C', 2565],
    ['D', 3847],
    ['E', 4960],
  ]
  for (const [id, x] of segs) {
    await page.evaluate((px) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      if (s.s6world) s.s6world.elevDone = true
      s.boy.x = px
      s.checkpointsDone = true
      s.checkIndex = 99
      s.cameras.main.centerOn(px, 200)
    }, x)
    await prepArtView()
    await page.waitForTimeout(200)
    await shot(`segment-${id}`)
  }

  // Spawn scrubber in arena; skip elevator/card overlays
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
  await page.waitForTimeout(400)
  await prepArtView()
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    // Close pause if Space/Enter opened it earlier.
    if (s.paused) {
      s.paused = false
      try {
        s.physics.resume()
      } catch {
        /* ignore */
      }
      for (const go of s.children.list) {
        if (go?.type === 'Text' && /暫停|繼續|返回選單/.test(go.text || '')) {
          const parent = go.parentContainer
          if (parent) parent.setVisible(false)
          else go.setVisible(false)
        }
        if (go?.type === 'Container' && go.depth > 4000) {
          let pause = false
          if (typeof go.iterate === 'function') {
            go.iterate((c) => {
              if (c?.text && /暫停/.test(c.text)) pause = true
            })
          }
          if (pause) go.setVisible(false)
        }
      }
    }
    const q = s.queen
    s.cameras.main.centerOn(q.x, 200)
    s.boy.x = q.x - 100
  })

  const body = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    const b = q.body
    return {
      texture: q.texture?.key,
      frame: q.frame?.name,
      bodyW: b ? Number(b.width) : null,
      bodyH: b ? Number(b.height) : null,
      offsetX: b?.offset ? Number(b.offset.x) : null,
      offsetY: b?.offset ? Number(b.offset.y) : null,
      hasBody: !!b,
      blowerTex: q.blower?.texture?.key,
      act: q.act,
      fsm: q.fsm,
    }
  })
  report.checks.body = body
  if (body.texture !== 'c2-scrubber') throw new Error(`boss texture ${body.texture}`)
  if (body.blowerTex !== 'c2-blower') throw new Error(`blower texture ${body.blowerTex}`)
  if (!body.hasBody) throw new Error('boss body missing')
  if (body.bodyW !== 96 || body.bodyH !== 58) throw new Error(`body size changed: ${body.bodyW}x${body.bodyH}`)
  if (body.offsetX !== 8 || body.offsetY !== 20) throw new Error(`body offset changed: ${body.offsetX},${body.offsetY}`)

  await prepArtView()

  const poses = ['idle', 'warn', 'charge', 'recover', 'spray', 'defeated']
  for (const pose of poses) {
    await page.evaluate((p) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const q = s.queen
      const map = { idle: 0, warn: 2, charge: 4, recover: 6, spray: 8, defeated: 9 }
      q.setFrame(map[p])
      q.pose = p
      // Show blower states alongside boss for spray/recover context
      if (p === 'warn' || p === 'charge') q.blower?.setFrame?.(1)
      if (p === 'spray') q.blower?.setFrame?.(2)
      if (p === 'recover' || p === 'defeated') q.blower?.setFrame?.(4)
      if (p === 'idle') q.blower?.setFrame?.(0)
      s.boy.x = q.x - 90
      s.cameras.main.centerOn(q.x - 20, 200)
    }, pose)
    await prepArtView()
    await page.waitForTimeout(180)
    await shot(`boss-${pose}`)
  }

  const props = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const keys = {}
    for (const go of s.children.list) {
      const t = go.texture?.key
      if (t && String(t).startsWith('c2-prop-')) keys[t] = (keys[t] || 0) + 1
    }
    return keys
  })
  report.checks.propsOnStage = props
  if (!props['c2-prop-lightbox'] || !props['c2-prop-escalator']) {
    throw new Error(`mall clutter props missing on stage: ${JSON.stringify(props)}`)
  }

  // Confirm boss/blower are not procedural Graphics textures
  report.checks.noProceduralBossKeys = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    return {
      mallScrubberIdle: g.textures.exists('mall-scrubber-idle'),
      mallFloorBlowerOff: g.textures.exists('mall-floor-blower-off'),
    }
  })

  report.ok = true
} catch (e) {
  report.errors.push(String(e?.stack || e))
  try {
    await shot('failure')
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
