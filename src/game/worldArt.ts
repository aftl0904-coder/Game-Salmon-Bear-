import type Phaser from 'phaser'

type RGB = [number, number, number]

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (set: (x: number, y: number, c: RGB, a?: number) => void, w: number, h: number) => void,
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
  draw(set, w, h)
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

/** Seamless / layered world art textures */
export function registerWorldArt(scene: Phaser.Scene) {
  // soft ground shadow blob — stable under characters
  paint(scene, 'shadow-blob', 48, 16, (set, w, h) => {
    const cx = w / 2
    const cy = h / 2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / (w * 0.48)
        const ny = (y - cy) / (h * 0.48)
        const d = nx * nx + ny * ny
        if (d < 1) {
          const a = Math.floor((1 - d) * 110)
          set(x, y, [20, 16, 28], a)
        }
      }
    }
  })

  // scrolling deep water strip
  paint(scene, 'water-deep', 64, 48, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c: RGB = [
        Math.floor(28 + t * 20),
        Math.floor(90 + t * 40),
        Math.floor(150 + t * 30),
      ]
      rect(set, 0, y, w, 1, c)
    }
    for (let x = 0; x < w; x += 8) {
      set(x, 10, [40, 120, 180])
      set(x + 3, 22, [50, 140, 200])
      set(x + 5, 34, [35, 110, 170])
    }
  })

  // mid water with foam lines
  paint(scene, 'water-mid', 64, 28, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const c: RGB = [50 + y, 140 + y, 210]
      rect(set, 0, y, w, 1, c, 200)
    }
    for (let x = 0; x < w; x++) {
      if ((x + 2) % 7 < 3) set(x, 4, [180, 230, 255], 160)
      if ((x + 5) % 11 < 2) set(x, 12, [220, 245, 255], 140)
      if (x % 9 < 2) set(x, 20, [160, 220, 250], 120)
    }
  })

  // surface sparkle ribbon
  paint(scene, 'water-foam', 64, 12, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wave = Math.sin((x / w) * Math.PI * 4 + y) * 0.5 + 0.5
        if (wave > 0.55) set(x, y, [230, 250, 255], Math.floor(80 + wave * 100))
      }
    }
  })

  // far mountain band (tileable-ish)
  paint(scene, 'bg-mount-far', 160, 80, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const c: RGB = [90 + y, 140 + Math.floor(y * 0.4), 150 + Math.floor(y * 0.2)]
      rect(set, 0, y, w, 1, c)
    }
    // peaks
    for (let i = 0; i < 4; i++) {
      const px = 20 + i * 40
      for (let y = 0; y < 50; y++) {
        const half = Math.max(0, 18 - Math.floor(y / 2.2))
        rect(set, px - half, 55 - y, half * 2, 1, [70, 120, 130])
      }
      // snow tip
      rect(set, px - 4, 8, 8, 4, [220, 235, 240])
    }
  })

  paint(scene, 'bg-mount-near', 128, 70, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      rect(set, 0, y, w, 1, [70 + y, 150 + Math.floor(y * 0.3), 90 + Math.floor(y * 0.2)])
    }
    for (let i = 0; i < 3; i++) {
      const px = 24 + i * 42
      for (let y = 0; y < 45; y++) {
        const half = Math.max(0, 16 - Math.floor(y / 2.5))
        rect(set, px - half, 60 - y, half * 2, 1, [55, 130, 70])
        if (y > 20 && y % 3 === 0) rect(set, px - half + 2, 60 - y, 3, 1, [90, 170, 95])
      }
    }
  })

  // cloud puff
  paint(scene, 'bg-cloud', 64, 28, (set) => {
    const soft: RGB = [255, 255, 255]
    const blobs: Array<[number, number, number]> = [
      [18, 16, 10],
      [32, 12, 12],
      [46, 16, 9],
      [28, 18, 8],
    ]
    for (const [cx, cy, r] of blobs) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) set(cx + x, cy + y, soft, 210)
        }
      }
    }
  })

  // reed / foreground grass tuft
  paint(scene, 'fg-reed', 20, 36, (set) => {
    const stem: RGB = [60, 110, 50]
    const tip: RGB = [120, 180, 80]
    for (let i = 0; i < 5; i++) {
      const ox = 4 + i * 3
      for (let y = 8; y < 36; y++) {
        set(ox + Math.floor((36 - y) / 12), y, y < 16 ? tip : stem)
      }
    }
  })

  // river rock
  paint(scene, 'fg-rock', 28, 18, (set) => {
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 28; x++) {
        const nx = (x - 14) / 14
        const ny = (y - 10) / 9
        if (nx * nx + ny * ny < 1) {
          const lit = y < 8 ? 160 : 110
          set(x, y, [lit, lit - 8, lit - 16])
        }
      }
    }
    set(10, 6, [200, 198, 190])
    set(16, 8, [90, 88, 80])
  })

  // bush
  paint(scene, 'prop-bush', 36, 28, (set) => {
    const dark: RGB = [40, 110, 55]
    const mid: RGB = [70, 150, 70]
    const lit: RGB = [120, 190, 100]
    const blobs: Array<[number, number, number, RGB]> = [
      [12, 16, 11, dark],
      [22, 14, 12, mid],
      [18, 10, 9, lit],
      [28, 18, 8, mid],
      [8, 18, 8, dark],
    ]
    for (const [cx, cy, r, c] of blobs) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) set(cx + x, cy + y, c)
        }
      }
    }
    set(14, 12, [255, 180, 200])
    set(24, 11, [255, 255, 255])
  })
}
