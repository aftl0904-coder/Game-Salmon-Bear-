import Phaser from 'phaser'
import { playSong, stopBgm, SFX } from './audio'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { animTex, hasAnimSet, type AnimSetId } from './heroAnims'

/**
 * SNES staff roll: the cast parades across the bottom while the credits scroll up,
 * then 「完」. Any press after the roll (or a long hold during it) returns to the menu.
 */
type Line = { t: string; size?: number; color?: string; gap?: number; title?: boolean }

const ROLL: Line[] = [
  { t: '鮭鮭熊', size: 30, color: '#ffd76a', title: true, gap: 34 },
  { t: '— 第一章・完 —', size: 12, color: '#e8d8b0', gap: 46 },
  { t: '登場角色', size: 13, color: '#ffb070', gap: 22 },
  { t: '倫寶', gap: 16 },
  { t: '琪寶寶', gap: 16 },
  { t: '噗噗', gap: 16 },
  { t: '咖啡媽媽', gap: 16 },
  { t: '蜜冠女王蜂', gap: 40 },
  { t: '敵人', size: 13, color: '#ffb070', gap: 22 },
  { t: '紅魚　帽仔兵　機械豬　疾風桶', gap: 16 },
  { t: '蜜蜂兵　蜜僵松鼠　小蜜蜂', gap: 40 },
  { t: '監製・故事', size: 13, color: '#ffb070', gap: 22 },
  { t: 'ALAN FONG', size: 16, color: '#ffffff', gap: 40 },
  { t: '美術', size: 13, color: '#ffb070', gap: 22 },
  { t: 'Cursor', gap: 40 },
  { t: '程式・音樂・音效', size: 13, color: '#ffb070', gap: 22 },
  { t: 'Claude', gap: 40 },
  { t: '送給', size: 13, color: '#ffb070', gap: 22 },
  { t: '最重要嘅妳', size: 16, color: '#ffd0e0', gap: 56 },
  { t: '仲有三罐真蜂蜜……', size: 12, color: '#e8d8b0', gap: 18 },
  { t: '噗噗，等埋我哋。', size: 12, color: '#e8d8b0', gap: 70 },
  { t: '多謝遊玩', size: 22, color: '#ffd76a', title: true, gap: 0 },
]

export class CreditsScene extends Phaser.Scene {
  private done = false
  private readyAt = 0
  private col: Phaser.GameObjects.Container | null = null
  private endY = 0

  constructor() {
    super('credits')
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height
    this.done = false
    this.readyAt = this.time.now + 1500
    this.cameras.main.setBackgroundColor('#000000')
    this.cameras.main.fadeIn(800, 0, 0, 0)
    stopBgm()
    playSong('story')

    if (this.textures.exists('story-credits-bg')) {
      const bg = this.add.image(W / 2, H / 2, 'story-credits-bg').setAlpha(0.45)
      this.tweens.add({ targets: bg, scale: 1.05, duration: 30000 })
    }
    const g = this.add.graphics()
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0x000000, 0.65 * (1 - i / 20))
      g.fillRect(0, i * 4, W, 4)
      g.fillRect(0, H - (i + 1) * 4, W, 4)
    }

    // Scrolling column of text.
    const col = this.add.container(W / 2, H + 20)
    let y = 0
    for (const l of ROLL) {
      const t = this.add
        .text(0, y, l.t, {
          fontFamily: l.title ? FONT_TITLE : FONT_UI,
          fontSize: `${l.size ?? 12}px`,
          color: l.color ?? '#fff2d0',
          stroke: '#1a0e06',
          strokeThickness: l.title ? 5 : 3,
        })
        .setOrigin(0.5, 0)
      col.add(t)
      y += (l.size ?? 12) + (l.gap ?? 16)
    }
    const endY = H / 2 - y + 10
    this.col = col
    this.endY = endY
    const dur = (H + 20 - endY) * 42
    this.tweens.add({ targets: col, y: endY, duration: dur, ease: 'Linear', onComplete: () => this.showEnd() })

    // Cast parade along the bottom, walking right to left.
    const parade: Array<[AnimSetId, string]> = [
      ['lunbo', 'walk'],
      ['kibobo', 'run'],
      ['pupu', 'walk'],
      ['squirrel', 'walk'],
      ['beesoldier', 'fly'],
      ['fish', 'walk'],
    ]
    parade.forEach(([set, anim], i) => {
      if (!hasAnimSet(this, set) || !this.anims.exists(`${set}-${anim}`)) return
      const sp = this.add
        .sprite(W + 40 + i * 70, H - 18, animTex(set))
        .setOrigin(0.5, 1)
        .setFlipX(true)
        .play(`${set}-${anim}`)
      if (set === 'beesoldier') sp.setY(H - 60)
      this.tweens.add({ targets: sp, x: -60 - (parade.length - i) * 70, duration: 26000, delay: 2000, repeat: -1, repeatDelay: 4000 })
    })

    const kb = this.input.keyboard
    const go = () => this.leave()
    kb?.on('keydown', go)
    this.input.on('pointerdown', go)
    this.events.once('shutdown', () => {
      kb?.off('keydown', go)
      this.input.off('pointerdown', go)
    })
  }

  update() {
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.leave()
  }

  private showEnd() {
    if (this.done) return
    this.done = true
    const W = this.scale.width
    const H = this.scale.height
    const fin = this.add
      .text(W / 2, H / 2 + 46, '完', { fontFamily: FONT_TITLE, fontSize: '28px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0)
    this.tweens.add({ targets: fin, alpha: 1, duration: 900 })
    SFX.sparkle()
    const hint = this.add
      .text(W / 2, H - 10, '按任意鍵回選單', { fontFamily: FONT_UI, fontSize: '10px', color: '#e8d8b0' })
      .setOrigin(0.5, 1)
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 })
  }

  private leave() {
    if (this.time.now < this.readyAt) return
    // During the roll the first press only speeds to the end; after it, back to the menu.
    if (!this.done) {
      if (this.col) {
        this.tweens.killTweensOf(this.col)
        this.col.y = this.endY
      }
      this.showEnd()
      this.readyAt = this.time.now + 600
      return
    }
    this.readyAt = Number.POSITIVE_INFINITY
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.time.delayedCall(520, () => this.scene.start('menu'))
  }
}
