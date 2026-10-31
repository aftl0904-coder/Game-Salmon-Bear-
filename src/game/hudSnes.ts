import type Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { MAX_HP, GAME_W, GAME_H } from './engine/constants'
import { FONT_UI } from './ui/fonts'

/**
 * SNES-style stage HUD (640×360): lacquered top band with gold trim.
 *  left  — P1 portrait · name · HP % bar · 金鮭 weapon level
 *  centre— stage plaque · honey jars 0/3 · coins · 絕招 gauge
 *  right — P2 (2P) mirrored
 *  bottom— journey track with 噗噗 marker → honey tree, timer
 * Textures are baked once from the portraits / item art already in memory.
 */

const BAND_H = 30
const HEART_W = 9
/** Max possible hearts beyond MAX_HP: 大心心 gear tiers 1-3 (+1/+2/+3) stack with 運符 (+1). */
const MAX_BONUS_HEARTS = 4

type Side = {
  hpFill: Phaser.GameObjects.Rectangle
  hpBarW: number
  stam: Phaser.GameObjects.Rectangle
  weapon: Phaser.GameObjects.Image[]
}

export type SnesHud = {
  hpFillL: Phaser.GameObjects.Rectangle
  hpFillR: Phaser.GameObjects.Rectangle
  hpBarWL: number
  hpBarWR: number
  stamL: Phaser.GameObjects.Rectangle
  stamR: Phaser.GameObjects.Rectangle
  weaponL: Phaser.GameObjects.Image[]
  weaponR: Phaser.GameObjects.Image[]
  honey: Phaser.GameObjects.Image[]
  coinText: Phaser.GameObjects.Text
  mpBar: Phaser.GameObjects.Rectangle
  mpText: Phaser.GameObjects.Text
  mpMaxW: number
  maxHp: number
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
    // HP gauge: one chunky bar instead of discrete hearts — fill width = % of current
    // max HP, no number shown. Thick gold-riveted frame so it reads at a glance /
    // peripheral vision mid-fight, echoing the old hearts' decorated look.
    const hpBarW = (MAX_HP + MAX_BONUS_HEARTS) * (HEART_W + 1) - 3
    const hpX = right ? nx - hpBarW : nx
    const HP_BAR_H = 9
    const hpY = 14
    g.fillStyle(0xc8902a, 1).fillRect(hpX - 1, hpY - 1, hpBarW + 2, HP_BAR_H + 2)
    g.fillStyle(0x240e0e, 1).fillRect(hpX, hpY, hpBarW, HP_BAR_H)
    // gold rivets at both ends of the frame — the decorative touch the hearts had.
    g.fillStyle(0xffdf90, 1).fillCircle(hpX - 1, hpY + HP_BAR_H / 2, 1.6)
    g.fillStyle(0xffdf90, 1).fillCircle(hpX + hpBarW + 1, hpY + HP_BAR_H / 2, 1.6)
    const hpFill = scene.add
      .rectangle(right ? hpX + hpBarW : hpX, hpY, hpBarW, HP_BAR_H, 0xe8384a, 1)
      .setOrigin(right ? 1 : 0, 0)
      .setScrollFactor(0)
    root.add(hpFill)
    const weapon: Phaser.GameObjects.Image[] = []
    // Start past the full HP-bar footprint (same width hearts used to reserve) so a
    // bonus heart from gear or the 運符 charm never overlaps the weapon-level icons.
    const wx0 = right
      ? nx - (MAX_HP + MAX_BONUS_HEARTS) * (HEART_W + 1) - 6
      : nx + (MAX_HP + MAX_BONUS_HEARTS) * (HEART_W + 1) + 5
    for (let i = 0; i < 3; i++) {
      const wx = right ? wx0 - 13 - i * 14 : wx0 + i * 14
      const w = scene.add.image(wx, hpY + 1, i === 0 ? 'hud2-fish' : 'hud2-fish-off').setOrigin(0, 0).setScrollFactor(0)
      if (right) w.setFlipX(true)
      weapon.push(w)
      root.add(w)
    }
    // 耐力 bar under the HP gauge: attacking drains it, standing off it brings it back.
    const sw = MAX_HP * (HEART_W + 1) - 2
    const sx = right ? nx - sw : nx
    const stamY = hpY + HP_BAR_H + 3
    root.add(scene.add.rectangle(sx, stamY, sw, 4, 0x2a1a10).setOrigin(0, 0).setScrollFactor(0))
    const stam = scene.add.rectangle(right ? sx + sw : sx, stamY + 1, sw, 2, 0x6ad0ff).setOrigin(right ? 1 : 0, 0).setScrollFactor(0)
    root.add(stam)
    return { hpFill, hpBarW, weapon, stam }
  }

  const p1Who = opts.mode === '1p' && opts.soloCast === 'girl' ? 'kibobo' : 'lunbo'
  const L = makeSide(false, p1Who, p1Who === 'lunbo' ? '倫寶' : '琪寶寶')
  const R: Side =
    opts.mode === '2p'
      ? makeSide(true, 'kibobo', '琪寶寶')
      : {
          hpFill: scene.add.rectangle(-99, -99, 1, 1).setVisible(false),
          hpBarW: 1,
          weapon: [],
          stam: scene.add.rectangle(-99, -99, 1, 1).setVisible(false),
        }

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
  const mpMaxW = 42
  const MP_BAR_H = 8
  g.fillStyle(0xc8902a, 1).fillRect(mpX - 1, rowY, mpMaxW + 2, MP_BAR_H + 2)
  g.fillStyle(0x0c1a26, 1).fillRect(mpX, rowY + 1, mpMaxW, MP_BAR_H)
  // gold rivets at both ends — matches the HP gauge's decorated frame.
  g.fillStyle(0xffdf90, 1).fillCircle(mpX - 1, rowY + 1 + MP_BAR_H / 2, 1.6)
  g.fillStyle(0xffdf90, 1).fillCircle(mpX + mpMaxW + 1, rowY + 1 + MP_BAR_H / 2, 1.6)
  const mpBar = scene.add.rectangle(mpX, rowY + 1, 0, MP_BAR_H, 0x3ec8ff, 1).setOrigin(0, 0).setScrollFactor(0)
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
    hpFillL: L.hpFill,
    hpFillR: R.hpFill,
    hpBarWL: L.hpBarW,
    hpBarWR: R.hpBarW,
    stamL: L.stam,
    stamR: R.stam,
    weaponL: L.weapon,
    weaponR: R.weapon,
    honey,
    coinText,
    mpBar,
    mpText,
    mpMaxW,
    maxHp: MAX_HP,
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
