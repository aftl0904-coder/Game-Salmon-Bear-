/**
 * palette-1: one gameplay screenshot per stage (skip story).
 * Stage 10 uses applyPaletteForQa(10) on stage 9 layout (STAGES[10] not wired yet).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.PORT || '47461'
const URL = process.env.URL || `http://127.0.0.1:${PORT}/?c3=1`
const OUT = process.env.OUT || 'docs/qa-palette-1'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const report = { ok: true, shots: [], errors: [] }

async function boot(stageNo) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene, null, { timeout: 60000 })
  await page.evaluate((stageNo) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stageNo)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  for (let i = 0; i < 80; i++) {
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return { started: !!s?.started, story: !!s?.storyIntro, play: !!s }
    })
    if (st.started) break
    if (st.story || st.play) await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
  }
  const ok = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.started)
  if (!ok) throw new Error(`boot stage ${stageNo}: play.started never set`)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    // Dismiss any active story/dialogue overlay (must call destroy if present).
    try { s.storyIntro?.destroy?.() } catch {}
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = 99999
    s.stageBeat = 99
    s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.memoryStallX = 99999
    // Stage 8 section dialogues — mark every known seg done so leadX won't re-trigger.
    if (s.s8EnterDone?.add) {
      for (const seg of ['A', 'B', 'C', 'D', 'E']) {
        s.s8EnterDone.add(seg)
        s.s8MidDone?.add?.(seg)
      }
    }
    s.s8PupuDone = true
    s.physics?.resume?.()
  })
  // Settle past entry cutscene / camera — place past first enter trigger, then clear again.
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const x = 520
    s.boy.setPosition(x, s.boy.y)
    s.boy.body?.reset?.(x, s.boy.y)
    s.cameras.main.centerOn(x, s.boy.y)
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    try { s.storyIntro?.destroy?.() } catch {}
    s.storyIntro = null
    s.physics?.resume?.()
  })
  await page.waitForTimeout(200)
}

try {
  for (let stage = 1; stage <= 10; stage++) {
    const bootStage = stage === 10 ? 9 : stage
    await boot(bootStage)
    if (stage === 10) {
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        s.applyPaletteForQa(10)
      })
      await page.waitForTimeout(200)
    }
    const name = await page.evaluate((stage) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      return s.palette?.row?.name || `stage-${stage}`
    }, stage)
    const file = path.join(OUT, `stage-${String(stage).padStart(2, '0')}.png`)
    // Prefer canvas-only so HUD chrome outside game root is excluded if any.
    const canvas = page.locator('#game-root canvas').first()
    if (await canvas.count()) await canvas.screenshot({ path: file })
    else await page.screenshot({ path: file })
    report.shots.push({ stage, name, file })
    console.log(`OK stage ${stage} (${name}) → ${file}`)
  }
} catch (e) {
  report.ok = false
  report.errors.push(String(e?.stack || e))
  console.error(report.errors[0])
  await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {})
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
await browser.close()
process.exit(report.ok ? 0 : 1)
