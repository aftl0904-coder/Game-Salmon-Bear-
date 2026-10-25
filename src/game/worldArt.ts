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

function lerp(a: number, b: number, t: number) {
  return Math.floor(a + (b - a) * t)
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/** Seamless / layered world art — creek shrine Japan-arcade atmosphere */
export function registerWorldArt(scene: Phaser.Scene) {
  paint(scene, 'shadow-blob', 48, 16, (set, w, h) => {
    const cx = w / 2
    const cy = h / 2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / (w * 0.48)
        const ny = (y - cy) / (h * 0.48)
        const d = nx * nx + ny * ny
        if (d < 1) set(x, y, [18, 12, 20], Math.floor((1 - d) * 118))
      }
    }
  })

  paint(scene, 'bg-sky', 64, 160, (set, w, h) => {
    const top: RGB = [110, 178, 220]
    const mid: RGB = [168, 210, 235]
    const warm: RGB = [255, 214, 150]
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c = t < 0.55 ? mix(top, mid, t / 0.55) : mix(mid, warm, (t - 0.55) / 0.45)
      rect(set, 0, y, w, 1, c)
      if (y % 17 === 0) rect(set, 0, y, w, 1, mix(c, [255, 240, 210], 0.18), 90)
    }
  })

  paint(scene, 'water-deep', 64, 48, (set, w, h) => {
    const deep: RGB = [28, 92, 158]
    const midC: RGB = [48, 158, 210]
    const lit: RGB = [90, 210, 235]
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c = t < 0.45 ? mix(lit, midC, t / 0.45) : mix(midC, deep, (t - 0.45) / 0.55)
      for (let x = 0; x < w; x++) {
        const wave = Math.sin((x / w) * Math.PI * 6 + t * 4) * 0.08
        const shade = 1 + wave - t * 0.12
        set(x, y, [
          Math.min(255, Math.floor(c[0] * shade)),
          Math.min(255, Math.floor(c[1] * shade)),
          Math.min(255, Math.floor(c[2] * shade)),
        ])
      }
    }
    for (let x = 0; x < w; x += 7) {
      set(x, 6 + (x % 5), [180, 240, 255], 200)
      set(x + 2, 18 + (x % 4), [120, 220, 250], 160)
      set(x + 4, 32 + (x % 3), [70, 170, 220], 140)
    }
    rect(set, 0, h - 4, w, 4, [18, 60, 110], 200)
  })

  paint(scene, 'water-mid', 64, 28, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c: RGB = [lerp(70, 36, t), lerp(175, 120, t), lerp(230, 190, t)]
      for (let x = 0; x < w; x++) {
        const ripple = Math.sin(x * 0.4 + y * 0.6) * 8
        set(x, y, [
          Math.min(255, c[0] + ripple),
          Math.min(255, c[1] + ripple * 0.6),
          Math.min(255, c[2]),
        ], 210)
      }
    }
    for (let x = 0; x < w; x++) {
      if ((x + 2) % 7 < 3) set(x, 4, [200, 240, 255], 180)
      if ((x + 5) % 11 < 2) set(x, 12, [230, 250, 255], 160)
      if (x % 9 < 2) set(x, 20, [170, 225, 250], 130)
    }
  })

  paint(scene, 'water-foam', 64, 12, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wave = Math.sin((x / w) * Math.PI * 5 + y * 0.8) * 0.5 + 0.5
        if (wave > 0.5) set(x, y, [240, 252, 255], Math.floor(90 + wave * 120))
        if (wave > 0.82) set(x, y, [255, 255, 255], 220)
      }
    }
  })

  paint(scene, 'bg-mount-far', 192, 96, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      rect(set, 0, y, w, 1, mix([140, 188, 210], [120, 168, 150], y / h))
    }
    for (let i = 0; i < 5; i++) {
      const px = 16 + i * 38
      for (let y = 0; y < 42; y++) {
        const half = Math.max(0, 22 - Math.floor(y / 1.9))
        rect(set, px - half, 70 - y, half * 2, 1, [115, 165, 155], 200)
      }
      rect(set, px - 5, 28, 10, 5, [210, 228, 235], 180)
    }
    for (let i = 0; i < 4; i++) {
      const px = 28 + i * 48
      for (let y = 0; y < 58; y++) {
        const half = Math.max(0, 20 - Math.floor(y / 2.4))
        const lit: RGB = y < 12 ? [150, 185, 175] : y > 40 ? [85, 140, 125] : [105, 160, 140]
        rect(set, px - half, 78 - y, half * 2, 1, lit)
        if (half > 2) set(px - half + 1, 78 - y, [170, 205, 190])
      }
      rect(set, px - 6, 18, 12, 6, [225, 238, 245])
      rect(set, px - 3, 16, 6, 3, [245, 250, 255])
    }
    for (let y = 72; y < h; y++) {
      rect(set, 0, y, w, 1, [180, 210, 200], Math.floor((y - 72) * 6))
    }
  })

  paint(scene, 'bg-mount-near', 160, 88, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      rect(set, 0, y, w, 1, mix([95, 175, 105], [55, 120, 70], y / h))
    }
    for (let i = 0; i < 4; i++) {
      const px = 18 + i * 40
      for (let y = 0; y < 52; y++) {
        const half = Math.max(0, 18 - Math.floor(y / 2.6))
        const face: RGB = y < 10 ? [110, 195, 115] : y > 36 ? [50, 115, 60] : [75, 160, 85]
        rect(set, px - half, 72 - y, half * 2, 1, face)
        if (half > 3) {
          set(px - half + 1, 72 - y, [150, 215, 140])
          set(px + half - 2, 72 - y, [40, 100, 50])
        }
        if (y > 28 && y % 4 === 0 && half > 4) {
          rect(set, px - half + 3, 72 - y - 3, 3, 4, [40, 100, 55])
          rect(set, px + 2, 72 - y - 4, 4, 5, [55, 130, 70])
        }
      }
    }
    rect(set, 0, 78, w, 4, [70, 48, 28], 180)
    rect(set, 0, 76, w, 2, [130, 90, 50], 140)
  })

  paint(scene, 'bg-village', 192, 56, (set) => {
    const sil: RGB = [55, 78, 72]
    const silL: RGB = [78, 105, 95]
    for (const ox of [12, 48, 88, 130, 160]) {
      rect(set, ox, 28, 22, 24, sil, 210)
      for (let i = 0; i < 12; i++) {
        rect(set, ox - 2 + i, 28 - i, 26 - i * 2, 1, silL, 220)
      }
      if (ox % 40 < 30) rect(set, ox + 6, 36, 5, 5, [255, 200, 100], 160)
    }
    rect(set, 100, 18, 4, 34, sil, 230)
    rect(set, 124, 18, 4, 34, sil, 230)
    rect(set, 96, 14, 36, 5, silL, 230)
    rect(set, 94, 10, 40, 5, sil, 230)
    for (const tx of [30, 70, 150]) {
      for (let i = 0; i < 8; i++) {
        rect(set, tx - 4 + i, 22 - i, 10 - i, 1, [40, 70, 55], 200)
      }
    }
  })

  paint(scene, 'bg-cloud', 80, 36, (set) => {
    const blobs: Array<[number, number, number, number]> = [
      [20, 20, 12, 200],
      [36, 14, 14, 220],
      [52, 18, 11, 200],
      [30, 22, 10, 180],
      [44, 24, 8, 160],
    ]
    for (const [cx, cy, r, a] of blobs) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) {
            const lit: RGB = y < -2 ? [255, 255, 255] : y > 4 ? [230, 236, 245] : [248, 250, 255]
            set(cx + x, cy + y, lit, a)
          }
        }
      }
    }
  })

  paint(scene, 'fg-reed', 20, 36, (set) => {
    const stem: RGB = [55, 105, 48]
    const tip: RGB = [130, 185, 85]
    for (let i = 0; i < 5; i++) {
      const ox = 4 + i * 3
      for (let y = 8; y < 36; y++) {
        set(ox + Math.floor((36 - y) / 12), y, y < 16 ? tip : stem)
      }
    }
  })

  paint(scene, 'fg-rock', 28, 18, (set) => {
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 28; x++) {
        const nx = (x - 14) / 14
        const ny = (y - 10) / 9
        if (nx * nx + ny * ny < 1) {
          const lit = 1.05 - nx * 0.2 - (y > 10 ? 0.25 : 0)
          const base = y < 7 ? 175 : 125
          set(x, y, [
            Math.floor(base * lit),
            Math.floor((base - 6) * lit),
            Math.floor((base - 14) * lit),
          ])
        }
      }
    }
    set(10, 6, [210, 208, 200])
    set(16, 8, [85, 82, 74])
    rect(set, 4, 15, 20, 2, [20, 16, 18], 100)
  })

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
    rect(set, 8, 25, 20, 2, [20, 16, 18], 90)
  })

  paint(scene, 'prop-banner', 24, 56, (set) => {
    rect(set, 4, 52, 16, 3, [20, 14, 16], 100)
    rect(set, 10, 2, 3, 52, [120, 80, 40])
    rect(set, 11, 2, 1, 52, [180, 130, 70])
    rect(set, 2, 6, 18, 36, [230, 90, 55])
    rect(set, 2, 6, 18, 4, [255, 160, 100])
    rect(set, 2, 38, 18, 4, [170, 50, 35])
    rect(set, 5, 14, 12, 8, [255, 200, 150])
    rect(set, 6, 15, 10, 6, [255, 140, 90])
    set(14, 17, [80, 150, 210])
    rect(set, 4, 26, 14, 3, [255, 210, 80])
    rect(set, 5, 32, 12, 4, [255, 240, 180])
  })

  paint(scene, 'prop-bridge', 64, 28, (set) => {
    rect(set, 4, 24, 56, 3, [20, 14, 12], 110)
    rect(set, 2, 8, 60, 10, [190, 130, 70])
    rect(set, 2, 8, 60, 2, [230, 180, 120])
    rect(set, 2, 16, 60, 2, [130, 80, 40])
    for (let x = 6; x < 58; x += 10) {
      rect(set, x, 8, 2, 10, [150, 95, 48])
      set(x + 3, 11, [70, 50, 30])
    }
    rect(set, 4, 2, 3, 10, [160, 100, 50])
    rect(set, 57, 2, 3, 10, [160, 100, 50])
    rect(set, 4, 2, 56, 3, [200, 140, 80])
    rect(set, 4, 2, 56, 1, [240, 190, 130])
  })
}
