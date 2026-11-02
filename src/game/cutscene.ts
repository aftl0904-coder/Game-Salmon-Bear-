import Phaser from 'phaser'
import storyRaw from '../../data/story.json'
import { DEPTH } from './engine/depth'
import { GAME_W, GAME_H } from './engine/constants'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX, playSong, stopBgm, type SongId } from './audio'
import { animTex, hasAnimSet, portraitTex, stillTex, type AnimSetId } from './heroAnims'
import { buzz, HAPTIC } from './phone'
import { shakeHoney, type Mini } from './minigames'

/**
 * In-engine cutscene player (SNES style): a small stage in the top two thirds,
 * dialogue box + portrait at the bottom, typewriter text with per-speaker blips.
 * Scripts live in data/story.json. Advance: F / J / A / Space / 攻. Skip all: Enter / Esc / Start.
 */

type Step =
  | { bg: 'day' | 'dusk' | 'night' }
  | { music: SongId | 'stop' }
  | { prop: string; kind: string; x: number; drop?: boolean }
  /** `grey: true` = drained (hollow frames); a number = partly grey (0..1). */
  | { actor: string; x: number; flip?: boolean; grey?: boolean | number; lift?: number }
  | { move: string; x: number; ms: number }
  | { say: string; text: string; face?: 0 | 1 | 2 }
  | { wait: number }
  /** Phone-feel overlay (minigames.ts): shake the phone to mix the honey. */
  | { minigame: 'shake' }
  | { hop: string }
  | { ear: string }
  | { grey: string; ms: number }
  | { colour: string; amount: number; ms: number }
  | { droop: string }
  | { remove: string }
  | { fx: 'shadow' | 'flash' | 'shake' }
  | { sfx: 'gulp' | 'sparkle' | 'dread' | 'coin' }
  | { card: string; sub?: string }
  /** Full-screen illustration over the stage (dialogue stays on top). `null` fades it out. */
  | { still: string | null; text?: string }
  /** Play one of an actor's own animations (e.g. the queen's `defeat`). */
  | { anim: string; name: string }

/** `stage: 'tree'` draws the 蜜樹丘 interior instead of the 百畝樹林 path. */
type Scene = { title: string; stage?: 'forest' | 'tree' | 'market'; steps: Step[] }
const STORY = storyRaw as unknown as { scenes: Record<string, Scene> }

export type CutsceneId = 'C1' | 'C2' | 'C3' | 'B2' | 'C4' | 'C5' | 'B3' | 'C6' | 'C7' | 'C9' | 'C8' | 'C10' | 'C10' | 'C11' | 'C11_PERFECT'
/** Who can talk: name, stage sprite (anim set / still), portrait strip and blip pitch. */
type CastEntry = { name: string; set: AnimSetId | null; tex: string | null; portrait: string | null; pitch: number; color: string; idle?: string }
const CAST: Record<string, CastEntry> = {
  narr: { name: '', set: null, tex: null, portrait: null, pitch: 380, color: '#d8c8a8' },
  lunbo: { name: '倫寶', set: 'lunbo', tex: 'art-salmon', portrait: 'lunbo', pitch: 300, color: '#ffb070' },
  kibobo: { name: '琪寶寶', set: 'kibobo', tex: 'art-girl', portrait: 'kibobo', pitch: 560, color: '#ffd0e0' },
  pupu: { name: '噗噗', set: 'pupu', tex: 'art-bear', portrait: 'pupu', pitch: 760, color: '#ffe08a' },
  mama: { name: '咖啡媽媽', set: null, tex: 'cs-mama', portrait: 'coffee-mama', pitch: 440, color: '#b0e0d0' },
  queen: { name: '蜜冠女王蜂', set: 'queen', tex: null, portrait: 'queen-bee', pitch: 250, color: '#ffcc44', idle: 'hover' },
  /** Under the fake honey: no friendly portrait. */
  queenEvil: { name: '蜜冠女王蜂', set: 'queen', tex: null, portrait: null, pitch: 180, color: '#ff9a3a', idle: 'hover' },
  owl: { name: '月橋鏡鴞', set: 'mirrorowl', tex: null, portrait: 'mirror-owl', pitch: 220, color: '#d8e0ff', idle: 'perch' },
  owlEvil: { name: '月橋鏡鴞', set: 'mirrorowl', tex: null, portrait: 'mirror-owl-evil', pitch: 160, color: '#b8c0ff', idle: 'perch' },
  /** △畝大佬: no painted portrait yet (C10 reuses the c7-boss full-screen still instead). */
  triboss: { name: '△畝大佬', set: null, tex: null, portrait: null, pitch: 140, color: '#ff6a4a' },
}

const PROP_TEX: Record<string, string> = {
  cart: 'cs-cart',
  picnic: 'cs-picnic',
  'jar-fake': 'cs-jar-fake',
  'jar-real': 'cs-jar-real',
  note: 'cs-note',
}

const FLOOR = 240
const BOX_Y = 256
const GREY = { r: 0x7a, g: 0x7a, b: 0x80 }

/** `hollow`: showing the grey 噗噗 frames (colour lost) instead of a tint. */
type Actor = { img: Phaser.GameObjects.Sprite; grey: number; set: AnimSetId | null; hollow: boolean; idle: string }

export function playCutscene(scene: Phaser.Scene, id: CutsceneId, onDone: () => void): { destroy: () => void } {
  const data = STORY.scenes[id]
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 220)
  const actors = new Map<string, Actor>()
  const props = new Map<string, Phaser.GameObjects.Image>()
  let dead = false
  let finished = false

  // ── Stage ──────────────────────────────────────────────────────────────
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0))
  const market = data.stage === 'market' && scene.textures.exists('story-market-far')
  const tree = market || (data.stage === 'tree' && scene.textures.exists('story-canopy-far'))
  if (market) {
    root.add(scene.add.image(GAME_W / 2, GAME_H / 2, 'story-market-far').setTint(0xb0b0d0))
    if (scene.textures.exists('s3-market-ground')) root.add(scene.add.tileSprite(0, FLOOR - 2, GAME_W, 40, 's3-market-ground').setOrigin(0).setTint(0x9090b0))
  } else if (tree) {
    root.add(scene.add.image(GAME_W / 2, FLOOR + 30, 'story-canopy-far').setOrigin(0.5, 1))
    if (scene.textures.exists('s2-bark-ground')) root.add(scene.add.tileSprite(0, FLOOR - 4, GAME_W, 40, 's2-bark-ground').setOrigin(0))
  } else if (scene.textures.exists('bg-wallpaper')) {
    root.add(scene.add.image(GAME_W / 2, FLOOR + 6, 'bg-wallpaper').setOrigin(0.5, 1))
  }
  if (!tree && scene.textures.exists('bg-bush-strip')) {
    const bh = scene.textures.get('bg-bush-strip').get().height
    root.add(scene.add.tileSprite(0, FLOOR + 4 - bh, GAME_W, bh, 'bg-bush-strip').setOrigin(0))
  }
  if (tree) {
    /* bark floor drawn above */
  } else if (scene.textures.exists('tile-ground-top')) {
    root.add(scene.add.tileSprite(0, FLOOR, GAME_W, 40, 'tile-ground-top').setOrigin(0))
  } else {
    root.add(scene.add.rectangle(0, FLOOR, GAME_W, 40, 0x6b4428).setOrigin(0))
  }
  const propLayer = scene.add.container(0, 0)
  const actorLayer = scene.add.container(0, 0)
  const tint = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0).setOrigin(0)
  const fxLayer = scene.add.container(0, 0)
  const stillLayer = scene.add.container(0, 0)
  root.add([propLayer, actorLayer, tint, fxLayer, stillLayer])
  let still: Phaser.GameObjects.Container | null = null

  // ── Dialogue box ───────────────────────────────────────────────────────
  const box = scene.add.rectangle(8, BOX_Y, GAME_W - 16, GAME_H - BOX_Y - 8, 0x1a1210, 0.94).setOrigin(0).setStrokeStyle(2, 0xe0b86a)
  const frame = scene.add.rectangle(18, BOX_Y + 10, 76, 76, 0x2e2018, 1).setOrigin(0).setStrokeStyle(1, 0x8a6a40)
  const portrait = scene.add.image(20, BOX_Y + 12, '__DEFAULT').setOrigin(0, 0).setVisible(false)
  // Alan: the opening/story dialogue text read too small — bumped 13/15px → 14/17px
  // (confirmed against a live render, not just the number) and nudged the body down a
  // touch so the taller line-height still clears the name row.
  const nameText = scene.add.text(106, BOX_Y + 7, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a' })
  const bodyText = scene.add.text(106, BOX_Y + 29, '', {
    fontFamily: FONT_UI,
    fontSize: '17px',
    color: '#fff6e0',
    lineSpacing: 5,
    wordWrap: { width: GAME_W - 140, useAdvancedWrap: true },
  })
  const nextMark = scene.add.text(GAME_W - 26, GAME_H - 26, '▼', { fontFamily: FONT_UI, fontSize: '12px', color: '#e0b86a' }).setVisible(false)
  const skipHint = scene.add
    .text(GAME_W - 8, 6, '跳過 ▶▶', {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: '#f0dcb0',
      backgroundColor: '#1a1210c0',
      padding: { x: 8, y: 4 },
    })
    .setOrigin(1, 0)
    .setAlpha(0.8)
    .setInteractive({ useHandCursor: true })
  const dialog = scene.add.container(0, 0, [box, frame, portrait, nameText, bodyText, nextMark]).setVisible(false)
  root.add([dialog, skipHint])
  scene.tweens.add({ targets: nextMark, y: '+=3', duration: 300, yoyo: true, repeat: -1 })

  // ── Input ──────────────────────────────────────────────────────────────
  // Event listeners (not addKey): Key objects are shared with GameScene, so destroying
  // them on cleanup would break the player's own controls.
  const kb = scene.input.keyboard
  let advanceFlag = false
  let mini: Mini | null = null
  const ADV = new Set(['f', 'j', 'a', ' ', 'k'])
  const SKIP = new Set(['Enter', 'Escape'])
  const onKey = (ev: KeyboardEvent) => {
    if (dead) return
    if (SKIP.has(ev.key)) return finish()
    if (ADV.has(ev.key.toLowerCase())) advanceFlag = true
  }
  kb?.on('keydown', onKey)
  // Phones: tap anywhere = next line; tap 「跳過」 = skip the scene.
  skipHint.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.()
    if (!dead) finish()
  })
  const onTap = () => {
    if (!dead) advanceFlag = true
  }
  scene.input.on('pointerdown', onTap)
  const poll = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (dead) return
      if (TouchInput.justPressed('start')) return finish()
      if (mini) return
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) advanceFlag = true
    },
  })

  // ── Helpers ────────────────────────────────────────────────────────────
  const wait = (ms: number) =>
    new Promise<void>((res) => {
      if (dead) return res()
      scene.time.delayedCall(ms, () => res())
    })
  const tween = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
    new Promise<void>((res) => {
      if (dead) return res()
      scene.tweens.add({ ...cfg, onComplete: () => res() })
    })
  const applyGrey = (a: Actor) => {
    const k = Phaser.Math.Clamp(a.grey, 0, 1)
    const r = Math.round(255 + (GREY.r - 255) * k)
    const g = Math.round(255 + (GREY.g - 255) * k)
    const b = Math.round(255 + (GREY.b - 255) * k)
    if (k <= 0.001) a.img.clearTint()
    else a.img.setTint((r << 16) | (g << 8) | b)
  }
  const greyTo = (a: Actor, to: number, ms: number) => {
    const o = { v: a.grey }
    return tween({
      targets: o,
      v: to,
      duration: ms,
      onUpdate: () => {
        a.grey = o.v
        applyGrey(a)
      },
    })
  }

  const showLine = async (who: string, text: string, face = 0) => {
    const c = CAST[who] ?? CAST.narr!
    dialog.setVisible(true)
    nameText.setText(c.name).setColor(c.color)
    const narr = !c.name
    frame.setVisible(!narr)
    bodyText.setX(narr ? 24 : 106).setY(narr ? BOX_Y + 22 : BOX_Y + 30)
    bodyText.setWordWrapWidth(narr ? GAME_W - 56 : GAME_W - 140)
    bodyText.setColor(narr ? '#e8dcc0' : '#fff6e0')
    // Portrait strip (neutral / happy / shocked). Grey 噗噗 uses the hollow strip.
    portrait.setVisible(false)
    const actorNow = actors.get(who)
    const pid = who === 'pupu' && actorNow && actorNow.grey > 0.5 ? 'pupu-hollow' : c.portrait
    if (pid && scene.textures.exists(portraitTex(pid))) {
      portrait.setTexture(portraitTex(pid), face).clearTint()
      portrait.setVisible(true)
    }
    // Speaker bounce on stage.
    const a = actors.get(who)
    if (a) scene.tweens.add({ targets: a.img, y: FLOOR - 3, duration: 90, yoyo: true })
    nextMark.setVisible(false)
    advanceFlag = false
    const chars = Array.from(text)
    let shown = 0
    while (shown < chars.length && !dead) {
      if (advanceFlag) {
        advanceFlag = false
        shown = chars.length
        break
      }
      shown++
      bodyText.setText(chars.slice(0, shown).join(''))
      const ch = chars[shown - 1]!
      if (!/[\s，。！？、…「」—・：]/.test(ch) && shown % 2 === 1) SFX.blip(c.pitch)
      await wait(/[，。！？…]/.test(ch) ? 140 : 38)
    }
    if (dead) return
    bodyText.setText(text)
    nextMark.setVisible(true)
    // Wait for a press, or auto-advance so an unattended screen still plays through.
    const until = scene.time.now + 2200 + chars.length * 45
    while (!dead && !advanceFlag && scene.time.now < until) await wait(30)
    advanceFlag = false
    if (!dead) nextMark.setVisible(false)
  }

  const run = async (s: Step) => {
    if ('bg' in s) {
      const map = { day: [0x000000, 0], dusk: [0xff8030, 0.16], night: [0x101040, 0.45] } as const
      const [col, a] = map[s.bg]
      tint.setFillStyle(col, a)
    } else if ('music' in s) {
      if (s.music === 'stop') stopBgm()
      else playSong(s.music)
    } else if ('prop' in s) {
      const key = PROP_TEX[s.kind]
      if (!key || !scene.textures.exists(key)) return
      const img = scene.add.image(s.x, FLOOR + (s.kind === 'picnic' ? 4 : 0), key).setOrigin(0.5, 1)
      propLayer.add(img)
      props.set(s.prop, img)
      if (s.drop) {
        img.y = -20
        SFX.coin()
        await tween({ targets: img, y: FLOOR - (s.kind === 'note' ? 0 : 2), duration: 520, ease: 'Bounce.out' })
      }
    } else if ('actor' in s) {
      const c = CAST[s.actor]
      if (!c) return
      const set = c.set && hasAnimSet(scene, c.set) ? c.set : null
      if (!set && (!c.tex || !scene.textures.exists(c.tex))) return
      const img = scene.add.sprite(s.x, FLOOR - (s.lift ?? 0), set ? animTex(set) : c.tex!).setOrigin(0.5, 1).setFlipX(!!s.flip)
      actorLayer.add(img)
      const a: Actor = { img, grey: s.grey === true ? 1 : typeof s.grey === 'number' ? s.grey : 0, set, hollow: false, idle: c.idle ?? 'idle' }
      actors.set(s.actor, a)
      if (s.grey === true && set === 'pupu' && scene.anims.exists('pupu-hollow-idle')) {
        a.hollow = true
        img.play('pupu-hollow-idle')
      } else {
        if (set) img.play(`${set}-${a.idle}`)
        applyGrey(a)
        if (s.grey === true) img.setAngle(8).setY(FLOOR + 2)
      }
    } else if ('move' in s) {
      const a = actors.get(s.move)
      if (a) {
        a.img.setFlipX(s.x < a.img.x)
        const walk = a.set === 'kibobo' ? 'kibobo-run' : a.set ? `${a.set}-walk` : null
        if (walk && !a.hollow && scene.anims.exists(walk)) a.img.play(walk)
        await tween({ targets: a.img, x: s.x, duration: s.ms })
        if (!dead && a.set && !a.hollow) a.img.play(`${a.set}-${a.idle}`)
      }
    } else if ('anim' in s) {
      const a = actors.get(s.anim)
      const key = a?.set ? `${a.set}-${s.name}` : ''
      if (a && scene.anims.exists(key)) {
        a.img.play(key)
        a.idle = s.name
      }
    } else if ('say' in s) {
      await showLine(s.say, s.text, s.face ?? 0)
    } else if ('minigame' in s) {
      dialog.setVisible(false)
      mini = shakeHoney(scene)
      await mini.done
      mini = null
      advanceFlag = false
    } else if ('wait' in s) {
      await wait(s.wait)
    } else if ('hop' in s) {
      const a = actors.get(s.hop)
      if (a) {
        SFX.jump()
        await tween({ targets: a.img, y: FLOOR - 12, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.out' })
      }
    } else if ('ear' in s) {
      const a = actors.get(s.ear)
      if (a) {
        SFX.blip(980)
        await tween({ targets: a.img, angle: a.img.angle - 6, duration: 90, yoyo: true, repeat: 1 })
      }
    } else if ('grey' in s) {
      const a = actors.get(s.grey)
      if (a) {
        SFX.powerDown()
        buzz(HAPTIC.heartbeat)
        await greyTo(a, 1, s.ms)
        if (dead) return
        // Fully drained: swap to the hollow frames (empty eyes, dripping fake honey).
        if (a.set === 'pupu' && scene.anims.exists('pupu-hollow-idle')) {
          a.hollow = true
          a.img.clearTint().setAngle(0).setY(FLOOR).play('pupu-hollow-idle')
          scene.cameras.main.flash(120, 40, 40, 48)
        }
      }
    } else if ('colour' in s) {
      const a = actors.get(s.colour)
      if (a) {
        SFX.sparkle()
        const b = a.img
        for (let i = 0; i < 6; i++) {
          const d = scene.add.circle(b.x + Phaser.Math.Between(-14, 14), b.y - Phaser.Math.Between(10, 50), 2, 0xffe890)
          fxLayer.add(d)
          scene.tweens.add({ targets: d, y: d.y - 20, alpha: 0, duration: 900, delay: i * 80, onComplete: () => d.destroy() })
        }
        if (a.hollow && a.set) {
          // Colour starts coming back: normal frames, still mostly grey.
          a.hollow = false
          a.img.setAngle(0).setY(FLOOR).play(`${a.set}-idle`)
          applyGrey(a)
        }
        await greyTo(a, Math.max(0, a.grey - s.amount), s.ms)
      }
    } else if ('droop' in s) {
      const a = actors.get(s.droop)
      if (a && !a.hollow) await tween({ targets: a.img, angle: 8, y: FLOOR + 2, duration: 500, ease: 'Sine.out' })
    } else if ('remove' in s) {
      const p = props.get(s.remove)
      if (p) {
        await tween({ targets: p, alpha: 0, duration: 180 })
        if (!dead) p.destroy()
        props.delete(s.remove)
      }
    } else if ('fx' in s) {
      if (s.fx === 'flash') scene.cameras.main.flash(160, 255, 255, 255)
      else if (s.fx === 'shake') scene.cameras.main.shake(200, 0.006)
      else {
        // Giant triangle shadow sweeps the canopy; the forest dims and stays dim.
        SFX.dread()
        const tri = scene.add.triangle(GAME_W + 260, 40, 0, 220, 170, 0, 340, 220, 0x000000, 0.62).setOrigin(0.5, 0)
        fxLayer.add(tri)
        scene.tweens.add({ targets: tint, fillAlpha: 0.42, duration: 900 })
        tint.setFillStyle(0x100818, tint.fillAlpha)
        scene.cameras.main.shake(1600, 0.0025)
        await tween({ targets: tri, x: -300, duration: 2000, ease: 'Sine.inOut' })
        if (!dead) tri.destroy()
      }
    } else if ('sfx' in s) {
      SFX[s.sfx]()
    } else if ('still' in s) {
      if (still) {
        const old = still
        still = null
        await tween({ targets: old, alpha: 0, duration: 350 })
        old.destroy()
      }
      if (s.still && scene.textures.exists(stillTex(s.still))) {
        const c = scene.add.container(0, 0).setAlpha(0)
        c.add(scene.add.image(GAME_W / 2, GAME_H / 2, stillTex(s.still)))
        if (s.text) {
          // Words written on the illustration (e.g. the note) — never baked into the art.
          c.add(
            scene.add
              .text(GAME_W / 2, GAME_H / 2 - 8, s.text, { fontFamily: FONT_UI, fontSize: '20px', color: '#3a2414', align: 'center', lineSpacing: 10 })
              .setOrigin(0.5),
          )
        }
        stillLayer.add(c)
        still = c
        await tween({ targets: c, alpha: 1, duration: 450 })
      }
    } else if ('card' in s) {
      dialog.setVisible(false)
      const black = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0).setOrigin(0)
      const t1 = scene.add
        .text(GAME_W / 2, GAME_H / 2 - 14, s.card, { fontFamily: FONT_TITLE, fontSize: '32px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 4 })
        .setOrigin(0.5)
        .setAlpha(0)
      const t2 = scene.add
        .text(GAME_W / 2, GAME_H / 2 + 22, s.sub ?? '', { fontFamily: FONT_UI, fontSize: '14px', color: '#f3e6c8' })
        .setOrigin(0.5)
        .setAlpha(0)
      fxLayer.add([black, t1, t2])
      await tween({ targets: black, fillAlpha: 1, duration: 500 })
      SFX.boss()
      await tween({ targets: [t1, t2], alpha: 1, duration: 400 })
      await wait(1600)
      await tween({ targets: [t1, t2], alpha: 0, duration: 400 })
    }
  }

  function cleanup() {
    dead = true
    mini?.destroy()
    mini = null
    poll.remove(false)
    kb?.off('keydown', onKey)
    scene.input?.off('pointerdown', onTap)
    // During scene shutdown the containers may already be torn down — guard every list.
    try {
      const objs = [actorLayer, propLayer, fxLayer].flatMap((c) => (c?.list ? [...c.list] : []))
      scene.tweens?.killTweensOf([...objs, tint, nextMark])
    } catch {
      /* scene already shutting down */
    }
    if (root.active !== false && root.scene) root.destroy(true)
  }
  function finish() {
    if (finished) return
    finished = true
    cleanup()
    onDone()
  }

  void (async () => {
    root.setAlpha(0)
    await tween({ targets: root, alpha: 1, duration: 400 })
    for (const s of data?.steps ?? []) {
      if (dead) return
      await run(s)
    }
    if (!dead) finish()
  })()

  return {
    destroy: () => {
      if (finished) return
      finished = true
      cleanup()
    },
  }
}
