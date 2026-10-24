import Phaser from 'phaser'
import { buildStageHud } from './hud'
import {
  EventBus,
  GameEvents,
  isAggregateHealth,
  type GameEventMap,
} from './EventBus'

/**
 * HUD overlay — launched in parallel with GameScene via scene.launch('UIScene').
 * Draws hearts / score / coins / game-over banners; listens on EventBus only.
 */
export class UIScene extends Phaser.Scene {
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private coinText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private hudInfo!: Phaser.GameObjects.Text
  private maxHp = 10

  /** Public for smoke / GameScene continueBox alias. */
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
    this.maxHp = hud.maxHp

    this.banner = this.add
      .text(480, 270, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '24px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020ee',
        padding: { x: 20, y: 14 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false)

    // GameScene registers under key 'play' (smoke / menu compat).
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

  private unbind() {
    EventBus.off(GameEvents.PLAYER_HEALTH_CHANGED, this.onHealth, this)
    EventBus.off(GameEvents.SCORE_UPDATED, this.onScore, this)
    EventBus.off(GameEvents.GAME_OVER, this.onGameOver, this)
  }

  private onHealth(p: GameEventMap['PLAYER_HEALTH_CHANGED']) {
    const full = this.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
    const empty = this.textures.exists('pip-empty') ? 'pip-empty' : 'heart-empty'
    const max = this.maxHp

    if (isAggregateHealth(p)) {
      for (let i = 0; i < max; i++) {
        this.heartsL[i]?.setTexture(i < p.boyHp ? full : empty)
        this.heartsR[i]?.setTexture(i < p.girlHp ? full : empty)
      }
      return
    }

    const hearts = p.role === 'boy' ? this.heartsL : this.heartsR
    for (let i = 0; i < max; i++) {
      hearts[i]?.setTexture(i < p.hp ? full : empty)
    }
  }

  private onScore(p: GameEventMap['SCORE_UPDATED']) {
    this.scoreText?.setText(`得分 ${p.score}`)
    if (p.coins !== undefined) this.coinText?.setText(`×${p.coins}`)
    if (p.info !== undefined) this.hudInfo?.setText(p.info)
  }

  private onGameOver(p: GameEventMap['GAME_OVER']) {
    if (!p.active) {
      this.banner.setVisible(false)
      return
    }
    this.banner.setText(p.message ?? '').setVisible(true)
  }
}
