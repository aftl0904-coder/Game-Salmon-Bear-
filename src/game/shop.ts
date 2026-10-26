import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { buzz, HAPTIC } from './phone'
import { GEAR, STAT_NAMES, buy, nextPrice, stats, tierOf, type GearDef, type StatId, type Who } from './gear'
import { FRIENDS, ensureFriendArt, friendTex, isFriendId } from './friends'

/**
 * 小朋友檔口 (docs/bible/story.md §5): the friends you freed set up a stall beside the
 * food stall and trade the odds and ends they salvaged. More friends freed = better stock.
 *
 * Overlay, not a Scene: GameScene pauses physics and awaits `done`, same as the minigames.
 */

export type ShopHooks = {
  /** Coins this hero can spend. */
  purse: (who: Who) => number
  /** Spend (negative) or refund (positive). */
  pay: (who: Who, delta: number) => void
  /** Ids of the friends freed so far — they stand behind the counter. */
  friends: () => string[]
  /** Who is playing: one hero, or both in 2P. */
  heroes: Who[]
}

export type Shop = { done: Promise<void>; destroy: () => void }

/** Tier 3 only shows up once enough friends are around to have salvaged it. */
function stockLimit(friendCount: number) {
  return friendCount >= 4 ? 3 : friendCount >= 2 ? 2 : 1
}

export function openShop(scene: Phaser.Scene, hooks: ShopHooks): Shop {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 280)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, 0.82).setOrigin(0).setInteractive())

  const freed = hooks.friends().filter(isFriendId)
  const limit = stockLimit(freed.length)
  const heroes = hooks.heroes
  let who: Who = heroes[0]!
  let sel = 0
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))

  // ── Chrome ──────────────────────────────────────────────────────────────
  const title = scene.add
    .text(GAME_W / 2, 72, '小朋友檔口', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
    .setOrigin(0.5)
  const sub = scene.add
    .text(GAME_W / 2, 92, freed.length ? `${freed.length} 個小朋友幫手睇檔` : '未救到小朋友 — 得基本貨', {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: '#e8d8b0',
    })
    .setOrigin(0.5)
  root.add([title, sub])

  // The rescued friends stand along the top of the counter.
  ensureFriendArt(scene)
  freed.slice(0, 8).forEach((id, i) => {
    const img = scene.add.image(GAME_W / 2 - Math.min(freed.length, 8) * 17 + i * 34 + 17, 124, friendTex(id)).setOrigin(0.5, 1).setScale(0.7)
    root.add(img)
    scene.tweens.add({ targets: img, y: 120, duration: 420, yoyo: true, repeat: -1, delay: i * 130, ease: 'Sine.inOut' })
  })

  const panel = scene.add.graphics()
  const PW = GAME_W - 56 - 150
  panel.fillStyle(0xc8902a, 1).fillRect(28, 128, PW, 178)
  panel.fillStyle(0x1c120c, 0.97).fillRect(31, 131, PW - 6, 172)
  panel.fillStyle(0xc8902a, 1).fillRect(GAME_W - 172, 128, 144, 178)
  panel.fillStyle(0x1c120c, 0.97).fillRect(GAME_W - 169, 131, 138, 172)
  root.add(panel)

  const purseText = scene.add.text(28 + PW - 16, 136, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' }).setOrigin(1, 0)
  const whoText = scene.add.text(44, 136, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffd0e0' }).setOrigin(0, 0)
  const blurb = scene.add
    .text(GAME_W / 2, GAME_H - 38, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#d8c8a8', align: 'center', wordWrap: { width: GAME_W - 80 } })
    .setOrigin(0.5)
  const hint = scene.add
    .text(GAME_W / 2, GAME_H - 16, '↑↓ 揀　攻擊＝買　' + (heroes.length > 1 ? '←→ 換人　' : '') + 'Start＝走', {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: '#f0dcb0',
    })
    .setOrigin(0.5)
  root.add([purseText, whoText, blurb, hint])

  /** One row per gear item this hero can actually use. */
  const rowsFor = (w: Who): GearDef[] => GEAR.filter((g) => g.who === 'both' || g.who === w)
  type Row = { name: Phaser.GameObjects.Text; tier: Phaser.GameObjects.Text; price: Phaser.GameObjects.Text; cursor: Phaser.GameObjects.Text }
  const rows: Row[] = []
  for (let i = 0; i < GEAR.length; i++) {
    const y = 160 + i * 30
    const cursor = scene.add.text(44, y, '▶', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffd040' }).setOrigin(0, 0.5)
    const name = scene.add.text(66, y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#fff6e0' }).setOrigin(0, 0.5)
    const tier = scene.add.text(140, y, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8b890' }).setOrigin(0, 0.5)
    const price = scene.add.text(28 + PW - 16, y, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' }).setOrigin(1, 0.5)
    rows.push({ name, tier, price, cursor })
    root.add([cursor, name, tier, price])
  }

  // ── 五角形：生命・攻擊・防禦・速度・絕招 ──
  const CX = GAME_W - 100
  const CY = 218
  const R0 = 44
  const AXES: StatId[] = ['hp', 'atk', 'def', 'spd', 'sp']
  const pent = scene.add.graphics().setDepth(1)
  const axisLabels = AXES.map((id, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
    const lx = Phaser.Math.Clamp(CX + Math.cos(a) * (R0 + 16), GAME_W - 162, GAME_W - 38)
    return scene.add
      .text(lx, CY + Math.sin(a) * (R0 + 14), STAT_NAMES[id], { fontFamily: FONT_UI, fontSize: '9px', color: '#c8b890' })
      .setOrigin(0.5)
  })
  root.add([pent, ...axisLabels])

  const drawPentagon = (w: Who) => {
    const v = stats(w)
    pent.clear()
    const pt = (i: number, r: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
      return new Phaser.Math.Vector2(CX + Math.cos(a) * r, CY + Math.sin(a) * r)
    }
    // Rings
    for (const f of [0.25, 0.5, 0.75, 1]) {
      pent.lineStyle(1, 0x5a4a38, f === 1 ? 0.9 : 0.4)
      const ring = AXES.map((_, i) => pt(i, R0 * f))
      pent.strokePoints(ring, true)
    }
    for (let i = 0; i < 5; i++) {
      pent.lineStyle(1, 0x5a4a38, 0.4)
      const p = pt(i, R0)
      pent.lineBetween(CX, CY, p.x, p.y)
    }
    const shape = AXES.map((id, i) => pt(i, R0 * v[id]))
    pent.fillStyle(0xffc040, 0.3)
    pent.fillPoints(shape, true)
    pent.lineStyle(2, 0xffd76a, 1)
    pent.strokePoints(shape, true)
    for (const p of shape) pent.fillStyle(0xfff0c0, 1).fillCircle(p.x, p.y, 2)
  }

  const draw = () => {
    const list = rowsFor(who)
    sel = Phaser.Math.Clamp(sel, 0, list.length - 1)
    whoText.setText(who === 'girl' ? '琪寶寶' : '倫寶')
    purseText.setText(`幣 ×${hooks.purse(who)}`)
    rows.forEach((r, i) => {
      const g = list[i]
      const on = i === sel
      r.cursor.setVisible(!!g && on)
      if (!g) {
        r.name.setText('')
        r.tier.setText('')
        r.price.setText('')
        return
      }
      const t = tierOf(who, g.id)
      const p = nextPrice(who, g.id)
      const capped = t >= limit && p !== null
      r.name.setText(g.name).setColor(on ? '#ffd040' : '#fff6e0')
      r.tier.setText(t > 0 ? `Lv${t}　${g.tiers[t - 1]}` : '未買')
      r.price.setText(p === null ? 'MAX' : capped ? '未入貨' : `${p} 幣`)
      r.price.setColor(p === null ? '#8ad0ff' : capped ? '#80706a' : hooks.purse(who) >= p ? '#ffe08a' : '#a08070')
    })
    const g = list[sel]
    blurb.setText(g ? g.blurb : '')
    drawPentagon(who)
  }

  const move = (d: number) => {
    const list = rowsFor(who)
    sel = (sel + d + list.length) % list.length
    SFX.blip(520)
    draw()
  }
  const swapWho = () => {
    if (heroes.length < 2) return
    who = who === heroes[0] ? heroes[1]! : heroes[0]!
    sel = 0
    SFX.blip(640)
    draw()
  }
  const tryBuy = () => {
    const g = rowsFor(who)[sel]
    if (!g) return
    const t = tierOf(who, g.id)
    const p = nextPrice(who, g.id)
    if (p === null) {
      SFX.blip(220)
      blurb.setText('已經最頂級。')
      return
    }
    if (t >= limit) {
      SFX.blip(220)
      blurb.setText('呢級仲未入到貨 — 救多啲小朋友先有。')
      return
    }
    if (hooks.purse(who) < p) {
      SFX.blip(220)
      blurb.setText(`唔夠幣，仲爭 ${p - hooks.purse(who)} 個。`)
      return
    }
    hooks.pay(who, -p)
    buy(who, g.id)
    SFX.powerUp()
    buzz(HAPTIC.power)
    const t2 = tierOf(who, g.id)
    blurb.setText(`買咗！${g.name} Lv${t2}：${g.tiers[t2 - 1]}`)
    draw()
  }

  let gone = false
  const leave = () => {
    if (gone) return
    gone = true
    scene.events.off('update', tick)
    scene.input.keyboard?.off('keydown', onKey)
    root.destroy(true)
    resolve()
  }

  const onKey = (e: KeyboardEvent) => {
    if (gone) return
    const k = e.code
    if (['ArrowUp', 'KeyW'].includes(k)) move(-1)
    else if (['ArrowDown', 'KeyS'].includes(k)) move(1)
    else if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(k)) swapWho()
    else if (['Space', 'KeyF', 'KeyJ', 'KeyK'].includes(k)) tryBuy()
    else if (['Enter', 'Escape'].includes(k)) leave()
  }
  scene.input.keyboard?.on('keydown', onKey)

  const tick = () => {
    if (gone) return
    if (TouchInput.justPressed('up')) move(-1)
    if (TouchInput.justPressed('down')) move(1)
    if (TouchInput.justPressed('left') || TouchInput.justPressed('right')) swapWho()
    if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) tryBuy()
    if (TouchInput.justPressed('start') || TouchInput.justPressed('menu')) leave()
  }
  scene.events.on('update', tick)

  // Tappable rows for phones.
  rows.forEach((_r, i) => {
    const hit = scene.add.rectangle(28 + PW / 2, 160 + i * 30, PW - 10, 26, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    root.add(hit)
    hit.on('pointerdown', () => {
      if (sel === i) tryBuy()
      else {
        sel = i
        SFX.blip(520)
        draw()
      }
    })
  })
  const leaveBtn = scene.add
    .text(GAME_W / 2, GAME_H - 16, '　　　　　　', { fontFamily: FONT_UI, fontSize: '11px' })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
  leaveBtn.on('pointerdown', () => leave())
  root.add(leaveBtn)

  draw()
  return { done, destroy: leave }
}

/** Short line for the stall keeper when the shop opens. */
export function shopGreeting(friendCount: number) {
  if (friendCount <= 0) return '得返啲舊嘢，你睇下啱唔啱使。'
  if (friendCount < 4) return '我哋執返咗啲嘢，同你換。'
  return '救得我哋咁多次，好嘢都留返俾你。'
}

export { FRIENDS }
