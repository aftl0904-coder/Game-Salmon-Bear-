/**
 * mini-2 stall minigames (Claude 定案):
 *  - lanternPickGame  第3關 夜市揀燈籠（memory）
 *  - sashimiCutGame   第5關 切刺身（timing）
 *  - recipeMatchGame  第8關 配方配對（puzzle）
 * Old timingGame / goldfish stay in place for other stages.
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { floatText } from './fx'
import { buzz, HAPTIC, isTouchDevice } from './phone'
import { gradeResult, showSegmentBanner, TIMING_WINDOWS_MS, type MiniKind } from './minigameFramework'
import type { Mini, RoundResult } from './minigames'

function frame(scene: Phaser.Scene, title: string, dim = 0.72) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 260)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, dim).setOrigin(0).setInteractive())
  const t = scene.add
    .text(GAME_W / 2, 76, title, {
      fontFamily: FONT_UI,
      fontSize: '18px',
      color: '#ffe08a',
      stroke: '#2a1408',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  const hint = scene.add
    .text(GAME_W / 2, GAME_H - 46, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#f0dcb0', align: 'center' })
    .setOrigin(0.5)
  const barBg = scene.add.rectangle(GAME_W / 2, GAME_H - 72, 220, 10, 0x2a1a10).setStrokeStyle(2, 0xc8902a)
  const bar = scene.add.rectangle(GAME_W / 2 - 108, GAME_H - 72, 0, 6, 0xffc040).setOrigin(0, 0.5)
  root.add([t, hint, barBg, bar])
  return { root, title: t, hint, bar }
}

function finishRound(res: RoundResult, kind: MiniKind, medalId: string): RoundResult {
  const graded = gradeResult(res.good, res.total, kind, false, medalId)
  return { ...res, grade: graded.grade, medalId }
}

function ensureMgTex(scene: Phaser.Scene, key: string, url: string) {
  if (scene.textures.exists(key)) return
  scene.load.image(key, url)
  scene.load.start()
}

// ── 第3關：夜市揀燈籠 ────────────────────────────────────────────────────

const LANTERN_N = [4, 6, 8] as const
const LANTERN_OUT = [2, 3, 4] as const
const LANTERN_WATCH = [4000, 3500, 3000] as const

/**
 * Watch which lanterns go dark, then tap them back on.
 * Scoring: each correctly re-lit lantern = good; wrong tap = miss (still advances count).
 */
export function lanternPickGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-badge', '/art/minigames/badge-base.png')
  const ui = frame(scene, '夜市揀燈籠')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '記住熄咗邊盞，再撳返著' : '記住熄咗邊盞，撳／方向揀，攻擊打著')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 10
  const g = scene.add.graphics()
  const label = scene.add.text(cx, 104, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  let seg = 1
  let phase: 'watch' | 'pick' | 'pause' | 'end' = 'watch'
  let phaseT = 0
  /** true = this lantern went out during watch (must re-light). */
  let outs: boolean[] = []
  /** During pick: whether player has lit this lantern. */
  let lit: boolean[] = []
  let cursor = 0
  let picks = 0
  const res: RoundResult = { good: 0, total: LANTERN_OUT[0]! + LANTERN_OUT[1]! + LANTERN_OUT[2]! }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false

  const layout = (n: number) => {
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4
    const rows = Math.ceil(n / cols)
    const out: { x: number; y: number }[] = []
    const gapX = 88
    const gapY = 70
    const x0 = cx - ((cols - 1) * gapX) / 2
    const y0 = cy - ((rows - 1) * gapY) / 2 + 8
    for (let i = 0; i < n; i++) {
      out.push({ x: x0 + (i % cols) * gapX, y: y0 + Math.floor(i / cols) * gapY })
    }
    return out
  }

  const drawLantern = (x: number, y: number, on: boolean, focus: boolean) => {
    g.fillStyle(0x2a1a10, 1).fillRoundedRect(x - 18, y - 8, 36, 40, 6)
    g.fillStyle(on ? 0xffc040 : 0x3a3028, 1).fillRoundedRect(x - 14, y - 4, 28, 28, 4)
    if (on) {
      g.fillStyle(0xfff0a0, 0.7).fillCircle(x, y + 8, 8)
      g.lineStyle(2, 0xffe08a, 0.9).strokeCircle(x, y + 8, 12)
    } else {
      g.fillStyle(0x1a1210, 0.8).fillCircle(x, y + 8, 6)
    }
    g.lineStyle(2, 0x8a7060, 1).lineBetween(x, y - 8, x, y - 18)
    if (focus) g.lineStyle(2, 0x8ad0ff, 1).strokeRoundedRect(x - 20, y - 10, 40, 44, 6)
  }

  const draw = () => {
    g.clear()
    const spots = layout(outs.length)
    for (let i = 0; i < spots.length; i++) {
      const on = phase === 'watch' ? !outs[i] : !!lit[i]
      drawLantern(spots[i]!.x, spots[i]!.y, on, phase === 'pick' && i === cursor)
    }
    const need = LANTERN_OUT[seg - 1]!
    label.setText(
      phase === 'watch'
        ? `第 ${seg} 段　記住熄咗邊盞…`
        : phase === 'pick'
          ? `第 ${seg} 段　打著 ${picks}／${need}`
          : '',
    )
    ui.bar.width = (216 * (seg - 1)) / 3
  }

  const beginSeg = () => {
    const n = LANTERN_N[seg - 1]!
    const need = LANTERN_OUT[seg - 1]!
    outs = Array.from({ length: n }, () => false)
    lit = Array.from({ length: n }, () => false)
    const idx = Phaser.Utils.Array.Shuffle([...Array(n).keys()]).slice(0, need)
    for (const i of idx) outs[i!] = true
    cursor = 0
    picks = 0
    phase = 'watch'
    phaseT = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  /** After watch: all dark; player re-lights the ones that were out. */
  const enterPick = () => {
    phase = 'pick'
    lit = outs.map(() => false)
    picks = 0
    cursor = 0
    draw()
  }

  const pickAt = (i: number) => {
    if (finished || phase !== 'pick') return
    if (lit[i]) return
    const spots = layout(outs.length)
    if (outs[i]) {
      lit[i] = true
      res.good++
      picks++
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, spots[i]!.x, spots[i]!.y - 28, '著！', '#ffd040', { size: 14, dur: 500 })
    } else {
      lit[i] = true // mark tried; stays "wrong lit" briefly as dim
      picks++
      SFX.blip(200)
      buzz(40)
      floatText(scene, spots[i]!.x, spots[i]!.y - 28, '唔啱', '#ff8a6a', { size: 13, dur: 500 })
    }
    const need = LANTERN_OUT[seg - 1]!
    const allOutLit = outs.every((o, idx) => !o || lit[idx])
    if (allOutLit || picks >= need) {
      phase = 'pause'
      phaseT = 0
    }
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || phase !== 'pick') return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      cursor = (cursor + outs.length - 1) % outs.length
      draw()
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      cursor = (cursor + 1) % outs.length
      draw()
    } else if (['Space', 'KeyF', 'KeyJ', 'KeyK', 'Enter'].includes(e.code)) {
      pickAt(cursor)
    }
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (phase !== 'pick') return
    const spots = layout(outs.length)
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]!
      if (Math.abs(p.x - s.x) <= 28 && Math.abs(p.y - s.y) <= 28) {
        pickAt(i)
        return
      }
    }
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (phase === 'watch') {
      phaseT += dt
      // Mid-watch: snap outs dark
      if (phaseT > 400) draw()
      if (phaseT >= (LANTERN_WATCH[seg - 1] ?? 3000)) enterPick()
      return
    }
    if (phase === 'pause') {
      phaseT += dt
      if (phaseT >= 600) {
        seg++
        if (seg > 3) return finish()
        beginSeg()
      }
      return
    }
    if (phase === 'pick') {
      if (TouchInput.justPressed('left')) {
        cursor = (cursor + outs.length - 1) % outs.length
        draw()
      }
      if (TouchInput.justPressed('right')) {
        cursor = (cursor + 1) % outs.length
        draw()
      }
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) pickAt(cursor)
    }
  }

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    phase = 'end'
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    phase = 'end'
    ui.bar.width = 216
    ui.title.setText(res.good >= res.total ? '夜市又亮返！' : res.good > 0 ? `著返 ${res.good} 盞` : '下次再試過')
    SFX.sparkle()
    Object.assign(res, finishRound(res, 'memory', 'lantern'))
    scene.time.delayedCall(800, destroy)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginSeg()
  return { done, destroy }
}

// ── 第5關：切刺身 ────────────────────────────────────────────────────────

const SASHIMI_SLICES = [4, 5, 6] as const
const SASHIMI_GAP = [600, 480, 380] as const

/** Beat-cut sashimi: press in the timing window on each mark. */
export function sashimiCutGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-knife', '/art/minigames/knife.png')
  ensureMgTex(scene, 'mg-salmon-l', '/art/minigames/salmon-half-left.png')
  ensureMgTex(scene, 'mg-salmon-r', '/art/minigames/salmon-half-right.png')
  const ui = frame(scene, '切刺身')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '標記到中線就撳畫面落刀' : '標記到中線就撳攻擊鍵落刀')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 16
  const g = scene.add.graphics()
  const label = scene.add.text(cx, 104, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  let seg = 1
  let slice = 0
  let nextAt = 0
  let armed = false
  let settle = 0
  let finished = false
  const total = SASHIMI_SLICES[0]! + SASHIMI_SLICES[1]! + SASHIMI_SLICES[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))

  const draw = (markerX?: number, flash?: 'ok' | 'miss') => {
    g.clear()
    // Board
    g.fillStyle(0x2a1a10, 1).fillRoundedRect(cx - 160, cy - 36, 320, 72, 8)
    g.fillStyle(0x5a4030, 1).fillRoundedRect(cx - 150, cy - 28, 300, 56, 6)
    // Fish body
    g.fillStyle(0xf07888, 1).fillEllipse(cx, cy, 220, 36)
    g.fillStyle(0xffa0a8, 0.8).fillEllipse(cx - 20, cy - 4, 160, 20)
    // Cut marks already done
    const n = SASHIMI_SLICES[seg - 1]!
    for (let i = 0; i < slice; i++) {
      const x = cx - 100 + (i / Math.max(1, n - 1)) * 200
      g.lineStyle(2, 0xfff0d0, 0.9).lineBetween(x, cy - 22, x, cy + 22)
    }
    // Center line
    g.lineStyle(2, 0x8ad0ff, 0.7).lineBetween(cx, cy - 40, cx, cy + 40)
    if (markerX != null) {
      g.fillStyle(flash === 'ok' ? 0x50e070 : flash === 'miss' ? 0xe05050 : 0xffe08a, 1)
      g.fillTriangle(markerX, cy - 48, markerX - 8, cy - 34, markerX + 8, cy - 34)
      g.lineStyle(3, 0xfff0c0, 1).lineBetween(markerX, cy - 30, markerX, cy + 30)
    }
    // Knife hint
    if (scene.textures.exists('mg-knife')) {
      /* optional sprite skipped — graphics knife */
    }
    g.fillStyle(0xc8c8d0, 1).fillRect(cx + 120, cy - 50, 8, 40)
    g.fillStyle(0xe8e8f0, 1).fillTriangle(cx + 124, cy - 10, cx + 110, cy + 18, cx + 138, cy + 18)
    label.setText(`第 ${seg} 段　${slice}／${n} 片`)
    ui.bar.width = 216 * ((seg - 1) / 3 + slice / n / 3)
  }

  const schedule = () => {
    const gap = SASHIMI_GAP[seg - 1] ?? 480
    nextAt = scene.time.now + gap
    armed = true
  }

  const beginSeg = () => {
    slice = 0
    settle = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3).then(() => schedule())
    draw()
  }

  const cut = () => {
    if (finished || !armed || settle > 0) return
    const win = TIMING_WINDOWS_MS[seg - 1] ?? 200
    const dt = Math.abs(scene.time.now - nextAt)
    const ok = dt <= win
    armed = false
    if (ok) {
      res.good++
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, cx, cy - 60, '啱！', '#ffd040', { size: 15, dur: 500 })
      draw(cx, 'ok')
    } else {
      SFX.blip(220)
      buzz(40)
      floatText(scene, cx, cy - 60, '偏咗', '#ff8a6a', { size: 14, dur: 500 })
      draw(cx, 'miss')
    }
    slice++
    settle = 380
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (['Space', 'KeyF', 'KeyJ', 'KeyK', 'Enter'].includes(e.code)) cut()
  }
  const onTap = () => cut()

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) {
      settle -= dt
      if (settle <= 0) {
        const n = SASHIMI_SLICES[seg - 1]!
        if (slice >= n) {
          seg++
          if (seg > 3) return finish()
          beginSeg()
        } else {
          schedule()
        }
      }
      return
    }
    if (!armed) return
    // Marker sweeps toward center; reach center at nextAt
    const gap = SASHIMI_GAP[seg - 1] ?? 480
    const left = nextAt - scene.time.now
    const t = 1 - Phaser.Math.Clamp(left / gap, 0, 1)
    const markerX = cx - 110 + t * 110
    draw(markerX)
    if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) cut()
    // Miss if too late
    if (scene.time.now > nextAt + (TIMING_WINDOWS_MS[seg - 1] ?? 200)) {
      armed = false
      SFX.blip(200)
      floatText(scene, cx, cy - 60, '走雞', '#ff8a6a', { size: 14, dur: 500 })
      slice++
      settle = 380
      draw(cx, 'miss')
    }
  }

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    ui.bar.width = 216
    ui.title.setText(res.good >= res.total ? '師傅點頭！' : res.good > 0 ? `切啱 ${res.good} 片` : '下次再試過')
    SFX.sparkle()
    Object.assign(res, finishRound(res, 'timing', 'sashimi'))
    scene.time.delayedCall(800, destroy)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginSeg()
  return { done, destroy }
}

// ── 第8關：配方配對 ──────────────────────────────────────────────────────

const RECIPE_SLOTS = [3, 4, 5] as const
const RECIPE_HINTS = [2, 1, 0] as const
const RECIPE_SHAPES = ['○', '△', '□', '◇', '☆'] as const
type RecipeShape = (typeof RECIPE_SHAPES)[number]

/** Match shape symbols into the original recipe slots. Hints 2／1／0. */
export function recipeMatchGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-puzzle', '/art/minigames/puzzle-cell.png')
  const ui = frame(scene, '配方配對')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '撳符號放入空位' : '←→揀符號　攻擊放入空位')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 8
  const g = scene.add.graphics()
  const label = scene.add.text(cx, 104, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  const hintTxt = scene.add.text(cx, GAME_H - 108, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#8ad0ff' }).setOrigin(0.5)
  ui.root.add([g, label, hintTxt])

  let seg = 1
  let target: RecipeShape[] = []
  let placed: (RecipeShape | null)[] = []
  let pool: RecipeShape[] = []
  let cursor = 0
  let slot = 0
  let hintsLeft = 0
  let phase: 'play' | 'pause' | 'end' = 'play'
  let phaseT = 0
  const res: RoundResult = { good: 0, total: RECIPE_SLOTS[0]! + RECIPE_SLOTS[1]! + RECIPE_SLOTS[2]! }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false

  const slotPos = (n: number, i: number) => {
    const gap = 70
    return { x: cx - ((n - 1) * gap) / 2 + i * gap, y: cy - 20 }
  }
  const poolPos = (i: number) => {
    const gap = 64
    return { x: cx - ((pool.length - 1) * gap) / 2 + i * gap, y: cy + 70 }
  }

  const drawShape = (x: number, y: number, sh: RecipeShape | null, focus: boolean, ghost = false) => {
    g.fillStyle(ghost ? 0x1a2838 : 0x243040, 1).fillRoundedRect(x - 24, y - 24, 48, 48, 6)
    g.lineStyle(2, focus ? 0xffe08a : 0x6a90a8, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 6)
    if (!sh) return
    const a = ghost ? 0.35 : 1
    if (sh === '○') {
      g.lineStyle(3, 0xffd060, a).strokeCircle(x, y, 12)
    } else if (sh === '△') {
      g.lineStyle(3, 0x80d0ff, a)
      g.strokeTriangle(x, y - 12, x - 12, y + 10, x + 12, y + 10)
    } else if (sh === '□') {
      g.lineStyle(3, 0xa0e080, a).strokeRect(x - 11, y - 11, 22, 22)
    } else if (sh === '◇') {
      g.lineStyle(3, 0xe080c0, a)
      g.beginPath()
      g.moveTo(x, y - 13)
      g.lineTo(x + 13, y)
      g.lineTo(x, y + 13)
      g.lineTo(x - 13, y)
      g.closePath()
      g.strokePath()
    } else {
      // star-ish
      g.fillStyle(0xffe080, a).fillCircle(x, y, 5)
      g.lineStyle(2, 0xffe080, a)
      for (let k = 0; k < 5; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI * 2) / 5
        g.lineBetween(x, y, x + Math.cos(ang) * 14, y + Math.sin(ang) * 14)
      }
    }
  }

  const draw = () => {
    g.clear()
    const n = target.length
    for (let i = 0; i < n; i++) {
      const p = slotPos(n, i)
      const ghost = hintsLeft < RECIPE_HINTS[seg - 1]! && placed[i] == null && phase === 'play'
      // Show hint ghost for empty slots if hints remain and player pressed hint — handled separately
      drawShape(p.x, p.y, placed[i], slot === i, false)
      if (ghost && false) drawShape(p.x, p.y, target[i]!, false, true)
    }
    for (let i = 0; i < pool.length; i++) {
      drawShape(poolPos(i).x, poolPos(i).y, pool[i]!, cursor === i)
    }
    label.setText(`第 ${seg} 段　位 ${slot + 1}／${n}　提示 ${hintsLeft}`)
    hintTxt.setText(hintsLeft > 0 ? (touch ? '長按空位睇提示' : 'H／Select 睇提示') : '冇提示喇')
    ui.bar.width = (216 * (seg - 1)) / 3
  }

  const beginSeg = () => {
    const n = RECIPE_SLOTS[seg - 1]!
    const shapes = RECIPE_SHAPES.slice(0, n) as RecipeShape[]
    target = Phaser.Utils.Array.Shuffle(shapes.slice())
    placed = Array.from({ length: n }, () => null)
    pool = Phaser.Utils.Array.Shuffle(target.slice())
    cursor = 0
    slot = 0
    hintsLeft = RECIPE_HINTS[seg - 1]!
    phase = 'play'
    phaseT = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const useHint = () => {
    if (finished || phase !== 'play' || hintsLeft <= 0) return
    hintsLeft--
    // Briefly show correct shape in current empty slot
    const p = slotPos(target.length, slot)
    floatText(scene, p.x, p.y - 36, `${target[slot]}`, '#8ad0ff', { size: 18, dur: 900 })
    SFX.blip(520)
    draw()
  }

  const place = () => {
    if (finished || phase !== 'play') return
    const sh = pool[cursor]
    if (!sh || placed[slot] != null) return
    placed[slot] = sh
    pool.splice(cursor, 1)
    if (cursor >= pool.length) cursor = Math.max(0, pool.length - 1)
    if (sh === target[slot]) {
      res.good++
      SFX.coin()
      buzz(HAPTIC.power)
    } else {
      SFX.blip(220)
      buzz(40)
      floatText(scene, slotPos(target.length, slot).x, slotPos(target.length, slot).y - 40, '錯位', '#ff8a6a', {
        size: 13,
        dur: 600,
      })
    }
    // Advance to next empty slot
    let next = slot + 1
    while (next < placed.length && placed[next] != null) next++
    if (next >= placed.length) {
      phase = 'pause'
      phaseT = 0
    } else {
      slot = next
    }
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || phase !== 'play') return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      cursor = pool.length ? (cursor + pool.length - 1) % pool.length : 0
      draw()
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      cursor = pool.length ? (cursor + 1) % pool.length : 0
      draw()
    } else if (['Space', 'KeyF', 'KeyJ', 'KeyK', 'Enter'].includes(e.code)) {
      place()
    } else if (e.code === 'KeyH' || e.code === 'ShiftRight') {
      useHint()
    }
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (phase !== 'play') return
    for (let i = 0; i < pool.length; i++) {
      const s = poolPos(i)
      if (Math.abs(p.x - s.x) <= 28 && Math.abs(p.y - s.y) <= 28) {
        cursor = i
        place()
        return
      }
    }
    // Long-press hint via double-tap on empty slot area
    for (let i = 0; i < placed.length; i++) {
      if (placed[i] != null) continue
      const s = slotPos(placed.length, i)
      if (Math.abs(p.x - s.x) <= 28 && Math.abs(p.y - s.y) <= 28) {
        slot = i
        useHint()
        return
      }
    }
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (phase === 'pause') {
      phaseT += dt
      if (phaseT >= 700) {
        seg++
        if (seg > 3) return finish()
        beginSeg()
      }
      return
    }
    if (phase === 'play') {
      if (TouchInput.justPressed('left') && pool.length) {
        cursor = (cursor + pool.length - 1) % pool.length
        draw()
      }
      if (TouchInput.justPressed('right') && pool.length) {
        cursor = (cursor + 1) % pool.length
        draw()
      }
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) place()
      if (TouchInput.justPressed('special') || TouchInput.justPressed('menu')) useHint()
    }
  }

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    phase = 'end'
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    phase = 'end'
    ui.bar.width = 216
    ui.title.setText(res.good >= res.total ? '原本配方！' : res.good > 0 ? `啱 ${res.good} 格` : '下次再試過')
    SFX.sparkle()
    Object.assign(res, finishRound(res, 'puzzle', 'recipe'))
    scene.time.delayedCall(800, destroy)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginSeg()
  return { done, destroy }
}

export type { RoundResult }
