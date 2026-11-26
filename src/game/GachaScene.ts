import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { unlockAudio, SFX } from './audio'
import { TouchInput } from './touchInput'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { CHARMS, rollCharm, setActiveCharm, type CharmDef, type CharmId } from './charms'
import { rememberCharm } from './run'
import { gradeResult, showGradeResult, showSegmentBanner, TIMING_WINDOWS_MS } from './minigameFramework'

/**
 * 扭蛋機: one random charm per run, drawn right before stage 1 starts
 * (docs/cursor/ART-REQUEST-10-gacha-omamori.json). Game logic lives entirely
 * here + src/game/charms.ts + the gear.ts hooks it feeds.
 */
export class GachaScene extends Phaser.Scene {
  private inputReadyAt = 0
  private prompt!: Phaser.GameObjects.Text
  private capsule: Phaser.GameObjects.Sprite | null = null
  private machine: Phaser.GameObjects.Image | null = null
  /** The one action a confirm (tap/key/pad) should do right now; null while mid-animation. */
  private pendingConfirm: (() => void) | null = null

  constructor() {
    super('gacha')
  }

  create() {
    const W = GAME_W
    const H = GAME_H
    this.inputReadyAt = this.time.now + 350
    this.pendingConfirm = null
    this.cameras.main.setBackgroundColor('#140a1e')
    this.cameras.main.fadeIn(280, 20, 10, 30)

    this.add.text(W / 2, 34, '扭　蛋　機', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#ffe08a', stroke: '#2a1408', strokeThickness: 4 }).setOrigin(0.5)
    this.add.text(W / 2, 58, '開局前扭一次，呢次遊玩全程都係呢張符咒', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8b0e0' }).setOrigin(0.5)

    if (this.textures.exists('gacha-machine')) {
      this.machine = this.add.image(W / 2, H - 20, 'gacha-machine').setOrigin(0.5, 1).setScale(0.78)
    }

    this.prompt = this.add
      .text(W / 2, H - 28, '撳 Enter／畫面　扭一扭', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a', backgroundColor: '#3a2410cc', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
    this.tweens.add({ targets: this.prompt, alpha: 0.3, duration: 560, yoyo: true, repeat: -1 })

    mountTouchControls(this)
    // A single shared "confirm" gesture (tap / Enter / pad) drives two sequential
    // steps (spin, then leave). Each step is consumed exactly once via
    // pendingConfirm — immune to OS key-repeat re-firing a held Enter, unlike a
    // persistent on('keydown') handler would be.
    const fire = () => {
      if (this.time.now < this.inputReadyAt) return
      const action = this.pendingConfirm
      if (!action) return
      this.pendingConfirm = null
      action()
    }
    this.input.on('pointerdown', fire)
    this.input.keyboard?.on('keydown', fire)
    this.armConfirm(() => this.spin())
    // KeyboardPlugin is shared across scenes (see GameScene.onSceneShutdown) —
    // drop this listener explicitly or a later scene's first keypress replays fire().
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', fire)
      this.input.keyboard?.off('keydown', fire)
    })
  }

  /** Arms the next confirm gesture to run `action` exactly once. */
  private armConfirm(action: () => void) {
    this.pendingConfirm = action
  }

  update() {
    if (!this.pendingConfirm) return
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) {
      if (this.time.now < this.inputReadyAt) return
      const action = this.pendingConfirm
      this.pendingConfirm = null
      action()
    }
  }

  private spin() {
    unlockAudio()
    void this.wheelSkill().then(() => this.spinCharm())
  }

  /** 3-segment stop-the-wheel before the charm roll. */
  private async wheelSkill(): Promise<void> {
    const SPEEDS = [90, 150, 220] as const
    const ZONES = [60, 40, 25] as const
    const W = GAME_W
    const cx = W / 2
    const cy = GAME_H / 2 - 20
    const g = this.add.graphics().setDepth(48)
    const tip = this.add
      .text(cx, cy + 92, '撳一下停喺綠區', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' })
      .setOrigin(0.5)
      .setDepth(49)
    let good = 0
    for (let seg = 0; seg < 3; seg++) {
      await showSegmentBanner(this, (seg + 1) as 1 | 2 | 3)
      const dps = (SPEEDS[seg]! * Math.PI) / 180
      const zoneRad = (ZONES[seg]! * Math.PI) / 180
      let angle = 0
      const ok = await new Promise<boolean>((resolve) => {
        let gone = false
        const end = (hit: boolean) => {
          if (gone) return
          gone = true
          this.events.off('update', tick)
          this.input.off('pointerdown', press)
          this.input.keyboard?.off('keydown', press)
          resolve(hit)
        }
        const press = () => {
          const target = 0
          const diff = Math.abs(Phaser.Math.Angle.ShortestBetween(angle, target))
          const slack = zoneRad * 0.5 + (TIMING_WINDOWS_MS[seg]! / 1000) * dps
          end(diff <= slack + zoneRad * 0.5)
        }
        const tick = () => {
          const dt = this.game.loop.delta / 1000
          angle += dps * dt
          g.clear()
          g.lineStyle(3, 0x4a3a28, 1).strokeCircle(cx, cy, 74)
          g.fillStyle(0x3a8a40, 0.45)
          g.beginPath()
          g.arc(cx, cy, 72, -Math.PI / 2 - zoneRad / 2, -Math.PI / 2 + zoneRad / 2, false)
          g.fillPath()
          g.lineStyle(5, 0xffe08a, 1).lineBetween(cx, cy, cx + Math.cos(angle - Math.PI / 2) * 72, cy + Math.sin(angle - Math.PI / 2) * 72)
        }
        this.events.on('update', tick)
        this.input.once('pointerdown', press)
        this.input.keyboard?.once('keydown', press)
        tick()
        this.time.delayedCall(12000, () => end(false))
      })
      if (ok) good++
    }
    g.destroy()
    tip.destroy()
    await showGradeResult(this, gradeResult(good, 3, 'timing', false, 'gacha'))
  }

  private spinCharm() {
    unlockAudio()
    // iOS 13+: DeviceMotion needs a permission request fired directly inside a
    // user-gesture handler — this tap is the one guaranteed gesture everyone
    // takes, so ask here regardless of which charm ends up rolled.
    const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (DME?.requestPermission) DME.requestPermission().catch(() => undefined)

    this.tweens.killTweensOf(this.prompt)
    this.prompt.setVisible(false)
    const W = GAME_W
    const H = GAME_H
    // QA hook (bots): registry 'forceCharm' skips the real roll for deterministic testing.
    const forced = this.registry.get('forceCharm') as CharmId | undefined
    const charm = forced ? setActiveCharm(forced) : rollCharm()
    rememberCharm(charm.id)
    const finalFrame = Math.max(0, CHARMS.findIndex((c) => c.id === charm.id))

    if (this.textures.exists('gacha-capsules')) {
      this.capsule = this.add.sprite(W / 2, H - 70, 'gacha-capsules', 0).setScale(1.6)
      this.tweens.add({ targets: this.capsule, y: H / 2 - 30, duration: 260, ease: 'Back.out' })
    }
    // The capsule floats up over the machine's dome on its way to the reveal spot —
    // fade the machine out of the way so it doesn't clutter the reveal.
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
    SFX.powerUp()
    const W = GAME_W
    const H = GAME_H
    const cy = H / 2 - 30 // matches the capsule's resting y from spin()
    this.tweens.add({ targets: this.capsule, scale: { from: 1.6, to: 2.1 }, duration: 160, yoyo: true })

    if (this.textures.exists(charm.icon)) this.add.image(W / 2, cy - 48, charm.icon).setScale(1.3)
    this.add
      .text(W / 2, cy, charm.name, { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffe08a', stroke: '#2a1408', strokeThickness: 4 })
      .setOrigin(0.5)
    this.add
      .text(W / 2, cy + 56, charm.desc, { fontFamily: FONT_UI, fontSize: '11px', color: '#f0e6d8', align: 'center', wordWrap: { width: W - 90 } })
      .setOrigin(0.5)

    this.prompt.setText('撳任意鍵　開始').setAlpha(1).setY(H - 28).setVisible(true)
    this.tweens.add({ targets: this.prompt, alpha: 0.3, duration: 560, yoyo: true, repeat: -1 })
    this.inputReadyAt = this.time.now + 260
    this.armConfirm(() => this.leave())
  }

  private leave() {
    this.cameras.main.fadeOut(280, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start('worldmap', { from: 1, to: 1, next: 'play' }))
  }
}
