/**
 * Minigame v1 shared framework — 3 segments, gold/silver/bronze, medals, gold heal.
 * Spec: docs/gdd/minigames-v1.md（Claude 定案凌駕草稿）.
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI, FONT_TITLE } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import medalsRaw from '../../data/minigame-medals.json'
import { galleryMarkMedal } from './galleryUnlock'

export type MiniGrade = 'gold' | 'silver' | 'bronze'
export type MiniKind = 'timing' | 'reaction' | 'balance' | 'aim' | 'memory' | 'puzzle'

export type GradedResult = {
  good: number
  total: number
  grade: MiniGrade
  skipped?: boolean
  medalId?: string
}

export type MedalDef = {
  id: string
  slot: number
  name: string
  blurb: string
  kind: MiniKind
  stage: number
}

const MEDALS = (medalsRaw as { medals: MedalDef[] }).medals
const MEDAL_KEY = 'sake-kuma-medals-v1'
const GRADE_LABEL: Record<MiniGrade, string> = { gold: '金級', silver: '銀級', bronze: '銅級' }
const GRADE_COLOR: Record<MiniGrade, string> = { gold: '#ffd76a', silver: '#d0d8e8', bronze: '#c89060' }

/** Timing windows per segment (ms) — Claude 定案. */
export const TIMING_WINDOWS_MS = [280, 200, 150] as const

export function medalDefs(): MedalDef[] {
  return MEDALS
}

export function medalById(id: string): MedalDef | undefined {
  return MEDALS.find((m) => m.id === id)
}

/** Gold ≥75% (reaction ≥83%); silver ≥50%; else bronze. Skip → bronze. */
export function gradeFromRatio(good: number, total: number, kind: MiniKind, skipped = false): MiniGrade {
  if (skipped || total <= 0) return 'bronze'
  const r = good / total
  const need = kind === 'reaction' ? 10 / 12 : 0.75 // reaction: 10/12 ≈ 83%
  if (r + 1e-9 >= need) return 'gold'
  if (r >= 0.5) return 'silver'
  return 'bronze'
}

export function gradeResult(good: number, total: number, kind: MiniKind, skipped = false, medalId?: string): GradedResult {
  return { good, total, grade: gradeFromRatio(good, total, kind, skipped), skipped, medalId }
}

export function readMedals(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEDAL_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function unlockMedal(id: string): boolean {
  const list = readMedals()
  if (list.includes(id)) return false
  list.push(id)
  try {
    localStorage.setItem(MEDAL_KEY, JSON.stringify(list))
  } catch {
    /* private */
  }
  galleryMarkMedal(id)
  return true
}

/** Show grade banner; unlocks medal on gold. Resolves after dismiss / auto. */
export function showGradeResult(
  scene: Phaser.Scene,
  result: GradedResult,
  opts?: { title?: string; onGoldHeal?: () => void },
): Promise<void> {
  const def = result.medalId ? medalById(result.medalId) : undefined
  const grade = result.skipped ? 'bronze' : result.grade
  if (grade === 'gold' && result.medalId) {
    unlockMedal(result.medalId)
    galleryMarkMedal(result.medalId)
  }
  if (grade === 'gold') opts?.onGoldHeal?.()

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 280)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c0806, 0.55).setOrigin(0).setInteractive())
  const panel = scene.add.rectangle(GAME_W / 2, GAME_H / 2, 320, 160, 0x1a1210, 0.96).setStrokeStyle(3, 0xc8902a)
  const title = scene.add
    .text(GAME_W / 2, GAME_H / 2 - 48, opts?.title ?? def?.name ?? '小遊戲', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#ffe08a',
      stroke: '#2a1408',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  const gradeTx = scene.add
    .text(GAME_W / 2, GAME_H / 2 - 8, GRADE_LABEL[grade], {
      fontFamily: FONT_TITLE,
      fontSize: '28px',
      color: GRADE_COLOR[grade],
      stroke: '#2a1408',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
  const detail = scene.add
    .text(
      GAME_W / 2,
      GAME_H / 2 + 36,
      result.skipped
        ? '略過 → 銅級'
        : `成功 ${result.good}／${result.total}${grade === 'gold' && def ? `\n${def.blurb}` : ''}`,
      { fontFamily: FONT_UI, fontSize: '13px', color: '#fff6e0', align: 'center' },
    )
    .setOrigin(0.5)
  const hint = scene.add
    .text(GAME_W / 2, GAME_H / 2 + 68, '撳一下繼續', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8b090' })
    .setOrigin(0.5)
  root.add([panel, title, gradeTx, detail, hint])
  if (grade === 'gold') SFX.sparkle()
  else SFX.blip(grade === 'silver' ? 520 : 280)

  return new Promise((resolve) => {
    let gone = false
    const end = () => {
      if (gone) return
      gone = true
      scene.input.off('pointerdown', end)
      scene.input.keyboard?.off('keydown', onKey)
      scene.events.off('update', tick)
      root.destroy(true)
      resolve()
    }
    const onKey = () => end()
    const tick = () => {
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump') || TouchInput.justPressed('start')) end()
    }
    scene.input.once('pointerdown', end)
    scene.input.keyboard?.once('keydown', onKey)
    scene.events.on('update', tick)
    scene.time.delayedCall(2800, end)
  })
}

/** Heal +1 HP on living heroes, capped at max (incl. gear hearts). Returns healed heroes. */
export function applyGoldHeal(
  heroes: Array<{ alive?: boolean; hp: number; x: number; y: number; role?: string } | null | undefined>,
  maxHpOf: (h: { role?: string }) => number,
): Array<{ x: number; y: number }> {
  const healed: Array<{ x: number; y: number }> = []
  for (const h of heroes) {
    if (!h?.alive) continue
    const max = maxHpOf(h)
    if (h.hp < max) {
      h.hp = Math.min(max, h.hp + 1)
      healed.push({ x: h.x, y: h.y })
    }
  }
  return healed
}

/** Segment flash — mid playfield so it clears transit title + status line (fix-play-1). */
export function showSegmentBanner(scene: Phaser.Scene, seg: 1 | 2 | 3): Promise<void> {
  const t = scene.add
    .text(GAME_W / 2, GAME_H / 2 - 24, `第 ${seg} 段`, {
      fontFamily: FONT_TITLE,
      fontSize: '16px',
      color: '#dff6ff',
      stroke: '#0a1820',
      strokeThickness: 4,
      backgroundColor: '#1a2838cc',
      padding: { x: 10, y: 4 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH.UI + 275)
  return new Promise((r) => {
    scene.time.delayedCall(700, () => {
      t.destroy()
      r()
    })
  })
}

export { MEDAL_KEY }
