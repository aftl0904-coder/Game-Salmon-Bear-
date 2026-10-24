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

/** Faux-3D SNES/PS1-lite props: beveled blocks + soft contact shadows */
export function registerIsoArt(scene: Phaser.Scene) {
  // soft oval contact shadow under any prop/character
  paint(scene, 'shad', 64, 20, (set) => {
    const cx = 32
    const cy = 10
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 64; x++) {
        const nx = (x - cx) / 30
        const ny = (y - cy) / 8
        const d = nx * nx + ny * ny
        if (d < 1) set(x, y, [18, 14, 22], Math.floor((1 - d) * 130))
      }
    }
  })

  // 3D grass cliff block (top / front / side)
  paint(scene, 'blk-grass', 40, 44, (set) => {
    // side face (right)
    rect(set, 28, 14, 12, 26, [96, 64, 38])
    rect(set, 28, 14, 12, 3, [120, 84, 50])
    // front face
    rect(set, 2, 16, 28, 26, [130, 86, 52])
    for (let y = 18; y < 40; y += 3) rect(set, 4, y, 24, 1, [110, 72, 42])
    // top grass plane (isometric-ish)
    rect(set, 0, 6, 30, 12, [70, 168, 78])
    rect(set, 2, 6, 26, 3, [120, 200, 100])
    rect(set, 0, 14, 30, 3, [48, 120, 55])
    // bevel highlight
    rect(set, 1, 7, 2, 10, [160, 220, 130])
    // flower dots
    set(8, 10, [255, 255, 255])
    set(18, 9, [255, 160, 190])
    // bottom shadow lip
    rect(set, 2, 40, 36, 3, [40, 28, 18], 180)
  })

  // 3D wood platform plank
  paint(scene, 'blk-wood', 40, 22, (set) => {
    // top
    rect(set, 0, 2, 34, 10, [198, 138, 78])
    rect(set, 0, 2, 34, 2, [230, 180, 120])
    // front
    rect(set, 0, 12, 34, 8, [150, 96, 48])
    rect(set, 0, 12, 34, 2, [120, 74, 34])
    // side
    rect(set, 34, 4, 6, 14, [110, 70, 34])
    // nails
    set(8, 6, [70, 70, 80])
    set(24, 6, [70, 70, 80])
    // contact shade
    rect(set, 2, 19, 36, 2, [30, 20, 12], 160)
  })

  // 3D stone block
  paint(scene, 'blk-stone', 36, 36, (set) => {
    rect(set, 26, 10, 10, 22, [100, 100, 108])
    rect(set, 2, 12, 26, 22, [148, 148, 156])
    rect(set, 0, 4, 28, 10, [180, 180, 188])
    rect(set, 0, 4, 28, 2, [220, 220, 230])
    rect(set, 4, 16, 10, 6, [120, 120, 130])
    rect(set, 2, 32, 32, 3, [40, 36, 40], 170)
  })

  // 3D torii post chunk
  paint(scene, 'prop-torii', 72, 80, (set) => {
    // shadow under
    rect(set, 8, 72, 56, 6, [20, 16, 20], 100)
    // pillars with cylinder shading
    for (const ox of [12, 48]) {
      rect(set, ox, 28, 10, 46, [180, 60, 50])
      rect(set, ox, 28, 3, 46, [220, 100, 80])
      rect(set, ox + 7, 28, 3, 46, [120, 36, 30])
    }
    // beams (top slabs)
    rect(set, 4, 18, 64, 10, [200, 70, 55])
    rect(set, 4, 18, 64, 3, [240, 120, 90])
    rect(set, 0, 10, 72, 10, [190, 55, 45])
    rect(set, 0, 10, 72, 3, [255, 140, 100])
  })

  // 3D tree
  paint(scene, 'prop-tree3d', 48, 72, (set) => {
    rect(set, 10, 64, 28, 6, [20, 16, 18], 110)
    // trunk cylinder
    rect(set, 20, 40, 10, 28, [110, 70, 40])
    rect(set, 20, 40, 3, 28, [150, 100, 60])
    rect(set, 27, 40, 3, 28, [80, 50, 28])
    // canopy spheres layered
    const blobs: Array<[number, number, number, RGB]> = [
      [24, 28, 18, [40, 110, 55]],
      [16, 32, 14, [55, 140, 70]],
      [32, 30, 14, [70, 160, 85]],
      [24, 20, 12, [100, 190, 110]],
    ]
    for (const [cx, cy, r, c] of blobs) {
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r) {
            const lit = y < -2 ? 1.15 : y > 6 ? 0.75 : 1
            set(cx + x, cy + y, [
              Math.min(255, Math.floor(c[0] * lit)),
              Math.min(255, Math.floor(c[1] * lit)),
              Math.min(255, Math.floor(c[2] * lit)),
            ])
          }
    }
  })

  // 3D house
  paint(scene, 'prop-house3d', 56, 56, (set) => {
    rect(set, 8, 50, 40, 5, [20, 16, 18], 120)
    // side wall
    rect(set, 36, 22, 14, 30, [160, 110, 70])
    // front
    rect(set, 8, 24, 30, 28, [210, 160, 100])
    rect(set, 8, 24, 30, 3, [240, 200, 140])
    // roof prism
    for (let i = 0; i < 16; i++) {
      rect(set, 6 + i, 22 - i, 34 - i * 2, 2, i < 4 ? [240, 120, 70] : [190, 80, 50])
    }
    // window lit
    rect(set, 16, 34, 10, 10, [255, 230, 140])
    rect(set, 17, 35, 8, 8, [255, 250, 200])
    // door
    rect(set, 28, 38, 8, 14, [100, 60, 30])
  })

  // 3D lantern
  paint(scene, 'prop-lantern3d', 20, 36, (set) => {
    rect(set, 2, 32, 16, 3, [20, 16, 18], 100)
    rect(set, 8, 18, 4, 16, [90, 90, 100])
    rect(set, 4, 8, 12, 12, [255, 170, 70])
    rect(set, 5, 9, 10, 4, [255, 220, 140])
    rect(set, 6, 6, 8, 3, [200, 200, 210])
  })

  // 3D spike
  paint(scene, 'blk-spike', 28, 28, (set) => {
    for (let i = 0; i < 3; i++) {
      const ox = 2 + i * 9
      for (let y = 0; y < 22; y++) {
        const half = Math.max(0, 3 - Math.floor(y / 5))
        rect(set, ox + 3 - half, y, 1 + half * 2, 1, y < 6 ? [240, 245, 255] : [140, 150, 165])
        if (half > 0) set(ox + 3 + half, y, [90, 100, 120])
      }
    }
    rect(set, 2, 24, 24, 3, [30, 30, 40], 150)
  })

  // 3D honey pot
  paint(scene, 'pot3d', 28, 32, (set) => {
    rect(set, 4, 28, 20, 3, [20, 16, 18], 110)
    // body ellipse shading
    for (let y = 10; y < 28; y++) {
      for (let x = 5; x < 23; x++) {
        const nx = (x - 14) / 9
        const ny = (y - 19) / 9
        if (nx * nx + ny * ny < 1) {
          const lit = 1.1 - nx * 0.25
          set(x, y, [
            Math.min(255, Math.floor(220 * lit)),
            Math.min(255, Math.floor(150 * lit)),
            Math.min(255, Math.floor(40 * lit)),
          ])
        }
      }
    }
    rect(set, 9, 6, 10, 6, [255, 200, 80])
    rect(set, 10, 4, 8, 3, [255, 230, 140])
    set(12, 14, [255, 240, 180])
  })

  // electric fan 3D
  paint(scene, 'fan3d', 28, 28, (set) => {
    rect(set, 6, 24, 16, 3, [20, 16, 18], 100)
    rect(set, 11, 14, 6, 12, [70, 80, 100])
    rect(set, 12, 14, 2, 12, [120, 140, 170])
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const x = 14 + Math.cos(ang) * 8
      const y = 10 + Math.sin(ang) * 7
      rect(set, Math.floor(x), Math.floor(y), 3, 2, i % 2 ? [160, 240, 255] : [80, 200, 255])
    }
    rect(set, 12, 8, 4, 4, [230, 240, 255])
    set(8, 6, [255, 255, 180])
  })

  // goal shrine 3D
  paint(scene, 'goal3d', 48, 72, (set) => {
    rect(set, 6, 66, 36, 5, [20, 16, 18], 120)
    rect(set, 10, 30, 8, 38, [200, 60, 50])
    rect(set, 11, 30, 2, 38, [255, 120, 90])
    rect(set, 30, 30, 8, 38, [200, 60, 50])
    rect(set, 31, 30, 2, 38, [255, 120, 90])
    rect(set, 4, 22, 40, 10, [220, 70, 55])
    rect(set, 4, 22, 40, 3, [255, 140, 100])
    rect(set, 0, 14, 48, 10, [200, 55, 45])
    rect(set, 0, 14, 48, 3, [255, 150, 110])
    rect(set, 18, 36, 12, 24, [236, 186, 58])
    rect(set, 19, 37, 10, 6, [255, 236, 140])
  })

  // 木桶武者 — Round-1 type B (hop/lunge); silhouette distinct from fish
  paint(scene, 'art-enemy-barrel', 40, 48, (set) => {
    rect(set, 6, 44, 28, 3, [20, 14, 18], 120)
    rect(set, 10, 36, 6, 10, [70, 48, 32])
    rect(set, 24, 36, 6, 10, [70, 48, 32])
    rect(set, 10, 44, 6, 2, [40, 28, 20])
    rect(set, 24, 44, 6, 2, [40, 28, 20])
    for (let y = 10; y < 38; y++) {
      for (let x = 6; x < 34; x++) {
        const nx = (x - 20) / 13
        const ny = (y - 24) / 15
        if (nx * nx + ny * ny < 1) {
          const lit = 1.05 - nx * 0.35
          set(x, y, [
            Math.min(255, Math.floor(168 * lit)),
            Math.min(255, Math.floor(108 * lit)),
            Math.min(255, Math.floor(58 * lit)),
          ])
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
}
