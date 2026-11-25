/**
 * Stage 10 story pack — Leon boss dialogue + phase-2 midCutscene (s10-3).
 * Lines stay verbatim from data/stage10-story.json.
 */
import Phaser from 'phaser'
import storyRaw from '../../data/stage10-story.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'

type MidShot = { ms: number[]; action: string }

type Pack = {
  bossDialogue: {
    leon: {
      preFight?: string[]
      phase2?: string
      postFight?: string[]
      defeatBanner?: string
      midCutscene?: {
        durationMs?: number
        dialogue?: string[]
        shots?: MidShot[]
      }
    }
  }
}

const PACK = storyRaw as unknown as Pack

export function stage10BossDialogue() {
  return PACK.bossDialogue.leon
}

export function leonMidCutsceneMs(fallback = 6000) {
  return PACK.bossDialogue.leon.midCutscene?.durationMs ?? fallback
}

/**
 * Phase-2 midCutscene: timed shots, no dialogue. Caller owns storyIntro / physics pause.
 * Returns a destroy handle; onDone fires after durationMs (or early destroy).
 */
export function playLeonMidCutscene(
  scene: Phaser.Scene,
  durationMs: number,
  onDone: () => void,
): { destroy: () => void } {
  const shots = PACK.bossDialogue.leon.midCutscene?.shots ?? []
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 280)
  const veil = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x08040a, 0.45).setOrigin(0)
  const warn = scene.add
    .rectangle(0, 0, GAME_W, 18, 0xff3040, 0.55)
    .setOrigin(0)
    .setAlpha(0.2)
  const caption = scene.add
    .text(GAME_W / 2, 56, '', {
      fontFamily: FONT_UI,
      fontSize: '13px',
      color: '#ffe8c0',
      stroke: '#1a0e08',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: GAME_W - 48 },
    })
    .setOrigin(0.5, 0)
  root.add([veil, warn, caption])

  scene.tweens.add({
    targets: warn,
    alpha: { from: 0.15, to: 0.7 },
    duration: 420,
    yoyo: true,
    repeat: -1,
  })
  scene.cameras.main.flash(180, 40, 10, 10)
  SFX.boss?.()

  let dead = false
  const timers: Phaser.Time.TimerEvent[] = []
  const finish = () => {
    if (dead) return
    dead = true
    for (const t of timers) t.remove(false)
    root.destroy(true)
    onDone()
  }

  for (const shot of shots) {
    const a = shot.ms[0] ?? 0
    const b = shot.ms[1] ?? a
    timers.push(
      scene.time.delayedCall(a, () => {
        if (dead) return
        caption.setText(shot.action)
        scene.cameras.main.flash(90, 255, 180, 60)
      }),
    )
    timers.push(
      scene.time.delayedCall(b, () => {
        if (dead) return
        if (caption.text === shot.action) caption.setText('')
      }),
    )
  }

  timers.push(scene.time.delayedCall(durationMs, finish))

  return {
    destroy: () => {
      if (dead) return
      dead = true
      for (const t of timers) t.remove(false)
      root.destroy(true)
    },
  }
}
