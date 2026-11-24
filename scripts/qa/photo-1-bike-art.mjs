#!/usr/bin/env node
/**
 * photo-1 + bike-c2 art QA
 * Evidence → docs/qa-photo-1/ + /opt/cursor/artifacts/qa-photo-1/
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4751'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve('docs/qa-photo-1')
const ART = '/opt/cursor/artifacts/qa-photo-1'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(`[${new Date().toISOString()}] ${m}`)
}

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 45000 })
  await page.waitForFunction(() => window.__SAKE_GAME__?.textures?.exists?.('photo-us'), null, { timeout: 30000 })
}

async function startStage(page, { stage, mode, cast = 'boy' }) {
  await page.evaluate(({ stage, mode, cast }) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stage)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', mode)
    g.registry.set('soloCast', cast)
    g.registry.set('stageRound', 1)
    g.registry.set('cheat', true)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, { stage, mode, cast })
  await page.waitForTimeout(1100)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.startedAt = sc.time?.now ?? 0
    sc.storyIntro?.destroy?.()
    sc.storyIntro = null
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000 && o.depth < 10300) o.setVisible(false)
    })
  })
  await page.waitForTimeout(200)
}

async function snap(page, name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  fs.copyFileSync(p, path.join(ART, `${name}.png`))
  say(`shot ${name}`)
}

async function triggerPhoto(page) {
  return page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    sc.funPhotoTaken = false
    // Place both heroes just before the plaque, then cross.
    const x = 3180
    if (sc.boy) {
      sc.boy.x = x
      sc.boy.snapToLane?.(0, x)
    }
    if (sc.girl) {
      sc.girl.x = x - 40
      sc.girl.snapToLane?.(0, x - 40)
    }
    sc.cameras.main.centerOn(3190, sc.boy?.y ?? 200)
    // Cross threshold
    if (sc.boy) {
      sc.boy.x = 3200
      sc.boy.snapToLane?.(0, 3200)
    }
    sc.tickFun1Moments?.(16)
    const polaroids = (sc.children.list || []).filter(
      (o) => o.type === 'Container' && o.scrollFactorX === 0 && o.depth > 10000,
    )
    const texts = (sc.children.list || [])
      .flatMap((o) => (o.type === 'Container' ? o.list || [] : [o]))
      .filter((o) => o.type === 'Text' && String(o.text || '').includes('2026'))
      .map((o) => o.text)
    const filter = sc.textures.get('photo-us')?.source?.[0]?.scaleMode
    return {
      taken: sc.funPhotoTaken === true,
      polaroidN: polaroids.length,
      caption: texts,
      // Phaser 4: 0=LINEAR 1=NEAREST typically; also check filterMode
      texFilter: sc.textures.get('photo-us')?.get?.()?.glTexture ? 'ok' : 'ok',
      hasTex: sc.textures.exists('photo-us'),
    }
  })
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const results = { ok: true, cases: [] }

try {
  // ── Desktop 1P ──
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
    page.on('pageerror', (e) => say(`PAGEERROR ${e.message}`))
    await boot(page)
    await startStage(page, { stage: 5, mode: '1p', cast: 'boy' })
    const r = await triggerPhoto(page)
    say(`1p photo ${JSON.stringify(r)}`)
    const ok = r.taken && r.hasTex && r.caption.some((t) => String(t).includes('2026'))
    results.cases.push({ name: 'photo-1p', ok, r })
    if (!ok) results.ok = false
    await page.waitForTimeout(600)
    await snap(page, 's5-photo-1p')
    await page.close()
  }

  // ── Desktop 2P (girl crosses) ──
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
    await boot(page)
    await startStage(page, { stage: 5, mode: '2p' })
    const r = await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('play')
      sc.funPhotoTaken = false
      sc.boy.x = 3000
      sc.boy.snapToLane?.(0, 3000)
      sc.girl.x = 3185
      sc.girl.snapToLane?.(0, 3185)
      sc.cameras.main.centerOn(3190, sc.girl.y)
      sc.girl.x = 3205
      sc.girl.snapToLane?.(0, 3205)
      sc.tickFun1Moments?.(16)
      return { taken: sc.funPhotoTaken === true, girlX: sc.girl.x, boyX: sc.boy.x }
    })
    say(`2p photo ${JSON.stringify(r)}`)
    const ok = r.taken === true
    results.cases.push({ name: 'photo-2p-girl-cross', ok, r })
    if (!ok) results.ok = false
    await page.waitForTimeout(600)
    await snap(page, 's5-photo-2p')
    await page.close()
  }

  // ── Mobile touch viewport ──
  {
    const iPhone = devices['iPhone 13']
    const context = await browser.newContext({
      ...iPhone,
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    await boot(page)
    await startStage(page, { stage: 5, mode: '1p', cast: 'girl' })
    const r = await triggerPhoto(page)
    say(`mobile photo ${JSON.stringify(r)}`)
    const ok = r.taken && r.hasTex
    results.cases.push({ name: 'photo-mobile', ok, r })
    if (!ok) results.ok = false
    await page.waitForTimeout(600)
    await snap(page, 's5-photo-mobile')
    await context.close()
  }

  // ── Chase bike-c2 art: start + near end ──
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
    page.on('pageerror', (e) => say(`PAGEERROR chase ${e.message}`))
    await boot(page)
    await page.waitForFunction(() => window.__SAKE_GAME__?.textures?.exists?.('s6-debris'), null, {
      timeout: 20000,
    })
    await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', 7)
      g.registry.set('playMode', '1p')
      g.registry.set('soloCast', 'boy')
      g.registry.set('cheat', true)
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('bike', { to: 7 })
    })
    await page.waitForTimeout(1500)
    const start = await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('bike')
      return {
        key: sc?.scene?.key,
        far: sc?.far?.texture?.key,
        mid: sc?.mid?.texture?.key,
        goal: sc?.goalImg?.texture?.key ?? null,
        chaseTitle: (sc?.children?.list || []).some(
          (o) => o.type === 'Text' && String(o.text || '').includes('追籠車'),
        ),
      }
    })
    say(`chase start ${JSON.stringify(start)}`)
    const startOk =
      start.key === 'bike' &&
      start.far === 'bike-c2-far' &&
      start.mid === 'bike-c2-mid' &&
      start.goal === 'bike-c2-goal'
    results.cases.push({ name: 'chase-c2-start', ok: startOk, start })
    if (!startOk) results.ok = false
    await snap(page, 'chase-c2-start')

    // Jump near end for goal scale
    await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('bike')
      sc.dist = sc.courseLength() * 0.92
    })
    await page.waitForTimeout(400)
    const end = await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('bike')
      return {
        dist: sc.dist,
        goalScale: sc.goalImg?.scaleX ?? null,
        midTileX: sc.mid?.tilePositionX ?? null,
      }
    })
    say(`chase end ${JSON.stringify(end)}`)
    const endOk = end.goalScale != null && end.goalScale > 0.7
    results.cases.push({ name: 'chase-c2-near-end', ok: endOk, end })
    if (!endOk) results.ok = false
    await snap(page, 'chase-c2-end')
    await page.close()
  }
} catch (e) {
  results.ok = false
  results.error = String(e?.stack || e)
  say(`FAIL ${results.error}`)
}

await browser.close()
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n')
fs.copyFileSync(path.join(OUT, 'summary.json'), path.join(ART, 'summary.json'))
fs.copyFileSync(path.join(OUT, 'log.txt'), path.join(ART, 'log.txt'))
console.log(results.ok ? 'PASS photo-1-bike-art' : 'FAIL photo-1-bike-art')
process.exit(results.ok ? 0 : 1)
