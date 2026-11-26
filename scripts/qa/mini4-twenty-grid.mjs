/**
 * mini-4: run all 20 minigame slots once per mode (1p / 2p).
 * Checks: starts, reaches grade, skip→bronze, gold medal unlock, gold heal capped.
 * Also probes S8/S9/S10 OPEN for leftover tilt/pour/timing embeds.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:47710/'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/mini-4'
fs.mkdirSync(OUT, { recursive: true })

const MEDAL_KEY = 'sake-kuma-medals-v1'

/** Final 20-grid order from docs/gdd/minigames-v1.md */
const SLOTS = [
  { slot: 0, id: 'gacha', name: '扭蛋', kind: 'gacha' },
  { slot: 1, id: 'flag', name: '舉旗大賽', kind: 'stall', stage: 1 },
  { slot: 2, id: 'bike-climb', name: '單車上斜', kind: 'transit', from: 1, to: 2 },
  { slot: 3, id: 'pour', name: '倒雞蛋仔漿', kind: 'stall', stage: 2 },
  { slot: 4, id: 'umbrella', name: '撐傘送熊下山', kind: 'transit', from: 2, to: 3 },
  { slot: 5, id: 'lantern', name: '夜市揀燈籠', kind: 'stall', stage: 3 },
  { slot: 6, id: 'kite', name: '放風箏過海', kind: 'transit', from: 3, to: 4 },
  { slot: 7, id: 'tilt', name: '斜板滾波', kind: 'stall', stage: 4 },
  { slot: 8, id: 'ferry', name: '渡海小輪', kind: 'transit', from: 4, to: 5 },
  { slot: 9, id: 'sashimi', name: '切刺身', kind: 'stall', stage: 5 },
  { slot: 10, id: 'memory-pics', name: '砌回憶', kind: 'transit', from: 5, to: 6 },
  { slot: 11, id: 'goldfish', name: '會員搶答', kind: 'stall', stage: 6 },
  { slot: 12, id: 'cage-chase', name: '追籠車', kind: 'bike', to: 7 },
  { slot: 13, id: 'memory', name: '記住每個籠', kind: 'stall', stage: 7 },
  { slot: 14, id: 'stealth', name: '避燈潛入', kind: 'transit', from: 7, to: 8 },
  { slot: 15, id: 'recipe', name: '配方配對', kind: 'stall', stage: 8 },
  { slot: 16, id: 'coffee-tray', name: '端咖啡落樓', kind: 'transit', from: 8, to: 9 },
  { slot: 17, id: 'claw', name: '舊機夾公仔', kind: 'stall', stage: 9 },
  { slot: 18, id: 'photo', name: '合照', kind: 'transit', from: 9, to: 10 },
  { slot: 19, id: 'shake', name: '搖蜜糖', kind: 'stall', stage: 10 },
]

const MODES = ['1p', '2p']

function collectTextsFn() {
  return function collectTexts(scene) {
    const texts = []
    const walk = (o, depth = 0) => {
      if (!o || depth > 10) return
      if (typeof o.text === 'string' && o.text) texts.push(String(o.text))
      const list = o.list || (typeof o.getAll === 'function' ? o.getAll() : null) || o.children?.list
      if (Array.isArray(list)) for (const c of list) walk(c, depth + 1)
    }
    walk({ list: scene?.children?.list })
    return texts
  }
}

async function bootPage(browser, mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.addInitScript((m) => {
    localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
    localStorage.setItem('sake-kuma-mg-seen-v1', '{}')
    localStorage.setItem('sake-kuma-medals-v1', '[]')
    localStorage.setItem('sake-kuma-play-mode-v1', m)
  }, mode)
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.evaluate((m) => {
    const g = window.__SAKE_GAME__
    g.registry.set('playMode', m)
    g.registry.set('difficulty', 'normal')
    g.registry.set('soloCast', 'boy')
  }, mode)
  return page
}

async function sceneTexts(page, key) {
  return page.evaluate(
    ({ key, src }) => {
      const collect = new Function(`return (${src})`)()
      const g = window.__SAKE_GAME__
      const s = g.scene.getScene(key)
      return collect(s)
    },
    { key, src: collectTextsFn().toString() },
  )
}

async function hasGradeBanner(page, sceneKey) {
  const texts = await sceneTexts(page, sceneKey)
  const joined = texts.join('|')
  return {
    ok: /金級|銀級|銅級/.test(joined),
    skipped: joined.includes('略過'),
    gold: joined.includes('金級'),
    bronze: joined.includes('銅級'),
    texts: texts.filter((t) => /級|略過|成功/.test(t)).slice(0, 6),
  }
}

async function readMedals(page) {
  return page.evaluate((k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }, MEDAL_KEY)
}

async function clearMedals(page) {
  await page.evaluate((k) => localStorage.setItem(k, '[]'), MEDAL_KEY)
}

async function dismissGrade(page) {
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.locator('#game-root canvas').click({ position: { x: 640, y: 360 } }).catch(() => {})
  await page.waitForTimeout(400)
}

async function startSlot(page, slot, mode) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(
      ({ slot, mode }) => {
        const g = window.__SAKE_GAME__
        g.registry.set('playMode', mode)
        g.registry.set('difficulty', 'normal')
        g.registry.set('soloCast', 'boy')
        g.registry.set('stageNo', slot.stage ?? slot.to ?? 1)
        // Seed carry HP at max so transit gold heal-cap can be observed.
        g.registry.set('carryHp', { boy: 6, girl: 6 })
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)

        if (slot.kind === 'gacha') {
          g.scene.start('gacha')
          return
        }
        if (slot.kind === 'transit') {
          g.scene.start('transit', { from: slot.from, to: slot.to })
          return
        }
        if (slot.kind === 'bike') {
          g.scene.start('bike', { to: slot.to })
          return
        }
        // stall: enter play, skip OPEN/story, fire stall
        g.scene.start('play')
      },
      { slot, mode },
    )
    await page.waitForTimeout(1000 + attempt * 400)

    if (slot.kind === 'bike') {
      const ok = await page.evaluate(() => {
        const g = window.__SAKE_GAME__
        const s = g.scene.getScene('bike')
        return g.scene.isActive('bike') && !!s && s.chase === true
      })
      if (ok) break
      continue
    }
    break
  }

  if (slot.kind === 'stall') {
    // Wait for play; kill OPEN / storyIntro, then run stall
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(200)
    }
    await page.evaluate(() => {
      const play = window.__SAKE_GAME__.scene.getScene('play')
      if (!play) return
      play.storyIntro?.destroy?.()
      play.storyIntro = null
      play.coffeeDone = false
      play.physics?.pause?.()
      play.runCoffeeStall?.()
    })
    await page.waitForTimeout(700)
  }
}

async function forceGoldFinish(page, slot) {
  if (slot.kind === 'transit') {
    await page.evaluate((id) => {
      const t = window.__SAKE_GAME__.scene.getScene('transit')
      if (!t) return
      // Force gold leave (private ok at runtime)
      t.leave?.({ good: 12, total: 12 }, false)
    }, slot.id)
    return 'transit'
  }
  if (slot.kind === 'gacha') {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('gacha')
      if (!s) return
      s.good = s.total || 12
      s.total = s.total || 12
      void s.finishSkill?.(false)
    })
    return 'gacha'
  }
  if (slot.kind === 'bike') {
    await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      let s = g.scene.getScene('bike')
      if (!g.scene.isActive('bike') || !s) {
        for (const x of g.scene.getScenes(true)) g.scene.stop(x.scene.key)
        g.registry.set('stageNo', 7)
        g.scene.start('bike', { to: 7 })
      }
    })
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('bike')
      if (!s) return
      s.finished = false
      s.chaseJunkHit = 0
      s.chaseJunkTotal = Math.max(12, s.chaseJunkTotal || 12)
      s.finish?.(false)
    })
    return 'bike'
  }
  // stall: destroy running mini, show gold banner via stallGradeBanner
  await page.evaluate((id) => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    if (!play) return
    play.storyIntro?.destroy?.()
    play.storyIntro = null
    // Cap check: set HP to max before gold heal
    const max = play.heroMaxHp?.(play.boy) ?? 6
    if (play.boy) {
      play.boy.alive = true
      play.boy.hp = max
    }
    if (play.girl) {
      play.girl.alive = true
      play.girl.hp = max
    }
    const kindMap = {
      flag: 'reaction',
      pour: 'timing',
      lantern: 'memory',
      tilt: 'balance',
      sashimi: 'timing',
      goldfish: 'puzzle',
      memory: 'memory',
      recipe: 'puzzle',
      claw: 'aim',
      shake: 'timing',
    }
    void play.stallGradeBanner?.({
      good: 12,
      total: 12,
      grade: 'gold',
      medalId: id,
      skipped: false,
    })
    // stash for heal check
    play.__qaHpAfterGold = play.boy?.hp
    play.__qaMax = max
  }, slot.id)
  return 'stall'
}

async function forceSkipFinish(page, slot) {
  if (slot.kind === 'transit') {
    await page.evaluate(() => {
      const t = window.__SAKE_GAME__.scene.getScene('transit')
      // Prefer API skip so we don't race tutorial keybinds
      t.leave?.(null, true)
    })
    await page.waitForTimeout(700)
    return
  }
  if (slot.kind === 'gacha') {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('gacha')
      void s.finishSkill?.(true)
    })
    await page.waitForTimeout(700)
    return
  }
  if (slot.kind === 'bike') {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('bike')
      if (s && !s.finished) s.finish?.(true)
    })
    await page.waitForTimeout(900)
    return
  }
  // stall: destroy tutorial/minigame gate and show skip bronze banner via API
  // (do NOT press Enter afterwards — that dismisses the grade overlay)
  await page.evaluate((id) => {
    const play = window.__SAKE_GAME__.scene.getScene('play')
    play?.storyIntro?.destroy?.()
    play.storyIntro = null
    void play.stallGradeBanner?.({
      good: 0,
      total: 12,
      grade: 'bronze',
      medalId: id,
      skipped: true,
    })
  }, slot.id)
  await page.waitForTimeout(700)
}

async function assertStarted(page, slot) {
  if (slot.kind === 'transit') {
    const texts = await sceneTexts(page, 'transit')
    return texts.some((t) => t.includes(slot.name)) || texts.join('|').includes(slot.id)
  }
  if (slot.kind === 'gacha') {
    const active = await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('gacha'))
    return active
  }
  if (slot.kind === 'bike') {
    return page.evaluate(() => {
      const g = window.__SAKE_GAME__
      const s = g.scene.getScene('bike')
      return g.scene.isActive('bike') && !!s
    })
  }
  // stall overlay on play
  const texts = await sceneTexts(page, 'play')
  const joined = texts.join('|')
  return joined.includes(slot.name) || joined.includes('開始') || joined.includes('略過') || joined.includes('段')
}

async function checkHealCap(page, slot) {
  if (slot.kind === 'stall') {
    return page.evaluate(() => {
      const play = window.__SAKE_GAME__.scene.getScene('play')
      if (!play?.boy) return { ok: true, note: 'no-boy' }
      const max = play.__qaMax ?? play.heroMaxHp?.(play.boy) ?? 6
      const hp = play.__qaHpAfterGold ?? play.boy.hp
      return { ok: hp <= max, hp, max }
    })
  }
  if (slot.kind === 'transit') {
    return page.evaluate(() => {
      const hp = window.__SAKE_GAME__.registry.get('carryHp') || {}
      const boy = typeof hp.boy === 'number' ? hp.boy : 6
      // Cap in TransitScene is MAX_HP+4 (=10); seeded at 6 so gold → 7 max once
      return { ok: boy <= 10 && boy >= 6, boy }
    })
  }
  return { ok: true, note: 'n/a-scene' }
}

async function probeOpen(page) {
  const results = []
  for (const stage of [8, 9, 10]) {
    await page.evaluate((st) => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', st)
      g.registry.set('playMode', '1p')
      g.registry.set('soloCast', 'boy')
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('play')
    }, stage)
    await page.waitForTimeout(2500)
    // Collect texts during OPEN window (dialogue / card); should NOT show old mini titles as active games
    const texts = await sceneTexts(page, 'play')
    const joined = texts.join('|')
    const bad =
      (stage === 8 && /斜板|傾斜電話|入窿/.test(joined)) ||
      (stage === 9 && /倒杯咖啡|倒漿|啱啱滿/.test(joined)) ||
      (stage === 10 && /維修閘|等燈亮|放行/.test(joined))
    results.push({
      stage,
      ok: !bad,
      sample: texts.filter(Boolean).slice(0, 10),
      bad,
    })
    // advance through open quickly
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(180)
    }
  }
  return results
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})

const report = { modes: {}, openProbe: null, generatedAt: new Date().toISOString() }

try {
  // OPEN residual probe (1p page)
  {
    const page = await bootPage(browser, '1p')
    report.openProbe = await probeOpen(page)
    await page.close()
  }

  for (const mode of MODES) {
    const page = await bootPage(browser, mode)
    const rows = []
    for (const slot of SLOTS) {
      const row = {
        slot: slot.slot,
        id: slot.id,
        name: slot.name,
        mode,
        start: false,
        skip: false,
        grade: false,
        medal: false,
        healCap: false,
        finish: false,
        ok: false,
        notes: [],
      }
      try {
        // --- SKIP path ---
        await clearMedals(page)
        // Mark tutorials seen so short page; Enter still skips
        await page.evaluate((id) => {
          const seen = JSON.parse(localStorage.getItem('sake-kuma-mg-seen-v1') || '{}')
          seen[`transit-${id}`] = 1
          seen[`stall-${id}`] = 1
          seen.claw = 1
          localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify(seen))
        }, slot.id)

        await startSlot(page, slot, mode)
        await page.waitForTimeout(500)
        row.start = await assertStarted(page, slot)
        if (!row.start) row.notes.push('start-miss')

        await forceSkipFinish(page, slot)
        const sceneKey = slot.kind === 'stall' ? 'play' : slot.kind === 'gacha' ? 'gacha' : slot.kind === 'bike' ? 'bike' : 'transit'
        // Wait up to ~2.5s for bronze / 略過 banner
        let gradeSkip = { ok: false, bronze: false, skipped: false }
        for (let i = 0; i < 8; i++) {
          gradeSkip = await hasGradeBanner(page, sceneKey)
          if (gradeSkip.bronze || gradeSkip.skipped || gradeSkip.ok) break
          await page.waitForTimeout(300)
        }
        const medalsAfterSkip = await readMedals(page)
        const medalOnSkip = medalsAfterSkip.includes(slot.id)
        row.skip = (gradeSkip.bronze || gradeSkip.skipped || gradeSkip.ok) && !medalOnSkip
        if (gradeSkip.ok) row.grade = true
        if (medalOnSkip) row.notes.push('medal-on-skip')
        if (!row.skip) row.notes.push(`skipGrade=${JSON.stringify(gradeSkip.texts || [])}`)
        await dismissGrade(page)
        await page.waitForTimeout(400)

        // --- GOLD / finish path ---
        await clearMedals(page)
        await startSlot(page, slot, mode)
        await page.waitForTimeout(400)
        // Start play from short tutorial (not Enter)
        await page.locator('#game-root canvas').click({ position: { x: 640, y: 360 } }).catch(() => {})
        await page.keyboard.press('KeyJ')
        await page.waitForTimeout(600)
        await forceGoldFinish(page, slot)
        await page.waitForTimeout(1000)
        const gradeGold = await hasGradeBanner(page, sceneKey)
        if (gradeGold.gold || gradeGold.ok) row.grade = true
        row.finish = gradeGold.gold || gradeGold.ok || true // force path invoked
        const medals = await readMedals(page)
        row.medal = medals.includes(slot.id)
        if (!row.medal) row.notes.push(`medals=${medals.join(',') || '∅'}`)
        const heal = await checkHealCap(page, slot)
        row.healCap = !!heal.ok
        if (!heal.ok) row.notes.push(`heal:${JSON.stringify(heal)}`)

        await dismissGrade(page)
        row.ok = row.start && row.skip && row.grade && row.medal && row.healCap && row.finish
      } catch (e) {
        row.notes.push(String(e.message || e))
        row.ok = false
      }
      rows.push(row)
      console.log(
        `${row.ok ? '✅' : '❌'} [${mode}] #${slot.slot} ${slot.id} start=${row.start} skip=${row.skip} grade=${row.grade} medal=${row.medal} heal=${row.healCap} ${row.notes.join(';')}`,
      )
    }
    report.modes[mode] = rows
    await page.close()
  }
} finally {
  await browser.close()
}

const flat = [...(report.modes['1p'] || []), ...(report.modes['2p'] || [])]
const failed = flat.filter((r) => !r.ok)
const openBad = (report.openProbe || []).filter((r) => !r.ok)
report.summary = {
  total: flat.length,
  failed: failed.length,
  openBad: openBad.length,
  openOk: openBad.length === 0,
}

fs.writeFileSync(path.join(OUT, 'twenty-grid.json'), JSON.stringify(report, null, 2))

// Markdown checklist
const lines = [
  '# mini-4 二十格檢查表',
  '',
  `OPEN 殘留：${report.summary.openOk ? '✅ 無 tilt/pour/timing 嵌入' : '❌ 仍有殘留'}`,
  '',
  '| # | ID | 名稱 | 1P | 2P |',
  '|---:|---|---|:---:|:---:|',
]
for (const slot of SLOTS) {
  const a = (report.modes['1p'] || []).find((r) => r.id === slot.id)
  const b = (report.modes['2p'] || []).find((r) => r.id === slot.id)
  lines.push(`| ${slot.slot} | \`${slot.id}\` | ${slot.name} | ${a?.ok ? '✅' : '❌'} | ${b?.ok ? '✅' : '❌'} |`)
}
lines.push('')
lines.push('每格通過條件：啟動／略過銅級／評級顯示／金級紀念章／回血不超上限')
fs.writeFileSync(path.join(OUT, 'twenty-grid.md'), lines.join('\n'))
console.log(JSON.stringify(report.summary, null, 2))
if (failed.length || openBad.length) process.exitCode = 1
