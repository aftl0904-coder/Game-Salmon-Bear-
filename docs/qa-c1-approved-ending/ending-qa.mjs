import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

// QA ONLY: directly inject C11/C11_PERFECT into a fresh Phaser scene after Boot;
// this is not a playthrough, ending selection test, or a physical device test.
const root = 'docs/qa-c1-approved-ending'
const base = process.env.QA_URL ?? 'http://127.0.0.1:47938/'
const cases = {
  C11: [
    ['', '聖誕伯伯、虎仔同喵仔都搵到喇——十一個朋友，終於齊晒。'],
    ['琪寶寶', '剩返大佬保險箱嗰罐，係最後一罐真蜂蜜。'],
    ['琪寶寶', '飲埋呢罐，噗噗。'],
    ['噗噗', '噗噗噗噗噗！！'],
    ['', '森林由灰返晒顏色，啲動物朋友一個個行返出嚟。'],
    ['倫寶', '不如而家就喺呢度，大家一齊野餐？'],
    ['琪寶寶', '好呀，大家齊齊喺度，呢餐一定特別好食！'],
  ],
  C11_PERFECT: [
    ['', '十一個朋友都返晒嚟，大家終於可以聚返埋一齊。'],
    ['琪寶寶', '噗噗，最後一罐真蜜喺度。'],
    ['琪寶寶', '飲咗佢啦，我哋陪住你。'],
    ['噗噗', '噗噗！'],
    ['', '森林慢慢回復顏色，大家又可以聚埋一齊。'],
    ['倫寶', '終於可以同大家一齊野餐喇。'],
    ['琪寶寶', '有你哋喺度，呢一日就最完美。'],
  ],
}
const cards = { C11: '全部真蜂蜜搵齊・森林獲救', C11_PERFECT: '送給 最重要嘅妳' }
const devices = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
}
const results = []
await mkdir(root, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
try {
  for (const [device, options] of Object.entries(devices)) {
    for (const [id, lines] of Object.entries(cases)) {
      const result = { device, id, injection: true, input: device === 'desktop' ? 'keyboard F only' : 'touchscreen taps only', lines: [], errors: [], pass: false }
      results.push(result)
      const ctx = await browser.newContext(options)
      const page = await ctx.newPage()
      page.on('pageerror', e => result.errors.push(e.stack || String(e)))
      page.on('console', msg => { if (msg.type() === 'error') result.errors.push(`console: ${msg.text()}`) })
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 })
        await page.evaluate(async id => {
          const g = window.__SAKE_GAME__
          // Label appears in every screenshot; no release code is altered.
          const label = document.createElement('div')
          label.textContent = `QA INJECTED: ${id} · NOT NATURAL PLAYTHROUGH`
          Object.assign(label.style, { position: 'fixed', zIndex: '99999', left: '4px', top: '3px', color: '#fff', background: '#191919', padding: '3px 5px', font: 'bold 11px sans-serif', pointerEvents: 'none' })
          document.body.append(label)
          const { playCutscene } = await import('/src/game/cutscene.ts')
          for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
          g.scene.add('qa-injected', { create() { window.__qaScene = this; window.__qaDone = false; playCutscene(this, id, () => { window.__qaDone = true }) } }, true)
        }, id)
        await page.waitForFunction(() => !!window.__qaScene, null, { timeout: 10000 })
        const advance = async () => {
          if (device === 'desktop') await page.keyboard.press('f')
          else {
            const box = await page.locator('canvas').boundingBox()
            if (!box) throw new Error('canvas missing')
            await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5)
          }
        }
        // Query the live Phaser display tree rather than just comparing the JSON.
        const snapshot = () => {
          const scene = window.__qaScene
          const items = []
          const walk = (o, visible = true, alpha = 1) => {
            const v = visible && o.visible !== false && o.active !== false
            const a = alpha * (typeof o.alpha === 'number' ? o.alpha : 1)
            if (v && a > 0.2 && typeof o.text === 'string') {
              const b = o.getBounds?.()
              items.push({ text: o.text, bounds: b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null })
            }
            if (o.list) for (const x of o.list) walk(x, v, a)
          }
          for (const o of scene.children.list) walk(o)
          return items
        }
        for (let i = 0; i < lines.length; i++) {
          const [speaker, text] = lines[i]
          await page.waitForFunction(({ text, fn }) => { const a = (0, eval)(`(${fn})`)(); return a.some(x => x.text === text) && a.some(x => x.text === '▼') }, { text, fn: snapshot.toString() }, { timeout: 18000, polling: 40 })
          const visible = await page.evaluate(snapshot)
          const item = visible.find(x => x.text === text)
          if (speaker && !visible.some(x => x.text === speaker)) throw new Error(`speaker missing for line ${i+1}: ${speaker}`)
          if (!item?.bounds || item.bounds.x < 0 || item.bounds.y < 0 || item.bounds.x + item.bounds.width > 640.5 || item.bounds.y + item.bounds.height > 360.5) throw new Error(`out of screen line ${i+1}: ${JSON.stringify(item)}`)
          const image = `${device}-${id}-line${i+1}.png`
          await page.screenshot({ path: `${root}/${image}` })
          result.lines.push({ index: i+1, speaker: speaker || '旁白', text, bounds: item.bounds, screenshot: image })
          console.log(`PASS ${device} ${id} line ${i+1}: ${speaker || '旁白'} ${text}`)
          await advance()
          // Auto-advance waits at least 2200 ms after showing the marker. Require
          // the marker to disappear promptly after the real key/touch event instead.
          await page.waitForFunction(fn => !(0, eval)(`(${fn})`)().some(x => x.text === '▼'), snapshot.toString(), { timeout: 1200, polling: 20 })
          result.lines.at(-1).inputAdvanceObserved = true
        }
        const sub = cards[id]
        await page.waitForFunction(({ sub, fn }) => { const a = (0, eval)(`(${fn})`)(); return a.some(x => x.text === sub) && a.some(x => x.text === '鮭鮭熊') }, { sub, fn: snapshot.toString() }, { timeout: 18000, polling: 40 })
        const image = `${device}-${id}-card.png`
        await page.screenshot({ path: `${root}/${image}` })
        const visible = await page.evaluate(snapshot)
        result.card = { title: '鮭鮭熊', sub, screenshot: image, bounds: visible.find(x => x.text === sub)?.bounds }
        console.log(`PASS ${device} ${id} card: 鮭鮭熊 / ${sub}`)
        await page.waitForFunction(() => window.__qaDone === true, null, { timeout: 7000 })
        if (result.errors.length) throw new Error(`page/console errors: ${result.errors.join(' | ')}`)
        result.pass = true
      } catch (e) {
        result.failure = e.stack || String(e)
        console.error(`FAIL ${device} ${id}: ${result.failure}`)
        await page.screenshot({ path: `${root}/${device}-${id}-failure.png` }).catch(() => {})
      } finally {
        await ctx.close()
      }
    }
  }
} finally {
  await browser.close()
  await writeFile(`${root}/results.json`, JSON.stringify(results, null, 2) + '\n')
}
if (results.length !== 4 || results.some(r => !r.pass)) process.exitCode = 1
