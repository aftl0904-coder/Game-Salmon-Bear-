import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const mode = process.env.QA_MODE || 'desktop'
assert.ok(['desktop', 'mobile'].includes(mode))
const out = 'docs/qa-guide-first-release'
const base = 'http://127.0.0.1:47360/'
const report = { mode, input: mode === 'desktop' ? 'keyboard' : 'simulated Pixel 7 landscape touch', checks: [], pageerrors: [], consoleErrors: [], http404: [], requestFailed: [], scroll: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const context = await browser.newContext(mode === 'desktop' ? { viewport: { width: 1280, height: 720 } } : { ...devices['Pixel 7 landscape'] })
const page = await context.newPage()
page.on('pageerror', error => report.pageerrors.push(error.message))
page.on('console', msg => { if (msg.type() === 'error') { const entry = { text: msg.text(), url: msg.location().url }; report.consoleErrors.push(entry); if (msg.text().includes('404')) report.http404.push(entry.url) } })
page.on('response', response => { if (response.status() === 404) report.http404.push(response.url()) })
page.on('requestfailed', request => report.requestFailed.push({ url: request.url(), failure: request.failure()?.errorText }))
const screen = async name => page.screenshot({ path: `${out}/${mode}-${name}.png`, scale: 'css' })
const activeLogo = async () => page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 })
const canvasTap = async (x, y) => {
  const b = await page.locator('canvas').boundingBox()
  assert.ok(b, 'canvas visible')
  await page.touchscreen.tap(b.x + b.width * x / 640, b.y + b.height * y / 360)
}
const swipeUp = async () => {
  const cdp = await context.newCDPSession(page)
  const size = page.viewportSize()
  const x = Math.round(size.width * 0.72), start = Math.round(size.height * 0.82), end = Math.round(size.height * 0.25)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start, id: 1 }] })
  for (let i = 1; i <= 8; i++) {
    const y = Math.round(start + (end - start) * i / 8)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] })
    await page.waitForTimeout(25)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(160)
  await cdp.detach()
}
const goDownTo = async selector => {
  const before = await page.evaluate(() => scrollY)
  let visible = false, attempts = 0
  for (; attempts < 150; attempts++) {
    visible = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
    if (visible) break
    const pos = await page.locator(selector).evaluate(el => el.getBoundingClientRect().top)
    assert.ok(pos > 0, `${selector} was skipped while scrolling, top=${pos}`)
    if (mode === 'desktop') { await page.keyboard.press('PageDown'); await page.waitForTimeout(150) }
    else await swipeUp()
  }
  assert.ok(visible, `${selector} should be fully visible by ${mode} scrolling`)
  const after = await page.evaluate(() => scrollY)
  assert.ok(after > before, `${selector}: scroll position must increase`)
  report.scroll.push({ selector, before, after, attempts })
}
try {
  await page.goto(base + '?c2=1', { waitUntil: 'domcontentloaded' })
  await activeLogo(); await page.waitForTimeout(1200)
  assert.equal(await page.evaluate(() => localStorage.getItem('sake-kuma-c2-v1')), '1')
  await screen('cover')
  if (mode === 'mobile') await canvasTap(398, 330)
  else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
  await page.waitForURL(/\/guide\/$/, { timeout: 15000 })
  await page.getByRole('heading', { name: '鮭鮭熊　通關攻略手冊' }).waitFor()
  await screen('guide-top')
  assert.equal(await page.getByRole('link', { name: '開始玩' }).getAttribute('href'), '/')
  const text = await page.locator('body').innerText()
  for (const phrase of ['武者王', '商場保安總監', '洗地機', '尚未實裝', '開發中', '噗噗 D 段台詞：待補', '馴獸師 Boss 卡（名稱、稱號、三行描述）：待補', '離隊提示文字：待補', '待續']) assert.ok(text.includes(phrase), `missing ${phrase}`)
  assert.ok(text.trim().endsWith('待續'), 'guide ends with 待續')
  assert.ok(!text.includes('冇 Boss；終點係蜂蜜樹'), 'obsolete no-boss claim removed')
  report.checks.push('normal cover → guide; current/WIP/待補 markers and first-stage boss; original start link')
  await goDownTo('#c2-stage1'); await screen('stage6')
  await goDownTo('#c2-stage2'); await screen('stage7')
  await goDownTo('#to-be-continued'); await screen('continued')
  report.checks.push('physically scrolled to both new sections and final 待續')
  const ret = page.getByRole('link', { name: '返回遊戲' })
  assert.equal(await ret.getAttribute('href'), '/')
  if (mode === 'mobile') await ret.tap()
  else {
    let focused = false
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => document.activeElement?.textContent === '返回遊戲')) { focused = true; break }
    }
    assert.ok(focused, 'footer return reachable by keyboard Tab')
    await page.keyboard.press('Enter')
  }
  await page.waitForURL(url => url.pathname === '/', { timeout: 15000 })
  await activeLogo(); await page.waitForTimeout(700)
  assert.equal(await page.evaluate(() => localStorage.getItem('sake-kuma-c2-v1')), '1', 'test gate persists on return')
  await screen('return')
  // Re-enter normally and exercise the original top link, not just the new footer link.
  await page.waitForTimeout(400)
  if (mode === 'mobile') await canvasTap(398, 330)
  else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
  await page.waitForURL(/\/guide\/$/, { timeout: 15000 })
  const original = page.getByRole('link', { name: '開始玩' })
  await original.waitFor({ state: 'visible' })
  if (mode === 'mobile') await original.tap()
  else {
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '開始玩')
    await page.keyboard.press('Enter')
  }
  await activeLogo(); await page.waitForTimeout(700)
  report.checks.push('original top 開始玩 link returns to game via touch/keyboard')
  assert.deepEqual(report.pageerrors, [])
  assert.deepEqual(report.consoleErrors, [])
  assert.deepEqual(report.http404, [])
  assert.deepEqual(report.requestFailed, [])
  report.checks.push('return to playable game title via touch/keyboard; C2 gate preserved; no 404, console error, pageerror or failed request')
  report.passed = true
  console.log('PASS', JSON.stringify(report, null, 2))
} catch (error) {
  report.passed = false
  report.error = error.stack || String(error)
  console.error('FAIL', report.error)
  await screen('failure').catch(() => {})
} finally {
  fs.writeFileSync(`${out}/${mode}.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
if (!report.passed) process.exitCode = 1
