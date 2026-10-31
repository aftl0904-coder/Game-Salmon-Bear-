import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { TouchInput, isPhonePlay, type TouchBtn } from './touchInput'
import { GAME_H, GAME_W } from './engine/constants'
import { FONT_UI } from './ui/fonts'

const ALPHA = 0.55

type PadSpec = { btn: TouchBtn; x: number; y: number; label: string; w?: number; h?: number }

/**
 * Landscape phone HUD — stage 1 single-lane:
 * Left: ← → + 蹲；Right: 跳 / 攻 / 絕.
 * Pads sit in bottom corners so they don't cover mid-screen hero.
 */
export function mountTouchControls(scene: Phaser.Scene): Phaser.GameObjects.Container | null {
  if (!isPhonePlay()) return null

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 80)
  root.setAlpha(ALPHA)

  const mkBtn = (spec: PadSpec) => {
    const bw = spec.w ?? 44
    const bh = spec.h ?? 44
    const bg = scene.add
      .rectangle(spec.x, spec.y, bw, bh, 0x1a1420, 0.85)
      .setStrokeStyle(2, 0xffe08a, 0.9)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false })
    const tx = scene.add
      .text(spec.x, spec.y, spec.label, {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#fff4d0',
        stroke: '#2a1810',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
    root.add([bg, tx])

    const setDown = (down: boolean) => {
      TouchInput.set(spec.btn, down)
      bg.setFillStyle(down ? 0xe07a4f : 0x1a1420, 0.85)
    }
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.preventDefault?.()
      setDown(true)
    })
    bg.on('pointerup', () => setDown(false))
    bg.on('pointerout', () => setDown(false))
    bg.on('pointerupoutside', () => setDown(false))
  }

  // Bottom-left cluster — clear of centre playfield
  const lx = 52
  const ly = GAME_H - 36
  mkBtn({ btn: 'left', x: lx - 40, y: ly, label: '←', w: 44, h: 40 })
  mkBtn({ btn: 'right', x: lx + 40, y: ly, label: '→', w: 44, h: 40 })
  mkBtn({ btn: 'crouch', x: lx, y: ly - 44, label: '蹲', w: 48, h: 40 })

  // Bottom-right actions
  const rx = GAME_W - 56
  const ry = GAME_H - 40
  mkBtn({ btn: 'jump', x: rx, y: ry, label: '跳', w: 48, h: 48 })
  mkBtn({ btn: 'attack', x: rx - 52, y: ry - 8, label: '攻', w: 44, h: 44 })
  mkBtn({ btn: 'special', x: rx, y: ry - 56, label: '絕', w: 44, h: 40 })
  // R1 weapon-switch (倫寶 連射/重擊, 琪寶寶 快劍/重劍) — 4th corner of the face-button
  // fan, between 攻 and 絕 so the cluster keeps the same "4 action keys" shape as the
  // keyboard/gamepad bindings (H / pad index 6). Was previously untestable on phone —
  // there was no on-screen control for it at all.
  mkBtn({ btn: 'weaponSwitch', x: rx - 52, y: ry - 56, label: '換', w: 40, h: 36 })
  // Start: pause in play, insert coin on the continue screen, skip in menus.
  mkBtn({ btn: 'start', x: GAME_W - 30, y: 52, label: 'Ⅱ', w: 40, h: 28 })

  scene.events.once('shutdown', () => {
    TouchInput.clearAll()
    root.destroy(true)
  })

  return root
}
