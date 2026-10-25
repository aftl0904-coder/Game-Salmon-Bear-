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


  paint(scene, 'prop-torii', 72, 80, (set) => {
    const ink: RGB = [18, 10, 12]
    rect(set, 8, 72, 56, 6, ink, 110)
    // black silhouette posts + beams
    for (const ox of [11, 47]) rect(set, ox - 1, 27, 12, 48, ink)
    rect(set, 0, 9, 72, 12, ink)
    rect(set, 3, 17, 66, 12, ink)
    for (const ox of [12, 48]) {
      for (let y = 28; y < 74; y++) {
        rect(set, ox, y, 10, 1, [175, 55, 48])
        rect(set, ox, y, 3, 1, [230, 110, 85])
        rect(set, ox + 7, y, 3, 1, [110, 32, 28])
      }
      rect(set, ox - 2, 70, 14, 4, [140, 140, 148])
      rect(set, ox - 2, 70, 14, 1, [190, 190, 200])
    }
    rect(set, 0, 10, 72, 10, [185, 50, 42])
    rect(set, 0, 10, 72, 3, [255, 145, 105])
    rect(set, 0, 17, 72, 3, [120, 30, 28])
    rect(set, 4, 18, 64, 10, [205, 68, 52])
    rect(set, 4, 18, 64, 3, [245, 125, 95])
    rect(set, 4, 25, 64, 3, [140, 40, 35])
    rect(set, 30, 28, 12, 10, [240, 220, 160])
    rect(set, 31, 29, 10, 8, [255, 240, 190])
    rect(set, 33, 31, 6, 4, [180, 50, 40])
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

  paint(scene, 'prop-lantern3d', 20, 36, (set) => {
    rect(set, 2, 32, 16, 3, [18, 12, 16], 110)
    rect(set, 8, 18, 4, 16, [85, 85, 95])
    rect(set, 9, 18, 1, 16, [130, 130, 145])
    for (let y = 8; y < 20; y++) {
      for (let x = 4; x < 16; x++) {
        const nx = (x - 10) / 6
        const ny = (y - 14) / 6
        if (nx * nx + ny * ny < 1.1) {
          set(x, y, shadeRGB([255, 175, 75], 1.15 - Math.abs(nx) * 0.3))
        }
      }
    }
    rect(set, 5, 9, 10, 3, [255, 230, 150])
    rect(set, 6, 6, 8, 3, [210, 210, 220])
    rect(set, 6, 18, 8, 2, [180, 180, 190])
    set(7, 11, [255, 255, 220])
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

  // Graphic-pass altar: red pillars, gold honey jar, ink frame.
  paint(scene, 'goal3d', 52, 76, (set) => {
    const ink: RGB = [16, 10, 12]
    rect(set, 6, 70, 40, 5, ink, 140)
    for (const ox of [8, 34]) {
      rect(set, ox - 1, 28, 12, 44, ink)
      for (let y = 30; y < 70; y++) {
        rect(set, ox, y, 10, 1, shadeRGB([210, 55, 48], 1.05 - (y - 30) / 80))
        rect(set, ox, y, 3, 1, [255, 140, 105])
        rect(set, ox + 7, y, 3, 1, [130, 28, 28])
      }
    }
    rect(set, 2, 20, 48, 12, ink)
    rect(set, 3, 21, 46, 10, [220, 68, 52])
    rect(set, 3, 21, 46, 3, [255, 155, 115])
    rect(set, 3, 28, 46, 3, [140, 35, 32])
    rect(set, 0, 12, 52, 12, ink)
    rect(set, 1, 13, 50, 10, [200, 50, 42])
    rect(set, 1, 13, 50, 3, [255, 160, 120])
    rect(set, 1, 20, 50, 3, [120, 28, 26])
    for (let y = 38; y < 64; y++) {
      for (let x = 20; x < 32; x++) {
        const nx = (x - 26) / 6
        set(x, y, shadeRGB([240, 190, 60], 1.15 - nx * 0.3))
      }
    }
    rect(set, 19, 37, 14, 8, ink)
    rect(set, 20, 38, 12, 6, [255, 236, 145])
    set(23, 40, [255, 252, 210])
    rect(set, 22, 34, 8, 5, ink)
    rect(set, 23, 35, 6, 3, [255, 210, 80])
  })

  paint(scene, 'prop-shrine', 40, 48, (set) => {
    rect(set, 6, 44, 28, 3, [18, 12, 16], 110)
    rect(set, 10, 34, 20, 12, [150, 150, 158])
    rect(set, 10, 34, 20, 2, [200, 200, 210])
    rect(set, 12, 36, 16, 8, [120, 120, 130])
    for (let i = 0; i < 10; i++) {
      rect(set, 6 + i, 28 - i, 28 - i * 2, 2, i < 3 ? [255, 140, 90] : [200, 60, 48])
    }
    rect(set, 16, 18, 8, 10, [255, 190, 80])
    rect(set, 17, 19, 6, 4, [255, 230, 150])
    rect(set, 14, 16, 12, 3, [180, 180, 190])
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

  // Pack3: elephant puppet (replaces bee combat look)
  paint(scene, 'art-enemy-elephant', 48, 44, (set) => {
    const ink: RGB = [18, 12, 14]
    rect(set, 8, 40, 32, 3, ink, 130)
    // body
    for (let y = 14; y < 40; y++) {
      for (let x = 8; x < 40; x++) {
        const nx = (x - 24) / 15
        const ny = (y - 27) / 13
        if (nx * nx + ny * ny < 1) {
          if (nx * nx + ny * ny > 0.82) set(x, y, ink)
          else set(x, y, shadeRGB([160, 160, 168], 1.1 - nx * 0.3))
        }
      }
    }
    // head
    for (let y = 6; y < 22; y++) {
      for (let x = 28; x < 46; x++) {
        const nx = (x - 36) / 8
        const ny = (y - 14) / 8
        if (nx * nx + ny * ny < 1) {
          if (nx * nx + ny * ny > 0.8) set(x, y, ink)
          else set(x, y, shadeRGB([175, 175, 182], 1.15 - nx * 0.25))
        }
      }
    }
    // trunk
    rect(set, 40, 18, 6, 14, ink)
    rect(set, 41, 19, 4, 12, [150, 150, 158])
    // ear
    rect(set, 26, 8, 8, 10, ink)
    rect(set, 27, 9, 6, 8, [140, 140, 150])
    // eye
    rect(set, 34, 12, 3, 3, ink)
    set(35, 12, [255, 240, 200])
    // legs
    rect(set, 12, 34, 6, 8, ink)
    rect(set, 13, 35, 4, 6, [130, 130, 140])
    rect(set, 30, 34, 6, 8, ink)
    rect(set, 31, 35, 4, 6, [130, 130, 140])
  })

  // Elephant trunk tip — used as extendable nose weapon
  paint(scene, 'fx-elephant-trunk', 28, 12, (set) => {
    const ink: RGB = [18, 12, 14]
    const grey: RGB = [150, 150, 158]
    const greyD: RGB = [120, 120, 128]
    for (let x = 2; x < 26; x++) {
      const t = x / 26
      const thick = 2 + Math.floor((1 - t) * 3)
      rect(set, x, 6 - thick, 1, thick * 2, ink)
      rect(set, x, 7 - thick + 1, 1, Math.max(1, thick * 2 - 2), t > 0.7 ? greyD : grey)
    }
    rect(set, 24, 4, 3, 4, ink)
    rect(set, 25, 5, 2, 2, grey)
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
