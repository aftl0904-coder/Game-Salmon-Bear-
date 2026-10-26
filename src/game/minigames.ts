import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { BlowMeter, buzz, HAPTIC, isTouchDevice, micLevel, micReady, phonePrefs, startMic, startMotion, stopMic, takeShake } from './phone'

/**
 * Little phone-feel minigames shown as overlays (they never block the story: each has a
 * generous timeout that finishes it for you).
 *  - shakeHoney: shake the phone (or mash) to mix the picnic honey
 *  - stirCoffee: draw circles (or rotate the stick / arrows) to stir 咖啡媽媽's coffee, then blow on it
 */

export type Mini = { done: Promise<void>; destroy: () => void }

function frame(scene: Phaser.Scene, title: string) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 260)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, 0.72).setOrigin(0).setInteractive())
  const t = scene.add
    .text(GAME_W / 2, 76, title, { fontFamily: FONT_UI, fontSize: '18px', color: '#ffe08a', stroke: '#2a1408', strokeThickness: 4 })
    .setOrigin(0.5)
  const hint = scene.add.text(GAME_W / 2, GAME_H - 46, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#f0dcb0', align: 'center' }).setOrigin(0.5)
  const barBg = scene.add.rectangle(GAME_W / 2, GAME_H - 72, 220, 10, 0x2a1a10).setStrokeStyle(2, 0xc8902a)
  const bar = scene.add.rectangle(GAME_W / 2 - 108, GAME_H - 72, 0, 6, 0xffc040).setOrigin(0, 0.5)
  root.add([t, hint, barBg, bar])
  return { root, title: t, hint, bar }
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

// ── 攪咖啡 + 吹凍佢 ─────────────────────────────────────────────────────

const DIRS: Record<string, number> = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
}

export function stirCoffee(scene: Phaser.Scene): Mini {
  const ui = frame(scene, '咖啡媽媽：攪勻杯咖啡先飲！')
  const touch = isTouchDevice()
  ui.hint.setText(touch ? '用手指喺杯上面打圈' : '方向鍵轉圈（↑→↓←）')
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
  const steam = scene.add.container(0, 0)
  ui.root.add([g, swirl, spoon, steam])
  let acc = 0 // radians stirred (signed)
  let prevA: number | null = null
  let prevDir = -1
  let phase: 'stir' | 'blow' | 'end' = 'stir'
  let cool = 0
  const blow = new BlowMeter()
  let holding = false
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))
  const started = scene.time.now
  let blowAt = 0

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
    holding = true
  }
  const onUp = () => {
    prevA = null
    holding = false
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
    if (phase === 'blow') holding = true
  }
  const onKeyUp = () => {
    if (phase === 'blow') holding = false
  }
  scene.input.on('pointermove', onMove)
  scene.input.on('pointerdown', onDown)
  scene.input.on('pointerup', onUp)
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.keyboard?.on('keyup', onKeyUp)

  const NEED = Math.PI * 2 * 3 // three full turns
  const tick = (_t: number, dt: number) => {
    if (phase === 'end') return
    if (phase === 'stir') {
      // Touch pad / gamepad stick: rotate through the four directions.
      for (const [k, d] of [['up', 0], ['right', 1], ['down', 2], ['left', 3]] as const) if (TouchInput.justPressed(k)) dirStep(d)
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
      if (p >= 1 || scene.time.now - started > 14000) startBlow()
    } else if (phase === 'blow') {
      if (anyPress()) cool += 0.12
      const lv = micReady() ? micLevel() : 0
      const secs = blow.update(dt, lv)
      if (holding) cool += dt / 1400
      cool = Math.max(cool, secs / 1.3)
      ui.bar.width = 216 * Math.min(1, cool)
      if (lv > 0.08 && scene.time.now % 3 < 1) buzz(10)
      // Steam: thinner as it cools.
      if (Math.random() < 0.25 * (1 - Math.min(1, cool))) {
        const s = scene.add.circle(cx + Phaser.Math.Between(-30, 30), cy - 20, Phaser.Math.Between(6, 12), 0xffffff, 0.5)
        steam.add(s)
        scene.tweens.add({ targets: s, y: s.y - 70, x: s.x + (lv > 0.08 || holding ? 40 : Phaser.Math.Between(-10, 10)), alpha: 0, scale: 1.8, duration: 1100, onComplete: () => s.destroy() })
      }
      if (cool >= 1 || scene.time.now - blowAt > 12000) finish()
    }
  }
  const startBlow = () => {
    phase = 'blow'
    blowAt = scene.time.now
    holding = false
    swirl.clear()
    spoon.clear()
    g.fillStyle(0xc89a6a, 1).fillCircle(cx, cy, R)
    ui.bar.width = 0
    ui.title.setText('好熱呀！吹凍佢先')
    ui.hint.setText(touch ? '對住電話吹氣（或者撳住畫面）' : '撳住任何一個鍵')
    SFX.sparkle()
    buzz(30)
    void startMic()
  }
  const finish = () => {
    phase = 'end'
    ui.bar.width = 216
    ui.title.setText('啱啱好！飲啦～')
    SFX.gulp()
    buzz(HAPTIC.power)
    if (!phonePrefs.mic) stopMic()
    scene.time.delayedCall(800, () => {
      destroy()
      resolve()
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
    resolve()
  }
  return { done, destroy }
}
