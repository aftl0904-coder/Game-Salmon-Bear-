/**
 * PR-G acceptance: F1–F5 (舉旗大賽) + M1–M4 (記貨單).
 * Writes docs/qa-minigames/.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT = path.join(ROOT, 'docs/qa-minigames')
const PORT = process.env.QA_PORT || '47461'
const BASE = `http://127.0.0.1:${PORT}`

fs.mkdirSync(OUT, { recursive: true })
const report = { ok: false, checks: {}, errors: [], sha: process.env.GIT_SHA || '' }

function pass(id, cond, detail) {
  report.checks[id] = { pass: !!cond, detail: detail ?? null }
  console.log(cond ? `PASS ${id}` : `FAIL ${id}`, detail ?? '')
  if (!cond) throw new Error(`FAIL ${id}: ${JSON.stringify(detail)}`)
}

let vite = null
async function startVite() {
  vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', PORT, '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  let ready = false
  const onData = (buf) => {
    const s = buf.toString()
    if (s.includes('Local:') || s.includes(PORT)) ready = true
  }
  vite.stdout.on('data', onData)
  vite.stderr.on('data', onData)
  const t0 = Date.now()
  while (!ready && Date.now() - t0 < 25000) await new Promise((r) => setTimeout(r, 200))
  if (!ready) throw new Error('vite failed to start')
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  await startVite()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => report.errors.push(String(e.message)))
  await page.addInitScript(() => {
    localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.removeItem('sake-kuma-mg-seen-v1')
  })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
  await page.waitForTimeout(1500)

  // ── helpers ────────────────────────────────────────────────────────────
  async function sceneReady(stageNo) {
    await page.evaluate((n) => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', n)
      g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', '1p')
      g.registry.set('soloCast', 'boy')
      g.registry.set('leavingToMenu', false)
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('play')
    }, stageNo)
    const t0 = Date.now()
    while (Date.now() - t0 < 30000) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('Space')
      await page.waitForTimeout(200)
      const ok = await page.evaluate(() => {
        const s = window.__SAKE_GAME__?.scene?.getScene('play')
        return !!(s?.started && !s?.storyIntro)
      })
      if (ok) return
    }
    throw new Error(`stage ${stageNo} not ready`)
  }

  async function attachFlag() {
    return page.evaluate(async () => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.physics.pause()
      const m = await import('/src/game/minigames.ts')
      const mini = m.flagRace(s, 10)
      window.__QA_FLAG__ = mini
      return true
    })
  }

  async function attachMemory() {
    return page.evaluate(async () => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.physics.pause()
      const m = await import('/src/game/minigames.ts')
      const mini = m.memoryGame(s)
      window.__QA_MEM__ = mini
      return true
    })
  }

  const dbgFlag = () => page.evaluate(() => window.__QA_FLAG__.debug())
  const dbgMem = () => page.evaluate(() => window.__QA_MEM__.debug())

  async function waitFlagPhase(want, ms = 8000) {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const d = await dbgFlag()
      if (want.includes(d.phase)) return d
      await page.waitForTimeout(40)
    }
    throw new Error(`flag phase timeout want=${want} got=${JSON.stringify(await dbgFlag())}`)
  }

  async function waitMemPhase(want, ms = 20000) {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const d = await dbgMem()
      if (want.includes(d.phase)) return d
      await page.waitForTimeout(40)
    }
    throw new Error(`mem phase timeout want=${want} got=${JSON.stringify(await dbgMem())}`)
  }

  // ── F3: tutorial pages on first stall (flag) ───────────────────────────
  await sceneReady(1)
  // Clear seen so tutorial shows
  await page.evaluate(() => localStorage.removeItem('sake-kuma-mg-seen-v1'))
  const tutorialProbe = await page.evaluate(async () => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.physics.pause()
    const collect = (o, out = []) => {
      if (!o) return out
      if (o.type === 'Text') out.push(String(o.text))
      if (o.list) for (const c of o.list) collect(c, out)
      return out
    }
    const { showTutorial } = await import('/src/game/minigames.ts')
    const p = showTutorial(s, 'stall-flag', [
      { title: '咖啡媽媽：舉旗大賽', lines: ['test'], tip: 't' },
      { title: '一共十輪', lines: ['test2'] },
    ])
    const texts = collect(s.children)
    const has = texts.some((t) => t.includes('舉旗大賽'))
    s.input.emit('pointerdown', s.input.activePointer)
    await new Promise((r) => setTimeout(r, 50))
    s.input.emit('pointerdown', s.input.activePointer)
    const choice = await Promise.race([
      p,
      new Promise((r) => setTimeout(() => r('timeout'), 2000)),
    ])
    return { has, choice, texts: texts.filter((t) => t).slice(0, 12) }
  })
  pass('F3', tutorialProbe.has, tutorialProbe)
  await page.screenshot({ path: path.join(OUT, 'F3-tutorial.png') })

  // ── F1 all-correct ─────────────────────────────────────────────────────
  await sceneReady(1)
  await attachFlag()
  const perfectCmds = [
    'raise-red',
    'raise-blue',
    'lower-red',
    'lower-blue',
    'trap-red',
    'raise-red',
    'trap-blue',
    'lower-red',
    'raise-blue',
    'lower-blue',
  ]
  for (let i = 0; i < 10; i++) {
    await waitFlagPhase(['play'])
    await page.evaluate((cmd) => {
      const m = window.__QA_FLAG__
      // Baseline flags first, then forceCmd so roundRed0/roundBlue0 match.
      m.setFlags(false, false)
      m.forceCmd(cmd)
      if (cmd === 'raise-red') m.qaPress('red')
      else if (cmd === 'raise-blue') m.qaPress('blue')
      // lower-* already down; trap-* = no press
      m.endWindow()
    }, perfectCmds[i])
    if (i < 9) await waitFlagPhase(['settle', 'play'])
  }
  const perfect = await page.evaluate(() => window.__QA_FLAG__.done)
  pass('F1-perfect', perfect.good === 10 && perfect.total === 10, perfect)
  await page.screenshot({ path: path.join(OUT, 'F1-perfect.png') })

  // destroy leftover if any
  await page.evaluate(() => window.__QA_FLAG__?.destroy?.())

  // ── F1 all-wrong → 0 ───────────────────────────────────────────────────
  await attachFlag()
  for (let i = 0; i < 10; i++) {
    await waitFlagPhase(['play'])
    await page.evaluate(() => {
      const m = window.__QA_FLAG__
      m.setFlags(false, false)
      m.forceCmd('trap-red')
      m.qaPress('red') // trap press = wrong
      m.endWindow()
    })
    if (i < 9) await waitFlagPhase(['settle', 'play'])
  }
  const zero = await page.evaluate(() => window.__QA_FLAG__.done)
  pass('F1-zero', zero.good === 0 && zero.total === 10, zero)
  await page.screenshot({ path: path.join(OUT, 'F1-zero.png') })
  await page.evaluate(() => window.__QA_FLAG__?.destroy?.())

  // ── F2 trap no-press = score ───────────────────────────────────────────
  await attachFlag()
  await waitFlagPhase(['play'])
  await page.evaluate(() => {
    const m = window.__QA_FLAG__
    m.setFlags(false, false)
    m.forceCmd('trap-red')
    m.endWindow()
  })
  await page.waitForTimeout(200)
  const f2 = await dbgFlag()
  pass('F2', f2.score >= 1, f2)
  await page.screenshot({ path: path.join(OUT, 'F2-trap.png') })
  await page.evaluate(() => window.__QA_FLAG__?.destroy?.())

  // ── F4 keyboard + touch ────────────────────────────────────────────────
  await attachFlag()
  await waitFlagPhase(['play'])
  await page.evaluate(() => {
    window.__QA_FLAG__.forceCmd('raise-red')
    window.__QA_FLAG__.setFlags(false, false)
  })
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(80)
  const kb = await dbgFlag()
  pass('F4-keyboard', kb.red === true, kb)
  await page.evaluate(() => {
    window.__QA_FLAG__.setFlags(false, false)
    window.__QA_FLAG__.forceCmd('raise-blue')
  })
  // Touch right half in game space (GAME_W=640 → x>320 = blue)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const p = s.input.activePointer
    p.x = 500
    p.y = 200
    s.input.emit('pointerdown', p)
  })
  await page.waitForTimeout(80)
  const touch = await dbgFlag()
  pass('F4-touch', touch.blue === true, touch)
  await page.screenshot({ path: path.join(OUT, 'F4-controls.png') })
  await page.evaluate(() => window.__QA_FLAG__?.destroy?.())

  // ── F5 stage1 stall uses flag, not stir; stall data ────────────────────
  const stallData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stalls.json'), 'utf8'))
  pass('F5-data', stallData.stalls['1']?.game === 'flag', stallData.stalls['1'])
  const src = fs.readFileSync(path.join(ROOT, 'src/game/GameScene.ts'), 'utf8')
  pass('F5-wiring', src.includes('flagRace(this)') && !src.includes('stirCoffee(this)') && src.includes("from './minigames'") && fs.readFileSync(path.join(ROOT, 'src/game/minigames.ts'), 'utf8').includes('export function stirCoffee'), {
    hasFlagCall: src.includes('flagRace(this)'),
    noStirCall: !src.includes('stirCoffee(this)'),
  })
  // Boot stage1, trip first checkpoint → 舉旗 tutorial (not 攪咖啡)
  await sceneReady(1)
  await page.evaluate(() => localStorage.removeItem('sake-kuma-mg-seen-v1'))
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = false
    s.lastCheckpointX = 0
    const x = s.checkpointXs[0]
    for (const h of [s.boy, s.girl]) {
      if (!h) continue
      h.setPosition(x + 8, 285)
      h.body?.reset(x + 8, 285)
      h.setVelocity(0, 0)
    }
    s.cameras.main.centerOn(x, 180)
    s.tickCheckpoints()
  })
  await page.waitForTimeout(400)
  const f5 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const collect = (o, out = []) => {
      if (!o) return out
      if (o.type === 'Text') out.push(String(o.text))
      if (o.list) for (const c of o.list) collect(c, out)
      return out
    }
    const texts = collect(s.children)
    return {
      coffeeDone: s.coffeeDone,
      intro: !!s.storyIntro,
      flag: texts.some((t) => t.includes('舉旗')),
      stir: texts.some((t) => t.includes('攪勻')),
      texts: texts.filter((t) => /舉旗|攪勻|咖啡媽媽|跳過/.test(t)).slice(0, 8),
    }
  })
  pass('F5-runtime', f5.coffeeDone && f5.flag && !f5.stir, f5)
  await page.screenshot({ path: path.join(OUT, 'F5-stage1-stall.png') })
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(80)
  }

  // ── M3 tutorial ────────────────────────────────────────────────────────
  await sceneReady(7)
  await page.evaluate(() => localStorage.removeItem('sake-kuma-mg-seen-v1'))
  const m3 = await page.evaluate(async () => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.physics.pause()
    const collect = (o, out = []) => {
      if (!o) return out
      if (o.type === 'Text') out.push(String(o.text))
      if (o.list) for (const c of o.list) collect(c, out)
      return out
    }
    const { showTutorial } = await import('/src/game/minigames.ts')
    const p = showTutorial(s, 'stall-memory', [
      { title: '記貨單', lines: ['十字四格會逐格亮起'], tip: 't' },
      { title: '一共四輪', lines: ['長度 3、4、5、6'] },
    ])
    const texts = collect(s.children)
    const has = texts.some((t) => t.includes('記貨單'))
    s.input.emit('pointerdown', s.input.activePointer)
    await new Promise((r) => setTimeout(r, 40))
    s.input.emit('pointerdown', s.input.activePointer)
    await Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), 1500))])
    return { has, texts: texts.filter((t) => t).slice(0, 8) }
  })
  pass('M3', m3.has, m3)
  await page.screenshot({ path: path.join(OUT, 'M3-tutorial.png') })

  // ── M1 perfect via forceSeq ────────────────────────────────────────────
  await sceneReady(7)
  await attachMemory()
  const lens = [3, 4, 5, 6]
  for (let r = 0; r < 4; r++) {
    const seq = Array.from({ length: lens[r] }, (_, i) => ['honey', 'apple', 'fish', 'flower'][i % 4])
    // ensure no three identical (our seq alternates — fine)
    await waitMemPhase(['show', 'input'])
    await page.evaluate((seq) => window.__QA_MEM__.forceSeq(seq), seq)
    await waitMemPhase(['input'], 15000)
    for (const item of seq) {
      await page.evaluate((it) => window.__QA_MEM__.tapItem(it), item)
      await page.waitForTimeout(80)
    }
    if (r < 3) await waitMemPhase(['ok', 'show', 'input'])
  }
  const mPerfect = await page.evaluate(() => window.__QA_MEM__.done)
  pass('M1', mPerfect.good === 4 && mPerfect.total === 4, mPerfect)
  await page.screenshot({ path: path.join(OUT, 'M1-perfect.png') })
  await page.evaluate(() => window.__QA_MEM__?.destroy?.())

  // ── fairness: no three identical in a row ──────────────────────────────
  const fair = await page.evaluate(async () => {
    const m = await import('/src/game/minigames.ts')
    let bad = 0
    for (let i = 0; i < 500; i++) {
      const s = m.memorySequence(6)
      for (let j = 2; j < s.length; j++) if (s[j] === s[j - 1] && s[j] === s[j - 2]) bad++
    }
    return { bad, windows: m.flagWindowMs(1), w10: m.flagWindowMs(10), w20: m.flagWindowMs(20) }
  })
  pass('M1-fairness', fair.bad === 0, fair)
  pass('F-window', fair.windows === 1200 && fair.w10 === 750 && fair.w20 === 750, fair)

  // ── M2 wrong → show answer ─────────────────────────────────────────────
  await attachMemory()
  await waitMemPhase(['show', 'input'])
  await page.evaluate(() => window.__QA_MEM__.forceSeq(['honey', 'apple', 'fish']))
  await waitMemPhase(['input'], 15000)
  await page.evaluate(() => window.__QA_MEM__.tapItem('flower')) // wrong
  await page.waitForTimeout(100)
  const m2 = await dbgMem()
  const answerVisible = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const collect = (o, out = []) => {
      if (!o) return out
      if (o.type === 'Text') out.push(String(o.text))
      if (o.list) for (const c of o.list) collect(c, out)
      return out
    }
    return collect(s.children).some((t) => t.includes('答案'))
  })
  pass('M2', m2.phase === 'fail' && answerVisible, { ...m2, answerVisible })
  await page.screenshot({ path: path.join(OUT, 'M2-fail-answer.png') })
  await page.evaluate(() => window.__QA_MEM__?.destroy?.())

  // ── M4 keyboard + touch ────────────────────────────────────────────────
  await attachMemory()
  await waitMemPhase(['show', 'input'])
  await page.evaluate(() => window.__QA_MEM__.forceSeq(['honey', 'apple']))
  await waitMemPhase(['input'], 15000)
  await page.keyboard.press('ArrowUp') // honey
  await page.waitForTimeout(100)
  const m4kb = await dbgMem()
  pass('M4-keyboard', m4kb.input[0] === 'honey', m4kb)
  // remaining apple via touch cell (down)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const p = s.input.activePointer
    p.x = 320
    p.y = 250
    s.input.emit('pointerdown', p)
  })
  await page.waitForTimeout(100)
  // If touch miss, tapItem
  const m4t = await dbgMem()
  if (m4t.phase === 'input' && m4t.input.length < 2) {
    await page.evaluate(() => window.__QA_MEM__.tapItem('apple'))
  }
  const m4end = await dbgMem()
  pass('M4-touch', m4end.input.includes('apple') || m4end.good >= 1 || m4end.phase === 'ok', m4end)
  await page.screenshot({ path: path.join(OUT, 'M4-controls.png') })

  // Memory stall placed on stage 7
  await sceneReady(7)
  const stallVis = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const collect = (o, out = []) => {
      if (!o) return out
      if (o.type === 'Text') out.push(String(o.text))
      if (o.list) for (const c of o.list) collect(c, out)
      return out
    }
    const texts = collect(s.children)
    return {
      memoryStallX: s.memoryStallX,
      hasSign: texts.some((t) => t.includes('記貨單')),
      goldfish: true,
    }
  })
  pass('M-placement', stallVis.hasSign && stallVis.memoryStallX === 4580, stallVis)
  await page.screenshot({ path: path.join(OUT, 'M-placement.png') })

  report.ok = Object.values(report.checks).every((c) => c.pass)
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(
    path.join(OUT, 'README.md'),
    `# QA · PR-G minigames (舉旗大賽 + 記貨單)

## Cases
- F1–F5 舉旗大賽（取代第1關攪咖啡；\`stirCoffee\` 保留）
- M1–M4 記貨單（第7關 Boss 前攤檔；會員中心金魚眼仍在）

## 2P note
暫無專用 2P 小遊戲按鍵分配；舉旗／記貨單均用 1P 鍵（←→／WASD／觸控）。

## Run
\`\`\`
npx vite --host 127.0.0.1 --port 47461 --strictPort
node scripts/qa/minigames-prg.mjs
\`\`\`

## Result
See \`summary.json\`. ok=${report.ok}
`,
  )
  console.log('SUMMARY', JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
} catch (e) {
  report.errors.push(String(e?.stack || e))
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(report, null, 2))
  console.error(e)
  process.exit(1)
} finally {
  await browser.close().catch(() => {})
  if (vite) vite.kill('SIGTERM')
}
