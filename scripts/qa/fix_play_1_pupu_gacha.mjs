/**
 * fix-play-1: pupu jump frames → GIF; gacha gold charm pick screenshot.
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4761/'
const OUT = 'artifacts/fix-play-1'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
  ...devices['iPhone 13 landscape'],
  recordVideo: undefined,
})
await context.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 3 }))
})
const page = await context.newPage()
page.on('pageerror', (e) => console.warn('pageerror', e.message))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })

// ── Gacha gold pick ─────────────────────────────────────────────────────
await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  g.registry.set('playMode', '1p')
  g.registry.set('soloCast', 'boy')
  g.registry.set('difficulty', 'normal')
  for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
  g.scene.start('gacha')
})
await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('gacha'), null, { timeout: 15000 })
await page.waitForTimeout(600)

// Force gold path: set good=3 then finishSkill
await page.evaluate(async () => {
  const s = window.__SAKE_GAME__.scene.getScene('gacha')
  s.good = 3
  s.total = 3
  s.skipped = false
  // Jump past intro/spin into grade→charm
  await s.finishSkill(false)
})
await page.waitForTimeout(2200)
// Wait for pick UI
await page.waitForFunction(
  () => {
    const s = window.__SAKE_GAME__.scene.getScene('gacha')
    return s?.phase === 'charm' && !!s.charmPick
  },
  null,
  { timeout: 15000 },
)
const gachaShot = path.join(OUT, 'gacha-gold-pick.png')
await page.screenshot({ path: gachaShot, scale: 'css' })
fs.copyFileSync(gachaShot, path.join(ART, 'fix-play-1-gacha-gold-pick.png'))
console.log('gacha', gachaShot)

// ── Pupu jump frames ────────────────────────────────────────────────────
await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  g.registry.set('stageNo', 1)
  g.registry.set('playMode', '1p')
  g.registry.set('soloCast', 'boy')
  for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
  g.scene.start('play')
})
await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('play'), null, { timeout: 20000 })
await page.waitForTimeout(2500)
// skip intro
const box = await page.locator('canvas').boundingBox()
const tap = async (x, y) => {
  await page.touchscreen.tap(box.x + (box.width * x) / 640, box.y + (box.height * y) / 360)
}
await tap(615, 14)
await page.waitForTimeout(800)

await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  // Place hero mid-stage with pet; start a jump
  s.boy.setPosition(400, s.boy.y)
  if (s.pet) s.pet.setPosition(360, s.pet.y)
  s.boy.laneJumping = true
  s.boy.setVelocityY(-280)
})

const framesDir = path.join(OUT, 'pupu-frames')
fs.mkdirSync(framesDir, { recursive: true })
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(50)
  // Keep feeding upward for a few frames then fall
  if (i < 4) {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      if (s?.boy) s.boy.setVelocityY(-220)
    })
  }
  const fp = path.join(framesDir, `f${String(i).padStart(2, '0')}.png`)
  // Crop around hero+pet via full canvas (GIF will show jump together)
  await page.screenshot({ path: fp, scale: 'css' })
}

// Build GIF with ffmpeg if available, else sharp/imagemagick
const gifOut = path.join(OUT, 'pupu-jump.gif')
try {
  execSync(
    `ffmpeg -y -framerate 10 -i ${framesDir}/f%02d.png -vf "scale=480:-1:flags=lanczos" -loop 0 ${gifOut}`,
    { stdio: 'pipe' },
  )
  fs.copyFileSync(gifOut, path.join(ART, 'fix-play-1-pupu-jump.gif'))
  console.log('gif', gifOut)
} catch (e) {
  console.warn('ffmpeg failed, copying last frame as fallback', e.message)
  fs.copyFileSync(path.join(framesDir, 'f05.png'), path.join(ART, 'fix-play-1-pupu-jump.png'))
}

// Verify pet Y tracked boy Y during jump in one sample
const track = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  return { boyY: s.boy?.y, petY: s.pet?.y, jumping: s.boy?.laneJumping }
})
console.log('track', track)
fs.writeFileSync(path.join(OUT, 'pupu-gacha.json'), JSON.stringify({ track, gacha: gachaShot }, null, 2))

await browser.close()
console.log('OK')
