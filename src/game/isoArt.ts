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

function shadeRGB(c: RGB, lit: number): RGB {
  return [
    Math.min(255, Math.max(0, Math.floor(c[0] * lit))),
    Math.min(255, Math.max(0, Math.floor(c[1] * lit))),
    Math.min(255, Math.max(0, Math.floor(c[2] * lit))),
  ]
}

/** Faux-3D SNES+ props: volumetric bevels, depth gradients, soft contact shadows */
export function registerIsoArt(scene: Phaser.Scene) {
  paint(scene, 'shad', 64, 20, (set) => {
    const cx = 32
    const cy = 10
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 64; x++) {
        const nx = (x - cx) / 30
        const ny = (y - cy) / 8
        const d = nx * nx + ny * ny
        if (d < 1) set(x, y, [16, 12, 18], Math.floor((1 - d) * 140))
      }
    }
  })

  // Seamless flat bank tile — wrap-safe L/R (no left-only highlight that reads as a seam).
  paint(scene, 'blk-grass', 32, 40, (set) => {
    for (let y = 12; y < 36; y++) {
      const t = (y - 12) / 24
      rect(set, 0, y, 32, 1, shadeRGB([145, 95, 55], 1.05 - t * 0.35))
    }
    for (let y = 16; y < 34; y += 4) {
      rect(set, 0, y, 32, 1, [100, 65, 38], 120)
    }
    for (let y = 4; y < 14; y++) {
      const t = (y - 4) / 10
      rect(set, 0, y, 32, 1, shadeRGB([75, 175, 85], 1.15 - t * 0.4))
    }
    rect(set, 0, 4, 32, 3, [130, 210, 110])
    rect(set, 0, 12, 32, 3, [42, 115, 50])
    // Speckles inset from edges so abutting tiles don't invent a vertical joint.
    set(8, 8, [255, 255, 255])
    set(16, 7, [255, 160, 190])
    set(24, 9, [255, 220, 80])
    rect(set, 0, 36, 32, 3, [32, 22, 14], 255)
    rect(set, 0, 38, 32, 1, [20, 14, 10], 255)
  })

  // Seamless wood plank — horizontal grain only (vertical ticks read as tile seams).
  paint(scene, 'blk-wood', 32, 16, (set) => {
    for (let y = 0; y < 12; y++) {
      const t = y / 12
      rect(set, 0, y, 32, 1, shadeRGB([205, 145, 82], 1.1 - t * 0.28))
    }
    rect(set, 0, 0, 32, 2, [240, 195, 135])
    for (let y = 12; y < 16; y++) {
      const t = (y - 12) / 4
      rect(set, 0, y, 32, 1, shadeRGB([155, 100, 50], 1 - t * 0.3))
    }
    rect(set, 0, 11, 32, 2, [115, 70, 32])
    // Subtle horizontal fiber only — never vertical lines at tile joins.
    rect(set, 0, 4, 32, 1, [190, 130, 70], 90)
    rect(set, 0, 8, 32, 1, [170, 115, 60], 70)
    rect(set, 0, 14, 32, 2, [28, 18, 10], 160)
  })

  paint(scene, 'blk-stone', 32, 28, (set) => {
    for (let y = 8; y < 26; y++) {
      const t = (y - 8) / 18
      rect(set, 0, y, 32, 1, shadeRGB([155, 155, 162], 1.05 - t * 0.3))
    }
    for (let y = 2; y < 10; y++) {
      const t = (y - 2) / 8
      rect(set, 0, y, 32, 1, shadeRGB([190, 190, 198], 1.1 - t * 0.25))
    }
    rect(set, 0, 2, 32, 2, [230, 230, 238])
    rect(set, 2, 4, 2, 6, [245, 245, 250])
    rect(set, 6, 12, 10, 5, [118, 118, 128])
    rect(set, 7, 13, 3, 2, [180, 180, 190])
    rect(set, 0, 25, 32, 3, [36, 32, 36], 175)
  })


  // Woodland picnic arch (was torii) — oak posts + leafy beam, PD-forest vibe.
  paint(scene, 'prop-torii', 72, 80, (set) => {
    const ink: RGB = [18, 12, 10]
    rect(set, 8, 72, 56, 6, ink, 110)
    for (const ox of [12, 48]) {
      rect(set, ox - 1, 28, 12, 48, ink)
      for (let y = 29; y < 74; y++) {
        rect(set, ox, y, 10, 1, shadeRGB([120, 78, 42], 1.05 - (y - 29) / 90))
        rect(set, ox, y, 2, 1, [170, 120, 70])
        rect(set, ox + 8, y, 2, 1, [80, 50, 28])
      }
    }
    // leafy crossbeam
    rect(set, 2, 18, 68, 14, ink)
    rect(set, 4, 20, 64, 10, [55, 120, 55])
    rect(set, 4, 20, 64, 3, [95, 170, 80])
    rect(set, 4, 27, 64, 3, [35, 85, 40])
    // hanging picnic bunting
    for (let i = 0; i < 5; i++) {
      const cx = 12 + i * 12
      const c: RGB = i % 2 === 0 ? [240, 210, 90] : [230, 120, 90]
      rect(set, cx, 32, 8, 10, ink)
      rect(set, cx + 1, 33, 6, 8, c)
    }
  })

  paint(scene, 'prop-tree3d', 48, 72, (set) => {
    const ink: RGB = [16, 12, 14]
    rect(set, 10, 64, 28, 6, ink, 120)
    // trunk outline + fill
    rect(set, 19, 39, 12, 30, ink)
    for (let y = 40; y < 68; y++) {
      for (let x = 20; x < 30; x++) {
        const nx = (x - 24.5) / 5
        set(x, y, shadeRGB([115, 72, 42], 1.05 - nx * 0.35))
      }
    }
    const blobs: Array<[number, number, number, RGB]> = [
      [24, 28, 18, [38, 105, 52]],
      [16, 32, 14, [55, 140, 70]],
      [32, 30, 14, [70, 160, 85]],
      [24, 20, 12, [105, 195, 115]],
      [20, 24, 10, [90, 175, 100]],
    ]
    for (const [cx, cy, r] of blobs) {
      for (let y = -r - 1; y <= r + 1; y++)
        for (let x = -r - 1; x <= r + 1; x++)
          if (x * x + y * y <= (r + 1) * (r + 1)) set(cx + x, cy + y, ink)
    }
    for (const [cx, cy, r, c] of blobs) {
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r) {
            const lit = y < -3 ? 1.25 : y > 7 ? 0.68 : y < 2 ? 1.05 : 0.9
            set(cx + x, cy + y, shadeRGB(c, lit))
          }
    }
  })

  paint(scene, 'prop-house3d', 56, 56, (set) => {
    const ink: RGB = [18, 12, 14]
    rect(set, 8, 50, 40, 5, ink, 125)
    rect(set, 7, 23, 44, 30, ink)
    for (let i = 0; i < 17; i++) rect(set, 5 + i, 21 - i, 36 - i * 2, 3, ink)
    for (let y = 22; y < 52; y++) {
      const t = (y - 22) / 30
      rect(set, 36, y, 14, 1, shadeRGB([185, 125, 75], 1 - t * 0.2))
    }
    for (let y = 24; y < 52; y++) {
      const t = (y - 24) / 28
      rect(set, 8, y, 30, 1, shadeRGB([245, 200, 140], 1.05 - t * 0.25))
    }
    rect(set, 8, 24, 30, 3, [255, 235, 190])
    rect(set, 8, 24, 2, 28, [255, 245, 210])
    for (let i = 0; i < 16; i++) {
      const c: RGB = i < 3 ? [255, 150, 90] : i > 12 ? [160, 50, 38] : [215, 72, 50]
      rect(set, 6 + i, 22 - i, 34 - i * 2, 2, c)
      if (i < 14) set(7 + i, 22 - i, [255, 190, 130])
    }
    rect(set, 10, 40, 12, 12, [210, 48, 45])
    rect(set, 11, 41, 10, 3, [255, 200, 160])
    rect(set, 16, 34, 10, 10, [255, 240, 165])
    rect(set, 17, 35, 8, 8, [255, 252, 215])
    rect(set, 20, 35, 1, 8, [180, 140, 60])
    rect(set, 17, 39, 8, 1, [180, 140, 60])
    rect(set, 28, 38, 8, 14, [105, 62, 30])
    rect(set, 29, 38, 2, 14, [150, 95, 50])
  })

  // Hanging honey pot (was lantern) — picnic woodland prop.
  paint(scene, 'prop-lantern3d', 20, 36, (set) => {
    const ink: RGB = [18, 12, 10]
    rect(set, 2, 32, 16, 3, ink, 110)
    rect(set, 8, 2, 4, 12, [90, 70, 40])
    rect(set, 9, 2, 1, 12, [140, 110, 60])
    for (let y = 12; y < 32; y++) {
      for (let x = 3; x < 17; x++) {
        const nx = (x - 10) / 7
        const ny = (y - 22) / 9
        if (nx * nx + ny * ny <= 1) {
          set(x, y, ink)
          set(x, y, shadeRGB([220, 160, 50], 1.1 - ny * 0.25))
          if (ny < -0.3) set(x, y, [255, 210, 100])
        }
      }
    }
    rect(set, 5, 12, 10, 3, ink)
    rect(set, 6, 13, 8, 2, [160, 100, 40])
    set(10, 20, [255, 240, 160])
  })

  // Spike tile fills full width at base so stride=width leaves zero gap.
  paint(scene, 'blk-spike', 16, 24, (set) => {
    for (let y = 0; y < 20; y++) {
      const half = Math.max(0, Math.min(7, 7 - Math.floor(y / 2.6)))
      rect(set, 8 - half, y, 1 + half * 2, 1, y < 5 ? [240, 245, 255] : [140, 150, 165])
      if (half > 0) set(8 + half, y, [85, 95, 115])
      if (half > 0) set(8 - half, y, [200, 210, 225])
    }
    set(8, 1, [255, 255, 255])
    // Full-width opaque footing — abutting tiles share a continuous base.
    rect(set, 0, 18, 16, 6, [28, 28, 36], 255)
    rect(set, 0, 18, 16, 1, [60, 60, 72], 255)
  })


  paint(scene, 'crate3d', 28, 28, (set) => {
    rect(set, 3, 25, 22, 3, [18, 12, 10], 125)
    for (let y = 6; y < 26; y++) {
      const t = (y - 6) / 20
      rect(set, 4, y, 20, 1, shadeRGB([175, 115, 60], 1.05 - t * 0.25))
    }
    rect(set, 5, 7, 3, 18, [220, 170, 100])
    rect(set, 4, 6, 20, 3, [210, 160, 95])
    rect(set, 4, 14, 20, 2, [105, 65, 32])
    rect(set, 13, 6, 2, 20, [105, 65, 32])
    rect(set, 6, 8, 2, 2, [255, 230, 160])
  })

  // Graphic-pass pot: ink silhouette, lid highlight, honey glow band.
  paint(scene, 'pot3d', 32, 36, (set) => {
    const ink: RGB = [16, 10, 12]
    rect(set, 5, 32, 22, 3, ink, 130)
    // body outline
    for (let y = 12; y < 32; y++) {
      for (let x = 4; x < 28; x++) {
        const nx = (x - 16) / 11
        const ny = (y - 22) / 11
        if (nx * nx + ny * ny <= 1.05) set(x, y, ink)
      }
    }
    for (let y = 12; y < 32; y++) {
      for (let x = 5; x < 27; x++) {
        const nx = (x - 16) / 10
        const ny = (y - 22) / 10
        if (nx * nx + ny * ny < 1) {
          const lit = 1.2 - nx * 0.4 - (y > 26 ? 0.2 : 0)
          set(x, y, shadeRGB([235, 165, 48], lit))
        }
      }
    }
    rect(set, 10, 8, 12, 7, ink)
    rect(set, 11, 9, 10, 5, [255, 210, 95])
    rect(set, 11, 9, 10, 2, [255, 240, 170])
    rect(set, 12, 6, 8, 4, ink)
    rect(set, 13, 7, 6, 2, [255, 250, 210])
    rect(set, 8, 20, 16, 3, ink)
    rect(set, 9, 21, 14, 1, [255, 220, 120])
    set(13, 16, [255, 255, 230])
  })

  // Graphic-pass chest: wood panels, gold lock, rim light.
  paint(scene, 'chest3d', 36, 30, (set) => {
    const ink: RGB = [16, 10, 12]
    rect(set, 3, 26, 30, 3, ink, 130)
    rect(set, 3, 8, 30, 20, ink)
    for (let y = 14; y < 27; y++) {
      const t = (y - 14) / 13
      rect(set, 5, y, 26, 1, shadeRGB([175, 112, 55], 1.08 - t * 0.28))
    }
    rect(set, 5, 14, 26, 2, [230, 170, 95])
    rect(set, 4, 6, 28, 10, ink)
    rect(set, 5, 7, 26, 8, [195, 130, 62])
    rect(set, 5, 7, 26, 2, [245, 195, 120])
    rect(set, 5, 15, 2, 11, [240, 190, 120])
    rect(set, 16, 16, 5, 6, ink)
    rect(set, 17, 17, 3, 4, [255, 210, 70])
    set(18, 18, [255, 245, 180])
    rect(set, 5, 20, 26, 2, [110, 65, 30])
  })

  paint(scene, 'fan3d', 28, 28, (set) => {
    rect(set, 6, 24, 16, 3, [18, 12, 16], 105)
    rect(set, 11, 14, 6, 12, [70, 80, 100])
    rect(set, 12, 14, 2, 12, [125, 145, 175])
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const x = 14 + Math.cos(ang) * 8
      const y = 10 + Math.sin(ang) * 7
      rect(set, Math.floor(x), Math.floor(y), 3, 2, i % 2 ? [165, 245, 255] : [85, 205, 255])
    }
    rect(set, 12, 8, 4, 4, [235, 245, 255])
    set(8, 6, [255, 255, 180])
  })

  // Goal: tree with beehive (蜂巢) — not a shrine altar.
  paint(scene, 'goal3d', 56, 88, (set) => {
    const ink: RGB = [16, 10, 12]
    const bark: RGB = [110, 70, 40]
    const barkL: RGB = [160, 110, 60]
    const leaf: RGB = [60, 140, 70]
    const leafL: RGB = [110, 190, 90]
    const honey: RGB = [255, 200, 70]
    const honeyL: RGB = [255, 230, 140]
    // ground shadow
    rect(set, 10, 84, 36, 3, ink, 130)
    // trunk
    rect(set, 24, 40, 10, 44, ink)
    for (let y = 42; y < 82; y++) {
      rect(set, 25, y, 8, 1, shadeRGB(bark, 1.05 - (y - 42) / 90))
      rect(set, 25, y, 2, 1, barkL)
    }
    // canopy
    for (const [cx, cy, r] of [
      [28, 28, 18],
      [18, 34, 14],
      [40, 32, 15],
      [28, 18, 12],
    ] as const) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          const nx = (x - cx) / r
          const ny = (y - cy) / r
          if (nx * nx + ny * ny < 1) {
            if (nx * nx + ny * ny > 0.82) set(x, y, ink)
            else set(x, y, shadeRGB(leaf, 1.1 - nx * 0.25))
          }
        }
      }
      rect(set, cx - 4, cy - 4, 6, 5, leafL)
    }
    // beehive hanging from branch
    rect(set, 34, 36, 16, 3, ink)
    rect(set, 35, 37, 14, 1, barkL)
    for (let y = 40; y < 62; y++) {
      const t = (y - 40) / 22
      const half = Math.floor(7 - t * 2)
      rect(set, 42 - half - 1, y, half * 2 + 2, 1, ink)
      rect(set, 42 - half, y, half * 2, 1, shadeRGB(honey, 1.15 - t * 0.3))
    }
    rect(set, 38, 44, 8, 2, ink)
    rect(set, 39, 45, 6, 1, [40, 28, 16])
    set(41, 48, honeyL)
    set(45, 52, honeyL)
    // tiny bees
    set(32, 38, [255, 220, 40])
    set(50, 42, [255, 220, 40])
  })

  // Picnic basket (replaces shrine) — woodland Western picnic.
  paint(scene, 'prop-shrine', 40, 48, (set) => {
    const ink: RGB = [18, 12, 10]
    rect(set, 6, 44, 28, 3, ink, 110)
    // woven basket body
    rect(set, 6, 22, 28, 22, ink)
    for (let y = 23; y < 43; y++) {
      for (let x = 7; x < 33; x++) {
        const weave = ((x + y) % 4 === 0) ? [170, 120, 55] as RGB : [140, 95, 42] as RGB
        set(x, y, weave)
      }
    }
    rect(set, 7, 23, 26, 3, [200, 150, 80])
    // cloth lid
    rect(set, 8, 16, 24, 8, ink)
    rect(set, 9, 17, 22, 6, [240, 230, 200])
    rect(set, 9, 17, 22, 2, [255, 120, 110])
    // handle
    rect(set, 12, 8, 3, 12, ink)
    rect(set, 25, 8, 3, 12, ink)
    rect(set, 12, 6, 16, 4, ink)
    rect(set, 13, 7, 14, 2, [180, 130, 70])
  })

  // Checkered picnic blanket
  paint(scene, 'prop-picnic', 48, 20, (set) => {
    for (let y = 2; y < 18; y++) {
      for (let x = 2; x < 46; x++) {
        const c: RGB = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0)
          ? [240, 235, 220]
          : [210, 70, 70]
        set(x, y, c)
      }
    }
    rect(set, 2, 2, 44, 1, [18, 12, 10])
    rect(set, 2, 17, 44, 1, [18, 12, 10])
  })

  // Friendly owl silhouette (tree friend — original woodland, not a trademark design)
  paint(scene, 'prop-owl', 24, 28, (set) => {
    const ink: RGB = [18, 12, 10]
    for (let y = 6; y < 26; y++) {
      for (let x = 4; x < 20; x++) {
        const nx = (x - 12) / 8
        const ny = (y - 16) / 10
        if (nx * nx + ny * ny <= 1) {
          set(x, y, ink)
          set(x, y, shadeRGB([150, 110, 70], 1.05 - ny * 0.2))
        }
      }
    }
    // eyes
    rect(set, 7, 10, 4, 4, ink)
    rect(set, 13, 10, 4, 4, ink)
    rect(set, 8, 11, 2, 2, [255, 240, 180])
    rect(set, 14, 11, 2, 2, [255, 240, 180])
    set(9, 12, [40, 30, 20])
    set(15, 12, [40, 30, 20])
    // beak
    rect(set, 11, 14, 2, 2, [220, 150, 50])
    // ears
    rect(set, 6, 4, 3, 5, ink)
    rect(set, 15, 4, 3, 5, ink)
    rect(set, 7, 5, 1, 3, [170, 120, 70])
    rect(set, 16, 5, 1, 3, [170, 120, 70])
  })

  paint(scene, 'prop-honey-stack', 36, 40, (set) => {
    rect(set, 4, 36, 28, 3, [18, 12, 16], 115)
    const pots: Array<[number, number, number]> = [
      [10, 22, 0.95],
      [20, 20, 1],
      [15, 10, 0.9],
    ]
    for (const [cx, cy, s] of pots) {
      const rw = Math.floor(8 * s)
      const rh = Math.floor(10 * s)
      for (let y = cy; y < cy + rh; y++) {
        for (let x = cx - rw; x <= cx + rw; x++) {
          const nx = (x - cx) / rw
          const ny = (y - cy - rh / 2) / (rh / 2)
          if (nx * nx + ny * ny < 1.05) {
            set(x, y, shadeRGB([230, 160, 45], 1.1 - nx * 0.3))
          }
        }
      }
      rect(set, cx - 3, cy - 3, 6, 4, [255, 210, 90])
    }
  })

  // Evil elephant puppet — darker hide, red eyes, horns, spikes, heavy shadow.
  paint(scene, 'art-enemy-elephant', 56, 52, (set) => {
    const ink: RGB = [10, 4, 8]
    const hide: RGB = [62, 42, 72]
    const hideL: RGB = [95, 70, 105]
    const hideD: RGB = [38, 24, 48]
    const stripe: RGB = [190, 28, 48]
    const glow: RGB = [255, 40, 30]
    rect(set, 6, 48, 44, 3, ink, 155)
    for (let y = 16; y < 46; y++) {
      for (let x = 6; x < 42; x++) {
        const nx = (x - 24) / 17
        const ny = (y - 30) / 15
        if (nx * nx + ny * ny < 1) {
          if (nx * nx + ny * ny > 0.86) set(x, y, ink)
          else set(x, y, shadeRGB(hide, 1.1 - nx * 0.4))
        }
      }
    }
    for (const y of [20, 26, 32, 38]) {
      rect(set, 11, y, 22, 2, stripe)
      rect(set, 11, y, 22, 1, glow)
    }
    // spikes on back
    for (const [sx, sy] of [[14, 16], [20, 14], [26, 16]] as const) {
      rect(set, sx, sy, 3, 6, ink)
      set(sx + 1, sy, glow)
    }
    for (let y = 2; y < 24; y++) {
      for (let x = 30; x < 52; x++) {
        const nx = (x - 40) / 10
        const ny = (y - 13) / 10
        if (nx * nx + ny * ny < 1) {
          if (nx * nx + ny * ny > 0.82) set(x, y, ink)
          else set(x, y, shadeRGB(hideL, 1.15 - nx * 0.35))
        }
      }
    }
    // horns
    rect(set, 34, 0, 3, 8, ink)
    rect(set, 35, 1, 1, 6, [220, 200, 160])
    rect(set, 44, 0, 3, 8, ink)
    rect(set, 45, 1, 1, 6, [220, 200, 160])
    // ear
    rect(set, 24, 5, 10, 14, ink)
    rect(set, 25, 6, 8, 12, hideD)
    rect(set, 26, 8, 5, 8, [120, 30, 50])
    // evil brow + glowing eye
    rect(set, 35, 7, 10, 3, ink)
    rect(set, 37, 11, 6, 5, ink)
    rect(set, 38, 12, 4, 3, glow)
    set(40, 12, [255, 230, 80])
    // grin / fangs
    rect(set, 40, 18, 8, 3, ink)
    set(42, 19, [255, 245, 220])
    set(45, 19, [255, 245, 220])
    // tusks — trunk is a separate face-anchored weapon sprite (not painted here)
    rect(set, 46, 17, 3, 10, ink)
    rect(set, 47, 18, 1, 8, [255, 240, 200])
    // snout stump where the live trunk attaches
    rect(set, 44, 20, 5, 5, ink)
    rect(set, 45, 21, 3, 3, hide)
    rect(set, 10, 38, 8, 10, ink)
    rect(set, 11, 39, 6, 8, hideD)
    rect(set, 10, 46, 8, 2, [30, 16, 20])
    rect(set, 28, 38, 8, 10, ink)
    rect(set, 29, 39, 6, 8, hideD)
    rect(set, 28, 46, 8, 2, [30, 16, 20])
  })

  // Trunk frame 0 — curled windup
  paint(scene, 'fx-elephant-trunk-0', 18, 20, (set) => {
    const ink: RGB = [10, 4, 8]
    const hide: RGB = [90, 70, 105]
    rect(set, 5, 1, 9, 11, ink)
    rect(set, 6, 2, 7, 9, hide)
    rect(set, 2, 8, 7, 7, ink)
    rect(set, 3, 9, 5, 5, hide)
    rect(set, 1, 13, 6, 5, ink)
    rect(set, 2, 14, 4, 3, [70, 50, 85])
    set(3, 16, [255, 40, 30])
  })
  // Trunk frame 1 — fighter forward thrust, long tip (~1.5 body visual)
  paint(scene, 'fx-elephant-trunk-1', 56, 14, (set) => {
    const ink: RGB = [10, 4, 8]
    const hide: RGB = [90, 70, 105]
    const tip: RGB = [55, 35, 70]
    for (let x = 2; x < 50; x++) {
      const t = x / 50
      const thick = 2 + Math.floor((1 - t) * 4)
      rect(set, x, 7 - thick, 1, thick * 2, ink)
      rect(set, x, 8 - thick + 1, 1, Math.max(1, thick * 2 - 2), t > 0.8 ? tip : hide)
    }
    rect(set, 48, 3, 7, 8, ink)
    rect(set, 49, 4, 5, 6, tip)
    set(52, 6, [255, 50, 40])
  })

  // Ground sushi pickup — +2 HP when eaten
  paint(scene, 'pickup-sushi', 22, 14, (set) => {
    const ink: RGB = [28, 18, 12]
    const rice: RGB = [250, 246, 236]
    const riceD: RGB = [230, 220, 200]
    const fish: RGB = [255, 120, 110]
    const fishD: RGB = [220, 70, 70]
    const nori: RGB = [40, 70, 48]
    // plate / shadow
    rect(set, 2, 11, 18, 2, ink, 100)
    // rice mound
    rect(set, 4, 6, 14, 5, ink)
    rect(set, 5, 7, 12, 3, rice)
    set(6, 8, riceD)
    set(14, 8, riceD)
    // nori strip
    rect(set, 4, 9, 14, 1, nori)
    // fish sashimi on top
    rect(set, 5, 3, 12, 4, ink)
    rect(set, 6, 4, 10, 2, fish)
    set(8, 4, fishD)
    set(12, 4, [255, 200, 180])
    set(7, 5, fishD)
  })

  // Pack3 A-03: ambient bees — thin outline, readable bee detail (no combat)
  paint(scene, 'fx-ambient-bee', 16, 14, (set) => {
    const ink: RGB = [40, 28, 16]
    const gold: RGB = [250, 200, 50]
    const goldD: RGB = [210, 150, 30]
    const stripe: RGB = [36, 28, 18]
    const wing: RGB = [210, 235, 255]
    // thin body outline
    rect(set, 5, 5, 7, 5, ink)
    rect(set, 6, 6, 5, 3, gold)
    set(7, 6, stripe)
    set(9, 6, stripe)
    set(7, 7, goldD)
    set(8, 7, gold)
    set(9, 7, goldD)
    // head
    rect(set, 11, 5, 3, 3, ink)
    set(12, 6, gold)
    set(12, 5, [255, 250, 220])
    // antennae (1px thin)
    set(12, 3, ink)
    set(13, 2, ink)
    set(11, 3, ink)
    set(10, 2, ink)
    // wings thin
    set(4, 4, wing)
    set(3, 3, wing)
    set(5, 3, wing)
    set(10, 4, wing)
    set(11, 3, wing)
    set(9, 3, wing)
    // stinger tip
    set(5, 9, ink)
  })

  paint(scene, 'art-enemy-barrel', 40, 48, (set) => {
    rect(set, 6, 44, 28, 3, [18, 12, 16], 125)
    rect(set, 10, 36, 6, 10, [70, 48, 32])
    rect(set, 24, 36, 6, 10, [70, 48, 32])
    rect(set, 10, 44, 6, 2, [40, 28, 20])
    rect(set, 24, 44, 6, 2, [40, 28, 20])
    for (let y = 10; y < 38; y++) {
      for (let x = 6; x < 34; x++) {
        const nx = (x - 20) / 13
        const ny = (y - 24) / 15
        if (nx * nx + ny * ny < 1) {
          set(x, y, shadeRGB([168, 108, 58], 1.05 - nx * 0.35))
        }
      }
    }
    rect(set, 7, 14, 26, 2, [90, 70, 48])
    rect(set, 7, 24, 26, 2, [90, 70, 48])
    rect(set, 8, 33, 24, 2, [90, 70, 48])
    rect(set, 14, 16, 12, 10, [255, 220, 170])
    rect(set, 15, 17, 10, 8, [255, 236, 200])
    rect(set, 16, 19, 3, 3, [40, 24, 20])
    rect(set, 22, 19, 3, 3, [40, 24, 20])
    set(17, 19, [255, 80, 60])
    set(23, 19, [255, 80, 60])
    rect(set, 17, 24, 6, 2, [120, 50, 40])
    rect(set, 2, 22, 6, 5, [200, 150, 100])
    rect(set, 32, 22, 6, 5, [200, 150, 100])
    rect(set, 1, 20, 4, 4, [180, 120, 80])
    rect(set, 35, 20, 4, 4, [180, 120, 80])
    rect(set, 12, 8, 16, 4, [210, 150, 90])
    rect(set, 14, 7, 12, 2, [240, 190, 120])
  })

  // --- Sparse Goemon-like landmarks (unique volumetric sprites, not tile bands) ---
  registerLandmarkArt(scene)
}

/** Independent mountain / cloud landmarks: black outline + 3+ shade top-light. */
function registerLandmarkArt(scene: Phaser.Scene) {
  const ink: RGB = [22, 16, 20]

  /** Multi-lobe mountain: unique silhouette, black outline, 3+ shade top-light. */
  function paintPeak(
    key: string,
    w: number,
    h: number,
    lobes: Array<{ px: number; top: number; half: number }>,
    lit: RGB,
    mid: RGB,
    shade: RGB,
    snow = true,
  ) {
    paint(scene, key, w, h, (set) => {
      const baseY = h - 4
      const cover = (x: number, y: number) => {
        for (const L of lobes) {
          const t = (y - L.top) / Math.max(1, baseY - L.top)
          if (t < 0 || t > 1) continue
          const half = Math.max(1, Math.floor(L.half * t))
          if (Math.abs(x - L.px) <= half) return { L, t, half, nx: (x - L.px) / Math.max(1, half) }
        }
        return null
      }
      // contact shadow under widest base
      const minX = Math.min(...lobes.map((L) => L.px - L.half))
      const maxX = Math.max(...lobes.map((L) => L.px + L.half))
      rect(set, minX + 4, h - 5, maxX - minX - 8, 4, ink, 90)
      // outline
      for (let y = 0; y < baseY; y++) {
        for (let x = 0; x < w; x++) {
          if (!cover(x, y)) continue
          if (!cover(x - 1, y) || !cover(x + 1, y) || !cover(x, y - 1) || !cover(x, y + 1)) {
            set(x, y, ink)
          }
        }
      }
      // fill
      for (let y = 0; y < baseY; y++) {
        for (let x = 0; x < w; x++) {
          const hit = cover(x, y)
          if (!hit) continue
          if (!cover(x - 1, y) || !cover(x + 1, y) || !cover(x, y - 1) || !cover(x, y + 1)) continue
          let c = mid
          if (hit.t < 0.16) c = lit
          else if (hit.t > 0.7) c = shade
          else if (hit.nx < -0.35) c = lit
          else if (hit.nx > 0.42) c = shade
          const ridge = Math.abs(hit.nx) < 0.1 && hit.t < 0.5 ? 1.14 : 1
          set(x, y, shadeRGB(c, ridge - hit.t * 0.1))
        }
      }
      if (snow) {
        for (const L of lobes) {
          const snowH = Math.max(5, Math.floor((baseY - L.top) * 0.18))
          for (let y = L.top; y < L.top + snowH; y++) {
            const t = (y - L.top) / Math.max(1, baseY - L.top)
            const half = Math.max(1, Math.floor(L.half * t) - 1)
            for (let x = L.px - half; x <= L.px + half; x++) {
              if (!cover(x, y)) continue
              const st = (y - L.top) / snowH
              set(x, y, shadeRGB([248, 252, 255], 1.05 - st * 0.2))
            }
          }
        }
      }
    })
  }

  // Four unique mountains — one dominant peak each (optional tiny shoulder), never a cone strip
  paintPeak(
    'lm-mount-1',
    100,
    86,
    [
      { px: 58, top: 8, half: 40 },
      { px: 28, top: 36, half: 16 }, // tiny left shoulder only
    ],
    [150, 190, 175],
    [110, 155, 145],
    [70, 110, 115],
  )
  paintPeak(
    'lm-mount-2',
    120,
    96,
    [{ px: 60, top: 4, half: 54 }],
    [165, 185, 200],
    [120, 150, 165],
    [75, 105, 125],
  )
  paintPeak(
    'lm-mount-3',
    84,
    70,
    [{ px: 42, top: 10, half: 36 }],
    [130, 185, 120],
    [85, 150, 95],
    [45, 105, 70],
    false,
  )
  paintPeak(
    'lm-mount-4',
    108,
    84,
    [
      { px: 52, top: 6, half: 44 },
      { px: 86, top: 34, half: 18 }, // tiny right shoulder
    ],
    [145, 175, 130],
    [95, 145, 105],
    [55, 100, 75],
  )

  function paintCloud(
    key: string,
    w: number,
    h: number,
    blobs: Array<[number, number, number]>,
  ) {
    paint(scene, key, w, h, (set) => {
      for (const [cx, cy, r] of blobs) {
        for (let y = -r - 1; y <= r + 1; y++)
          for (let x = -r - 1; x <= r + 1; x++)
            if (x * x + y * y <= (r + 1) * (r + 1)) set(cx + x, cy + y, ink)
      }
      for (const [cx, cy, r] of blobs) {
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            if (x * x + y * y > r * r) continue
            const lit = y < -r * 0.35 ? 1.18 : y > r * 0.35 ? 0.78 : 1
            const c: RGB = y < -2 ? [255, 255, 255] : y > 4 ? [215, 222, 235] : [242, 246, 252]
            set(cx + x, cy + y, shadeRGB(c, lit))
          }
        }
      }
    })
  }

  // Three unique cloud shapes — place up to 6 with flip/scale
  paintCloud('lm-cloud-1', 64, 40, [
    [18, 22, 10],
    [32, 16, 13],
    [48, 22, 11],
    [28, 26, 9],
  ])
  paintCloud('lm-cloud-2', 72, 36, [
    [16, 20, 9],
    [30, 14, 12],
    [46, 18, 11],
    [58, 22, 8],
    [36, 24, 8],
  ])
  paintCloud('lm-cloud-3', 56, 32, [
    [14, 18, 9],
    [28, 14, 11],
    [42, 18, 10],
    [24, 22, 7],
  ])
}
