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

export type GoldfishResult = {
  coins: number
  correct: number
  wrong: number
  skipped: number
  /** 2P: per-purse deltas (already floored at 0 net for shared `coins`). */
  purse?: { boy: number; girl: number }
}

type Who = 'boy' | 'girl'

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

function makeBuzz(scene: Phaser.Scene, x: number, y: number, label: string) {
  const halo = scene.add.circle(x, y, 42, 0xff4060, 0.25)
  const btn = scene.add.circle(x, y, 34, 0xe01828, 1).setStrokeStyle(4, 0xffe080)
  const tx = scene.add
    .text(x, y, label, {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#fff8e0',
      stroke: '#400008',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  btn.setInteractive({ useHandCursor: true })
  scene.tweens.add({
    targets: halo,
    scale: { from: 1, to: 1.18 },
    alpha: { from: 0.35, to: 0.12 },
    duration: 650,
    yoyo: true,
    repeat: -1,
  })
  return { halo, btn, tx, x, y }
}

/**
 * 會員中心・金魚眼搶答（C2 頭兩關攤檔）。
 * 1P：右邊紅掣 + 假對手；2P：左右各一粒紅掣，答錯後另一位可搶。
 */
export function goldfishQuiz(scene: Phaser.Scene): Mini<GoldfishResult> {
  let killed = false
  let resolve!: (r: GoldfishResult) => void
  const done = new Promise<GoldfishResult>((r) => {
    resolve = r
  })

  const twoP = scene.registry.get('playMode') === '2p'
  const rng = () => Math.random()
  const round = pickRound(rng)
  const scoring = BANK.scoring
  const timeoutPenalty = BANK.timeoutPenalty ?? -2

  let coins = 0
  let correct = 0
  let wrong = 0
  let skipped = 0
  let qi = 0
  const purse = { boy: 0, girl: 0 }

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
    .text(72, 58, twoP ? '倫0 琪0' : '幣 0', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a' })
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

  const p1Buzz = makeBuzz(scene, GAME_W - 70, GAME_H / 2 + 10, twoP ? 'P1' : '搶')
  root.add([p1Buzz.halo, p1Buzz.btn, p1Buzz.tx])
  let p2Buzz: ReturnType<typeof makeBuzz> | null = null
  if (twoP) {
    p2Buzz = makeBuzz(scene, 70, GAME_H / 2 + 10, 'P2')
    root.add([p2Buzz.halo, p2Buzz.btn, p2Buzz.tx])
  }

  const skipTxt = scene.add
    .text(GAME_W / 2, GAME_H - 28, twoP ? 'Start／Esc 略過｜P1 右掣／Enter｜P2 左掣／Shift' : 'Start／Esc 可略過整局', {
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
  let answering: Who | 'rival' | null = null
  /** In 2P rebound after a wrong answer — only the other seat may buzz. */
  let onlyWho: Who | null = null
  let rivalBuzzAt = 0
  let lockedChoices = false
  let keys: Phaser.Input.Keyboard.Key[] = []

  const refreshCoin = () => {
    coinHud.setText(twoP ? `倫${purse.boy} 琪${purse.girl}` : `幣 ${coins}`)
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

  const resultNow = (): GoldfishResult => ({
    coins,
    correct,
    wrong,
    skipped,
    purse: twoP ? { ...purse } : undefined,
  })

  const finish = (r: GoldfishResult) => {
    if (killed) return
    killed = true
    cleanup()
    resolve(r)
  }

  const cleanup = () => {
    scene.input.keyboard?.off('keydown-ESC')
    scene.input.keyboard?.off('keydown-ENTER')
    scene.input.keyboard?.off('keydown-SHIFT')
    for (const k of keys) k.destroy()
    root.destroy(true)
  }

  const scoreFor = (q: Q, ok: boolean) => {
    const table = q.difficulty === 'hard' ? scoring.hard : scoring.normal
    return ok ? table.correct : table.wrong
  }

  const applyDelta = (n: number, who?: Who) => {
    coins = Math.max(0, coins + n)
    if (who) purse[who] = Math.max(0, purse[who] + n)
    refreshCoin()
  }

  const resetBuzzLooks = () => {
    p1Buzz.btn.setFillStyle(0xe01828, 1)
    p2Buzz?.btn.setFillStyle(0xe01828, 1)
  }

  const nextQuestion = () => {
    if (qi >= round.length) {
      phase = 'done'
      status.setText(`完！今局金幣 ${coins}`)
      scene.time.delayedCall(900, () => finish(resultNow()))
      return
    }
    const q = round[qi]!
    phase = 'buzz'
    answering = null
    onlyWho = null
    lockedChoices = false
    setChoicesVisible(false)
    resetBuzzLooks()
    progress.setText(`第 ${qi + 1}／${round.length} 題${q.difficulty === 'hard' ? '（難題）' : ''}`)
    prompt.setText(q.prompt)
    status.setText(twoP ? '左右紅掣搶答！' : '撳右邊紅掣搶答！')
    paintChoices(q)
    buzzOpen = qi === 0 ? 4000 : 3400
    // Balanced 1P rival: beatable if you read, still pressure (A pass without playtest).
    const base = qi === 0 ? 2200 : q.difficulty === 'hard' ? 1900 : 1500
    const spread = qi === 0 ? 800 : q.difficulty === 'hard' ? 1200 : 1000
    rivalBuzzAt = twoP ? 999999 : base + Math.floor(rng() * spread)
  }

  const beginAnswer = (who: Who | 'rival') => {
    phase = 'answer'
    answering = who
    answerLeft = who === 'rival' ? 1600 : 2800
    setChoicesVisible(who !== 'rival')
    status.setText(who === 'rival' ? '對手搶到…' : who === 'girl' ? '琪寶寶快答！A–D' : '倫寶快答！A–D')
    if (who === 'rival') {
      const q = round[qi]!
      const chance = q.difficulty === 'hard' ? 0.35 : 0.55
      scene.time.delayedCall(700 + Math.floor(rng() * 600), () => {
        if (killed || phase !== 'answer' || answering !== 'rival') return
        resolveAnswer(rng() < chance, 'rival')
      })
    }
  }

  const resolveAnswer = (ok: boolean, who: Who | 'rival' | 'timeout') => {
    if (phase === 'resolve' || phase === 'done') return
    phase = 'resolve'
    lockedChoices = true
    setChoicesVisible(false)
    const q = round[qi]!

    if (who === 'timeout') {
      const seat = answering === 'boy' || answering === 'girl' ? answering : undefined
      applyDelta(timeoutPenalty, seat)
      status.setText(`超時！${timeoutPenalty} 幣`)
      SFX.hurt()
      qi++
      scene.time.delayedCall(750, () => {
        if (!killed) nextQuestion()
      })
      return
    }

    if (who === 'rival') {
      if (ok) status.setText('對手答啱咗！')
      else status.setText('對手都答錯…')
      qi++
      scene.time.delayedCall(750, () => {
        if (!killed) nextQuestion()
      })
      return
    }

    const d = scoreFor(q, ok)
    applyDelta(d, who)
    if (ok) {
      correct++
      status.setText(`啱！+${d} 幣`)
      SFX.coin()
      qi++
      scene.time.delayedCall(750, () => {
        if (!killed) nextQuestion()
      })
      return
    }

    wrong++
    status.setText(`錯…${d} 幣`)
    SFX.hurt()

    // 2P: after a wrong answer the other seat may steal the rebound buzz once.
    if (twoP && !onlyWho) {
      const other: Who = who === 'boy' ? 'girl' : 'boy'
      onlyWho = other
      answering = null
      phase = 'buzz'
      lockedChoices = false
      buzzOpen = 2200
      resetBuzzLooks()
      status.setText(`${other === 'girl' ? '琪寶寶' : '倫寶'}可以搶返！`)
      return
    }

    qi++
    scene.time.delayedCall(750, () => {
      if (!killed) nextQuestion()
    })
  }

  const tryBuzz = (who: Who) => {
    if (killed || phase !== 'buzz') return
    if (onlyWho && onlyWho !== who) return
    if (answering) return
    answering = who
    SFX.swing()
    if (who === 'boy') p1Buzz.btn.setFillStyle(0xff6080, 1)
    else p2Buzz?.btn.setFillStyle(0xff6080, 1)
    beginAnswer(who)
  }

  p1Buzz.btn.on('pointerdown', () => tryBuzz('boy'))
  p2Buzz?.btn.on('pointerdown', () => tryBuzz('girl'))

  for (let i = 0; i < 4; i++) {
    const idx = i
    const bg = choiceBtns[i]!.list[0] as Phaser.GameObjects.Rectangle
    bg.on('pointerdown', () => {
      if (killed || phase !== 'answer' || lockedChoices) return
      if (answering !== 'boy' && answering !== 'girl') return
      const q = round[qi]!
      resolveAnswer(idx === q.answerIndex, answering)
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
      kb.addKey('ENTER'),
      kb.addKey('SHIFT'),
    ]
    kb.on('keydown-ESC', () => finish(resultNow()))
    kb.on('keydown-ENTER', () => {
      if (phase === 'buzz') tryBuzz('boy')
    })
    kb.on('keydown-SHIFT', () => {
      if (phase === 'buzz' && twoP) tryBuzz('girl')
    })
  }

  const onKey = () => {
    if (killed) return
    if (phase === 'buzz') {
      if (keys[8]?.isDown || keys[9]?.isDown || keys[10]?.isDown || TouchInput.isDown('attack')) tryBuzz('boy')
      if (twoP && keys[11]?.isDown) tryBuzz('girl')
    } else if (phase === 'answer' && (answering === 'boy' || answering === 'girl') && !lockedChoices) {
      const map = [
        keys[0]?.isDown || keys[4]?.isDown,
        keys[1]?.isDown || keys[5]?.isDown,
        keys[2]?.isDown || keys[6]?.isDown,
        keys[3]?.isDown || keys[7]?.isDown,
      ]
      for (let i = 0; i < 4; i++) {
        if (map[i]) {
          const q = round[qi]!
          resolveAnswer(i === q.answerIndex, answering)
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
      if (TouchInput.isDown('attack') && phase === 'buzz') tryBuzz('boy')
      if (phase === 'buzz') {
        buzzOpen -= 50
        if (!twoP) rivalBuzzAt -= 50
        status.setText(
          onlyWho
            ? `${onlyWho === 'girl' ? '琪' : '倫'}搶返中… ${Math.max(0, Math.ceil(buzzOpen / 1000))}s`
            : `搶答中… ${Math.max(0, Math.ceil(buzzOpen / 1000))}s`,
        )
        if (!twoP && !answering && rivalBuzzAt <= 0) {
          beginAnswer('rival')
          return
        }
        if (buzzOpen <= 0 && !answering) {
          if (onlyWho) {
            // Rebound timed out — move on.
            onlyWho = null
            qi++
            status.setText('冇人搶返 → 下一題')
            phase = 'resolve'
            scene.time.delayedCall(500, () => {
              if (!killed) nextQuestion()
            })
            return
          }
          skipped++
          status.setText('冇人搶 → Skip')
          phase = 'resolve'
          qi++
          scene.time.delayedCall(500, () => {
            if (!killed) nextQuestion()
          })
        }
      } else if (phase === 'answer' && (answering === 'boy' || answering === 'girl')) {
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
      resolve(resultNow())
    },
  }
}
