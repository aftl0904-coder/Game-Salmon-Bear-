import type Phaser from 'phaser'

const MAX_HP = 10

/** SNES HUD: portraits, 10 HP pips, koban coins (投幣續關), stage — 繁中 */
export function buildStageHud(
  scene: Phaser.Scene,
  opts: {
    mode: '1p' | '2p'
    stageTitle: string
    stageSub: string
  },
) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(40)

  root.add(scene.add.rectangle(480, 28, 960, 56, 0x1a1020, 0.72).setOrigin(0.5))

  const plaque = scene.add.image(480, 26, 'ui-scroll').setScale(1.05, 0.95)
  root.add(plaque)
  root.add(
    scene.add
      .text(480, 18, opts.stageTitle, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '17px',
        color: '#2a1a10',
      })
      .setOrigin(0.5),
  )
  root.add(
    scene.add
      .text(480, 38, opts.stageSub, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '11px',
        color: '#5a4030',
      })
      .setOrigin(0.5),
  )

  root.add(scene.add.rectangle(118, 28, 220, 48, 0x243048, 0.9).setStrokeStyle(2, 0x6eb7d6))
  root.add(scene.add.image(28, 28, 'art-salmon').setScale(0.72))
  root.add(
    scene.add.text(52, 6, '1P 倫寶', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '12px',
      color: '#9fd4ff',
    }),
  )
  const pipFull = scene.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
  const heartsL: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(56 + i * 10, 32, pipFull)
    heartsL.push(h)
    root.add(h)
  }

  root.add(scene.add.rectangle(842, 28, 220, 48, 0x402438, 0.9).setStrokeStyle(2, 0xe89ab8))
  root.add(scene.add.image(932, 28, 'art-girl').setScale(0.7))
  root.add(
    scene.add
      .text(908, 6, '2P 琪寶寶', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#ffb0d0',
      })
      .setOrigin(1, 0),
  )
  const heartsR: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < MAX_HP; i++) {
    const h = scene.add.image(746 + i * 10, 32, pipFull)
    heartsR.push(h)
    root.add(h)
  }

  root.add(
    scene.add
      .text(300, 58, opts.mode === '1p' ? '單人模式' : '雙人模式', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '11px',
        color: '#1a1020',
        backgroundColor: '#ffe08a',
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5),
  )

  root.add(scene.add.image(400, 58, 'coin').setScale(1.2))
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

  const info = scene.add
    .text(480, 522, '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '12px',
      color: '#f7e7c0',
      backgroundColor: '#1a1020bb',
      padding: { x: 10, y: 4 },
    })
    .setOrigin(0.5)
  root.add(info)

  return { root, heartsL, heartsR, info, coinText, maxHp: MAX_HP }
}
