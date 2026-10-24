import type Phaser from 'phaser'

type RGB = [number, number, number]

/** Tiny pixel painter → Phaser texture */
export function paintTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (set: (x: number, y: number, rgb: RGB, a?: number) => void) => void,
) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const set = (x: number, y: number, rgb: RGB, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    img.data[i] = rgb[0]
    img.data[i + 1] = rgb[1]
    img.data[i + 2] = rgb[2]
    img.data[i + 3] = a
  }
  draw(set)
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
}

function fillRect(
  set: (x: number, y: number, rgb: RGB, a?: number) => void,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: RGB,
) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) set(xx, yy, rgb)
  }
}

function fillCircle(
  set: (x: number, y: number, rgb: RGB, a?: number) => void,
  cx: number,
  cy: number,
  r: number,
  rgb: RGB,
) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) set(cx + x, cy + y, rgb)
    }
  }
}

/** Kind smiling teddy — soft eyes, curved smile, warm fur */
export function drawKindBear(scene: Phaser.Scene) {
  const W = 40
  const H = 44
  const fur: RGB = [196, 140, 78]
  const furD: RGB = [150, 100, 52]
  const belly: RGB = [236, 210, 160]
  const outline: RGB = [62, 36, 18]
  const nose: RGB = [50, 30, 20]
  const blush: RGB = [232, 150, 140]
  const cream: RGB = [255, 245, 220]

  paintTexture(scene, 'spr-bear', W, H, (set) => {
    // ears
    fillCircle(set, 9, 9, 7, fur)
    fillCircle(set, 30, 9, 7, fur)
    fillCircle(set, 9, 9, 3, belly)
    fillCircle(set, 30, 9, 3, belly)
    // head
    fillCircle(set, 20, 16, 12, fur)
    // body
    fillRect(set, 8, 24, 24, 16, fur)
    fillCircle(set, 20, 38, 11, fur)
    // belly patch
    fillCircle(set, 20, 32, 7, belly)
    // arms
    fillCircle(set, 5, 30, 5, furD)
    fillCircle(set, 34, 30, 5, furD)
    // feet
    fillCircle(set, 12, 41, 4, furD)
    fillCircle(set, 28, 41, 4, furD)
    // soft eyes (kind)
    fillRect(set, 13, 13, 3, 3, outline)
    fillRect(set, 24, 13, 3, 3, outline)
    set(14, 13, cream)
    set(25, 13, cream)
    // brows soft upward
    set(12, 11, outline)
    set(13, 10, outline)
    set(26, 11, outline)
    set(25, 10, outline)
    // blush
    fillRect(set, 9, 17, 3, 2, blush)
    fillRect(set, 28, 17, 3, 2, blush)
    // snout + smile
    fillCircle(set, 20, 20, 4, belly)
    fillRect(set, 19, 18, 2, 2, nose)
    // curved kind smile
    set(16, 21, outline)
    set(17, 22, outline)
    set(18, 23, outline)
    set(19, 23, outline)
    set(20, 23, outline)
    set(21, 23, outline)
    set(22, 23, outline)
    set(23, 22, outline)
    set(24, 21, outline)
    // light outline accents
    for (let a = 0; a < 360; a += 12) {
      const rad = (a * Math.PI) / 180
      const ox = Math.round(20 + Math.cos(rad) * 12)
      const oy = Math.round(16 + Math.sin(rad) * 12)
      if (set && (a % 24 === 0)) set(ox, oy, outline, 180)
    }
  })
}

/** Young man with salmon spirit sash */
export function drawSalmonBoy(scene: Phaser.Scene) {
  const W = 28
  const H = 40
  const skin: RGB = [242, 198, 160]
  const hair: RGB = [42, 52, 78]
  const indigo: RGB = [55, 90, 150]
  const indigoD: RGB = [35, 60, 110]
  const salmon: RGB = [230, 120, 80]
  const salmonL: RGB = [255, 180, 130]
  const outline: RGB = [30, 22, 18]
  const white: RGB = [245, 240, 230]

  paintTexture(scene, 'spr-salmon', W, H, (set) => {
    // hair
    fillRect(set, 8, 2, 12, 6, hair)
    fillRect(set, 6, 4, 16, 6, hair)
    // head
    fillRect(set, 8, 8, 12, 10, skin)
    // eyes
    fillRect(set, 10, 11, 2, 2, outline)
    fillRect(set, 16, 11, 2, 2, outline)
    set(11, 11, white)
    set(17, 11, white)
    // small smile
    set(12, 15, outline)
    set(13, 16, outline)
    set(14, 16, outline)
    set(15, 15, outline)
    // body indigo
    fillRect(set, 7, 18, 14, 12, indigo)
    fillRect(set, 8, 18, 12, 2, indigoD)
    // salmon sash / spirit
    fillRect(set, 6, 20, 16, 3, salmon)
    fillRect(set, 18, 19, 8, 5, salmonL)
    // fish-shaped charm on side
    fillCircle(set, 23, 21, 3, salmon)
    set(25, 20, white)
    // arms
    fillRect(set, 3, 19, 4, 8, skin)
    fillRect(set, 21, 22, 4, 7, skin)
    // legs
    fillRect(set, 9, 30, 4, 8, indigoD)
    fillRect(set, 15, 30, 4, 8, indigoD)
    // shoes
    fillRect(set, 8, 37, 5, 3, outline)
    fillRect(set, 15, 37, 5, 3, outline)
  })
}

/** Small riverside enemy — pickled fish spirit */
export function drawEnemy(scene: Phaser.Scene) {
  const W = 28
  const H = 28
  const body: RGB = [120, 70, 90]
  const bodyL: RGB = [160, 100, 110]
  const eye: RGB = [255, 220, 80]
  const outline: RGB = [40, 20, 30]
  const fin: RGB = [90, 50, 70]

  paintTexture(scene, 'spr-enemy', W, H, (set) => {
    fillCircle(set, 14, 14, 10, body)
    fillCircle(set, 14, 14, 7, bodyL)
    // fins
    fillRect(set, 2, 12, 5, 4, fin)
    fillRect(set, 21, 12, 5, 4, fin)
    // angry eyes
    fillRect(set, 9, 11, 3, 3, eye)
    fillRect(set, 16, 11, 3, 3, eye)
    set(10, 12, outline)
    set(17, 12, outline)
    // frown
    set(11, 18, outline)
    set(12, 17, outline)
    set(13, 17, outline)
    set(14, 17, outline)
    set(15, 17, outline)
    set(16, 18, outline)
  })
}

export function drawTiles(scene: Phaser.Scene) {
  const dirt: RGB = [110, 74, 46]
  const dirtD: RGB = [84, 54, 32]
  const grass: RGB = [74, 140, 70]
  const grassL: RGB = [110, 180, 90]
  const wood: RGB = [150, 96, 48]
  const woodD: RGB = [110, 70, 34]
  const stone: RGB = [150, 148, 140]
  const stoneD: RGB = [110, 108, 100]
  const gold: RGB = [220, 170, 50]
  const goldL: RGB = [255, 220, 120]
  const red: RGB = [190, 70, 55]
  const water: RGB = [70, 150, 200]
  const waterL: RGB = [140, 210, 240]
  const hit: RGB = [255, 230, 160]
  const spray: RGB = [120, 200, 240]

  paintTexture(scene, 'til-ground', 32, 32, (set) => {
    fillRect(set, 0, 0, 32, 32, dirt)
    for (let i = 0; i < 32; i += 4) fillRect(set, i, 0, 2, 32, dirtD)
    fillRect(set, 0, 0, 32, 6, grass)
    for (let x = 0; x < 32; x += 3) set(x, 1, grassL)
  })

  paintTexture(scene, 'til-wood', 32, 16, (set) => {
    fillRect(set, 0, 0, 32, 16, wood)
    fillRect(set, 0, 0, 32, 3, woodD)
    fillRect(set, 0, 13, 32, 3, woodD)
    for (let x = 4; x < 32; x += 8) fillRect(set, x, 0, 1, 16, woodD)
  })

  paintTexture(scene, 'til-goal', 36, 72, (set) => {
    // torii-ish shrine post + golden tablet
    fillRect(set, 6, 20, 6, 52, red)
    fillRect(set, 24, 20, 6, 52, red)
    fillRect(set, 2, 16, 32, 8, red)
    fillRect(set, 0, 12, 36, 6, red)
    fillRect(set, 12, 28, 12, 28, gold)
    fillRect(set, 14, 30, 8, 8, goldL)
    // flame
    fillCircle(set, 18, 24, 4, goldL)
  })

  paintTexture(scene, 'fx-hit', 20, 12, (set) => {
    fillRect(set, 2, 2, 16, 8, hit)
    fillRect(set, 0, 4, 20, 4, [255, 250, 220])
  })

  paintTexture(scene, 'fx-water', 24, 14, (set) => {
    fillCircle(set, 8, 7, 5, spray)
    fillCircle(set, 16, 7, 6, water)
    fillCircle(set, 18, 5, 2, waterL)
  })

  paintTexture(scene, 'til-stone', 32, 32, (set) => {
    fillRect(set, 0, 0, 32, 32, stone)
    fillRect(set, 2, 2, 12, 10, stoneD)
    fillRect(set, 16, 14, 12, 12, stoneD)
  })
}

export function registerAllSprites(scene: Phaser.Scene) {
  drawKindBear(scene)
  drawSalmonBoy(scene)
  drawEnemy(scene)
  drawTiles(scene)
}
