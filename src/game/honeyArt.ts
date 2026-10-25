import type Phaser from 'phaser'

type RGB = [number, number, number]

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (set: (x: number, y: number, c: RGB, a?: number) => void) => void,
) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const set = (x: number, y: number, c: RGB, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    img.data[i] = c[0]
    img.data[i + 1] = c[1]
    img.data[i + 2] = c[2]
    img.data[i + 3] = a
  }
  draw(set)
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
}

function rect(
  set: (x: number, y: number, c: RGB, a?: number) => void,
  x: number,
  y: number,
  w: number,
  h: number,
  c: RGB,
  a = 255,
) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c, a)
}

/** Honey / fan / projectile art */
export function registerHoneyArt(scene: Phaser.Scene) {
  paint(scene, 'fx-honey', 40, 18, (set) => {
    rect(set, 0, 4, 40, 10, [255, 190, 60])
    rect(set, 4, 2, 12, 14, [255, 210, 90])
    rect(set, 18, 1, 14, 16, [255, 170, 40])
    set(10, 6, [255, 240, 180])
    set(28, 8, [255, 240, 180])
  })

  paint(scene, 'fx-salmon-shot', 28, 14, (set) => {
    rect(set, 2, 3, 18, 8, [240, 120, 70])
    rect(set, 16, 1, 10, 12, [255, 170, 110])
    set(22, 4, [255, 230, 200])
    rect(set, 0, 5, 6, 4, [80, 160, 220])
  })

  paint(scene, 'prop-honey-pot', 28, 32, (set) => {
    rect(set, 6, 10, 16, 18, [220, 150, 40])
    rect(set, 8, 8, 12, 4, [180, 110, 30])
    rect(set, 10, 4, 8, 6, [255, 200, 80])
    set(12, 14, [255, 230, 140])
    rect(set, 4, 26, 20, 4, [140, 80, 30])
  })

  paint(scene, 'prop-fan', 24, 28, (set) => {
    // electric fan on girl's back (cyan blades + motor) — mobility, not weapon
    rect(set, 9, 18, 6, 8, [70, 80, 95])
    rect(set, 10, 10, 4, 10, [90, 100, 120])
    rect(set, 10, 8, 4, 4, [200, 220, 240])
    for (let i = 0; i < 6; i++) {
      const c: RGB = i % 2 === 0 ? [120, 220, 255] : [200, 245, 255]
      rect(set, 2 + i * 3, 2 + (i % 3), 3, 10 - (i % 3), c)
    }
    set(4, 4, [255, 255, 180])
    set(18, 6, [180, 255, 255])
    set(12, 2, [255, 255, 220])
  })

  // 醃魚雜兵：小刀（刺擊）— Pack2 換走魚槍
  paint(scene, 'prop-enemy-knife', 28, 12, (set) => {
    const ink: RGB = [16, 10, 12]
    // handle
    rect(set, 0, 3, 10, 6, ink)
    rect(set, 1, 4, 8, 4, [90, 55, 35])
    rect(set, 1, 4, 8, 1, [150, 100, 55])
    // guard
    rect(set, 9, 1, 3, 10, ink)
    rect(set, 10, 2, 1, 8, [180, 175, 190])
    // blade
    rect(set, 12, 3, 15, 6, ink)
    rect(set, 13, 4, 13, 4, [210, 220, 235])
    rect(set, 13, 4, 13, 1, [255, 255, 250])
    rect(set, 13, 7, 13, 1, [140, 150, 170])
    // tip
    rect(set, 25, 4, 3, 4, ink)
    rect(set, 26, 5, 2, 2, [245, 248, 255])
  })
  // keep spear key as alias for any leftover refs
  paint(scene, 'prop-enemy-spear', 28, 12, (set) => {
    const ink: RGB = [16, 10, 12]
    rect(set, 0, 3, 10, 6, ink)
    rect(set, 1, 4, 8, 4, [90, 55, 35])
    rect(set, 9, 1, 3, 10, ink)
    rect(set, 12, 3, 15, 6, ink)
    rect(set, 13, 4, 13, 4, [210, 220, 235])
  })

  // 木桶武者：釘棒
  paint(scene, 'prop-enemy-club', 36, 14, (set) => {
    const ink: RGB = [18, 12, 14]
    rect(set, 0, 4, 36, 6, ink)
    rect(set, 1, 5, 14, 4, [90, 55, 30])
    rect(set, 1, 5, 14, 1, [140, 90, 50])
    rect(set, 14, 2, 20, 10, ink)
    rect(set, 15, 3, 18, 8, [160, 100, 50])
    rect(set, 15, 3, 18, 2, [210, 150, 90])
    set(20, 5, [220, 220, 230])
    set(26, 7, [220, 220, 230])
    set(30, 5, [220, 220, 230])
  })

  // 琪寶寶長劍 — handle on left so origin sticks in her hand
  paint(scene, 'prop-sword', 72, 18, (set) => {
    const ink: RGB = [18, 12, 16]
    // pommel
    rect(set, 0, 6, 5, 6, ink)
    rect(set, 1, 7, 3, 4, [180, 140, 60])
    // grip
    rect(set, 4, 5, 12, 8, ink)
    rect(set, 5, 6, 10, 6, [90, 50, 30])
    rect(set, 5, 6, 10, 2, [140, 85, 45])
    rect(set, 7, 8, 6, 2, [60, 35, 22])
    // guard
    rect(set, 15, 1, 5, 16, ink)
    rect(set, 16, 2, 3, 14, [200, 175, 90])
    rect(set, 16, 2, 3, 2, [255, 230, 140])
    // long blade
    for (let x = 20; x < 68; x++) {
      const t = (x - 20) / 48
      const thick = 8 - Math.floor(t * 3)
      const y0 = 9 - Math.floor(thick / 2)
      rect(set, x, y0 - 1, 1, thick + 2, ink)
      rect(set, x, y0, 1, thick, [
        Math.floor(210 + t * 40),
        Math.floor(220 + t * 30),
        Math.floor(235 + t * 15),
      ])
      set(x, y0, [255, 255, 248])
      set(x, y0 + thick - 1, [130, 140, 160])
    }
    // tip
    rect(set, 67, 6, 5, 6, ink)
    rect(set, 68, 7, 3, 4, [245, 248, 255])
  })

  // 刺刺魚 tiny bullet
  paint(scene, 'fx-fish-bullet', 10, 6, (set) => {
    const ink: RGB = [20, 12, 16]
    rect(set, 0, 1, 10, 4, ink)
    rect(set, 1, 2, 8, 2, [255, 170, 90])
    set(2, 2, [255, 230, 160])
    set(7, 2, [220, 80, 60])
  })

  // 榴槤陷阱 — 踩到拮腳 −1HP
  paint(scene, 'hazard-durian', 28, 26, (set) => {
    const ink: RGB = [18, 12, 10]
    // oval body
    for (let y = 6; y < 24; y++) {
      for (let x = 4; x < 24; x++) {
        const nx = (x - 14) / 10
        const ny = (y - 15) / 9
        if (nx * nx + ny * ny <= 1) {
          set(x, y, ink)
          set(x, y, [70, 120, 45])
          if (ny < -0.2) set(x, y, [95, 155, 55])
          if (ny > 0.35) set(x, y, [45, 85, 30])
        }
      }
    }
    // thorns
    const tips: Array<[number, number]> = [
      [14, 2], [8, 5], [20, 5], [5, 12], [23, 12], [7, 20], [21, 20], [14, 24],
      [11, 4], [17, 4], [4, 16], [24, 16],
    ]
    for (const [tx, ty] of tips) {
      rect(set, tx - 1, ty - 1, 3, 3, ink)
      set(tx, ty, [210, 200, 90])
      set(tx, ty - 1, [240, 230, 140])
    }
    // stem
    rect(set, 13, 0, 3, 5, ink)
    rect(set, 13, 1, 3, 3, [90, 55, 25])
  })

  paint(scene, 'shadow-blob', 48, 16, (set) => {
    const cx = 24
    const cy = 8
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 48; x++) {
        const nx = (x - cx) / 22
        const ny = (y - cy) / 7
        const d = nx * nx + ny * ny
        if (d < 1) set(x, y, [20, 16, 28], Math.floor((1 - d) * 110))
      }
    }
  })
}
