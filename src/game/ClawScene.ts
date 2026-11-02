import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { playSong, SFX, unlockAudio } from './audio'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { DEST_NAMES } from './BikeScene'
import { clawGame, showTutorial, type ClawResult } from './minigames'

/**
 * 龍蝦夜市抓抓機 — replaces the bike ride on the 蜜樹丘 → 月影夜市 leg only (the other legs keep
 * BikeScene). Destination name and song come from the target stage, like BikeScene (0d28fcb); the
 * game itself is `clawGame` in minigames.ts. Coins won become extra continues, same as the bike.
 */
export class ClawScene extends Phaser.Scene {
  private toStage = 3
  private leaving = false
  private mini: ReturnType<typeof clawGame> | null = null

  constructor() {
    super('claw')
  }

  init(data?: { to?: number }) {
    const to = data?.to ?? (this.registry.get('stageNo') as number | undefined) ?? 3
    this.toStage = DEST_NAMES[to] ? to : 3
  }

  preload() {
    for (const n of ['lobster', 'shrimp', 'boot', 'can']) {
      if (!this.textures.exists(`claw-${n}`)) this.load.image(`claw-${n}`, `/art/props/claw-${n}.png`)
    }
  }

  create() {
    this.leaving = false
    this.mini = null
    const W = GAME_W
    const H = GAME_H
    unlockAudio()
    playSong(`stage${this.toStage}` as 'stage3')
    this.cameras.main.setBackgroundColor('#0a0818')
    this.cameras.main.fadeIn(400, 20, 10, 30)
    if (this.textures.exists('story-market-far')) {
      this.add.image(W / 2, H / 2, 'story-market-far').setDisplaySize(W, H).setTint(0x8a8ac0)
    }
    const dest = DEST_NAMES[this.toStage] ?? DEST_NAMES[3]!
    const sign = this.add
      .text(W / 2, 28, `去${dest}　途經龍蝦夜市`, { fontFamily: FONT_TITLE, fontSize: '16px', color: '#ff7ae0', stroke: '#2a0830', strokeThickness: 4 })
      .setOrigin(0.5)
    this.tweens.add({ targets: sign, alpha: { from: 1, to: 0.65 }, duration: 520, yoyo: true, repeat: -1 })
    const kb = this.input.keyboard!
    const skip = () => this.leave(null)
    kb.on('keydown-ESC', skip)
    this.events.once('shutdown', () => kb.off('keydown-ESC', skip))
    mountTouchControls(this)
    void this.run()
  }

  private async run() {
    const choice = await showTutorial(this, 'claw', [
      { title: '龍蝦夜市抓抓機', lines: ['←→ 移動夾爪，', '撳 攻擊鍵 落爪。'], tip: '啲貨喺輸送帶度郁，要預計佢郁到邊先落爪。' },
      { title: '邊樣值幾多', lines: ['龍蝦 6　蝦 3　舊鞋同罐頭 1', '金色龍蝦（好少見）12'], tip: '限時 18 秒，夾到嘅金幣帶去月影夜市用。' },
    ])
    if (this.leaving || !this.scene.isActive()) return
    if (choice === 'skip') return this.leave(null)
    this.mini = clawGame(this)
    const r = await this.mini.done
    if (this.leaving || !this.scene.isActive()) return
    this.leave(r)
  }

  private leave(r: ClawResult | null) {
    if (this.leaving) return
    this.leaving = true
    this.mini?.destroy()
    const coins = r?.coins ?? 0
    this.registry.set('carryCoins', ((this.registry.get('carryCoins') as number | undefined) ?? 5) + coins)
    this.registry.set('stageNo', this.toStage)
    if (r) {
      SFX.win()
      const box = this.add.container(GAME_W / 2, 150).setDepth(70)
      const bg = this.add.graphics()
      bg.fillStyle(0xff4fd8, 1).fillRect(-132, -40, 264, 80)
      bg.fillStyle(0x140a1e, 0.96).fillRect(-130, -38, 260, 76)
      const a = this.add.text(0, -18, `到咗${DEST_NAMES[this.toStage]}！`, { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffd76a' }).setOrigin(0.5)
      const b = this.add
        .text(0, 14, `金幣 ＋${r.coins}　夾中 ${r.caught} ／ ${r.drops} 次`, { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe9a8' })
        .setOrigin(0.5)
      box.add([bg, a, b])
    }
    this.time.delayedCall(r ? 2400 : 100, () => this.cameras.main.fadeOut(500, 0, 0, 0))
    this.time.delayedCall(r ? 2950 : 650, () => this.scene.start('play'))
  }
}
