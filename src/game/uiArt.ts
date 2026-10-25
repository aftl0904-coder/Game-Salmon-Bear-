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

function circ(
  set: (x: number, y: number, c: RGB, a?: number) => void,
  cx: number,
  cy: number,
  r: number,
  c: RGB,
  a = 255,
) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) set(cx + x, cy + y, c, a)
    }
  }
}

/**
 * Ganbare Goemon SNES-style UI chrome:
 * warm wood panels, gold trim, parchment plaques, portrait boxes, koban coins.
 */
export function registerUiArt(scene: Phaser.Scene) {
  const wood: RGB = [168, 108, 58]
  const woodD: RGB = [112, 68, 34]
  const woodL: RGB = [214, 158, 96]
  const woodGrain: RGB = [140, 88, 44]
  const gold: RGB = [236, 186, 58]
  const goldL: RGB = [255, 230, 140]
  const goldD: RGB = [180, 120, 36]
  const parchment: RGB = [248, 228, 176]
  const parchmentD: RGB = [220, 190, 130]
  const redLacquer: RGB = [196, 48, 42]

  // Big title plaque (wood outer + gold rim + parchment face)
  paint(scene, 'ui-title-plaque', 420, 110, (set) => {
    rect(set, 8, 10, 404, 90, woodD)
    rect(set, 14, 14, 392, 82, wood)
    rect(set, 18, 18, 384, 74, goldD)
    rect(set, 22, 22, 376, 66, gold)
    rect(set, 26, 26, 368, 58, parchment)
    rect(set, 26, 26, 368, 6, parchmentD)
    rect(set, 26, 78, 368, 6, [200, 170, 110])
    // lacquer corner stamps
    rect(set, 30, 30, 18, 10, redLacquer)
    rect(set, 372, 30, 18, 10, redLacquer)
    rect(set, 30, 70, 18, 10, redLacquer)
    rect(set, 372, 70, 18, 10, redLacquer)
    for (let x = 40; x < 380; x += 6) set(x, 50 + ((x * 3) % 5), [230, 210, 150])
  })

  // Menu wood panel with gold inner frame
  paint(scene, 'ui-wood-panel', 360, 64, (set) => {
    rect(set, 0, 0, 360, 64, woodD)
    rect(set, 4, 4, 352, 56, wood)
    rect(set, 8, 8, 344, 48, goldD)
    rect(set, 11, 11, 338, 42, parchment)
    rect(set, 11, 11, 338, 4, goldL)
    rect(set, 11, 49, 338, 4, parchmentD)
    for (let x = 20; x < 340; x += 14) {
      rect(set, x, 0, 2, 64, woodGrain)
      set(x + 3, 20, woodL)
    }
  })

  // Selected menu panel (brighter gold)
  paint(scene, 'ui-wood-panel-on', 360, 64, (set) => {
    rect(set, 0, 0, 360, 64, goldD)
    rect(set, 4, 4, 352, 56, gold)
    rect(set, 8, 8, 344, 48, goldL)
    rect(set, 12, 12, 336, 40, [255, 244, 200])
    rect(set, 12, 12, 336, 5, [255, 250, 220])
    rect(set, 16, 16, 12, 8, redLacquer)
    rect(set, 332, 16, 12, 8, redLacquer)
  })

  // Portrait frame box (Goemon HUD face windows)
  paint(scene, 'ui-portrait', 44, 44, (set) => {
    rect(set, 0, 0, 44, 44, woodD)
    rect(set, 2, 2, 40, 40, gold)
    rect(set, 5, 5, 34, 34, [40, 56, 72])
    rect(set, 5, 5, 34, 3, goldL)
    rect(set, 5, 36, 34, 3, woodD)
    set(8, 8, [255, 240, 180])
  })

  // Top HUD wood strip tile
  paint(scene, 'ui-hud-wood', 64, 56, (set) => {
    for (let y = 0; y < 56; y++) {
      const t = y / 56
      const c: RGB = [
        Math.floor(150 + t * 20),
        Math.floor(92 + t * 10),
        Math.floor(48 + t * 6),
      ]
      rect(set, 0, y, 64, 1, c)
    }
    rect(set, 0, 0, 64, 3, goldL)
    rect(set, 0, 53, 64, 3, woodD)
    for (let x = 8; x < 64; x += 16) rect(set, x, 0, 2, 56, woodGrain)
  })

  // Decorative gold corner
  paint(scene, 'ui-corner', 28, 28, (set) => {
    rect(set, 0, 0, 28, 6, gold)
    rect(set, 0, 0, 6, 28, gold)
    rect(set, 2, 2, 20, 3, goldL)
    rect(set, 2, 2, 3, 20, goldL)
    circ(set, 10, 10, 4, redLacquer)
    circ(set, 10, 10, 2, goldL)
  })

  // Stage name banner (centered scroll — Goemon in-game title ribbon)
  paint(scene, 'ui-stage-banner', 340, 48, (set) => {
    // rolled ends
    rect(set, 0, 6, 22, 36, wood)
    rect(set, 2, 8, 18, 32, woodD)
    rect(set, 318, 6, 22, 36, wood)
    rect(set, 320, 8, 18, 32, woodD)
    // parchment body
    rect(set, 20, 8, 300, 32, parchment)
    rect(set, 20, 8, 300, 4, goldL)
    rect(set, 20, 36, 300, 4, parchmentD)
    rect(set, 22, 10, 296, 2, gold)
    rect(set, 22, 36, 296, 2, goldD)
    for (let x = 30; x < 310; x += 7) set(x, 40, [70, 140, 190])
  })

  // Fallback coin — salmon emblem (BootScene may replace with cel PNG).
  paint(scene, 'coin', 16, 16, (set) => {
    const ink: RGB = [18, 12, 8]
    const rim: RGB = [180, 110, 30]
    const face: RGB = [255, 210, 70]
    const hi: RGB = [255, 245, 180]
    const fish: RGB = [230, 120, 45]
    circ(set, 8, 8, 7, ink)
    circ(set, 8, 8, 6, rim)
    circ(set, 8, 8, 5, face)
    circ(set, 6, 6, 2, hi)
    rect(set, 4, 7, 7, 3, fish)
    rect(set, 10, 6, 2, 2, fish)
    rect(set, 10, 9, 2, 2, fish)
    set(5, 8, hi)
  })

  // Compact heart pip (10-unit life meter like Goemon life blocks)
  paint(scene, 'pip-full', 9, 10, (set) => {
    rect(set, 1, 2, 3, 3, [230, 48, 64])
    rect(set, 5, 2, 3, 3, [230, 48, 64])
    rect(set, 2, 4, 5, 4, [230, 48, 64])
    rect(set, 3, 7, 3, 2, [200, 36, 48])
    set(2, 3, [255, 190, 190])
  })
  paint(scene, 'pip-empty', 9, 10, (set) => {
    rect(set, 1, 2, 3, 3, [55, 36, 32])
    rect(set, 5, 2, 3, 3, [55, 36, 32])
    rect(set, 2, 4, 5, 4, [55, 36, 32])
    rect(set, 3, 7, 3, 2, [40, 28, 24])
  })

  // Score plate
  paint(scene, 'ui-score-plate', 120, 28, (set) => {
    rect(set, 0, 0, 120, 28, woodD)
    rect(set, 2, 2, 116, 24, wood)
    rect(set, 4, 4, 112, 20, [36, 24, 18])
    rect(set, 4, 4, 112, 3, gold)
    rect(set, 6, 6, 8, 4, redLacquer)
  })

  // Pointy select cursor (leaf / arrow)
  paint(scene, 'ui-cursor', 20, 18, (set) => {
    for (let i = 0; i < 9; i++) {
      rect(set, 2 + i, 8 - Math.floor(i / 2), 1, 2 + i, i < 4 ? goldL : gold)
    }
    rect(set, 2, 7, 8, 4, redLacquer)
  })

  // Soft town sky gradient strip
  paint(scene, 'ui-sky-wash', 64, 64, (set) => {
    for (let y = 0; y < 64; y++) {
      const t = y / 64
      rect(set, 0, y, 64, 1, [
        Math.floor(120 + t * 40),
        Math.floor(190 + t * 20),
        Math.floor(230 - t * 30),
      ])
    }
  })

  // Leafy vine curtain (was noren) — woodland menu frame
  paint(scene, 'ui-noren', 48, 80, (set) => {
    rect(set, 0, 0, 48, 10, woodD)
    rect(set, 2, 2, 44, 6, [90, 140, 70])
    for (let y = 10; y < 80; y++) {
      for (let x = 4; x < 44; x++) {
        const wave = Math.sin(y * 0.2 + x * 0.15)
        if ((x + y) % 5 === 0 || wave > 0.55) {
          set(x, y, [40, 100, 50])
          if (wave > 0.75) set(x, y, [90, 160, 70])
        }
      }
    }
    rect(set, 14, 28, 20, 10, parchment)
    rect(set, 16, 30, 16, 6, [180, 140, 60])
  })
}
