#!/usr/bin/env node
// QA only: direct stage-5 and outro entry via the existing diagnostic hook;
// not a full playthrough. After setup all dialogue/skip/credits actions are real
// Playwright keyboard or touchscreen events; observations are read-only.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const BASE = process.env.QA_URL ?? 'http://127.0.0.1:18641/'
const OUT = 'docs/qa-c1-photo'
const story = JSON.parse(fs.readFileSync('data/story.json', 'utf8'))
const friendIds = ['huihui','guard','denim','brownie','snowcat','shiba','ginger','fleecy','gnome','tigercub','kuro']
const modes = process.env.QA_MODE ? [process.env.QA_MODE] : ['desktop', 'mobile']
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const log = (...args) => console.log(...args.map(x => typeof x === 'string' ? x : JSON.stringify(x)))

async function canvasTap(page, x, y) {
  const b = await page.locator('#game-root canvas').boundingBox()
  assert.ok(b, 'game canvas visible')
  await page.touchscreen.tap(b.x + b.width * x / 640, b.y + b.height * y / 360)
}
async function screenshot(page, name) {
  await page.locator('#game-root canvas').screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 })
}
async function selectCredits(page, mobile) {
  // First input finishes tally; second activates the unchanged credits button.
  if (mobile) {
    const p = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const b = s.clearBtns.find(b => b.id === 'credits')
      return { x: 320 + b.bg.x, y: 180 + b.bg.y }
    })
    await canvasTap(page, p.x, p.y); await page.waitForTimeout(220)
    await canvasTap(page, p.x, p.y)
  } else {
    await page.keyboard.press('Enter'); await page.waitForTimeout(220)
    await page.keyboard.press('Enter')
  }
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('credits'), null, { timeout: 18000 })
  await page.waitForTimeout(1000)
  await screenshot(page, `${mobile ? 'mobile' : 'desktop'}-credits`)
}

async function run(mode, branch, action) {
  const mobile = mode === 'mobile'
  const config = mobile ? {
    viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
  const context = await browser.newContext(config)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', r => { if (!r.url().startsWith('data:')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`) })
  const name = `${mode}-${branch}-${action}`
  const id = branch === 'perfect' ? 'C11_PERFECT' : 'C11'
  // Ten is intentionally one short to test the real branch selector boundary.
  const friends = branch === 'perfect' ? friendIds : friendIds.slice(0, 10)
  const expectedLines = story.scenes[id].steps.filter(s => s.say).map(s => s.text)
  try {
    log('\nCASE', { name, setup: 'direct stage 5 + playOutro; injected runFriends; not complete playthrough', friendCount: friends.length, input: mobile ? 'touch only after setup' : 'keyboard after setup' })
    await page.goto(BASE + '?c2=0', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 })
    await page.evaluate(ids => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', 5); g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1)
      g.registry.set('runFriends', ids)
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('play')
    }, friends)
    await page.waitForFunction(() => { const s = window.__SAKE_GAME__?.scene.getScene('play'); return s?.scene.isActive() && s.storyIntro }, null, { timeout: 45000 })
    await page.waitForTimeout(500)
    if (mobile) await canvasTap(page, 610, 15); else await page.keyboard.press('Enter')
    await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return !s.storyIntro && s.started }, null, { timeout: 10000 })
    const selected = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').perfectEnding())
    assert.equal(selected, branch === 'perfect', 'selected by actual perfectEnding()')
    // Attach a passive frame sampler before the real playOutro() call.
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      window.__photoQA = { frames: [], lines: [], status: {}, errors: [] }
      const q = window.__photoQA
      s.events.on('postupdate', () => {
        try {
          const root = s.children.list.find(o => o.list?.some(x => x.text === '跳過 ▶▶'))
          if (!root) { q.status = { story: !!s.storyIntro, clear: !!s.clearOverlay }; return }
          const dialog = root.list.find(o => o.list?.some(x => x.text === '▼'))
          const mark = dialog?.list?.find(x => x.text === '▼')
          const body = dialog?.list?.[4]
          const ready = !!dialog?.visible && !!mark?.visible
          q.status = { story: !!s.storyIntro, ready, line: ready ? body?.text : '', clear: !!s.clearOverlay }
          if (ready && q.lines.at(-1) !== body.text) q.lines.push(body.text)
          function walk(o, out = []) { if (o.texture?.key?.startsWith('story-ending-')) out.push(o); if (o.list) for (const c of o.list) walk(c, out); return out }
          const imgs = walk(root)
          for (const im of imgs) q.frames.push({ wall: performance.now(), scene: s.time.now, key: im.texture.key, alpha: im.parentContainer?.alpha, rootAlpha: root.alpha, dialog: !!dialog?.visible })
          function texts(o, out = []) { if (typeof o.text === 'string') out.push(o); if (o.list) for (const c of o.list) texts(c, out); return out }
          const allTexts = texts(root)
          const title = allTexts.find(t => t.text === '鮭鮭熊' && t.alpha > 0.9)
          const sub = allTexts.find(t => ['全部真蜂蜜搵齊・森林獲救', '［完美結局字卡 — 待 Alan 填寫］'].includes(t.text) && t.alpha > 0.9)
          if (title && sub) q.endCard = { title: title.text, sub: sub.text }
        } catch (e) { q.errors.push(String(e)) }
      })
      s.playOutro()
    })
    // Observe each actual completed line before advancing it; no rewritten text.
    for (const expected of expectedLines) {
      await page.waitForFunction(text => window.__photoQA?.status.ready && window.__photoQA.status.line === text, expected, { timeout: 25000 })
      if (mobile) await canvasTap(page, 320, 200); else await page.keyboard.press('f')
      await page.waitForFunction(text => !window.__photoQA?.status.ready || window.__photoQA.status.line !== text, expected, { timeout: 5000 })
    }
    const lines = await page.evaluate(() => window.__photoQA.lines)
    assert.deepEqual(lines, expectedLines, `${id} retained every dialogue line in order`)
    await page.waitForFunction(() => window.__photoQA?.frames.some(f => f.key === 'story-ending-3' && f.alpha === 1 && f.rootAlpha === 1), null, { timeout: 10000 })
    await page.waitForTimeout(350)
    const inHold = await page.evaluate(() => window.__photoQA.frames.filter(f => f.key === 'story-ending-3').at(-1))
    assert.equal(inHold.alpha, 1); assert.equal(inHold.dialog, false, 'dialog must not obscure full image')
    await screenshot(page, name + '-photo')
    if (action === 'skip') {
      const t = Date.now()
      const skipKey = branch === 'perfect' ? 'Enter' : 'Escape'
      if (mobile) await canvasTap(page, 610, 15); else await page.keyboard.press(skipKey)
      await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('play').clearOverlay, null, { timeout: 5000 })
      const ms = Date.now() - t
      assert.ok(ms < 3000, `skip should reach clear card promptly (${ms}ms)`)
      log('SKIP', { input: mobile ? 'touch 跳過 ▶▶' : skipKey, clearCardAfterMs: ms, duringOpaqueHold: true })
    } else {
      await page.waitForFunction(() => !!window.__photoQA?.endCard, null, { timeout: 12000 })
      const card = await page.evaluate(() => window.__photoQA.endCard)
      assert.equal(card.sub, id === 'C11' ? '全部真蜂蜜搵齊・森林獲救' : '［完美結局字卡 — 待 Alan 填寫］')
      await screenshot(page, name + '-end-card')
      await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('play').clearOverlay, null, { timeout: 15000 })
    }
    await screenshot(page, name + '-clear')
    const q = await page.evaluate(() => window.__photoQA)
    assert.deepEqual(q.errors, [], 'frame sampler errors')
    const photo = q.frames.filter(f => f.key === 'story-ending-3')
    const opaqueIndex = photo.findIndex(f => f.alpha === 1 && f.rootAlpha === 1)
    assert.ok(opaqueIndex >= 0, 'photo fully opaque')
    const start = photo[opaqueIndex]
    const fading = photo.slice(opaqueIndex + 1).find(f => f.alpha < 1)
    if (action === 'natural') {
      assert.ok(fading, 'natural photo fade-out observed')
      const sceneHold = fading.scene - start.scene
      const wallHold = fading.wall - start.wall
      assert.ok(sceneHold >= 4980 && sceneHold <= 5300, `scene full opacity hold ${sceneHold}ms`)
      assert.ok(wallHold >= 4980 && wallHold <= 5500, `wall full opacity hold ${wallHold}ms`)
      assert.ok(photo.slice(opaqueIndex).every(f => !f.dialog), 'dialog stays hidden for photo')
      const first = photo[0], last = photo.at(-1)
      log('TIMING', { firstFadeInToOpaqueSceneMs: Math.round(start.scene - first.scene), opaqueHoldSceneMs: Math.round(sceneHold), opaqueHoldWallMs: Math.round(wallHold), fadeOutSampleSceneMs: Math.round(last.scene - fading.scene), samples: photo.length })
      const previous = q.frames.filter(f => f.key === 'story-ending-2' && f.alpha === 1)
      assert.ok(previous.some(f => f.dialog), 'earlier still still retains dialogue overlay')
      await selectCredits(page, mobile)
      log('CONTINUATION', 'original end card → stage-5 clear card → credits')
    } else {
      assert.ok(!fading, 'skipped before normal fade-out')
      assert.ok(photo.at(-1).scene - start.scene < 5000, 'skipped before five-second hold elapsed')
      await page.waitForTimeout(5500)
      assert.ok(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').clearOverlay), 'clear card remains after old deadline')
      await selectCredits(page, mobile)
      log('CONTINUATION', 'skip → clear card remains past original deadline → credits')
    }
    assert.deepEqual(errors, [], 'page/request errors')
    fs.writeFileSync(`${OUT}/${name}-frames.json`, JSON.stringify({ photo, lines, errors }, null, 2) + '\n')
    log('LINES', { id, count: lines.length, unchanged: true, priorStillRetainsDialog: action === 'natural' })
    log('RESULT', { name, result: 'PASS', physicalDevice: false, completePlaythrough: false })
  } catch (e) {
    await screenshot(page, name + '-failure').catch(() => {})
    log('FAIL', { name, error: e.stack ?? String(e), errors, state: await page.evaluate(() => window.__photoQA?.status).catch(() => null) })
    throw e
  } finally { await context.close() }
}
try {
  for (const mode of modes) {
    const cases = [['normal', 'natural'], ['perfect', 'natural'], ['normal', 'skip'], ['perfect', 'skip']]
    for (const [branch, action] of cases) {
      if (!process.env.QA_CASE || process.env.QA_CASE.split(',').includes(`${branch}-${action}`)) {
        try { await run(mode, branch, action) } catch { process.exitCode = 1 }
      }
    }
  }
} finally { await browser.close() }
