import Phaser from 'phaser'

type CardBox = { x: number; y: number; width: number; height: number }

/**
 * Clear / win card cast: place characters under the title at an integer scale
 * so they never overlap the headline or each other.
 *
 * `card` is treated as top-left origin box (x,y,width,height) in the same
 * coordinate space as `titleText` (e.g. overlay container local space).
 */
export function layoutClearCard(
  scene: Phaser.Scene,
  card: CardBox | Phaser.GameObjects.Rectangle,
  titleText: Phaser.GameObjects.Text,
  keys: string[],
): Phaser.GameObjects.Image[] {
  const box: CardBox =
    'getBounds' in card
      ? (() => {
          // Prefer explicit width/height; convert center-origin rect → top-left box.
          const r = card as Phaser.GameObjects.Rectangle
          return {
            x: r.x - r.width * r.originX,
            y: r.y - r.height * r.originY,
            width: r.width,
            height: r.height,
          }
        })()
      : card

  const titleBottom = titleText.y + titleText.displayHeight * (1 - titleText.originY)
  // Keep cast clearly under the headline (no head-over-title overlap).
  const top = titleBottom + 16
  const bottom = box.y + box.height * 0.72
  const areaH = Math.max(1, bottom - top)
  const gap = 16
  const sprites = keys.map((k) => scene.add.image(0, 0, k).setOrigin(0.5, 1))
  const maxH = Math.max(1, ...sprites.map((s) => s.height))
  // Prefer scale 1 when bible heights fit; never fractional.
  let scale = Math.max(1, Math.floor(areaH / maxH))
  if (scale > 3) scale = 3
  const totalW =
    sprites.reduce((w, s) => w + s.width * scale, 0) + gap * Math.max(0, sprites.length - 1)
  let x = Math.round(box.x + (box.width - totalW) / 2)
  sprites.forEach((s) => {
    s.setScale(scale).setPosition(Math.round(x + (s.width * scale) / 2), Math.round(bottom))
    x += s.width * scale + gap
  })
  return sprites
}
