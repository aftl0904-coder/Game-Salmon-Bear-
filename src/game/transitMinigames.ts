/**
 * mini-3 transit minigames (Claude 定案 / docs/gdd/minigames-v1.md):
 * 1→2 bike-climb · 2→3 umbrella · 3→4 kite · 4→5 ferry ·
 * 5→6 memory-pics · 7→8 stealth · 8→9 coffee-tray · 9→10 photo
 * Keep 6→7 chase in BikeScene. Do not delete ClawScene/BikeScene.
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { floatText } from './fx'
import { isTouchDevice } from './phone'
import { p2Pad, btn as padBtn } from './gamepadBridge'
import { gradeResult, showSegmentBanner, type MiniKind } from './minigameFramework'
import { galleryMarkStory } from './galleryUnlock'
import type { Mini, RoundResult } from './minigames'

export type TransitId =
  | 'bike-climb'
  | 'umbrella'
  | 'kite'
  | 'ferry'
  | 'memory-pics'
  | 'stealth'
  | 'coffee-tray'
  | 'photo'

export const TRANSIT_BY_LEG: Record<string, TransitId> = {
  '1-2': 'bike-climb',
  '2-3': 'umbrella',
  '3-4': 'kite',
  '4-5': 'ferry',
  '5-6': 'memory-pics',
  '7-8': 'stealth',
  '8-9': 'coffee-tray',
  '9-10': 'photo',
}

export const TRANSIT_META: Record<
  TransitId,
  { name: string; kind: MiniKind; hint: string; tip: string }
> = {
  'bike-climb': {
    name: '單車上斜',
    kind: 'balance',
    hint: '左右交替踩，保持平衡',
    tip: '側風前會有預警，側身頂住。',
  },
  umbrella: {
    name: '撐傘送熊下山',
    kind: 'reaction',
    hint: '左右移傘，遮住籃入面嘅熊',
    tip: '雨點有影子預警，提早移過去。',
  },
  kite: {
    name: '放風箏過海',
    kind: 'reaction',
    hint: '上下移風箏，避開海鷗',
    tip: '海鷗有影子預警；任一隻過海就得。',
  },
  ferry: {
    name: '渡海小輪',
    kind: 'aim',
    hint: '左右轉舵，穿過浮標門',
    tip: '水流會推船，提早修正。',
  },
  'memory-pics': {
    name: '砌回憶',
    kind: 'memory',
    hint: '記住次序，再排返啱',
    tip: '預覽完就亂咗，逐張擺返位。',
  },
  stealth: {
    name: '避燈潛入',
    kind: 'timing',
    hint: '燈移開先郁，被照到返起點',
    tip: '轉燈前有預警；2P 只有被照到嗰個重來。',
  },
  'coffee-tray': {
    name: '端咖啡落樓',
    kind: 'balance',
    hint: '左右扶穩托盤落樓梯',
    tip: '搖晃時要反向扶，唔好瀉。',
  },
  photo: {
    name: '合照',
    kind: 'reaction',
    hint: '倒數完前擺啱剪影姿勢',
    tip: '睇剪影撳對應方向；1P 時噗噗自動。',
  },
}

/** Big transit title — keep clear of segment line at SEG_LABEL_Y (fix-play-1). */
const TITLE_Y = 36
/** 「第 N 段」status line — below title, above playfield. */
const SEG_LABEL_Y = 112

function frame(scene: Phaser.Scene, title: string, dim = 0.72) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 260)
  // Do not setInteractive — a full-screen hit target eats phone pad taps (fix-play-1).
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, dim).setOrigin(0))
  const t = scene.add
    .text(GAME_W / 2, TITLE_Y, title, {
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

function ensureMgSheet(scene: Phaser.Scene, key: string, url: string, fw: number, fh: number) {
  if (scene.textures.exists(key)) return
  scene.load.spritesheet(key, url, { frameWidth: fw, frameHeight: fh })
  scene.load.start()
}

function twoP(scene: Phaser.Scene) {
  return scene.registry.get('playMode') === '2p'
}

function p1Attack(): boolean {
  return TouchInput.justPressed('attack') || TouchInput.justPressed('jump')
}

function p2AttackEdge(prev: boolean): { down: boolean; edge: boolean } {
  const pad = p2Pad()
  const down = !!(pad && (padBtn(pad, 0) || padBtn(pad, 1)))
  return { down, edge: down && !prev }
}

function heldLR(): { l: boolean; r: boolean; u: boolean; d: boolean } {
  return {
    l: TouchInput.isDown('left'),
    r: TouchInput.isDown('right'),
    u: TouchInput.isDown('up'),
    d: TouchInput.isDown('down'),
  }
}

// ── 1→2 單車上斜 ─────────────────────────────────────────────────────────

const CLIMB_SLOPE = [0.05, 0.1, 0.15] as const
const CLIMB_WIND = [3000, 2000, 1500] as const
const WARN_MS = 800
const CLIMB_PER_SEG = 4

export function bikeClimbGame(scene: Phaser.Scene): Mini<RoundResult> {
  const ui = frame(scene, TRANSIT_META['bike-climb'].name)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '兩架並排，左右交替踩' : isTouchDevice() ? '左右半邊交替踩' : '←→ 交替踩，平衡條唔好跌')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = CLIMB_PER_SEG * 3
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let lean = 0
  let lastPedal: -1 | 0 | 1 = 0
  let windIn = 0
  let windWarn = false
  let windDir = 0
  let trials = 0
  let settle = 0
  let bikeX = [GAME_W / 2 - (coop ? 70 : 0), GAME_W / 2 + (coop ? 70 : 0)]
  let activeBike = 0

  const draw = () => {
    g.clear()
    const slope = CLIMB_SLOPE[seg - 1]!
    g.fillStyle(0x3a6040, 1).fillTriangle(40, GAME_H - 90, GAME_W - 40, GAME_H - 90 - slope * 420, GAME_W - 40, GAME_H - 90)
    g.fillStyle(0x5a5040, 1).fillRect(40, GAME_H - 96, GAME_W - 80, 10)
    const n = coop ? 2 : 1
    for (let i = 0; i < n; i++) {
      const x = bikeX[i]!
      const y = GAME_H / 2 + 40 + lean * (i === activeBike ? 1 : 0.4) * 40
      g.fillStyle(i === 0 ? 0x4a90d0 : 0xe080a0, 1).fillCircle(x, y, 18)
      g.fillStyle(0xffe08a, 1).fillCircle(x, y - 22, 8) // 噗噗 in basket
      g.lineStyle(3, 0xc8c8d0, 1).strokeCircle(x - 14, y + 14, 10)
      g.lineStyle(3, 0xc8c8d0, 1).strokeCircle(x + 14, y + 14, 10)
    }
    // balance meter
    const mx = GAME_W / 2
    const my = 140
    g.fillStyle(0x2a1a10, 1).fillRect(mx - 60, my, 120, 8)
    g.fillStyle(Math.abs(lean) > 0.7 ? 0xe05050 : 0x50e070, 1).fillRect(mx - 4 + lean * 56, my - 4, 8, 16)
    if (windWarn) {
      g.fillStyle(0xffe08a, 0.5).fillTriangle(windDir < 0 ? 80 : GAME_W - 80, 160, windDir < 0 ? 40 : GAME_W - 40, 180, windDir < 0 ? 80 : GAME_W - 80, 200)
      label.setText('側風嚟喇！')
    } else {
      label.setText(`第 ${seg} 段　成功 ${res.good}／${total}`)
    }
    ui.bar.width = 216 * (res.good / total)
  }

  const beginSeg = () => {
    lean = 0
    lastPedal = 0
    windIn = CLIMB_WIND[seg - 1]!
    windWarn = false
    trials = 0
    settle = 0
    activeBike = seg % 2 === 0 ? 1 : 0
    if (!coop) activeBike = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const scoreTrial = (ok: boolean) => {
    if (finished || settle > 0) return
    trials++
    if (ok) {
      res.good++
      SFX.coin()
      floatText(scene, GAME_W / 2, 150, '穩！', '#80ff90', { size: 14, dur: 500 })
    } else {
      SFX.blip(220)
      floatText(scene, GAME_W / 2, 150, '歪咗', '#ff8a6a', { size: 14, dur: 500 })
      lean = Phaser.Math.Clamp(lean + (Math.random() > 0.5 ? 0.35 : -0.35), -1, 1)
    }
    settle = 400
    if (trials >= CLIMB_PER_SEG) {
      if (seg >= 3) endAll()
      else {
        seg++
        scene.time.delayedCall(500, beginSeg)
      }
    }
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'balance', 'bike-climb'))
    ui.title.setText(res.grade === 'gold' ? '一路冇跌！' : '到斜頂喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const onKey = (e: KeyboardEvent) => {
    if (finished || settle > 0) return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') pedal(-1)
    if (e.code === 'ArrowRight' || e.code === 'KeyD') pedal(1)
  }

  const pedal = (dir: -1 | 1) => {
    if (finished || settle > 0) return
    if (lastPedal === dir) {
      lean = Phaser.Math.Clamp(lean + dir * 0.12, -1, 1)
      return
    }
    lastPedal = dir
    const slope = CLIMB_SLOPE[seg - 1]!
    lean = Phaser.Math.Clamp(lean - dir * 0.08 + slope * 0.02, -1, 1)
    if (Math.abs(lean) < 0.55) scoreTrial(true)
  }

  const onTap = (p: Phaser.Input.Pointer) => {
    if (finished || settle > 0) return
    pedal(p.x < GAME_W / 2 ? -1 : 1)
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) {
      settle -= dt
      draw()
      return
    }
    const slope = CLIMB_SLOPE[seg - 1]!
    lean = Phaser.Math.Clamp(lean + slope * 0.0004 * dt, -1, 1)
    if (TouchInput.justPressed('left')) pedal(-1)
    if (TouchInput.justPressed('right')) pedal(1)
    windIn -= dt
    if (!windWarn && windIn <= WARN_MS) {
      windWarn = true
      windDir = Math.random() > 0.5 ? 1 : -1
      SFX.blip(400)
    }
    if (windIn <= 0) {
      lean = Phaser.Math.Clamp(lean + windDir * 0.45, -1, 1)
      windWarn = false
      windIn = CLIMB_WIND[seg - 1]!
      const ok = Math.abs(lean) < 0.85
      if (!ok) lean = Phaser.Math.Clamp(lean, -0.9, 0.9)
      scoreTrial(ok)
    }
    if (Math.abs(lean) >= 1) {
      lean = 0
      scoreTrial(false)
    }
    draw()
  }

  const destroy = () => {
    finished = true
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    scene.events.off('update', tick)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginSeg()
  return { done, destroy }
}

// ── 2→3 撐傘送熊下山 ─────────────────────────────────────────────────────

const UMB_RAIN = [4, 5, 6] as const

export function umbrellaGame(scene: Phaser.Scene): Mini<RoundResult> {
  const ui = frame(scene, TRANSIT_META.umbrella.name)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '兩人一齊移傘遮熊' : isTouchDevice() ? '左右拖／撳半邊移傘' : '←→ 移傘，遮住雨點')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = UMB_RAIN[0]! + UMB_RAIN[1]! + UMB_RAIN[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let umbX = GAME_W / 2
  let basketX = GAME_W / 2
  let drops: { x: number; y: number; warn: number; falling: boolean; done: boolean }[] = []
  let spawnLeft = 0
  let spawnIn = 0
  let settle = 0

  const draw = () => {
    g.clear()
    // hill
    g.fillStyle(0x3a5040, 1).fillTriangle(0, 80, GAME_W, 200, GAME_W, GAME_H - 80)
    g.fillStyle(0x2a3a30, 1).fillRect(0, GAME_H - 80, GAME_W, 80)
    // basket + bear
    g.fillStyle(0x8a6030, 1).fillRoundedRect(basketX - 28, GAME_H / 2 + 40, 56, 36, 6)
    g.fillStyle(0xe0a060, 1).fillCircle(basketX, GAME_H / 2 + 36, 14)
    g.fillStyle(0x2a1810, 1).fillCircle(basketX - 5, GAME_H / 2 + 32, 2)
    g.fillStyle(0x2a1810, 1).fillCircle(basketX + 5, GAME_H / 2 + 32, 2)
    // umbrella
    g.fillStyle(0x4a80c0, 1).fillTriangle(umbX - 40, GAME_H / 2 + 8, umbX + 40, GAME_H / 2 + 8, umbX, GAME_H / 2 - 28)
    g.lineStyle(3, 0xc8c0b0, 1).lineBetween(umbX, GAME_H / 2 + 8, umbX, GAME_H / 2 + 48)
    for (const d of drops) {
      if (d.warn > 0 && !d.falling) {
        g.fillStyle(0x6080a0, 0.35).fillEllipse(d.x, GAME_H / 2 + 70, 16, 8)
      }
      if (d.falling || d.warn <= 0) {
        g.fillStyle(0xa0c8ff, 1).fillCircle(d.x, d.y, 5)
      }
    }
    label.setText(`第 ${seg} 段　擋到 ${res.good}／${total}`)
    ui.bar.width = 216 * (res.good / total)
  }

  const beginSeg = () => {
    spawnLeft = UMB_RAIN[seg - 1]!
    spawnIn = 400
    drops = []
    settle = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const spawn = () => {
    const x = Phaser.Math.Clamp(basketX + Phaser.Math.Between(-90, 90), 60, GAME_W - 60)
    drops.push({ x, y: 90, warn: WARN_MS, falling: false, done: false })
    spawnLeft--
    spawnIn = 900 - seg * 120
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'reaction', 'umbrella'))
    ui.title.setText(res.grade === 'gold' ? '熊仔乾晒！' : '到夜市喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    const h = heldLR()
    const spd = 220
    if (h.l) umbX -= spd * (dt / 1000)
    if (h.r) umbX += spd * (dt / 1000)
    umbX = Phaser.Math.Clamp(umbX, 50, GAME_W - 50)
    // basket drifts downhill
    basketX = Phaser.Math.Clamp(basketX + Math.sin(scene.time.now / 700) * 0.4, 80, GAME_W - 80)

    if (spawnLeft > 0) {
      spawnIn -= dt
      if (spawnIn <= 0) spawn()
    }

    for (const d of drops) {
      if (d.done) continue
      if (!d.falling) {
        d.warn -= dt
        if (d.warn <= 0) d.falling = true
      } else {
        d.y += (180 + seg * 40) * (dt / 1000)
        if (d.y >= GAME_H / 2 + 20) {
          d.done = true
          const covered = Math.abs(d.x - umbX) < 42
          if (covered) {
            res.good++
            SFX.coin()
          } else {
            SFX.blip(200)
            floatText(scene, d.x, d.y, '濕咗', '#ff8a6a', { size: 12, dur: 450 })
          }
        }
      }
    }

    const pending = drops.some((d) => !d.done) || spawnLeft > 0
    if (!pending && settle <= 0) {
      settle = 1
      if (seg >= 3) endAll()
      else {
        seg++
        scene.time.delayedCall(450, beginSeg)
      }
    }
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') umbX -= 28
    if (e.code === 'ArrowRight' || e.code === 'KeyD') umbX += 28
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    umbX = Phaser.Math.Clamp(p.x, 50, GAME_W - 50)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

// ── 3→4 放風箏過海 ───────────────────────────────────────────────────────

const KITE_BIRDS = [4, 7, 10] as const
const KITE_SPD = [80, 110, 140] as const

export function kiteGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgSheet(scene, 'mg-kite', '/art/minigames/kite.png', 28, 32)
  ensureMgSheet(scene, 'mg-bird', '/art/minigames/bird.png', 24, 20)
  const ui = frame(scene, TRANSIT_META.kite.name, 0.55)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '兩隻風箏，任一過海就得' : isTouchDevice() ? '上下半邊移風箏' : '↑↓ 移風箏避開海鷗')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = KITE_BIRDS[0]! + KITE_BIRDS[1]! + KITE_BIRDS[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  type Kite = { x: number; y: number; alive: boolean; done: boolean }
  type Bird = { x: number; y: number; warn: number; flying: boolean; hit: boolean; scored: boolean }
  let kites: Kite[] = []
  let birds: Bird[] = []
  let spawnLeft = 0
  let spawnIn = 0
  let crossed = false

  const draw = () => {
    g.clear()
    g.fillStyle(0x1a3048, 1).fillRect(0, GAME_H / 2 + 40, GAME_W, GAME_H / 2)
    g.fillStyle(0xc8b080, 1).fillRect(0, GAME_H / 2 + 36, 70, 50)
    g.fillStyle(0xc8b080, 1).fillRect(GAME_W - 70, GAME_H / 2 + 36, 70, 50)
    for (const k of kites) {
      if (!k.alive) continue
      if (scene.textures.exists('mg-kite')) {
        /* graphics fallback always drawn for reliability */
      }
      g.fillStyle(0xe05050, 1).fillTriangle(k.x, k.y - 16, k.x - 14, k.y + 12, k.x + 14, k.y + 12)
      g.lineStyle(1, 0xf0e0c0, 0.7).lineBetween(40, GAME_H / 2 + 50, k.x, k.y)
    }
    for (const b of birds) {
      if (b.warn > 0 && !b.flying) g.fillStyle(0x405060, 0.4).fillEllipse(b.x, b.y + 18, 22, 10)
      if (b.flying || b.warn <= 0) {
        g.fillStyle(0xe8e8f0, 1).fillTriangle(b.x - 12, b.y, b.x + 12, b.y, b.x, b.y - 8)
        g.fillStyle(0xc0c0d0, 1).fillCircle(b.x, b.y, 6)
      }
    }
    label.setText(crossed ? `第 ${seg} 段　過咗！` : `第 ${seg} 段　避開 ${res.good}／${total}`)
    ui.bar.width = 216 * (res.good / Math.max(1, total))
  }

  const beginSeg = () => {
    crossed = false
    spawnLeft = KITE_BIRDS[seg - 1]!
    spawnIn = 500
    birds = []
    kites = coop
      ? [
          { x: 120, y: GAME_H / 2 - 20, alive: true, done: false },
          { x: 120, y: GAME_H / 2 + 20, alive: true, done: false },
        ]
      : [{ x: 120, y: GAME_H / 2, alive: true, done: false }]
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const endSeg = () => {
    if (seg >= 3) endAll()
    else {
      seg++
      scene.time.delayedCall(500, beginSeg)
    }
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'reaction', 'kite'))
    ui.title.setText(res.grade === 'gold' ? '條線冇斷！' : '過咗海喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const tick = (_t: number, dt: number) => {
    if (finished || crossed) return
    const h = heldLR()
    const spd = 160
    if (kites[0]) {
      if (h.u) kites[0].y -= spd * (dt / 1000)
      if (h.d) kites[0].y += spd * (dt / 1000)
      kites[0].y = Phaser.Math.Clamp(kites[0].y, 100, GAME_H / 2 + 30)
      kites[0].x += 36 * (dt / 1000)
    }
    if (coop && kites[1]) {
      // P2: alternate with touch right half / pad — approximate with opposite vertical bias from P1 attack held
      const pad = p2Pad()
      const p2u = !!(pad && pad.axes?.[1] !== undefined && pad.axes[1]! < -0.35)
      const p2d = !!(pad && pad.axes?.[1] !== undefined && pad.axes[1]! > 0.35)
      if (p2u) kites[1].y -= spd * (dt / 1000)
      if (p2d) kites[1].y += spd * (dt / 1000)
      // touch: right half vertical from pointer — keep gentle auto drift if no pad
      if (!p2u && !p2d) kites[1].y += Math.sin(scene.time.now / 500) * 0.3
      kites[1].y = Phaser.Math.Clamp(kites[1].y, 100, GAME_H / 2 + 30)
      kites[1].x += 36 * (dt / 1000)
    }

    if (spawnLeft > 0) {
      spawnIn -= dt
      if (spawnIn <= 0) {
        birds.push({
          x: Phaser.Math.Between(200, GAME_W - 80),
          y: Phaser.Math.Between(110, GAME_H / 2 + 20),
          warn: WARN_MS,
          flying: false,
          hit: false,
          scored: false,
        })
        spawnLeft--
        spawnIn = 700 - seg * 80
      }
    }

    const birdSpd = KITE_SPD[seg - 1]!
    for (const b of birds) {
      if (!b.flying) {
        b.warn -= dt
        if (b.warn <= 0) b.flying = true
      } else {
        b.x -= birdSpd * (dt / 1000)
      }
      for (const k of kites) {
        if (!k.alive) continue
        if (b.flying && !b.hit && Math.hypot(b.x - k.x, b.y - k.y) < 22) {
          b.hit = true
          k.alive = false
          SFX.blip(180)
        }
      }
      if (b.flying && !b.scored && !b.hit && b.x < 40) {
        b.scored = true
        res.good++
        SFX.coin()
      }
    }

    for (const k of kites) {
      if (k.alive && k.x >= GAME_W - 80) {
        k.done = true
        crossed = true
        // remaining birds count as avoided if not hit
        for (const b of birds) {
          if (!b.scored && !b.hit) {
            b.scored = true
            res.good++
          }
        }
        // credit unspawned birds as avoided (got across early)
        res.good += spawnLeft
        spawnLeft = 0
        SFX.win()
        floatText(scene, GAME_W / 2, 140, '過海！', '#80ff90', { size: 16, dur: 700 })
        scene.time.delayedCall(600, endSeg)
        break
      }
    }

    // all kites down
    if (kites.every((k) => !k.alive) && !crossed) {
      crossed = true
      scene.time.delayedCall(500, endSeg)
    }

    // timeout if birds done and no cross
    if (spawnLeft <= 0 && birds.every((b) => b.scored || b.hit || b.x < 0) && !crossed && kites.some((k) => k.alive)) {
      // push kites to finish naturally — if still short of shore, fail segment
      if (kites.every((k) => !k.alive || k.x < GAME_W - 80)) {
        crossed = true
        scene.time.delayedCall(400, endSeg)
      }
    }

    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (!kites[0]) return
    if (e.code === 'ArrowUp' || e.code === 'KeyW') kites[0].y -= 24
    if (e.code === 'ArrowDown' || e.code === 'KeyS') kites[0].y += 24
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (coop && p.x > GAME_W / 2 && kites[1]) kites[1].y = Phaser.Math.Clamp(p.y, 100, GAME_H / 2 + 30)
    else if (kites[0]) kites[0].y = Phaser.Math.Clamp(p.y, 100, GAME_H / 2 + 30)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

// ── 4→5 渡海小輪 ─────────────────────────────────────────────────────────

const FERRY_W = [120, 90, 70] as const
const FERRY_CUR = [0, 20, 40] as const
const FERRY_GATES = 6

export function ferryGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgSheet(scene, 'mg-ferry', '/art/minigames/ferry.png', 24, 20)
  ensureMgSheet(scene, 'mg-wave', '/art/minigames/wave.png', 48, 24)
  const ui = frame(scene, TRANSIT_META.ferry.name, 0.5)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '每段換人掌舵' : isTouchDevice() ? '左右移船過閘' : '←→ 轉舵過浮標門')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = FERRY_GATES * 3
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let boatX = GAME_W / 2
  let boatY = GAME_H - 100
  let gates: { y: number; cx: number; passed: boolean; hit: boolean }[] = []
  let gateI = 0
  let steerWho = 0 // 0=P1 1=P2 alternate per seg
  let segDone = false

  const draw = () => {
    g.clear()
    g.fillStyle(0x1a3858, 1).fillRect(0, 90, GAME_W, GAME_H - 90)
    const w = FERRY_W[seg - 1]!
    for (const gt of gates) {
      g.fillStyle(0xe05050, 1).fillCircle(gt.cx - w / 2, gt.y, 8)
      g.fillStyle(0xe05050, 1).fillCircle(gt.cx + w / 2, gt.y, 8)
      g.lineStyle(2, 0xffe08a, 0.5).lineBetween(gt.cx - w / 2, gt.y, gt.cx + w / 2, gt.y)
    }
    g.fillStyle(0xd0d8e0, 1).fillEllipse(boatX, boatY, 36, 18)
    g.fillStyle(0x4a80c0, 1).fillRect(boatX - 4, boatY - 22, 8, 16)
    label.setText(
      `第 ${seg} 段　門 ${Math.min(gateI + 1, FERRY_GATES)}／${FERRY_GATES}${coop ? (steerWho ? '　P2舵' : '　P1舵') : ''}`,
    )
    ui.bar.width = 216 * (res.good / total)
  }

  const beginSeg = () => {
    boatX = GAME_W / 2
    boatY = GAME_H - 100
    gateI = 0
    segDone = false
    steerWho = coop ? (seg - 1) % 2 : 0
    gates = []
    for (let i = 0; i < FERRY_GATES; i++) {
      gates.push({
        y: GAME_H - 140 - i * 36,
        cx: GAME_W / 2 + Phaser.Math.Between(-80, 80),
        passed: false,
        hit: false,
      })
    }
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'aim', 'ferry'))
    ui.title.setText(res.grade === 'gold' ? '對岸到喇！' : '靠岸喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    const cur = FERRY_CUR[seg - 1]!
    boatX += (Math.sin(scene.time.now / 800) * cur) * (dt / 1000)
    const h = heldLR()
    let steerL = h.l
    let steerR = h.r
    if (coop && steerWho === 1) {
      const pad = p2Pad()
      steerL = !!(pad && (pad.axes?.[0] ?? 0) < -0.35)
      steerR = !!(pad && (pad.axes?.[0] ?? 0) > 0.35)
      // touch left/right still works for whoever's turn on phone
      if (isTouchDevice()) {
        steerL = h.l
        steerR = h.r
      }
    }
    if (steerL) boatX -= 200 * (dt / 1000)
    if (steerR) boatX += 200 * (dt / 1000)
    boatX = Phaser.Math.Clamp(boatX, 40, GAME_W - 40)
    boatY -= 28 * (dt / 1000)

    const w = FERRY_W[seg - 1]!
    for (const gt of gates) {
      if (gt.passed || gt.hit) continue
      if (Math.abs(boatY - gt.y) < 10) {
        if (Math.abs(boatX - gt.cx) <= w / 2 - 8) {
          gt.passed = true
          res.good++
          gateI++
          SFX.coin()
        } else {
          gt.hit = true
          gateI++
          SFX.blip(200)
          floatText(scene, boatX, boatY - 20, '撞到', '#ff8a6a', { size: 12, dur: 450 })
        }
      }
    }

    if (!segDone && gates.every((gt) => gt.passed || gt.hit)) {
      segDone = true
      if (seg >= 3) endAll()
      else {
        seg++
        scene.time.delayedCall(400, beginSeg)
      }
    }
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') boatX -= 20
    if (e.code === 'ArrowRight' || e.code === 'KeyD') boatX += 20
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    boatX = Phaser.Math.Clamp(p.x, 40, GAME_W - 40)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

// ── 5→6 砌回憶 ───────────────────────────────────────────────────────────

const MEM_N = [6, 8, 10] as const
const MEM_PREVIEW = [5000, 4000, 3000] as const
const MEM_COLORS = [0xe08060, 0x60a0e0, 0x70c070, 0xe0c050, 0xc070c0, 0x70c0c0, 0xe09090, 0x90a0e0, 0xa0e090, 0xe0b070]

export function memoryPicsGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-puzzle', '/art/minigames/puzzle-cell.png')
  const ui = frame(scene, TRANSIT_META['memory-pics'].name)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '輪流擺一張' : isTouchDevice() ? '撳圖放去光標位' : '←→揀，攻擊鍵放')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = MEM_N[0]! + MEM_N[1]! + MEM_N[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let phase: 'preview' | 'play' = 'preview'
  let phaseT = 0
  let order: number[] = []
  let shuffled: number[] = []
  let placed: (number | null)[] = []
  let cursor = 0
  let poolCursor = 0
  let turn = 0

  const layout = (n: number) => {
    const cols = n <= 6 ? 3 : n <= 8 ? 4 : 5
    const gap = 56
    const x0 = GAME_W / 2 - ((cols - 1) * gap) / 2
    const y0 = GAME_H / 2 - 10
    return Array.from({ length: n }, (_, i) => ({
      x: x0 + (i % cols) * gap,
      y: y0 + Math.floor(i / cols) * gap,
    }))
  }

  const drawPic = (x: number, y: number, id: number, focus: boolean) => {
    g.fillStyle(MEM_COLORS[id % MEM_COLORS.length]!, 1).fillRoundedRect(x - 20, y - 20, 40, 40, 4)
    g.fillStyle(0xfff8e0, 0.9).fillCircle(x - 6, y - 4, 4)
    g.lineStyle(2, focus ? 0x8ad0ff : 0x2a1810, 1).strokeRoundedRect(x - 20, y - 20, 40, 40, 4)
    g.fillStyle(0x1a1010, 1)
    // tiny number mark
  }

  const draw = () => {
    g.clear()
    const n = order.length
    const spots = layout(n)
    if (phase === 'preview') {
      for (let i = 0; i < n; i++) drawPic(spots[i]!.x, spots[i]!.y, order[i]!, false)
      label.setText(`記住次序… ${Math.ceil(phaseT / 1000)}`)
    } else {
      for (let i = 0; i < n; i++) {
        const v = placed[i]
        if (v != null) drawPic(spots[i]!.x, spots[i]!.y, v, i === cursor)
        else {
          g.fillStyle(0x2a2218, 1).fillRoundedRect(spots[i]!.x - 20, spots[i]!.y - 20, 40, 40, 4)
          if (i === cursor) g.lineStyle(2, 0x8ad0ff, 1).strokeRoundedRect(spots[i]!.x - 20, spots[i]!.y - 20, 40, 40, 4)
        }
      }
      // pool
      const poolY = GAME_H - 110
      for (let i = 0; i < shuffled.length; i++) {
        const x = GAME_W / 2 - ((shuffled.length - 1) * 44) / 2 + i * 44
        drawPic(x, poolY, shuffled[i]!, i === poolCursor)
      }
      label.setText(`第 ${seg} 段　擺 ${placed.filter((x) => x != null).length}／${n}${coop ? (turn ? '　P2' : '　P1') : ''}`)
    }
    ui.bar.width = 216 * (res.good / total)
  }

  const beginSeg = () => {
    const n = MEM_N[seg - 1]!
    order = Array.from({ length: n }, (_, i) => i)
    shuffled = Phaser.Utils.Array.Shuffle([...order])
    placed = Array.from({ length: n }, () => null)
    cursor = 0
    poolCursor = 0
    turn = 0
    phase = 'preview'
    phaseT = MEM_PREVIEW[seg - 1]!
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const place = () => {
    if (finished || phase !== 'play' || !shuffled.length) return
    if (coop) {
      // alternate — both use same controls; turn flips after place
    }
    const nextEmpty = placed.findIndex((x) => x == null)
    if (nextEmpty < 0) return
    cursor = nextEmpty
    const id = shuffled.splice(poolCursor, 1)[0]!
    poolCursor = Math.min(poolCursor, Math.max(0, shuffled.length - 1))
    placed[cursor] = id
    const ok = id === order[cursor]
    if (ok) {
      res.good++
      SFX.coin()
    } else SFX.blip(200)
    turn = 1 - turn
    // advance cursor
    const ne = placed.findIndex((x) => x == null)
    cursor = ne < 0 ? cursor : ne
    if (placed.every((x) => x != null)) {
      if (seg >= 3) endAll()
      else {
        seg++
        scene.time.delayedCall(500, beginSeg)
      }
    }
    draw()
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'memory', 'memory-pics'))
    ui.title.setText(res.grade === 'gold' ? '野餐嗰日…' : '砌好喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const onKey = (e: KeyboardEvent) => {
    if (phase !== 'play') return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') poolCursor = (poolCursor - 1 + shuffled.length) % Math.max(1, shuffled.length)
    if (e.code === 'ArrowRight' || e.code === 'KeyD') poolCursor = (poolCursor + 1) % Math.max(1, shuffled.length)
    if (['Space', 'KeyF', 'KeyJ', 'Enter', 'KeyZ', 'KeyX'].includes(e.code)) place()
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (phase !== 'play' || !shuffled.length) return
    const poolY = GAME_H - 110
    if (Math.abs(p.y - poolY) < 40) {
      let best = 0
      let bestD = 9999
      for (let i = 0; i < shuffled.length; i++) {
        const x = GAME_W / 2 - ((shuffled.length - 1) * 44) / 2 + i * 44
        const d = Math.abs(p.x - x)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      poolCursor = best
      place()
    } else place()
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (phase === 'preview') {
      phaseT -= dt
      if (phaseT <= 0) {
        phase = 'play'
        SFX.blip(500)
      }
      draw()
      return
    }
    if (TouchInput.justPressed('left') && shuffled.length) poolCursor = (poolCursor - 1 + shuffled.length) % shuffled.length
    if (TouchInput.justPressed('right') && shuffled.length) poolCursor = (poolCursor + 1) % shuffled.length
    if (p1Attack()) place()
    draw()
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

// ── 7→8 避燈潛入 ─────────────────────────────────────────────────────────

const STEALTH_DARK = [1600, 1200, 900] as const
const STEALTH_ROOMS = 3
const STEALTH_CROSS = 4

export function stealthGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-cone', '/art/minigames/searchlight-cone.png')
  const ui = frame(scene, TRANSIT_META.stealth.name, 0.85)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '燈移開先行；中燈只自己重來' : isTouchDevice() ? '暗位先撳前行' : '暗位撳攻擊鍵前進')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = STEALTH_ROOMS * STEALTH_CROSS
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let room = 1
  let lit = false
  let phaseT = 0
  let warn = false
  let progress = [0, 0] // per player steps in room
  let awarded = [0, 0] // steps already scored (survives restart)
  let active = [true, true]
  let pad2Prev = false
  let roomDone = false

  const draw = () => {
    g.clear()
    g.fillStyle(0x0a0810, 1).fillRect(40, 120, GAME_W - 80, 160)
    g.lineStyle(2, 0x4a4050, 1).strokeRect(40, 120, GAME_W - 80, 160)
    // rooms markers
    for (let i = 0; i < STEALTH_ROOMS; i++) {
      const x = 80 + i * ((GAME_W - 160) / 2)
      g.fillStyle(i + 1 === room ? 0x3a3050 : 0x1a1828, 1).fillRect(x, 140, 100, 120)
    }
    const coneAlpha = lit ? 0.55 : warn ? 0.25 : 0.05
    g.fillStyle(0xfff0a0, coneAlpha)
    const cx = 80 + (room - 1) * ((GAME_W - 160) / 2) + 50
    g.fillTriangle(cx, 130, cx - 50, 260, cx + 50, 260)
    if (scene.textures.exists('mg-cone') && lit) {
      /* optional */
    }
    const n = coop ? 2 : 1
    for (let i = 0; i < n; i++) {
      if (!active[i] && coop) continue
      const x = 100 + (room - 1) * 140 + progress[i]! * 22 + i * 16
      g.fillStyle(i === 0 ? 0x4a90d0 : 0xe080a0, 1).fillCircle(x, 230, 10)
    }
    label.setText(
      lit ? '有燈！停！' : warn ? '燈要嚟…' : `房 ${room}　行 ${Math.max(progress[0]!, progress[1]!)}／${STEALTH_CROSS}`,
    )
    ui.bar.width = 216 * (res.good / total)
  }

  const beginRoom = () => {
    progress = [0, 0]
    awarded = [0, 0]
    active = [true, true]
    roomDone = false
    lit = false
    warn = false
    phaseT = STEALTH_DARK[Math.min(2, room - 1)]!
    void showSegmentBanner(scene, Math.min(3, room) as 1 | 2 | 3)
    draw()
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'timing', 'stealth'))
    ui.title.setText(res.grade === 'gold' ? '燈照唔到！' : '潛入成功')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const tryStep = (who: 0 | 1) => {
    if (finished || roomDone || !active[who]) return
    if (lit) {
      progress[who] = awarded[who]! // restart to last scored position
      SFX.blip(160)
      floatText(scene, GAME_W / 2, 150, who ? 'P2重來' : coop ? 'P1重來' : '重來', '#ff8a6a', { size: 13, dur: 500 })
      return
    }
    progress[who]!++
    if (progress[who]! > awarded[who]!) {
      awarded[who] = progress[who]!
      // Shared pool capped at total so 2P cannot exceed 1P max score.
      if (res.good < total) res.good++
      SFX.coin()
    }
    if (Math.max(progress[0]!, coop ? progress[1]! : 0) >= STEALTH_CROSS) {
      roomDone = true
      if (room >= STEALTH_ROOMS) endAll()
      else {
        room++
        scene.time.delayedCall(400, beginRoom)
      }
    }
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    phaseT -= dt
    const dark = STEALTH_DARK[Math.min(2, room - 1)]!
    if (!lit && !warn && phaseT <= WARN_MS) {
      warn = true
      SFX.blip(380)
    }
    if (!lit && phaseT <= 0) {
      lit = true
      warn = false
      phaseT = 700 // lit duration
    } else if (lit && phaseT <= 0) {
      lit = false
      warn = false
      phaseT = dark
    }
    if (p1Attack() || TouchInput.justPressed('up') || TouchInput.justPressed('right')) tryStep(0)
    const p2 = p2AttackEdge(pad2Prev)
    pad2Prev = p2.down
    if (coop && p2.edge) tryStep(1)
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (['Space', 'KeyF', 'KeyJ', 'ArrowUp', 'ArrowRight', 'Enter'].includes(e.code)) tryStep(0)
    if (coop && ['Comma', 'Period', 'Numpad1', 'Numpad2'].includes(e.code)) tryStep(1)
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (coop && p.x > GAME_W / 2) tryStep(1)
    else tryStep(0)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginRoom()
  return { done, destroy }
}

// ── 8→9 端咖啡落樓 ───────────────────────────────────────────────────────

const COFFEE_STAIRS = [8, 12, 16] as const
const COFFEE_SHAKE = [1, 2, 3] as const

export function coffeeTrayGame(scene: Phaser.Scene): Mini<RoundResult> {
  const ui = frame(scene, TRANSIT_META['coffee-tray'].name)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '一人一杯，扶穩落樓' : isTouchDevice() ? '左右扶平托盤' : '←→ 扶平，唔好瀉')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = COFFEE_STAIRS[0]! + COFFEE_STAIRS[1]! + COFFEE_STAIRS[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let step = 0
  let tiltA = 0
  let tiltB = 0
  let shakeLeft = 0
  let shakeIn = 0
  let shakeWarn = false
  let shakeDir = 0
  let settle = 0

  const draw = () => {
    g.clear()
    const stairs = COFFEE_STAIRS[seg - 1]!
    for (let i = 0; i < stairs; i++) {
      const y = 120 + i * 12
      const x = 80 + i * 18
      g.fillStyle(i < step ? 0x5a5040 : 0x3a3428, 1).fillRect(x, y, 200, 10)
    }
    const n = coop ? 2 : 1
    for (let i = 0; i < n; i++) {
      const tilt = i === 0 ? tiltA : tiltB
      const x = GAME_W / 2 + (i === 0 ? -50 : 50)
      const y = 130 + step * 10
      g.fillStyle(0xf4e8d0, 1).fillRect(x - 22, y - 6 + tilt * 10, 44, 8)
      g.fillStyle(0x6a3a18, 1).fillCircle(x - 10, y - 14 + tilt * 10, 7)
      g.fillStyle(0x6a3a18, 1).fillCircle(x + 10, y - 14 + tilt * 10, 7)
      g.fillStyle(i === 0 ? 0x4a90d0 : 0xe080a0, 1).fillCircle(x, y + 18, 12)
    }
    if (shakeWarn) {
      label.setText('搖晃！反向扶')
      g.fillStyle(0xffe08a, 0.4).fillTriangle(shakeDir < 0 ? 100 : GAME_W - 100, 160, shakeDir < 0 ? 60 : GAME_W - 60, 180, shakeDir < 0 ? 100 : GAME_W - 100, 200)
    } else {
      label.setText(`第 ${seg} 段　${step}／${stairs} 級`)
    }
    ui.bar.width = 216 * (res.good / total)
  }

  const beginSeg = () => {
    step = 0
    tiltA = 0
    tiltB = 0
    shakeLeft = COFFEE_SHAKE[seg - 1]!
    shakeIn = 1200
    shakeWarn = false
    settle = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3)
    draw()
  }

  const advance = () => {
    if (finished || settle > 0) return
    const spill = Math.abs(tiltA) > 0.75 || (coop && Math.abs(tiltB) > 0.75)
    if (spill) {
      SFX.blip(200)
      floatText(scene, GAME_W / 2, 150, '瀉咗', '#ff8a6a', { size: 13, dur: 450 })
      tiltA *= 0.3
      tiltB *= 0.3
    } else {
      res.good++
      SFX.coin()
    }
    step++
    settle = 280
    const stairs = COFFEE_STAIRS[seg - 1]!
    if (step >= stairs) {
      if (seg >= 3) endAll()
      else {
        seg++
        scene.time.delayedCall(450, beginSeg)
      }
    }
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'balance', 'coffee-tray'))
    ui.title.setText(res.grade === 'gold' ? '一滴都冇瀉！' : '到樓下喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) settle -= dt
    const h = heldLR()
    if (h.l) tiltA -= 1.2 * (dt / 1000)
    if (h.r) tiltA += 1.2 * (dt / 1000)
    // gravity toward spill
    tiltA += Math.sign(tiltA || 0.01) * 0.15 * (dt / 1000)
    tiltA = Phaser.Math.Clamp(tiltA, -1, 1)
    if (coop) {
      const pad = p2Pad()
      const ax = pad?.axes?.[0] ?? 0
      tiltB += ax * 1.2 * (dt / 1000)
      tiltB += Math.sign(tiltB || 0.01) * 0.15 * (dt / 1000)
      tiltB = Phaser.Math.Clamp(tiltB, -1, 1)
    }
    if (shakeLeft > 0) {
      shakeIn -= dt
      if (!shakeWarn && shakeIn <= WARN_MS) {
        shakeWarn = true
        shakeDir = Math.random() > 0.5 ? 1 : -1
        SFX.blip(420)
      }
      if (shakeIn <= 0) {
        tiltA = Phaser.Math.Clamp(tiltA + shakeDir * 0.55, -1, 1)
        if (coop) tiltB = Phaser.Math.Clamp(tiltB + shakeDir * 0.55, -1, 1)
        shakeWarn = false
        shakeLeft--
        shakeIn = 1400
      }
    }
    if (p1Attack() || TouchInput.justPressed('down')) advance()
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') tiltA -= 0.2
    if (e.code === 'ArrowRight' || e.code === 'KeyD') tiltA += 0.2
    if (['Space', 'KeyF', 'KeyJ', 'ArrowDown', 'Enter'].includes(e.code)) advance()
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (p.y > GAME_H * 0.65) advance()
    else tiltA = Phaser.Math.Clamp((p.x - GAME_W / 2) / 120, -1, 1)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

// ── 9→10 合照 ────────────────────────────────────────────────────────────

const PHOTO_CD = [3000, 2000, 1500] as const
const PHOTO_POSES = [3, 4, 5] as const
const POSE_DIRS = ['←', '→', '↑', '↓'] as const
const POSE_KEYS = ['left', 'right', 'up', 'down'] as const

export function photoGame(scene: Phaser.Scene): Mini<RoundResult> {
  ensureMgTex(scene, 'mg-cam', '/art/minigames/camera-frame.png')
  ensureMgSheet(scene, 'mg-flash', '/art/minigames/flash.png', 32, 32)
  const ui = frame(scene, TRANSIT_META.photo.name)
  const coop = twoP(scene)
  ui.hint.setText(coop ? '各自跟剪影擺姿勢' : isTouchDevice() ? '跟剪影撳方向' : '倒數完前撳啱方向；噗噗自動')
  const g = scene.add.graphics()
  const label = scene.add.text(GAME_W / 2, SEG_LABEL_Y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  const total = PHOTO_POSES[0]! + PHOTO_POSES[1]! + PHOTO_POSES[2]!
  const res: RoundResult = { good: 0, total }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false
  let seg = 1
  let poseI = 0
  let target = 0
  let cd = 0
  let locked = false
  let p1Pick: number | null = null
  let p2Pick: number | null = null
  let pad2Prev = false

  const drawSilhouette = (x: number, y: number, dir: number, ghost: boolean) => {
    const col = ghost ? 0x2a2030 : 0x4a90d0
    g.fillStyle(col, ghost ? 0.55 : 1).fillCircle(x, y - 20, 12)
    g.fillStyle(col, ghost ? 0.55 : 1).fillRect(x - 10, y - 8, 20, 28)
    // arm pose
    if (dir === 0) g.fillStyle(col, 1).fillRect(x - 28, y - 4, 18, 6)
    if (dir === 1) g.fillStyle(col, 1).fillRect(x + 10, y - 4, 18, 6)
    if (dir === 2) g.fillStyle(col, 1).fillRect(x - 4, y - 36, 8, 16)
    if (dir === 3) g.fillStyle(col, 1).fillRect(x - 4, y + 18, 8, 14)
  }

  const draw = () => {
    g.clear()
    // camera frame
    if (scene.textures.exists('mg-cam')) {
      /* decorative */
    }
    g.lineStyle(4, 0xe8e0d0, 1).strokeRect(80, 120, GAME_W - 160, 160)
    g.fillStyle(0x1a1520, 0.5).fillRect(80, 120, GAME_W - 160, 160)
    drawSilhouette(GAME_W / 2 - (coop ? 60 : 30), 200, target, true)
    if (!coop) {
      // pupu auto silhouette
      g.fillStyle(0xe0a060, 0.7).fillCircle(GAME_W / 2 + 40, 210, 10)
    } else {
      drawSilhouette(GAME_W / 2 + 60, 200, target, true)
    }
    if (p1Pick != null) drawSilhouette(GAME_W / 2 - (coop ? 60 : 30), 200, p1Pick, false)
    if (coop && p2Pick != null) drawSilhouette(GAME_W / 2 + 60, 200, p2Pick, false)
    const sec = Math.max(0, cd / 1000)
    label.setText(`第 ${seg} 段　${POSE_DIRS[target]}　${sec.toFixed(1)}s`)
    ui.bar.width = 216 * (res.good / total)
  }

  const nextPose = () => {
    locked = false
    p1Pick = null
    p2Pick = null
    target = Phaser.Math.Between(0, 3)
    cd = PHOTO_CD[seg - 1]!
    draw()
  }

  const beginSeg = () => {
    poseI = 0
    void showSegmentBanner(scene, seg as 1 | 2 | 3).then(nextPose)
  }

  const resolvePose = () => {
    if (locked || finished) return
    locked = true
    // 1P: pupu auto matches; player must match
    // 2P: either player matching counts (must not be harder than 1P).
    const p1ok = p1Pick === target
    const p2ok = coop && p2Pick === target
    const fair = coop ? p1ok || !!p2ok : p1ok
    if (fair) {
      res.good++
      SFX.coin()
      floatText(scene, GAME_W / 2, 140, '咔嚓！', '#80ff90', { size: 14, dur: 500 })
    } else {
      SFX.blip(200)
      floatText(scene, GAME_W / 2, 140, '歪咗', '#ff8a6a', { size: 14, dur: 500 })
    }
    // flash
    g.fillStyle(0xffffff, 0.6).fillRect(80, 120, GAME_W - 160, 160)
    poseI++
    const need = PHOTO_POSES[seg - 1]!
    if (poseI >= need) {
      if (seg >= 3) {
        scene.time.delayedCall(500, endAll)
      } else {
        seg++
        scene.time.delayedCall(500, beginSeg)
      }
    } else {
      scene.time.delayedCall(450, nextPose)
    }
  }

  const endAll = () => {
    if (finished) return
    finished = true
    Object.assign(res, finishRound(res, 'reaction', 'photo'))
    if (res.grade === 'gold') {
      galleryMarkStory('c1-picnic') // gallery photo unlock if possible
      galleryMarkStory('photo-trio')
    }
    ui.title.setText(res.grade === 'gold' ? '三個人，一張相' : '影好喇')
    SFX.sparkle()
    scene.time.delayedCall(700, destroy)
  }

  const pick = (who: 0 | 1, dir: number) => {
    if (locked || finished) return
    if (who === 0) p1Pick = dir
    else p2Pick = dir
    draw()
  }

  const tick = (_t: number, dt: number) => {
    if (finished || locked || cd <= 0) return
    cd -= dt
    for (let i = 0; i < 4; i++) {
      if (TouchInput.justPressed(POSE_KEYS[i]!)) pick(0, i)
    }
    const pad = p2Pad()
    if (coop && pad) {
      const dirs = [
        (pad.axes?.[0] ?? 0) < -0.5,
        (pad.axes?.[0] ?? 0) > 0.5,
        (pad.axes?.[1] ?? 0) < -0.5,
        (pad.axes?.[1] ?? 0) > 0.5,
      ]
      // edge via attack for confirm not needed — axis hold sets pose
      for (let i = 0; i < 4; i++) if (dirs[i]) pick(1, i)
    }
    const p2a = p2AttackEdge(pad2Prev)
    pad2Prev = p2a.down
    if (cd <= 0) resolvePose()
    draw()
  }

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: 0,
      KeyA: 0,
      ArrowRight: 1,
      KeyD: 1,
      ArrowUp: 2,
      KeyW: 2,
      ArrowDown: 3,
      KeyS: 3,
    }
    if (e.code in map) pick(0, map[e.code]!)
    if (coop) {
      const p2map: Record<string, number> = { Numpad4: 0, Numpad6: 1, Numpad8: 2, Numpad2: 3, Comma: 0, Period: 1 }
      if (e.code in p2map) pick(1, p2map[e.code]!)
    }
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    const who: 0 | 1 = coop && p.x > GAME_W / 2 ? 1 : 0
    const dx = p.x - (who ? GAME_W * 0.75 : GAME_W * 0.25)
    const dy = p.y - 200
    if (Math.abs(dx) > Math.abs(dy)) pick(who, dx < 0 ? 0 : 1)
    else pick(who, dy < 0 ? 2 : 3)
  }

  const destroy = () => {
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', onTap)
    ui.root.destroy(true)
    resolve(res)
  }

  scene.events.on('update', tick)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  beginSeg()
  return { done, destroy }
}

/** Dispatch by transit id. */
export function startTransitGame(scene: Phaser.Scene, id: TransitId): Mini<RoundResult> {
  switch (id) {
    case 'bike-climb':
      return bikeClimbGame(scene)
    case 'umbrella':
      return umbrellaGame(scene)
    case 'kite':
      return kiteGame(scene)
    case 'ferry':
      return ferryGame(scene)
    case 'memory-pics':
      return memoryPicsGame(scene)
    case 'stealth':
      return stealthGame(scene)
    case 'coffee-tray':
      return coffeeTrayGame(scene)
    case 'photo':
      return photoGame(scene)
  }
}
