import type Phaser from 'phaser'

/** Top-tier SNES HUD: portraits, HP, mode, centered stage */
export function buildStageHud(
  scene: Phaser.Scene,
  opts: {
    mode: '1p' | '2p'
    stageTitle: string
    stageSub: string
  },
) {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(40)

  // top bar
  const bar = scene.add.rectangle(480, 28, 960, 56, 0x1a1020, 0.72).setOrigin(0.5)
  root.add(bar)

  // center stage plaque
  const plaque = scene.add.image(480, 26, 'ui-scroll').setScale(1.05, 0.95)
  root.add(plaque)
  const stage = scene.add
    .text(480, 18, opts.stageTitle, {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '17px',
      color: '#2a1a10',
    })
    .setOrigin(0.5)
  const sub = scene.add
    .text(480, 38, opts.stageSub, {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '11px',
      color: '#5a4030',
    })
    .setOrigin(0.5)
  root.add(stage)
  root.add(sub)

  // P1 panel
  const p1box = scene.add.rectangle(88, 28, 160, 48, 0x243048, 0.9).setStrokeStyle(2, 0x6eb7d6)
  root.add(p1box)
  const p1face = scene.add.image(28, 28, 'art-salmon').setScale(0.72)
  root.add(p1face)
  const p1label = scene.add.text(52, 8, '1P 鮭男', {
    fontFamily: 'Noto Sans TC, sans-serif',
    fontSize: '13px',
    color: '#9fd4ff',
  })
  root.add(p1label)
  const heartsL: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < 3; i++) {
    const h = scene.add.image(58 + i * 17, 34, 'heart-full').setScale(1.0)
    heartsL.push(h)
    root.add(h)
  }

  // P2 panel
  const p2box = scene.add.rectangle(872, 28, 160, 48, 0x402438, 0.9).setStrokeStyle(2, 0xe89ab8)
  root.add(p2box)
  const p2face = scene.add.image(932, 28, 'art-girl').setScale(0.7)
  root.add(p2face)
  const p2label = scene.add
    .text(908, 8, '2P 熊女', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '13px',
      color: '#ffb0d0',
    })
    .setOrigin(1, 0)
  root.add(p2label)
  const heartsR: Phaser.GameObjects.Image[] = []
  for (let i = 0; i < 3; i++) {
    const h = scene.add.image(818 + i * 17, 34, 'heart-full').setScale(1.0)
    heartsR.push(h)
    root.add(h)
  }

  // mode badge — 繁中 only
  const modeBadge = scene.add
    .text(480, 58, opts.mode === '1p' ? '單人模式' : '雙人模式', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '11px',
      color: '#1a1020',
      backgroundColor: '#ffe08a',
      padding: { x: 8, y: 2 },
    })
    .setOrigin(0.5)
  root.add(modeBadge)

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

  return { root, heartsL, heartsR, info, modeBadge, stage }
}
