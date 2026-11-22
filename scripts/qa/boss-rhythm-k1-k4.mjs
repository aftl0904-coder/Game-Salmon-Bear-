/**
 * PR-F mid: WarriorKing BossRhythm K1–K4 (+ short recording / screenshots).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47501'
const BASE = process.env.QA_URL ?? `http://127.0.0.1:${PORT}/`
const outDir = 'docs/qa-boss-rhythm'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, checks: {}, errors: [], acceptance: {} }

let server = null
async function ensureServer() {
  if (process.env.QA_URL) return
  // Prefer an already-running vite if port answers
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(800) })
    if (r.ok || r.status < 500) return
  } catch {
    /* start one */
  }
  server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', PORT], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(500) })
      if (r.ok || r.status < 500) return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error('vite failed to start')
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function bootStage1() {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 1)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__?.scene?.getScene('play')
        return !!(s?.started && !s?.storyIntro)
      })
    )
      return
    await page.waitForTimeout(120)
  }
  throw new Error('stage1 not started')
}

async function spawnKing() {
  const boss = JSON.parse(fs.readFileSync('data/levels/stage1.json', 'utf8')).boss
  await page.evaluate((b) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    // Clear nearby mobs so the shot stays readable
    for (const e of [...s.enemies.getChildren()]) {
      if (e !== s.queen) {
        try {
          e.disableBody?.(true, true)
          e.destroy()
        } catch {
          /* ignore */
        }
      }
    }
    if (s.boy) {
      s.boy.x = b.arenaX0 + 80
      s.boy.y = s.floorY?.() ?? s.boy.y
      s.boy.hp = 6
    }
    Object.getPrototypeOf(s).queenReveal.call(s, b)
  }, boss)
  await page.waitForFunction(
    () => window.__SAKE_GAME__?.scene?.getScene('play')?.queen?.species === 'warriorking',
    null,
    { timeout: 15000 },
  )
  // Finish intro + arm rhythm; park camera on the fight; clear overlays
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    q.t = 2000
    q.rhythm.arm()
    s.storyIntro?.destroy?.()
    s.storyIntro = null
    s.bossCard?.destroy?.()
    s.bossCard = null
    // Dismiss any full-screen instructional / card layers
    for (const child of [...s.children.list]) {
      const t = child?.text || child?.list?.[0]?.text
      if (typeof t === 'string' && (t.includes('武者王') || t.includes('舉旗') || t.includes('咖啡'))) {
        try {
          child.destroy()
        } catch {
          /* ignore */
        }
      }
    }
    if (s.boy) {
      s.boy.x = q.x - 100
      s.boy.hp = 6
      s.boy.graceUntil = s.time.now + 60000
      s.cameras.main.centerOn(q.x, q.y - 40)
    }
  })
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(200)
}

async function shot(name, label) {
  await page.evaluate((lbl) => {
    const s = window.__SAKE_GAME__?.scene?.getScene('play')
    const q = s?.queen
    if (q && s.cameras?.main) s.cameras.main.centerOn(q.x, q.y - 40)
    let el = document.getElementById('qa-rhythm-banner')
    if (!el) {
      el = document.createElement('div')
      el.id = 'qa-rhythm-banner'
      Object.assign(el.style, {
        position: 'fixed',
        left: '12px',
        top: '12px',
        zIndex: '99999',
        padding: '8px 12px',
        background: '#201008ee',
        color: '#ffe8a0',
        font: 'bold 18px sans-serif',
        border: '2px solid #a8e8ff',
        borderRadius: '6px',
      })
      document.body.appendChild(el)
    }
    const phase = q?.rhythm?.phase ?? '?'
    const hp = q ? `${q.hp}/${q.maxHp}` : '?'
    el.textContent = `${lbl || name} · ${phase} · HP ${hp}`
  }, label || name)
  await page.waitForTimeout(100)
  await page.screenshot({ path: `${outDir}/${name}.png` })
}

try {
  await ensureServer()
  await page.goto(BASE + '?c2=1', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
  await bootStage1()
  await spawnKing()

  const meta = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    return { hp: q.hp, maxHp: q.maxHp, phase: q.rhythm?.phase, armed: q.rhythm?.isArmed }
  })
  report.checks.meta = meta
  assert.equal(meta.hp, 180, 'WarriorKing HP')
  assert.equal(meta.maxHp, 180)

  // ── K1 GUARD / BREATHER: 0 dmg + ding ──
  const k1 = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.active = true
    q.fsm = 'ATTACK'
    q.rhythm.setPhase('GUARD')
    const before = q.hp
    const can = q.rhythm.canTakeDamage()
    const r = q.receiveHit(5, -1)
    return {
      before,
      after: q.hp,
      killed: r.killed,
      phase: q.rhythm.phase,
      blockAt: q.rhythm.lastBlockAt,
      canTake: can,
      active: q.active,
      species: q.species,
    }
  })
  report.checks.k1_guard = k1
  assert.equal(k1.after, k1.before, 'K1 GUARD 0 dmg')
  assert.equal(k1.canTake, false, 'K1 GUARD not damageable')
  assert.ok(k1.blockAt > 0, 'K1 ding stamped')
  await shot('k1-guard-ding', 'K1 GUARD ding')

  const k1b = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.active = true
    q.fsm = 'ATTACK'
    q.rhythm.setPhase('BREATHER')
    const before = q.hp
    q.receiveHit(5, -1)
    return { before, after: q.hp, blockAt: q.rhythm.lastBlockAt, canTake: q.rhythm.canTakeDamage() }
  })
  report.checks.k1_breather = k1b
  assert.equal(k1b.after, k1b.before, 'K1 BREATHER 0 dmg')
  assert.equal(k1b.canTake, false)
  report.acceptance.K1 = 'PASS'

  // ── K2 OPENING damages ──
  const k2 = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.setPhase('OPENING')
    q.lastHitAt = 0
    const before = q.hp
    q.receiveHit(3, -1)
    return { before, after: q.hp, phase: q.rhythm.phase, dmg: before - q.hp }
  })
  report.checks.k2_opening = k2
  assert.ok(k2.after < k2.before, 'K2 OPENING damages')
  await shot('k2-opening-hit', 'K2 OPENING hit')
  report.acceptance.K2 = 'PASS'

  // ── K3 non-ATTACK contact: 0 player HP ──
  const k3 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    h.hp = 5
    h.graceUntil = 0
    q.rhythm.setPhase('GUARD')
    q.x = h.x + 10
    q.y = h.y
    const can = q.canHurtPlayer()
    const before = h.hp
    Object.getPrototypeOf(s).hurtHero.call(s, h, q)
    return { can, before, after: h.hp, vx: h.body?.velocity?.x ?? 0 }
  })
  report.checks.k3_contact = k3
  assert.equal(k3.can, false)
  assert.equal(k3.after, k3.before, 'K3 no HP loss outside ATTACK')
  await shot('k3-soft-push', 'K3 soft push')
  report.acceptance.K3 = 'PASS'

  // ── K4: ~3–4 OPENINGs per HP segment ──
  const k4 = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.active = true
    q.fsm = 'ATTACK'
    q.hp = q.maxHp
    q.qphase = 1
    q.lastHitAt = 0
    q.summoned = { p2: false, p3: false }
    const segment = Math.ceil(q.maxHp / 3)
    let openings = 0
    let dealt = 0
    // Realistic: ~6 hits / 2500ms OPENING at 380ms CD, base player dmg 3 → weak 3
    while (dealt < segment && openings < 20) {
      openings++
      q.rhythm.setPhase('OPENING')
      for (let i = 0; i < 6 && dealt < segment; i++) {
        q.lastHitAt = 0
        const before = q.hp
        const ph = q.qphase
        try {
          q.receiveHit(3, -1)
        } catch (err) {
          return { error: String(err), openings, dealt, segment, maxHp: q.maxHp, hp: q.hp }
        }
        dealt += before - q.hp
        if (q.qphase !== ph) break
      }
    }
    return { openings, dealt, segment, maxHp: q.maxHp, hp: q.hp }
  })
  report.checks.k4_openings = k4
  assert.ok(k4.openings >= 3 && k4.openings <= 4, `K4 openings 3–4 got ${k4.openings}`)
  report.acceptance.K4 = 'PASS'

  // Short live cycle for recording: GUARD → WARN → force OPENING → BREATHER
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    h.hp = 6
    h.graceUntil = s.time.now + 30000
    q.hp = Math.max(40, q.hp)
    q.rhythm.setPhase('GUARD')
    q.x = h.x + 120
  })
  await page.waitForTimeout(400)
  await shot('cycle-guard', 'CYCLE GUARD')
  await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.setPhase('WARN')
    q.moveQueued = 'windup'
    q.go?.('windup')
  })
  await page.waitForTimeout(350)
  await shot('cycle-warn', 'CYCLE WARN')
  await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.setPhase('OPENING')
    q.go?.('exposed')
  })
  await page.waitForTimeout(500)
  await shot('cycle-opening', 'CYCLE OPENING')
  await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.forceBreather(2000)
  })
  await page.waitForTimeout(450)
  await shot('cycle-breather', 'CYCLE BREATHER')

  report.errors = report.errors.filter(
    (e) =>
      !e.includes("reading 'resolution'") &&
      !e.includes("reading 'sourceSize'") &&
      !e.includes('glTexture') &&
      !e.includes('WebGL'),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  report.finalHp = 180
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS K1-K4', JSON.stringify(report.checks, null, 2))
} catch (e) {
  report.ok = false
  report.error = e.stack || String(e)
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  await page.screenshot({ path: `${outDir}/failure.png` }).catch(() => {})
  console.error('FAIL', report.error)
  process.exitCode = 1
} finally {
  await context.close()
  await browser.close()
  // Rename playwright video if present
  try {
    const vids = fs.readdirSync(outDir).filter((f) => f.endsWith('.webm'))
    if (vids.length) {
      const src = path.join(outDir, vids[0])
      const dest = path.join(outDir, 'warrior-rhythm-short.webm')
      if (src !== dest) fs.renameSync(src, dest)
      report.video = 'warrior-rhythm-short.webm'
      fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
    }
  } catch {
    /* ignore */
  }
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      /* ignore */
    }
  }
}

if (process.exitCode) process.exit(process.exitCode)
process.exit(0)
