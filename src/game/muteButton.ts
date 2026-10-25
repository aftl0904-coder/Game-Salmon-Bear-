import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { isMuted, toggleMute, unlockAudio } from './audio'

/**
 * Top-left mute toggle — usable on menu + play HUD.
 * Shows 🔊 / 🔇 ; tap or click to toggle (persisted).
 */
export function mountMuteButton(
  scene: Phaser.Scene,
  x = 28,
  y = 18,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setScrollFactor(0).setDepth(DEPTH.UI + 90)

  const bg = scene.add
    .rectangle(0, 0, 44, 36, 0x1a1420, 0.82)
    .setStrokeStyle(2, 0xe0b86a, 0.95)
    .setInteractive({ useHandCursor: true })

  const label = scene.add
    .text(0, 0, isMuted() ? '🔇' : '🔊', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '20px',
    })
    .setOrigin(0.5)

  const hint = scene.add
    .text(0, 22, isMuted() ? '靜音' : '聲音', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '11px',
      color: '#ffe08a',
      stroke: '#1a1008',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0)

  root.add([bg, label, hint])

  const refresh = () => {
    const m = isMuted()
    label.setText(m ? '🔇' : '🔊')
    hint.setText(m ? '靜音' : '聲音')
    bg.setFillStyle(m ? 0x3a2820 : 0x1a1420, 0.82)
  }
  refresh()

  const onToggle = (p?: Phaser.Input.Pointer) => {
    p?.event?.preventDefault?.()
    unlockAudio()
    toggleMute()
    refresh()
  }
  bg.on('pointerdown', onToggle)

  scene.events.once('shutdown', () => root.destroy(true))
  return root
}
