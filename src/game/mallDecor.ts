/**
 * C2 mall polish (T5 / T5b): procedural shop icons + décor props.
 * Original Graphics only — no brand marks, no store-name text on signs.
 */
import Phaser from 'phaser'
import { DEPTH } from './engine/depth'

export type ShopIconKind =
  | 'pharmacy'
  | 'restaurant'
  | 'fashion'
  | 'bookstore'
  | 'toy'
  | 'coffee'
  | 'shoes'
  | 'electronics'
  | 'souvenir'

/** T5 + Claude 2026-11-22 supplement. Unlisted → stop & ask. */
export const SHOP_ICON_BY_LABEL: Record<string, ShopIconKind> = {
  藥房: 'pharmacy',
  藥妝: 'pharmacy',
  餐廳: 'restaurant',
  茶餐廳: 'restaurant',
  時裝: 'fashion',
  服飾: 'fashion',
  書店: 'bookstore',
  玩具: 'toy',
  咖啡: 'coffee',
  鞋店: 'shoes',
  電器: 'electronics',
  手信: 'souvenir',
}

const ICON = 32

function bakeIcon(scene: Phaser.Scene, key: string, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return key
  const g = scene.make.graphics({ x: 0, y: 0 })
  draw(g)
  g.generateTexture(key, ICON, ICON)
  g.destroy()
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
  return key
}

export function ensureShopIcons(scene: Phaser.Scene) {
  bakeIcon(scene, 's6-icon-pharmacy', (g) => {
    g.fillStyle(0xe8e8f0, 1).fillRoundedRect(6, 12, 20, 10, 5)
    g.fillStyle(0xe02838, 1).fillRoundedRect(16, 12, 10, 10, { tl: 0, tr: 5, br: 5, bl: 0 })
    g.lineStyle(1, 0x302028, 1).strokeRoundedRect(6, 12, 20, 10, 5)
  })
  bakeIcon(scene, 's6-icon-restaurant', (g) => {
    g.fillStyle(0xf0e0c8, 1).fillEllipse(16, 20, 22, 12)
    g.fillStyle(0xc87840, 1).fillEllipse(16, 18, 20, 8)
    g.lineStyle(2, 0x3a2818, 1)
    g.lineBetween(10, 6, 14, 18)
    g.lineBetween(14, 5, 18, 18)
  })
  bakeIcon(scene, 's6-icon-fashion', (g) => {
    g.fillStyle(0x5a9ad8, 1)
    g.fillTriangle(8, 10, 4, 14, 7, 16)
    g.fillTriangle(24, 10, 28, 14, 25, 16)
    g.fillRect(7, 12, 18, 14)
    g.fillStyle(0x4a88c0, 1).fillTriangle(12, 12, 20, 12, 16, 8)
    g.lineStyle(1, 0x1a3048, 1).strokeRect(7, 12, 18, 14)
  })
  bakeIcon(scene, 's6-icon-bookstore', (g) => {
    g.fillStyle(0xf4ecd8, 1)
    g.fillTriangle(16, 8, 6, 10, 6, 26)
    g.fillTriangle(16, 8, 6, 26, 16, 24)
    g.fillTriangle(16, 8, 26, 10, 26, 26)
    g.fillTriangle(16, 8, 26, 26, 16, 24)
    g.lineStyle(1, 0x4a3828, 1)
    g.lineBetween(16, 8, 16, 24)
    g.strokeTriangle(16, 8, 6, 10, 6, 26)
    g.strokeTriangle(16, 8, 26, 10, 26, 26)
  })
  bakeIcon(scene, 's6-icon-toy', (g) => {
    g.fillStyle(0xe05030, 1).fillCircle(16, 16, 11)
    g.fillStyle(0xffe080, 1).fillCircle(12, 12, 4)
    g.lineStyle(2, 0xfff0c0, 1).strokeCircle(16, 16, 11)
    g.lineBetween(5, 16, 27, 16)
    g.lineBetween(16, 5, 16, 27)
  })
  bakeIcon(scene, 's6-icon-coffee', (g) => {
    g.fillStyle(0xf0f0f4, 1).fillRoundedRect(9, 14, 14, 12, 2)
    g.fillStyle(0x6a4020, 1).fillRect(11, 16, 10, 6)
    g.lineStyle(2, 0xc0c0c8, 1)
    g.beginPath()
    g.arc(24, 20, 4, -Math.PI / 2, Math.PI / 2, false)
    g.strokePath()
    g.lineStyle(1, 0xa8b8c8, 1)
    g.lineBetween(12, 11, 12, 4)
    g.lineBetween(16, 10, 16, 3)
    g.lineBetween(20, 11, 20, 4)
  })
  // Claude 2026-11-22: 鞋店 / 電器 / 手信
  bakeIcon(scene, 's6-icon-shoes', (g) => {
    g.fillStyle(0xe8eef4, 1)
    g.fillTriangle(5, 20, 10, 13, 22, 12)
    g.fillTriangle(5, 20, 22, 12, 27, 20)
    g.fillRect(5, 18, 22, 4)
    g.fillStyle(0x3a90d0, 1).fillRect(8, 14, 12, 4)
    g.fillStyle(0xd05040, 1).fillRect(6, 20, 20, 3)
    g.lineStyle(1, 0x283040, 1).strokeRect(5, 13, 22, 10)
  })
  bakeIcon(scene, 's6-icon-electronics', (g) => {
    g.fillStyle(0xffe060, 1)
    g.fillTriangle(18, 4, 10, 16, 15, 16)
    g.fillTriangle(15, 16, 12, 28, 24, 12)
    g.fillTriangle(15, 16, 24, 12, 17, 12)
    g.lineStyle(1, 0xa07010, 1)
    g.lineBetween(18, 4, 10, 16)
    g.lineBetween(10, 16, 15, 16)
    g.lineBetween(15, 16, 12, 28)
    g.lineBetween(12, 28, 24, 12)
    g.lineBetween(24, 12, 17, 12)
    g.lineBetween(17, 12, 18, 4)
  })
  bakeIcon(scene, 's6-icon-souvenir', (g) => {
    g.fillStyle(0xd85868, 1).fillRoundedRect(7, 12, 18, 14, 2)
    g.fillStyle(0xf0e080, 1).fillRect(14, 12, 4, 14).fillRect(7, 17, 18, 4)
    g.fillStyle(0xe8d060, 1)
    g.fillTriangle(16, 12, 10, 6, 8, 12)
    g.fillTriangle(16, 12, 22, 6, 24, 12)
    g.lineStyle(1, 0x602028, 1).strokeRoundedRect(7, 12, 18, 14, 2)
  })
}

export function shopIconTex(kind: ShopIconKind): string {
  return `s6-icon-${kind}`
}

export type MallPropKind =
  | 'plant'
  | 'bench'
  | 'bin'
  | 'wayfind'
  | 'cart'
  | 'rail'
  | 'escalator-sign'
  | 'lightbox'

/** Mall palette props (24–64px tall). Collision unchanged — callers keep prior hurt/body. */
export function drawMallProp(g: Phaser.GameObjects.Graphics, kind: MallPropKind, h = 40, clear = true) {
  if (clear) g.clear()
  const H = Math.max(24, Math.min(64, h))
  switch (kind) {
    case 'plant': {
      g.fillStyle(0x6a4a28, 1).fillRect(-8, -12, 16, 12)
      g.fillStyle(0x8a6a40, 1).fillRect(-7, -11, 14, 3)
      g.fillStyle(0x3a8a48, 1).fillEllipse(0, -H * 0.55, 22, H * 0.55)
      g.fillStyle(0x2a6a38, 1).fillEllipse(-6, -H * 0.4, 10, 12).fillEllipse(7, -H * 0.45, 9, 11)
      break
    }
    case 'bench': {
      g.fillStyle(0x8a6a48, 1).fillRect(-22, -14, 44, 6)
      g.fillStyle(0x6a5040, 1).fillRect(-20, -28, 40, 5)
      g.fillStyle(0x4a4038, 1).fillRect(-18, -8, 4, 8).fillRect(14, -8, 4, 8)
      g.fillStyle(0x5a5048, 1).fillRect(-18, -28, 3, 14).fillRect(15, -28, 3, 14)
      break
    }
    case 'bin': {
      g.fillStyle(0x3a4a58, 1).fillRoundedRect(-10, -H + 4, 20, H - 4, 3)
      g.fillStyle(0x2a3848, 1).fillRect(-12, -H + 2, 24, 5)
      g.fillStyle(0x5a7080, 1).fillRect(-6, -H * 0.55, 4, 8).fillRect(2, -H * 0.55, 4, 8)
      break
    }
    case 'wayfind': {
      g.fillStyle(0x708090, 1).fillRect(-2, -H, 4, H)
      g.fillStyle(0x2a4058, 1).fillRoundedRect(-18, -H + 4, 36, 16, 2)
      g.fillStyle(0xd0e0f0, 0.85).fillTriangle(-4, -H + 12, 8, -H + 8, 8, -H + 16)
      break
    }
    case 'cart': {
      g.lineStyle(2, 0x8090a0, 1)
      g.strokeRoundedRect(-14, -H + 10, 28, H - 18, 2)
      g.lineBetween(-14, -H + 18, 14, -H + 18)
      g.fillStyle(0x4a5560, 1).fillCircle(-8, -4, 4).fillCircle(8, -4, 4)
      g.lineStyle(2, 0xa0b0c0, 1).lineBetween(-10, -H + 10, -14, -H)
      break
    }
    case 'rail': {
      g.fillStyle(0xc0c8d0, 1).fillRect(-28, -H * 0.55, 56, 4)
      g.fillStyle(0x9098a0, 1).fillRect(-26, -H * 0.55, 3, H * 0.55).fillRect(23, -H * 0.55, 3, H * 0.55)
      g.fillStyle(0xa8b0b8, 1).fillRect(-2, -H * 0.55, 3, H * 0.55)
      break
    }
    case 'escalator-sign': {
      g.fillStyle(0x203040, 1).fillRoundedRect(-16, -H, 32, 18, 2)
      g.fillStyle(0x4a5560, 1).fillTriangle(-10, -H + 14, 10, -H + 14, 10, -H + 4)
      g.lineStyle(1, 0xc0d0e0, 1).lineBetween(-8, -H + 12, 8, -H + 6)
      g.fillStyle(0x708090, 1).fillRect(-2, -H + 18, 4, H - 18)
      break
    }
    case 'lightbox': {
      g.fillStyle(0x2a3038, 1).fillRoundedRect(-20, -H, 40, H * 0.7, 3)
      g.fillStyle(0xe8d080, 0.55).fillRoundedRect(-16, -H + 4, 32, H * 0.55, 2)
      g.fillStyle(0xfff0b0, 0.35).fillRoundedRect(-12, -H + 8, 24, H * 0.35, 1)
      break
    }
  }
}

export function placeMallProp(
  scene: Phaser.Scene,
  kind: MallPropKind,
  x: number,
  floorY: number,
  h = 40,
  depth = DEPTH.PROP + 2,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, floorY).setDepth(depth)
  const g = scene.add.graphics()
  drawMallProp(g, kind, h)
  root.add(g)
  return root
}
