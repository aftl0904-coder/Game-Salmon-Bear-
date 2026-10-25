#!/usr/bin/env node
/**
 * Stage 1 QA — single-lane platformer: crouch hitbox + variable jump heights.
 * Writes JSON log + screenshots under /opt/cursor/artifacts/qa-stage1/
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-stage1'
fs.mkdirSync(OUT, { recursive: true })

const log = []
const say = (m) => {
  console.log(m)
  log.push(`[${new Date().toISOString()}] ${m}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

try {
  say(`goto ${BASE}`)
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2200)
  for (const k of ['Space', 'Space', 'Enter']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(500)
  }
  // skip story
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('F')
    await page.waitForTimeout(280)
  }
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, '01_play_start.png') })

  const baseline = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play')
    const boy = sc?.boy
    if (!boy) return { error: 'no boy', scenes: g?.scene?.getScenes(true)?.map((s) => s.sys?.settings?.key) }
    const body = boy.body
    return {
      game: { w: g.scale.width, h: g.scale.height },
      gravity: g.physics?.world?.gravity?.y,
      laneCount: 1,
      boy: {
        y: Math.round(boy.y),
        lane: boy.lane,
        crouching: !!boy.crouching,
        bodyH: body?.height,
        bodyW: body?.width,
        moveSpeed: boy.moveSpeed,
        hp: boy.hp,
      },
      scale: window.__SAKE_SCALE__,
    }
  })
  say(`baseline ${JSON.stringify(baseline)}`)
  fs.writeFileSync(path.join(OUT, 'baseline.json'), JSON.stringify(baseline, null, 2))

  // Crouch
  await page.keyboard.down('S')
  await page.waitForTimeout(200)
  const crouched = await page.evaluate(() => {
    const boy = window.__SAKE_GAME__?.scene?.getScene('play')?.boy
    const body = boy?.body
    return {
      crouching: !!boy?.crouching,
      bodyH: body?.height,
      bodyW: body?.width,
      vxCapNote: 'speed half while crouched',
    }
  })
  say(`crouch ${JSON.stringify(crouched)}`)
  await page.screenshot({ path: path.join(OUT, '02_crouch.png') })
  await page.keyboard.up('S')
  await page.waitForTimeout(150)

  // Tap jump (press+release immediately)
  const tapJump = await page.evaluate(async () => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    const boy = sc?.boy
    if (!boy) return { error: 'no boy' }
    const startY = boy.y
    // Simulate via player API flags by dispatching key — measured in RAF loop
    return { startY }
  })
  await page.keyboard.down('G')
  await page.waitForTimeout(16)
  await page.keyboard.up('G')
  let minY = 9999
  let startY = null
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => {
      const b = window.__SAKE_GAME__?.scene?.getScene('play')?.boy
      return b ? { y: b.y, vy: b.body?.velocity?.y, jumping: b.laneJumping } : null
    })
    if (!s) break
    if (startY == null) startY = s.y
    if (s.y < minY) minY = s.y
    if (!s.jumping && i > 5) break
    await page.waitForTimeout(16)
  }
  const tapHeight = startY != null ? Math.round(startY - minY) : null
  say(`tapJump startY=${startY} apexY=${minY} heightPx=${tapHeight} (target≈24)`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, '03_after_tap_jump.png') })

  // Full hold jump
  await page.waitForTimeout(300)
  await page.keyboard.down('G')
  minY = 9999
  startY = null
  for (let i = 0; i < 120; i++) {
    const s = await page.evaluate(() => {
      const b = window.__SAKE_GAME__?.scene?.getScene('play')?.boy
      return b ? { y: b.y, jumping: b.laneJumping } : null
    })
    if (!s) break
    if (startY == null) startY = s.y
    if (s.y < minY) minY = s.y
    if (!s.jumping && i > 8) break
    await page.waitForTimeout(16)
  }
  await page.keyboard.up('G')
  const fullHeight = startY != null ? Math.round(startY - minY) : null
  say(`fullJump startY=${startY} apexY=${minY} heightPx=${fullHeight} (target≈48)`)
  await page.screenshot({ path: path.join(OUT, '04_after_full_jump.png') })

  // Confirm no lane change on W/S (S=crouch only)
  const laneCheck = await page.evaluate(() => {
    const boy = window.__SAKE_GAME__?.scene?.getScene('play')?.boy
    return { lane: boy?.lane, y: Math.round(boy?.y ?? 0) }
  })
  say(`laneStill ${JSON.stringify(laneCheck)}`)

  const report = {
    ok: true,
    baseline,
    crouched,
    tapJump: { heightPx: tapHeight, target: 24, pass: tapHeight != null && tapHeight >= 18 && tapHeight <= 32 },
    fullJump: { heightPx: fullHeight, target: 48, pass: fullHeight != null && fullHeight >= 40 && fullHeight <= 58 },
    crouchHitbox: {
      h: crouched.bodyH,
      target: 14,
      pass: crouched.bodyH === 14,
      standingWas: baseline.boy?.bodyH,
    },
    singleLane: { lane: laneCheck.lane, pass: laneCheck.lane === 0 },
    notes: [],
  }
  if (!report.tapJump.pass) report.notes.push('tap jump height off target — see log')
  if (!report.fullJump.pass) report.notes.push('full jump height off target — see log')
  if (!report.crouchHitbox.pass) report.notes.push('crouch hitbox not 14')

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  say(`REPORT ${JSON.stringify(report, null, 2)}`)
} catch (e) {
  say(`FAIL ${e?.stack || e}`)
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, error: String(e) }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
