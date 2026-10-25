import { DEPTH } from './engine/depth'
import Phaser from 'phaser'
import { buildStageHud } from './hud'
import {
  EventBus,
  GameEvents,
  isAggregateHealth,
  type GameEventMap,
} from './EventBus'
import { mountTouchControls } from './TouchControls'
import { mountMuteButton } from './muteButton'
import { FONT_UI } from './ui/fonts'

/**
 * HUD overlay — two-row layout; hearts show all slots; 滿 only when MP full.
 */
export class UIScene extends Phaser.Scene {
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private coinText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private hudInfo!: Phaser.GameObjects.Text
  private mpBar!: Phaser.GameObjects.Rectangle
  private mpText!: Phaser.GameObjects.Text
  private mpMaxW = 62
  private maxHp = 6
  private targetHpL = 6
  private targetHpR = 6
  private dispHpL = 6
  private dispHpR = 6
  private targetMp = 0
  private dispMp = 0
  private pipFull = 'heart-full'
  private pipEmpty = 'heart-empty'
  private fullBlink = 0
  /** When true, ignore EventBus HP and keep dispHp frozen (QA). */
  private freezeHp = false

  banner!: Phaser.GameObjects.Text

  constructor() {
    super('UIScene')
  }

  init(data: { mode?: '1p' | '2p' }) {
    this.registry.set('uiMode', data.mode ?? this.registry.get('playMode') ?? '2p')
  }

  create() {
    const mode = (this.registry.get('uiMode') as '1p' | '2p') || '2p'
    const cfg = this.registry.get('gameConfig') as
      | { stageTitle?: string; stageSub?: string }
      | undefined

    const build = () => {
      const hud = buildStageHud(this, {
        mode,
        stageTitle: cfg?.stageTitle ?? '第一關・百畝樹林',
        stageSub: cfg?.stageSub ?? '奪回蜂蜜',
      })
      this.heartsL = hud.heartsL
      this.heartsR = hud.heartsR
      this.hudInfo = hud.info
      this.coinText = hud.coinText
      this.scoreText = hud.scoreText
      this.mpBar = hud.mpBar
      this.mpText = hud.mpText
      this.mpMaxW = hud.mpMaxW
      this.maxHp = hud.maxHp
      this.pipFull = hud.pipFull
      this.pipEmpty = hud.pipEmpty
      this.targetHpL = this.dispHpL = this.maxHp
      this.targetHpR = this.dispHpR = this.maxHp
      this.targetMp = this.dispMp = 0

      mountMuteButton(this, hud.muteAnchor.x + 11, hud.muteAnchor.y + 8)

      // QA / debug: force HP pip textures without going through EventBus
      ;(
        window as unknown as {
          __SAKE_HUD_SET_HP__?: (hp: number) => void
        }
      ).__SAKE_HUD_SET_HP__ = (hp: number) => {
        const n = Math.max(0, Math.min(this.maxHp, Math.round(hp)))
        this.freezeHp = true
        this.targetHpL = this.dispHpL = n
        for (let i = 0; i < this.maxHp; i++) {
          this.heartsL[i]?.setTexture(i < n ? this.pipFull : this.pipEmpty)
        }
      }
    }

    // Wait for Fusion Pixel so first paint uses correct metrics (no font swap jump).
    const ready = Promise.race([
      document.fonts?.load('12px "Fusion Pixel"').then(() => document.fonts.ready),
      new Promise<void>((r) => setTimeout(r, 800)),
    ])
    void ready.then(() => {
      if (!this.sys.settings.active && this.sys.settings.status !== 1) {
        /* scene may have shut down */
      }
      try {
        build()
      } catch (e) {
        console.warn('[hud] build failed', e)
      }
    })
    // Sync fallback if fonts already ready
    if (document.fonts?.status === 'loaded') {
      // still async microtask via ready
    }

    this.banner = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: '#ffe8b0',
        backgroundColor: '#120818f2',
        padding: { x: 14, y: 10 },
        align: 'center',
        shadow: { offsetX: 1, offsetY: 1, color: '#1a1008', blur: 0, fill: true, stroke: false },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI + 50)
      .setVisible(false)

    const game = this.scene.get('play') as Phaser.Scene & {
      banner?: Phaser.GameObjects.Text
      continueBox?: Phaser.GameObjects.Text
    }
    if (game) {
      game.banner = this.banner
      game.continueBox = this.banner
    }

    EventBus.on(GameEvents.PLAYER_HEALTH_CHANGED, this.onHealth, this)
    EventBus.on(GameEvents.SCORE_UPDATED, this.onScore, this)
    EventBus.on(GameEvents.GAME_OVER, this.onGameOver, this)

    mountTouchControls(this)

    this.events.once('shutdown', this.unbind, this)
    this.events.once('destroy', this.unbind, this)
  }

  update(_t: number, dt: number) {
    if (!this.heartsL.length) return
    const drain = Math.min(1, (dt / 1000) * 8)
    const recover = Math.min(1, (dt / 1000) * 6)
    this.dispHpL += (this.targetHpL - this.dispHpL) * (this.targetHpL < this.dispHpL ? drain : recover)
    this.dispHpR += (this.targetHpR - this.dispHpR) * (this.targetHpR < this.dispHpR ? drain : recover)
    this.dispMp += (this.targetMp - this.dispMp) * Math.min(1, (dt / 1000) * 10)
    for (let i = 0; i < this.maxHp; i++) {
      this.heartsL[i]?.setTexture(i < Math.round(this.dispHpL) ? this.pipFull : this.pipEmpty)
      this.heartsR[i]?.setTexture(i < Math.round(this.dispHpR) ? this.pipFull : this.pipEmpty)
    }
    if (this.mpBar) {
      this.mpBar.width = Math.max(0, this.dispMp * this.mpMaxW)
      this.mpBar.fillColor = this.dispMp > 0.55 ? 0x3ec8ff : 0x2a7098
    }
    if (this.mpText) {
      const full = this.targetMp >= 1
      this.mpText.setText(full ? '滿' : '')
      this.mpText.setVisible(full)
      if (full) {
        this.fullBlink += dt
        this.mpText.setAlpha(0.55 + 0.45 * Math.sin(this.fullBlink / 120))
      } else {
        this.mpText.setAlpha(1)
      }
    }
  }

  private unbind() {
    EventBus.off(GameEvents.PLAYER_HEALTH_CHANGED, this.onHealth, this)
    EventBus.off(GameEvents.SCORE_UPDATED, this.onScore, this)
    EventBus.off(GameEvents.GAME_OVER, this.onGameOver, this)
  }

  private onHealth(p: GameEventMap['PLAYER_HEALTH_CHANGED']) {
    if (this.freezeHp) return
    if (isAggregateHealth(p)) {
      this.targetHpL = p.boyHp
      this.targetHpR = p.girlHp
      return
    }
    if (p.role === 'boy') this.targetHpL = p.hp
    else this.targetHpR = p.hp
  }

  private onScore(p: GameEventMap['SCORE_UPDATED']) {
    if (p.coins !== undefined) this.coinText?.setText(`×${p.coins}`)
    if (p.special !== undefined) this.targetMp = Phaser.Math.Clamp(p.special, 0, 1)
    if (p.info !== undefined) this.hudInfo?.setText(p.info)
    void this.scoreText
  }

  private onGameOver(p: GameEventMap['GAME_OVER']) {
    this.tweens.killTweensOf(this.banner)
    if (!p.active) {
      this.banner.setVisible(false).setScale(1).setAlpha(1)
      return
    }
    this.banner.setStyle({
      fontSize: '16px',
      color: p.win ? '#fff4c8' : '#ffe08a',
      backgroundColor: p.win ? '#1a2810f5' : '#280810f5',
      shadow: { offsetX: 1, offsetY: 1, color: '#1a1008', blur: 0, fill: true, stroke: false },
    })
    this.banner.setText(p.message ?? '').setVisible(true).setScale(1).setAlpha(1)
    this.tweens.add({
      targets: this.banner,
      scale: 1,
      duration: 180,
      ease: 'Back.out',
    })
    if (p.canContinue && !p.win) {
      this.tweens.add({
        targets: this.banner,
        alpha: 0.72,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
  }
}
