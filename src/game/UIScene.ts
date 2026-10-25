import { DEPTH } from './engine/depth'
import Phaser from 'phaser'
import { buildStageHud } from './hud'
import {
  EventBus,
  GameEvents,
  isAggregateHealth,
  type GameEventMap,
} from './EventBus'

/**
 * HUD overlay — hearts + blue 絕招 MP; no red HP strip / no score plate.
 */
export class UIScene extends Phaser.Scene {
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private coinText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private hudInfo!: Phaser.GameObjects.Text
  private mpBar!: Phaser.GameObjects.Rectangle
  private mpText!: Phaser.GameObjects.Text
  private mpMaxW = 156
  private maxHp = 10
  private targetHpL = 10
  private targetHpR = 10
  private dispHpL = 10
  private dispHpR = 10
  private targetMp = 0
  private dispMp = 0

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

    const hud = buildStageHud(this, {
      mode,
      stageTitle: cfg?.stageTitle ?? '第一關・溪流小路',
      stageSub: cfg?.stageSub ?? '奪回春蜜',
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
    this.targetHpL = this.dispHpL = this.maxHp
    this.targetHpR = this.dispHpR = this.maxHp
    this.targetMp = this.dispMp = 0

    this.banner = this.add
      .text(480, 270, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '26px',
        color: '#ffe8b0',
        backgroundColor: '#120818f2',
        padding: { x: 28, y: 18 },
        align: 'center',
        stroke: '#c48a28',
        strokeThickness: 3,
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

    this.events.once('shutdown', this.unbind, this)
    this.events.once('destroy', this.unbind, this)
  }

  update(_t: number, dt: number) {
    const drain = Math.min(1, (dt / 1000) * 8)
    const recover = Math.min(1, (dt / 1000) * 6)
    this.dispHpL += (this.targetHpL - this.dispHpL) * (this.targetHpL < this.dispHpL ? drain : recover)
    this.dispHpR += (this.targetHpR - this.dispHpR) * (this.targetHpR < this.dispHpR ? drain : recover)
    this.dispMp += (this.targetMp - this.dispMp) * Math.min(1, (dt / 1000) * 10)
    const full = this.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
    const empty = this.textures.exists('pip-empty') ? 'pip-empty' : 'heart-empty'
    for (let i = 0; i < this.maxHp; i++) {
      this.heartsL[i]?.setTexture(i < Math.round(this.dispHpL) ? full : empty)
      this.heartsR[i]?.setTexture(i < Math.round(this.dispHpR) ? full : empty)
    }
    if (this.mpBar) {
      this.mpBar.width = Math.max(0, this.dispMp * this.mpMaxW)
      this.mpBar.fillColor = this.dispMp > 0.55 ? 0x3ec8ff : 0x2a7098
    }
    if (this.mpText) {
      this.mpText.setText(this.targetMp >= 1 ? '滿・Ｔ放招' : '食春蜜')
      this.mpText.setColor(this.targetMp >= 1 ? '#66eeff' : '#88aacc')
    }
  }

  private unbind() {
    EventBus.off(GameEvents.PLAYER_HEALTH_CHANGED, this.onHealth, this)
    EventBus.off(GameEvents.SCORE_UPDATED, this.onScore, this)
    EventBus.off(GameEvents.GAME_OVER, this.onGameOver, this)
  }

  private onHealth(p: GameEventMap['PLAYER_HEALTH_CHANGED']) {
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
    if (p.win) {
      this.banner.setStyle({
        fontSize: '28px',
        color: '#fff4c8',
        backgroundColor: '#1a2810f5',
        stroke: '#e8c040',
        strokeThickness: 4,
      })
    } else if (p.canContinue) {
      this.banner.setStyle({
        fontSize: '26px',
        color: '#ffe08a',
        backgroundColor: '#280810f5',
        stroke: '#ff6644',
        strokeThickness: 4,
      })
    } else {
      this.banner.setStyle({
        fontSize: '26px',
        color: '#f7e7c0',
        backgroundColor: '#120818f2',
        stroke: '#886040',
        strokeThickness: 3,
      })
    }
    this.banner.setText(p.message ?? '').setVisible(true).setScale(0.86).setAlpha(1)
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
