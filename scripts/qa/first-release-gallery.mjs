import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:47389/'
const out = 'docs/qa-first-release-gallery'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
for (const mode of ['desktop', 'mobile']) {
  const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage(), errors = [], checks = []
  page.on('pageerror', e => errors.push(e.message))
  const shot = n => page.screenshot({ path: `${out}/${mode}-${n}.png`, scale: 'css' })
  const active = n => page.waitForFunction(name => window.__SAKE_GAME__?.scene.isActive(name), n, { timeout: 35000 })
  const tap = async (x, y) => { const b = await page.locator('canvas').boundingBox(); assert.ok(b); await page.touchscreen.tap(b.x + b.width*x/640, b.y + b.height*y/360) }
  const state = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('gallery'); return { group:s.group, index:s.index, action:s.action, texts:s.children.list.flatMap(o => o.list ?? [o]).filter(o => typeof o.text === 'string').map(o => o.text) } })
  const pressOrTap = async (key, x, y) => mode === 'mobile' ? tap(x,y) : page.keyboard.press(key)
  try {
    await page.goto(base); await active('logo'); await page.waitForTimeout(900); await shot('cover')
    const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
    if (mode === 'mobile') await tap(472, 330)
    else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
    await active('gallery'); await page.waitForTimeout(400)
    let s = await state(); assert.equal(s.group, 'good'); assert.equal(s.index, 0); assert.ok(s.texts.some(t => t.includes('倫寶'))); await shot('gallery-hero')
    await pressOrTap('2', 320, 305); s = await state(); assert.equal(s.action, 1); assert.ok(s.texts.some(t => t.includes('射擊')))
    await pressOrTap('3', 472, 305); s = await state(); assert.equal(s.action, 2); assert.ok(s.texts.some(t => t.includes('勝利')))
    await pressOrTap('ArrowRight', 600, 190); s = await state(); assert.equal(s.index, 1); assert.equal(s.action, 0); assert.ok(s.texts.some(t => t.includes('琪寶寶')))
    await pressOrTap('ArrowDown', 388, 69); s = await state(); assert.equal(s.group, 'bad'); assert.equal(s.index, 0); assert.ok(s.texts.some(t => t.includes('紅魚'))); await shot('gallery-enemy')
    await pressOrTap('ArrowLeft', 40, 190); s = await state(); assert.ok(s.texts.some(t => t.includes('產品化蜜僵'))); assert.ok(s.texts.some(t => t.includes('待切格驗收')))
    await pressOrTap('3', 472, 305); s = await state(); assert.equal(s.action, 2); assert.ok(s.texts.some(t => t.includes('待繪'))); await shot('gallery-pending')
    checks.push('cover→gallery; good/bad; next/previous; three actions; pending states')
    await pressOrTap('Escape', 61, 23); await active('logo'); await page.waitForTimeout(600)
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))), before, 'gallery leaves saves unchanged')
    checks.push('return to title; localStorage unchanged')
    if (mode === 'mobile') await tap(320,330)
    else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
    await page.waitForURL(/\/guide\/$/, { timeout: 10000 }); checks.push('guide entry still opens')
    await page.goto(base); await active('logo'); await page.waitForTimeout(600)
    if (mode === 'mobile') await tap(168,330)
    else await page.keyboard.press('Enter')
    await active('difficulty'); checks.push('game entry still opens difficulty')
    assert.deepEqual(errors, [])
    results.push({ mode, passed:true, checks, errors })
  } catch (e) {
    await shot('failure').catch(()=>{})
    results.push({ mode, passed:false, checks, error:e.stack ?? String(e), errors })
  } finally { await ctx.close() }
}
await browser.close()
fs.writeFileSync(`${out}/browser-tests.json`, JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results,null,2))
if (results.some(r => !r.passed)) process.exitCode = 1
