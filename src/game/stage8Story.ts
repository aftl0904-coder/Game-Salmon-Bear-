/**
 * Stage 8 story pack (data/stage8-story.json). Dialogue verbatim — never rewrite lines here.
 * `sections[].actions` are camera / actor cues only (never shown as on-screen text).
 */
import Phaser from 'phaser'
import storyRaw from '../../data/stage8-story.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX, playSong, stopBgm, type SongId } from './audio'
import { showStoryLines, showStoryStillThen } from './storyDepth'
import { tiltGame } from './minigames'
import type { Player } from './Player'

type SayLine = { say: string; text: string }
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
  scenes: Record<string, { title: string; stage?: string; steps: unknown[] }>
  sections: Section[]
  pupuMonitor: { x: number; stills: string[]; lines: SayLine[]; note?: string }
  fragments: Fragment[]
  bossDialogue: {
    researcher: {
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
  boss: '主任研究員',
}

/** Pack line → showStoryLines raw. Keep text as-is when it already has a speaker prefix. */
export function stage8LinesToRaw(lines: SayLine[]): string[] {
  return lines.map((l) => {
    if (/^[^：:]+[：:]/.test(l.text)) return l.text
    const name = SAY_NAME[l.say] ?? l.say
    return name === 'narr' || name === '' ? `narr：${l.text}` : `${name}：${l.text}`
  })
}

export function stage8Beats() {
  return PACK.beats
}

export function stage8Sections() {
  return PACK.sections
}

export function stage8Fragments(): Fragment[] {
  return PACK.fragments
}

export function stage8PupuMonitor() {
  return PACK.pupuMonitor
}

export function stage8BossDialogue() {
  return PACK.bossDialogue.researcher
}

/** Perform a section action cue — camera / actor motion only, never copy on screen. */
export function playStage8Action(
  scene: Phaser.Scene,
  cue: string | undefined,
  heroes: { boy: Player | null; girl: Player | null },
) {
  if (!cue) return
  const cam = scene.cameras.main
  const girl = heroes.girl
  const boy = heroes.boy
  if (cue.includes('鏡頭掃') || cue.includes('鏡頭帶')) {
    const base = cam.scrollX
    scene.tweens.add({ targets: cam, scrollX: base + 48, duration: 420, yoyo: true, ease: 'Sine.inOut' })
  }
  if (cue.includes('探頭') || cue.includes('轉向') || cue.includes('望')) {
    const looker = girl ?? boy
    if (looker) {
      looker.setFlipX(!looker.flipX)
      scene.time.delayedCall(500, () => {
        if (looker.active) looker.setFlipX(!looker.flipX)
      })
    }
  }
  if (cue.includes('退半步') || cue.includes('靠近')) {
    const who = girl ?? boy
    if (who) {
      const dir = cue.includes('退') ? (who.flipX ? 1 : -1) : who.flipX ? -1 : 1
      scene.tweens.add({ targets: who, x: who.x + dir * 18, duration: 280, yoyo: true })
    }
  }
  if (cue.includes('擋住') || cue.includes('停步')) {
    boy?.setVelocity(0, 0)
    girl?.setVelocity(0, 0)
    cam.shake(120, 0.002)
  }
}

type OpenHandle = { destroy: () => void }

/**
 * S8_OPEN: dialogue + tilt (cart skin via cs-cart / props/coffee-cart) + stage card.
 */
export function playS8Open(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const steps = PACK.scenes.S8_OPEN?.steps ?? []
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
      if ('say' in s && 'text' in s) {
        await new Promise<void>((res) => {
          if (dead) return res()
          handle = showStoryLines(scene, stage8LinesToRaw([{ say: String(s.say), text: String(s.text) }]), () => {
            handle = null
            res()
          })
        })
        continue
      }
      if ('minigame' in s && s.minigame === 'tilt') {
        const pre = (s.lines as SayLine[] | undefined) ?? []
        if (pre.length) {
          await new Promise<void>((res) => {
            if (dead) return res()
            handle = showStoryLines(scene, stage8LinesToRaw(pre), () => {
              handle = null
              res()
            })
          })
        }
        if (dead) return
        // Cart skin: coffee-cart art behind the tilt board (ticket: props/cart → cs-cart override).
        const cartKey = scene.textures.exists('cs-cart')
          ? 'cs-cart'
          : scene.textures.exists('props/cart')
            ? 'props/cart'
            : null
        let cart: Phaser.GameObjects.Image | null = null
        if (cartKey) {
          cart = scene.add
            .image(GAME_W / 2, GAME_H / 2 + 40, cartKey)
            .setScrollFactor(0)
            .setDepth(DEPTH.UI + 255)
            .setAlpha(0.35)
            .setScale(1.4)
        }
        const mini = tiltGame(scene, 2)
        handle = mini
        await mini.done
        cart?.destroy()
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

export function playS8Clear(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const steps = PACK.scenes.S8_CLEAR?.steps ?? []
  const lines: SayLine[] = []
  for (const step of steps) {
    const s = step as Record<string, unknown>
    if ('say' in s && 'text' in s) lines.push({ say: String(s.say), text: String(s.text) })
  }
  if (!lines.length) {
    onDone()
    return { destroy: () => undefined }
  }
  return showStoryLines(scene, stage8LinesToRaw(lines), onDone)
}

/** Pupu monitor beat: stills (if textures exist) then three pack lines. */
export function playPupuMonitor(scene: Phaser.Scene, onDone: () => void): OpenHandle {
  const mon = PACK.pupuMonitor
  const stills = mon.stills ?? []
  let i = 0
  let handle: OpenHandle = { destroy: () => undefined }
  const next = () => {
    if (i < stills.length) {
      const id = stills[i++]!
      // Chinese still titles → story-<slug> when Manus art lands; missing → skip instantly.
      const keyGuess = id.replace(/^S8_/, 's8-').replace(/[\u4e00-\u9fff]+/g, '').replace(/_+/g, '-') || 'cover'
      handle = showStoryStillThen(scene, keyGuess, () => next(), 700)
      return
    }
    handle = showStoryLines(scene, stage8LinesToRaw(mon.lines), onDone)
  }
  next()
  return {
    destroy: () => handle.destroy(),
  }
}
