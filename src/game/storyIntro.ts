import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { TouchInput } from './touchInput'

/** Draft R1 prologue — pending your confirmation; no personal 待補 details. */
export type StoryBeat = {
  /** Short line under the panel (one sentence). */
  line: string
  /** Optional small caption above the line. */
  caption?: string
}

export const ROUND1_PROLOGUE: StoryBeat[] = [
  {
    caption: '第一幕',
    line: '野餐路上嘅蜂蜜同鮭供，被人搶走咗。',
  },
  {
    caption: '第二幕',
    line: '倫寶、琪寶寶同噗噗，決定一齊出發奪返。',
  },
  {
    caption: '第三幕',
    line: '溪流小路上，傀儡擋住去路——旅程，由呢度開始。',
  },
]

/** R2 office prologue — plays after R1 clear transition. */
export const ROUND2_PROLOGUE: StoryBeat[] = [
  {
    caption: '第二關・深夜辦公室',
    line: '線索指向一棟仲亮住燈嘅公司樓。',
  },
  {
    caption: '第二關',
    line: '電腦螢幕自己喺度閃：「Deadline missed。」',
  },
  {
    caption: '第二關',
    line: '地產發展商怪物坐喺最頂層——原創怪物，唔係任何真人。',
  },
]

const BEAT_MS = 7000
/** Black hold between acts (and before first beat). */
const TRANSITION_BLACK_MS = 1000
/** Final black before gameplay. */
const FINAL_BLACK_MS = 2000

type IntroOpts = {
  scene: Phaser.Scene
  beats?: StoryBeat[]
  onDone: () => void
}

/**
 * 3-act story panels after cast select, before gameplay.
 * Each beat 7s; A / 攻 skips current beat.
 * Every transition uses ≥1s black; after last beat → 2s black → onDone.
 */
export function playStoryIntro(opts: IntroOpts): { destroy: () => void } {
  const scene = opts.scene
  const beats = opts.beats ?? ROUND1_PROLOGUE
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 200)

  const veil = scene.add.rectangle(480, 270, 980, 560, 0x000000, 1).setScrollFactor(0)
  root.add(veil)

  const panel = scene.add.rectangle(480, 200, 720, 220, 0x2a1810, 1).setStrokeStyle(3, 0xe0b86a).setScrollFactor(0)
  const caption = scene.add
    .text(480, 120, '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '22px',
      color: '#ffe08a',
      stroke: '#1a1008',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
  const line = scene.add
    .text(480, 210, '', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '26px',
      color: '#fff6e0',
      stroke: '#1a1008',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 640 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
  const hint = scene.add
    .text(480, 470, 'Ａ／攻　跳過本幕', {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '18px',
      color: '#c8b090',
    })
    .setOrigin(0.5)
    .setScrollFactor(0)

  // Soft cast silhouettes as "幕" visual (textures may exist after boot)
  const faces: Phaser.GameObjects.Image[] = []
  const faceKeys = ['art-salmon', 'art-girl', 'art-bear'] as const
  faceKeys.forEach((key, i) => {
    if (!scene.textures.exists(key)) return
    const img = scene.add
      .image(300 + i * 180, 320, key)
      .setOrigin(0.5, 1)
      .setScale(key === 'art-bear' ? 2.2 : 1.05)
      .setScrollFactor(0)
      .setAlpha(0)
    faces.push(img)
    root.add(img)
  })

  root.add([panel, caption, line, hint])
  panel.setVisible(false)
  caption.setVisible(false)
  line.setVisible(false)
  hint.setVisible(false)

  let destroyed = false
  let beatIndex = -1
  let phase: 'black' | 'beat' | 'final' = 'black'
  let phaseUntil = 0
  let skipArmed = false
  let keyA: Phaser.Input.Keyboard.Key | null = null
  let poll: Phaser.Time.TimerEvent | null = null

  const showBlack = () => {
    veil.setAlpha(1)
    panel.setVisible(false)
    caption.setVisible(false)
    line.setVisible(false)
    hint.setVisible(false)
    faces.forEach((f) => f.setAlpha(0))
  }

  const showBeat = (i: number) => {
    const b = beats[i]
    if (!b) return
    veil.setAlpha(0.55)
    panel.setVisible(true)
    caption.setVisible(true)
    line.setVisible(true)
    hint.setVisible(true)
    caption.setText(b.caption ?? `第${i + 1}幕`)
    line.setText(b.line)
    faces.forEach((f, fi) => f.setAlpha(fi === i % faces.length ? 1 : 0.35))
  }

  const beginBlackBeforeNext = () => {
    phase = 'black'
    showBlack()
    phaseUntil = scene.time.now + TRANSITION_BLACK_MS
    skipArmed = false
  }

  const beginBeat = (i: number) => {
    beatIndex = i
    if (i >= beats.length) {
      phase = 'final'
      showBlack()
      phaseUntil = scene.time.now + FINAL_BLACK_MS
      skipArmed = false
      return
    }
    phase = 'beat'
    showBeat(i)
    phaseUntil = scene.time.now + BEAT_MS
    // Debounce skip so the same A press that ended previous black doesn't skip instantly
    skipArmed = false
    scene.time.delayedCall(280, () => {
      if (!destroyed && phase === 'beat' && beatIndex === i) skipArmed = true
    })
  }

  const advanceFromBeat = () => {
    if (phase !== 'beat') return
    const next = beatIndex + 1
    if (next >= beats.length) {
      phase = 'final'
      showBlack()
      phaseUntil = scene.time.now + FINAL_BLACK_MS
      skipArmed = false
    } else {
      beginBlackBeforeNext()
    }
  }

  const wantsSkip = () => {
    if (!skipArmed || phase !== 'beat') return false
    if (keyA && Phaser.Input.Keyboard.JustDown(keyA)) return true
    if (TouchInput.justPressed('attack')) return true
    return false
  }

  const finish = () => {
    if (destroyed) return
    destroyed = true
    poll?.remove(false)
    keyA?.destroy()
    root.destroy(true)
    opts.onDone()
  }

  // Opening black ≥1s before first beat
  showBlack()
  phase = 'black'
  phaseUntil = scene.time.now + TRANSITION_BLACK_MS
  keyA = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? null

  poll = scene.time.addEvent({
    delay: 50,
    loop: true,
    callback: () => {
      if (destroyed) return
      const now = scene.time.now
      if (phase === 'black') {
        if (now >= phaseUntil) {
          beginBeat(beatIndex + 1)
        }
        return
      }
      if (phase === 'beat') {
        if (wantsSkip() || now >= phaseUntil) {
          advanceFromBeat()
        }
        return
      }
      if (phase === 'final' && now >= phaseUntil) {
        finish()
      }
    },
  })

  return {
    destroy: () => {
      if (destroyed) return
      destroyed = true
      poll?.remove(false)
      keyA?.destroy()
      root.destroy(true)
    },
  }
}
