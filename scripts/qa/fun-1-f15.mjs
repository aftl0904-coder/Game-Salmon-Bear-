/**
 * Fun-1 F15: stage 7 stall is memoryGame; stage 6 stays goldfish.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47693'
const BASE = `http://127.0.0.1:${PORT}/?c2=1`
const OUT = 'docs/qa-fun-1'
fs.mkdirSync(OUT, { recursive: true })

const report = { ok: false, errors: [], checks: {}, shots: [] }

function assert(label, cond, detail) {
  report.checks[label] = { pass: !!cond, detail }
  if (!cond) throw new Error(`${label}: ${detail ?? 'fail'}`)
}

const stalls = JSON.parse(fs.readFileSync('data/stalls.json', 'utf8')).stalls
assert('s7.game', stalls['7'].game === 'memory', stalls['7'].game)
assert('s7.keeper', stalls['7'].keeper === '展銷中心倉務姐姐')
assert('s7.sign', stalls['7'].sign === '倉務枱・記憶考驗')
assert('s7.greet', stalls['7'].greet === '記得邊個籠住咗邊隻動物？考考你。')
assert('s6.game', stalls['6'].game === 'goldfish', stalls['6'].game)

const gs = fs.readFileSync('src/game/GameScene.ts', 'utf8')
assert('memoryBranch', /st\.game === 'memory'/.test(gs) && gs.includes('memoryGame(this)'))
assert('tutorialLine', gs.includes('記住亮燈次序，再跟住撳返出嚟'))

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

async function boot(mode) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
  await page.evaluate((m) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 7)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', m)
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, mode)
  const t0 = Date.now()
  while (Date.now() - t0 < 30000) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    if (await page.evaluate(() => !!window.__SAKE_GAME__?.scene?.getScene('play')?.started)) break
    await page.waitForTimeout(100)
  }
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = false
    s.memoryDone = true
    s.lastCheckpointX = 0
    if (s.mallStorySeen) s.mallStorySeen = new Set([0, 1, 2, 3, 4])
  })
  await page.waitForTimeout(400)
}

async function triggerStall() {
  // First CP for stage 7 (non-mall) is the stall.
  const stallX = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return s.checkpointXs?.[0] ?? 800
  })
  await page.evaluate((x) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = false
    s.lastCheckpointX = x - 10
    for (const h of [s.boy, s.girl]) {
      if (!h) continue
      h.setPosition(x + 5, h.y)
      h.body?.updateFromGameObject?.()
    }
    s.cameras.main.centerOn(x, s.boy.y - 40)
  }, stallX)
  // Drive tickCheckpoints by moving lead past CP
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      // force stall if not yet
      if (!s.coffeeDone && typeof s.runCoffeeStall === 'function') {
        const x = s.checkpointXs?.[0]
        if (x != null && s.lastCheckpointX < x) {
          s.lastCheckpointX = x
          s.coffeeDone = true
          s.physics.pause()
          void s.runCoffeeStall()
        }
      }
    })
    const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play')?.storyIntro)
    if (intro) break
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(600)
}

try {
  // 1P: tutorial → memory board (F advances; Enter would skip)
  await boot('1p')
  await triggerStall()
  await page.waitForTimeout(400)
  await shot('f15-s7-stall-1p-tutorial')
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('f')
    await page.waitForTimeout(350)
  }
  await page.waitForTimeout(900)
  await shot('f15-s7-stall-1p-memory')

  // 2P
  await boot('2p')
  await triggerStall()
  await page.waitForTimeout(400)
  await shot('f15-s7-stall-2p-tutorial')
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('f')
    await page.waitForTimeout(350)
  }
  await page.waitForTimeout(900)
  await shot('f15-s7-stall-2p-memory')

  // Confirm stage 6 still goldfish (static already); quick boot assert
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.scene.start('play')
  })
  await page.waitForTimeout(1500)
  const s6game = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return s?.stall?.()?.game
  })
  assert('s6.runtime.goldfish', s6game === 'goldfish', s6game)

  report.ok = report.errors.length === 0
} catch (e) {
  report.ok = false
  report.errors.push(String(e?.stack || e))
} finally {
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'f15-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}
