import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { animTex } from './heroAnims'
import { GALLERY, type GalleryEntry } from './galleryData'
import { FONT_TITLE, FONT_UI } from './ui/fonts'

type Group = GalleryEntry['group']
const actionNames: Record<string, string> = { idle: '待機', shoot: '射擊', win: '勝利', slash3: '旋轉斬', 'fan-glide': '風扇滑翔', 'cute-pose': '可愛姿勢', tackle: '衝撞', walk: '行走', charge: '蓄力', dash: '衝刺', 'throw-low': '低投', 'throw-high': '高投', lunge: '突進', block: '格擋', fly: '飛行', aim: '瞄準', dive: '俯衝', hit: '受擊', hover: '盤旋', summon: '召喚', spray: '噴蜜', die: '倒下', hatch: '孵化', break: '破開', throw: '投擲', duck: '躲避', float: '浮游', split: '分身', perch: '棲立', 'feather-curtain': '羽幕', reach: '伸手', tick: '倒數', burst: '爆發', flash: '閃燈', ride: '騎車', nailgun: '釘槍', punch: '拳擊', point: '指揮', shield: '護盾' }

/** Draft gallery: only plays assets actually wired in main; missing art is never substituted. */
export class GalleryScene extends Phaser.Scene {
  private group: Group = 'good'
  private index = 0
  private action = 0
  private content!: Phaser.GameObjects.Container
  private readyAt = 0
  constructor() { super('gallery') }
  create() {
    this.group = 'good'; this.index = 0; this.action = 0; this.readyAt = this.time.now + 300
    this.cameras.main.setBackgroundColor('#1c1817')
    this.add.rectangle(320, 180, 636, 356, 0x241b18).setStrokeStyle(2, 0xc8902a)
    this.add.text(320, 22, '角色集  ·  製作中', { fontFamily: FONT_TITLE, fontSize: '21px', color: '#ffe09a' }).setOrigin(0.5)
    this.add.text(320, 45, '無進度鎖　含劇透；素材不足，仍在製作中', { fontFamily: FONT_UI, fontSize: '10px', color: '#e6d1ad' }).setOrigin(0.5)
    this.button(61, 23, 92, 30, '返回', () => this.back())
    this.content = this.add.container()
    this.renderCard()
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.time.now < this.readyAt) return
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.back() }
      else if (e.key === 'ArrowLeft') this.move(-1)
      else if (e.key === 'ArrowRight') this.move(1)
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.switchGroup(this.group === 'good' ? 'bad' : 'good')
      else if (['1', '2', '3'].includes(e.key)) this.chooseAction(Number(e.key) - 1)
      else if (e.key.toLowerCase() === 'g') this.switchGroup('good')
      else if (e.key.toLowerCase() === 'b') this.switchGroup('bad')
    }
    this.input.keyboard?.on('keydown', onKey)
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown', onKey))
  }
  private entries() { return GALLERY.filter(e => e.group === this.group) }
  private back() { if (this.time.now >= this.readyAt) this.scene.start('logo') }
  private move(n: number) { const list = this.entries(); this.index = (this.index + n + list.length) % list.length; this.action = 0; this.renderCard() }
  private switchGroup(group: Group) { this.group = group; this.index = 0; this.action = 0; this.renderCard() }
  private chooseAction(n: number) { this.action = n; this.renderCard() }
  private button(x: number, y: number, w: number, h: number, text: string, action: () => void, parent?: Phaser.GameObjects.Container, selected = false) {
    const bg = this.add.rectangle(x, y, w, h, selected ? 0x77502d : 0x39271d).setStrokeStyle(1, selected ? 0xffd76a : 0xa97943).setInteractive({ useHandCursor: true })
    const label = this.add.text(x, y, text, { fontFamily: FONT_UI, fontSize: '12px', color: '#fff2d0' }).setOrigin(0.5)
    bg.on('pointerdown', () => { if (this.time.now >= this.readyAt) action() })
    parent?.add([bg, label])
  }
  private renderCard() {
    this.content.removeAll(true)
    const list = this.entries(), entry = list[this.index]!, act = entry.actions[this.action]!
    this.button(252, 69, 120, 27, '好', () => this.switchGroup('good'), this.content, this.group === 'good')
    this.button(388, 69, 120, 27, '壞（對戰）', () => this.switchGroup('bad'), this.content, this.group === 'bad')
    this.content.add(this.add.rectangle(320, 181, 480, 181, 0x30251e).setStrokeStyle(1, 0x6f5037))
    const text = (x: number, y: number, value: string, size = '12px', color = '#f5e5c7') => {
      const t = this.add.text(x, y, value, { fontFamily: FONT_UI, fontSize: size, color, align: 'center', wordWrap: { width: 210 } }).setOrigin(0.5)
      this.content.add(t)
    }
    text(220, 145, `${entry.name}  ${this.index + 1} / ${list.length}`, '16px', '#ffe09a')
    text(220, 170, entry.where, '11px')
    if (entry.note) text(220, 199, entry.note, '10px', '#ffd18b')
    const key = act.anim && entry.set ? animTex(entry.set) : act.still
    if (key && this.textures.exists(key)) {
      if (act.anim && entry.set && this.anims.exists(`${entry.set}-${act.anim}`)) {
        const sprite = this.add.sprite(420, 192, key).setOrigin(0.5, 0.5)
        sprite.play(`${entry.set}-${act.anim}`)
        this.content.add(sprite)
      } else if (act.still) this.content.add(this.add.image(420, 192, key).setOrigin(0.5, 0.5))
      else text(420, 192, '動畫未載入', '16px', '#ffb9a4')
    } else text(420, 192, `${act.pending ?? '素材未載入'}`, '17px', '#ffb9a4')
    text(220, 246, `${this.action === 0 ? '正常' : `特別 ${this.action}`}：${actionNames[act.label] ?? act.label}${act.pending ? `（${act.pending}）` : act.still ? '（靜態圖）' : ''}`, '12px')
    this.button(40, 190, 62, 42, '◀ 上一個', () => this.move(-1), this.content)
    this.button(600, 190, 62, 42, '下一個 ▶', () => this.move(1), this.content)
    ;['正常  [1]', '特別1  [2]', '特別2  [3]'].forEach((label, i) => this.button(168 + i * 152, 305, 140, 36, label, () => this.chooseAction(i), this.content, this.action === i))
    text(GAME_W / 2, GAME_H - 10, '←→ 角色　↑↓ 分組　Esc 返回', '10px', '#d2b995')
  }
}
