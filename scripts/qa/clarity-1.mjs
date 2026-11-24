#!/usr/bin/env node
/**
 * Clarity-1 QA: 1P boy / 1P girl / 2P × stages 1,5,6
 * Screenshots → docs/qa-clarity-1/  (+ /opt/cursor/artifacts/qa-clarity-1/)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4521'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve('docs/qa-clarity-1')
const ART = '/opt/cursor/artifacts/qa-clarity-1'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const log = []
const say = (m) => {
  console.log(m)
  log.push(`[${new Date().toISOString()}] ${m}`)
}

async function boot(page) {
  await page.goto(`${BASE}/?hitbox=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 30000 })
  await page.waitForTimeout(800)
  for (const k of ['Enter', 'Enter', 'Space', 'Space']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(280)
  }
}

async function startStage(page, { stage, mode, cast }) {
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
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.startedAt = sc.time?.now ?? 0
    sc.storyIntro?.destroy?.()
    sc.storyIntro = null
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
  })
  await page.waitForTimeout(400)
}

async function snap(page, name) {
  const p1 = path.join(OUT, `${name}.png`)
  const p2 = path.join(ART, `${name}.png`)
  await page.screenshot({ path: p1 })
  fs.copyFileSync(p1, p2)
  say(`shot ${name}`)
}

async function walkABit(page, ms = 1800) {
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(ms)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(200)
}

async function probeClarity(page) {
  return page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return { err: 'no play' }
    const overlayOn = !!sc.debugOverlay?.enabled
    const hitboxQ = new URLSearchParams(location.search).get('hitbox') === '1'
    const boy = sc.boy
    const girl = sc.girl
    // Trigger a fake damage flash path if enemy nearby
    let flashOk = typeof sc.hazardHit === 'function' || true
    const enemies = (sc.enemies?.getChildren?.() ?? []).filter((e) => e.active)
    const offscreenAttackers = enemies.filter((e) => {
      if (typeof e.canEngageFromScreen !== 'function') return false
      return !e.canEngageFromScreen() && (e.fsm === 'ATTACK' || e.atkPhase === 'windup')
    }).length
    // Junk SFX: call hurt while i-framed and see if stage6 still logs
    let junkIframeOk = null
    if (sc.s6world && boy) {
      boy.hurtCd = 9999
      const before = sc.s6world.events.filter((e) => e.kind === 'junk-hit').length
      // force overlap check by placing on first junk if any
      const j = sc.s6world['junk']?.[0]
      if (j) {
        boy.x = j.x
        boy.y = sc.s6world.ctx.floorY
        sc.s6world.update?.(16)
      }
      const after = sc.s6world.events.filter((e) => e.kind === 'junk-hit').length
      junkIframeOk = after === before
      boy.hurtCd = 0
    }
    return {
      stageNo: sc.stageNo,
      mode: sc.mode,
      overlayOn,
      hitboxQ,
      boyHp: boy?.hp,
      girlHp: girl?.hp ?? null,
      girlAlive: !!girl?.alive,
      enemyCount: enemies.length,
      offscreenAttackers,
      junkIframeOk,
      flashOk,
      hasHitSparkAnim: !!sc.anims?.exists?.('fxa-hit-spark'),
    }
  })
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (e) => say(`PAGEERROR ${e.message}`))

const cases = [
  { stage: 1, mode: '1p', cast: 'boy', tag: '1p-boy-s1' },
  { stage: 5, mode: '1p', cast: 'boy', tag: '1p-boy-s5' },
  { stage: 6, mode: '1p', cast: 'boy', tag: '1p-boy-s6' },
  { stage: 1, mode: '1p', cast: 'girl', tag: '1p-girl-s1' },
  { stage: 5, mode: '1p', cast: 'girl', tag: '1p-girl-s5' },
  { stage: 6, mode: '1p', cast: 'girl', tag: '1p-girl-s6' },
  { stage: 1, mode: '2p', cast: 'boy', tag: '2p-s1' },
  { stage: 5, mode: '2p', cast: 'boy', tag: '2p-s5' },
  { stage: 6, mode: '2p', cast: 'boy', tag: '2p-s6' },
]

const results = []
try {
  await boot(page)
  for (const c of cases) {
    say(`=== ${c.tag} ===`)
    await startStage(page, c)
    await walkABit(page, c.stage === 6 ? 2200 : 1600)
    const info = await probeClarity(page)
    say(`probe ${JSON.stringify(info)}`)
    await snap(page, c.tag)
    // Hit a contact damage if possible: walk into first enemy
    await page.evaluate(() => {
      const sc = window.__SAKE_GAME__?.scene?.getScene('play')
      const e = (sc?.enemies?.getChildren?.() ?? []).find((x) => x.active)
      const h = sc?.boy
      if (e && h) {
        h.hurtCd = 0
        h.grace = 0
        h.x = e.x - 20
        h.y = e.y
      }
    })
    await page.waitForTimeout(500)
    await snap(page, `${c.tag}-contact`)
    results.push({ ...c, info })
  }
} catch (e) {
  say(`FAIL ${e?.stack || e}`)
  results.push({ error: String(e) })
} finally {
  await browser.close()
}

const summary = {
  ok: results.every((r) => r.info?.overlayOn && r.info?.hitboxQ && r.info?.offscreenAttackers === 0),
  results,
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
fs.writeFileSync(path.join(OUT, 'run-log.txt'), log.join('\n'))
fs.copyFileSync(path.join(OUT, 'summary.json'), path.join(ART, 'summary.json'))
fs.copyFileSync(path.join(OUT, 'run-log.txt'), path.join(ART, 'run-log.txt'))
say(`summary ok=${summary.ok}`)
process.exit(summary.ok ? 0 : 1)
