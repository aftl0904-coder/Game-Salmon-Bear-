import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = 'http://127.0.0.1:4521/'
const OUT = '/opt/cursor/artifacts/screenshots'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } })
page.on('pageerror', e => console.error('PAGEERROR', e.message))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 20000 })

async function key() {
  return page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const live = g?.scene?.getScenes?.(true)
    return live?.[0]?.sys?.settings?.key ?? null
  })
}
async function waitKey(k, t=25000) {
  const s = Date.now()
  while (Date.now()-s < t) {
    if (await key() === k) return
    await page.waitForTimeout(100)
  }
  throw new Error('want '+k+' got '+await key())
}

await waitKey('logo'); console.log('logo')
await page.keyboard.press('Enter')
await waitKey('menu'); console.log('menu')
await page.keyboard.press('Enter')
await waitKey('play'); console.log('play')
await page.waitForTimeout(500)

// Dismiss intro properly (destroy overlay + start + snap cast to mid lane)
await page.evaluate(() => {
  const play = window.__SAKE_GAME__.scene.getScene('play')
  play.children.list.filter(o => o.depth >= 60 && o.type === 'Text').forEach(o => o.destroy())
  play.started = true
  play.startedAt = play.time.now
  const mid = play.registry ? null : null
  // snap cast
  play.boy?.snapToLane?.(1, 280)
  play.girl?.snapToLane?.(1, 360)
  play.boy?.setAngle?.(0); play.girl?.setAngle?.(0)
  play.boy?.setScale?.(play.boy.baseScale ?? 2)
  play.girl?.setScale?.(play.girl.baseScale ?? 2)
  if (play.pet) {
    play.pet.setPosition(430, play.girl.y)
    play.pet.setDepth(play.girl.depth - 2)
  }
})

async function shot(name) {
  const file = path.join(OUT, name)
  await page.locator('#game-root canvas').first().screenshot({ path: file })
  console.log('wrote', name, fs.statSync(file).size)
}

await page.keyboard.down('KeyD')
await page.keyboard.down('ArrowRight')
await page.waitForTimeout(800)
await shot('fix-render-run.png')

await page.keyboard.press('KeyK')
await page.waitForTimeout(130)
await shot('fix-render-jump.png')
await page.waitForTimeout(450)

// lane spread: boy up, girl down
await page.keyboard.press('KeyW')
await page.waitForTimeout(180)
await page.keyboard.press('ArrowDown')
await page.waitForTimeout(250)
await shot('fix-render-lanes.png')

for (let i=0;i<8;i++){ await page.keyboard.press('KeyJ'); await page.waitForTimeout(70) }
await shot('fix-render-hit.png')

const meta = await page.evaluate(() => {
  const play = window.__SAKE_GAME__.scene.getScene('play')
  const info = s => s ? ({x:Math.round(s.x),y:Math.round(s.y),d:s.depth,vrm:s.vertexRoundMode,ang:s.angle,sx:s.scaleX,lane:s.lane}) : null
  return {
    started: play?.started,
    boy: info(play?.boy),
    girl: info(play?.girl),
    pet: info(play?.pet),
    petDx: play?.pet && play?.girl ? Math.round(play.pet.x - play.girl.x) : null,
    scrollX: play?.cameras?.main?.scrollX,
    waterTX: play?.water?.tilePositionX,
    mountTX: play?.mountNear?.tilePositionX,
    intScroll: Number.isInteger(play?.cameras?.main?.scrollX),
    intWater: Number.isInteger(play?.water?.tilePositionX),
  }
})
console.log(JSON.stringify(meta, null, 2))
await page.keyboard.up('KeyD')
await page.keyboard.up('ArrowRight')
await browser.close()
