/**
 * bg-wire-1 — Manus far plates for stages 4 / 5 / 9 / 10.
 * Segment plates switch by level `segments` x0/x1 (same crop pattern as stage 8).
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { markHd } from './heroAnims'
import { stage7ViewportSlice } from './stage7BackdropLayout'
import stage9Raw from '../../data/levels/stage9.json'
import stage10Raw from '../../data/levels/stage10.json'

export type SegFarPlates = Record<'A' | 'B' | 'C' | 'D' | 'E', Phaser.GameObjects.Image | null>

const S9_BG: Record<'A' | 'B' | 'C' | 'D' | 'E', { key: string; file: string }> = {
  A: { key: 's9-bg-cage-lift', file: 'bg-cage-lift.png' },
  B: { key: 's9-bg-cage-corridor', file: 'bg-cage-corridor.png' },
  C: { key: 's9-bg-supplies', file: 'bg-supplies.png' },
  D: { key: 's9-bg-old-records', file: 'bg-old-records.png' },
  E: { key: 's9-bg-warden-hall', file: 'bg-warden-hall.png' },
}

const S10_BG: Record<'A' | 'B' | 'C' | 'D' | 'E', { key: string; file: string }> = {
  A: { key: 's10-bg-rain-alley', file: 'bg-rain-alley.png' },
  B: { key: 's10-bg-flooded-lobby', file: 'bg-flooded-lobby.png' },
  C: { key: 's10-bg-elevator', file: 'bg-elevator.png' },
  D: { key: 's10-bg-upper-terminal', file: 'bg-upper-terminal.png' },
  E: { key: 's10-bg-sunrise-rooftop', file: 'bg-sunrise-rooftop.png' },
}

export function preloadStageBgWire(scene: Phaser.Scene) {
  scene.load.image('s4-bg-fog-site', '/art/stage4/bg-fog-site.png')
  scene.load.image('s5-bg-sunset-tower', '/art/stage5/bg-sunset-tower.png')
  for (const { key, file } of Object.values(S9_BG)) {
    scene.load.image(key, `/art/stage9/${file}`)
  }
  for (const { key, file } of Object.values(S10_BG)) {
    scene.load.image(key, `/art/stage10/${file}`)
  }
}

export function markStageBgWire(scene: Phaser.Scene) {
  for (const key of [
    's4-bg-fog-site',
    's5-bg-sunset-tower',
    ...Object.values(S9_BG).map((x) => x.key),
    ...Object.values(S10_BG).map((x) => x.key),
  ]) {
    if (scene.textures.exists(key)) markHd(scene.textures.get(key), 1)
  }
}

function mountPlates(
  scene: Phaser.Scene,
  map: Record<'A' | 'B' | 'C' | 'D' | 'E', { key: string }>,
  namePrefix: string,
): SegFarPlates {
  const far = (id: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const key = map[id].key
    if (!scene.textures.exists(key)) return null
    return scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.SKY_BAND)
      .setDisplaySize(GAME_W, GAME_H)
      .setVisible(false)
      .setName(`${namePrefix}-${id}`)
  }
  return { A: far('A'), B: far('B'), C: far('C'), D: far('D'), E: far('E') }
}

export function mountVaultFarPlates(scene: Phaser.Scene): SegFarPlates {
  return mountPlates(scene, S9_BG, 'stage9-bg')
}

export function mountRainFarPlates(scene: Phaser.Scene): SegFarPlates {
  return mountPlates(scene, S10_BG, 'stage10-bg')
}

export function updateSegFarPlates(
  plates: SegFarPlates,
  segments: ReadonlyArray<{ id: string; x0: number; x1: number }> | undefined,
  scrollX: number,
) {
  if (!segments?.length) return
  const ids = ['A', 'B', 'C', 'D', 'E'] as const
  for (let i = 0; i < ids.length; i++) {
    const image = plates[ids[i]!]
    const segment = segments[i]
    if (!image || !segment) continue
    const slice = stage7ViewportSlice(segment.x0, segment.x1, scrollX, GAME_W)
    image.setVisible(!!slice)
    if (!slice) continue
    image.setCrop()
    image.setPosition(slice.x, 0)
    image.setDisplaySize(slice.width, GAME_H)
  }
}

export function updateVaultBackdrops(plates: SegFarPlates, scrollX: number) {
  const segs = (stage9Raw as { segments?: Array<{ id: string; x0: number; x1: number }> }).segments
  updateSegFarPlates(plates, segs, scrollX)
}

export function updateRainBackdrops(plates: SegFarPlates, scrollX: number) {
  const segs = (stage10Raw as { segments?: Array<{ id: string; x0: number; x1: number }> }).segments
  updateSegFarPlates(plates, segs, scrollX)
}
