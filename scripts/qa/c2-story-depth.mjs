/**
 * C2 story-depth smoke: fragments on ST6/ST7, boss card has no 待補, screenshots.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47671'
const OUT = 'docs/qa-c2-story-depth'
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

async function boot(stageNo) {
  await page.evaluate((n) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', n)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  const t0 = Date.now()
  while (Date.now() - t0 < 25000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    const ok = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })
    if (ok) return
    await page.waitForTimeout(120)
  }
  throw new Error(`stage ${stageNo} start timeout`)
}

async function shot(name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  report.shots.push(p)
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

  // Boss card text check (data)
  const cards = await page.evaluate(async () => {
    const r = await fetch('/data/bosses.json')
    const j = await r.json()
    return {
      scrubber: j.bosses['mall-scrubber'],
      trainer: j.bosses.trainer,
    }
  })
  report.checks.cards = {
    scrubberHasDaibu: JSON.stringify(cards.scrubber).includes('待補'),
    trainerHasDaibu: JSON.stringify(cards.trainer).includes('待補'),
  }
  if (report.checks.cards.scrubberHasDaibu) throw new Error('mall-scrubber card still has 待補')

  for (const stage of [6, 7]) {
    await boot(stage)
    await page.waitForTimeout(400)
    const info = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      if (s.s6world) s.s6world.elevDone = true
      const truths = s.truthPickups?.getChildren?.()?.filter((o) => o.active) ?? []
      return {
        truthCount: truths.length,
        xs: truths.map((t) => Math.round(t.x)),
        ken: s.children.list.some((o) => o.getData?.('kenProp')),
      }
    })
    report.checks[`stage${stage}`] = info
    if (info.truthCount !== 3) throw new Error(`stage ${stage} truths ${info.truthCount}`)

    // Visit each fragment x and pick up
    for (let i = 0; i < info.xs.length; i++) {
      const x = info.xs[i]
      await page.evaluate((px) => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        s.boy.x = px
        s.cameras.main.centerOn(px, 200)
      }, x)
      await page.waitForTimeout(500)
      // dismiss dialogue if any
      for (let k = 0; k < 6; k++) {
        await page.keyboard.press('Space')
        await page.waitForTimeout(80)
      }
      await shot(`st${stage}-frag-${i + 1}`)
    }
    const got = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').truthGot)
    report.checks[`stage${stage}Got`] = got
  }

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
