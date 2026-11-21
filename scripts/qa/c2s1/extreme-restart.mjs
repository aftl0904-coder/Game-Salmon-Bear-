/** Extreme mash + restart flow for ST-06. */
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.URL || 'http://127.0.0.1:4533/'
const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-acceptance'
fs.mkdirSync(OUT, { recursive: true })

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 }))
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message)))

const boot = async () => {
  await page.goto(URL)
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  await page.waitForTimeout(2000)
  for (let i = 0; i < 12; i++) {
    if (!(await page.evaluate(() => !!window.__SAKE_GAME__?.scene.getScene('play')?.storyIntro))) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
}

await boot()
const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX', 'KeyC', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'Enter', 'Escape']
const t0 = Date.now()
let held = null
while (Date.now() - t0 < 60000) {
  const k = keys[Math.floor(Math.random() * keys.length)]
  if (Math.random() < 0.2) {
    held = k
    await page.keyboard.down(k).catch(() => {})
  } else if (held && Math.random() < 0.35) {
    await page.keyboard.up(held).catch(() => {})
    held = null
  } else {
    await page.keyboard.press(k).catch(() => {})
  }
  await page.waitForTimeout(40)
}
if (held) await page.keyboard.up(held).catch(() => {})
await page.screenshot({ path: `${OUT}/T17-extreme.png` })
const alive1 = await page.evaluate(() => {
  const s = window.__SAKE_GAME__?.scene.getScene('play')
  return { ok: !!s, ended: !!s?.ended, x: s?.boy?.x }
})

// Restart twice
const restarts = []
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.registry.set('stageNo', 6)
    g.registry.set('winScreenShown', false)
    g.scene.start('play')
  })
  await page.waitForTimeout(2500)
  for (let j = 0; j < 10; j++) {
    if (!(await page.evaluate(() => !!window.__SAKE_GAME__?.scene.getScene('play')?.storyIntro))) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
  }
  const st = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return { stage: s?.stageNo, mall: !!s?.mall, started: !!s?.started, x: s?.boy?.x }
  })
  restarts.push(st)
  await page.screenshot({ path: `${OUT}/T18-restart-${i + 1}.png` })
}

const summary = {
  extremeAlive: alive1,
  restarts,
  errs,
  passExtreme: errs.length === 0 && alive1.ok,
  passRestart: restarts.every((r) => r.stage === 6 && r.mall),
}
fs.writeFileSync(`${OUT}/extreme-restart.json`, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
await b.close()
process.exit(summary.passExtreme && summary.passRestart ? 0 : 1)
