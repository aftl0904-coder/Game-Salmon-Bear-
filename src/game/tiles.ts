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

/** SNES-like tiles matching concept riverside */
export function registerTiles(scene: Phaser.Scene) {
  const dirt: RGB = [120, 78, 48]
  const dirtD: RGB = [88, 54, 32]
  const grass: RGB = [78, 168, 78]
  const grassL: RGB = [120, 200, 100]
  const rock: RGB = [110, 108, 100]
  const rockL: RGB = [150, 148, 140]
  const wood: RGB = [168, 110, 58]
  const woodD: RGB = [120, 74, 36]
  const spike: RGB = [210, 220, 230]
  const spikeD: RGB = [120, 130, 140]
  const water: RGB = [70, 160, 210]
  const waterL: RGB = [150, 210, 240]
  const gold: RGB = [230, 180, 60]
  const goldL: RGB = [255, 230, 120]
  const red: RGB = [200, 70, 55]
  const parchment: RGB = [236, 214, 160]
  const ink: RGB = [50, 30, 18]
  const flowerW: RGB = [250, 250, 250]
  const flowerP: RGB = [255, 170, 190]
  const hit: RGB = [255, 245, 220]
  const spray: RGB = [120, 200, 245]

  paint(scene, 'til-grass', 32, 48, (set) => {
    rect(set, 0, 10, 32, 38, dirt)
    for (let i = 0; i < 32; i += 5) rect(set, i, 14, 2, 30, dirtD)
    rect(set, 0, 0, 32, 12, grass)
    for (let x = 1; x < 32; x += 3) set(x, 2, grassL)
    // flowers
    set(6, 4, flowerW)
    set(7, 4, flowerW)
    set(18, 3, flowerP)
    set(24, 5, flowerW)
    // rocky underside
    rect(set, 0, 40, 32, 8, rock)
    rect(set, 4, 42, 10, 4, rockL)
  })

  paint(scene, 'til-wood', 32, 16, (set) => {
    rect(set, 0, 0, 32, 16, wood)
    rect(set, 0, 0, 32, 3, woodD)
    rect(set, 0, 13, 32, 3, woodD)
    for (let x = 6; x < 32; x += 10) rect(set, x, 0, 2, 16, woodD)
  })

  paint(scene, 'til-spike', 24, 28, (set) => {
    for (let i = 0; i < 3; i++) {
      const ox = i * 8
      for (let y = 0; y < 24; y++) {
        const half = Math.max(0, 3 - Math.floor(y / 7))
        rect(set, ox + 3 - half, y, 1 + half * 2, 1, y < 4 ? spike : spikeD)
      }
    }
  })

  paint(scene, 'til-water', 32, 16, (set) => {
    rect(set, 0, 4, 32, 12, water)
    for (let x = 0; x < 32; x += 4) set(x, 6, waterL)
    for (let x = 2; x < 32; x += 5) set(x, 10, waterL)
  })

  paint(scene, 'til-goal', 40, 80, (set) => {
    rect(set, 6, 24, 8, 56, red)
    rect(set, 26, 24, 8, 56, red)
    rect(set, 2, 18, 36, 10, red)
    rect(set, 0, 12, 40, 8, red)
    rect(set, 14, 32, 12, 32, gold)
    rect(set, 16, 34, 8, 10, goldL)
  })

  paint(scene, 'ui-scroll', 280, 36, (set) => {
    rect(set, 16, 4, 248, 28, parchment)
    rect(set, 16, 4, 248, 3, [200, 170, 110])
    rect(set, 16, 29, 248, 3, [200, 170, 110])
    // wood knobs
    rect(set, 0, 0, 18, 36, [140, 90, 40])
    rect(set, 262, 0, 18, 36, [140, 90, 40])
    for (let x = 30; x < 250; x += 8) set(x, 32, [90, 160, 200])
    // faint ink line
    rect(set, 40, 18, 200, 1, ink)
  })

  paint(scene, 'fx-hit', 28, 16, (set) => {
    rect(set, 4, 2, 20, 12, hit)
    rect(set, 0, 6, 28, 4, [255, 255, 255])
  })

  paint(scene, 'fx-salmon', 36, 18, (set) => {
    rect(set, 2, 4, 10, 8, [240, 130, 80])
    rect(set, 12, 3, 10, 10, [255, 170, 110])
    rect(set, 22, 5, 10, 8, [240, 130, 80])
    rect(set, 0, 8, 36, 4, spray)
  })

  paint(scene, 'sign-salmon', 48, 56, (set) => {
    rect(set, 22, 20, 6, 36, woodD)
    rect(set, 4, 4, 40, 24, wood)
    rect(set, 8, 8, 14, 8, [240, 130, 80])
    rect(set, 24, 10, 16, 4, ink)
    rect(set, 24, 16, 12, 3, ink)
  })

  paint(scene, 'heart-full', 14, 12, (set) => {
    const c: RGB = [220, 50, 60]
    rect(set, 1, 2, 5, 5, c)
    rect(set, 8, 2, 5, 5, c)
    rect(set, 2, 5, 10, 5, c)
    rect(set, 4, 9, 6, 2, c)
    set(3, 3, [255, 180, 180])
  })

  paint(scene, 'heart-empty', 14, 12, (set) => {
    const c: RGB = [40, 30, 25]
    rect(set, 1, 2, 5, 5, c)
    rect(set, 8, 2, 5, 5, c)
    rect(set, 2, 5, 10, 5, c)
    rect(set, 4, 9, 6, 2, c)
  })
}
