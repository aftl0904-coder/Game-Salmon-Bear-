/**
 * Stage 9 story pack (data/stage9-story.json). Dialogue verbatim — never rewrite lines here.
 * `sections[].actions` / reunion / goggles / safe_wait cues are camera/actor only (never on-screen copy).
 */
import Phaser from 'phaser'
import storyRaw from '../../data/stage9-story.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX, playSong, stopBgm, type SongId } from './audio'
import { showStoryLines } from './storyDepth'
import type { Player } from './Player'
import { playStage8Action } from './stage8Story'

type SayLine = { say: string; text: string }
type BeatBundle = { action?: string; lines?: SayLine[] }
type Section = {
  seg: string
  enterX: number
  midX: number
  enter?: SayLine[]
  mid?: SayLine[]
  actions?: { enter?: string; mid?: string }
  reunion_B?: BeatBundle
  goggles?: BeatBundle[]
  safe_wait?: BeatBundle
}
type Fragment = { id: string; segment: string; x: number; name: string; content: string }
type Pack = {
  beats: Array<{ x: number; title: string }>
  scenes: Record<string, { title: string; steps: unknown[] }>
  sections: Section[]
  fragments: Fragment[]
  bossDialogue: {
    warden: {
      preFight: string[]
      postFight: string[]
      phase2?: string
      phase3?: string
      weak?: string
      defeatBanner?: string
    }
  }
}

const PACK = storyRaw as unknown as Pack

const SAY_NAME: Record<string, string> = {
  narr: 'narr',
  lunbo: '倫寶',
  kibobo: '琪寶寶',
  pupu: '噗噗',
  boss: '首席獄卒',
}

/** Pack line → showStoryLines raw. Keep text as-is when it already has a speaker prefix. */
export function stage9LinesToRaw(lines: SayLine[]): string[] {
  return lines.map((l) => {
    if (/^[^：:]+[：:]/.test(l.text)) return l.text
    const name = SAY_NAME[l.say] ?? l.say
    return name === 'narr' || name === '' ? `narr：${l.text}` : `${name}：${l.text}`
  })
}

export function stage9Beats() {
  return PACK.beats
}

export function stage9Sections() {
  return PACK.sections
}

export function stage9Fragments(): Fragment[] {
  return PACK.fragments
}

export function stage9BossDialogue() {
  return PACK.bossDialogue.warden
}

export function playStage9Action(
  scene: Phaser.Scene,
  cue: string | undefined,
  heroes: { boy: Player | null; girl: Player | null },
) {
  // Reuse stage-8 camera/actor cue helper (same verb vocabulary).
  playStage8Action(scene, cue, heroes)
}

type OpenHandle = { destroy: () => void }

/**
 * S9_OPEN: dialogue + stage card only.
 * mini-4: embedded pour removed — 8→9 transit (端咖啡落樓) owns the minigame.
 */
export function playS9Open(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const steps = PACK.scenes.S9_OPEN?.steps ?? []
  let dead = false
  let handle: { destroy: () => void } | null = null
  const finish = () => {
    if (dead) return
    dead = true
    handle?.destroy()
    onDone()
  }
  const destroy = () => {
    dead = true
    handle?.destroy()
  }

  const run = async () => {
    for (const step of steps) {
      if (dead) return
      const s = step as Record<string, unknown>
      if ('music' in s) {
        if (s.music === 'stop') stopBgm()
        else playSong(String(s.music) as SongId)
        continue
      }
      if ('action' in s) {
        // Silent stage direction — never shown as dialogue.
        playStage9Action(scene, String(s.action), { boy: null, girl: null })
        continue
      }
      if ('say' in s && 'text' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          handle = showStoryLines(scene, stage9LinesToRaw([{ say: String(s.say), text: String(s.text) }]), () => {
            handle = null
            res()
          })
        })
        continue
      }
      // mini-4: ignore any leftover minigame steps in older packs
      if ('minigame' in s) continue
      if ('card' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 340)
          root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c1018, 0.92).setOrigin(0).setInteractive())
          root.add(
            scene.add
              .text(GAME_W / 2, GAME_H / 2 - 18, String(s.card), {
                fontFamily: FONT_TITLE,
                fontSize: '28px',
                color: '#ffd76a',
                stroke: '#1a1008',
                strokeThickness: 5,
              })
              .setOrigin(0.5),
          )
          if (s.sub) {
            root.add(
              scene.add
                .text(GAME_W / 2, GAME_H / 2 + 22, String(s.sub), {
                  fontFamily: FONT_UI,
                  fontSize: '16px',
                  color: '#dff6ff',
                })
                .setOrigin(0.5),
            )
          }
          SFX.boss()
          let done = false
          const go = () => {
            if (done) return
            done = true
            root.destroy(true)
            res()
          }
          scene.time.delayedCall(1400, go)
          scene.input.once('pointerdown', go)
          scene.input.keyboard?.once('keydown', go)
          handle = { destroy: go }
        })
        continue
      }
    }
    finish()
  }
  void run()
  return { destroy }
}

/** S9_CLEAR: dialogue + optional actions; caller restores pupu follow after. */
export function playS9Clear(
  scene: Phaser.Scene,
  onDone: () => void,
  onRestorePet?: () => void,
): OpenHandle {
  const steps = PACK.scenes.S9_CLEAR?.steps ?? []
  let dead = false
  let handle: { destroy: () => void } | null = null
  const finish = () => {
    if (dead) return
    dead = true
    handle?.destroy()
    onDone()
  }
  const destroy = () => {
    dead = true
    handle?.destroy()
  }

  const run = async () => {
    for (const step of steps) {
      if (dead) return
      const s = step as Record<string, unknown>
      if ('action' in s) {
        playStage9Action(scene, String(s.action), { boy: null, girl: null })
        if (String(s.action).includes('恢復跟隊')) onRestorePet?.()
        continue
      }
      if ('say' in s && 'text' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          handle = showStoryLines(scene, stage9LinesToRaw([{ say: String(s.say), text: String(s.text) }]), () => {
            handle = null
            res()
          })
        })
        continue
      }
      if ('card' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 340)
          root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0c1018, 0.92).setOrigin(0).setInteractive())
          root.add(
            scene.add
              .text(GAME_W / 2, GAME_H / 2 - 18, String(s.card), {
                fontFamily: FONT_TITLE,
                fontSize: '28px',
                color: '#ffd76a',
                stroke: '#1a1008',
                strokeThickness: 5,
              })
              .setOrigin(0.5),
          )
          if (s.sub) {
            root.add(
              scene.add
                .text(GAME_W / 2, GAME_H / 2 + 22, String(s.sub), {
                  fontFamily: FONT_UI,
                  fontSize: '16px',
                  color: '#dff6ff',
                })
                .setOrigin(0.5),
            )
          }
          SFX.win()
          let done = false
          const go = () => {
            if (done) return
            done = true
            root.destroy(true)
            res()
          }
          scene.time.delayedCall(1400, go)
          scene.input.once('pointerdown', go)
          scene.input.keyboard?.once('keydown', go)
          handle = { destroy: go }
        })
        continue
      }
    }
    // Ensure pet restore even if action line missing.
    onRestorePet?.()
    finish()
  }
  void run()
  return { destroy }
}

/** Play a beat bundle (action cue + lines). */
export function playStage9Beat(
  scene: Phaser.Scene,
  beat: BeatBundle | undefined,
  heroes: { boy: Player | null; girl: Player | null },
  onDone: () => void,
): OpenHandle {
  if (!beat) {
    onDone()
    return { destroy: () => undefined }
  }
  playStage9Action(scene, beat.action, heroes)
  const lines = stage9LinesToRaw(beat.lines ?? [])
  if (!lines.length) {
    onDone()
    return { destroy: () => undefined }
  }
  return showStoryLines(scene, lines, onDone)
}

/** Chain C-seg: reunion_B → goggles[4] → safe_wait. */
export function playStage9ReunionChain(
  scene: Phaser.Scene,
  heroes: { boy: Player | null; girl: Player | null },
  onDone: () => void,
): OpenHandle {
  const sec = PACK.sections.find((s) => s.seg === 'C')
  const queue: BeatBundle[] = []
  if (sec?.reunion_B) queue.push(sec.reunion_B)
  for (const g of sec?.goggles ?? []) queue.push(g)
  if (sec?.safe_wait) queue.push(sec.safe_wait)

  let dead = false
  let handle: OpenHandle = { destroy: () => undefined }
  let i = 0
  const next = () => {
    if (dead) return
    if (i >= queue.length) {
      onDone()
      return
    }
    const beat = queue[i++]!
    handle = playStage9Beat(scene, beat, heroes, next)
  }
  next()
  return {
    destroy: () => {
      dead = true
      handle.destroy()
    },
  }
}
