// C2 opener QA: actual menu/touch or keys; sequential route uses injected checkpoint and playOutro().
// This is NOT a complete C1 playthrough or a physical-phone test.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47338/'
const out = 'docs/qa-c2-intro'
fs.mkdirSync(out, { recursive: true })
const lines = [
  ['', '森林重新平靜，大家終於一齊野餐。'],
  ['琪寶寶', '噗噗，今次可以慢慢食喇。'],
  ['噗噗', '噗噗！'],
  ['倫寶', '食飽之後，一齊去行商場？'],
  ['琪寶寶', '好呀，叫埋啲朋友！'],
  ['', '大家來到商場門前。'],
  ['倫寶', '呢個商場……同之前講嗰間好似。'],
  ['琪寶寶', '咦？入面好似有啲古怪。'],
  ['噗噗', '噗……？'],
  ['倫寶', '我哋入去睇清楚。'],
]
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []

async function scenario(mode, route) {
  const mobile = mode === 'mobile'
  const ctx = await browser.newContext(mobile ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  const result = { mode, route, checks: [], errors: [], passed: false, limitations: route === 'sequential' ? 'Injected C1 run checkpoints (stages 1–4) and invoked stage 5 playOutro; not a full playthrough.' : 'Normal menu entry from fresh browser. Phone is emulated, not physical.' }
  page.on('pageerror', e => result.errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') result.errors.push('console: ' + m.text()) })
  const active = name => page.waitForFunction(n => window.__SAKE_GAME__?.scene.isActive(n), name, { timeout: 40000 })
  const tap = async (x, y) => {
    const b = await page.locator('canvas').boundingBox(); assert.ok(b)
    await page.touchscreen.tap(b.x + b.width * x / 640, b.y + b.height * y / 360)
  }
  const go = async (x = 320, y = 180) => { if (mobile) await tap(x, y); else await page.keyboard.press('Enter'); await page.waitForTimeout(250) }
  const advance = async () => { if (mobile) await tap(320, 190); else await page.keyboard.press('f') }
  const skip = async () => { if (mobile) await tap(615, 16); else await page.keyboard.press('Escape') }
  const shot = name => page.screenshot({ path: `${out}/${mode}-${route}-${name}.png`, scale: 'css' })
  const textWait = text => page.waitForFunction(text => {
    const s = window.__SAKE_GAME__?.scene.getScene('play')
    const find = o => o && o.visible !== false && ((o.type === 'Text' && o.text === text) || (o.list?.some(find) ?? false))
    return !!s?.children?.list.some(find)
  }, text, { timeout: 12000 })
  const labels = () => page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play'), out = []
    const walk = o => { if (!o || o.visible === false) return; if (o.type === 'Text') out.push(o.text); o.list?.forEach(walk) }
    s.children.list.forEach(walk); return out
  })
  const started = () => page.waitForFunction(() => { const s = window.__SAKE_GAME__?.scene.getScene('play'); return s?.stageNo === 6 && s.started && !s.storyIntro }, null, { timeout: 15000 })
  try {
    await page.goto(base + '?c2=1'); await active('logo'); await page.waitForTimeout(1000)
    if (route === 'direct') {
      await go(242, 330); await active('difficulty'); await page.waitForTimeout(600)
      if (mobile) await tap(320, 190); else await page.keyboard.press('Enter')
      await active('menu'); await page.waitForTimeout(800)
      if (mobile) { await tap(382, 143); await tap(160, 334) }
      else { await page.keyboard.press('2'); await page.keyboard.press('Enter') }
      await active('worldmap'); result.checks.push('Fresh boot → title → difficulty → actual C2 menu selection → world map')
    } else {
      await page.evaluate(async () => {
        const game = window.__SAKE_GAME__, r = await import('/src/game/run.ts')
        game.registry.set('difficulty', 'normal'); game.registry.set('stageRound', 1)
        r.startNewRun(1, false, '1p', 'boy', game.registry)
        for (let i = 1; i <= 4; i++) r.saveClear(i, { coins: 25, purse: { boy: 25 }, hp: { boy: 3 }, friends: [] })
        r.resumeMain(game.registry)
        for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key)
        game.scene.start('play')
      })
      await active('play'); await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').stageNo === 5)
      await page.waitForTimeout(1200); await skip()
      await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.started && !s.storyIntro }, null, { timeout: 15000 })
      await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').playOutro()) // injected victory shortcut, not gameplay
      await textWait('聖誕伯伯、虎仔同喵仔都搵到喇——十一個朋友，終於齊晒。')
      await shot('existing-c1-ending'); await skip()
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').tallyDone, null, { timeout: 20000 })
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
      assert.equal(saved.lastCleared, 5); assert.equal(saved.nextStage, 6)
      result.checks.push('Injected stage 5 playOutro showed existing C1 ending; skip → clear card saved nextStage=6')
      if (mobile) {
        const p = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'), b = s.clearBtns.find(x => x.id === 'credits'); return { x: s.clearOverlay.x + b.bg.x, y: s.clearOverlay.y + b.bg.y, on: b.on } })
        assert.equal(p.on, true); await tap(p.x, p.y)
      } else {
        for (let i = 0; i < 8; i++) {
          if (await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.clearBtns[s.clearSel]?.id === 'credits' })) break
          await page.keyboard.press('ArrowLeft')
        }
        assert.equal(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.clearBtns[s.clearSel]?.id }), 'credits')
        await page.keyboard.press('Enter')
      }
      await active('worldmap'); await go(); await active('credits'); await page.waitForTimeout(1800)
      await go(); await page.waitForTimeout(850)
      const options = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('credits').children.list.filter(x => typeof x.text === 'string').map(x => x.text))
      assert.ok(options.some(x => x.includes('前往大陸2'))); await shot('credits-c2')
      if (mobile) await tap(320, 313); else await page.keyboard.press('2')
      await active('worldmap'); result.checks.push('Existing C1 credits offered C2 and real UI entered map')
    }
    await active('play'); await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').stageNo === 6, null, { timeout: 40000 })
    await textWait(lines[0][1])
    const before = await page.evaluate(() => ({ run: localStorage.getItem('sake-kuma-run-v1'), flag: localStorage.getItem('sake-kuma-c2-cleared-v1') }))
    assert.equal(JSON.parse(before.run).nextStage, 6); assert.equal(before.flag, null)
    if (route === 'direct') {
      for (let i = 0; i < lines.length; i++) {
        const [speaker, text] = lines[i]; await textWait(text)
        const list = await labels(); if (speaker) assert.ok(list.includes(speaker), `speaker for ${text}: ${JSON.stringify(list)}`)
        if (i === 0) await shot('picnic')
        if (i === 5) await shot('mall-door')
        if (i === 9) await shot('last-line')
        result.checks.push({ line: i + 1, speaker: speaker || 'narration', text })
        await advance()
      }
      await started(); result.checks.push('All ten exact lines and speaker labels observed in order and advanced by ' + (mobile ? 'touch alone' : 'keyboard F'))
    } else {
      await shot('intro-before-skip'); await skip(); await started()
      result.checks.push('Stage 6 opener skipped by ' + (mobile ? 'touch alone' : 'Escape') + ', resumed stage 6')
    }
    const after = await page.evaluate(() => ({ run: localStorage.getItem('sake-kuma-run-v1'), flag: localStorage.getItem('sake-kuma-c2-cleared-v1'), stage: window.__SAKE_GAME__.scene.getScene('play').stageNo }))
    assert.deepEqual(after, { ...before, stage: 6 }); await shot('gameplay')
    result.checks.push('Run storage and C2-cleared flag unchanged while playing/skipping intro; stage 6 gameplay starts')
    assert.deepEqual(result.errors, [])
    result.passed = true
  } catch (e) { result.error = e.stack ?? String(e); await shot('failure').catch(() => {}) }
  finally { results.push(result); await ctx.close() }
  console.log(JSON.stringify(result, null, 2))
}

await Promise.all([scenario('desktop', 'direct'), scenario('mobile', 'direct')])
await Promise.all([scenario('desktop', 'sequential'), scenario('mobile', 'sequential')])
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n')
await browser.close()
if (results.some(r => !r.passed)) process.exitCode = 1
