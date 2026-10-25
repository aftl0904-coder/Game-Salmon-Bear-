import { DEPTH } from './engine/depth'
import type Phaser from 'phaser'
import { MAX_HP, GAME_W } from './engine/constants'
import { FONT_UI } from './ui/fonts'
import {
  layoutRow,
  layoutRowMirror,
  findOverlaps,
  type HudBound,
  type RowItem,
} from './ui/layoutRow'
import { isDebugQuery } from './assertIntegerScale'

const HUD_H = 32
const GAP = 6
const PAD = 4
const HEART = 10
const FACE = 16
const MP_W = 64
const MP_H = 6

function safeLeftPx(): number {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--safe-left').trim()
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function ellipsize(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s
  return `${s.slice(0, Math.max(1, maxChars - 1))}…`
}

function textStyle(size: 12 | 16, color: string): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    color,
    // 1px shadow instead of thick stroke (crisp CJK pixels)
    shadow: { offsetX: 1, offsetY: 1, color: '#1a1008', blur: 0, fill: true, stroke: false },
  }
}

/**
 * Top HUD (640×360): two 16px rows inside 32px band, layoutRow spacing.
 */
export function buildStageHud(
  scene: Phaser.Scene,
  opts: {
    mode: '1p' | '2p'
    stageTitle: string
    stageSub?: string
  },
) {
  const inset = PAD + safeLeftPx()
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 40)
  const bounds: HudBound[] = []
  const track = (
    id: string,
    left: number,
    top: number,
    w: number,
    h: number,
  ) => {
    bounds.push({ id, left, top, right: left + w, bottom: top + h })
  }

  // Background band
  root.add(
    scene.add
      .rectangle(GAME_W / 2, HUD_H / 2, GAME_W, HUD_H, 0x3a2818, 0.92)
      .setOrigin(0.5)
      .setScrollFactor(0),
  )

  const soloCast = (scene.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
  const mode1p = opts.mode === '1p'
  const p1Name = mode1p && soloCast === 'girl' ? '琪寶寶' : '倫寶'
  const p1Face = mode1p && soloCast === 'girl' ? 'art-girl' : 'art-salmon'
  const pipFull = scene.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
  const pipEmpty = scene.textures.exists('pip-empty') ? 'pip-empty' : 'heart-empty'

  // Two 16px bands: 0–16 / 16–32 (edges may touch; boundsOverlap treats touch as OK)
  const row1Y = 0
  const row2Y = 16

  // —— Row 1: face | name | hearts ——
  const heartsL: Phaser.GameObjects.Image[] = []
  const faceKey =
    p1Face === 'art-girl' && scene.textures.exists('hud-face-girl')
      ? 'hud-face-girl'
      : scene.textures.exists('hud-face-boy')
        ? 'hud-face-boy'
        : p1Face
  const face = scene.add.image(0, 0, faceKey).setOrigin(0, 0).setScrollFactor(0).setScale(1)
  root.add(face)

  const nameTx = scene.add
    .text(0, 0, p1Name, textStyle(12, '#fff4d0'))
    .setOrigin(0, 0)
    .setScrollFactor(0)
  root.add(nameTx)

  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(0, 0, pipFull).setOrigin(0, 0).setScrollFactor(0).setScale(1)
    heartsL.push(h)
    root.add(h)
  }

  const heartsWidth = MAX_HP * HEART + (MAX_HP - 1) * 1
  const row1End = layoutRow(
    [
      {
        width: FACE,
        place: (x) => {
          face.setPosition(x, row1Y)
          track('p1-face', x, row1Y, FACE, FACE)
        },
      },
      {
        width: Math.ceil(nameTx.width),
        place: (x) => {
          nameTx.setPosition(x, row1Y + 2)
          track('p1-name', x, row1Y + 2, nameTx.width, nameTx.height)
        },
      },
      {
        width: heartsWidth,
        place: (x) => {
          for (let i = 0; i < heartsL.length; i++) {
            const hx = x + i * (HEART + 1)
            heartsL[i]!.setPosition(hx, row1Y + 4)
            track(`p1-heart-${i}`, hx, row1Y + 4, HEART, HEART)
          }
        },
      },
    ] satisfies RowItem[],
    inset,
    GAP,
  )

  // —— Row 2: 絕招 | bar | 滿 | coin | ×n ——
  const specialLabel = scene.add
    .text(0, 0, '絕招', textStyle(12, '#c8e8ff'))
    .setOrigin(0, 0)
    .setScrollFactor(0)
  root.add(specialLabel)

  const mpTrack = scene.add
    .rectangle(0, 0, MP_W, MP_H + 2, 0x102838, 0.95)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x4a80a8)
    .setScrollFactor(0)
  root.add(mpTrack)
  const mpBar = scene.add
    .rectangle(0, 0, 0, MP_H, 0x3ec8ff, 1)
    .setOrigin(0, 0)
    .setScrollFactor(0)
  root.add(mpBar)

  const mpText = scene.add
    .text(0, 0, '', textStyle(12, '#66eeff'))
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setVisible(false)
  root.add(mpText)

  const coinKey = scene.textures.exists('hud-coin') ? 'hud-coin' : 'coin'
  const coinIcon = scene.add.image(0, 0, coinKey).setOrigin(0, 0).setScrollFactor(0).setScale(1)
  root.add(coinIcon)
  const coinText = scene.add
    .text(0, 0, '×5', textStyle(12, '#ffe08a'))
    .setOrigin(0, 0)
    .setScrollFactor(0)
  root.add(coinText)

  // 「滿」slot width: reserve 12px so layout doesn't jump when MP fills
  const fullSlotW = 12
  const row2End = layoutRow(
    [
      {
        width: Math.ceil(specialLabel.width),
        place: (x) => {
          specialLabel.setPosition(x, row2Y)
          track('special-label', x, row2Y, specialLabel.width, specialLabel.height)
        },
      },
      {
        width: MP_W,
        place: (x) => {
          mpTrack.setPosition(x, row2Y + 3)
          mpBar.setPosition(x + 1, row2Y + 4)
          track('mp-track', x, row2Y + 3, MP_W, MP_H + 2)
        },
      },
      {
        width: fullSlotW,
        place: (x) => {
          mpText.setPosition(x, row2Y)
          track('mp-full', x, row2Y, fullSlotW, 12)
        },
      },
      {
        width: 12,
        place: (x) => {
          coinIcon.setPosition(x, row2Y + 2)
          track('coin-icon', x, row2Y + 2, 12, 12)
        },
      },
      {
        width: Math.ceil(coinText.width),
        place: (x) => {
          coinText.setPosition(x, row2Y)
          track('coin-text', x, row2Y, coinText.width, coinText.height)
        },
      },
    ] satisfies RowItem[],
    inset,
    GAP,
  )

  // Mute — top-right corner of HUD, icon only
  const muteX = GAME_W - inset - 22
  const muteY = 4
  track('mute-slot', muteX, muteY, 22, 16)

  // —— P2 mirror (right), ending left of mute slot ——
  const heartsR: Phaser.GameObjects.Image[] = []
  let p2Left = muteX
  if (opts.mode === '2p') {
    const p2FaceKey = scene.textures.exists('hud-face-girl') ? 'hud-face-girl' : 'art-girl'
    const p2Face = scene.add.image(0, 0, p2FaceKey).setOrigin(0, 0).setScrollFactor(0).setScale(1)
    root.add(p2Face)
    const p2Name = scene.add
      .text(0, 0, '琪寶寶', textStyle(12, '#fff0f6'))
      .setOrigin(0, 0)
      .setScrollFactor(0)
    root.add(p2Name)
    for (let i = 0; i < MAX_HP; i++) {
      const h = scene.add.image(0, 0, pipFull).setOrigin(0, 0).setScrollFactor(0).setScale(1)
      heartsR.push(h)
      root.add(h)
    }
    // Mirror order matches P1 visual (face at outer edge): face → name → hearts, RTL from mute
    p2Left = layoutRowMirror(
      [
        {
          width: FACE,
          place: (x) => {
            p2Face.setPosition(x, row1Y)
            track('p2-face', x, row1Y, FACE, FACE)
          },
        },
        {
          width: Math.ceil(p2Name.width),
          place: (x) => {
            p2Name.setPosition(x, row1Y + 2)
            track('p2-name', x, row1Y + 2, p2Name.width, p2Name.height)
          },
        },
        {
          width: heartsWidth,
          place: (x) => {
            for (let i = 0; i < heartsR.length; i++) {
              const hx = x + i * (HEART + 1)
              heartsR[i]!.setPosition(hx, row1Y + 4)
              track(`p2-heart-${i}`, hx, row1Y + 4, HEART, HEART)
            }
          },
        },
      ] satisfies RowItem[],
      muteX - GAP,
      GAP,
    )
  }

  // Stage title centered in remaining space (between P1 cluster and P2/mute)
  const leftClusterEnd = Math.max(row1End, row2End)
  const titleZoneLeft = leftClusterEnd + GAP
  const titleZoneRight = (opts.mode === '2p' ? p2Left : muteX) - GAP
  const titleAvail = Math.max(24, titleZoneRight - titleZoneLeft)
  let title = opts.stageTitle
  const stageTx = scene.add
    .text(0, 0, title, textStyle(12, '#2a1810'))
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
  let chipW = Math.ceil(stageTx.width) + 16
  let maxChars = title.length
  while (chipW > titleAvail && maxChars > 2) {
    maxChars -= 1
    title = ellipsize(opts.stageTitle, maxChars)
    stageTx.setText(title)
    chipW = Math.ceil(stageTx.width) + 16
  }
  chipW = Math.min(chipW, titleAvail)
  const chip = scene.add
    .rectangle(0, 0, chipW, 18, 0xe8c878, 0.95)
    .setStrokeStyle(1, 0x8a5828)
    .setScrollFactor(0)
  const titleCenterX = Math.round((titleZoneLeft + titleZoneRight) / 2)
  chip.setPosition(titleCenterX, HUD_H / 2)
  stageTx.setPosition(titleCenterX, HUD_H / 2)
  root.add(chip)
  root.add(stageTx)
  track('stage-title', titleCenterX - chipW / 2, HUD_H / 2 - 9, chipW, 18)
  void opts.stageSub

  const scoreText = scene.add.text(-999, -999, '').setVisible(false)
  root.add(scoreText)

  const info = scene.add
    .text(GAME_W / 2, scene.scale.height - 18, '', {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: '#fff8e0',
      backgroundColor: '#4a2a18cc',
      padding: { x: 10, y: 4 },
      shadow: { offsetX: 1, offsetY: 1, color: '#1a1008', blur: 0, fill: true, stroke: false },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
  root.add(info)

  // Debug bounds
  const overlaps = findOverlaps(bounds)
  ;(
    window as unknown as {
      __SAKE_HUD_BOUNDS__: HudBound[]
      __SAKE_HUD_OVERLAPS__: { count: number; pairs: { a: string; b: string }[] }
    }
  ).__SAKE_HUD_BOUNDS__ = bounds
  ;(
    window as unknown as {
      __SAKE_HUD_OVERLAPS__: { count: number; pairs: { a: string; b: string }[] }
    }
  ).__SAKE_HUD_OVERLAPS__ = { count: overlaps.length, pairs: overlaps }

  if (isDebugQuery()) {
    for (const b of bounds) {
      root.add(
        scene.add
          .rectangle(
            (b.left + b.right) / 2,
            (b.top + b.bottom) / 2,
            b.right - b.left,
            b.bottom - b.top,
            0xff0000,
            0,
          )
          .setStrokeStyle(1, 0xff3333, 0.9)
          .setScrollFactor(0),
      )
    }
    if (overlaps.length) {
      console.warn('[hud] overlaps:', overlaps)
    } else {
      console.log('[hud] bounds overlap = 0')
    }
  }

  return {
    root,
    heartsL,
    heartsR,
    info,
    coinText,
    scoreText,
    mpBar,
    mpText,
    mpMaxW: MP_W - 2,
    maxHp: MAX_HP,
    muteAnchor: { x: muteX, y: muteY },
    pipFull,
    pipEmpty,
  }
}
