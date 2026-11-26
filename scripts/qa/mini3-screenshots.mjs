/** mini-3: desktop + landscape-mobile screenshots for 8 transit games. */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/mini-3'
const BASE = process.env.QA_BASE || 'http://127.0.0.1:47693/'
fs.mkdirSync(OUT, { recursive: true })

const LEGS = [
  { id: 'bike-climb', from: 1, to: 2, title: '單車上斜' },
  { id: 'umbrella', from: 2, to: 3, title: '撐傘送熊下山' },
  { id: 'kite', from: 3, to: 4, title: '放風箏過海' },
  { id: 'ferry', from: 4, to: 5, title: '渡海小輪' },
  { id: 'memory-pics', from: 5, to: 6, title: '砌回憶' },
  { id: 'stealth', from: 7, to: 8, title: '避燈潛入' },
  { id: 'coffee-tray', from: 8, to: 9, title: '端咖啡落樓' },
  { id: 'photo', from: 9, to: 10, title: '合照' },
]
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 844, height: 390, isMobile: true, hasTouch: true },
]

const SEEN = Object.fromEntries(LEGS.map((l) => [`transit-${l.id}`, 1]))

function collectTexts(scene) {
  const texts = []
  const walk = (list) => {
    for (const c of list || []) {
      if (c?.text) texts.push(String(c.text))
      if (c?.list) walk(c.list)
      if (c?.getAll) walk(c.getAll())
    }
  }
  walk(scene?.children?.list)
  return texts
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})

async function shot(page, file) {
  const canvas = page.locator('#game-root canvas').first()
  try {
    if (await canvas.isVisible({ timeout: 1500 })) {
      await canvas.screenshot({ path: file, timeout: 8000 })
      return
    }
  } catch {
    /* */
  }
  await page.locator('#game-root').screenshot({ path: file, timeout: 8000 }).catch(() => page.screenshot({ path: file }))
}

const log = []
try {
  for (const vp of VIEWPORTS) {
    for (const leg of LEGS) {
      const file = path.join(OUT, `${leg.id}-${vp.name}.png`)
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.hasTouch,
        deviceScaleFactor: vp.isMobile ? 2 : 1,
      })
      try {
        await page.addInitScript((seen) => {
          localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
          localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
          // Seen → short tutorial. Enter/Escape = skip; Space/KeyJ/tap = start.
          localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify(seen))
        }, SEEN)
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 60000 })
        await page.waitForTimeout(2200)
        await page.evaluate(() => document.body.classList.remove('portrait'))

        await page.evaluate(
          ({ from, to }) => {
            const g = window.__SAKE_GAME__
            g.registry.set('playMode', '1p')
            g.registry.set('difficulty', 'normal')
            g.registry.set('soloCast', 'boy')
            g.registry.set('stageNo', to)
            for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
            g.scene.start('transit', { from, to })
          },
          { from: leg.from, to: leg.to },
        )
        await page.waitForTimeout(1000)
        // Focus canvas, then KeyJ (tutorial "next"/start — never Enter)
        await page.locator('#game-root canvas').click({ position: { x: Math.floor(vp.width / 2), y: Math.floor(vp.height / 2) } })
        await page.waitForTimeout(150)
        await page.keyboard.press('KeyJ')
        await page.waitForTimeout(1500)

        const info = await page.evaluate(
          ({ title, collectSrc }) => {
            const g = window.__SAKE_GAME__
            const t = g.scene.getScene('transit')
            // eslint-disable-next-line no-new-func
            const collect = new Function(`return (${collectSrc})`)()
            const texts = collect(t)
            const joined = texts.join('|')
            const active = g.scene.getScenes(true).map((s) => s.scene.key)
            return {
              active,
              transitId: t?.transitId,
              hasTitle: joined.includes(title),
              hasTutorialNav: joined.includes('開始') && joined.includes('跳過'),
              sample: texts.filter(Boolean).slice(0, 8),
            }
          },
          { title: leg.title, collectSrc: collectTexts.toString() },
        )

        if (!info.active.includes('transit') || !info.hasTitle || info.hasTutorialNav) {
          // one more tap/key attempt
          await page.locator('#game-root canvas').click({ position: { x: Math.floor(vp.width / 2), y: Math.floor(vp.height / 2) + 40 } })
          await page.keyboard.press('KeyJ')
          await page.waitForTimeout(1200)
        }

        const info2 = await page.evaluate(
          ({ title, collectSrc }) => {
            const g = window.__SAKE_GAME__
            const t = g.scene.getScene('transit')
            const collect = new Function(`return (${collectSrc})`)()
            const texts = collect(t)
            const joined = texts.join('|')
            return {
              active: g.scene.getScenes(true).map((s) => s.scene.key),
              transitId: t?.transitId,
              hasTitle: joined.includes(title),
              hasTutorialNav: joined.includes('開始') && joined.includes('跳過'),
              sample: texts.filter(Boolean).slice(0, 8),
            }
          },
          { title: leg.title, collectSrc: collectTexts.toString() },
        )

        await shot(page, file)
        const size = fs.statSync(file).size
        const ok =
          size > 8000 &&
          info2.active.includes('transit') &&
          info2.transitId === leg.id &&
          info2.hasTitle &&
          !info2.hasTutorialNav
        console.log(ok ? 'OK' : 'BAD', path.basename(file), size, info2.transitId, info2.sample?.[0])
        log.push({ id: leg.id, vp: vp.name, size, ok, ...info2 })
      } catch (e) {
        console.error('FAIL', leg.id, vp.name, e.message)
        log.push({ id: leg.id, vp: vp.name, ok: false, error: String(e.message) })
        await page.screenshot({ path: file.replace('.png', '-fallback.png') }).catch(() => {})
      } finally {
        await page.close()
      }
    }
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ log, out: OUT }, null, 2))
  await browser.close()
}
const failed = log.filter((x) => !x.ok)
console.log(JSON.stringify({ total: log.length, failed: failed.length }, null, 2))
if (failed.length) process.exitCode = 1
