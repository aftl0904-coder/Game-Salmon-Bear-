import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.QA_PORT || '47461'
const out = 'docs/qa-c2-entry'
fs.mkdirSync(out, { recursive: true })
const report = { step: 'reproduce-on-main', modes: {} }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] })

async function repro(mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const r = { mode, errors: [] }
  page.on('pageerror', e => r.errors.push(String(e.message)))
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  // New save: clear storage then fresh C2 run on stage 6
  await page.evaluate((m) => {
    localStorage.clear()
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', m)
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.registry.set('winScreenShown', false)
    g.registry.set('leavingToMenu', false)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, mode)
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.keyboard.press('KeyF')
    const ok = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })
    if (ok) break
    await page.waitForTimeout(100)
  }
  // Trigger win() helper
  const before = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    Object.getPrototypeOf(s).win.call(s)
    return {
      stageNo: s.stageNo,
      ended: s.ended,
      ls: { ...localStorage },
    }
  })
  r.afterWin = {
    stageNo: before.stageNo,
    ended: before.ended,
    maxStage: (() => { try { return JSON.parse(before.ls['sake-kuma-progress'] || before.ls['gs-progress'] || '{}') } catch { return before.ls } })(),
    runKeys: Object.keys(before.ls).filter(k => /run|sake|gs/i.test(k)),
    storageDump: Object.fromEntries(Object.entries(before.ls).filter(([k]) => /run|progress|sake|gs|max/i.test(k)).map(([k,v]) => [k, String(v).slice(0, 400)])),
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/repro-${mode}-after-win.png` })

  // Click next-stage button if present (大陸2・第二關)
  const clicked = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const btns = s.clearBtns || []
    const next = btns.find(b => /第二關|下一關|繼續/.test(b.tx?.text || b.id || '')) || btns.find(b => b.id === 'next' || b.id === 'continue' || b.id === 'go')
    if (next) {
      // invoke leaveBy via selecting
      const leave = Object.getPrototypeOf(s)
      // try goNextStage directly if button wiring unknown
      if (typeof leave.goNextStage === 'function') { leave.goNextStage.call(s); return { via: 'goNextStage', id: next.id, text: next.tx?.text } }
    }
    if (typeof Object.getPrototypeOf(s).goNextStage === 'function') {
      Object.getPrototypeOf(s).goNextStage.call(s)
      return { via: 'goNextStage-fallback' }
    }
    return { via: 'none', btnIds: btns.map(b => ({ id: b.id, text: b.tx?.text })) }
  })
  r.clicked = clicked
  await page.waitForTimeout(1500)
  const afterNext = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const scenes = g.scene.getScenes(true).map(s => s.scene.key)
    const play = g.scene.getScene('play')
    const map = g.scene.getScene('worldmap')
    const ls = { ...localStorage }
    let run = null
    for (const [k,v] of Object.entries(ls)) {
      if (/run/i.test(k)) { try { run = JSON.parse(v) } catch {} }
    }
    let progress = null
    for (const [k,v] of Object.entries(ls)) {
      if (/progress|maxStage/i.test(k) || k.includes('progress')) { try { progress = JSON.parse(v) } catch { progress = v } }
    }
    return {
      scenes,
      playStage: play?.stageNo ?? null,
      playStarted: play?.started ?? null,
      mapOpen: map?.openStages ?? null,
      pickIndex: map?.pickIndex ?? null,
      run,
      progress,
      registryStage: g.registry.get('stageNo'),
    }
  })
  r.afterNext = afterNext
  await page.screenshot({ path: `${out}/repro-${mode}-after-next.png` })

  // Try confirm pick on worldmap if stuck
  await page.evaluate(() => {
    const map = window.__SAKE_GAME__?.scene?.getScene('worldmap')
    if (!map) return
    const proto = Object.getPrototypeOf(map)
    if (typeof proto.confirmPick === 'function') {
      try { proto.confirmPick.call(map, 7) } catch (e) { try { proto.confirmPick.call(map) } catch {} }
    }
  })
  await page.waitForTimeout(2000)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  await page.waitForTimeout(2000)
  const final = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const play = g.scene.getScene('play')
    return {
      scenes: g.scene.getScenes(true).map(s => s.scene.key),
      stageNo: play?.stageNo ?? null,
      exhibit: play?.exhibit ?? null,
      started: play?.started ?? null,
      registryStage: g.registry.get('stageNo'),
      ls: Object.fromEntries(Object.entries({...localStorage}).filter(([k]) => /run|progress|sake|gs/i.test(k)).map(([k,v]) => [k, String(v).slice(0,500)])),
    }
  })
  r.final = final
  await page.screenshot({ path: `${out}/repro-${mode}-final.png` })
  await page.close()
  return r
}

report.modes['1p'] = await repro('1p')
report.modes['2p'] = await repro('2p')
fs.writeFileSync(`${out}/reproduce-main.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
