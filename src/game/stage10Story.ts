/**
 * Stage 10 story pack (data/stage10-story.json). Dialogue verbatim — never rewrite lines here.
 * s10-3: Leon midCutscene. s10-4: S10_OPEN / sections / Ken / S10_CLEAR.
 */
import Phaser from 'phaser'
import storyRaw from '../../data/stage10-story.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX, playSong, stopBgm, type SongId } from './audio'
import { showStoryLines } from './storyDepth'
import { timingGame } from './minigames'
import { playStage8Action } from './stage8Story'
import type { Player } from './Player'

type SayLine = { say: string; text: string }
type MidShot = { ms: number[]; action: string }
type Section = {
  seg: string
  enterX: number
  midX: number
  enter?: SayLine[]
  mid?: SayLine[]
  actions?: { enter?: string; mid?: string }
}
type Fragment = { id: string; segment: string; x: number; name: string; content: string }
type Pack = {
  beats: Array<{ x: number; title: string }>
  scenes: Record<string, { title: string; steps: unknown[] }>
  sections: Section[]
  fragments: Fragment[]
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
  reunion?: { action?: string; lines?: SayLine[]; after?: string }
  kenScene?: { action?: string; lines?: string[] }
}

const PACK = storyRaw as unknown as Pack

const SAY_NAME: Record<string, string> = {
  narr: 'narr',
  lunbo: '倫寶',
  kibobo: '琪寶寶',
  pupu: '噗噗',
  leon: 'Leon',
  ken: 'Ken',
}

export function stage10LinesToRaw(lines: SayLine[]): string[] {
  return lines.map((l) => {
    if (/^[^：:]+[：:]/.test(l.text)) return l.text
    const name = SAY_NAME[l.say] ?? l.say
    return name === 'narr' || name === '' ? `narr：${l.text}` : `${name}：${l.text}`
  })
}

export function stage10Beats() {
  return PACK.beats
}

export function stage10Sections() {
  return PACK.sections
}

export function stage10Fragments(): Fragment[] {
  return PACK.fragments
}

export function stage10BossDialogue() {
  return PACK.bossDialogue.leon
}

export function leonMidCutsceneMs(fallback = 6000) {
  return PACK.bossDialogue.leon.midCutscene?.durationMs ?? fallback
}

export function playStage10Action(
  scene: Phaser.Scene,
  cue: string | undefined,
  heroes: { boy: Player | null; girl: Player | null },
) {
  playStage8Action(scene, cue, heroes)
}

type OpenHandle = { destroy: () => void }

/**
 * Phase-2 midCutscene: timed shots, no dialogue. Caller owns storyIntro / physics pause.
 */
export function playLeonMidCutscene(
  scene: Phaser.Scene,
  durationMs: number,
  onDone: () => void,
): { destroy: () => void } {
  const shots = PACK.bossDialogue.leon.midCutscene?.shots ?? []
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 280)
  const veil = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x08040a, 0.45).setOrigin(0)
  const warn = scene.add.rectangle(0, 0, GAME_W, 18, 0xff3040, 0.55).setOrigin(0).setAlpha(0.2)
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

/** S10_OPEN: dialogue + timing (gate-light) + stage card. Skip-able timing. */
export function playS10Open(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const steps = PACK.scenes.S10_OPEN?.steps ?? []
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
        playStage10Action(scene, String(s.action), { boy: null, girl: null })
        continue
      }
      if ('say' in s && 'text' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          handle = showStoryLines(scene, stage10LinesToRaw([{ say: String(s.say), text: String(s.text) }]), () => {
            handle = null
            res()
          })
        })
        continue
      }
      if ('minigame' in s && s.minigame === 'timing') {
        if (dead) return
        // Transition skin: gate-light timing (skip = empty result, no HP/coin penalty).
        const mini = timingGame(scene, '維修閘・等燈亮', '放行', 1)
        handle = mini
        await mini.done
        handle = null
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

/** S10_CLEAR: dialogue + card. */
export function playS10Clear(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const steps = PACK.scenes.S10_CLEAR?.steps ?? []
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
        playStage10Action(scene, String(s.action), { boy: null, girl: null })
        continue
      }
      if ('say' in s && 'text' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          handle = showStoryLines(scene, stage10LinesToRaw([{ say: String(s.say), text: String(s.text) }]), () => {
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
          SFX.win?.()
          let done = false
          const go = () => {
            if (done) return
            done = true
            root.destroy(true)
            res()
          }
          scene.time.delayedCall(1600, go)
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

/** Post-Leon: reunion → Ken scene (lines verbatim). */
export function playS10ReunionThenKen(
  scene: Phaser.Scene,
  heroes: { boy: Player | null; girl: Player | null },
  onDone: () => void,
): OpenHandle {
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
    const reunion = PACK.reunion
    if (reunion?.action) playStage10Action(scene, reunion.action, heroes)
    if (reunion?.lines?.length) {
      await new Promise<void>((res) => {
        if (dead) return res()
        handle = showStoryLines(scene, stage10LinesToRaw(reunion.lines!), () => {
          handle = null
          res()
        })
      })
    }
    if (reunion?.after) playStage10Action(scene, reunion.after, heroes)

    const ken = PACK.kenScene
    if (ken?.action) playStage10Action(scene, ken.action, heroes)
    if (ken?.lines?.length) {
      await new Promise<void>((res) => {
        if (dead) return res()
        handle = showStoryLines(scene, ken.lines!, () => {
          handle = null
          res()
        })
      })
    }
    finish()
  }
  void run()
  return { destroy }
}
