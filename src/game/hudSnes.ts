import type Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { MAX_HP, GAME_W, GAME_H } from './engine/constants'
import { FONT_UI } from './ui/fonts'

/**
 * SNES-style stage HUD (640×360): lacquered top band with gold trim.
 *  left  — P1 portrait · name · pixel hearts · 金鮭 weapon level
 *  centre— stage plaque · honey jars 0/3 · coins · 絕招 gauge
 *  right — P2 (2P) mirrored
 *  bottom— journey track with 噗噗 marker → honey tree, timer
 * Textures are baked once from the portraits / item art already in memory.
 */

const BAND_H = 30
const HEART_W = 9
const HEART_H = 8

type Side = {
  hearts: Phaser.GameObjects.Image[]
  weapon: Phaser.GameObjects.Image[]
}

export type SnesHud = {
  heartsL: Phaser.GameObjects.Image[]
  heartsR: Phaser.GameObjects.Image[]
  weaponL: Phaser.GameObjects.Image[]
  weaponR: Phaser.GameObjects.Image[]
  honey: Phaser.GameObjects.Image[]
  coinText: Phaser.GameObjects.Text
  mpBar: Phaser.GameObjects.Rectangle
  mpText: Phaser.GameObjects.Text
  mpMaxW: number
  maxHp: number
  pipFull: string
  pipEmpty: string
  jarFull: string
  jarEmpty: string
  fishOn: string
  fishOff: string
  marker: Phaser.GameObjects.Image | null
  trackX0: number
  trackX1: number
  timeText: Phaser.GameObjects.Text
  toast: Phaser.GameObjects.Text
  muteAnchor: { x: number; y: number }
}

const HEART_ROWS = [
  '.##...##.',
  '#oo#.#oo#',
  '#oxx#xxx#',
  '#xxxxxxx#',
  '.#xxxxx#.',
  '..#xxx#..',
  '...#x#...',
  '....#....',
]

function bakeHeart(scene: Phaser.Scene, key: string, full: boolean) {
  if (scene.textures.exists(key)) return
  const c = document.createElement('canvas')
  c.width = HEART_W
  c.height = HEART_H
  const ctx = c.getContext('2d')!
  const pal: Record<string, string> = full
    ? { '#': '#2a0a0e', x: '#e8384a', o: '#ffb0b8' }
    : { '#': '#2a1a1e', x: '#4a3438', o: '#5a4448' }
  HEART_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = pal[ch]
      if (!col) return
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  scene.textures.addCanvas(key, c)
}

/** Downscale an existing texture frame into a small HUD icon (smooth, then hard alpha). */
function bakeIcon(scene: Phaser.Scene, src: string, key: string, w: number, h: number, frame?: number, grey = false) {
  if (scene.textures.exists(key) || !scene.textures.exists(src)) return
  const fr = scene.textures.getFrame(src, frame)
  if (!fr) return
  const img = fr.source.image as HTMLImageElement | HTMLCanvasElement
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i + 3] = d.data[i + 3]! > 110 ? 255 : 0
    if (grey) {
      const v = (d.data[i]! * 0.3 + d.data[i + 1]! * 0.59 + d.data[i + 2]! * 0.11) * 0.45
      d.data[i] = v
      d.data[i + 1] = v
      d.data[i + 2] = v + 6
    }
  }
  ctx.putImageData(d, 0, 0)
  scene.textures.addCanvas(key, c)
}

function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string) {
  return scene.add
    .text(x, y, s, {
      fontFamily: FONT_UI,
      fontSize: `${size}px`,
      color,
      shadow: { offsetX: 1, offsetY: 1, color: '#0c0604', blur: 0, fill: true, stroke: false },
    })
    .setScrollFactor(0)
}

export function buildSnesHud(
  scene: Phaser.Scene,
  opts: { mode: '1p' | '2p'; stageTitle: string; soloCast: 'boy' | 'girl' },
): SnesHud {
  bakeHeart(scene, 'hud2-heart', true)
  bakeHeart(scene, 'hud2-heart-empty', false)
  bakeIcon(scene, 'portrait-lunbo', 'hud2-face-lunbo', 24, 24, 0)
  bakeIcon(scene, 'portrait-kibobo', 'hud2-face-kibobo', 24, 24, 0)
  bakeIcon(scene, 'pickup-power', 'hud2-fish', 13, 8)
  bakeIcon(scene, 'pickup-power', 'hud2-fish-off', 13, 8, undefined, true)
  bakeIcon(scene, 'cs-jar-real', 'hud2-jar', 9, 11)
  bakeIcon(scene, 'cs-jar-real', 'hud2-jar-empty', 9, 11, undefined, true)
  bakeIcon(scene, 'portrait-pupu', 'hud2-pupu', 12, 12, 1)

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 40)
  const g = scene.add.graphics().setScrollFactor(0)
  // Lacquered band: dark wood, a lighter top sheen, gold trim and a shadow line.
  g.fillStyle(0x1c120c, 0.94).fillRect(0, 0, GAME_W, BAND_H)
  g.fillStyle(0x3a2616, 1).fillRect(0, 0, GAME_W, 2)
  g.fillStyle(0xc8902a, 1).fillRect(0, BAND_H, GAME_W, 1)
  g.fillStyle(0x6a4a18, 1).fillRect(0, BAND_H + 1, GAME_W, 1)
  g.fillStyle(0x000000, 0.25).fillRect(0, BAND_H + 2, GAME_W, 2)
  root.add(g)

  const makeSide = (right: boolean, who: 'lunbo' | 'kibobo', name: string): Side => {
    const x0 = right ? GAME_W - 6 - 24 : 6
    // Portrait in a gold frame.
    g.fillStyle(0xc8902a, 1).fillRect(x0 - 1, 2, 26, 26)
    g.fillStyle(0x2e1e12, 1).fillRect(x0, 3, 24, 24)
    const faceKey = scene.textures.exists(`hud2-face-${who}`) ? `hud2-face-${who}` : who === 'lunbo' ? 'art-salmon' : 'art-girl'
    const face = scene.add.image(x0, 3, faceKey).setOrigin(0, 0).setScrollFactor(0)
    if (right) face.setFlipX(true)
    if (!scene.textures.exists(`hud2-face-${who}`)) face.setDisplaySize(24, 24)
    root.add(face)
    const nx = right ? x0 - 5 : x0 + 29
    const label = txt(scene, nx, 2, name, 10, who === 'lunbo' ? '#ffc890' : '#ffd0e0').setOrigin(right ? 1 : 0, 0)
    root.add(label)
    const hearts: Phaser.GameObjects.Image[] = []
    for (let i = 0; i < MAX_HP; i++) {
      const hx = right ? nx - HEART_W - i * (HEART_W + 1) : nx + i * (HEART_W + 1)
      const h = scene.add.image(hx, 17, 'hud2-heart').setOrigin(0, 0).setScrollFactor(0)
      hearts.push(h)
      root.add(h)
    }
    const weapon: Phaser.GameObjects.Image[] = []
    const wx0 = right ? nx - MAX_HP * (HEART_W + 1) - 6 : nx + MAX_HP * (HEART_W + 1) + 5
    for (let i = 0; i < 3; i++) {
      const wx = right ? wx0 - 13 - i * 14 : wx0 + i * 14
      const w = scene.add.image(wx, 17, i === 0 ? 'hud2-fish' : 'hud2-fish-off').setOrigin(0, 0).setScrollFactor(0)
      if (right) w.setFlipX(true)
      weapon.push(w)
      root.add(w)
    }
    return { hearts, weapon }
  }

  const p1Who = opts.mode === '1p' && opts.soloCast === 'girl' ? 'kibobo' : 'lunbo'
  const L = makeSide(false, p1Who, p1Who === 'lunbo' ? '倫寶' : '琪寶寶')
  const R = opts.mode === '2p' ? makeSide(true, 'kibobo', '琪寶寶') : { hearts: [], weapon: [] }

  // Centre: stage plaque + honey / coins / 絕招.
  const cx = GAME_W / 2
  const plaque = txt(scene, cx, 1, opts.stageTitle, 11, '#ffd76a').setOrigin(0.5, 0)
  const pw = Math.ceil(plaque.width) + 16
  g.fillStyle(0x3a2412, 1).fillRect(Math.round(cx - pw / 2), 1, pw, 13)
  g.fillStyle(0xc8902a, 1).fillRect(Math.round(cx - pw / 2), 14, pw, 1)
  root.add(plaque)

  const honey: Phaser.GameObjects.Image[] = []
  const rowY = 17
  let x = cx - 62
  for (let i = 0; i < 3; i++) {
    const j = scene.add.image(x + i * 11, rowY - 1, 'hud2-jar-empty').setOrigin(0, 0).setScrollFactor(0)
    honey.push(j)
    root.add(j)
  }
  x += 3 * 11 + 8
  const coinKey = scene.textures.exists('hud-coin') ? 'hud-coin' : 'coin'
  const coin = scene.add.image(x, rowY, coinKey).setOrigin(0, 0).setScrollFactor(0)
  coin.setDisplaySize(10, 10)
  root.add(coin)
  const coinText = txt(scene, x + 12, rowY - 2, '×5', 10, '#ffe08a')
  root.add(coinText)
  x += 40
  const mpLabel = txt(scene, x, rowY - 2, '絕招', 10, '#a8e0ff')
  root.add(mpLabel)
  const mpX = x + Math.ceil(mpLabel.width) + 3
  const mpMaxW = 34
  g.fillStyle(0xc8902a, 1).fillRect(mpX - 1, rowY + 1, mpMaxW + 2, 7)
  g.fillStyle(0x0c1a26, 1).fillRect(mpX, rowY + 2, mpMaxW, 5)
  const mpBar = scene.add.rectangle(mpX, rowY + 2, 0, 5, 0x3ec8ff, 1).setOrigin(0, 0).setScrollFactor(0)
  root.add(mpBar)
  const mpText = txt(scene, mpX + mpMaxW + 3, rowY - 2, '滿', 10, '#66eeff').setVisible(false)
  root.add(mpText)

  // Bottom journey track: 噗噗 marker travels to the honey tree.
  const trackX0 = 170
  const trackX1 = 470
  const ty = GAME_H - 9
  g.fillStyle(0x000000, 0.45).fillRoundedRect(trackX0 - 8, ty - 6, trackX1 - trackX0 + 40, 12, 4)
  g.fillStyle(0x6a4a18, 1).fillRect(trackX0, ty, trackX1 - trackX0, 2)
  g.fillStyle(0xc8902a, 1).fillRect(trackX0, ty, trackX1 - trackX0, 1)
  const goalIcon = scene.add.image(trackX1 + 4, ty + 1, 'hud2-jar').setOrigin(0, 0.5).setScrollFactor(0)
  root.add(goalIcon)
  const marker = scene.textures.exists('hud2-pupu')
    ? scene.add.image(trackX0, ty + 1, 'hud2-pupu').setOrigin(0.5, 0.5).setScrollFactor(0)
    : null
  if (marker) root.add(marker)
  const timeText = txt(scene, trackX1 + 18, ty - 6, '0秒', 10, '#e8d8b0')
  root.add(timeText)

  // Message toast under the band (hints, banners).
  const toast = scene.add
    .text(cx, BAND_H + 8, '', {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: '#fff4d0',
      backgroundColor: '#1c120cdd',
      padding: { x: 8, y: 3 },
      shadow: { offsetX: 1, offsetY: 1, color: '#0c0604', blur: 0, fill: true, stroke: false },
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setVisible(false)
  root.add(toast)

  return {
    heartsL: L.hearts,
    heartsR: R.hearts,
    weaponL: L.weapon,
    weaponR: R.weapon,
    honey,
    coinText,
    mpBar,
    mpText,
    mpMaxW,
    maxHp: MAX_HP,
    pipFull: 'hud2-heart',
    pipEmpty: 'hud2-heart-empty',
    jarFull: 'hud2-jar',
    jarEmpty: 'hud2-jar-empty',
    fishOn: 'hud2-fish',
    fishOff: 'hud2-fish-off',
    marker,
    trackX0,
    trackX1,
    timeText,
    toast,
    muteAnchor: { x: GAME_W - 28, y: GAME_H - 20 },
  }
}
