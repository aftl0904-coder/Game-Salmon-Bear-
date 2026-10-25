#!/usr/bin/env node
/**
 * Stage 1 QA — single-lane: crouch hitbox + variable jump (from data/characters.json).
 * Story intro is force-finished (keyboard A↔Phaser JustDown unreliable in headless).
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
  await page.mouse.click(640, 360)
  await page.waitForTimeout(400)

  // Force gameplay start — note in report (story A-skip 未能穩定實測於 headless)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
  })
  say('force-started play (story A-skip: 未能實測 headless JustDown)')
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(OUT, '01_play_start.png') })

  const standing = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    const b = sc?.boy
    return {
      bodyH: b?.body?.height,
      bodyW: b?.body?.width,
      crouching: !!b?.crouching,
      moveSpeed: b?.moveSpeed,
      lane: b?.lane,
      gravity: sc?.physics?.world?.gravity?.y,
      game: { w: window.__SAKE_GAME__?.scale?.width, h: window.__SAKE_GAME__?.scale?.height },
    }
  })
  say(`standing ${JSON.stringify(standing)}`)

  // Crouch via player API (authoritative) + screenshot
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    const b = sc?.boy
    if (!b) return
    b.snapToLane(0, b.x)
    b.updatePlayer(16, {
      left: false, right: false, jumpJust: false, jumpHeld: false,
      attackJust: false, crouchHeld: true, now: sc.time.now,
    })
  })
  const crouched = await page.evaluate(() => {
    const b = window.__SAKE_GAME__?.scene?.getScene('play')?.boy
    return { bodyH: b?.body?.height, bodyW: b?.body?.width, crouching: !!b?.crouching }
  })
  say(`crouch ${JSON.stringify(crouched)}`)
  await page.screenshot({ path: path.join(OUT, '02_crouch.png') })

  // Uncrouch + reset feet
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    const b = sc?.boy
    if (!b) return
    b.updatePlayer(16, {
      left: false, right: false, jumpJust: false, jumpHeld: false,
      attackJust: false, crouchHeld: false, now: sc.time.now,
    })
    b.snapToLane(0, b.x)
  })

  const measureJump = async (holdMs) => {
    return page.evaluate((hold) => {
      const sc = window.__SAKE_GAME__?.scene?.getScene('play')
      const b = sc?.boy
      if (!b || !sc) return { error: 'no boy' }
      b.snapToLane(0, b.x)
      const startY = b.y
      let minY = startY
      let t = 0
      b.updatePlayer(16, {
        left: false, right: false, jumpJust: true, jumpHeld: true,
        attackJust: false, crouchHeld: false, now: sc.time.now,
      })
      for (let i = 0; i < 150; i++) {
        t += 16
        const held = t <= hold
        sc.physics.world.integrateVelocity?.(b.body, 16 / 1000)
        // Manual integrate: Arcade step
        const body = b.body
        if (body.allowGravity) {
          const g = sc.physics.world.gravity.y + (body.gravity?.y || 0)
          body.velocity.y += g * (16 / 1000)
          b.y += body.velocity.y * (16 / 1000)
          body.y = b.y - body.height
        }
        b.updatePlayer(16, {
          left: false, right: false, jumpJust: false, jumpHeld: held,
          attackJust: false, crouchHeld: false, now: sc.time.now + t,
        })
        if (b.y < minY) minY = b.y
        if (!b.laneJumping && i > 4) break
      }
      return {
        startY,
        minY,
        heightPx: Math.round(startY - minY),
        holdMs: hold,
      }
    }, holdMs)
  }

  const tapJump = await measureJump(16)
  say(`tapJump ${JSON.stringify(tapJump)}`)
  await page.screenshot({ path: path.join(OUT, '03_after_tap_jump.png') })

  const fullJump = await measureJump(400)
  say(`fullJump ${JSON.stringify(fullJump)}`)
  await page.screenshot({ path: path.join(OUT, '04_after_full_jump.png') })

  const report = {
    ok: true,
    standing,
    crouched,
    tapJump,
    fullJump,
    checks: {
      standingHitbox: standing.bodyH === 24 && standing.bodyW === 12,
      crouchHitbox: crouched.bodyH === 14 && crouched.crouching === true,
      moveSpeed: standing.moveSpeed === 100,
      gravity: standing.gravity === 700,
      singleLane: standing.lane === 0,
      tapHeight: tapJump.heightPx >= 18 && tapJump.heightPx <= 32,
      fullHeight: fullJump.heightPx >= 40 && fullJump.heightPx <= 58,
    },
    notes: [
      'Story intro A-skip：headless 下 Phaser JustDown 未能實測，改 force started=true',
    ],
  }
  const failed = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k)
  if (failed.length) report.notes.push(`failed: ${failed.join(', ')}`)
  report.ok = failed.length === 0

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  say(`REPORT ${JSON.stringify(report, null, 2)}`)
  if (!report.ok) process.exitCode = 1
} catch (e) {
  say(`FAIL ${e?.stack || e}`)
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
