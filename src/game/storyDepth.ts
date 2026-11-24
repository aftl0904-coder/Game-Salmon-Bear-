/**
 * 大陸2 深度故事（第6、7關）：真相碎片、Boss 前後對白框、Ken／噗噗伏筆。
 * 唔加新系統 — 拾取物＋對白框；對白一字不改照用（可按闊度分頁）。
 */
import Phaser from 'phaser'
import depthRaw from '../../data/c2-story-depth.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { TouchInput } from './touchInput'
import { SFX } from './audio'

export type StoryLine = { speaker: string; text: string; mono?: boolean }

type Fragment = { id: string; segment: string; x: number; name: string; content: string }
type DepthData = {
  fragments: Record<string, Fragment[]>
  bossDialogue: Record<
    string,
    {
      preFight: string[]
      postFight: string[]
      phase2?: string
      phase3?: string
      weak?: string
      defeatBanner?: string
    }
  >
  kenPhoto: { stage: number; x: number; title: string; presentation: string; content: string }
  kenMemo: { stage: number; x: number; title: string; presentation: string; content: string }
  pupuDeparture: { lines: string[]; continued: string }
}

const DATA = depthRaw as unknown as DepthData

const SPEAKER_RE = /^([^：:]+)[：:](.*)$/

export function parseStoryLine(raw: string): StoryLine {
  const m = SPEAKER_RE.exec(raw)
  if (!m) return { speaker: '', text: raw }
  const speaker = m[1]!.trim()
  const text = m[2]!.trim()
  return { speaker, text, mono: speaker === 'X-9' }
}

export function fragmentsForStage(stageNo: number): Fragment[] {
  return DATA.fragments[String(stageNo)] ?? []
}

export function bossDepthDialogue(kind: string) {
  return DATA.bossDialogue[kind]
}

export function kenPhotoSpec() {
  return DATA.kenPhoto
}

export function kenMemoSpec() {
  return DATA.kenMemo
}

export function pupuDepartureSpec() {
  return DATA.pupuDeparture
}

/**
 * Fallback bake when Manus PNGs are missing.
 * BootScene loads public/art/c2/story/*.png first — bake only if a key is absent.
 */
export function ensureStoryDepthArt(scene: Phaser.Scene) {
  const bake = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    draw(g)
    g.generateTexture(key, w, h)
    g.destroy()
  }
  // Document / paper scrap with sparkle hint
  bake('c2-truth-scrap', 28, 32, (g) => {
    g.fillStyle(0xf2e6c8, 1).fillRoundedRect(4, 2, 20, 26, 2)
    g.lineStyle(1, 0xc8a878, 1).strokeRoundedRect(4, 2, 20, 26, 2)
    g.fillStyle(0xd8c4a0, 1).fillRect(7, 7, 14, 2).fillRect(7, 12, 12, 2).fillRect(7, 17, 10, 2)
    g.fillStyle(0xffe080, 0.9).fillCircle(22, 6, 3)
  })
  // Old photo frame
  bake('c2-ken-photo', 36, 28, (g) => {
    g.fillStyle(0x5a4030, 1).fillRect(0, 0, 36, 28)
    g.fillStyle(0xd8c8a0, 1).fillRect(3, 3, 30, 22)
    g.fillStyle(0x6a9a70, 1).fillRect(3, 14, 30, 11)
    g.fillStyle(0x8ab0d0, 1).fillRect(3, 3, 30, 11)
    g.fillStyle(0xc89050, 1).fillCircle(14, 16, 4)
    g.fillStyle(0x406040, 1).fillRect(22, 10, 3, 12)
    g.fillStyle(0xe05070, 1).fillRect(24, 8, 6, 2)
  })
  // Memo /批示
  bake('c2-ken-memo', 30, 34, (g) => {
    g.fillStyle(0xf8f0dc, 1).fillRect(2, 1, 26, 32)
    g.lineStyle(1, 0xb09060, 1).strokeRect(2, 1, 26, 32)
    g.fillStyle(0x304060, 1).fillRect(5, 5, 20, 2).fillRect(5, 10, 18, 2).fillRect(5, 15, 16, 2)
    g.fillStyle(0xc04040, 1).fillRect(16, 22, 10, 8)
  })
  // Branch left at maintenance hatch
  bake('c2-pupu-branch', 24, 10, (g) => {
    g.fillStyle(0x8a6030, 1).fillRect(1, 4, 22, 3)
    g.fillStyle(0x508040, 1).fillCircle(4, 3, 3).fillCircle(10, 2, 2)
  })
  // Maintenance hatch
  bake('c2-maint-hatch', 40, 48, (g) => {
    g.fillStyle(0x2a3038, 1).fillRect(0, 0, 40, 48)
    g.lineStyle(2, 0x708090, 1).strokeRect(2, 2, 36, 44)
    g.fillStyle(0x101418, 1).fillRect(8, 10, 24, 28)
    g.fillStyle(0xc0a060, 1).fillCircle(30, 24, 3)
  })
  // Leon lion emblem silhouette
  bake('c2-leon-emblem', 32, 28, (g) => {
    g.fillStyle(0xd4a020, 1).fillCircle(16, 14, 10)
    g.fillStyle(0x1a1008, 1).fillCircle(12, 12, 2).fillCircle(20, 12, 2)
    g.fillStyle(0xd4a020, 1).fillTriangle(8, 8, 4, 0, 12, 6).fillTriangle(24, 8, 28, 0, 20, 6)
    g.fillStyle(0x1a1008, 1).fillTriangle(16, 16, 12, 22, 20, 22)
  })
}

type DialogHandle = { destroy: () => void }

/**
 * Bottom dialogue box. Advance: F/J/A/Space/attack/jump. Skip all: Enter/Esc/Start.
 * Long lines wrap; pages advance on press.
 */
export function showStoryLines(
  scene: Phaser.Scene,
  rawLines: string[],
  onDone: () => void,
  opts?: { monoDefault?: boolean },
): DialogHandle {
  const lines = rawLines.map(parseStoryLine)
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 320)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.35).setOrigin(0).setInteractive())

  const BOX_Y = 248
  const boxBg = scene.add.rectangle(8, BOX_Y, GAME_W - 16, GAME_H - BOX_Y - 6, 0x1a1210, 0.94).setOrigin(0)
  boxBg.setStrokeStyle(2, 0xe0b86a)
  const nameText = scene.add.text(18, BOX_Y + 8, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a' })
  const bodyText = scene.add.text(18, BOX_Y + 30, '', {
    fontFamily: FONT_UI,
    fontSize: '16px',
    color: '#fff6e0',
    lineSpacing: 4,
    wordWrap: { width: GAME_W - 48, useAdvancedWrap: true },
  })
  const nextMark = scene.add.text(GAME_W - 26, GAME_H - 22, '▼', { fontFamily: FONT_UI, fontSize: '12px', color: '#e0b86a' })
  root.add([boxBg, nameText, bodyText, nextMark])
  scene.tweens.add({ targets: nextMark, y: '+=3', duration: 300, yoyo: true, repeat: -1 })

  let i = 0
  let dead = false
  let pressed = false
  const press = () => {
    pressed = true
  }
  const onKey = (ev: KeyboardEvent) => {
    if (dead) return
    if (ev.key === 'Enter' || ev.key === 'Escape') {
      finish()
      return
    }
    if (['f', 'j', 'a', ' ', 'k'].includes(ev.key.toLowerCase())) press()
  }
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', press)
  const poll = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (dead) return
      if (TouchInput.justPressed('start')) return finish()
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) press()
    },
  })

  const show = (line: StoryLine) => {
    const mono = line.mono || opts?.monoDefault
    const speaker = line.speaker === 'narr' ? '' : line.speaker
    nameText.setText(speaker)
    nameText.setColor(mono ? '#7ec8ff' : '#ffe08a')
    bodyText.setFontFamily(mono ? 'monospace, "Courier New", monospace' : FONT_UI)
    bodyText.setColor(mono ? '#b8e0ff' : '#fff6e0')
    bodyText.setY(speaker ? BOX_Y + 30 : BOX_Y + 16)
    bodyText.setText(line.text)
    boxBg.setStrokeStyle(2, mono ? 0x4a90c0 : 0xe0b86a)
    SFX.blip(line.mono ? 280 : 520)
  }

  const finish = () => {
    if (dead) return
    dead = true
    poll.remove(false)
    scene.input.keyboard?.off('keydown', onKey)
    scene.input.off('pointerdown', press)
    root.destroy(true)
    onDone()
  }

  const tick = () => {
    if (dead) return
    if (i >= lines.length) return finish()
    show(lines[i]!)
    pressed = false
    const wait = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (dead) {
          wait.remove(false)
          return
        }
        if (!pressed) return
        pressed = false
        wait.remove(false)
        i++
        tick()
      },
    })
  }
  tick()

  return { destroy: finish }
}

/** Fragment / memo read: title + body in one or two pages. */
export function showFragmentRead(
  scene: Phaser.Scene,
  name: string,
  content: string,
  onDone: () => void,
): DialogHandle {
  return showStoryLines(scene, [`${name}：${content}`], onDone)
}

export function showKenRead(
  scene: Phaser.Scene,
  title: string,
  presentation: string,
  content: string,
  onDone: () => void,
  opts?: { still?: string },
): DialogHandle {
  const stillKey = opts?.still ? `story-${opts.still}` : null
  let stillRoot: Phaser.GameObjects.Container | null = null
  if (stillKey && scene.textures.exists(stillKey)) {
    stillRoot = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 310)
    stillRoot.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0))
    stillRoot.add(
      scene.add
        .image(GAME_W / 2, GAME_H / 2 - 20, stillKey)
        .setDisplaySize(GAME_W, GAME_H)
        .setOrigin(0.5),
    )
  }
  return showStoryLines(scene, [`narr：${presentation}`, `${title}：${content}`], () => {
    stillRoot?.destroy()
    onDone()
  })
}

/** Full-screen story still (boss intro / departure), then continue. */
export function showStoryStillThen(
  scene: Phaser.Scene,
  stillId: string,
  onDone: () => void,
  holdMs = 900,
): DialogHandle {
  const key = `story-${stillId}`
  if (!scene.textures.exists(key)) {
    onDone()
    return { destroy: () => undefined }
  }
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 330)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.7).setOrigin(0).setInteractive())
  root.add(scene.add.image(GAME_W / 2, GAME_H / 2, key).setDisplaySize(GAME_W, GAME_H).setOrigin(0.5))
  let dead = false
  const finish = () => {
    if (dead) return
    dead = true
    root.destroy()
    onDone()
  }
  const t = scene.time.delayedCall(holdMs, finish)
  const onKey = () => finish()
  scene.input.keyboard?.once('keydown', onKey)
  scene.input.once('pointerdown', onKey)
  return {
    destroy: () => {
      t.remove(false)
      scene.input.keyboard?.off('keydown', onKey)
      scene.input.off('pointerdown', onKey)
      finish()
    },
  }
}
