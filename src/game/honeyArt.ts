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

  // 琪寶寶近戰短刀／劍（黑色描邊＋頂光三階）
  paint(scene, 'prop-sword', 36, 14, (set) => {
    rect(set, 2, 4, 8, 6, [90, 55, 35])
    rect(set, 3, 5, 6, 4, [140, 90, 50])
    rect(set, 8, 2, 4, 10, [60, 50, 55])
    rect(set, 9, 3, 2, 8, [120, 110, 120])
    for (let x = 12; x < 34; x++) {
      const t = (x - 12) / 22
      rect(set, x, 4, 1, 6, [
        Math.floor(210 + t * 35),
        Math.floor(220 + t * 25),
        Math.floor(230 + t * 20),
      ])
      set(x, 4, [255, 255, 245])
      set(x, 9, [140, 150, 165])
    }
    rect(set, 32, 5, 3, 4, [245, 248, 255])
    // outline dots
    for (let x = 12; x < 34; x++) {
      set(x, 3, [20, 16, 22])
      set(x, 10, [20, 16, 22])
    }
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
