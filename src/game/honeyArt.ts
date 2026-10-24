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

  paint(scene, 'prop-fan', 22, 28, (set) => {
    // paper fan — Sailor/TwinBee cute prop
    for (let i = 0; i < 7; i++) {
      const c: RGB = i % 2 === 0 ? [255, 140, 170] : [255, 230, 240]
      rect(set, 4 + i, 4 + i, 2, 18 - i * 2, c)
    }
    rect(set, 2, 20, 16, 4, [120, 70, 40])
    rect(set, 8, 22, 4, 6, [90, 50, 30])
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
