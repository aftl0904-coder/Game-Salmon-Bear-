/**
 * palette-1: gameplay screenshots with assets fully loaded (no green-grid missing tex).
 * Stage 10 uses applyPaletteForQa(10) on stage 9 layout (STAGES[10] not wired).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.PORT || '47461'
const URL = process.env.URL || `http://127.0.0.1:${PORT}/?c3=1`
const OUT = process.env.OUT || 'docs/qa-palette-1'
const ART = '/opt/cursor/artifacts/qa-palette-1'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const MUST_TEX = [
  'bg-wallpaper',
  'tile-ground-top',
  'coin-cel',
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const report = { ok: true, shots: [], errors: [], texProbe: {} }

async function waitBoot() {
  await page.goto(URL + '&cb=' + Date.now(), { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__SAKE_GAME__?.isBooted, null, { timeout: 90000 })
  await page.waitForFunction(
    (keys) => {
      const g = window.__SAKE_GAME__
      if (!g?.textures) return false
      return keys.every((k) => g.textures.exists(k))
    },
    MUST_TEX,
    { timeout: 90000 },
  )
  // Boot finished → title/menu usually active; give one more beat for late packs.
  await page.waitForTimeout(600)
  report.texProbe = await page.evaluate((keys) => {
    const g = window.__SAKE_GAME__
    const out = {}
    for (const k of keys) out[k] = !!g.textures.exists(k)
    out['s3-market-mid'] = !!g.textures.exists('s3-market-mid')
    out['s7-far-a'] = !!g.textures.exists('s7-far-a') || !!g.textures.exists('s7-warehouse-far')
    out.boy = !!g.textures.exists('boy') || !!g.textures.exists('hero-boy') || !!g.textures.exists('leon')
    return out
  }, MUST_TEX)
  console.log('texProbe', report.texProbe)
}

async function boot(stageNo) {
  await page.evaluate((stageNo) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stageNo)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.registry.set('cheat', false)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)

  for (let i = 0; i < 100; i++) {
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return { started: !!s?.started, story: !!s?.storyIntro, play: !!s }
    })
    if (st.started) break
    if (st.story || st.play) await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    if (!s) return
    // Force gameplay on even if intro stuck (stage 8+ story gates).
    s.started = true
    s.startedAt = s.time?.now ?? 0
    try { s.storyIntro?.destroy?.() } catch {}
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = 99999
    s.stageBeat = 99
    s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.memoryStallX = 99999
    if (s.s8EnterDone?.add) {
      for (const seg of ['A', 'B', 'C', 'D', 'E']) {
        s.s8EnterDone.add(seg)
        s.s8MidDone?.add?.(seg)
      }
    }
    s.s8PupuDone = true
    // Force physics debug OFF (green grids from debug look like missing art).
    try { s.resetPhysicsDebug?.(false) } catch {}
    try { if (s.debugOverlay?.on) s.debugOverlay.toggle() } catch {}
    if (s.physics?.world) {
      s.physics.world.drawDebug = false
      s.physics.world.debugGraphic?.clear?.()
      s.physics.world.debugGraphic?.setVisible?.(false)
    }
    s.physics?.resume?.()
  })
  const ok = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.started)
  if (!ok) throw new Error(`boot stage ${stageNo}: play scene missing`)

  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const x = 520
    s.boy.setPosition(x, s.boy.y)
    s.boy.body?.reset?.(x, s.boy.y)
    s.cameras.main.centerOn(x, s.boy.y)
  })
  await page.waitForTimeout(350)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    try { s.storyIntro?.destroy?.() } catch {}
    s.storyIntro = null
    s.physics?.resume?.()
    // Heal any __MISSING__ sprites if tex arrived late.
    for (const o of s.children.list) {
      const key = o.texture?.key
      if (key === '__MISSING' || key === '__MISSING__') {
        /* leave — art should already be loaded */
      }
    }
  })
  await page.waitForTimeout(250)

  // Fail fast if ground still missing (proves art pack didn't load).
  const missing = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    let miss = 0
    let total = 0
    for (const o of s.children.list) {
      const k = o.texture?.key
      if (!k) continue
      total++
      if (k === '__MISSING' || k === '__MISSING__') miss++
    }
    return { miss, total, bg: s.textures.exists('bg-wallpaper'), ground: s.textures.exists('tile-ground-top') }
  })
  if (!missing.bg || !missing.ground) {
    throw new Error(`assets not loaded: ${JSON.stringify(missing)}`)
  }
  if (missing.miss > missing.total * 0.35) {
    throw new Error(`too many missing textures: ${JSON.stringify(missing)}`)
  }
  return missing
}

try {
  await waitBoot()
  for (let stage = 1; stage <= 10; stage++) {
    const bootStage = stage === 10 ? 9 : stage
    const miss = await boot(bootStage)
    if (stage === 10) {
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        s.applyPaletteForQa(10)
      })
      await page.waitForTimeout(250)
    }
    const name = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      return s.palette?.row?.name || 'unknown'
    })
    const file = path.join(OUT, `stage-${String(stage).padStart(2, '0')}.png`)
    const canvas = page.locator('#game-root canvas').first()
    if (await canvas.count()) await canvas.screenshot({ path: file })
    else await page.screenshot({ path: file })
    fs.copyFileSync(file, path.join(ART, path.basename(file)))
    report.shots.push({ stage, name, file, miss })
    console.log(`OK stage ${stage} (${name}) miss=${miss.miss}/${miss.total} → ${file}`)
  }
} catch (e) {
  report.ok = false
  report.errors.push(String(e?.stack || e))
  console.error(report.errors[0])
  await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {})
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
fs.copyFileSync(path.join(OUT, 'report.json'), path.join(ART, 'report.json'))
await browser.close()
process.exit(report.ok ? 0 : 1)
