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
) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c)
}

function circ(
  set: (x: number, y: number, c: RGB, a?: number) => void,
  cx: number,
  cy: number,
  r: number,
  c: RGB,
) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) set(cx + x, cy + y, c)
    }
  }
}

/** Richer SNES riverside tiles */
export function registerTiles(scene: Phaser.Scene) {
  const dirt: RGB = [132, 86, 52]
  const dirtD: RGB = [92, 56, 34]
  const dirtL: RGB = [158, 110, 70]
  const grass: RGB = [72, 176, 82]
  const grassD: RGB = [48, 130, 60]
  const grassL: RGB = [130, 214, 110]
  const rock: RGB = [118, 116, 108]
  const rockL: RGB = [158, 156, 148]
  const rockD: RGB = [78, 76, 70]
  const wood: RGB = [178, 118, 62]
  const woodD: RGB = [124, 78, 38]
  const woodL: RGB = [210, 160, 100]
  const spike: RGB = [230, 236, 242]
  const spikeD: RGB = [140, 150, 160]
  const water: RGB = [56, 152, 210]
  const waterL: RGB = [160, 220, 245]
  const waterD: RGB = [30, 100, 160]
  const gold: RGB = [236, 186, 58]
  const goldL: RGB = [255, 236, 140]
  const red: RGB = [210, 64, 52]
  const redD: RGB = [150, 36, 36]
  const parchment: RGB = [242, 220, 168]
  const ink: RGB = [50, 30, 18]
  const flowerW: RGB = [255, 252, 245]
  const flowerP: RGB = [255, 160, 190]
  const hit: RGB = [255, 248, 220]
  const spray: RGB = [130, 210, 250]

  paint(scene, 'til-grass', 32, 48, (set) => {
    rect(set, 0, 12, 32, 28, dirt)
    for (let i = 0; i < 32; i += 4) rect(set, i, 16, 2, 22, dirtD)
    rect(set, 6, 20, 8, 6, dirtL)
    rect(set, 0, 0, 32, 14, grass)
    rect(set, 0, 10, 32, 4, grassD)
    for (let x = 0; x < 32; x += 2) {
      set(x, 1, grassL)
      set(x + 1, 3, grassL)
    }
    // tufts
    set(4, 0, grassD)
    set(5, 0, grass)
    set(12, 0, grassD)
    set(20, 0, grassD)
    set(27, 0, grassD)
    set(8, 4, flowerW)
    set(9, 4, flowerW)
    set(8, 5, flowerP)
    set(22, 3, flowerW)
    set(16, 5, flowerP)
    rect(set, 0, 40, 32, 8, rock)
    rect(set, 2, 42, 12, 4, rockL)
    rect(set, 18, 43, 10, 3, rockD)
  })

  paint(scene, 'til-wood', 32, 16, (set) => {
    rect(set, 0, 0, 32, 16, wood)
    rect(set, 0, 0, 32, 3, woodL)
    rect(set, 0, 13, 32, 3, woodD)
    for (let x = 5; x < 32; x += 9) rect(set, x, 0, 2, 16, woodD)
    set(10, 7, woodL)
    set(20, 8, woodL)
  })

  paint(scene, 'til-spike', 24, 30, (set) => {
    for (let i = 0; i < 3; i++) {
      const ox = i * 8
      for (let y = 0; y < 26; y++) {
        const half = Math.max(0, 3 - Math.floor(y / 6))
        rect(set, ox + 3 - half, y, 1 + half * 2, 1, y < 5 ? spike : spikeD)
      }
      set(ox + 3, 1, [255, 255, 255])
    }
  })

  paint(scene, 'til-water', 32, 20, (set) => {
    rect(set, 0, 0, 32, 20, waterD)
    rect(set, 0, 2, 32, 14, water)
    for (let x = 0; x < 32; x += 3) set(x, 4, waterL)
    for (let x = 1; x < 32; x += 4) set(x, 8, waterL)
    for (let x = 2; x < 32; x += 5) set(x, 12, [200, 240, 255])
  })

  paint(scene, 'til-goal', 44, 88, (set) => {
    rect(set, 6, 28, 8, 60, red)
    rect(set, 30, 28, 8, 60, red)
    rect(set, 8, 30, 4, 10, redD)
    rect(set, 2, 20, 40, 12, red)
    rect(set, 0, 12, 44, 10, red)
    rect(set, 0, 12, 44, 3, [255, 140, 120])
    rect(set, 15, 36, 14, 36, gold)
    rect(set, 17, 38, 10, 10, goldL)
    circ(set, 22, 28, 5, goldL)
    circ(set, 22, 26, 2, [255, 255, 220])
  })

  paint(scene, 'ui-scroll', 300, 40, (set) => {
    rect(set, 18, 5, 264, 30, parchment)
    rect(set, 18, 5, 264, 3, [210, 180, 120])
    rect(set, 18, 32, 264, 3, [200, 165, 105])
    rect(set, 0, 0, 20, 40, [148, 96, 44])
    rect(set, 280, 0, 20, 40, [148, 96, 44])
    rect(set, 2, 2, 16, 36, [120, 74, 32])
    rect(set, 282, 2, 16, 36, [120, 74, 32])
    for (let x = 36; x < 270; x += 7) set(x, 35, [80, 150, 200])
  })

  paint(scene, 'fx-hit', 32, 18, (set) => {
    rect(set, 6, 2, 20, 14, hit)
    rect(set, 0, 6, 32, 6, [255, 255, 255])
    set(4, 4, [255, 220, 120])
    set(28, 10, [255, 220, 120])
  })

  paint(scene, 'fx-salmon', 40, 20, (set) => {
    rect(set, 2, 5, 11, 9, [240, 120, 70])
    rect(set, 13, 3, 12, 12, [255, 170, 110])
    rect(set, 25, 5, 11, 9, [240, 120, 70])
    rect(set, 0, 9, 40, 5, spray)
    set(16, 6, [255, 240, 200])
  })

  paint(scene, 'sign-salmon', 52, 60, (set) => {
    rect(set, 24, 22, 6, 38, woodD)
    rect(set, 4, 4, 44, 26, wood)
    rect(set, 6, 6, 40, 3, woodL)
    rect(set, 8, 10, 16, 10, [240, 130, 80])
    set(20, 12, [255, 200, 150])
    rect(set, 28, 12, 16, 4, ink)
    rect(set, 28, 18, 12, 3, ink)
  })

  paint(scene, 'heart-full', 14, 12, (set) => {
    const c: RGB = [230, 48, 64]
    rect(set, 1, 2, 5, 5, c)
    rect(set, 8, 2, 5, 5, c)
    rect(set, 2, 5, 10, 5, c)
    rect(set, 4, 9, 6, 2, c)
    set(3, 3, [255, 190, 190])
  })

  paint(scene, 'heart-empty', 14, 12, (set) => {
    const c: RGB = [45, 32, 28]
    rect(set, 1, 2, 5, 5, c)
    rect(set, 8, 2, 5, 5, c)
    rect(set, 2, 5, 10, 5, c)
    rect(set, 4, 9, 6, 2, c)
  })

  paint(scene, 'px-white', 4, 4, (set) => {
    rect(set, 0, 0, 4, 4, [255, 255, 255])
  })
}
