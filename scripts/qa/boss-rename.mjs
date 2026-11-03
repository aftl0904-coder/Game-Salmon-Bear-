// Boss-card presentation regression. Opens the real card on the logo scene;
// no full playthrough, combat or physical-device testing is implied.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const mode = process.env.QA_MODE ?? 'mobile'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47324/'
const out = process.env.QA_OUT ?? 'docs/qa-boss-rename'
assert.ok(['mobile', 'desktop'].includes(mode))
fs.mkdirSync(out, { recursive: true })
const bosses = JSON.parse(fs.readFileSync('data/bosses.json', 'utf8')).bosses
assert.deepEqual([bosses.mudmane.name, bosses.mudmane.title], ['泥怪', '爛泥灣工地發瘟判頭'])
assert.deepEqual([bosses.triboss.name, bosses.triboss.title, bosses.triboss.role], ['Trinity', '派嘢嗰個', '項目經理'])
const results = { mode, cases: [], errors: [], passed: false }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const [id, name, title] of [
    ['mudmane', '泥怪', '爛泥灣工地發瘟判頭'],
    ['triboss', 'Trinity', '派嘢嗰個'],
  ]) {
    const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
    const page = await ctx.newPage()
    page.on('pageerror', error => results.errors.push(error.message))
    await page.goto(base)
    await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 30000 })
    await page.waitForTimeout(1200)
    const result = await page.evaluate(async id => {
      const game = window.__SAKE_GAME__
      const scene = game.scene.getScene('logo')
      const play = game.scene.getScene('play')
      play.stageNo = id === 'mudmane' ? 4 : 5
      play.depot = id === 'mudmane'; play.tower = id === 'triboss'; play.mall = false
      const hudName = play.bossName()
      const cards = await import('/src/game/bossCard.ts')
      window.__renameCardDone = false
      window.__renameCard = cards.playBossCard(scene, id, () => { window.__renameCardDone = true })
      const card = [...scene.children.list].reverse().find(o => o.list?.some(x => x.text === (id === 'mudmane' ? '泥怪' : 'Trinity')))
      return { hudName, texts: card?.list.filter(x => typeof x.text === 'string').map(x => x.text) ?? [] }
    }, id)
    assert.equal(result.hudName, name)
    assert.ok(result.texts.includes(name), 'actual Boss card name')
    assert.ok(result.texts.includes(title), 'actual Boss card title')
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${out}/${mode}-${id}.png`, scale: 'css' })
    if (mode === 'mobile') {
      const box = await page.locator('canvas').boundingBox()
      assert.ok(box)
      await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5)
    } else await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.__renameCardDone, null, { timeout: 10000 })
    results.cases.push({ id, name, title, hudName: result.hudName, input: mode === 'mobile' ? 'touch' : 'keyboard' })
    await ctx.close()
  }
  const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  await page.goto(`${base}guide/`)
  const guide = await page.locator('body').innerText()
  assert.ok(guide.includes('泥怪') && guide.includes('Trinity（項目經理；最終 Boss）'))
  assert.ok(!guide.includes('泥鬃') && !guide.includes('△畝大佬'))
  results.guide = 'HTML text names and role verified; embedded images are separate, historical screenshots'
  await page.screenshot({ path: `${out}/${mode}-guide.png`, scale: 'css' })
  await ctx.close()
  assert.deepEqual(results.errors, [])
  results.passed = true
  console.log(`PASS ${mode}: Boss cards, HUD names, guide HTML and ${mode === 'mobile' ? 'touch' : 'keyboard'}`)
} catch (error) {
  results.error = error.stack ?? String(error)
  console.error(results.error)
} finally {
  fs.writeFileSync(`${out}/${mode}.json`, JSON.stringify(results, null, 2) + '\n')
  await browser.close()
}
if (!results.passed) process.exitCode = 1
