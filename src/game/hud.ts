import type Phaser from 'phaser'

const MAX_HP = 10

/**
 * Goemon SNES-like top HUD:
 * wood bar, portrait boxes, 10 heart pips, mode, centered stage scroll,
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
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(40)

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
      .text(480, 16, opts.stageTitle, {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#2a1810',
      })
      .setOrigin(0.5),
  )
  root.add(
    scene.add
      .text(480, 36, opts.stageSub, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '11px',
        color: '#5a4030',
      })
      .setOrigin(0.5),
  )

  if (scene.textures.exists('ui-portrait')) {
    root.add(scene.add.image(30, 28, 'ui-portrait').setScale(1.05))
  } else {
    root.add(scene.add.rectangle(30, 28, 44, 44, 0x243048, 0.95).setStrokeStyle(2, 0xe0b86a))
  }
  root.add(scene.add.image(30, 28, 'art-salmon').setScale(0.62))
  root.add(
    scene.add.text(58, 4, '1P 鮭男', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '12px',
      color: '#fff4d0',
      stroke: '#2a1810',
      strokeThickness: 3,
    }),
  )
  const pipFull = scene.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
  const heartsL: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(64 + i * 11, 30, pipFull)
    heartsL.push(h)
    root.add(h)
  }

  if (scene.textures.exists('ui-portrait')) {
    root.add(scene.add.image(930, 28, 'ui-portrait').setScale(1.05))
  } else {
    root.add(scene.add.rectangle(930, 28, 44, 44, 0x402438, 0.95).setStrokeStyle(2, 0xe89ab8))
  }
  root.add(scene.add.image(930, 28, 'art-girl').setScale(0.58))
  root.add(
    scene.add
      .text(902, 4, '2P 熊女', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#fff0f6',
        stroke: '#2a1810',
        strokeThickness: 3,
      })
      .setOrigin(1, 0),
  )
  const heartsR: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(792 + i * 11, 30, pipFull)
    heartsR.push(h)
    root.add(h)
  }

  root.add(
    scene.add
      .text(300, 58, opts.mode === '1p' ? '單人模式' : '雙人模式', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '11px',
        color: '#2a1810',
        backgroundColor: '#ffe08a',
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5),
  )

  root.add(scene.add.image(400, 58, 'coin').setScale(1.25))
  const coinText = scene.add
    .text(412, 58, '×5', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '14px',
      color: '#ffe08a',
      stroke: '#2a1810',
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5)
  root.add(coinText)
  root.add(
    scene.add
      .text(458, 58, '投幣', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '10px',
        color: '#f7e7c0',
      })
      .setOrigin(0, 0.5),
  )

  if (scene.textures.exists('ui-score-plate')) {
    root.add(scene.add.image(720, 58, 'ui-score-plate').setScale(1.15, 1))
  }
  const scoreText = scene.add
    .text(720, 58, '得分 0', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '13px',
      color: '#ffe08a',
    })
    .setOrigin(0.5)
  root.add(scoreText)

  const info = scene.add
    .text(480, 522, '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '12px',
      color: '#fff8e0',
      backgroundColor: '#4a2a18cc',
      padding: { x: 10, y: 4 },
    })
    .setOrigin(0.5)
  root.add(info)

  return { root, heartsL, heartsR, info, coinText, scoreText, maxHp: MAX_HP }
}
