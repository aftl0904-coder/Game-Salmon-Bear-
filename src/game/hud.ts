import { DEPTH } from './engine/depth'
import type Phaser from 'phaser'

import { MAX_HP } from './engine/constants'

/**
 * Goemon SNES-like top HUD:
 * wood bar, portrait boxes, heart pips (MAX_HP), mode, centered stage scroll,
 * koban coin (投幣續關), score. 繁中 only.
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
      root.add(scene.add.image(x, 28, 'ui-hud-wood').setAlpha(0.92))
    }
  } else {
    root.add(scene.add.rectangle(480, 28, 960, 56, 0x5a3820, 0.88).setOrigin(0.5))
  }
  root.add(scene.add.rectangle(480, 2, 960, 3, 0xe8c878, 1).setOrigin(0.5))
  root.add(scene.add.rectangle(480, 54, 960, 3, 0x8a5828, 1).setOrigin(0.5))

  const bannerKey = scene.textures.exists('ui-stage-banner') ? 'ui-stage-banner' : 'ui-scroll'
  root.add(
    scene.add.image(480, 26, bannerKey).setScale(bannerKey === 'ui-stage-banner' ? 1.05 : 1.0),
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

  // Portrait frame 44×44 — face must stay INSIDE the inner ~30px window.
  if (scene.textures.exists('ui-portrait')) {
    root.add(scene.add.image(30, 28, 'ui-portrait').setScale(1))
  } else {
    root.add(scene.add.rectangle(30, 28, 44, 44, 0x243048, 0.95).setStrokeStyle(2, 0xe0b86a))
  }
  {
    const face = scene.add.image(30, 28, 'art-salmon')
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
    scene.add.text(58, 2, '1P 倫寶', {
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
    const h = scene.add.image(64 + i * 14, 30, pipFull).setScale(1.15)
    heartsL.push(h)
    root.add(h)
  }

  // 1P：完全唔顯示 2P 頭像／血條（單人只有倫寶）
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
      const h = scene.add.image(830 + i * 14, 30, pipFull).setScale(1.15)
      heartsR.push(h)
      root.add(h)
    }
  }

  root.add(
    scene.add
      .text(300, 60, opts.mode === '1p' ? '單人模式' : '雙人模式', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#2a1810',
        backgroundColor: '#ffe08a',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5),
  )

  root.add(scene.add.image(400, 60, 'coin').setScale(1.4))
  const coinText = scene.add
    .text(416, 60, '×5', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '18px',
      color: '#ffe08a',
      stroke: '#2a1810',
      strokeThickness: 4,
    })
    .setOrigin(0, 0.5)
  root.add(coinText)
  root.add(
    scene.add
      .text(470, 60, '投幣', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#f7e7c0',
      })
      .setOrigin(0, 0.5),
  )

  if (scene.textures.exists('ui-score-plate')) {
    root.add(scene.add.image(720, 60, 'ui-score-plate').setScale(1.35, 1.15))
  }
  const scoreText = scene.add
    .text(720, 60, '得分 0', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '17px',
      color: '#ffe08a',
    })
    .setOrigin(0.5)
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

  return { root, heartsL, heartsR, info, coinText, scoreText, maxHp: MAX_HP }
}
