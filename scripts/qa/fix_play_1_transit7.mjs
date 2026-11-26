/**
 * fix-play-1 follow-up: remaining 7 transit minigames.
 * Per transit × {iphone13L, pixel7L}: complete once + skip once (touch only).
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4761/'
const OUT = 'artifacts/fix-play-1/transit7'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const TRANSITS = [
  { id: 'umbrella', from: 2, to: 3, name: '撐傘' },
  { id: 'kite', from: 3, to: 4, name: '風箏' },
  { id: 'ferry', from: 4, to: 5, name: '小輪' },
  { id: 'memory-pics', from: 5, to: 6, name: '砌回憶' },
  { id: 'stealth', from: 7, to: 8, name: '避燈' },
  { id: 'coffee-tray', from: 8, to: 9, name: '端咖啡' },
  { id: 'photo', from: 9, to: 10, name: '合照' },
]

const profiles = {
  iphone13L: { ...devices['iPhone 13 landscape'] },
  pixel7L: { ...devices['Pixel 7 landscape'] },
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

const results = {} // id -> { complete: {iphone,pixel}, skip: {...}, notes }

function ensureRow(id) {
  if (!results[id]) results[id] = { name: '', complete: {}, skip: {}, errors: [] }
}

try {
  for (const [profName, profile] of Object.entries(profiles)) {
    for (const t of TRANSITS) {
      ensureRow(t.id)
      results[t.id].name = t.name

      // ── SKIP ──────────────────────────────────────────────
      {
        const ctx = await browser.newContext(profile)
        await ctx.addInitScript((tid) => {
          localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
          localStorage.setItem('sake-kuma-c2-cleared-v1', '1')
          // force full tutorial so skip button is visible path
          localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify({}))
        }, t.id)
        const page = await ctx.newPage()
        const errors = []
        page.on('pageerror', (e) => errors.push(String(e.message)))
        try {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' })
          await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
          await startTransit(page, t)
          await page.waitForTimeout(800)
          const box = await canvasBox(page)
          // Skip control top-left (~64, 32) — clear of pads; multi-tap for device flake
          for (const [sx, sy] of [
            [64, 32],
            [40, 24],
            [90, 40],
          ]) {
            await touchTap(page, box, sx, sy)
            await page.waitForTimeout(150)
            if (await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('transit')?.leaving)) break
          }
          // Grade banner ~2.8s auto; tap center while waiting
          const waitPlay = page.waitForFunction(
            (to) => {
              const g = window.__SAKE_GAME__
              return g.scene.isActive('play') && g.scene.getScene('play')?.stageNo === to
            },
            t.to,
            { timeout: 28000 },
          )
          for (let i = 0; i < 6; i++) {
            if (await onPlay(page, t.to)) break
            await touchTap(page, box, 320, 200)
            await page.waitForTimeout(350)
          }
          await waitPlay
          // Extra taps if grade still up
          for (let i = 0; i < 4; i++) {
            if (await onPlay(page, t.to)) break
            await touchTap(page, box, 320, 200)
            await page.waitForTimeout(300)
          }
          assert.ok(await onPlay(page, t.to), `${t.id} skip → play stage ${t.to}`)
          results[t.id].skip[profName] = 'PASS'
          await shot(page, `${profName}-${t.id}-skip`)
          console.log(profName, t.id, 'SKIP PASS')
        } catch (e) {
          results[t.id].skip[profName] = 'FAIL'
          results[t.id].errors.push(`skip/${profName}: ${e.stack ?? e}`)
          await page.screenshot({ path: path.join(OUT, `${profName}-${t.id}-skip-FAIL.png`), scale: 'css' }).catch(() => {})
          console.error(profName, t.id, 'SKIP FAIL', e.message)
        } finally {
          await ctx.close()
        }
      }

      // ── COMPLETE ──────────────────────────────────────────
      {
        const ctx = await browser.newContext(profile)
        await ctx.addInitScript((tid) => {
          localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 10 }))
          localStorage.setItem('sake-kuma-c2-cleared-v1', '1')
          localStorage.setItem(
            'sake-kuma-mg-seen-v1',
            JSON.stringify({ [`transit-${tid}`]: true }),
          )
        }, t.id)
        const page = await ctx.newPage()
        const cdp = await ctx.newCDPSession(page)
        const errors = []
        page.on('pageerror', (e) => errors.push(String(e.message)))
        try {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' })
          await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
          await startTransit(page, t)
          await page.waitForTimeout(600)
          const box = await canvasBox(page)
          // Dismiss short tutorial reminder → start
          await touchTap(page, box, 320, 180)
          await page.waitForTimeout(500)
          await touchTap(page, box, 320, 180)

          const deadline = Date.now() + (t.id === 'coffee-tray' || t.id === 'memory-pics' ? 120000 : 90000)
          let tick = 0
          while (Date.now() < deadline) {
            if (await onPlay(page, t.to)) break
            // dismiss grade if showing
            const phase = await page.evaluate(() => {
              const g = window.__SAKE_GAME__
              if (g.scene.isActive('play')) return 'play'
              if (!g.scene.isActive('transit')) return 'other'
              return 'transit'
            })
            if (phase === 'play') break
            await playTick(page, cdp, box, t.id, tick++)
            await page.waitForTimeout(120)
          }
          assert.ok(await onPlay(page, t.to), `${t.id} complete → play stage ${t.to}`)
          assert.deepEqual(errors, [], `${t.id} no pageerrors`)
          results[t.id].complete[profName] = 'PASS'
          await shot(page, `${profName}-${t.id}-complete`)
          console.log(profName, t.id, 'COMPLETE PASS')
        } catch (e) {
          results[t.id].complete[profName] = 'FAIL'
          results[t.id].errors.push(`complete/${profName}: ${e.stack ?? e}`)
          await page.screenshot({ path: path.join(OUT, `${profName}-${t.id}-complete-FAIL.png`), scale: 'css' }).catch(() => {})
          console.error(profName, t.id, 'COMPLETE FAIL', e.message)
        } finally {
          await ctx.close()
        }
      }
    }
  }
} finally {
  await browser.close()
  const table = TRANSITS.map((t) => {
    const r = results[t.id]
    const cell = (mode) => {
      const a = r[mode].iphone13L ?? '?'
      const b = r[mode].pixel7L ?? '?'
      return a === 'PASS' && b === 'PASS' ? 'PASS' : `FAIL(${a}/${b})`
    }
    return {
      id: t.id,
      name: t.name,
      complete: cell('complete'),
      skip: cell('skip'),
      errors: r.errors,
    }
  })
  fs.writeFileSync(path.join(OUT, 'transit7.json'), JSON.stringify({ table, results }, null, 2) + '\n')
  fs.copyFileSync(path.join(OUT, 'transit7.json'), path.join(ART, 'fix-play-1-transit7.json'))
  console.log(JSON.stringify(table, null, 2))
  if (table.some((r) => r.complete.startsWith('FAIL') || r.skip.startsWith('FAIL'))) process.exitCode = 1
}

async function startTransit(page, t) {
  await page.evaluate(({ from, to }) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', to)
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('difficulty', 'normal')
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('transit', { from, to })
  }, t)
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('transit'), null, {
    timeout: 15000,
  })
}

async function onPlay(page, to) {
  return page.evaluate((to) => {
    const g = window.__SAKE_GAME__
    if (!g.scene.isActive('play')) return false
    const s = g.scene.getScene('play')
    return s?.stageNo === to
  }, to)
}

async function canvasBox(page) {
  const box = await page.locator('canvas').boundingBox()
  assert.ok(box, 'canvas')
  return box
}

async function touchTap(page, box, gx, gy) {
  const x = box.x + (box.width * gx) / 640
  const y = box.y + (box.height * gy) / 360
  await page.touchscreen.tap(x, y)
}

async function touchHold(cdp, box, gx, gy, ms) {
  const x = box.x + (box.width * gx) / 640
  const y = box.y + (box.height * gy) / 360
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  })
  await new Promise((r) => setTimeout(r, ms))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function shot(page, label) {
  const file = path.join(OUT, `${label}.png`)
  await page.screenshot({ path: file, scale: 'css' })
  fs.copyFileSync(file, path.join(ART, `fix-play-1-${label}.png`))
}

/** Game-aware touch autopilot (1P). */
async function playTick(page, cdp, box, id, tick) {
  // Pad coords (TouchControls)
  const LEFT = [12, 324]
  const RIGHT = [92, 324]
  const JUMP = [584, 320]
  const ATTACK = [532, 312]

  if (id === 'umbrella') {
    // Follow: alternate left/right halves + center taps track rain
    const x = 80 + (tick % 8) * 70
    await touchTap(page, box, x, 180)
    return
  }
  if (id === 'kite') {
    // Keep kite mid-height; tap moves Y
    const y = 140 + (tick % 5) * 20
    await touchTap(page, box, 200, y)
    return
  }
  if (id === 'ferry') {
    // Steer toward center / sweep
    const x = 200 + Math.sin(tick / 4) * 160
    await touchTap(page, box, 320 + x * 0.3, 200)
    return
  }
  if (id === 'memory-pics') {
    // Wait preview then mash place at pool row
    if (tick < 45) {
      await touchTap(page, box, 320, 200) // harmless during preview
      return
    }
    // Tap pool tiles left-to-right
    const i = tick % 10
    await touchTap(page, box, 200 + i * 40, 250)
    await touchTap(page, box, 320, 200)
    return
  }
  if (id === 'stealth') {
    // Advance when dark — spam attack/jump; also center tap
    if (tick % 3 === 0) await touchTap(page, box, ATTACK[0], ATTACK[1])
    else if (tick % 3 === 1) await touchTap(page, box, JUMP[0], JUMP[1])
    else await touchTap(page, box, 320, 200)
    return
  }
  if (id === 'coffee-tray') {
    // Counter tilt with left/right holds, advance with bottom tap
    if (tick % 5 < 2) await touchHold(cdp, box, LEFT[0], LEFT[1], 80)
    else if (tick % 5 < 4) await touchHold(cdp, box, RIGHT[0], RIGHT[1], 80)
    await touchTap(page, box, 320, 300) // bottom → advance
    return
  }
  if (id === 'photo') {
    // Read target from label text if possible
    const tip = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('transit')
      const texts = s?.children?.list?.filter((o) => o.text && String(o.text).includes('段')) ?? []
      return texts.map((o) => o.text).join('|')
    })
    let gx = 320
    let gy = 160
    if (tip.includes('←')) {
      gx = 120
      gy = 200
    } else if (tip.includes('→')) {
      gx = 520
      gy = 200
    } else if (tip.includes('↑')) {
      gx = 160
      gy = 120
    } else if (tip.includes('↓')) {
      gx = 160
      gy = 280
    } else {
      // cycle directions
      const dirs = [
        [120, 200],
        [520, 200],
        [160, 120],
        [160, 280],
      ]
      ;[gx, gy] = dirs[tick % 4]
    }
    await touchTap(page, box, gx, gy)
    return
  }
  await touchTap(page, box, 320, 200)
}
