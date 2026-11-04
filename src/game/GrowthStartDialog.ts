import Phaser from 'phaser'
import { GROWTH_AXES, type GrowthAllocation, type GrowthBranch, type GrowthHero } from './growth'
import { getRun, type NewGrowthSetup } from './run'
import { FONT_UI } from './ui/fonts'

const heroes: GrowthHero[] = ['boy', 'girl']
const names = ['生命', '攻擊', '防禦', '耐力', '絕招']
const empty = (): GrowthAllocation => ({ hp: 0, atk: 0, def: 0, stam: 0, sp: 0 })

/** A draft only: no storage changes until the caller confirms the whole setup. */
export class GrowthStartDialog {
  private scene: Phaser.Scene
  private done: (setup: NewGrowthSetup) => boolean
  private cancel: () => void
  private root: Phaser.GameObjects.Container
  private page: 'source' | 'points' = 'source'
  private sources: Array<GrowthBranch | null>
  private source = 0
  private selected = 0
  private totals = { boy: 5, girl: 5 }
  private allocations: Record<GrowthHero, GrowthAllocation> = { boy: empty(), girl: empty() }
  private readyAt: number
  constructor(scene: Phaser.Scene, done: (setup: NewGrowthSetup) => boolean, cancel: () => void) {
    this.scene = scene; this.done = done; this.cancel = cancel
    this.sources = [null, ...(getRun()?.growth.branches ?? [])]
    this.root = scene.add.container(0, 0).setDepth(20000).setScrollFactor(0)
    this.readyAt = scene.time.now + 250
    this.draw()
  }
  destroy() { this.root.destroy(true) }
  private text(x: number, y: number, value: string, size = 13, color = '#ffe9a8') {
    const label = this.scene.add.text(x, y, value, { fontFamily: FONT_UI, fontSize: `${size}px`, color }).setOrigin(0.5)
    this.root.add(label)
    return label
  }
  private button(x: number, y: number, w: number, h: number, label: string, action: () => void, selected = false) {
    const bg = this.scene.add.rectangle(x, y, w, h, selected ? 0x8a5420 : 0x4a2a14).setStrokeStyle(1, selected ? 0xffffff : 0xc8902a).setInteractive({ useHandCursor: true })
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.()
      if (this.scene.time.now >= this.readyAt) action()
    })
    this.root.add(bg)
    this.text(x, y, label, 13, '#fff2d0')
  }
  private draw() {
    this.root.removeAll(true)
    const cover = this.scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.84).setInteractive()
    cover.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e?.stopPropagation?.())
    this.root.add([cover, this.scene.add.rectangle(320, 180, 510, 330, 0x241810).setStrokeStyle(2, 0xc8902a)])
    if (this.page === 'source') {
      const b = this.sources[this.source]
      this.text(320, 39, '選成長來源（不會刪除舊局）', 16)
      this.text(320, 74, b ? `舊局 ${this.source}/${this.sources.length - 1}　起始第${b.startStage}關　下一關 ${b.nextStage}` : '唔帶舊成長：兩人各 5 點', 13)
      if (b) {
        this.text(320, 100, `倫寶 ${b.heroes.boy.earned} 點　｜　琪寶寶 ${b.heroes.girl.earned} 點`, 13)
        this.text(320, 125, `局識別 ${b.id.slice(0, 18)}　（只承接此局，最少各 5 點）`, 10)
      } else this.text(320, 107, '起始點不影響排名', 11)
      this.text(320, 154, '← → 切換來源；Enter 繼續', 11, '#d8c49c')
      this.button(205, 194, 125, 36, '◀ 上一個', () => this.shift(-1))
      this.button(435, 194, 125, 36, '下一個 ▶', () => this.shift(1))
      this.button(320, 242, 185, 34, '揀呢個來源', () => this.choose(), true)
      this.button(320, 287, 185, 32, '取消', () => this.cancel())
      return
    }
    const source = this.sources[this.source]
    this.text(320, 30, source ? `來源：舊局 ${this.source}（不額外加 5）` : '來源：唔帶舊成長', 13)
    this.text(320, 50, '←→ 減／加　↑↓ 揀項　Enter 加點／確認', 10, '#d8c49c')
    for (const [h, x] of [['boy', 202], ['girl', 438]] as const) {
      const used = GROWTH_AXES.reduce((s, axis) => s + this.allocations[h][axis], 0)
      this.text(x, 74, `${h === 'boy' ? '倫寶' : '琪寶寶'}：${this.totals[h]} 點　剩 ${this.totals[h] - used}`, 12)
    }
    heroes.forEach((hero, hi) => GROWTH_AXES.forEach((axis, ai) => {
      const x = hi === 0 ? 202 : 438, y = 101 + ai * 31, index = hi * 5 + ai
      this.button(x - 76, y, 33, 26, '−', () => { this.selected = index; this.adjust(-1) }, this.selected === index)
      this.text(x, y, `${names[ai]}  ${this.allocations[hero][axis]}`, 13)
      this.button(x + 76, y, 33, 26, '＋', () => { this.selected = index; this.adjust(1) }, this.selected === index)
    }))
    this.text(320, 260, '可留點；戰鬥效果及商店重配尚未接入', 10, '#ffba99')
    this.button(174, 300, 130, 32, '返回揀來源', () => this.back(), this.selected === 10)
    this.button(320, 300, 130, 32, '確認開新局', () => this.confirm(), this.selected === 11)
    this.button(466, 300, 130, 32, '取消', () => this.cancel(), this.selected === 12)
  }
  private shift(d: number) { this.source = (this.source + d + this.sources.length) % this.sources.length; this.draw() }
  private choose() {
    const b = this.sources[this.source]
    for (const hero of heroes) {
      this.totals[hero] = b ? Math.max(5, b.heroes[hero].earned) : 5
      this.allocations[hero] = b ? { ...b.heroes[hero].allocation } : empty()
    }
    this.page = 'points'; this.selected = 0; this.draw()
  }
  private back() { this.page = 'source'; this.draw() }
  private adjust(d: number) {
    const hero = heroes[Math.floor(this.selected / 5)]
    const axis = GROWTH_AXES[this.selected % 5]
    if (!hero || !axis) return
    const a = this.allocations[hero]
    const used = GROWTH_AXES.reduce((s, k) => s + a[k], 0)
    if (d < 0 && a[axis] > 0) a[axis]--
    if (d > 0 && used < this.totals[hero]) a[axis]++
    this.draw()
  }
  private confirm() {
    const setup: NewGrowthSetup = { sourceId: this.sources[this.source]?.id ?? null, allocations: { boy: { ...this.allocations.boy }, girl: { ...this.allocations.girl } } }
    if (this.done(setup)) this.destroy()
  }
  move(d: number) { if (this.page === 'points') { this.selected = (this.selected + d + 13) % 13; this.draw() } else this.shift(d) }
  horizontal(d: number) { if (this.page === 'source') this.shift(d); else if (this.selected < 10) this.adjust(d) }
  activate() {
    if (this.scene.time.now < this.readyAt) return
    if (this.page === 'source') return this.choose()
    if (this.selected < 10) return this.adjust(1)
    if (this.selected === 10) return this.back()
    if (this.selected === 11) return this.confirm()
    this.cancel()
  }
  escape() { this.cancel() }
}
