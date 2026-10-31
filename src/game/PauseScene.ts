import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { SFX, setBgmDucked } from './audio'
import { TouchInput, isPhonePlay } from './touchInput'
import { connectedPads } from './gamepadBridge'
import { FONT_TITLE, FONT_UI } from './ui/fonts'

export type PauseData = {
  mode: '1p' | '2p'
  honey: number
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
}

const ITEMS = ['繼續', '重新開始本關', '返回選單'] as const

/** Pause overlay launched above GameScene (which is paused underneath). */
export class PauseScene extends Phaser.Scene {
  private cursor = 0
  private labels: Phaser.GameObjects.Text[] = []
  private arrow!: Phaser.GameObjects.Text
  private data_!: PauseData
  private closing = false
  private readyAt = 0

  constructor() {
    super('pause')
  }

  create(data: PauseData) {
    this.data_ = data
    this.cursor = 0
    this.closing = false
    this.labels = []
    this.readyAt = this.time.now + 180
    setBgmDucked(true)
    SFX.blip(440)
    const W = GAME_W
    const H = GAME_H

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x06040a, 0.62).setInteractive()
    dim.on('pointerdown', () => undefined)

    const pw = 220
    const ph = 132
    const px = W / 2 - pw / 2
    const py = H / 2 - ph / 2 - 18
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.4).fillRect(px + 3, py + 3, pw, ph)
    g.fillStyle(0xc8902a, 1).fillRect(px - 2, py - 2, pw + 4, ph + 4)
    g.fillStyle(0x6a4a18, 1).fillRect(px - 1, py - 1, pw + 2, ph + 2)
    g.fillStyle(0x1c120c, 1).fillRect(px, py, pw, ph)
    g.fillStyle(0x3a2616, 1).fillRect(px, py, pw, 3)
    // Gold corner studs.
    g.fillStyle(0xffe08a, 1)
    for (const [cx, cy] of [[px + 3, py + 3], [px + pw - 5, py + 3], [px + 3, py + ph - 5], [px + pw - 5, py + ph - 5]] as const) {
      g.fillRect(cx, cy, 2, 2)
    }

    this.add
      .text(W / 2, py + 18, '暫　停', { fontFamily: FONT_TITLE, fontSize: '20px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 4 })
      .setOrigin(0.5)
    this.add
      .text(W / 2, py + 38, `真蜂蜜　${data.honey} / 3`, { fontFamily: FONT_UI, fontSize: '10px', color: '#e8d8b0' })
      .setOrigin(0.5)

    ITEMS.forEach((s, i) => {
      const t = this.add
        .text(W / 2, py + 62 + i * 20, s, { fontFamily: FONT_UI, fontSize: '12px', color: '#9a8a78', stroke: '#0c0604', strokeThickness: 2 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerover', () => this.select(i))
      t.on('pointerdown', () => {
        this.select(i)
        this.confirm()
      })
      this.labels.push(t)
    })
    this.arrow = this.add
      .text(0, 0, '▶', { fontFamily: FONT_UI, fontSize: '11px', color: '#ffd76a', stroke: '#0c0604', strokeThickness: 2 })
      .setOrigin(0.5)
    this.tweens.add({ targets: this.arrow, x: '+=3', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    const pads = connectedPads().length
    const keys = isPhonePlay()
      ? '直接撳選項　或者用畫面按鈕：← → 揀，攻／跳 確認'
      : data.mode === '2p'
        ? 'P1　A D 行　G 跳　S 蹲　F 攻　T 絕招　H 換武器\nP2　← → 行　． 跳　↓ 蹲　， 攻　； 絕招　／ 換武器'
        : 'A D 行　G 跳　S 蹲\nF 攻擊　T 絕招（食蜂蜜充滿）　H 換武器'
    // LT, not R1 — index 6 on the standard layout (Cursor's device-testing pass caught
    // the earlier wrong "R1" naming; see gamepadBridge.ts).
    const help = pads || isPhonePlay() ? `${keys}\n手掣　A 跳　B／X 攻　Y／LB／RB 絕招　LT 換武器　Start 暫停` : keys
    this.add
      .text(W / 2, py + ph + 26, help, {
        fontFamily: FONT_UI,
        fontSize: '9px',
        color: '#e8d8b0',
        align: 'center',
        lineSpacing: 3,
        backgroundColor: '#1c120ccc',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 0)

    const kb = this.input.keyboard!
    const map: [string, () => void][] = [
      ['keydown-UP', () => this.select(this.cursor - 1, true)],
      ['keydown-W', () => this.select(this.cursor - 1, true)],
      ['keydown-DOWN', () => this.select(this.cursor + 1, true)],
      ['keydown-S', () => this.select(this.cursor + 1, true)],
      ['keydown-ENTER', () => this.confirm()],
      ['keydown-SPACE', () => this.confirm()],
      ['keydown-F', () => this.confirm()],
      ['keydown-J', () => this.confirm()],
      ['keydown-ESC', () => this.close(0)],
      ['keydown-P', () => this.close(0)],
    ]
    for (const [ev, fn] of map) kb.on(ev, fn)
    this.events.once('shutdown', () => {
      for (const [ev, fn] of map) kb.off(ev, fn)
      setBgmDucked(false)
    })
    this.select(0)
  }

  update() {
    if (TouchInput.justPressed('up') || TouchInput.justPressed('left')) this.select(this.cursor - 1, true)
    if (TouchInput.justPressed('down') || TouchInput.justPressed('right')) this.select(this.cursor + 1, true)
    if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) this.confirm()
    if (TouchInput.justPressed('start')) this.close(0)
  }

  private select(i: number, sound = false) {
    const n = ITEMS.length
    const next = ((i % n) + n) % n
    if (sound && next !== this.cursor) SFX.blip(660)
    this.cursor = next
    this.labels.forEach((t, j) => t.setColor(j === this.cursor ? '#ffe9a8' : '#9a8a78'))
    const t = this.labels[this.cursor]
    if (t) this.arrow.setPosition(t.x - t.width / 2 - 12, t.y)
  }

  private confirm() {
    if (this.time.now < this.readyAt) return
    this.close(this.cursor)
  }

  private close(choice: number) {
    if (this.closing) return
    this.closing = true
    SFX.blip(choice === 0 ? 520 : 360)
    const d = this.data_
    this.scene.stop()
    if (choice === 1) d.onRestart()
    else if (choice === 2) d.onMenu()
    else d.onResume()
  }
}
