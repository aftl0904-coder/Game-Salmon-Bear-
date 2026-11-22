import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { markHd } from './heroAnims'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { floatText } from './fx'
import { buzz, HAPTIC, isTouchDevice, startMotion, takeShake, tilt, tiltY } from './phone'

/**
 * Little phone-feel minigames shown as overlays (they never block the story: each has a
 * generous timeout that finishes it for you).
 *  - shakeHoney: shake the phone (or mash) to mix the picnic honey
 *  - stirCoffee: draw circles (or rotate the stick / arrows) to stir 咖啡媽媽's coffee
 */

export type Mini<T = void> = { done: Promise<T>; destroy: () => void }
export type CoffeeResult = { stirred: number }

function frame(scene: Phaser.Scene, title: string, dim = 0.72) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 260)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, dim).setOrigin(0).setInteractive())
  const t = scene.add
    .text(GAME_W / 2, 76, title, { fontFamily: FONT_UI, fontSize: '18px', color: '#ffe08a', stroke: '#2a1408', strokeThickness: 4 })
    .setOrigin(0.5)
  const hint = scene.add.text(GAME_W / 2, GAME_H - 46, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#f0dcb0', align: 'center' }).setOrigin(0.5)
  const barBg = scene.add.rectangle(GAME_W / 2, GAME_H - 72, 220, 10, 0x2a1a10).setStrokeStyle(2, 0xc8902a)
  const bar = scene.add.rectangle(GAME_W / 2 - 108, GAME_H - 72, 0, 6, 0xffc040).setOrigin(0, 0.5)
  root.add([t, hint, barBg, bar])
  return { root, title: t, hint, bar }
}

/**
 * 1–3 pages of "how to play" before a minigame (Alan, 2026-10-27). Shown in full the first
 * time, then as a one-line reminder. Start skips the whole minigame for the base reward.
 */
const SEEN_KEY = 'sake-kuma-mg-seen-v1'

function seen(id: string): boolean {
  try {
    return !!JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')[id]
  } catch {
    return false
  }
}
function markSeen(id: string) {
  try {
    const o = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
    o[id] = true
    localStorage.setItem(SEEN_KEY, JSON.stringify(o))
  } catch {
    /* private mode — the pages just show again */
  }
}

export type Page = { title: string; lines: string[]; tip?: string }

/** Resolves 'play' to start, or 'skip' when the player opts out (base reward only). */
export function showTutorial(scene: Phaser.Scene, id: string, pages: Page[]): Promise<'play' | 'skip'> {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 270)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, 0.9).setOrigin(0).setInteractive())
  const g = scene.add.graphics()
  g.fillStyle(0xc8902a, 1).fillRect(40, 60, GAME_W - 80, GAME_H - 130)
  g.fillStyle(0x1a1210, 0.98).fillRect(43, 63, GAME_W - 86, GAME_H - 136)
  root.add(g)
  const short = seen(id)
  const list = short ? pages.slice(0, 1) : pages
  let i = 0
  const title = scene.add
    .text(GAME_W / 2, 92, '', { fontFamily: FONT_UI, fontSize: '17px', color: '#ffd76a', stroke: '#2a1408', strokeThickness: 4 })
    .setOrigin(0.5)
  const body = scene.add
    .text(GAME_W / 2, 132, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#fff6e0', align: 'center', lineSpacing: 9, wordWrap: { width: GAME_W - 130 } })
    .setOrigin(0.5, 0)
  const tip = scene.add
    .text(GAME_W / 2, GAME_H - 104, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#8ad0ff', align: 'center', wordWrap: { width: GAME_W - 130 } })
    .setOrigin(0.5, 0)
  const nav = scene.add
    .text(GAME_W / 2, GAME_H - 48, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#f0dcb0' })
    .setOrigin(0.5)
  const pageNo = scene.add.text(GAME_W - 56, 92, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8b090' }).setOrigin(1, 0.5)
  root.add([title, body, tip, nav, pageNo])

  return new Promise<'play' | 'skip'>((resolve) => {
    let gone = false
    const end = (r: 'play' | 'skip') => {
      if (gone) return
      gone = true
      markSeen(id)
      scene.events.off('update', tick)
      scene.input.keyboard?.off('keydown', onKey)
      scene.input.off('pointerdown', onTap)
      root.destroy(true)
      resolve(r)
    }
    const draw = () => {
      const p = list[i]!
      title.setText(p.title)
      body.setText(p.lines.join('\n'))
      tip.setText(p.tip ?? '')
      pageNo.setText(list.length > 1 ? `${i + 1}／${list.length}` : '')
      nav.setText(i < list.length - 1 ? '撳一下 ▶ 下一頁　　Start＝跳過唔玩' : '撳一下 ▶ 開始　　Start＝跳過唔玩')
    }
    const next = () => {
      if (i < list.length - 1) {
        i++
        SFX.blip(620)
        draw()
      } else end('play')
    }
    const onTap = () => next()
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', 'Escape'].includes(e.code) || e.code === 'Enter') end('skip')
      else next()
    }
    const tick = () => {
      if (gone) return
      if (TouchInput.justPressed('start') || TouchInput.justPressed('menu')) end('skip')
      else if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) next()
    }
    scene.input.on('pointerdown', onTap)
    scene.input.keyboard?.on('keydown', onKey)
    scene.events.on('update', tick)
    // A skip button so a phone player never has to find a key.
    const skipBtn = scene.add
      .text(GAME_W - 54, GAME_H - 48, '跳過 ▶▶', { fontFamily: FONT_UI, fontSize: '11px', color: '#e0b86a', backgroundColor: '#2a1a10', padding: { x: 6, y: 3 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    skipBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.()
      end('skip')
    })
    root.add(skipBtn)
    draw()
  })
}

const anyPress = () =>
  TouchInput.justPressed('attack') || TouchInput.justPressed('jump') || TouchInput.justPressed('start') || TouchInput.justPressed('special')

// ── 搖勻蜂蜜 ─────────────────────────────────────────────────────────────

export function shakeHoney(scene: Phaser.Scene): Mini {
  const ui = frame(scene, '搖勻啲蜂蜜！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '左右搖電話（或者連撳畫面）' : '連撳 空白鍵／攻擊鍵')
  const jarKey = scene.textures.exists('cs-jar-real') ? 'cs-jar-real' : 'coin'
  const jar = scene.add.image(GAME_W / 2, GAME_H / 2 + 30, jarKey).setOrigin(0.5, 0.85).setScale(3)
  ui.root.add(jar)
  void startMotion()
  let progress = 0
  let wobble = 0
  let finished = false
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))
  const add = (v: number) => {
    if (finished) return
    progress = Math.min(1, progress + v)
    wobble = Math.min(1, wobble + v * 6)
  }
  const onTap = () => {
    add(1 / 16)
    SFX.blip(520 + progress * 400)
    buzz(HAPTIC.click)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!e.repeat) onTap()
  }
  scene.input.on('pointerdown', onTap)
  scene.input.keyboard?.on('keydown', onKey)
  const started = scene.time.now
  let lastBuzz = 0
  const tick = () => {
    if (finished) return
    const e = takeShake()
    if (e > 0) {
      add(e / 900)
      if (scene.time.now - lastBuzz > 120) {
        buzz(12)
        lastBuzz = scene.time.now
      }
    }
    if (anyPress()) onTap()
    wobble = Math.max(0, wobble - 0.03)
    jar.setAngle(Math.sin(scene.time.now / 45) * 28 * wobble)
    ui.bar.width = 216 * progress
    if (progress >= 1 || scene.time.now - started > 15000) finish()
  }
  const finish = () => {
    finished = true
    jar.setAngle(0)
    ui.bar.width = 216
    ui.title.setText(progress >= 1 ? '搖勻咗！好香呀～' : '（幫你搖埋）')
    SFX.sparkle()
    buzz(HAPTIC.honey)
    const glow = scene.add.circle(jar.x, jar.y - 30, 50, 0xffd060, 0.35).setBlendMode(Phaser.BlendModes.ADD)
    ui.root.addAt(glow, 1)
    scene.time.delayedCall(900, () => {
      destroy()
      resolve()
    })
  }
  scene.events.on('update', tick)
  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    scene.events.off('update', tick)
    scene.input.off('pointerdown', onTap)
    scene.input.keyboard?.off('keydown', onKey)
    ui.root.destroy(true)
    resolve()
  }
  return { done, destroy }
}

// ── 攪咖啡 ─────────────────────────────────────────────────────────────

const DIRS: Record<string, number> = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
}

/** Stir for up to 8 s, then done. */
export function stirCoffee(scene: Phaser.Scene): Mini<CoffeeResult> {
  const ui = frame(scene, '咖啡媽媽：攪勻杯咖啡先飲！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '手指喺杯上面打圈' : '方向鍵轉圈（↑→↓←）')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 16
  const R = 62
  // Mug: rim, coffee, handle; latte swirl drawn each frame.
  const g = scene.add.graphics()
  g.fillStyle(0x1a1210, 1).fillCircle(cx, cy, R + 10)
  g.fillStyle(0xf4ead8, 1).fillCircle(cx, cy, R + 8)
  g.fillStyle(0x1a1210, 1).fillRoundedRect(cx + R + 2, cy - 18, 30, 36, 12)
  g.fillStyle(0xf4ead8, 1).fillRoundedRect(cx + R + 6, cy - 12, 20, 24, 8)
  g.fillStyle(0x5a3418, 1).fillCircle(cx, cy, R)
  const swirl = scene.add.graphics()
  const spoon = scene.add.graphics()
  ui.root.add([g, swirl, spoon])
  let acc = 0 // radians stirred (signed)
  let prevA: number | null = null
  let prevDir = -1
  let phase: 'stir' | 'end' = 'stir'
  const result: CoffeeResult = { stirred: 0 }
  let resolve!: (r: CoffeeResult) => void
  const done = new Promise<CoffeeResult>((r) => (resolve = r))
  const started = scene.time.now
  const STIR_MS = 8000
  const timer = scene.add.text(GAME_W / 2 + 128, GAME_H - 72, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' }).setOrigin(0, 0.5)
  ui.root.add([timer])

  const turnBy = (d: number) => {
    acc += d
    if (Math.abs(d) > 0.05) {
      const t = scene.time.now
      if (t % 4 < 1) buzz(8)
    }
  }
  const onMove = (p: Phaser.Input.Pointer) => {
    if (phase !== 'stir' || !p.isDown) return
    const a = Math.atan2(p.y - cy, p.x - cx)
    if (prevA !== null) {
      let d = a - prevA
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      if (Math.abs(d) < 1.2) turnBy(d)
    }
    prevA = a
  }
  const onDown = (p: Phaser.Input.Pointer) => {
    prevA = Math.atan2(p.y - cy, p.x - cx)
  }
  const onUp = () => {
    prevA = null
  }
  const dirStep = (d: number) => {
    if (prevDir >= 0) {
      if (d === (prevDir + 1) % 4) turnBy(Math.PI / 2)
      else if (d === (prevDir + 3) % 4) turnBy(-Math.PI / 2)
    }
    prevDir = d
  }
  const onKey = (e: KeyboardEvent) => {
    if (phase === 'stir' && e.code in DIRS) dirStep(DIRS[e.code]!)
  }
  const onKeyUp = () => {}
  scene.input.on('pointermove', onMove)
  scene.input.on('pointerdown', onDown)
  scene.input.on('pointerup', onUp)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.keyboard?.on('keyup', onKeyUp)

  const NEED = Math.PI * 2 * 3 // three full turns
  const tick = (_t: number, _dt: number) => {
    if (phase === 'end') return
    if (phase === 'stir') {
      // Touch pad / gamepad stick: rotate through the four directions.
      for (const [k, d] of [['up', 0], ['right', 1], ['down', 2], ['left', 3]] as const) if (TouchInput.justPressed(k)) dirStep(d)
      const now = scene.time.now
      const left = Math.max(0, STIR_MS - (now - started))
      timer.setText(`${(left / 1000).toFixed(1)}秒`).setColor(left < 2500 ? '#ff8a6a' : '#ffe08a')
      const p = Math.min(1, Math.abs(acc) / NEED)
      ui.bar.width = 216 * p
      const sp = Math.sign(acc) || 1
      // Latte swirl spins with the stirring and blends in.
      swirl.clear()
      for (let k = 0; k < 3; k++) {
        swirl.lineStyle(3, 0xe8c8a0, 0.9 - p * 0.6)
        swirl.beginPath()
        for (let i = 0; i <= 24; i++) {
          const th = acc * 1.2 + k * 2.1 + i * 0.22 * sp
          const r = 8 + i * 2
          const x = cx + Math.cos(th) * r
          const y = cy + Math.sin(th) * r
          if (i === 0) swirl.moveTo(x, y)
          else swirl.lineTo(x, y)
        }
        swirl.strokePath()
      }
      swirl.fillStyle(0xc89a6a, p * 0.7).fillCircle(cx, cy, R - 4)
      const sa = acc * 1.0 - Math.PI / 2
      spoon.clear()
      spoon.lineStyle(5, 0x1a1210, 1).lineBetween(cx + Math.cos(sa) * 30, cy + Math.sin(sa) * 30, cx + Math.cos(sa) * 30 + 30, cy + Math.sin(sa) * 30 - 70)
      spoon.lineStyle(3, 0xc8c8d0, 1).lineBetween(cx + Math.cos(sa) * 30, cy + Math.sin(sa) * 30, cx + Math.cos(sa) * 30 + 30, cy + Math.sin(sa) * 30 - 70)
      spoon.fillStyle(0xc8c8d0, 1).fillEllipse(cx + Math.cos(sa) * 30, cy + Math.sin(sa) * 30, 12, 8)
      result.stirred = p
      if (p >= 1 || left <= 0) finish()
    }
  }
  const finish = () => {
    phase = 'end'
    ui.bar.width = 216
    ui.title.setText(result.stirred >= 1 ? '啱啱好！飲啦～' : '未攪勻……都飲咗先！')
    SFX.gulp()
    buzz(HAPTIC.power)
    scene.time.delayedCall(800, () => {
      destroy()
    })
  }
  scene.events.on('update', tick)
  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    phase = 'end'
    scene.events.off('update', tick)
    scene.input.off('pointermove', onMove)
    scene.input.off('pointerdown', onDown)
    scene.input.off('pointerup', onUp)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.keyboard?.off('keyup', onKeyUp)
    ui.root.destroy(true)
    resolve(result)
  }
  return { done, destroy }
}

// ── 倒漿：撳住倒，啱啱滿放手 ─────────────────────────────────────────────

export type RoundResult = { good: number; total: number }

/**
 * Hold to pour, let go when the mould is just full (第 2 關・夾餅叔叔).
 * Overflow is the punishment, so letting go early is safe but scores less.
 */
export function pourGame(scene: Phaser.Scene, rounds = 3): Mini<RoundResult> {
  const ui = frame(scene, '夾餅叔叔：倒啱啱滿')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '撳住畫面倒漿，啱啱滿就放手' : '撳住 攻擊鍵／空白鍵 倒漿，啱啱滿就放手')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 20
  const W = 150
  const H = 54
  const g = scene.add.graphics()
  const jug = scene.add.graphics()
  const label = scene.add.text(cx, cy - 72, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, jug, label])

  let fill = 0
  let held = false
  let round = 1
  let spilled = false
  let settle = 0
  const res: RoundResult = { good: 0, total: rounds }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  const started = scene.time.now

  const draw = () => {
    g.clear()
    g.fillStyle(0x1a1210, 1).fillRect(cx - W / 2 - 4, cy - H / 2 - 4, W + 8, H + 8)
    g.fillStyle(0x6a5038, 1).fillRect(cx - W / 2, cy - H / 2, W, H)
    // The target band: stop anywhere inside it.
    g.fillStyle(0x3a8a40, 0.5).fillRect(cx - W / 2, cy + H / 2 - H * 1.0, W, H * 0.12)
    const h = Math.min(1.12, fill) * H
    g.fillStyle(spilled ? 0x8a5a2a : 0xe8c060, 1).fillRect(cx - W / 2 + 2, cy + H / 2 - h, W - 4, Math.min(h, H - 2))
    if (fill > 1) {
      g.fillStyle(0xe8c060, 0.8).fillRect(cx - W / 2 - 10, cy + H / 2, 8, (fill - 1) * 80)
      g.fillStyle(0xe8c060, 0.8).fillRect(cx + W / 2 + 2, cy + H / 2, 8, (fill - 1) * 80)
    }
    jug.clear()
    if (held) {
      jug.fillStyle(0xe8c060, 1).fillRect(cx - 4, cy - H / 2 - 44, 8, 40)
      jug.fillStyle(0xfff0c0, 0.7).fillRect(cx - 2, cy - H / 2 - 44, 3, 40)
    }
    jug.fillStyle(0x1a1210, 1).fillRoundedRect(cx - 34, cy - H / 2 - 74, 60, 30, 6)
    jug.fillStyle(0xc8c8d0, 1).fillRoundedRect(cx - 32, cy - H / 2 - 72, 56, 26, 6)
    label.setText(`第 ${round} ／ ${rounds} 底　　${Math.round(Math.min(fill, 1.2) * 100)}%`)
    ui.bar.width = 216 * Math.min(1, fill)
  }

  const land = () => {
    // 0.92–1.0 is the sweet spot; over 1.0 spills.
    const ok = fill >= 0.9 && fill <= 1.02
    if (ok) {
      res.good++
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, cx, cy - 40, '啱啱好！', '#ffd040', { size: 16, dur: 800 })
    } else if (fill > 1.02) {
      SFX.potShatter()
      buzz(40)
      floatText(scene, cx, cy - 40, '瀉咗！', '#ff8a6a', { size: 15, dur: 800 })
    } else {
      SFX.blip(240)
      floatText(scene, cx, cy - 40, '唔夠滿', '#c0b0a0', { size: 14, dur: 800 })
    }
    settle = 650
  }

  let finished = false
  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) {
      settle -= dt
      if (settle <= 0) {
        round++
        if (round > rounds) return finish()
        fill = 0
        spilled = false
        draw()
      }
      return
    }
    const down = scene.input.activePointer.isDown || TouchInput.isDown('attack') || TouchInput.isDown('jump') || keyDown
    if (down && !held) held = true
    if (!down && held) {
      held = false
      land()
    }
    if (held) {
      fill += dt / 1250
      if (fill > 1.02) spilled = true
      if (fill > 1.3) {
        held = false
        land()
      }
    }
    draw()
    if (scene.time.now - started > 22000) finish()
  }
  let keyDown = false
  const onDown = (e: KeyboardEvent) => {
    if (['Space', 'KeyF', 'KeyJ', 'KeyK'].includes(e.code)) keyDown = true
  }
  const onUp = (e: KeyboardEvent) => {
    if (['Space', 'KeyF', 'KeyJ', 'KeyK'].includes(e.code)) keyDown = false
  }
  scene.input.keyboard?.on('keydown', onDown)
  scene.input.keyboard?.on('keyup', onUp)
  scene.events.on('update', tick)

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onDown)
    scene.input.keyboard?.off('keyup', onUp)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    ui.title.setText(res.good >= rounds ? '全部啱啱好！' : res.good > 0 ? `整好 ${res.good} 底` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(800, destroy)
  }
  draw()
  return { done, destroy }
}

// ── 指針條：啱嗰刻撳 ────────────────────────────────────────────────────

/**
 * A pointer sweeps a red-green-red bar; press inside the green (第 3 關・蛋撻出爐,
 * later 第 5 關・落刀). The green band shrinks each round.
 */
export function timingGame(scene: Phaser.Scene, title: string, verb: string, rounds = 4): Mini<RoundResult> {
  const ui = frame(scene, title)
  const touch = isTouchDevice()
  ui.hint.setText(touch ? `指針入到綠色就撳畫面${verb}` : `指針入到綠色就撳 攻擊鍵${verb}`)
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 10
  const BW = 320
  const g = scene.add.graphics()
  const label = scene.add.text(cx, cy - 58, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, label])

  let round = 1
  let pos = 0
  let dir = 1
  let settle = 0
  let band = 0.26
  let centre = 0.5
  const res: RoundResult = { good: 0, total: rounds }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  const started = scene.time.now
  let finished = false

  const newRound = () => {
    band = Math.max(0.1, 0.26 - (round - 1) * 0.04)
    centre = Phaser.Math.FloatBetween(0.3, 0.7)
    pos = 0
    dir = 1
  }
  const draw = () => {
    g.clear()
    const x0 = cx - BW / 2
    g.fillStyle(0x1a1210, 1).fillRect(x0 - 4, cy - 18, BW + 8, 36)
    g.fillStyle(0x8a2a22, 1).fillRect(x0, cy - 14, BW, 28)
    g.fillStyle(0x3a8a40, 1).fillRect(x0 + (centre - band / 2) * BW, cy - 14, band * BW, 28)
    const px = x0 + pos * BW
    g.fillStyle(0xfff6e0, 1).fillRect(px - 2, cy - 22, 4, 44)
    g.fillStyle(0x1a1210, 1).fillRect(px - 3, cy - 23, 1, 46).fillRect(px + 2, cy - 23, 1, 46)
    label.setText(`第 ${round} ／ ${rounds} 次`)
    ui.bar.width = (216 * (round - 1)) / rounds
  }
  const press = () => {
    if (finished || settle > 0) return
    const hit = Math.abs(pos - centre) <= band / 2
    if (hit) {
      res.good++
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, cx, cy - 40, '啱！', '#ffd040', { size: 16, dur: 700 })
    } else {
      SFX.blip(220)
      buzz(40)
      floatText(scene, cx, cy - 40, '走咗雞', '#ff8a6a', { size: 14, dur: 700 })
    }
    settle = 520
  }
  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) {
      settle -= dt
      if (settle <= 0) {
        round++
        if (round > rounds) return finish()
        newRound()
      }
      draw()
      return
    }
    const speed = 0.55 + round * 0.12
    pos += dir * speed * (dt / 1000)
    if (pos > 1) {
      pos = 1
      dir = -1
    }
    if (pos < 0) {
      pos = 0
      dir = 1
    }
    if (anyPress()) press()
    draw()
    if (scene.time.now - started > 25000) finish()
  }
  const onKey = (e: KeyboardEvent) => {
    if (['Space', 'KeyF', 'KeyJ', 'KeyK', 'ArrowUp'].includes(e.code)) press()
  }
  const onTap = () => press()
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)

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
    ui.title.setText(res.good >= rounds ? '次次都啱！' : res.good > 0 ? `啱咗 ${res.good} 次` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(800, destroy)
  }
  newRound()
  draw()
  return { done, destroy }
}

// ── 傾斜電話：揈個波入窿 ────────────────────────────────────────────────

type TiltPt = { x: number; y: number }

/**
 * Tray layout for one round of tiltGame (ball starts at 0,0). The hole is far enough away to leave
 * room for a pit on the way, and the first pit is deliberately parked on the straight start→hole
 * line (a few px off-centre, still inside the ball+pit contact distance) so rolling straight in
 * drops the ball: the player has to curve round it. Extra pits (later rounds) are random.
 */
export function tiltLayout(round: number, halfW: number, halfH: number, rand: (a: number, b: number) => number = Phaser.Math.FloatBetween): { hole: TiltPt; pits: TiltPt[] } {
  const START_CLEAR = 32
  const HOLE_CLEAR = 38
  const rnd = (): TiltPt => ({ x: rand(-halfW + 24, halfW - 24), y: rand(-halfH + 18, halfH - 18) })
  const farEnough = (p: TiltPt, pts: TiltPt[], min: number) => pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= min)
  let hole = rnd()
  for (let i = 0; i < 400 && Math.hypot(hole.x, hole.y) < START_CLEAR + HOLE_CLEAR + 6; i++) hole = rnd()
  const len = Math.hypot(hole.x, hole.y)
  const pits: TiltPt[] = []
  if (len >= START_CLEAR + HOLE_CLEAR) {
    const t = rand(START_CLEAR / len, 1 - HOLE_CLEAR / len)
    const nx = -hole.y / len
    const ny = hole.x / len
    const off = rand(-6, 6)
    pits.push({ x: hole.x * t + nx * off, y: hole.y * t + ny * off })
  }
  const n = Math.min(3, 1 + Math.floor((round - 1) / 1.5))
  for (let i = pits.length; i < n; i++) {
    let p = rnd()
    let tries = 0
    while ((Math.hypot(p.x, p.y) < 36 || Math.hypot(p.x - hole.x, p.y - hole.y) < 44 || !farEnough(p, pits, 40)) && tries < 300) {
      p = rnd()
      tries++
    }
    pits.push(p)
  }
  return { hole, pits }
}

/**
 * Tilt the phone (or hold a direction) to roll a ball across a tray into the glowing hole —
 * avoid the dark pits, which drop the ball and cost the round (第 4 關・開椰青嘅泰國人).
 * Each round the timer gets a little tighter.
 */
export function tiltGame(scene: Phaser.Scene, rounds = 4): Mini<RoundResult> {
  const ui = frame(scene, '傾斜個電話，揈個波入窿！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '揈郁電話（或者撳住畫面方向）' : '方向鍵／WASD 郁個波，避開黑窿')
  void startMotion()
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 14
  const HALF_W = 108
  const HALF_H = 64
  const BALL_R = 8
  const HOLE_R = 16
  const PIT_R = 15

  const g = scene.add.graphics()
  const dyn = scene.add.graphics()
  const label = scene.add.text(cx, cy - 92, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5)
  ui.root.add([g, dyn, label])

  type Pt = { x: number; y: number }
  let round = 1
  let bx = 0
  let by = 0
  let vx = 0
  let vy = 0
  let hole: Pt = { x: 0, y: 0 }
  let pits: Pt[] = []
  let settle = 0
  let dropped = false
  let roundMs = 7000
  let roundStart = scene.time.now
  const res: RoundResult = { good: 0, total: rounds }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  const started = scene.time.now
  let finished = false

  const newRound = () => {
    roundMs = Math.max(3600, 7000 - (round - 1) * 700)
    bx = 0
    by = 0
    vx = 0
    vy = 0
    dropped = false
    const layout = tiltLayout(round, HALF_W, HALF_H)
    hole = layout.hole
    pits = layout.pits
    roundStart = scene.time.now
  }

  const keys = { up: false, down: false, left: false, right: false }
  const KEYMAP: Record<string, keyof typeof keys> = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code]
    if (k) keys[k] = true
  }
  const onKeyUp = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code]
    if (k) keys[k] = false
  }
  scene.input.keyboard?.on('keydown', onKeyDown)
  scene.input.keyboard?.on('keyup', onKeyUp)

  const draw = () => {
    g.clear()
    g.fillStyle(0x1a1210, 1).fillRoundedRect(cx - HALF_W - 10, cy - HALF_H - 10, HALF_W * 2 + 20, HALF_H * 2 + 20, 10)
    g.fillStyle(0x3a2a1a, 1).fillRoundedRect(cx - HALF_W, cy - HALF_H, HALF_W * 2, HALF_H * 2, 6)
    g.fillStyle(0x4a3a24, 0.5)
    for (let i = -HALF_W; i < HALF_W; i += 16) g.fillRect(cx + i, cy - HALF_H, 1, HALF_H * 2)
    label.setText(`第 ${round} ／ ${rounds} 次`)
    ui.bar.width = (216 * (round - 1)) / rounds
  }
  const drawDyn = () => {
    dyn.clear()
    // Pits (avoid).
    for (const p of pits) {
      dyn.fillStyle(0x0a0604, 1).fillCircle(cx + p.x, cy + p.y, PIT_R)
      dyn.lineStyle(2, 0x2a1a10, 1).strokeCircle(cx + p.x, cy + p.y, PIT_R)
    }
    // Hole (goal), pulsing.
    const pulse = 1 + Math.sin(scene.time.now / 160) * 0.12
    dyn.lineStyle(3, 0x6adf6a, 0.9).strokeCircle(cx + hole.x, cy + hole.y, HOLE_R * pulse)
    dyn.fillStyle(0x1a4a1a, 1).fillCircle(cx + hole.x, cy + hole.y, HOLE_R * 0.7)
    // Ball.
    if (!dropped) {
      dyn.fillStyle(0x2a1408, 0.4).fillCircle(cx + bx + 2, cy + by + 3, BALL_R)
      dyn.fillStyle(0xffb04a, 1).fillCircle(cx + bx, cy + by, BALL_R)
      dyn.fillStyle(0xfff0c0, 0.8).fillCircle(cx + bx - 2, cy + by - 2, BALL_R * 0.4)
    }
    // Countdown ring.
    const left = Math.max(0, roundMs - (scene.time.now - roundStart))
    dyn.lineStyle(3, left < 1800 ? 0xff8a6a : 0xffe08a, 0.8)
    dyn.beginPath()
    dyn.arc(cx, cy - HALF_H - 22, 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * left) / roundMs, false)
    dyn.strokePath()
  }

  const land = (ok: boolean) => {
    if (ok) {
      res.good++
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, cx + hole.x, cy + hole.y - 24, '入咗！', '#ffd040', { size: 15, dur: 700 })
    } else {
      SFX.potShatter()
      buzz(40)
      dropped = true
      floatText(scene, cx + bx, cy + by - 20, dropped ? '跌咗落窿！' : '走雞', '#ff8a6a', { size: 13, dur: 700 })
    }
    settle = 650
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (settle > 0) {
      settle -= dt
      drawDyn()
      if (settle <= 0) {
        round++
        if (round > rounds) return finish()
        newRound()
        draw()
      }
      return
    }
    const dtS = Math.min(0.05, dt / 1000)
    const padX = (TouchInput.isDown('right') ? 1 : 0) - (TouchInput.isDown('left') ? 1 : 0)
    const padY = (TouchInput.isDown('down') ? 1 : 0) - (TouchInput.isDown('up') ? 1 : 0)
    let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + padX + Phaser.Math.Clamp(tilt() / 16, -1, 1)
    let iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + padY + Phaser.Math.Clamp(tiltY() / 16, -1, 1)
    ix = Phaser.Math.Clamp(ix, -1, 1)
    iy = Phaser.Math.Clamp(iy, -1, 1)
    vx += ix * 380 * dtS
    vy += iy * 380 * dtS
    const damp = Math.max(0, 1 - 3.0 * dtS)
    vx *= damp
    vy *= damp
    const sp = Math.hypot(vx, vy)
    const MAXV = 170
    if (sp > MAXV) {
      vx = (vx / sp) * MAXV
      vy = (vy / sp) * MAXV
    }
    bx += vx * dtS
    by += vy * dtS
    if (bx < -HALF_W + BALL_R) {
      bx = -HALF_W + BALL_R
      vx *= -0.4
    }
    if (bx > HALF_W - BALL_R) {
      bx = HALF_W - BALL_R
      vx *= -0.4
    }
    if (by < -HALF_H + BALL_R) {
      by = -HALF_H + BALL_R
      vy *= -0.4
    }
    if (by > HALF_H - BALL_R) {
      by = HALF_H - BALL_R
      vy *= -0.4
    }
    if (Math.abs(ix) > 0.15 && scene.time.now % 5 < 1) buzz(6)
    for (const p of pits) {
      if (Math.hypot(bx - p.x, by - p.y) < PIT_R - 2) return land(false)
    }
    if (Math.hypot(bx - hole.x, by - hole.y) < HOLE_R - BALL_R * 0.5) return land(true)
    drawDyn()
    if (scene.time.now - roundStart > roundMs) land(false)
    if (scene.time.now - started > 32000) finish()
  }
  scene.events.on('update', tick)

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKeyDown)
    scene.input.keyboard?.off('keyup', onKeyUp)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    ui.bar.width = 216
    ui.title.setText(res.good >= rounds ? '次次都入咗窿！' : res.good > 0 ? `入咗 ${res.good} 次窿` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(800, destroy)
  }
  newRound()
  draw()
  drawDyn()
  return { done, destroy }
}

// ── 舉旗大賽（第 1 關・咖啡媽媽）──────────────────────────────────────────

export type FlagCmd = 'raise-red' | 'lower-red' | 'raise-blue' | 'lower-blue' | 'trap-red' | 'trap-blue'

const FLAG_LABEL: Record<FlagCmd, string> = {
  'raise-red': '舉紅旗',
  'lower-red': '放低紅旗',
  'raise-blue': '舉藍旗',
  'lower-blue': '放低藍旗',
  'trap-red': '唔好舉紅旗',
  'trap-blue': '唔好舉藍旗',
}

const FLAG_CMDS: FlagCmd[] = ['raise-red', 'lower-red', 'raise-blue', 'lower-blue', 'trap-red', 'trap-blue']

/** Window for round `r` (1-based): 1200ms − 50ms*(r−1), floor 750ms. */
export function flagWindowMs(round: number): number {
  return Math.max(750, 1200 - (Math.max(1, round) - 1) * 50)
}

/**
 * 舉旗大賽 — 咖啡媽媽主持紅／藍旗；噗噗旁觀（灰色無力）。1P：←/A 紅、→/D 藍；
 * 觸控左半紅右半藍。2P：暫無專用 mapping，同 1P 鍵。結果 RoundResult。
 */
export function flagRace(scene: Phaser.Scene, rounds = 10): Mini<RoundResult> & {
  debug: () => {
    round: number
    score: number
    cmd: FlagCmd | null
    red: boolean
    blue: boolean
    trap: boolean
    windowMs: number
    phase: string
    pressed: boolean
  }
  /** Test hook: force the next/current command. */
  forceCmd: (cmd: FlagCmd) => void
  /** Test hook: set player flag states. */
  setFlags: (red: boolean, blue: boolean) => void
  /** Test hook: toggle a flag (counts as a press). */
  qaPress: (which: 'red' | 'blue') => void
  /** Test hook: end the active window immediately. */
  endWindow: () => void
} {
  const ui = frame(scene, '咖啡媽媽：舉旗大賽！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '左半＝紅旗　右半＝藍旗' : '←／A＝紅旗　→／D＝藍旗　　（1P；2P 暫同鍵）')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 8
  const g = scene.add.graphics()
  const cmdTxt = scene.add
    .text(cx, 118, '', {
      fontFamily: FONT_UI,
      fontSize: '32px',
      color: '#fff6e0',
      stroke: '#2a1408',
      strokeThickness: 6,
      align: 'center',
    })
    .setOrigin(0.5)
  const scoreTxt = scene.add
    .text(cx, GAME_H - 96, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' })
    .setOrigin(0.5)
  ui.root.add([g, cmdTxt, scoreTxt])

  let redUp = false
  let blueUp = false
  let round = 1
  let score = 0
  let cmd: FlagCmd | null = null
  let forced: FlagCmd | null = null
  let windowMs = flagWindowMs(1)
  let windowStart = 0
  let settle = 0
  let phase: 'show' | 'play' | 'settle' | 'end' = 'show'
  let pressed = false
  let roundRed0 = false
  let roundBlue0 = false
  let pupuFake: 'red' | 'blue' | null = null
  const res: RoundResult = { good: 0, total: rounds }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false

  const drawHost = () => {
    g.clear()
    // Host body (咖啡媽媽 silhouette — original Graphics)
    const hx = cx - 70
    const hy = cy + 40
    g.fillStyle(0x2a1a10, 1).fillEllipse(hx, hy + 36, 54, 18)
    g.fillStyle(0xf4c8a0, 1).fillCircle(hx, hy - 48, 22)
    g.fillStyle(0x8a3a28, 1).fillRoundedRect(hx - 20, hy - 28, 40, 52, 8)
    g.fillStyle(0xfff0d0, 1).fillRoundedRect(hx - 26, hy - 72, 52, 18, 6) // hair bun band
    g.fillStyle(0x5a2818, 1).fillCircle(hx - 14, hy - 78, 10)
    g.fillStyle(0x5a2818, 1).fillCircle(hx + 14, hy - 78, 10)
    // Arms + flags
    const redY = redUp ? hy - 70 : hy - 10
    const blueY = blueUp ? hy - 70 : hy - 10
    g.lineStyle(4, 0x1a1210, 1)
    g.lineBetween(hx - 18, hy - 10, hx - 48, redY)
    g.lineBetween(hx + 18, hy - 10, hx + 48, blueY)
    g.lineStyle(3, 0xc8a060, 1)
    g.lineBetween(hx - 48, redY + 28, hx - 48, redY - 4)
    g.lineBetween(hx + 48, blueY + 28, hx + 48, blueY - 4)
    g.fillStyle(0xe01828, 1).fillTriangle(hx - 48, redY - 4, hx - 48, redY + 22, hx - 78, redY + 10)
    g.fillStyle(0x2868e0, 1).fillTriangle(hx + 48, blueY - 4, hx + 48, blueY + 22, hx + 78, blueY + 10)
    // 噗噗 spectator — grey / weak (not host)
    const px = cx + 110
    const py = cy + 50
    g.fillStyle(0x6a6a70, 1).fillEllipse(px, py + 20, 40, 14)
    g.fillStyle(0x9a9aa0, 1).fillCircle(px, py - 8, 20)
    g.fillStyle(0x7a7a80, 1).fillCircle(px - 12, py - 22, 8)
    g.fillStyle(0x7a7a80, 1).fillCircle(px + 12, py - 22, 8)
    g.fillStyle(0x4a4a50, 1).fillCircle(px - 6, py - 10, 3)
    g.fillStyle(0x4a4a50, 1).fillCircle(px + 6, py - 10, 3)
    // Pupu mimics the host; on trap rounds he fakes a raise to trick you.
    if (phase === 'play' || phase === 'show') {
      if (pupuFake === 'red' || cmd === 'raise-red') {
        g.lineStyle(2, 0x5a5a60, 1).lineBetween(px - 10, py, px - 28, py - 36)
        g.fillStyle(0xb04040, 0.85).fillTriangle(px - 28, py - 36, px - 28, py - 18, px - 46, py - 28)
      } else if (pupuFake === 'blue' || cmd === 'raise-blue') {
        g.lineStyle(2, 0x5a5a60, 1).lineBetween(px + 10, py, px + 28, py - 36)
        g.fillStyle(0x4060b0, 0.85).fillTriangle(px + 28, py - 36, px + 28, py - 18, px + 46, py - 28)
      } else if (cmd === 'lower-red' || cmd === 'lower-blue') {
        const side = cmd === 'lower-red' ? -1 : 1
        g.lineStyle(2, 0x5a5a60, 1).lineBetween(px + side * 8, py, px + side * 22, py + 8)
      }
    }
  }

  const pickCmd = (): FlagCmd => {
    if (forced) {
      const c = forced
      forced = null
      return c
    }
    // Prefer commands that need a toggle; still allow "already correct" no-op rounds.
    return FLAG_CMDS[Phaser.Math.Between(0, FLAG_CMDS.length - 1)]!
  }

  const expectedOk = (): boolean => {
    if (!cmd) return false
    if (cmd === 'trap-red' || cmd === 'trap-blue') return !pressed && redUp === roundRed0 && blueUp === roundBlue0
    if (cmd === 'raise-red') return redUp === true && blueUp === roundBlue0
    if (cmd === 'lower-red') return redUp === false && blueUp === roundBlue0
    if (cmd === 'raise-blue') return blueUp === true && redUp === roundRed0
    if (cmd === 'lower-blue') return blueUp === false && redUp === roundRed0
    return false
  }

  const beginRound = () => {
    cmd = pickCmd()
    windowMs = flagWindowMs(round)
    windowStart = scene.time.now
    pressed = false
    roundRed0 = redUp
    roundBlue0 = blueUp
    pupuFake = cmd === 'trap-red' ? 'red' : cmd === 'trap-blue' ? 'blue' : null
    phase = 'play'
    cmdTxt.setText(FLAG_LABEL[cmd])
    cmdTxt.setColor(cmd.startsWith('trap') ? '#ff8a6a' : '#fff6e0')
    scoreTxt.setText(`第 ${round} ／ ${rounds}　　分數 ${score}`)
    ui.bar.width = 216 * ((round - 1) / rounds)
    drawHost()
  }

  const land = () => {
    if (phase !== 'play') return
    const ok = expectedOk()
    if (ok) {
      score = Math.min(rounds, score + 1)
      SFX.coin()
      buzz(HAPTIC.power)
      floatText(scene, cx, cy - 80, '+1', '#ffd040', { size: 18, dur: 600 })
    } else {
      score = Math.max(0, score - 1)
      SFX.blip(220)
      buzz(40)
      floatText(scene, cx, cy - 80, pressed && cmd?.startsWith('trap') ? '中計！' : '唔啱', '#ff8a6a', { size: 16, dur: 600 })
    }
    res.good = score
    phase = 'settle'
    settle = 480
    drawHost()
  }

  const toggleRed = () => {
    if (phase !== 'play' || finished) return
    pressed = true
    redUp = !redUp
    SFX.blip(redUp ? 640 : 360)
    drawHost()
  }
  const toggleBlue = () => {
    if (phase !== 'play' || finished) return
    pressed = true
    blueUp = !blueUp
    SFX.blip(blueUp ? 520 : 300)
    drawHost()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') toggleRed()
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') toggleBlue()
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    if (p.x < GAME_W / 2) toggleRed()
    else toggleBlue()
  }
  const tick = () => {
    if (finished) return
    if (phase === 'settle') {
      settle -= scene.game.loop.delta
      if (settle <= 0) {
        round++
        if (round > rounds) return finish()
        beginRound()
      }
      return
    }
    if (phase === 'play') {
      if (TouchInput.justPressed('left')) toggleRed()
      if (TouchInput.justPressed('right')) toggleBlue()
      const left = Math.max(0, windowMs - (scene.time.now - windowStart))
      ui.bar.width = 216 * (left / windowMs)
      if (left <= 0) land()
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
    res.good = score
    ui.bar.width = 216
    ui.title.setText(score >= rounds ? '全程啱晒！' : score > 0 ? `得分 ${score}` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(800, destroy)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginRound()

  return {
    done,
    destroy,
    debug: () => ({
      round,
      score,
      cmd,
      red: redUp,
      blue: blueUp,
      trap: !!cmd?.startsWith('trap'),
      windowMs,
      phase,
      pressed,
    }),
    forceCmd: (c: FlagCmd) => {
      forced = c
      if (phase === 'play') beginRound()
    },
    setFlags: (r: boolean, b: boolean) => {
      redUp = r
      blueUp = b
      drawHost()
    },
    qaPress: (which: 'red' | 'blue') => {
      if (which === 'red') toggleRed()
      else toggleBlue()
    },
    endWindow: () => land(),
  }
}

// ── 記貨單（第 7 關・Boss 前攤檔）────────────────────────────────────────

export type MemoryItem = 'honey' | 'apple' | 'fish' | 'flower'
export const MEMORY_ITEMS: MemoryItem[] = ['honey', 'apple', 'fish', 'flower']
export const MEMORY_DIRS: Record<MemoryItem, 'up' | 'down' | 'left' | 'right'> = {
  honey: 'up',
  apple: 'down',
  fish: 'left',
  flower: 'right',
}
const MEMORY_LENS = [3, 4, 5, 6] as const
export const MEMORY_LIT_MS = 600
export const MEMORY_GAP_MS = 200

/** Build a sequence of `len` with no three identical items in a row. */
export function memorySequence(len: number, rand: () => number = Math.random): MemoryItem[] {
  const out: MemoryItem[] = []
  for (let i = 0; i < len; i++) {
    let pick = MEMORY_ITEMS[Math.floor(rand() * MEMORY_ITEMS.length)]!
    let guard = 0
    while (out.length >= 2 && out[out.length - 1] === pick && out[out.length - 2] === pick && guard < 20) {
      pick = MEMORY_ITEMS[Math.floor(rand() * MEMORY_ITEMS.length)]!
      guard++
    }
    out.push(pick)
  }
  return out
}

/**
 * 記貨單 — 十字四格（蜜／蘋果／魚／花）亮序記憶。4 輪長度 3–6；錯即顯示答案 1s。
 * 1P：方向鍵／WASD／觸控點格。2P：暫同 1P。
 */
export function memoryGame(scene: Phaser.Scene): Mini<RoundResult> & {
  debug: () => {
    round: number
    seq: MemoryItem[]
    input: MemoryItem[]
    phase: string
    lit: MemoryItem | null
    good: number
  }
  forceSeq: (seq: MemoryItem[]) => void
  tapItem: (item: MemoryItem) => void
} {
  const ui = frame(scene, '記貨單：記住亮起次序！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '跟住次序撳四格' : '↑↓←→／WASD 跟次序撳')
  const cx = GAME_W / 2
  const cy = GAME_H / 2 + 16
  const CELL = 52
  const GAP = 18
  const pos: Record<MemoryItem, { x: number; y: number }> = {
    honey: { x: cx, y: cy - CELL - GAP },
    apple: { x: cx, y: cy + CELL + GAP },
    fish: { x: cx - CELL - GAP, y: cy },
    flower: { x: cx + CELL + GAP, y: cy },
  }
  const g = scene.add.graphics()
  const label = scene.add.text(cx, 108, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a' }).setOrigin(0.5)
  const answerTxt = scene.add
    .text(cx, cy + 110, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#8ad0ff', align: 'center' })
    .setOrigin(0.5)
  ui.root.add([g, label, answerTxt])

  let round = 1
  let seq: MemoryItem[] = []
  let forced: MemoryItem[] | null = null
  let input: MemoryItem[] = []
  let lit: MemoryItem | null = null
  let showI = 0
  let showT = 0
  let phase: 'show' | 'input' | 'fail' | 'ok' | 'end' = 'show'
  let failMs = 0
  const res: RoundResult = { good: 0, total: 4 }
  let resolve!: (r: RoundResult) => void
  const done = new Promise<RoundResult>((r) => (resolve = r))
  let finished = false

  const drawItem = (item: MemoryItem, x: number, y: number, bright: boolean) => {
    const a = bright ? 1 : 0.45
    g.fillStyle(0x1a1210, 1).fillRoundedRect(x - CELL / 2 - 2, y - CELL / 2 - 2, CELL + 4, CELL + 4, 8)
    g.fillStyle(bright ? 0x3a2a18 : 0x2a1a10, a).fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 6)
    if (item === 'honey') {
      g.fillStyle(0xe8a020, a).fillRoundedRect(x - 12, y - 8, 24, 22, 4)
      g.fillStyle(0xc87810, a).fillRect(x - 10, y - 14, 20, 8)
      g.fillStyle(0xffe080, a * 0.7).fillCircle(x, y + 2, 6)
    } else if (item === 'apple') {
      g.fillStyle(0xe03828, a).fillCircle(x, y + 2, 14)
      g.fillStyle(0x3a8a30, a).fillEllipse(x + 6, y - 12, 10, 6)
      g.lineStyle(2, 0x5a3a18, a).lineBetween(x, y - 12, x, y - 4)
    } else if (item === 'fish') {
      g.fillStyle(0xf07888, a).fillEllipse(x, y + 2, 28, 14)
      g.fillStyle(0xf07888, a).fillTriangle(x + 14, y + 2, x + 24, y - 8, x + 24, y + 12)
      g.fillStyle(0x1a1210, a).fillCircle(x - 8, y, 2)
    } else {
      g.fillStyle(0xff80b0, a).fillCircle(x, y, 8)
      g.fillStyle(0xff80b0, a).fillCircle(x - 10, y + 2, 7)
      g.fillStyle(0xff80b0, a).fillCircle(x + 10, y + 2, 7)
      g.fillStyle(0xff80b0, a).fillCircle(x - 5, y - 8, 7)
      g.fillStyle(0xff80b0, a).fillCircle(x + 5, y - 8, 7)
      g.fillStyle(0xffd060, a).fillCircle(x, y, 4)
    }
    if (bright) g.lineStyle(3, 0xffe08a, 1).strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 6)
  }

  const draw = () => {
    g.clear()
    // Cross arms
    g.fillStyle(0x3a2a1a, 0.6).fillRect(cx - 10, cy - CELL - GAP - CELL / 2, 20, (CELL + GAP) * 2 + CELL)
    g.fillStyle(0x3a2a1a, 0.6).fillRect(cx - CELL - GAP - CELL / 2, cy - 10, (CELL + GAP) * 2 + CELL, 20)
    for (const item of MEMORY_ITEMS) {
      const p = pos[item]!
      drawItem(item, p.x, p.y, lit === item)
    }
    if (phase === 'fail') {
      for (const item of seq) {
        const p = pos[item]!
        g.lineStyle(2, 0x8ad0ff, 0.9).strokeRoundedRect(p.x - CELL / 2 - 1, p.y - CELL / 2 - 1, CELL + 2, CELL + 2, 6)
      }
    }
    label.setText(`第 ${round} ／ 4　　長度 ${seq.length || MEMORY_LENS[round - 1]}`)
    ui.bar.width = (216 * (round - 1)) / 4
  }

  const beginRound = () => {
    const len = MEMORY_LENS[round - 1]!
    seq = forced ?? memorySequence(len)
    forced = null
    input = []
    lit = null
    showI = 0
    showT = 0
    phase = 'show'
    answerTxt.setText('')
    draw()
  }

  const onFail = () => {
    phase = 'fail'
    failMs = 1000
    lit = null
    answerTxt.setText(`答案：${seq.map((s) => ({ honey: '蜜', apple: '蘋果', fish: '魚', flower: '花' })[s]).join(' → ')}`)
    SFX.blip(200)
    buzz(40)
    draw()
  }

  const onOk = () => {
    res.good++
    phase = 'ok'
    failMs = 500
    SFX.coin()
    buzz(HAPTIC.power)
    floatText(scene, cx, cy - 100, '記啱！', '#ffd040', { size: 16, dur: 600 })
    draw()
  }

  const press = (item: MemoryItem) => {
    if (finished || phase !== 'input') return
    input.push(item)
    lit = item
    draw()
    const i = input.length - 1
    if (seq[i] !== item) {
      onFail()
      return
    }
    SFX.blip(480 + i * 40)
    if (input.length >= seq.length) onOk()
    else scene.time.delayedCall(120, () => {
      if (phase === 'input') {
        lit = null
        draw()
      }
    })
  }

  const DIR_ITEM: Record<string, MemoryItem> = {
    up: 'honey',
    down: 'apple',
    left: 'fish',
    right: 'flower',
  }
  const KEYMAP: Record<string, MemoryItem> = {
    ArrowUp: 'honey',
    KeyW: 'honey',
    ArrowDown: 'apple',
    KeyS: 'apple',
    ArrowLeft: 'fish',
    KeyA: 'fish',
    ArrowRight: 'flower',
    KeyD: 'flower',
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return
    const it = KEYMAP[e.code]
    if (it) press(it)
  }
  const onTap = (p: Phaser.Input.Pointer) => {
    for (const item of MEMORY_ITEMS) {
      const c = pos[item]!
      if (Math.abs(p.x - c.x) <= CELL / 2 + 6 && Math.abs(p.y - c.y) <= CELL / 2 + 6) {
        press(item)
        return
      }
    }
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    if (phase === 'fail' || phase === 'ok') {
      failMs -= dt
      if (failMs <= 0) {
        round++
        if (round > 4) return finish()
        beginRound()
      }
      return
    }
    if (phase === 'show') {
      showT += dt
      if (showI < seq.length) {
        const on = showT < MEMORY_LIT_MS
        lit = on ? seq[showI]! : null
        if (showT >= MEMORY_LIT_MS + MEMORY_GAP_MS) {
          showI++
          showT = 0
          lit = null
        }
        draw()
      } else {
        phase = 'input'
        lit = null
        answerTxt.setText('輪到你！')
        draw()
      }
      return
    }
    if (phase === 'input') {
      for (const d of ['up', 'down', 'left', 'right'] as const) {
        if (TouchInput.justPressed(d)) press(DIR_ITEM[d]!)
      }
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
    ui.title.setText(res.good >= 4 ? '全部記住！' : res.good > 0 ? `記啱 ${res.good} 輪` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(800, destroy)
  }

  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', onTap)
  scene.events.on('update', tick)
  beginRound()

  return {
    done,
    destroy,
    debug: () => ({ round, seq: seq.slice(), input: input.slice(), phase, lit, good: res.good }),
    forceSeq: (s: MemoryItem[]) => {
      forced = s.slice()
      if (phase === 'show' || phase === 'input') beginRound()
    },
    tapItem: (item: MemoryItem) => press(item),
  }
}

// ── 夜市抓抓機：左右移動夾爪，揀準時機落爪 ───────────────────────────────

export type ClawResult = { coins: number; caught: number; drops: number }
type PrizeKind = 'lobster' | 'shrimp' | 'boot' | 'can' | 'gold'
type Prize = { kind: PrizeKind; spr: Phaser.GameObjects.Image; x: number; vx: number; zone: number; value: number }

/** Coin value, art, size and how often each prize turns up on the belt. */
export const CLAW_PRIZES: Record<PrizeKind, { tex: string; value: number; zone: number; weight: number; label: string }> = {
  lobster: { tex: 'claw-lobster', value: 6, zone: 15, weight: 22, label: '龍蝦' },
  shrimp: { tex: 'claw-shrimp', value: 3, zone: 12, weight: 32, label: '蝦' },
  boot: { tex: 'claw-boot', value: 1, zone: 11, weight: 24, label: '舊鞋' },
  can: { tex: 'claw-can', value: 1, zone: 10, weight: 18, label: '罐頭' },
  gold: { tex: 'claw-lobster', value: 12, zone: 15, weight: 4, label: '金龍蝦' },
}
export const CLAW_TIME_MS = 18000
const CLAW_X0 = 92
const CLAW_X1 = 548
const CLAW_RAIL_Y = 124
const CLAW_BELT_Y = 292
const CLAW_BOTTOM_Y = 262

export function clawGame(scene: Phaser.Scene, timeMs = CLAW_TIME_MS) {
  const ui = frame(scene, '夜市抓抓機', 0.4)
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '左右掣移夾爪，攻擊掣落爪' : '←→ 移動夾爪　攻擊鍵／空白鍵 落爪')
  for (const k of Object.values(CLAW_PRIZES)) if (scene.textures.exists(k.tex)) markHd(scene.textures.get(k.tex), 2)

  const g = scene.add.graphics()
  const gClaw = scene.add.graphics()
  const timeTxt = scene.add.text(GAME_W - 70, 76, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#8ff0ff', stroke: '#06202a', strokeThickness: 3 }).setOrigin(1, 0.5)
  const coinTxt = scene.add.text(70, 76, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a', stroke: '#2a1408', strokeThickness: 3 }).setOrigin(0, 0.5)
  ui.root.add([g, gClaw, timeTxt, coinTxt])

  const pick = (): PrizeKind => {
    const total = Object.values(CLAW_PRIZES).reduce((a, p) => a + p.weight, 0)
    let r = Phaser.Math.FloatBetween(0, total)
    for (const [k, p] of Object.entries(CLAW_PRIZES)) {
      r -= p.weight
      if (r <= 0) return k as PrizeKind
    }
    return 'shrimp'
  }
  const belt: Prize[] = []
  const spawn = (x: number, kind: PrizeKind = pick()): Prize => {
    const def = CLAW_PRIZES[kind]
    const spr = scene.add.image(x, CLAW_BELT_Y, def.tex).setOrigin(0.5, 1)
    if (kind === 'gold') spr.setTint(0xffd040)
    ui.root.add(spr)
    const speed = kind === 'gold' ? 82 : Phaser.Math.Between(26, 58)
    return { kind, spr, x, vx: (Phaser.Math.Between(0, 1) ? 1 : -1) * speed, zone: def.zone, value: def.value }
  }
  for (let i = 0; i < 5; i++) belt.push(spawn(CLAW_X0 + 20 + i * 92, i === 0 ? 'lobster' : pick()))

  let clawX = GAME_W / 2
  let clawY = CLAW_RAIL_Y + 8
  let state: 'idle' | 'down' | 'grab' | 'up' = 'idle'
  let stateT = 0
  let carried: Prize | null = null
  let left = timeMs
  let finished = false
  let flip = 0
  const armedAt = scene.time.now + 450
  const res: ClawResult = { coins: 0, caught: 0, drops: 0 }
  let resolve!: (r: ClawResult) => void
  const done = new Promise<ClawResult>((r) => (resolve = r))
  const keys = new Set<string>()

  const draw = () => {
    g.clear()
    // neon cabinet: glass, rail, belt
    g.fillStyle(0x0a0818, 0.55).fillRect(58, 98, GAME_W - 116, 210)
    g.lineStyle(3, 0xff4fd8, 1).strokeRect(58, 98, GAME_W - 116, 210)
    g.lineStyle(1, 0x4ff0ff, 0.9).strokeRect(63, 103, GAME_W - 126, 200)
    g.fillStyle(0x4ff0ff, 0.8).fillRect(70, CLAW_RAIL_Y - 4, GAME_W - 140, 3)
    g.fillStyle(0x1a1228, 1).fillRect(66, CLAW_BELT_Y, GAME_W - 132, 12)
    g.fillStyle(0xff4fd8, 0.55)
    for (let x = ((flip * 0.04) % 24) + 70; x < GAME_W - 70; x += 24) g.fillRect(x, CLAW_BELT_Y + 5, 12, 2)
    if (state === 'idle') {
      // Where the claw will come down.
      g.fillStyle(0x8ff0ff, 0.35)
      for (let y = clawY + 30; y < CLAW_BELT_Y; y += 8) g.fillRect(clawX - 1, y, 2, 4)
    }
  }
  const drawClaw = () => {
    gClaw.clear()
    gClaw.fillStyle(0x4ff0ff, 1).fillRect(clawX - 7, CLAW_RAIL_Y - 8, 14, 8)
    gClaw.fillStyle(0xc8c8d8, 1).fillRect(clawX - 1, CLAW_RAIL_Y, 2, clawY - CLAW_RAIL_Y)
    const closed = state === 'grab' || state === 'up'
    const spread = closed ? 5 : 13
    gClaw.fillStyle(0x1a1228, 1).fillRect(clawX - 8, clawY - 2, 16, 8)
    gClaw.fillStyle(0xe0e0f0, 1).fillRect(clawX - 6, clawY - 1, 12, 6)
    for (const sgn of [-1, 1]) {
      gClaw.fillStyle(0x1a1228, 1).fillRect(clawX + sgn * spread - 2, clawY + 4, 5, 22)
      gClaw.fillStyle(0xc8c8d8, 1).fillRect(clawX + sgn * spread - 1, clawY + 5, 3, 20)
      gClaw.fillStyle(0xc8c8d8, 1).fillRect(clawX + sgn * spread - (sgn > 0 ? 4 : -1), clawY + 22, 6, 3)
    }
  }
  const labelText = () => {
    timeTxt.setText(`${Math.ceil(Math.max(0, left) / 1000)} 秒`)
    coinTxt.setText(`◎ ${res.coins}`)
    ui.bar.width = 216 * Phaser.Math.Clamp(left / timeMs, 0, 1)
  }

  const resolveGrab = () => {
    res.drops++
    let best: Prize | null = null
    let bestD = Infinity
    for (const p of belt) {
      const d = Math.abs(p.x - clawX)
      if (d <= p.zone && d < bestD) {
        best = p
        bestD = d
      }
    }
    if (best) {
      carried = best
      belt.splice(belt.indexOf(best), 1)
      res.caught++
      SFX.coin()
      buzz(HAPTIC.power)
    } else {
      SFX.blip(200)
      buzz(30)
      floatText(scene, clawX, CLAW_BOTTOM_Y - 30, '落空', '#ff8a6a', { size: 13, dur: 600 })
    }
  }
  const banked = () => {
    if (!carried) return
    const p = carried
    carried = null
    res.coins += p.value
    SFX.sparkle()
    floatText(scene, clawX, CLAW_RAIL_Y + 30, `${CLAW_PRIZES[p.kind].label} ＋${p.value}`, p.kind === 'gold' ? '#ffe040' : '#ffd8a0', { size: p.value >= 6 ? 16 : 13, dur: 900 })
    p.spr.destroy()
    belt.push(spawn(Phaser.Math.Between(0, 1) ? CLAW_X0 + 4 : CLAW_X1 - 4))
  }
  const drop = () => {
    if (finished || state !== 'idle' || scene.time.now < armedAt || left <= 0) return
    state = 'down'
    stateT = 0
    SFX.blip(520)
  }

  const tick = (_t: number, dt: number) => {
    if (finished) return
    flip += dt
    if (scene.time.now >= armedAt) left -= dt
    // Prizes ride the belt and bounce at the ends, so the drop has to be timed.
    for (const p of belt) {
      p.x += p.vx * (dt / 1000)
      if (p.x < CLAW_X0 - 10) {
        p.x = CLAW_X0 - 10
        p.vx = Math.abs(p.vx)
      } else if (p.x > CLAW_X1 + 10) {
        p.x = CLAW_X1 + 10
        p.vx = -Math.abs(p.vx)
      }
      p.spr.setPosition(p.x, CLAW_BELT_Y)
    }
    stateT += dt
    if (state === 'idle') {
      const l = keys.has('ArrowLeft') || keys.has('KeyA') || TouchInput.isDown('left')
      const r = keys.has('ArrowRight') || keys.has('KeyD') || TouchInput.isDown('right')
      clawX = Phaser.Math.Clamp(clawX + ((r ? 1 : 0) - (l ? 1 : 0)) * 190 * (dt / 1000), CLAW_X0, CLAW_X1)
      clawY = CLAW_RAIL_Y + 8
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) drop()
      if (left <= 0) return finish()
    } else if (state === 'down') {
      clawY = CLAW_RAIL_Y + 8 + (CLAW_BOTTOM_Y - CLAW_RAIL_Y - 8) * Math.min(1, stateT / 430)
      if (stateT >= 430) {
        state = 'grab'
        stateT = 0
        resolveGrab()
      }
    } else if (state === 'grab') {
      if (stateT >= 190) {
        state = 'up'
        stateT = 0
      }
    } else {
      clawY = CLAW_BOTTOM_Y - (CLAW_BOTTOM_Y - CLAW_RAIL_Y - 8) * Math.min(1, stateT / 430)
      if (stateT >= 430) {
        banked()
        state = 'idle'
        stateT = 0
      }
    }
    if (carried) carried.spr.setPosition(clawX, clawY + 26 + carried.spr.displayHeight * 0.3)
    draw()
    drawClaw()
    labelText()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code)
    if (['Space', 'KeyF', 'KeyJ', 'KeyK', 'ArrowUp'].includes(e.code) && !e.repeat) drop()
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
  scene.input.keyboard?.on('keydown', onKeyDown)
  scene.input.keyboard?.on('keyup', onKeyUp)
  scene.events.on('update', tick)

  let gone = false
  const destroy = () => {
    if (gone) return
    gone = true
    finished = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKeyDown)
    scene.input.keyboard?.off('keyup', onKeyUp)
    ui.root.destroy(true)
    resolve(res)
  }
  const finish = () => {
    finished = true
    ui.bar.width = 0
    timeTxt.setText('時間到！')
    ui.title.setText(res.coins >= 20 ? '大豐收！' : res.caught > 0 ? `夾到 ${res.caught} 隻` : '下次再試過')
    SFX.sparkle()
    scene.time.delayedCall(900, destroy)
  }
  draw()
  drawClaw()
  labelText()
  return {
    done,
    destroy,
    /** Read-only view for tests. */
    debug: () => ({ clawX, clawY, state, left, belt: belt.map((p) => ({ kind: p.kind, x: p.x, vx: p.vx, zone: p.zone })), res: { ...res }, carried: carried?.kind ?? null }),
    /** Test hook: move the claw to x. */
    setClawX: (x: number) => {
      clawX = Phaser.Math.Clamp(x, CLAW_X0, CLAW_X1)
    },
    drop,
  }
}
