import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { buzz, HAPTIC } from './phone'
import type { Who } from './gear'

/**
 * Small modal pop-ups for the stage-clear card (瞓覺 / 賭檔). Overlays, not Scenes:
 * they sit on top of the clear card, own the keys while open, and resolve a promise.
 */

const WHO_NAME: Record<Who, string> = { boy: '倫寶', girl: '琪寶寶' }

type Modal = {
  root: Phaser.GameObjects.Container
  close: () => void
  onKey: (fn: (code: string) => void) => void
  onTouch: (fn: (btn: 'left' | 'right' | 'up' | 'down' | 'attack' | 'jump' | 'start' | 'menu') => void) => void
}

function openModal(scene: Phaser.Scene, title: string, onClosed: () => void): Modal {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 290)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, 0.78).setOrigin(0).setInteractive())
  const g = scene.add.graphics()
  const w = 360
  const h = 170
  const x = (GAME_W - w) / 2
  const y = (GAME_H - h) / 2
  g.fillStyle(0xc8902a, 1).fillRect(x, y, w, h)
  g.fillStyle(0x1c120c, 0.98).fillRect(x + 3, y + 3, w - 6, h - 6)
  root.add(g)
  root.add(
    scene.add
      .text(GAME_W / 2, y + 22, title, { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 4 })
      .setOrigin(0.5),
  )

  let keyFn: (code: string) => void = () => undefined
  let touchFn: (btn: never) => void = () => undefined
  let gone = false
  const kd = (e: KeyboardEvent) => {
    if (!gone) keyFn(e.code)
  }
  const tick = () => {
    if (gone) return
    for (const b of ['left', 'right', 'up', 'down', 'attack', 'jump', 'start', 'menu'] as const) {
      if (TouchInput.justPressed(b)) touchFn(b as never)
    }
  }
  scene.input.keyboard?.on('keydown', kd)
  scene.events.on('update', tick)
  const close = () => {
    if (gone) return
    gone = true
    scene.input.keyboard?.off('keydown', kd)
    scene.events.off('update', tick)
    root.destroy(true)
    onClosed()
  }
  return {
    root,
    close,
    onKey: (fn) => (keyFn = fn),
    onTouch: (fn) => (touchFn = fn as (btn: never) => void),
  }
}

const YES_KEYS = ['Enter', 'Space', 'KeyF', 'KeyJ', 'KeyK']

function makeBtn(scene: Phaser.Scene, root: Phaser.GameObjects.Container, cx: number, cy: number, label: string, onClick: () => void) {
  const bg = scene.add.rectangle(cx, cy, 120, 26, 0x4a2a14, 1).setStrokeStyle(2, 0xc8902a).setInteractive({ useHandCursor: true })
  const tx = scene.add.text(cx, cy, label, { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe9a8' }).setOrigin(0.5)
  bg.on('pointerup', onClick)
  root.add([bg, tx])
  return {
    set: (text: string) => tx.setText(text),
    hilite: (on: boolean, enabled = true) => {
      bg.setFillStyle(on ? 0x6a3a18 : 0x4a2a14).setStrokeStyle(2, !enabled ? 0x6a5a40 : on ? 0xffd76a : 0xc8902a)
      tx.setColor(!enabled ? '#8a7a60' : on ? '#fff6e0' : '#ffe9a8')
    },
  }
}

export type ConfirmOpts = {
  title: string
  lines: string[]
  yes: string
  no: string
  /** False greys the yes button and shows `why` instead of acting. */
  canYes: boolean
  why?: string
}

/** Yes / no pop-up. Resolves true only when the player confirms. */
export function openConfirm(scene: Phaser.Scene, o: ConfirmOpts): Promise<boolean> {
  let resolve!: (v: boolean) => void
  const done = new Promise<boolean>((r) => (resolve = r))
  let result = false
  const m = openModal(scene, o.title, () => resolve(result))
  const body = scene.add
    .text(GAME_W / 2, GAME_H / 2 - 14, o.lines.join('\n'), { fontFamily: FONT_UI, fontSize: '13px', color: '#fff0cc', align: 'center', lineSpacing: 6 })
    .setOrigin(0.5)
  const note = scene.add
    .text(GAME_W / 2, GAME_H / 2 + 22, o.canYes ? '' : (o.why ?? ''), { fontFamily: FONT_UI, fontSize: '11px', color: '#ff9a8a' })
    .setOrigin(0.5)
  m.root.add([body, note])
  let sel: 0 | 1 = o.canYes ? 0 : 1
  const yes = makeBtn(scene, m.root, GAME_W / 2 - 66, GAME_H / 2 + 54, o.yes, () => accept())
  const no = makeBtn(scene, m.root, GAME_W / 2 + 66, GAME_H / 2 + 54, o.no, () => m.close())
  const draw = () => {
    yes.hilite(sel === 0, o.canYes)
    no.hilite(sel === 1)
  }
  const accept = () => {
    if (!o.canYes) {
      SFX.blip(220)
      return
    }
    result = true
    m.close()
  }
  const move = () => {
    sel = sel === 0 ? 1 : 0
    SFX.blip(520)
    draw()
  }
  const act = () => (sel === 0 ? accept() : m.close())
  m.onKey((c) => {
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(c)) move()
    else if (YES_KEYS.includes(c)) act()
    else if (c === 'Escape') m.close()
  })
  m.onTouch((b) => {
    if (b === 'left' || b === 'right') move()
    else if (b === 'attack' || b === 'jump') act()
    else if (b === 'start' || b === 'menu') m.close()
  })
  draw()
  return done
}

export type GambleHooks = {
  heroes: Who[]
  purse: (w: Who) => number
  pay: (w: Who, delta: number) => void
  bet: number
  /** 0..1 roll; injectable so tests can force a win or a loss. */
  roll?: () => number
}

/** 賭檔: one coin flip at a flat stake. Heads you double it, tails you lose it. */
export function openGamble(scene: Phaser.Scene, h: GambleHooks): Promise<void> {
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))
  const m = openModal(scene, '賭檔', () => resolve())
  let who: Who = h.heroes[0]!
  let busy = false
  const roll = h.roll ?? Math.random
  const cx = GAME_W / 2
  const cy = GAME_H / 2

  m.root.add(
    scene.add
      .text(cx - 60, cy - 28, `落注 ${h.bet} 幣\n一半機會變 ${h.bet * 2} 幣\n一半機會輸晒`, { fontFamily: FONT_UI, fontSize: '12px', color: '#fff0cc', lineSpacing: 6 })
      .setOrigin(0.5),
  )
  const who$ = scene.add.text(cx - 164, cy - 70, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffd0e0' })
  const purse$ = scene.add.text(cx + 164, cy - 70, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a' }).setOrigin(1, 0)
  const msg = scene.add.text(cx, cy + 22, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5)
  const coin = scene.add.container(cx + 96, cy - 22)
  coin.add([
    scene.add.circle(0, 0, 22, 0xffd040).setStrokeStyle(3, 0xa86a10),
    scene.add.text(0, 0, '幣', { fontFamily: FONT_TITLE, fontSize: '20px', color: '#7a4a08' }).setOrigin(0.5),
  ])
  m.root.add([who$, purse$, msg, coin])

  let sel: 0 | 1 = 0
  const bet = makeBtn(scene, m.root, cx - 66, cy + 54, `落注 ${h.bet} 幣`, () => flip())
  const leave = makeBtn(scene, m.root, cx + 66, cy + 54, '走', () => !busy && m.close())
  const canBet = () => h.purse(who) >= h.bet
  const draw = () => {
    who$.setText(h.heroes.length > 1 ? `◀ ${WHO_NAME[who]} ▶` : WHO_NAME[who])
    purse$.setText(`幣 ×${h.purse(who)}`)
    bet.hilite(sel === 0 && !busy, canBet() && !busy)
    leave.hilite(sel === 1 && !busy)
  }
  const flip = () => {
    if (busy) return
    if (!canBet()) {
      SFX.blip(220)
      msg.setText(`唔夠幣，要 ${h.bet} 個。`).setColor('#ff9a8a')
      return
    }
    busy = true
    h.pay(who, -h.bet)
    msg.setText('擲緊…').setColor('#ffe9a8')
    draw()
    const win = roll() < 0.5
    SFX.blip(660)
    scene.tweens.add({
      targets: coin,
      scaleX: { from: 1, to: -1 },
      duration: 120,
      repeat: 5,
      yoyo: true,
      onComplete: () => {
        coin.setScale(1)
        if (win) {
          h.pay(who, h.bet * 2)
          SFX.powerUp()
          buzz(HAPTIC.power)
          msg.setText(`中咗！${h.bet} 變 ${h.bet * 2} 幣`).setColor('#9aff9a')
        } else {
          SFX.potShatter()
          buzz(40)
          msg.setText(`輸晒 ${h.bet} 幣…`).setColor('#ff9a8a')
        }
        busy = false
        draw()
      },
    })
  }
  const swap = () => {
    if (busy || h.heroes.length < 2) return
    who = who === h.heroes[0] ? h.heroes[1]! : h.heroes[0]!
    SFX.blip(640)
    draw()
  }
  const act = () => (sel === 0 ? flip() : !busy && m.close())
  m.onKey((c) => {
    if (busy) return
    if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(c)) {
      sel = sel === 0 ? 1 : 0
      SFX.blip(520)
      draw()
    } else if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(c)) {
      if (h.heroes.length > 1) swap()
      else {
        sel = sel === 0 ? 1 : 0
        SFX.blip(520)
        draw()
      }
    } else if (YES_KEYS.includes(c)) act()
    else if (c === 'Escape') m.close()
  })
  m.onTouch((b) => {
    if (busy) return
    if (b === 'up' || b === 'down') {
      sel = sel === 0 ? 1 : 0
      draw()
    } else if (b === 'left' || b === 'right') swap()
    else if (b === 'attack' || b === 'jump') act()
    else if (b === 'start' || b === 'menu') m.close()
  })
  draw()
  return done
}
