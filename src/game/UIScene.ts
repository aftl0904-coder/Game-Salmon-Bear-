import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import Phaser from 'phaser'
import { buildSnesHud, type SnesHud } from './hudSnes'
import {
  EventBus,
  GameEvents,
  isAggregateHealth,
  type GameEventMap,
} from './EventBus'
import { mountTouchControls } from './TouchControls'
import { TouchInput } from './touchInput'
import { mountMuteButton } from './muteButton'
import { FONT_UI } from './ui/fonts'

/**
 * HUD overlay — two-row layout; hearts show all slots; 滿 only when MP full.
 */
export class UIScene extends Phaser.Scene {
  private hpFillL: Phaser.GameObjects.Rectangle | null = null
  private hpFillR: Phaser.GameObjects.Rectangle | null = null
  private hpBarWL = 1
  private hpBarWR = 1
  private coinText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private hud: SnesHud | null = null
  private toastUntil = 0
  private lastInfo = ''
  private honeyShown = -1
  private mpBar!: Phaser.GameObjects.Rectangle
  private mpText!: Phaser.GameObjects.Text
  private mpMaxW = 62
  private maxHp = 6
  private stamL = 1
  private stamR = 1
  private comboL = 0
  private comboR = 0
  private targetHpL = 6
  private targetHpR = 6
  private dispHpL = 6
  private dispHpR = 6
  private targetMp = 0
  private dispMp = 0
  private fullBlink = 0
  /** When true, ignore EventBus HP and keep dispHp frozen (QA). */
  private freezeHp = false

  banner!: Phaser.GameObjects.Text
  private menuBtn: Phaser.GameObjects.Text | null = null

  constructor() {
    super('UIScene')
  }

  private stageTitle = ''

  init(data: { mode?: '1p' | '2p'; stageTitle?: string }) {
    this.registry.set('uiMode', data.mode ?? this.registry.get('playMode') ?? '2p')
    this.stageTitle = data.stageTitle ?? ''
  }

  create() {
    const mode = (this.registry.get('uiMode') as '1p' | '2p') || '2p'
    const cfg = this.registry.get('gameConfig') as
      | { stageTitle?: string; stageSub?: string }
      | undefined

    const build = () => {
      const hud = buildSnesHud(this, {
        mode,
        stageTitle: this.stageTitle || cfg?.stageTitle || '第一關・百畝樹林',
        soloCast: (this.registry.get('soloCast') as 'boy' | 'girl') || 'boy',
      })
      this.hud = hud
      this.hpFillL = hud.hpFillL
      this.hpFillR = hud.hpFillR
      this.hpBarWL = hud.hpBarWL
      this.hpBarWR = hud.hpBarWR
      this.coinText = hud.coinText
      this.mpBar = hud.mpBar
      this.mpText = hud.mpText
      this.mpMaxW = hud.mpMaxW
      this.maxHp = hud.maxHp
      this.targetHpL = this.dispHpL = this.maxHp
      this.targetHpR = this.dispHpR = this.maxHp
      this.targetMp = this.dispMp = 0

      mountMuteButton(this, hud.muteAnchor.x + 11, hud.muteAnchor.y + 8)
      void cfg?.stageSub

      // QA / debug: force the HP bar fill without going through EventBus
      ;(
        window as unknown as {
          __SAKE_HUD_SET_HP__?: (hp: number) => void
        }
      ).__SAKE_HUD_SET_HP__ = (hp: number) => {
        const n = Math.max(0, Math.min(this.maxHp, Math.round(hp)))
        this.freezeHp = true
        this.targetHpL = this.dispHpL = n
        if (this.hpFillL) this.hpFillL.width = Math.max(0, this.hpBarWL * (n / this.maxHp))
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
      .text(GAME_W / 2, GAME_H / 2, '', {
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
    // Tap the game-over box = Start (insert coin, or back to the menu when out of coins).
    this.banner.setInteractive({ useHandCursor: true })
    this.banner.on('pointerdown', () => TouchInput.pulse('start'))
    this.menuBtn = this.add
      .text(GAME_W / 2, GAME_H / 2, '回選單', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#fff4d0',
        backgroundColor: '#3a2210ee',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI + 50)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.menuBtn.on('pointerdown', () => TouchInput.pulse('menu'))

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
    // Stale bar from a previous run (scene restart) has no scene — skip until rebuilt.
    if (!this.hpFillL || !this.hpFillL.scene) return
    const drain = Math.min(1, (dt / 1000) * 8)
    const recover = Math.min(1, (dt / 1000) * 6)
    this.dispHpL += (this.targetHpL - this.dispHpL) * (this.targetHpL < this.dispHpL ? drain : recover)
    this.dispHpR += (this.targetHpR - this.dispHpR) * (this.targetHpR < this.dispHpR ? drain : recover)
    this.dispMp += (this.targetMp - this.dispMp) * Math.min(1, (dt / 1000) * 10)
    // HP gauge: one continuous bar, fill = % of current max (incl. gear bonus hearts).
    // No number shown — just the fill, with a brighter red warning flash under 25%.
    const pctL = this.maxHp > 0 ? Phaser.Math.Clamp(this.dispHpL / this.maxHp, 0, 1) : 0
    this.hpFillL.width = Math.max(0, this.hpBarWL * pctL)
    this.hpFillL.fillColor = pctL < 0.25 ? 0xff5a4a : 0xe8384a
    if (this.hpFillR && this.hpFillR.scene) {
      const pctR = this.maxHp > 0 ? Phaser.Math.Clamp(this.dispHpR / this.maxHp, 0, 1) : 0
      this.hpFillR.width = Math.max(0, this.hpBarWR * pctR)
      this.hpFillR.fillColor = pctR < 0.25 ? 0xff5a4a : 0xe8384a
    }
    // 耐力 bars: blue when ready, red while winded.
    for (const [bar, v] of [[this.hud?.stamL, this.stamL], [this.hud?.stamR, this.stamR]] as const) {
      if (!bar || !bar.scene) continue
      const full = bar.getData('w0') as number | undefined
      const w0 = full ?? bar.width
      if (full === undefined) bar.setData('w0', w0)
      bar.width = Math.max(0, w0 * Phaser.Math.Clamp(v, 0, 1))
      bar.fillColor = v < 0.2 ? 0xff6a5a : v < 0.5 ? 0xffc040 : 0x6ad0ff
    }
    for (const [bar, w, v] of [
      [this.hud?.comboL, this.hud?.comboWL ?? 0, this.comboL],
      [this.hud?.comboR, this.hud?.comboWR ?? 0, this.comboR],
    ] as const) {
      if (!bar || !bar.scene) continue
      bar.width = Math.max(0, w * Phaser.Math.Clamp(v, 0, 1))
      const full = v >= 1
      bar.fillColor = full ? (Math.floor(this.time.now / 110) % 2 ? 0xb8d4ff : 0x3a78ff) : 0x3a78ff
    }
    if (this.mpBar) {
      this.mpBar.width = Math.max(0, this.dispMp * this.mpMaxW)
      this.mpBar.fillColor = this.dispMp > 0.55 ? 0x3ec8ff : 0x2a7098
    }
    if (this.hud && this.toastUntil && this.time.now > this.toastUntil) {
      this.toastUntil = 0
      this.tweens.add({ targets: this.hud.toast, alpha: 0, duration: 300, onComplete: () => this.hud?.toast.setVisible(false) })
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
      this.maxHp = p.maxHp
      if (p.stamL !== undefined) this.stamL = p.stamL
      if (p.stamR !== undefined) this.stamR = p.stamR
      if (p.comboL !== undefined) this.comboL = p.comboL
      if (p.comboR !== undefined) this.comboR = p.comboR
      return
    }
    if (p.role === 'boy') this.targetHpL = p.hp
    else this.targetHpR = p.hp
  }

  private onScore(p: GameEventMap['SCORE_UPDATED']) {
    if (p.coins !== undefined) this.coinText?.setText(`×${p.coins}`)
    if (p.special !== undefined) this.targetMp = Phaser.Math.Clamp(p.special, 0, 1)
    void this.scoreText
    const hud = this.hud
    if (!hud || !hud.toast.scene) return
    if (p.honey !== undefined && p.honey !== this.honeyShown) {
      hud.honey.forEach((j, i) => {
        const on = i < (p.honey ?? 0)
        j.setTexture(on ? hud.jarFull : hud.jarEmpty)
        // Pop the jar that was just filled.
        if (on && i >= this.honeyShown && this.honeyShown >= 0) this.tweens.add({ targets: j, y: j.y - 3, yoyo: true, duration: 140 })
      })
      this.honeyShown = p.honey
    }
    const setW = (icons: Phaser.GameObjects.Image[], lv: number | undefined) =>
      icons.forEach((w, i) => w.setTexture(i < (lv ?? 1) ? hud.fishOn : hud.fishOff))
    setW(hud.weaponL, p.wlvL)
    setW(hud.weaponR, p.wlvR)
    // Weapon-mode badge: same colour pair for both heroes (cyan = normal, gold =
    // heavy) so the state reads at a glance regardless of which role is on which side.
    if (p.wmodeLabelL !== undefined) hud.modeTagL.setText(p.wmodeLabelL).setColor(p.wmodeL === 'heavy' ? '#ffb060' : '#8ad8ff')
    if (p.wmodeLabelR !== undefined) hud.modeTagR.setText(p.wmodeLabelR).setColor(p.wmodeR === 'heavy' ? '#ffb060' : '#8ad8ff')
    if (p.progress !== undefined && hud.marker) {
      hud.marker.x = Math.round(hud.trackX0 + (hud.trackX1 - hud.trackX0) * p.progress)
      hud.marker.y = GAME_H - 8 + (Math.floor(this.time.now / 180) % 2)
    }
    if (p.timeSec !== undefined) hud.timeText.setText(`${p.timeSec}秒`)
    if (p.info && p.info !== this.lastInfo) {
      this.lastInfo = p.info
      this.tweens.killTweensOf(hud.toast)
      hud.toast.setText(p.info).setVisible(true).setAlpha(1)
      this.toastUntil = this.time.now + 2800
    }
  }

  private onGameOver(p: GameEventMap['GAME_OVER']) {
    this.tweens.killTweensOf(this.banner)
    if (!p.active) {
      this.banner.setVisible(false).setScale(1).setAlpha(1)
      this.menuBtn?.setVisible(false)
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
    if (p.canContinue && !p.win && this.menuBtn) {
      this.menuBtn.setY(this.banner.y + this.banner.height / 2 + 8).setVisible(true)
    }
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
