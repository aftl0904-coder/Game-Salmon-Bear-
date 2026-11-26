import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { unlockAudio, SFX } from './audio'
import { TouchInput } from './touchInput'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { CHARMS, rollCharm, setActiveCharm, type CharmDef, type CharmId } from './charms'
import { rememberCharm } from './run'
import { p2Pad, btn as padBtn } from './gamepadBridge'
import { isTouchDevice } from './phone'
import {
  gradeResult,
  showGradeResult,
  showSegmentBanner,
  TIMING_WINDOWS_MS,
} from './minigameFramework'

/**
 * 開局扭蛋 — minigame v1「停轉盤」時機技（docs/gdd/minigames-v1.md Claude 定案）.
 * 3 段停目標區 → 評級／金級解鎖紀念章 → 再扭出符咒（charms.ts）.
 */

const SPEEDS_DEG = [90, 150, 220] as const
const ZONES_DEG = [60, 40, 25] as const
/** Soft cap per segment so whole run stays ~30–45s. */
const SEG_TIMEOUT_MS = 12000
const MEDAL_ID = 'gacha'

type Phase = 'intro' | 'spin' | 'segWait' | 'grade' | 'charm' | 'reveal' | 'done'
type Wheel = {
  cx: number
  cy: number
  r: number
  g: Phaser.GameObjects.Graphics
  needle: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  angle: number
  zoneCenter: number
  stopped: boolean
  hit: boolean | null
}

export class GachaScene extends Phaser.Scene {
  private inputReadyAt = 0
  private prompt!: Phaser.GameObjects.Text
  private capsule: Phaser.GameObjects.Sprite | null = null
  private machine: Phaser.GameObjects.Image | null = null
  private pendingConfirm: (() => void) | null = null

  private phase: Phase = 'intro'
  private twoP = false
  private seg = 1
  private good = 0
  private total = 3
  /** 2P 對戰：各記分數，評級取較高（唔難過 1P）。 */
  private hitsP: [number, number] = [0, 0]
  private skipped = false
  private wheels: Wheel[] = []
  private skipBtn: Phaser.GameObjects.Text | null = null
  private scoreTxt: Phaser.GameObjects.Text | null = null
  private segArmedAt = 0
  private segDeadline = 0
  private pad2Prev = false

  constructor() {
    super('gacha')
  }

  create() {
    const W = GAME_W
    const H = GAME_H
    this.inputReadyAt = this.time.now + 350
    this.pendingConfirm = null
    this.phase = 'intro'
    this.twoP = this.registry.get('playMode') === '2p'
    this.seg = 1
    this.good = 0
    this.total = 3
    this.hitsP = [0, 0]
    this.skipped = false
    this.wheels = []
    this.pad2Prev = false
    this.cameras.main.setBackgroundColor('#140a1e')
    this.cameras.main.fadeIn(280, 20, 10, 30)

    this.add
      .text(W / 2, 28, '扭　蛋', {
        fontFamily: FONT_TITLE,
        fontSize: '22px',
        color: '#ffe08a',
        stroke: '#2a1408',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.add
      .text(W / 2, 52, '撳一下停喺目標區', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#c8b0e0',
      })
      .setOrigin(0.5)

    if (this.textures.exists('gacha-machine') && !this.twoP) {
      this.machine = this.add.image(W / 2, H - 8, 'gacha-machine').setOrigin(0.5, 1).setScale(0.55).setAlpha(0.35)
    }

    this.scoreTxt = this.add
      .text(24, 24, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' })
      .setOrigin(0, 0.5)

    const touch = isTouchDevice()
    this.prompt = this.add
      .text(
        W / 2,
        H - 28,
        this.twoP
          ? touch
            ? '左半＝P1　右半＝P2'
            : 'P1＝攻擊鍵　P2＝，．'
          : touch
            ? '撳畫面停轉盤'
            : '撳攻擊鍵停轉盤',
        {
          fontFamily: FONT_UI,
          fontSize: '13px',
          color: '#ffe08a',
          backgroundColor: '#3a2410cc',
          padding: { x: 10, y: 4 },
        },
      )
      .setOrigin(0.5)
    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 560, yoyo: true, repeat: -1 })

    this.skipBtn = this.add
      .text(W - 54, H - 28, '跳過', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#e0b86a',
        backgroundColor: '#2a1a10',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.skipBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.()
      this.doSkip()
    })

    mountTouchControls(this)

    const firePointer = (p: Phaser.Input.Pointer) => {
      if (this.time.now < this.inputReadyAt) return
      if (this.phase === 'intro') {
        this.beginSkill()
        return
      }
      if (this.phase === 'spin') {
        this.tryStop(this.twoP ? (p.x < W / 2 ? 0 : 1) : 0)
        return
      }
      if (this.pendingConfirm) {
        const action = this.pendingConfirm
        this.pendingConfirm = null
        action()
      }
    }
    const fireKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (this.time.now < this.inputReadyAt) return
      if (e.code === 'Escape') {
        this.doSkip()
        return
      }
      if (this.phase === 'intro') {
        this.beginSkill()
        return
      }
      if (this.phase === 'spin') {
        const p1 = ['Space', 'KeyF', 'KeyJ', 'KeyK', 'KeyZ', 'KeyX', 'Enter'].includes(e.code)
        const p2 = ['Comma', 'Period', 'Numpad1', 'Numpad2', 'Slash'].includes(e.code)
        if (this.twoP) {
          if (p1) this.tryStop(0)
          else if (p2) this.tryStop(1)
        } else if (p1 || p2) {
          this.tryStop(0)
        }
        return
      }
      if (this.pendingConfirm) {
        const action = this.pendingConfirm
        this.pendingConfirm = null
        action()
      }
    }
    this.input.on('pointerdown', firePointer)
    this.input.keyboard?.on('keydown', fireKey)
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', firePointer)
      this.input.keyboard?.off('keydown', fireKey)
    })

    this.refreshScore()
  }

  update(_t: number, dt: number) {
    if (this.phase === 'intro') {
      if (TouchInput.justPressed('start') || TouchInput.justPressed('menu')) {
        this.doSkip()
        return
      }
      if (
        TouchInput.justPressed('attack') ||
        TouchInput.justPressed('jump') ||
        TouchInput.justPressed('special')
      ) {
        if (this.time.now >= this.inputReadyAt) this.beginSkill()
      }
      return
    }

    if (this.phase === 'spin') {
      if (TouchInput.justPressed('start') || TouchInput.justPressed('menu')) {
        this.doSkip()
        return
      }
      const speed = SPEEDS_DEG[this.seg - 1] ?? 90
      for (const w of this.wheels) {
        if (w.stopped) continue
        w.angle = (w.angle + speed * (dt / 1000)) % 360
        this.drawWheel(w)
      }
      // P1 via TouchInput (keyboard bridge + pad1 + on-screen)
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) {
        this.tryStop(0)
      }
      // P2 pad (second controller)
      if (this.twoP) {
        const p2 = p2Pad()
        const down = padBtn(p2, 0) || padBtn(p2, 1) || padBtn(p2, 2)
        if (down && !this.pad2Prev) this.tryStop(1)
        this.pad2Prev = down
      }
      if (this.time.now >= this.segDeadline) this.forceSegEnd()
      return
    }

    if (!this.pendingConfirm) return
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) {
      if (this.time.now < this.inputReadyAt) return
      const action = this.pendingConfirm
      this.pendingConfirm = null
      action()
    }
  }

  private refreshScore() {
    this.scoreTxt?.setText(`成功 ${this.good}／${this.total}`)
  }

  private armConfirm(action: () => void) {
    this.pendingConfirm = action
  }

  private askMotionPerm() {
    const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (DME?.requestPermission) DME.requestPermission().catch(() => undefined)
  }

  private doSkip() {
    if (this.skipped || this.phase === 'grade' || this.phase === 'charm' || this.phase === 'reveal' || this.phase === 'done') return
    this.skipped = true
    unlockAudio()
    this.askMotionPerm()
    this.clearWheels()
    this.skipBtn?.destroy()
    this.skipBtn = null
    this.tweens.killTweensOf(this.prompt)
    this.prompt.setVisible(false)
    void this.finishSkill(true)
  }

  private beginSkill() {
    if (this.phase !== 'intro') return
    unlockAudio()
    this.askMotionPerm()
    this.phase = 'segWait'
    this.tweens.killTweensOf(this.prompt)
    this.prompt.setText(this.twoP ? '各停一盤' : '睇準目標區').setAlpha(1)
    SFX.blip(520)
    void this.startSegment(1)
  }

  private clearWheels() {
    for (const w of this.wheels) {
      w.g.destroy()
      w.needle.destroy()
      w.label.destroy()
    }
    this.wheels = []
  }

  private async startSegment(seg: number) {
    this.seg = seg
    this.phase = 'segWait'
    this.clearWheels()
    await showSegmentBanner(this, seg as 1 | 2 | 3)
    if (this.skipped) return

    const zone = ZONES_DEG[Math.min(2, Math.max(0, seg - 1))]!
    const cy = GAME_H / 2 + 8
    const r = this.twoP ? 78 : 100
    if (this.twoP) {
      this.wheels = [
        this.makeWheel(GAME_W * 0.28, cy, r, zone, 'P1'),
        this.makeWheel(GAME_W * 0.72, cy, r, zone, 'P2'),
      ]
    } else {
      this.wheels = [this.makeWheel(GAME_W / 2, cy, r, zone, '')]
    }

    // Arm after TIMING_WINDOWS_MS so a frame-1 mash doesn't count.
    const armMs = TIMING_WINDOWS_MS[Math.min(2, Math.max(0, seg - 1))]!
    this.segArmedAt = this.time.now + armMs
    this.segDeadline = this.time.now + SEG_TIMEOUT_MS
    this.inputReadyAt = this.segArmedAt
    this.phase = 'spin'
    this.prompt.setText(this.twoP ? '各停一盤' : '撳一下停').setVisible(true).setAlpha(1)
    this.refreshScore()
  }

  private makeWheel(cx: number, cy: number, r: number, zoneDeg: number, tag: string): Wheel {
    const zoneCenter = Phaser.Math.Between(0, 359)
    const g = this.add.graphics()
    const needle = this.add.graphics()
    const label = this.add
      .text(cx, cy + r + 16, tag, { fontFamily: FONT_UI, fontSize: '12px', color: '#dff6ff' })
      .setOrigin(0.5)
    const w: Wheel = { cx, cy, r, g, needle, label, angle: Phaser.Math.FloatBetween(0, 360), zoneCenter, stopped: false, hit: null }
    this.drawWheel(w, zoneDeg)
    return w
  }

  private drawWheel(w: Wheel, zoneDeg?: number) {
    const z = zoneDeg ?? ZONES_DEG[Math.min(2, Math.max(0, this.seg - 1))]!
    const { cx, cy, r, g, needle, angle, zoneCenter } = w
    g.clear()
    // Disc
    g.fillStyle(0x2a1a28, 1)
    g.fillCircle(cx, cy, r)
    g.lineStyle(3, 0xc8902a, 1)
    g.strokeCircle(cx, cy, r)
    // Decorative ticks
    for (let i = 0; i < 12; i++) {
      const a = Phaser.Math.DegToRad(i * 30 + angle)
      const x0 = cx + Math.sin(a) * (r - 10)
      const y0 = cy - Math.cos(a) * (r - 10)
      const x1 = cx + Math.sin(a) * (r - 2)
      const y1 = cy - Math.cos(a) * (r - 2)
      g.lineStyle(2, 0x6a4058, 1)
      g.lineBetween(x0, y0, x1, y1)
    }
    // Target zone (fixed on wheel, rotates with angle)
    const half = z / 2
    const start = Phaser.Math.DegToRad(zoneCenter - half + angle - 90)
    const end = Phaser.Math.DegToRad(zoneCenter + half + angle - 90)
    g.fillStyle(w.hit === true ? 0x50e070 : w.hit === false ? 0xe05050 : 0xffd060, 0.85)
    g.beginPath()
    g.moveTo(cx, cy)
    g.arc(cx, cy, r - 4, start, end, false)
    g.closePath()
    g.fillPath()
    // Hub
    g.fillStyle(0x1a1018, 1)
    g.fillCircle(cx, cy, 14)
    g.lineStyle(2, 0xffe08a, 1)
    g.strokeCircle(cx, cy, 14)
    // Fixed needle at top
    needle.clear()
    needle.fillStyle(0xfff0c0, 1)
    needle.fillTriangle(cx, cy - r - 6, cx - 7, cy - r + 14, cx + 7, cy - r + 14)
    needle.fillStyle(0xff6060, 1)
    needle.fillCircle(cx, cy - r + 4, 3)
  }

  /** Needle at top (local 0). Hit if zone covers ( -angle mod 360 ). */
  private inZone(w: Wheel, zoneDeg: number): boolean {
    const local = ((-w.angle % 360) + 360) % 360
    const half = zoneDeg / 2
    let d = Math.abs(local - w.zoneCenter)
    if (d > 180) d = 360 - d
    return d <= half
  }

  private tryStop(idx: number) {
    if (this.phase !== 'spin') return
    if (this.time.now < this.segArmedAt) return
    const w = this.wheels[idx]
    if (!w || w.stopped) return
    const zone = ZONES_DEG[this.seg - 1] ?? 25
    w.stopped = true
    w.hit = this.inZone(w, zone)
    this.drawWheel(w, zone)
    if (w.hit) {
      SFX.coin()
      w.label.setText(w.label.text ? `${w.label.text} ✓` : '中！')
      w.label.setColor('#80ff90')
    } else {
      SFX.blip(220)
      w.label.setText(w.label.text ? `${w.label.text} ✗` : '偏咗')
      w.label.setColor('#ff8a6a')
    }
    if (this.wheels.every((x) => x.stopped)) this.time.delayedCall(420, () => this.endSegment())
  }

  private forceSegEnd() {
    if (this.phase !== 'spin') return
    for (const w of this.wheels) {
      if (w.stopped) continue
      w.stopped = true
      w.hit = false
      this.drawWheel(w)
      w.label.setColor('#ff8a6a')
    }
    SFX.blip(200)
    this.time.delayedCall(280, () => this.endSegment())
  }

  private endSegment() {
    if (this.skipped || this.phase === 'grade' || this.phase === 'done') return
    // 1P: one stop. 2P 對戰：各轉一盤 — 取較高分，門檻同 1P（唔會更難）.
    if (this.twoP && this.wheels.length >= 2) {
      if (this.wheels[0]!.hit) this.hitsP[0]++
      if (this.wheels[1]!.hit) this.hitsP[1]++
      this.good = Math.max(this.hitsP[0], this.hitsP[1])
    } else if (this.wheels[0]?.hit) {
      this.good++
    }
    this.refreshScore()
    if (this.seg >= 3) {
      void this.finishSkill(false)
      return
    }
    this.phase = 'segWait'
    void this.startSegment(this.seg + 1)
  }

  private async finishSkill(skipped: boolean) {
    this.phase = 'grade'
    this.clearWheels()
    this.skipBtn?.destroy()
    this.skipBtn = null
    this.prompt.setVisible(false)
    const result = gradeResult(this.good, this.total, 'timing', skipped, MEDAL_ID)
    await showGradeResult(this, result, { title: '扭蛋' })
    this.beginCharmReveal()
  }

  private beginCharmReveal() {
    this.phase = 'charm'
    this.scoreTxt?.setVisible(false)
    if (this.machine) this.machine.setAlpha(0.9).setScale(0.78)
    const W = GAME_W
    const H = GAME_H
    const forced = this.registry.get('forceCharm') as CharmId | undefined
    const charm = forced ? setActiveCharm(forced) : rollCharm()
    rememberCharm(charm.id)
    const finalFrame = Math.max(0, CHARMS.findIndex((c) => c.id === charm.id))

    if (this.textures.exists('gacha-capsules')) {
      this.capsule = this.add.sprite(W / 2, H - 70, 'gacha-capsules', 0).setScale(1.6)
      this.tweens.add({ targets: this.capsule, y: H / 2 - 30, duration: 260, ease: 'Back.out' })
    }
    if (this.machine) this.tweens.add({ targets: this.machine, alpha: 0, duration: 320 })
    SFX.blip(660)
    const SPIN_TICKS = 12
    let ticks = 0
    const spinTimer = this.time.addEvent({
      delay: 70,
      repeat: SPIN_TICKS - 1,
      callback: () => {
        ticks++
        if (ticks >= SPIN_TICKS) {
          this.capsule?.setFrame(finalFrame)
          this.time.delayedCall(140, () => this.reveal(charm))
          return
        }
        this.capsule?.setFrame(ticks % CHARMS.length)
        SFX.blip(520 + ticks * 12)
      },
    })
    this.events.once('shutdown', () => spinTimer.remove(false))
  }

  private reveal(charm: CharmDef) {
    this.phase = 'reveal'
    SFX.powerUp()
    const W = GAME_W
    const H = GAME_H
    const cy = H / 2 - 30
    this.tweens.add({ targets: this.capsule, scale: { from: 1.6, to: 2.1 }, duration: 160, yoyo: true })

    if (this.textures.exists(charm.icon)) this.add.image(W / 2, cy - 48, charm.icon).setScale(1.3)
    this.add
      .text(W / 2, cy, charm.name, {
        fontFamily: FONT_TITLE,
        fontSize: '18px',
        color: '#ffe08a',
        stroke: '#2a1408',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.add
      .text(W / 2, cy + 56, charm.desc, {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#f0e6d8',
        align: 'center',
        wordWrap: { width: W - 90 },
      })
      .setOrigin(0.5)

    this.prompt.setText('撳一下開始').setAlpha(1).setY(H - 28).setVisible(true)
    this.tweens.add({ targets: this.prompt, alpha: 0.3, duration: 560, yoyo: true, repeat: -1 })
    this.inputReadyAt = this.time.now + 260
    this.armConfirm(() => this.leave())
  }

  private leave() {
    this.phase = 'done'
    this.cameras.main.fadeOut(280, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start('worldmap', { from: 1, to: 1, next: 'play' }))
  }
}
