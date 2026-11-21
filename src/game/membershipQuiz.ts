import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI, FONT_TITLE } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import type { Mini } from './minigames'
import quizRaw from '../../data/quiz-mall.json'

type Q = {
  id: string
  category: string
  difficulty: 'normal' | 'hard'
  prompt: string
  choices: string[]
  answerIndex: number
}

type Bank = {
  perRound: number
  scoring: { normal: { correct: number; wrong: number }; hard: { correct: number; wrong: number } }
  timeoutPenalty: number
  questions: Q[]
}

const BANK = quizRaw as unknown as Bank

export type GoldfishResult = { coins: number; correct: number; wrong: number; skipped: number }

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function pickRound(rng: () => number): Q[] {
  const normals = BANK.questions.filter((q) => q.difficulty !== 'hard')
  const hards = BANK.questions.filter((q) => q.difficulty === 'hard')
  const six = shuffle(normals, rng).slice(0, 6)
  const last = shuffle(hards, rng)[0] ?? six[0]!
  return [...six, last]
}

/**
 * 會員中心・金魚眼搶答（C2 頭兩關攤檔）。
 * 右邊大紅掣搶答；單人對假對手；冇人搶 → skip；搶中限時作答，超時扣小小幣。
 */
export function goldfishQuiz(scene: Phaser.Scene): Mini<GoldfishResult> {
  let killed = false
  let resolve!: (r: GoldfishResult) => void
  const done = new Promise<GoldfishResult>((r) => {
    resolve = r
  })

  const rng = () => Math.random()
  const round = pickRound(rng)
  const scoring = BANK.scoring
  const timeoutPenalty = BANK.timeoutPenalty ?? -2

  let coins = 0
  let correct = 0
  let wrong = 0
  let skipped = 0
  let qi = 0

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 280)
  root.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a1218, 0.88).setOrigin(0).setInteractive())

  const panel = scene.add.graphics()
  panel.fillStyle(0xc8902a, 1).fillRoundedRect(28, 36, GAME_W - 56, GAME_H - 72, 10)
  panel.fillStyle(0x142028, 1).fillRoundedRect(32, 40, GAME_W - 64, GAME_H - 80, 8)
  root.add(panel)

  const title = scene.add
    .text(GAME_W / 2, 58, '會員中心・金魚眼搶答', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#ffd76a',
      stroke: '#1a0c08',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  const progress = scene.add
    .text(GAME_W / 2, 82, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#9ec8e0' })
    .setOrigin(0.5)
  const prompt = scene.add
    .text(GAME_W / 2, 118, '', {
      fontFamily: FONT_UI,
      fontSize: '15px',
      color: '#fff6e0',
      align: 'center',
      wordWrap: { width: GAME_W - 120 },
    })
    .setOrigin(0.5, 0)
  const status = scene.add
    .text(GAME_W / 2, 188, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#8ad0ff' })
    .setOrigin(0.5)
  const coinHud = scene.add
    .text(72, 58, '幣 0', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffe08a' })
    .setOrigin(0, 0.5)

  root.add([title, progress, prompt, status, coinHud])

  const choiceBtns: Phaser.GameObjects.Container[] = []
  const choiceLabels: Phaser.GameObjects.Text[] = []
  for (let i = 0; i < 4; i++) {
    const y = 220 + i * 28
    const bg = scene.add.rectangle(GAME_W / 2, y, GAME_W - 140, 24, 0x243848, 1).setStrokeStyle(2, 0x6a90a8)
    const tx = scene.add
      .text(GAME_W / 2, y, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#f0f6ff' })
      .setOrigin(0.5)
    const c = scene.add.container(0, 0, [bg, tx])
    bg.setInteractive({ useHandCursor: true })
    choiceBtns.push(c)
    choiceLabels.push(tx)
    root.add(c)
    c.setVisible(false)
  }

  // Big red buzz button (right side, exaggerated arcade).
  const buzzX = GAME_W - 70
  const buzzY = GAME_H / 2 + 10
  const buzzHalo = scene.add.circle(buzzX, buzzY, 42, 0xff4060, 0.25)
  const buzzBtn = scene.add.circle(buzzX, buzzY, 34, 0xe01828, 1).setStrokeStyle(4, 0xffe080)
  const buzzLabel = scene.add
    .text(buzzX, buzzY, '搶', {
      fontFamily: FONT_TITLE,
      fontSize: '22px',
      color: '#fff8e0',
      stroke: '#400008',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  root.add([buzzHalo, buzzBtn, buzzLabel])
  buzzBtn.setInteractive({ useHandCursor: true })
  scene.tweens.add({
    targets: buzzHalo,
    scale: { from: 1, to: 1.18 },
    alpha: { from: 0.35, to: 0.12 },
    duration: 650,
    yoyo: true,
    repeat: -1,
  })

  const skipTxt = scene.add
    .text(GAME_W / 2, GAME_H - 28, 'Start／Esc 可略過整局', {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: '#8a9aaa',
    })
    .setOrigin(0.5)
  root.add(skipTxt)

  type Phase = 'buzz' | 'answer' | 'resolve' | 'done'
  let phase: Phase = 'buzz'
  let buzzOpen = 0
  let answerLeft = 0
  let playerBuzzed = false
  let rivalBuzzAt = 0
  let lockedChoices = false
  let keys: Phaser.Input.Keyboard.Key[] = []

  const refreshCoin = () => {
    coinHud.setText(`幣 ${coins}`)
  }

  const setChoicesVisible = (on: boolean) => {
    for (const c of choiceBtns) c.setVisible(on)
  }

  const paintChoices = (q: Q) => {
    const letters = ['A', 'B', 'C', 'D']
    for (let i = 0; i < 4; i++) {
      choiceLabels[i]!.setText(`${letters[i]}  ${q.choices[i] ?? ''}`)
      const bg = choiceBtns[i]!.list[0] as Phaser.GameObjects.Rectangle
      bg.setFillStyle(0x243848, 1)
    }
  }

  const finish = (r: GoldfishResult) => {
    if (killed) return
    killed = true
    cleanup()
    resolve(r)
  }

  const cleanup = () => {
    scene.input.keyboard?.off('keydown-ESC')
    scene.input.keyboard?.off('keydown-ENTER')
    for (const k of keys) k.destroy()
    root.destroy(true)
  }

  const scoreFor = (q: Q, ok: boolean) => {
    const table = q.difficulty === 'hard' ? scoring.hard : scoring.normal
    return ok ? table.correct : table.wrong
  }

  const applyDelta = (n: number) => {
    coins = Math.max(0, coins + n)
    refreshCoin()
  }

  const nextQuestion = () => {
    if (qi >= round.length) {
      phase = 'done'
      status.setText(`完！今局金幣 ${coins}`)
      scene.time.delayedCall(900, () => finish({ coins, correct, wrong, skipped }))
      return
    }
    const q = round[qi]!
    phase = 'buzz'
    playerBuzzed = false
    lockedChoices = false
    setChoicesVisible(false)
    progress.setText(`第 ${qi + 1}／${round.length} 題${q.difficulty === 'hard' ? '（難題）' : ''}`)
    prompt.setText(q.prompt)
    status.setText('撳右邊紅掣搶答！')
    paintChoices(q)
    buzzOpen = 3200
    rivalBuzzAt = 900 + Math.floor(rng() * (q.difficulty === 'hard' ? 1600 : 1100))
    buzzBtn.setFillStyle(0xe01828, 1)
  }

  const beginAnswer = (who: 'player' | 'rival') => {
    phase = 'answer'
    answerLeft = who === 'player' ? 2800 : 1600
    setChoicesVisible(who === 'player')
    status.setText(who === 'player' ? '快答！揀 A–D' : '對手搶到…')
    if (who === 'rival') {
      // Rival auto-resolves after short think — 55% correct on normal, 35% on hard.
      const q = round[qi]!
      const chance = q.difficulty === 'hard' ? 0.35 : 0.55
      scene.time.delayedCall(700 + Math.floor(rng() * 600), () => {
        if (killed || phase !== 'answer' || playerBuzzed) return
        const ok = rng() < chance
        resolveAnswer(ok, 'rival')
      })
    }
  }

  const resolveAnswer = (ok: boolean, who: 'player' | 'rival' | 'timeout') => {
    if (phase === 'resolve' || phase === 'done') return
    phase = 'resolve'
    lockedChoices = true
    setChoicesVisible(false)
    const q = round[qi]!
    if (who === 'timeout') {
      applyDelta(timeoutPenalty)
      status.setText(`超時！${timeoutPenalty} 幣`)
      SFX.hurt()
    } else if (who === 'player') {
      const d = scoreFor(q, ok)
      applyDelta(d)
      if (ok) {
        correct++
        status.setText(`啱！+${d} 幣`)
        SFX.coin()
      } else {
        wrong++
        status.setText(`錯…${d} 幣`)
        SFX.hurt()
      }
    } else {
      // Rival scored atmosphere only.
      if (ok) status.setText('對手答啱咗！')
      else status.setText('對手都答錯…')
    }
    qi++
    scene.time.delayedCall(750, () => {
      if (!killed) nextQuestion()
    })
  }

  const tryBuzz = () => {
    if (killed || phase !== 'buzz' || playerBuzzed) return
    playerBuzzed = true
    SFX.swing()
    buzzBtn.setFillStyle(0xff6080, 1)
    beginAnswer('player')
  }

  buzzBtn.on('pointerdown', () => tryBuzz())

  for (let i = 0; i < 4; i++) {
    const idx = i
    const bg = choiceBtns[i]!.list[0] as Phaser.GameObjects.Rectangle
    bg.on('pointerdown', () => {
      if (killed || phase !== 'answer' || lockedChoices || !playerBuzzed) return
      const q = round[qi]!
      resolveAnswer(idx === q.answerIndex, 'player')
    })
  }

  const kb = scene.input.keyboard
  if (kb) {
    keys = [
      kb.addKey('A'),
      kb.addKey('B'),
      kb.addKey('C'),
      kb.addKey('D'),
      kb.addKey('ONE'),
      kb.addKey('TWO'),
      kb.addKey('THREE'),
      kb.addKey('FOUR'),
      kb.addKey('SPACE'),
      kb.addKey('J'),
    ]
    kb.on('keydown-ESC', () => finish({ coins, correct, wrong, skipped }))
    kb.on('keydown-ENTER', () => {
      if (phase === 'buzz') tryBuzz()
    })
  }

  const onKey = () => {
    if (killed) return
    if (phase === 'buzz') {
      if (keys[8]?.isDown || keys[9]?.isDown || TouchInput.isDown('attack')) tryBuzz()
    } else if (phase === 'answer' && playerBuzzed && !lockedChoices) {
      const map = [
        keys[0]?.isDown || keys[4]?.isDown,
        keys[1]?.isDown || keys[5]?.isDown,
        keys[2]?.isDown || keys[6]?.isDown,
        keys[3]?.isDown || keys[7]?.isDown,
      ]
      for (let i = 0; i < 4; i++) {
        if (map[i]) {
          const q = round[qi]!
          resolveAnswer(i === q.answerIndex, 'player')
          break
        }
      }
    }
  }

  const timer = scene.time.addEvent({
    delay: 50,
    loop: true,
    callback: () => {
      if (killed) return
      onKey()
      if (TouchInput.isDown('attack') && phase === 'buzz') tryBuzz()
      if (phase === 'buzz') {
        buzzOpen -= 50
        rivalBuzzAt -= 50
        status.setText(`搶答中… ${Math.max(0, Math.ceil(buzzOpen / 1000))}s`)
        if (!playerBuzzed && rivalBuzzAt <= 0) {
          beginAnswer('rival')
          return
        }
        if (buzzOpen <= 0 && !playerBuzzed) {
          skipped++
          status.setText('冇人搶 → Skip')
          phase = 'resolve'
          qi++
          scene.time.delayedCall(500, () => {
            if (!killed) nextQuestion()
          })
        }
      } else if (phase === 'answer' && playerBuzzed) {
        answerLeft -= 50
        status.setText(`作答 ${Math.max(0, Math.ceil(answerLeft / 1000))}s`)
        if (answerLeft <= 0) resolveAnswer(false, 'timeout')
      }
    },
  })

  const origDestroy = () => {
    timer.remove(false)
    cleanup()
  }

  nextQuestion()
  refreshCoin()

  return {
    done,
    destroy: () => {
      if (killed) return
      killed = true
      origDestroy()
      resolve({ coins, correct, wrong, skipped })
    },
  }
}
