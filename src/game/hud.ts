import { DEPTH } from './engine/depth'
import type Phaser from 'phaser'

import { MAX_HP } from './engine/constants'

/**
 * Top HUD: wood bar, portraits, heart pips, coins, and blue 絕招 MP bar.
 * No red HP strip / no score plate (hearts = HP; MP = honey special).
 */
export function buildStageHud(
  scene: Phaser.Scene,
  opts: {
    mode: '1p' | '2p'
    stageTitle: string
    stageSub: string
  },
) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 40)

  if (scene.textures.exists('ui-hud-wood')) {
    for (let x = 32; x < 960; x += 64) {
      root.add(scene.add.image(x, 34, 'ui-hud-wood').setScale(1, 1.35).setAlpha(0.92))
    }
  } else {
    root.add(scene.add.rectangle(480, 34, 960, 72, 0x5a3820, 0.88).setOrigin(0.5))
  }
  root.add(scene.add.rectangle(480, 2, 960, 3, 0xe8c878, 1).setOrigin(0.5))
  root.add(scene.add.rectangle(480, 68, 960, 3, 0x8a5828, 1).setOrigin(0.5))

  const bannerKey = scene.textures.exists('ui-stage-banner') ? 'ui-stage-banner' : 'ui-scroll'
  root.add(
    scene.add.image(480, 30, bannerKey).setScale(bannerKey === 'ui-stage-banner' ? 1.15 : 1.2, 1.35),
  )
  root.add(
    scene.add
      .text(480, 14, opts.stageTitle, {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '22px',
        color: '#2a1810',
      })
      .setOrigin(0.5),
  )
  root.add(
    scene.add
      .text(480, 36, opts.stageSub, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#5a4030',
      })
      .setOrigin(0.5),
  )

  const soloCast = (scene.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
  const mode1p = opts.mode === '1p'
  const p1Name = mode1p && soloCast === 'girl' ? '1P 琪寶寶' : '1P 倫寶'
  const p1Face = mode1p && soloCast === 'girl' ? 'art-girl' : 'art-salmon'
  if (scene.textures.exists('ui-portrait')) {
    root.add(scene.add.image(30, 28, 'ui-portrait').setScale(1))
  } else {
    root.add(scene.add.rectangle(30, 28, 44, 44, 0x243048, 0.95).setStrokeStyle(2, 0xe0b86a))
  }
  {
    const face = scene.add.image(30, 28, p1Face)
    face.setDisplaySize(24, 24)
    face.setScrollFactor(0)
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.setScrollFactor(0)
    g.fillStyle(0xffffff)
    g.fillRect(18, 16, 24, 24)
    face.setMask(g.createGeometryMask())
    root.add(face)
  }
  root.add(
    scene.add.text(58, 2, p1Name, {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '16px',
      color: '#fff4d0',
      stroke: '#2a1810',
      strokeThickness: 4,
    }),
  )
  const pipFull = scene.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
  const heartsL: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(64 + i * 14, 26, pipFull).setScale(1.15)
    heartsL.push(h)
    root.add(h)
  }

  const heartsR: Phaser.GameObjects.Image[] = []
  if (opts.mode === '2p') {
    if (scene.textures.exists('ui-portrait')) {
      root.add(scene.add.image(930, 28, 'ui-portrait').setScale(1))
    } else {
      root.add(scene.add.rectangle(930, 28, 44, 44, 0x402438, 0.95).setStrokeStyle(2, 0xe89ab8))
    }
    {
      const face = scene.add.image(930, 28, 'art-girl')
      face.setDisplaySize(24, 24)
      face.setScrollFactor(0)
      const g = scene.make.graphics({ x: 0, y: 0 })
      g.setScrollFactor(0)
      g.fillStyle(0xffffff)
      g.fillRect(918, 16, 24, 24)
      face.setMask(g.createGeometryMask())
      root.add(face)
    }
    root.add(
      scene.add
        .text(902, 2, '2P 琪寶寶', {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '16px',
          color: '#fff0f6',
          stroke: '#2a1810',
          strokeThickness: 4,
        })
        .setOrigin(1, 0),
    )
    for (let i = 0; i < MAX_HP; i++) {
      const h = scene.add.image(830 + i * 14, 26, pipFull).setScale(1.15)
      heartsR.push(h)
      root.add(h)
    }
  }

  root.add(
    scene.add
      .text(200, 58, opts.mode === '1p' ? '單人' : '雙人', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1810',
        backgroundColor: '#ffe08a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5),
  )

  root.add(scene.add.image(280, 58, 'coin').setScale(1.25))
  const coinText = scene.add
    .text(294, 58, '×5', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '16px',
      color: '#ffe08a',
      stroke: '#2a1810',
      strokeThickness: 4,
    })
    .setOrigin(0, 0.5)
  root.add(coinText)

  // Blue MP bar — honey special charges (like classic magic power).
  root.add(
    scene.add
      .text(420, 50, '絕招', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '13px',
        color: '#c8e8ff',
        stroke: '#102030',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5),
  )
  const mpTrack = scene.add.rectangle(460, 58, 160, 12, 0x102838, 0.95).setOrigin(0, 0.5)
  mpTrack.setStrokeStyle(2, 0x4a80a8)
  root.add(mpTrack)
  const mpBar = scene.add.rectangle(462, 58, 0, 8, 0x3ec8ff, 1).setOrigin(0, 0.5)
  root.add(mpBar)
  const mpText = scene.add
    .text(628, 58, '空', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '13px',
      color: '#a8d8ff',
      stroke: '#102030',
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5)
  root.add(mpText)

  // Dummy score text kept off-screen for UIScene type compat (hidden).
  const scoreText = scene.add.text(-999, -999, '').setVisible(false)
  root.add(scoreText)

  const info = scene.add
    .text(480, 518, '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '16px',
      color: '#fff8e0',
      backgroundColor: '#4a2a18cc',
      padding: { x: 16, y: 8 },
    })
    .setOrigin(0.5)
  root.add(info)

  return {
    root,
    heartsL,
    heartsR,
    info,
    coinText,
    scoreText,
    mpBar,
    mpText,
    mpMaxW: 156,
    maxHp: MAX_HP,
  }
}
