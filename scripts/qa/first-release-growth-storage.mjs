// Browser localStorage integration with injected events/fixtures. Not a natural playthrough or growth UI.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47947/'
const out = process.env.QA_OUT ?? 'docs/qa-first-release-growth/storage-20261104'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext()
const page = await context.newPage()
const report = { scope: 'real browser localStorage and production modules; clear events, legacy saves and source-switch fixtures injected; no growth UI', checks: [], errors: [], passed: false }
page.on('pageerror', e => report.errors.push(e.message))
try {
  await page.goto(base)
  const matrix = await page.evaluate(async () => {
    const results = []
    for (const stage of [3, 5, 7]) for (const [rank, points] of Object.entries({ S: 3, A: 2, B: 1, C: 0 })) {
      localStorage.removeItem('sake-kuma-run-v1')
      const r = await import(`/src/game/run.ts?matrix=${stage}${rank}`)
      const reg = { set() {} }, state = { coins: 10, purse: { boy: 10 }, hp: { boy: 4 }, friends: [] }
      if (!r.startNewRun(1, false, '1p', 'boy', reg)) throw Error('new run failed')
      for (let i = 1; i <= stage; i++) if (!r.saveClear(i, state, i === stage ? rank : 'C')) throw Error('clear failed ' + i)
      const before = JSON.parse(localStorage.getItem('sake-kuma-run-v1'))
      for (let i = 0; i < 1000; i++) if (!r.saveClear(stage, state, 'S')) throw Error('replay failed')
      const after = JSON.parse(localStorage.getItem('sake-kuma-run-v1'))
      const branch = after.growth.branches.at(-1)
      results.push({ stage, rank, points, before: before.growth, after: after.growth, boy: branch.heroes.boy.earned, girl: branch.heroes.girl.earned, award: branch.awards[stage] })
    }
    return results
  })
  for (const row of matrix) {
    assert.equal(row.boy, 5 + row.points); assert.equal(row.girl, 5 + row.points)
    assert.equal(row.award, row.rank); assert.deepEqual(row.after, row.before)
  }
  report.checks.push('12 browser-storage rank matrix cases, both heroes and 1000 same-stage event replays per case')
  const side = await page.evaluate(async () => {
    localStorage.removeItem('sake-kuma-run-v1')
    const r = await import('/src/game/run.ts?side-case'), reg = { set() {} }
    const s = { coins: 5, purse: { boy: 5 }, hp: { boy: 3 }, friends: [] }
    r.startNewRun(1, false, '1p', 'boy', reg); r.saveClear(1, s, 'C')
    const before = localStorage.getItem('sake-kuma-run-v1')
    r.startSideTrip(reg); r.saveClear(2, s, 'S'); r.saveClear(3, s, 'S')
    const after = localStorage.getItem('sake-kuma-run-v1')
    const restored = r.resumeMain(reg)
    return { before, after, next: restored.nextStage }
  })
  assert.equal(side.before, side.after); assert.equal(side.next, 2)
  report.checks.push('side-trip injected clear leaves canonical bytes untouched; resume main')
  const legacy = await page.evaluate(async () => {
    const key = 'sake-kuma-run-v1', gear = { boy: { heart: 0, sword: 0, gun: 2, armour: 0, boots: 0, charm: 0 }, girl: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 } }
    const fixture = JSON.stringify({ version: 1, runId: 'legacy-test', startStage: 1, lastCleared: 3, nextStage: 4, gear, growth: {}, eligible: true, friends: [], charm: null, mode: '1p', solo: 'boy' }, null, 2)
    localStorage.setItem(key, fixture)
    const r = await import('/src/game/run.ts?legacy-ok')
    const loaded = r.getRun(), saved = JSON.parse(localStorage.getItem(key))
    return { fixture, loaded, saved }
  })
  assert.equal(legacy.saved.version, 2); assert.equal(legacy.saved.legacyRaw, legacy.fixture)
  assert.equal(legacy.loaded.growth.branches[0].heroes.boy.earned, 0)
  assert.equal(legacy.loaded.growth.branches[0].rewardFrom, 4); assert.equal(legacy.loaded.eligible, true)
  report.checks.push('valid v1 empty-growth migration: exact raw retained inside v2, zero retroactive points, same eligibility')
  const failures = await page.evaluate(async () => {
    const key = 'sake-kuma-run-v1'
    const gear = { boy: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }, girl: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 } }
    const old = { version: 1, runId: 'old', startStage: 1, lastCleared: 0, nextStage: 1, gear, growth: {}, eligible: true, friends: [], charm: null, mode: '1p', solo: 'boy' }
    const fixtures = ['{bad', JSON.stringify({ ...old, growth: { hp: 9 } }), JSON.stringify({ ...old, future: 'unknown' }), JSON.stringify({ ...old, gear: {} })]
    const results = []
    for (let i = 0; i < fixtures.length; i++) {
      localStorage.setItem(key, fixtures[i])
      const r = await import(`/src/game/run.ts?bad=${i}`)
      const loaded = r.getRun(), started = r.startNewRun(1, false, '1p', 'boy', { set() {} })
      results.push({ loaded, started, before: fixtures[i], after: localStorage.getItem(key), warning: document.querySelector('#save-warning')?.textContent })
    }
    localStorage.setItem(key, JSON.stringify(old))
    const beforeMigration = localStorage.getItem(key), original = Storage.prototype.setItem
    Storage.prototype.setItem = function(k, v) { if (k === key) throw Error('injected quota'); return original.call(this, k, v) }
    const r = await import('/src/game/run.ts?migration-failed')
    const migrated = r.getRun(), started = r.startNewRun(1, false, '1p', 'boy', { set() {} })
    Storage.prototype.setItem = original
    return { results, migration: { before: beforeMigration, after: localStorage.getItem(key), migrated, started } }
  })
  for (const item of failures.results) { assert.equal(item.loaded, null); assert.equal(item.started, false); assert.equal(item.before, item.after); assert.match(item.warning, /保留原文/) }
  assert.equal(failures.migration.before, failures.migration.after); assert.equal(failures.migration.migrated, null); assert.equal(failures.migration.started, false)
  report.checks.push('corrupt, unknown v1 growth/fields, invalid gear and injected migration quota failure preserve original bytes and block restart')
  const retry = await page.evaluate(async () => {
    const key = 'sake-kuma-run-v1'; localStorage.removeItem(key)
    const r = await import('/src/game/run.ts?write-retry'), reg = { set() {} }, state = { coins: 10, purse: {}, hp: {}, friends: [] }
    r.startNewRun(1, false, '1p', 'boy', reg); r.saveClear(1, state, 'C'); r.saveClear(2, state, 'C')
    const before = localStorage.getItem(key), original = Storage.prototype.setItem
    Storage.prototype.setItem = function(k, v) { if (k === key) throw Error('injected quota'); return original.call(this, k, v) }
    const result = r.saveClear(3, state, 'S'), inMemory = structuredClone(r.getRun()), after = localStorage.getItem(key), warning = document.querySelector('#save-warning')?.textContent
    Storage.prototype.setItem = original
    const retried = r.saveClear(3, state, 'S'), replay = r.saveClear(3, state, 'S'), saved = JSON.parse(localStorage.getItem(key))
    const restart = r.startNewRun(6, false, '1p', 'boy', reg), afterBlockedRestart = localStorage.getItem(key)
    return { before, after, result, inMemory, warning, retried, replay, saved, restart, afterBlockedRestart }
  })
  assert.equal(retry.result, false); assert.equal(retry.before, retry.after); assert.equal(retry.inMemory.nextStage, 3); assert.match(retry.warning, /儲存失敗/)
  assert.equal(retry.retried, true); assert.equal(retry.replay, true); assert.equal(retry.saved.nextStage, 4)
  assert.equal(retry.saved.growth.branches.at(-1).heroes.boy.earned, 8); assert.equal(retry.saved.growth.branches.at(-1).heroes.girl.earned, 8)
  assert.equal(retry.restart, false); assert.deepEqual(JSON.parse(retry.afterBlockedRestart), retry.saved)
  report.checks.push('injected clear write failure preserves prior snapshot and in-memory stage; retry awards once; old-growth restart blocked')
  const sources = await page.evaluate(async () => {
    const g = await import('/src/game/growth.ts'), key = 'sake-kuma-run-v1'
    let book = g.createGrowthBook('old', 1)
    for (let i=1; i<=5; i++) book = g.advanceGrowthBook(book, i, i === 3 ? 'S' : i === 5 ? 'A' : 'C', 'main')
    book = g.startGrowthBranch(book, 'fresh', 1, null).book
    for (let i=1; i<=3; i++) book = g.advanceGrowthBook(book, i, i === 3 ? 'B' : 'C', 'main')
    book = g.startGrowthBranch(book, 'selected-old', 6, 'old').book
    const gear = { boy: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }, girl: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 } }
    localStorage.setItem(key, JSON.stringify({ version: 2, runId: 'selected-old', startStage: 6, lastCleared: 0, nextStage: 6, gear, growth: book, eligible: false, friends: [], charm: null, mode: '1p', solo: 'boy' }))
    const r = await import('/src/game/run.ts?source-fixture'), saved = r.getRun()
    return { saved, bytes: localStorage.getItem(key) }
  })
  assert.equal(sources.saved.growth.branches[0].heroes.boy.earned, 10)
  assert.equal(sources.saved.growth.branches[1].heroes.boy.earned, 6)
  assert.equal(sources.saved.growth.branches[2].heroes.boy.earned, 10)
  assert.equal(sources.saved.growth.branches[2].sourceId, 'old'); assert.equal(sources.saved.eligible, false)
  assert.equal(JSON.parse(sources.bytes).growth.branches.length, 3)
  report.checks.push('injected source-switch v2 fixture survives actual storage read: old10, fresh6, carry old10 (not 15 or 16), archived provenance intact; no selection UI')
  await page.reload()
  const recovered = await page.evaluate(async () => {
    const r = await import('/src/game/run.ts'), reg = { data: {}, set(k, v) { this.data[k] = v } }
    const run = r.resumeMain(reg)
    return { run, stage: reg.data.stageNo }
  })
  assert.equal(recovered.stage, 6); assert.deepEqual(recovered.run.growth, sources.saved.growth)
  report.checks.push('browser reload and actual resume recover selected-source ledger and expected stage')
  const badV2 = await page.evaluate(async () => {
    const key = 'sake-kuma-run-v1', value = JSON.parse(localStorage.getItem(key))
    value.growth.branches[2].heroes.boy.earned++
    const raw = JSON.stringify(value); localStorage.setItem(key, raw)
    const r = await import('/src/game/run.ts?bad-v2')
    return { loaded: r.getRun(), started: r.startNewRun(1, false, '1p', 'boy', { set() {} }), before: raw, after: localStorage.getItem(key) }
  })
  assert.equal(badV2.loaded, null); assert.equal(badV2.started, false); assert.equal(badV2.before, badV2.after)
  report.checks.push('tampered v2 provenance is rejected and byte-for-byte retained')
  const stale = await page.evaluate(async () => {
    const key = 'sake-kuma-run-v1'; localStorage.removeItem(key)
    const a = await import('/src/game/run.ts?tab=a'), b = await import('/src/game/run.ts?tab=b')
    const reg = { set() {} }, state = { coins: 1, purse: {}, hp: {}, friends: [] }
    a.startNewRun(1, false, '1p', 'boy', reg); b.resumeMain(reg)
    a.saveClear(1, state, 'C'); const before = localStorage.getItem(key)
    const staleResult = b.saveClear(1, state, 'S')
    return { before, after: localStorage.getItem(key), staleResult, warning: document.querySelector('#save-warning')?.textContent }
  })
  assert.equal(stale.staleResult, false); assert.equal(stale.before, stale.after); assert.match(stale.warning, /另一個分頁/)
  report.checks.push('stale sequential writer rejected; simultaneous cross-tab compare/set race not tested or guaranteed')
  assert.deepEqual(report.errors, [])
  report.passed = true
  console.log('PASS', JSON.stringify(report.checks, null, 2))
} catch (e) { report.error = e.stack ?? String(e); console.error(report.error) }
finally { fs.writeFileSync(`${out}/storage.json`, JSON.stringify(report, null, 2) + '\n'); await browser.close() }
if (!report.passed) process.exitCode = 1
