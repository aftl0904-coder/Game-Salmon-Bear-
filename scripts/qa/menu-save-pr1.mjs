import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47320/'
const OUT = process.env.QA_OUT ?? 'docs/qa-menu-save-pr1'
const MODE = process.env.QA_MODE ?? 'mobile'
const PROFILE = process.env.QA_PROFILE ?? 'Pixel 7 landscape'
const prefix = MODE === 'desktop' ? 'desktop' : PROFILE.startsWith('iPhone') ? 'iphone' : 'mobile'
assert.ok(['mobile', 'desktop'].includes(MODE))
const cards = JSON.parse(fs.readFileSync(new URL('../../data/ending-c2.json', import.meta.url), 'utf8'))
assert.equal(cards.length, 10)
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(MODE === 'mobile' ? { ...devices[PROFILE] } : { viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const errors = [], report = { mode: MODE, profile: MODE === 'mobile' ? PROFILE : 'desktop', checks: [], errors }
page.on('pageerror', e => errors.push(e.message))
const screen = async name => page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, scale: 'css' })
const tap = async (x, y) => {
  const b = await page.locator('canvas').boundingBox()
  assert.ok(b)
  await page.touchscreen.tap(b.x + b.width * x / 640, b.y + b.height * y / 360)
}
const active = async name => page.waitForFunction(n => window.__SAKE_GAME__?.scene.isActive(n), name, { timeout: 35000 })
const boot = async suffix => {
  await page.goto(BASE + suffix)
  await active('logo')
  await page.waitForTimeout(900)
}
const begin = async () => {
  if (MODE === 'mobile') await tap(242, 330)
  else await page.keyboard.press('Enter')
  await active('difficulty')
  await page.waitForTimeout(500)
  if (MODE === 'mobile') await tap(320, 190)
  else await page.keyboard.press('Enter')
  await active('menu')
  await page.waitForTimeout(700)
}
const menuInfo = () => page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('menu')
  return { stage: s.stageSel, buttons: s.continentButtons.map(b => b.stage), texts: s.children.list.filter(x => typeof x.text === 'string').map(x => x.text) }
})
try {
  await boot('?c2=0')
  await screen('cover')
  if (MODE === 'mobile') await tap(398, 330)
  else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
  await page.waitForURL(/\/guide\/$/, { timeout: 10000 })
  const back = page.getByRole('link', { name: '開始玩' })
  await back.waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await back.count(), 1)
  assert.equal(await back.getAttribute('href'), '/')
  await screen('guide')
  if (MODE === 'mobile') await back.tap()
  else {
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), '開始玩')
    await page.keyboard.press('Enter')
  }
  await active('logo'); await page.waitForTimeout(900); await begin()
  let info = await menuInfo()
  assert.deepEqual(info.buttons, [1], 'C2 gate closed')
  assert.ok(info.texts.includes('重溫快樂結局（鎖住）'), 'locked ending is shown')
  await screen('menu-locked')
  if (MODE === 'mobile') await tap(96, 143)
  else await page.keyboard.press('r')
  await page.waitForTimeout(450)
  assert.ok(await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('menu')), 'locked replay cannot open')
  if (MODE === 'desktop') await page.keyboard.press('2')
  assert.equal((await menuInfo()).stage, 1, 'hidden C2 cannot be chosen by keyboard')
  report.checks.push('cover→guide→game; locked replay; closed C2 gate')
  if (MODE === 'mobile') await tap(320, 334)
  else await page.keyboard.press('Enter')
  await active('gacha')
  assert.equal(await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo')), 1)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sake-kuma-run-v1')).eligible), true)
  report.checks.push('new C1 player starts baseline directly without a choice dialog; gacha flow retained')

  await boot('?c2=1')
  assert.equal(await page.evaluate(() => localStorage.getItem('sake-kuma-c2-v1')), '1', 'gate saved on cover')
  if (MODE === 'mobile') await tap(398, 330)
  else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
  await page.waitForURL(/\/guide\/$/, { timeout: 10000 })
  const backAgain = page.getByRole('link', { name: '開始玩' })
  await backAgain.waitFor({ state: 'visible', timeout: 15000 })
  if (MODE === 'mobile') await backAgain.tap()
  else { await page.keyboard.press('Tab'); await page.keyboard.press('Enter') }
  await active('logo'); await page.waitForTimeout(900); await begin()
  info = await menuInfo()
  assert.deepEqual(info.buttons, [1, 6], 'C2 gate survives guide return')
  if (MODE === 'mobile') await tap(382, 143)
  else await page.keyboard.press('2')
  assert.equal((await menuInfo()).stage, 6, 'C2 stage selected')
  await screen('menu-c2')
  if (MODE === 'mobile') await tap(320, 334)
  else await page.keyboard.press('Enter')
  await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('menu').startDialog)
  await page.waitForTimeout(300)
  const dialog = await page.evaluate(() => {
    const d = window.__SAKE_GAME__.scene.getScene('menu').startDialog
    return { selected: d.selected, labels: d.choices.map(c=>c.label.text), texts: d.root.list.filter(x=>typeof x.text==='string').map(x=>x.text) }
  })
  assert.equal(dialog.labels[dialog.selected], '取消')
  assert.ok(dialog.texts.some(t=>t.includes('會取代目前本局') && t.includes('目前停喺第1關')))
  await screen('c2-carry-choice')
  if (MODE === 'mobile') await tap(320, 171)
  else { await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter') }
  await active('worldmap')
  assert.equal(await page.evaluate(() => window.__SAKE_GAME__.registry.get('stageNo')), 6)
  await screen('c2-worldmap')
  report.checks.push('open C2 gate; actual C2 selection enters world map at stage 6')

  // Set the otherwise unavailable Stage 10 completion flag only in this isolated test browser.
  await page.evaluate(() => localStorage.setItem('sake-kuma-c2-cleared-v1', '1'))
  await boot(''); await begin()
  info = await menuInfo()
  assert.deepEqual(info.buttons, [1, 6], 'C2 test gate stays enabled in browser')
  assert.ok(info.texts.includes('重溫快樂結局 [R]'))
  const savedBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
  if (MODE === 'mobile') await tap(96, 143)
  else await page.keyboard.press('r')
  await active('ending-c2'); await page.waitForTimeout(450)
  for (let i = 0; i < cards.length; i++) {
    const state = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('ending-c2'), b = s.descText.getBounds()
      return { index: s.index, title: s.titleText.text, desc: s.descText.text, count: s.countText.text, bounds: { x: b.x, y: b.y, right: b.right, bottom: b.bottom } }
    })
    assert.equal(state.index, i); assert.equal(state.title, cards[i].title)
    assert.ok(state.desc.includes(cards[i].description), `card ${i + 1} uses its description when image is missing`)
    assert.equal(state.count, `${i + 1} / 10`)
    assert.ok(state.bounds.x >= 0 && state.bounds.right <= 640 && state.bounds.y >= 0 && state.bounds.bottom <= 360, `card ${i + 1} visible`)
    if (i === 0 || i === 9) await screen(`ending-${String(i + 1).padStart(2, '0')}`)
    if (i === 2) {
      if (MODE === 'mobile') await tap(205, 300)
      else await page.keyboard.press('ArrowLeft')
      assert.equal(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('ending-c2').index), 1, 'previous card')
      if (MODE === 'mobile') await tap(435, 300)
      else await page.keyboard.press('ArrowRight')
      assert.equal(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('ending-c2').index), 2, 'return to card')
    }
    if (i < cards.length - 1) {
      if (MODE === 'mobile') await tap(435, 300)
      else await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(100)
    }
  }
  if (MODE === 'mobile') await tap(435, 300)
  else await page.keyboard.press('Enter')
  await active('menu'); await page.waitForTimeout(500)
  const savedAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())))
  assert.equal(savedAfter, savedBefore, 'replay does not mutate save data')
  report.checks.push('simulated C2 flag unlocks all 10 descriptions, finishes back at menu, leaves save data unchanged')
  await boot('?c2=0'); await begin()
  assert.deepEqual((await menuInfo()).buttons, [1], 'C2 gate can be turned off again')
  assert.equal(await page.evaluate(() => localStorage.getItem('sake-kuma-c2-cleared-v1')), '1', 'C2 gate does not clear ending flag')
  report.checks.push('C2 gate can be turned off without deleting completion flag')
  assert.deepEqual(errors, [])
  report.passed = true
  console.log(`PASS ${prefix}`, JSON.stringify(report.checks))
} catch (e) {
  report.passed = false; report.error = e.stack ?? String(e)
  console.error(report.error)
  await screen('failure').catch(() => {})
} finally {
  fs.writeFileSync(`${OUT}/${prefix}.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
if (!report.passed) process.exitCode = 1
