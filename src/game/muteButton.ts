import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { isMuted, toggleMute, unlockAudio } from './audio'
import { FONT_UI } from './ui/fonts'

/**
 * HUD mute toggle — icon only (🔊 / 🔇), no text label under the button.
 */
export function mountMuteButton(
  scene: Phaser.Scene,
  x = 14,
  y = 9,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setScrollFactor(0).setDepth(DEPTH.UI + 90)

  const bg = scene.add
    .rectangle(0, 0, 22, 16, 0x1a1420, 0.85)
    .setStrokeStyle(1, 0xe0b86a, 0.95)
    .setInteractive({ useHandCursor: true })

  const label = scene.add
    .text(0, 0, isMuted() ? '🔇' : '🔊', {
      fontFamily: FONT_UI,
      fontSize: '12px',
    })
    .setOrigin(0.5)

  root.add([bg, label])

  const refresh = () => {
    const m = isMuted()
    label.setText(m ? '🔇' : '🔊')
    bg.setFillStyle(m ? 0x3a2820 : 0x1a1420, 0.85)
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
