import { DEPTH } from './engine/depth'
import type Phaser from 'phaser'

import { MAX_HP, GAME_W, L } from './engine/constants'

/**
 * Top HUD: title only (no subtitle), P1 hearts + 絕招 MP on left,
 * 2P hearts on right when duo.
 */
export function buildStageHud(
  scene: Phaser.Scene,
  opts: {
    mode: '1p' | '2p'
    stageTitle: string
    stageSub?: string
  },
) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 40)

  if (scene.textures.exists('ui-hud-wood')) {
    for (let x = L(32); x < GAME_W; x += L(64)) {
      root.add(scene.add.image(x, L(34), 'ui-hud-wood').setScale(0.55, 0.75).setAlpha(0.92))
    }
  } else {
    root.add(scene.add.rectangle(GAME_W / 2, L(34), GAME_W, L(72), 0x5a3820, 0.88).setOrigin(0.5))
  }
  root.add(scene.add.rectangle(GAME_W / 2, L(2), GAME_W, L(3), 0xe8c878, 1).setOrigin(0.5))
  root.add(scene.add.rectangle(GAME_W / 2, L(68), GAME_W, L(3), 0x8a5828, 1).setOrigin(0.5))

  const bannerKey = scene.textures.exists('ui-stage-banner') ? 'ui-stage-banner' : 'ui-scroll'
  root.add(
    scene.add.image(GAME_W / 2, L(28), bannerKey).setScale(bannerKey === 'ui-stage-banner' ? 0.55 : 0.58, 0.6),
  )
  // Subject only — no description under the title.
  root.add(
    scene.add
      .text(GAME_W / 2, L(28), opts.stageTitle, {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '9px',
        color: '#2a1810',
      })
      .setOrigin(0.5),
  )
  void opts.stageSub

  const soloCast = (scene.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
  const mode1p = opts.mode === '1p'
  const p1Name = mode1p && soloCast === 'girl' ? '1P 琪寶寶' : '1P 倫寶'
  const p1Face = mode1p && soloCast === 'girl' ? 'art-girl' : 'art-salmon'
  if (scene.textures.exists('ui-portrait')) {
    root.add(scene.add.image(L(30), L(22), 'ui-portrait').setScale(0.45))
  } else {
    root.add(scene.add.rectangle(L(30), L(22), L(40), L(40), 0x243048, 0.95).setStrokeStyle(2, 0xe0b86a))
  }
  {
    const face = scene.add.image(L(30), L(22), p1Face)
    face.setDisplaySize(L(22), L(22))
    face.setScrollFactor(0)
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.setScrollFactor(0)
    g.fillStyle(0xffffff)
    g.fillRect(L(19), L(11), L(22), L(22))
    face.setMask(g.createGeometryMask())
    root.add(face)
  }
  root.add(
    scene.add.text(L(54), L(2), p1Name, {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '10px',
      color: '#fff4d0',
      stroke: '#2a1810',
      strokeThickness: 3,
    }),
  )
  const pipFull = scene.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
  const heartsL: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(L(60) + i * L(13), L(22), pipFull).setScale(0.55)
    heartsL.push(h)
    root.add(h)
  }

  // 絕招 MP on P1 side (under hearts).
  root.add(
    scene.add
      .text(L(54), L(42), '絕招', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#c8e8ff',
        stroke: '#102030',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5),
  )
  const mpTrack = scene.add.rectangle(L(88), L(42), L(120), L(10), 0x102838, 0.95).setOrigin(0, 0.5)
  mpTrack.setStrokeStyle(2, 0x4a80a8)
  root.add(mpTrack)
  const mpBar = scene.add.rectangle(L(90), L(42), 0, L(6), 0x3ec8ff, 1).setOrigin(0, 0.5)
  root.add(mpBar)
  const mpText = scene.add
    .text(L(214), L(42), '空', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '12px',
      color: '#a8d8ff',
      stroke: '#102030',
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5)
  root.add(mpText)

  root.add(scene.add.image(L(270), L(42), 'coin').setScale(0.55))
  const coinText = scene.add
    .text(L(282), L(42), '×5', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '14px',
      color: '#ffe08a',
      stroke: '#2a1810',
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5)
  root.add(coinText)

  const heartsR: Phaser.GameObjects.Image[] = []
  if (opts.mode === '2p') {
    if (scene.textures.exists('ui-portrait')) {
      root.add(scene.add.image(L(930), L(22), 'ui-portrait').setScale(0.45))
    } else {
      root.add(scene.add.rectangle(L(930), L(22), L(40), L(40), 0x402438, 0.95).setStrokeStyle(2, 0xe89ab8))
    }
    {
      const face = scene.add.image(L(930), L(22), 'art-girl')
      face.setDisplaySize(22, 22)
      face.setScrollFactor(0)
      const g = scene.make.graphics({ x: 0, y: 0 })
      g.setScrollFactor(0)
      g.fillStyle(0xffffff)
      g.fillRect(L(919), L(11), L(22), L(22))
      face.setMask(g.createGeometryMask())
      root.add(face)
    }
    root.add(
      scene.add
        .text(L(906), L(2), '2P 琪寶寶', {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '14px',
          color: '#fff0f6',
          stroke: '#2a1810',
          strokeThickness: 3,
        })
        .setOrigin(1, 0),
    )
    for (let i = 0; i < MAX_HP; i++) {
      const h = scene.add.image(L(840) + i * L(13), L(22), pipFull).setScale(0.55)
      heartsR.push(h)
      root.add(h)
    }
  }

  const scoreText = scene.add.text(-999, -999, '').setVisible(false)
  root.add(scoreText)

  const info = scene.add
    .text(GAME_W / 2, L(518), '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '11px',
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
    mpMaxW: L(116),
    maxHp: MAX_HP,
  }
}
