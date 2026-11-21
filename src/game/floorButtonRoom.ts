import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI, FONT_TITLE } from './ui/fonts'
import { SFX } from './audio'
import type { Mini } from './minigames'

export type FloorRoomResult = {
  ok: boolean
  timed: boolean
  coins: number
  exited: boolean
}

type FloorId = 'atrium' | 'parking' | 'member' | 'factory'

/** Optional 樓層掣迷你房 — correct answer is the P (parking) icon only (GDD). */
export function floorButtonRoom(scene: Phaser.Scene, timeLimitMs = 12000): Mini<FloorRoomResult> {
  let killed = false
  let resolve!: (r: FloorRoomResult) => void
  const done = new Promise<FloorRoomResult>((r) => {
    resolve = r
  })

  const t0 = scene.time.now
  let finished = false

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 270)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a1018, 0.92).setOrigin(0).setInteractive())

  const panel = scene.add.graphics()
  panel.fillStyle(0x3a4555, 1).fillRoundedRect(40, 40, GAME_W - 80, GAME_H - 80, 8)
  panel.fillStyle(0x1a222c, 1).fillRoundedRect(48, 48, GAME_W - 96, GAME_H - 96, 6)
  root.add(panel)

  root.add(
    scene.add
      .text(GAME_W / 2, 68, '維修房・樓層掣', {
        fontFamily: FONT_TITLE,
        fontSize: '18px',
        color: '#ffe08a',
        stroke: '#1a1008',
        strokeThickness: 4,
      })
      .setOrigin(0.5),
  )
  root.add(
    scene.add
      .text(GAME_W / 2, 94, '睇告示：撳正確樓層掣（限時有雙倍幣）', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#9ec8e0',
      })
      .setOrigin(0.5),
  )

  // Wall notice: only shows P icon as the answer cue (no "B2 停車場" text — GDD).
  const notice = scene.add.graphics()
  notice.fillStyle(0xf0e8d0, 1).fillRoundedRect(GAME_W / 2 - 70, 118, 140, 44, 4)
  notice.lineStyle(2, 0x5a4030, 1).strokeRoundedRect(GAME_W / 2 - 70, 118, 140, 44, 4)
  root.add(notice)
  root.add(
    scene.add
      .text(GAME_W / 2 - 28, 140, '請撳', { fontFamily: FONT_UI, fontSize: '13px', color: '#2a1a10' })
      .setOrigin(0.5),
  )
  const pBadge = scene.add.circle(GAME_W / 2 + 28, 140, 14, 0x1a5a9a, 1).setStrokeStyle(2, 0xffe080)
  root.add(pBadge)
  root.add(
    scene.add
      .text(GAME_W / 2 + 28, 140, 'P', {
        fontFamily: FONT_TITLE,
        fontSize: '16px',
        color: '#fff8e0',
        stroke: '#0a2030',
        strokeThickness: 3,
      })
      .setOrigin(0.5),
  )

  const floors: Array<{ id: FloorId; label: string; icon: string; correct: boolean; x: number }> = [
    { id: 'atrium', label: '中庭', icon: '◇', correct: false, x: GAME_W / 2 - 150 },
    { id: 'parking', label: '', icon: 'P', correct: true, x: GAME_W / 2 - 50 },
    { id: 'member', label: '會員', icon: '★', correct: false, x: GAME_W / 2 + 50 },
    { id: 'factory', label: '工場', icon: '⚙', correct: false, x: GAME_W / 2 + 150 },
  ]

  const timerTxt = scene.add
    .text(GAME_W / 2, GAME_H - 36, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#8ad0ff' })
    .setOrigin(0.5)
  root.add(timerTxt)
  root.add(
    scene.add
      .text(GAME_W / 2, GAME_H - 56, 'Esc／Start 離開（唔入都過到關）', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#8a9aaa',
      })
      .setOrigin(0.5),
  )

  const status = scene.add
    .text(GAME_W / 2, 290, '', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a' })
    .setOrigin(0.5)
  root.add(status)

  const finish = (r: FloorRoomResult) => {
    if (killed) return
    killed = true
    finished = true
    timer.remove(false)
    scene.input.keyboard?.off('keydown-ESC')
    root.destroy(true)
    resolve(r)
  }

  const onPick = (f: (typeof floors)[0]) => {
    if (finished || killed) return
    finished = true
    const timed = scene.time.now - t0 <= timeLimitMs
    if (f.correct) {
      SFX.coin()
      const coins = timed ? 16 : 8
      status.setText(timed ? `啱！限時通過　+${coins} 幣` : `啱！　+${coins} 幣`)
      scene.time.delayedCall(700, () => finish({ ok: true, timed, coins, exited: false }))
    } else {
      SFX.hurt()
      status.setText('錯掣…黑暗一下')
      const flash = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.UI + 271)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy(),
      })
      scene.time.delayedCall(650, () => finish({ ok: false, timed: false, coins: 0, exited: false }))
    }
  }

  for (const f of floors) {
    const y = 220
    const bg = scene.add
      .rectangle(f.x, y, 72, 64, f.correct ? 0x243848 : 0x2a3038, 1)
      .setStrokeStyle(2, 0x8aa0b0)
      .setInteractive({ useHandCursor: true })
    const icon = scene.add
      .text(f.x, y - 6, f.icon, {
        fontFamily: FONT_TITLE,
        fontSize: f.icon === 'P' ? '22px' : '18px',
        color: f.icon === 'P' ? '#ffe080' : '#d0e0f0',
      })
      .setOrigin(0.5)
    const lab = scene.add
      .text(f.x, y + 20, f.id === 'parking' ? '' : f.label, {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#b0c0d0',
      })
      .setOrigin(0.5)
    // Parking face = P icon only (Alan: 淨係 P 圖示).
    root.add(f.id === 'parking' ? [bg, icon] : [bg, icon, lab])
    bg.on('pointerdown', () => onPick(f))
  }

  const timer = scene.time.addEvent({
    delay: 100,
    loop: true,
    callback: () => {
      if (killed || finished) return
      const left = Math.max(0, timeLimitMs - (scene.time.now - t0))
      timerTxt.setText(`限時雙倍　${Math.ceil(left / 1000)}s`)
      if (left <= 0) timerTxt.setText('普通獎勵（已過限時）')
    },
  })

  scene.input.keyboard?.on('keydown-ESC', () => finish({ ok: false, timed: false, coins: 0, exited: true }))

  // Number keys 1–4
  const kb = scene.input.keyboard
  const binds = kb
    ? [kb.addKey('ONE'), kb.addKey('TWO'), kb.addKey('THREE'), kb.addKey('FOUR')]
    : []
  scene.time.addEvent({
    delay: 50,
    loop: true,
    callback: () => {
      if (killed || finished) return
      for (let i = 0; i < 4; i++) {
        if (binds[i]?.isDown) onPick(floors[i]!)
      }
    },
  })

  return {
    done,
    destroy: () => finish({ ok: false, timed: false, coins: 0, exited: true }),
  }
}
