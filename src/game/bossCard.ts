import Phaser from 'phaser'
import bossesRaw from '../../data/bosses.json'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import { portraitTex } from './heroAnims'

/**
 * Boss 來歷卡 (docs/bible/story.md §7): before the fight, say who this boss is and why
 * this stage's enemies exist — so the mooks read as designed, not placed.
 * Skippable with any button; auto-advances so an unattended screen still plays through.
 */

export type BossId = 'altar' | 'queen' | 'mirrorowl' | 'mudmane' | 'triboss'
type Entry = { name: string; title: string; portrait: string | null; lines: string[]; why: string }
const BOSSES = (bossesRaw as unknown as { bosses: Record<string, Entry> }).bosses

export function hasBossCard(id: string): id is BossId {
  return !!BOSSES[id]
}

export function playBossCard(scene: Phaser.Scene, id: BossId, onDone: () => void): { destroy: () => void } {
  const b = BOSSES[id]
  if (!b) {
    onDone()
    return { destroy: () => undefined }
  }
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 300)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 1).setOrigin(0).setInteractive())

  // Card frame: a dark board with a thin gold edge (matches the clear-card lacquer).
  const g = scene.add.graphics()
  g.fillStyle(0xc8902a, 1).fillRect(34, 40, GAME_W - 68, GAME_H - 86)
  g.fillStyle(0x140d16, 0.98).fillRect(37, 43, GAME_W - 74, GAME_H - 92)
  g.fillStyle(0x3a2616, 1).fillRect(37, 43, GAME_W - 74, 3)
  root.add(g)

  const items: Phaser.GameObjects.GameObject[] = []
  const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
    root.add(o)
    items.push(o)
    return o
  }

  if (b.portrait && scene.textures.exists(portraitTex(b.portrait))) {
    const p = add(scene.add.image(90, 112, portraitTex(b.portrait), 0).setOrigin(0.5).setScale(1.1).setAlpha(0))
    scene.tweens.add({ targets: p, alpha: 1, duration: 420 })
  }
  const nameX = b.portrait ? 150 : GAME_W / 2
  const originX = b.portrait ? 0 : 0.5
  const name = add(
    scene.add
      .text(nameX, 84, b.name, { fontFamily: FONT_TITLE, fontSize: '26px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
      .setOrigin(originX, 0.5)
      .setAlpha(0),
  )
  const title = add(
    scene.add.text(nameX, 112, b.title, { fontFamily: FONT_UI, fontSize: '12px', color: '#d8b8ff' }).setOrigin(originX, 0.5).setAlpha(0),
  )
  const body = add(
    scene.add
      .text(GAME_W / 2, 176, '', {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: '#fff6e0',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: GAME_W - 110 },
      })
      .setOrigin(0.5, 0),
  )
  const why = add(
    scene.add
      .text(GAME_W / 2, GAME_H - 78, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffb070', align: 'center', wordWrap: { width: GAME_W - 110 } })
      .setOrigin(0.5, 0),
  )
  const skip = add(
    scene.add.text(GAME_W - 44, GAME_H - 34, '撳掣跳過 ▶▶', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8b090' }).setOrigin(1, 0.5),
  )
  void skip

  let dead = false
  let pressed = false
  const press = () => {
    pressed = true
  }
  const onKey = () => press()
  scene.input.keyboard?.on('keydown', onKey)
  scene.input.on('pointerdown', press)
  const poll = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (dead) return
      if (TouchInput.justPressed('attack') || TouchInput.justPressed('jump') || TouchInput.justPressed('start')) press()
    },
  })

  const wait = (ms: number) =>
    new Promise<void>((res) => {
      if (dead) return res()
      scene.time.delayedCall(ms, () => res())
    })
  /** Resolves early when a button is pressed. */
  const waitOrPress = async (ms: number) => {
    const until = scene.time.now + ms
    while (!dead && !pressed && scene.time.now < until) await wait(24)
    if (pressed) {
      pressed = false
      return true
    }
    return false
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

  void (async () => {
    SFX.dread()
    scene.tweens.add({ targets: [name, title], alpha: 1, duration: 420, delay: 120 })
    if (await waitOrPress(700)) return finish()
    for (const line of b.lines) {
      const prev = body.text
      body.setText(prev ? `${prev}\n${line}` : line)
      SFX.blip(260)
      if (await waitOrPress(900)) return finish()
    }
    why.setText(b.why)
    SFX.boss()
    if (await waitOrPress(2200)) return finish()
    finish()
  })()

  return { destroy: () => finish() }
}
