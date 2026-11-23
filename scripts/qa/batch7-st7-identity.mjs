/**
 * Batch7 ST7 identity acceptance.
 * D1 compare ST6/ST7 · D2 conveyor · D3 spotlight · D4 rescue · D5 enemies · D6 BGM
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = (() => {
  try {
    return require('canvas')
  } catch {
    return { createCanvas: null, loadImage: null }
  }
})()

const URL = process.env.URL || 'http://127.0.0.1:47461/?c2=1'
const OUT = 'docs/qa-st7-identity'
fs.mkdirSync(OUT, { recursive: true })

const report = { passed: false, checks: {}, errors: [], notes: [], textureAudit: [] }
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function boot(stageNo) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene, null, { timeout: 45000 })
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
  // started flips only after cutscene ends — mash Enter while polling.
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return { started: !!s?.started, story: !!s?.storyIntro, play: !!s }
    })
    if (st.started) break
    if (st.story || st.play) await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
  }
  const ok = await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.started)
  if (!ok) throw new Error(`boot stage ${stageNo}: play.started never set`)
  // Skip stalls / gates that lock storyIntro when QA teleports past checkpoints.
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = 99999
    s.stageBeat = 99
    s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.memoryStallX = 99999
    s.physics?.resume?.()
  })
}

/** Teleport without tripping stalls; keep storyIntro clear so systems tick. */
async function place(x) {
  await page.evaluate((x) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = Math.max(s.lastCheckpointX ?? 0, x + 1)
    s.boy.setPosition(x, s.boy.y)
    s.boy.body.reset(x, s.boy.y)
    s.boy.setVelocity(0, 0)
    s.cameras.main.centerOn(x, s.boy.y)
    s.physics?.resume?.()
  }, x)
}

async function shot(path) {
  await page.screenshot({ path })
}

async function composeCompare(segs) {
  // Prefer PIL via python for side-by-side (no node-canvas required).
  const list = segs.map(([id]) => id).join(',')
  const py = `
from PIL import Image, ImageDraw, ImageFont
import os
OUT=${JSON.stringify(OUT)}
segs=${JSON.stringify(segs.map((s) => s[0]))}
cell_w, cell_h = 320, 180
canvas = Image.new('RGB', (cell_w * 2 + 20, cell_h * 5 + 40), (16, 20, 24))
draw = ImageDraw.Draw(canvas)
draw.text((80, 8), 'ST6 mall', fill=(232, 224, 200))
draw.text((400, 8), 'ST7 night warehouse', fill=(232, 224, 200))
for i, id in enumerate(segs):
    a = Image.open(f'{OUT}/st6-seg{id}.png').resize((cell_w, cell_h))
    b = Image.open(f'{OUT}/st7-seg{id}.png').resize((cell_w, cell_h))
    canvas.paste(a, (0, 24 + i * cell_h))
    canvas.paste(b, (cell_w + 20, 24 + i * cell_h))
    draw.text((8, 28 + i * cell_h), id, fill=(255, 224, 128))
canvas.save(f'{OUT}/compare.png')
print('ok')
`
  const { spawnSync } = await import('node:child_process')
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'pil compose failed')
}

try {
  const segs = [
    ['A', 400],
    ['B', 1400],
    ['C', 2500],
    ['D', 3600],
    ['E', 4900],
  ]

  // D1: capture ST6 and ST7 per segment
  for (const stageNo of [6, 7]) {
    await boot(stageNo)
    if (stageNo === 6) {
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        s.mallStorySeen = new Set([0, 1, 2, 3, 4])
        s.s6world?.markElevatorDone?.()
      })
    }
    for (const [id, x] of segs) {
      await place(x)
      await page.waitForTimeout(350)
      await shot(`${OUT}/st${stageNo}-seg${id}.png`)
    }
  }

  // Texture audit on ST7 — no c2-prop / s6-floor / mall marble keys in use
  await boot(7)
  const audit = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const used = []
    const scan = (list) => {
      for (const o of list) {
        const key = o.texture?.key
        if (!key) continue
        if (
          key.startsWith('s6-') ||
          key.startsWith('c2-prop') ||
          key.startsWith('s6-floor') ||
          key.includes('mall-far') ||
          key === 's6-dome'
        ) {
          used.push(key)
        }
      }
    }
    scan(s.children.list)
    const keys = s.textures.getTextureKeys()
    return {
      bannedUsedOnStage: [...new Set(used)],
      s7floors: keys.filter((k) => k.startsWith('s7-floor')),
      theme: s.exhibit,
      floorSample: s.boy ? s.warehouseFloorKey?.(s.boy.x) : null,
    }
  })
  report.textureAudit = audit
  report.checks.D1_no_st6_textures_used = (audit.bannedUsedOnStage || []).length === 0
  report.checks.D1_s7_floors = (audit.s7floors || []).length >= 3
  report.checks.D1_exhibit_flag = !!audit.theme

  try {
    await composeCompare(segs)
    report.checks.D1_compare = fs.existsSync(`${OUT}/compare.png`)
  } catch (e) {
    report.checks.D1_compare = false
    report.notes.push('compare compose: ' + e.message)
  }

  // D2 conveyor: stand 2s → ~140px
  await boot(7)
  await place(300)
  const x0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  await page.waitForTimeout(2000)
  const x1 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  const dx = x1 - x0
  report.checks.D2_conveyor_dx = +dx.toFixed(1)
  report.checks.D2_conveyor_approx_140 = Math.abs(dx - 140) < 50

  await place(2550)
  await page.keyboard.down('KeyD')
  const rx0 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  await page.waitForTimeout(1000)
  await page.keyboard.up('KeyD')
  const rx1 = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  report.checks.D2_reverse_progress = rx1 > rx0
  report.checks.D2_reverse_slow = rx1 - rx0 < 90
  report.notes.push(`D2 reverse Δx=${(rx1 - rx0).toFixed(1)}`)

  // D3 spotlight
  await boot(7)
  const beforeEn = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    for (const o of [...s.enemies.getChildren()]) {
      if (o.x > 900 && o.x < 1800) o.destroy()
    }
    return s.enemies.getChildren().filter((e) => e.active).length
  })
  await place(1100)
  await page.waitForTimeout(6000)
  const afterAlarm = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return {
      n: s.enemies.getChildren().filter((e) => e.active).length,
      events: (s.s7world?.events || []).map((e) => e.kind),
      stage7: s.stage7Events?.map((e) => e.kind) || [],
      story: !!s.storyIntro,
    }
  })
  report.checks.D3_alarm_spawned =
    afterAlarm.n >= beforeEn + 2 ||
    afterAlarm.events.includes('spotlight-alarm') ||
    afterAlarm.stage7.includes('spotlight-alarm')
  report.notes.push('D3 alarm detail: ' + JSON.stringify(afterAlarm))

  await boot(7)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    for (const o of [...s.enemies.getChildren()]) {
      if (o.x > 900 && o.x < 1800) o.destroy()
    }
  })
  await place(820)
  const avoidBefore = await page.evaluate(
    () => window.__SAKE_GAME__.scene.getScene('play').enemies.getChildren().filter((e) => e.active).length,
  )
  await page.waitForTimeout(5500)
  const avoidAfter = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return {
      n: s.enemies.getChildren().filter((e) => e.active).length,
      events: (s.s7world?.events || []).map((e) => e.kind),
    }
  })
  report.checks.D3_avoid_no_spawn =
    !avoidAfter.events.includes('spotlight-alarm') && avoidAfter.n <= avoidBefore + 1

  // D4 rescue cages
  await boot(7)
  await place(1400)
  const rescue = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const before = s.s7world?.rescueCount ?? 0
    for (let i = 0; i < 3; i++) s.s7world?.hitCageAt(1400)
    return {
      before,
      after: s.s7world?.rescueCount ?? 0,
      hud: s.s7world?.hud?.text ?? null,
      hasWorld: !!s.s7world,
    }
  })
  report.checks.D4_rescue_plus1 = rescue.after === rescue.before + 1
  report.notes.push('D4 rescue: ' + JSON.stringify(rescue))
  await shot(`${OUT}/rescue-cage.png`)

  // D5 enemy screenshots
  await boot(7)
  await place(600)
  await page.waitForTimeout(400)
  await shot(`${OUT}/st7-enemies.png`)
  await boot(6)
  await place(700)
  await page.waitForTimeout(400)
  await shot(`${OUT}/st6-enemies.png`)
  // Compose enemy compare
  try {
    const { spawnSync } = await import('node:child_process')
    spawnSync(
      'python3',
      [
        '-c',
        `
from PIL import Image, ImageDraw
OUT=${JSON.stringify(OUT)}
a=Image.open(f'{OUT}/st6-enemies.png').resize((480,270))
b=Image.open(f'{OUT}/st7-enemies.png').resize((480,270))
c=Image.new('RGB',(980,300),(16,20,24))
d=ImageDraw.Draw(c)
d.text((120,8),'ST6 enemies',fill=(232,224,200))
d.text((620,8),'ST7 enemies',fill=(232,224,200))
c.paste(a,(10,28)); c.paste(b,(500,28))
c.save(f'{OUT}/enemies-compare.png')
`,
      ],
      { encoding: 'utf8' },
    )
    report.checks.D5_enemy_shots = fs.existsSync(`${OUT}/enemies-compare.png`)
  } catch {
    report.checks.D5_enemy_shots = fs.existsSync(`${OUT}/st7-enemies.png`) && fs.existsSync(`${OUT}/st6-enemies.png`)
  }

  // D6 BGM static
  const audioSrc = fs.readFileSync('src/game/audio.ts', 'utf8')
  report.checks.D6_exhibit_song_defined = /exhibit:\s*\{/.test(audioSrc) && /bpm:\s*94/.test(audioSrc)
  report.checks.D6_mall_unchanged = /mall:\s*\{[\s\S]*?bpm:\s*104/.test(audioSrc)
  report.checks.D6_ambient = /animalCall|cageClank|tickExhibitAmbient/.test(audioSrc)
  report.notes.push('D6: ST7 SongId exhibit bpm94 (−2 semitones / Cm); ST6 mall @104; ambient animalCall/cageClank')

  report.checks.D4_clear_row =
    fs.readFileSync('src/game/GameScene.ts', 'utf8').includes('救出動物') &&
    fs.readFileSync('src/game/GameScene.ts', 'utf8').includes('rescueCount')

  const required = [
    'D1_exhibit_flag',
    'D1_no_st6_textures_used',
    'D1_s7_floors',
    'D1_compare',
    'D2_conveyor_approx_140',
    'D2_reverse_progress',
    'D3_alarm_spawned',
    'D3_avoid_no_spawn',
    'D4_rescue_plus1',
    'D4_clear_row',
    'D5_enemy_shots',
    'D6_exhibit_song_defined',
    'D6_mall_unchanged',
  ]
  report.passed = required.every((k) => report.checks[k])
  report.required = Object.fromEntries(required.map((k) => [k, !!report.checks[k]]))
} catch (e) {
  report.passed = false
  report.error = e.stack || String(e)
  await shot(`${OUT}/failure.png`).catch(() => {})
} finally {
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        required: report.required,
        checks: report.checks,
        error: report.error,
        errors: report.errors,
        notes: report.notes,
        textureAudit: report.textureAudit,
      },
      null,
      2,
    ),
  )
  await browser.close()
}
if (!report.passed) process.exitCode = 1
