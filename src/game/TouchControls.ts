import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { TouchInput, isPhonePlay, type TouchBtn } from './touchInput'
import { L } from './engine/constants'
import { FONT_UI } from './ui/fonts'

const ALPHA = 0.6

type PadSpec = { btn: TouchBtn; x: number; y: number; label: string; w?: number; h?: number }

/**
 * Landscape phone HUD: D-pad bottom-left, ABXY-style 4 buttons bottom-right.
 * Alpha 60%. Only built when isPhonePlay().
 */
export function mountTouchControls(scene: Phaser.Scene): Phaser.GameObjects.Container | null {
  if (!isPhonePlay()) return null

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 80)
  root.setAlpha(ALPHA)

  const mkBtn = (spec: PadSpec) => {
    const bw = spec.w ?? L(56)
    const bh = spec.h ?? L(56)
    const bg = scene.add
      .rectangle(spec.x, spec.y, bw, bh, 0x1a1420, 0.85)
      .setStrokeStyle(2, 0xffe08a, 0.9)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false })
    const tx = scene.add
      .text(spec.x, spec.y, spec.label, {
        fontFamily: FONT_UI,
        fontSize: '11px',
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

  // Left: direction cross
  const lx = L(88)
  const ly = L(455)
  mkBtn({ btn: 'up', x: lx, y: ly - L(52), label: '↑', w: L(52), h: L(48) })
  mkBtn({ btn: 'down', x: lx, y: ly + L(52), label: '↓', w: L(52), h: L(48) })
  mkBtn({ btn: 'left', x: lx - L(52), y: ly, label: '←', w: L(52), h: L(48) })
  mkBtn({ btn: 'right', x: lx + L(52), y: ly, label: '→', w: L(52), h: L(48) })

  // Right: 4 action buttons (SNES diamond)
  const rx = L(872)
  const ry = L(450)
  mkBtn({ btn: 'special', x: rx, y: ry - L(58), label: '絕', w: L(54), h: L(54) })
  mkBtn({ btn: 'attack', x: rx + L(58), y: ry, label: '攻', w: L(54), h: L(54) })
  mkBtn({ btn: 'jump', x: rx, y: ry + L(58), label: '跳', w: L(54), h: L(54) })
  mkBtn({ btn: 'start', x: rx - L(58), y: ry, label: '始', w: L(54), h: L(54) })

  scene.events.once('shutdown', () => {
    TouchInput.clearAll()
    root.destroy(true)
  })

  return root
}
