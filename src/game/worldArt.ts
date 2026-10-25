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

  // All TileSprite sources are power-of-two. Phaser upscales NPOT canvases to
  // POT with LINEAR, which shreds pixel art and paints horizontal/vertical seams.

  paint(scene, 'bg-sky', 64, 128, (set, w, h) => {
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

  // Wrap-safe water: period divides tile width exactly; fully opaque (no soft-alpha seams).
  paint(scene, 'water-deep', 64, 64, (set, w, h) => {
    const deep: RGB = [28, 92, 158]
    const midC: RGB = [48, 158, 210]
    const lit: RGB = [90, 210, 235]
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c = t < 0.45 ? mix(lit, midC, t / 0.45) : mix(midC, deep, (t - 0.45) / 0.55)
      for (let x = 0; x < w; x++) {
        // 2 full cycles across 64px → seamless at x=0/w.
        const wave = Math.sin((x / w) * Math.PI * 2 * 2 + t * 3) * 0.06
        const shade = 1 + wave - t * 0.1
        set(x, y, [
          Math.min(255, Math.floor(c[0] * shade)),
          Math.min(255, Math.floor(c[1] * shade)),
          Math.min(255, Math.floor(c[2] * shade)),
        ], 255)
      }
    }
    // Specular dots — wrap-safe positions, full opacity.
    for (let i = 0; i < 8; i++) {
      const x = (i * 8 + 4) % w
      set(x, 8 + (i % 4), [180, 240, 255], 255)
      set((x + 2) % w, 24 + (i % 3), [120, 220, 250], 255)
      set((x + 4) % w, 44 + (i % 2), [70, 170, 220], 255)
    }
    rect(set, 0, h - 4, w, 4, [18, 60, 110], 255)
  })

  paint(scene, 'water-mid', 64, 32, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c: RGB = [lerp(70, 36, t), lerp(175, 120, t), lerp(230, 190, t)]
      for (let x = 0; x < w; x++) {
        const ripple = Math.sin((x / w) * Math.PI * 2 * 2 + y * 0.5) * 6
        set(
          x,
          y,
          [
            Math.min(255, Math.max(0, Math.floor(c[0] + ripple))),
            Math.min(255, Math.max(0, Math.floor(c[1] + ripple * 0.6))),
            Math.min(255, c[2]),
          ],
          255,
        )
      }
    }
    for (let x = 0; x < w; x++) {
      if ((x + 2) % 8 < 3) set(x, 4, [200, 240, 255], 255)
      if ((x + 5) % 8 < 2) set(x, 14, [230, 250, 255], 255)
      if (x % 8 < 2) set(x, 24, [170, 225, 250], 255)
    }
  })

  paint(scene, 'water-foam', 64, 16, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Soft continuous foam — fully opaque (soft alpha seams under NEAREST).
        // Low-contrast continuous wash — high-contrast foam bands read as vertical seams.
        const wave = Math.sin((x / w) * Math.PI * 2 * 2 + y * 0.7) * 0.5 + 0.5
        const c: RGB = [
          Math.floor(190 + wave * 40),
          Math.floor(225 + wave * 25),
          Math.floor(245 + wave * 10),
        ]
        set(x, y, c, 255)
      }
    }
  })

  // Soft distant haze only — no mountain / village tile strips.
  // Landmark mountains & clouds are discrete volumetric sprites (isoArt).
  paint(scene, 'bg-horizon', 64, 32, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h
      const a = Math.floor(t < 0.45 ? t * 90 : (1 - t) * 110)
      rect(set, 0, y, w, 1, mix([190, 220, 235], [210, 200, 160], t), Math.max(0, a))
    }
  })

  // Tiny creek wash under the single bridge landmark (not a tiled river band).
  paint(scene, 'lm-river', 96, 24, (set, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h
      const c = mix([90, 180, 220], [40, 110, 170], t)
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, w - 1 - x) / (w * 0.5)
        const a = Math.floor(Math.max(0, Math.min(1, edge * 1.4 - t * 0.2)) * 200)
        if (a < 8) continue
        const wave = Math.sin(x * 0.35 + y * 0.5) * 10
        set(x, y, [
          Math.min(255, c[0] + wave),
          Math.min(255, c[1] + Math.floor(wave * 0.5)),
          Math.min(255, c[2]),
        ], a)
      }
    }
    for (let x = 8; x < w - 8; x += 9) {
      set(x, 4 + (x % 5), [220, 245, 255], 180)
      set(x + 3, 10 + (x % 3), [180, 230, 250], 140)
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

  // Picnic bunting pole (was shrine banner)
  paint(scene, 'prop-banner', 24, 56, (set) => {
    rect(set, 4, 52, 16, 3, [20, 14, 16], 100)
    rect(set, 10, 2, 3, 52, [120, 80, 40])
    rect(set, 11, 2, 1, 52, [180, 130, 70])
    const flags: Array<[number, RGB]> = [
      [6, [240, 200, 80]],
      [16, [120, 170, 220]],
      [26, [230, 120, 100]],
      [36, [140, 190, 110]],
    ]
    for (const [y, c] of flags) {
      rect(set, 2, y, 14, 8, [20, 14, 16])
      rect(set, 3, y + 1, 12, 6, c)
      set(5, y + 2, [255, 255, 230])
    }
  })

  paint(scene, 'prop-bridge', 64, 28, (set) => {
    const ink: RGB = [18, 12, 14]
    rect(set, 4, 24, 56, 3, ink, 110)
    rect(set, 1, 1, 62, 20, ink)
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
