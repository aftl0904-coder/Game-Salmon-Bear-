// Inject stage 3 checkpoint and stats, then invoke the real GameScene.win(). Not a playthrough.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47947/'
const out = process.env.QA_OUT ?? 'docs/qa-first-release-growth/storage-20261104'
const failWrite = process.env.QA_FAIL_WRITE === '1'
const name = failWrite ? 'win-failure-retry' : 'win'
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const report = { scope: 'injected stage 3 checkpoint, stats and direct win(); real scene and localStorage; no natural boss battle', errors: [], passed: false }
page.on('pageerror', e => report.errors.push(e.message))
try {
  await page.goto(base + '?c2=1')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 })
  await page.evaluate(async () => {
    const r = await import('/src/game/run.ts'), game = window.__SAKE_GAME__
    const state = { coins: 20, purse: { boy: 20 }, hp: { boy: 6 }, friends: [] }
    game.registry.set('difficulty', 'normal'); game.registry.set('stageRound', 1)
    if (!r.startNewRun(1, false, '1p', 'boy', game.registry)) throw Error('start failed')
    if (!r.saveClear(1, state, 'C') || !r.saveClear(2, state, 'C')) throw Error('setup clear failed')
    r.resumeMain(game.registry)
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key)
    game.scene.start('play')
  })
  await page.waitForFunction(() => { const s = window.__SAKE_GAME__?.scene.getScene('play'); return s?.scene.isActive() && s.stageNo === 3 && s.started && s.boy }, null, { timeout: 45000 })
  await page.waitForTimeout(1500)
  const result = await page.evaluate((failWrite) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.honeyGot = 3; s.deaths = 0; s.boy.hp = 6
    const expected = s.clearRank(6, 6)
    const original = Storage.prototype.setItem
    if (failWrite) Storage.prototype.setItem = function(k, v) { if (k === 'sake-kuma-run-v1') throw Error('injected quota'); return original.call(this, k, v) }
    s.win()
    const firstSaved = JSON.parse(localStorage.getItem('sake-kuma-run-v1'))
    const firstWarning = document.querySelector('#save-warning')?.textContent
    let blockedNext = null
    if (failWrite) {
      s.tallyDone = true
      s.clearSel = s.clearBtns.findIndex(b => b.id === 'next')
      s.clearCardAction()
      blockedNext = !s.registry.get('leavingToMenu') && s.scene.isActive()
      Storage.prototype.setItem = original
      s.saveCurrentClear()
    }
    const saved = JSON.parse(localStorage.getItem('sake-kuma-run-v1'))
    const shownRank = s.clearResultRank
    const rankText = s.clearOverlay.list.filter(x => x.text === shownRank).map(x => x.text)
    s.boy.hp = 1
    s.saveCurrentClear()
    s.win()
    const replayed = JSON.parse(localStorage.getItem('sake-kuma-run-v1'))
    return { expected, firstSaved, firstWarning, blockedNext, saved, shownRank, rankText, replayed, warning: document.querySelector('#save-warning')?.textContent, purse: s.purse, coins: s.coinStock, friends: s.registry.get('runFriends') }
  }, failWrite)
  console.log('DIAGNOSTIC', JSON.stringify(result))
  if (failWrite) { assert.equal(result.firstSaved.nextStage, 3); assert.match(result.firstWarning, /儲存失敗/); assert.equal(result.blockedNext, true) }
  assert.equal(result.expected, 'S'); assert.equal(result.shownRank, result.expected); assert.ok(result.rankText.includes('S'))
  assert.equal(result.saved.nextStage, 4); assert.equal(result.saved.growth.branches[0].awards['3'], 'S')
  assert.equal(result.saved.growth.branches[0].heroes.boy.earned, 8); assert.equal(result.saved.growth.branches[0].heroes.girl.earned, 8)
  assert.deepEqual(result.saved.growth, result.replayed.growth)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${out}/desktop-injected-${name}.png`, scale: 'css' })
  assert.deepEqual(report.errors, [])
  report.result = { stage: 3, injectedWriteFailure: failWrite, blockedNext: result.blockedNext, expected: result.expected, shown: result.shownRank, nextStage: result.saved.nextStage, award: result.saved.growth.branches[0].awards['3'], boy: 8, girl: 8, afterRepeatedWin: result.replayed.growth.branches[0].heroes.boy.earned }
  report.passed = true
  console.log('PASS injected real GameScene.win()', JSON.stringify(report.result))
} catch (e) { report.error = e.stack ?? String(e); console.error(report.error); await page.screenshot({ path: `${out}/desktop-injected-${name}-failure.png` }).catch(() => {}) }
finally { fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(report, null, 2) + '\n'); await browser.close() }
if (!report.passed) process.exitCode = 1
