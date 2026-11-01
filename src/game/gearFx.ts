/**
 * 裝備視覺化（平做法）：唔畫新圖，用角色現有 sprite 加疊層。
 *  - 盔甲：同一格 sprite 疊一層加色混合嘅反光，銅／銀／金越高越光，定時掃一下。
 *  - 劍（琪寶寶）／槍（倫寶）：武器手邊加光線，每級多一條，顏色跟級數。
 */

import Phaser from 'phaser'
import { gearOf, type Who } from './gear'

const TIER_COL = [0xffffff, 0xc88a52, 0xdfe4ea, 0xffd040] as const
const ARMOUR_COL = [0xffffff, 0xd2783a, 0x8fb4e0, 0xffc428] as const
const ARMOUR_TINT_ALPHA = [0, 0.4, 0.46, 0.5] as const
const STREAK_MAX = 3

type Hero = Phaser.GameObjects.Sprite & { role?: string; facing?: number }

export type GearFx = { destroy: () => void; refresh: () => void }

export function attachGearFx(scene: Phaser.Scene, hero: Hero): GearFx {
  const who = (hero.role === 'girl' ? 'girl' : 'boy') as Who
  // Two copies of the hero's current frame: a tinted one for the metal colour, an additive one for the glint.
  const tintLayer = scene.add.image(hero.x, hero.y, hero.texture.key, hero.frame.name).setVisible(false)
  const sheen = scene.add.image(hero.x, hero.y, hero.texture.key, hero.frame.name).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
  const streaks: Phaser.GameObjects.Rectangle[] = []
  for (let i = 0; i < STREAK_MAX; i++) {
    streaks.push(scene.add.rectangle(0, 0, 2, 11, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setVisible(false))
  }
  let armour = 0
  let weapon = 0
  let nextRead = 0
  let gone = false

  const refresh = () => {
    const t = gearOf(who)
    armour = t.armour ?? 0
    weapon = (who === 'girl' ? t.sword : t.gun) ?? 0
  }
  refresh()

  const update = () => {
    if (gone) return
    if (!hero.active) {
      destroy()
      return
    }
    const now = scene.time.now
    if (now >= nextRead) {
      nextRead = now + 600
      refresh()
    }
    const shown = hero.visible && hero.alpha > 0.05
    const face = hero.facing ?? (hero.flipX ? -1 : 1)

    if (armour > 0 && shown) {
      for (const [img, dz] of [[tintLayer, 0.05], [sheen, 0.1]] as const) {
        img
          .setTexture(hero.texture.key, hero.frame.name)
          .setPosition(hero.x, hero.y)
          .setOrigin(hero.originX, hero.originY)
          .setScale(hero.scaleX, hero.scaleY)
          .setAngle(hero.angle)
          .setFlipX(hero.flipX)
          .setDepth(hero.depth + dz)
          .setTint(ARMOUR_COL[armour])
          .setVisible(true)
      }
      tintLayer.setAlpha(ARMOUR_TINT_ALPHA[armour]!)
      // Soft breathing shine, plus a brighter glint every ~2.4s.
      const phase = (now % 2400) / 2400
      const glint = phase < 0.2 ? Math.sin((phase / 0.2) * Math.PI) : 0
      sheen.setAlpha(0.08 + 0.05 * armour * (0.5 + 0.5 * Math.sin(now / 420)) + glint * 0.35)
    } else {
      sheen.setVisible(false)
      tintLayer.setVisible(false)
    }

    const handX = hero.x + face * (who === 'girl' ? 13 : 20)
    const handY = hero.y - (who === 'girl' ? 22 : 40)
    streaks.forEach((s, i) => {
      if (weapon <= i || !shown) {
        s.setVisible(false)
        return
      }
      const fan = (i - (weapon - 1) / 2) * 0.55
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(now / 260 + i * 1.7))
      s.setVisible(true)
        .setFillStyle(TIER_COL[weapon], 1)
        .setPosition(handX + Math.sin(fan) * 14 * face, handY - Math.cos(fan) * 10)
        .setRotation(fan * face)
        .setAlpha(tw * (0.6 + weapon * 0.13))
        .setDepth(hero.depth + 0.2)
    })
  }
  scene.events.on('update', update)

  const destroy = () => {
    if (gone) return
    gone = true
    scene.events.off('update', update)
    sheen.destroy()
    tintLayer.destroy()
    streaks.forEach((s) => s.destroy())
  }
  scene.events.once('shutdown', destroy)
  return { destroy, refresh }
}
