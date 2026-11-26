import Phaser from 'phaser'
import { GAME_W } from './display'
import { playSong, SFX, unlockAudio } from './audio'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { showTutorial, type RoundResult } from './minigames'
import { gradeResult, showGradeResult } from './minigameFramework'
import {
  startTransitGame,
  TRANSIT_BY_LEG,
  TRANSIT_META,
  type TransitId,
} from './transitMinigames'
import { stageTitle } from './stageNames'

/**
 * Transition minigames between stages (mini-3).
 * Routed from WorldMapScene when next === 'transit'. Skip → bronze.
 */
export class TransitScene extends Phaser.Scene {
  private toStage = 2
  private leaving = false
  private mini: { done: Promise<RoundResult>; destroy: () => void } | null = null
  private transitId: TransitId = 'bike-climb'

  constructor() {
    super('transit')
  }

  init(data?: { from?: number; to?: number }) {
    const from = data?.from ?? 1
    const to = data?.to ?? from + 1
    this.toStage = to
    const id = TRANSIT_BY_LEG[`${from}-${to}`]
    this.transitId = id ?? 'bike-climb'
  }

  preload() {
    const imgs: Array<[string, string]> = [
      ['mg-cone', '/art/minigames/searchlight-cone.png'],
      ['mg-cam', '/art/minigames/camera-frame.png'],
      ['mg-puzzle', '/art/minigames/puzzle-cell.png'],
    ]
    for (const [k, url] of imgs) {
      if (!this.textures.exists(k)) this.load.image(k, url)
    }
    const sheets: Array<[string, string, number, number]> = [
      ['mg-kite', '/art/minigames/kite.png', 28, 32],
      ['mg-bird', '/art/minigames/bird.png', 24, 20],
      ['mg-ferry', '/art/minigames/ferry.png', 24, 20],
      ['mg-wave', '/art/minigames/wave.png', 48, 24],
      ['mg-flash', '/art/minigames/flash.png', 32, 32],
    ]
    for (const [k, url, fw, fh] of sheets) {
      if (!this.textures.exists(k)) this.load.spritesheet(k, url, { frameWidth: fw, frameHeight: fh })
    }
  }

  create() {
    this.leaving = false
    this.mini = null
    unlockAudio()
    const songKey = `stage${Math.min(10, Math.max(1, this.toStage))}` as 'stage1'
    try {
      playSong(songKey)
    } catch {
      /* song optional */
    }
    this.cameras.main.setBackgroundColor('#0c0814')
    this.cameras.main.fadeIn(350, 12, 8, 20)

    const meta = TRANSIT_META[this.transitId]
    const dest = stageTitle(this.toStage) ?? `第${this.toStage}關`
    this.add
      .text(GAME_W / 2, 28, meta.name, {
        fontFamily: FONT_TITLE,
        fontSize: '18px',
        color: '#ffe08a',
        stroke: '#2a1408',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 50, `去${dest}`, {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#c8b090',
      })
      .setOrigin(0.5)

    const kb = this.input.keyboard
    const skip = () => this.leave(null, true)
    kb?.on('keydown-ESC', skip)
    this.events.once('shutdown', () => kb?.off('keydown-ESC', skip))
    mountTouchControls(this)
    void this.run()
  }

  private async run() {
    const meta = TRANSIT_META[this.transitId]
    const choice = await showTutorial(this, `transit-${this.transitId}`, [
      { title: meta.name, lines: [meta.hint], tip: meta.tip },
    ])
    if (this.leaving || !this.scene.isActive()) return
    if (choice === 'skip') return this.leave(null, true)

    this.mini = startTransitGame(this, this.transitId)
    const r = await this.mini.done
    if (this.leaving || !this.scene.isActive()) return
    this.leave(r, false)
  }

  private leave(r: RoundResult | null, skipped: boolean) {
    if (this.leaving) return
    this.leaving = true
    this.mini?.destroy()
    this.mini = null

    this.registry.set('stageNo', this.toStage)

    const meta = TRANSIT_META[this.transitId]
    const graded = r
      ? gradeResult(r.good, r.total, meta.kind, false, this.transitId)
      : gradeResult(0, 12, meta.kind, true, this.transitId)

    const bumpCarryHp = () => {
      const hp = (this.registry.get('carryHp') as Partial<Record<'boy' | 'girl', number>> | undefined) ?? {}
      const next = { ...hp }
      for (const k of ['boy', 'girl'] as const) {
        if (typeof next[k] === 'number') next[k] = (next[k] as number) + 1
      }
      this.registry.set('carryHp', next)
    }

    const goPlay = () => {
      this.cameras.main.fadeOut(450, 0, 0, 0)
      this.time.delayedCall(500, () => this.scene.start('play'))
    }

    if (!skipped) SFX.win()
    void showGradeResult(this, { ...graded, skipped }, {
      title: meta.name,
      onGoldHeal: bumpCarryHp,
    }).then(goPlay)
  }
}
