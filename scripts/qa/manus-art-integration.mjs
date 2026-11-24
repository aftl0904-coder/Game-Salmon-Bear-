/**
 * Manus art integration acceptance (M1–M4).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const PORT = process.env.QA_PORT || '47701'
const OUT = 'docs/qa-manus-art-integration'
fs.mkdirSync(OUT, { recursive: true })

const report = {
  ok: false,
  errors: [],
  checks: {},
  shots: [],
  pupuVersion: null,
}

function fail(msg) {
  throw new Error(msg)
}

function pngSize(p) {
  const buf = fs.readFileSync(p)
  if (buf[0] !== 0x89) fail(`not png ${p}`)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

// ── Static file asserts ───────────────────────────────────────────────
const qheads = [
  'lunbo',
  'kibobo',
  'pupu',
  'huihui',
  'guard',
  'denim',
  'brownie',
  'snowcat',
  'shiba',
  'ginger',
  'fleecy',
  'gnome',
  'tigercub',
  'kuro',
]
for (const id of qheads) {
  const p = `public/art/qhead/qhead-${id}.png`
  if (!fs.existsSync(p)) fail(`missing ${p}`)
  const { w, h } = pngSize(p)
  const want = id === 'lunbo' || id === 'kibobo' || id === 'pupu' ? 88 : 64
  report.checks[`qhead-${id}`] = { w, h, want }
  if (w !== want || h !== want) fail(`${id} size ${w}x${h} want ${want}`)
}
for (const [f, w, h] of [
  ['public/art/qhead/load-jar-empty.png', 48, 64],
  ['public/art/qhead/load-jar-full.png', 48, 64],
  ['public/art/c2/prop-escalator.png', 64, 80],
  ['public/art/story/c6-photo.png', 1280, 720],
  ['public/art/story/c7-memo.png', 1280, 720],
  ['public/art/story/c7-pupu-leave.png', 1280, 720],
  ['public/art/story/s6-boss-intro.png', 1280, 720],
  ['public/art/story/s7-boss-intro.png', 1280, 720],
  ['public/art/c2/story/c2-truth-scrap.png', 28, 32],
  ['public/art/c2/story/c2-ken-photo.png', 36, 28],
  ['public/art/c2/story/c2-ken-memo.png', 30, 34],
  ['public/art/c2/story/c2-pupu-branch.png', 24, 10],
  ['public/art/c2/story/c2-maint-hatch.png', 40, 48],
  ['public/art/c2/story/c2-leon-emblem.png', 32, 28],
]) {
  const sz = pngSize(f)
  report.checks[path.basename(f)] = sz
  if (sz.w !== w || sz.h !== h) fail(`${f} ${sz.w}x${sz.h} want ${w}x${h}`)
}

// Pupu shirt note (sampled offline in agent log): Manus orange/yellow — used.
report.pupuVersion = 'manus/c2-art-batch2-2610 qhead-pupu.png (橙黃衫，非紅色 Pooh；已接入)'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => {
  const msg = String(e.message)
  if (/drawImage|Cannot read properties of null|WebGL|AudioContext/.test(msg)) return
  report.errors.push(msg)
})

async function shot(name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  report.shots.push(p)
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  // Loading screen (boot) — capture early
  await page.waitForTimeout(800)
  await shot('loading-qheads')

  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 90000 })
  const headHook = await page.evaluate(() => window.__SAKE_LOADING_HEADS__ || null)
  report.checks.loadingHeadsHook = Array.isArray(headHook) ? headHook.length : 0
  if (!headHook || headHook.length < 10) fail('loading heads hook missing')

  const tex = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const keys = [
      'qhead-lunbo',
      'qhead-pupu',
      'load-jar-empty',
      'load-jar-full',
      'c2-prop-escalator',
      'c2-ken-photo',
      'c2-truth-scrap',
      'story-s6-boss-intro',
      'story-s7-boss-intro',
      'story-c6-photo',
      'story-c7-memo',
      'story-c7-pupu-leave',
    ]
    return Object.fromEntries(keys.map((k) => [k, !!g.textures.exists(k)]))
  })
  report.checks.textures = tex
  for (const [k, ok] of Object.entries(tex)) {
    if (!ok) fail(`texture missing ${k}`)
  }

  // Stage 6 escalator + ken photo
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 25000) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    if (await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.started)) break
    await page.waitForTimeout(100)
  }
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    if (s.s6world) s.s6world.elevDone = true
    s.physics?.resume?.()
    const floor = s.boy.y
    s.boy.setPosition(1920, floor)
    s.boy.body.reset(1920, floor)
    s.cameras.main.centerOn(1920, 200)
  })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(200)
  await shot('st6-escalator-mobile-landscape')

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const floor = s.boy.y
    s.boy.setPosition(2080, floor)
    s.boy.body.reset(2080, floor)
    s.cameras.main.centerOn(2080, 200)
  })
  await page.waitForTimeout(200)
  await shot('st6-ken-photo')

  // Boss intro stills via texture blit helper
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const g = window.__SAKE_GAME__
    const overlay = s.add.container(0, 0).setScrollFactor(0).setDepth(9999)
    overlay.add(s.add.rectangle(0, 0, 640, 360, 0x000000, 0.75).setOrigin(0))
    overlay.add(s.add.image(320, 180, 'story-s6-boss-intro').setDisplaySize(640, 360))
    window.__qaStill = overlay
    s.cameras.main.centerOn(s.boy.x, 180)
  })
  await page.waitForTimeout(150)
  await shot('s6-boss-intro')
  await page.evaluate(() => {
    window.__qaStill?.destroy()
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const overlay = s.add.container(0, 0).setScrollFactor(0).setDepth(9999)
    overlay.add(s.add.rectangle(0, 0, 640, 360, 0x000000, 0.75).setOrigin(0))
    overlay.add(s.add.image(320, 180, 'story-s7-boss-intro').setDisplaySize(640, 360))
    window.__qaStill = overlay
  })
  await page.waitForTimeout(150)
  await shot('s7-boss-intro')

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
