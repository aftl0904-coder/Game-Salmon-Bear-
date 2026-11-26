import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI, FONT_TITLE } from './ui/fonts'
import { SFX } from './audio'
import { TouchInput } from './touchInput'
import type { Mini } from './minigames'
import { gradeResult, showSegmentBanner, type MiniGrade } from './minigameFramework'
import quizRaw from '../../data/quiz-mall.json'

type Q = {
  id: string
  category: string
  difficulty: 'normal' | 'medium' | 'hard'
  prompt: string
  choices: string[]
  answerIndex: number
}

/** Claude 定案：唔可以加按揭、買樓、睇樓、供款題（兼禁供樓）. */
const HOME_TOPIC_BAN = ['按揭', '買樓', '睇樓', '供樓', '供款'] as const

function isHomeTopicBanned(q: Q): boolean {
  const blob = `${q.prompt}\n${q.choices.join('\n')}`
  return HOME_TOPIC_BAN.some((k) => blob.includes(k))
}

/**
 * Simple 地產發展 (developer) pool for stage-6 first-open pin.
 * 簡單 = difficulty === 'normal' only (exclude medium/hard).
 */
function simpleDeveloperPool(): Q[] {
  return BANK.questions.filter(
    (q) => q.category === 'developer' && q.difficulty === 'normal' && !isHomeTopicBanned(q),
  )
}

export type PickRoundOpts = {
  /** Stage 6 first open this play: pin Q1 from simple developer pool. */
  pinHomeFirst?: boolean
  /** Hard-exclude question ids (e.g. stage 8 avoids this-run stage 6 round). */
  excludeIds?: string[]
}

type Bank = {
  perRound: number
  scoring: { normal: { correct: number; wrong: number }; hard: { correct: number; wrong: number } }
  timeoutPenalty: number
  questions: Q[]
}

const BANK = quizRaw as unknown as Bank

/** T13_QUIZ_FIX / PR-H timing table (ms). */
export const QUIZ_TIMING = {
  buzzQ1: 6000,
  buzzOther: 5400,
  buzzRebound: 4200,
  rivalQ1: 3200,
  rivalHard: 2900,
  rivalNormal: 2500,
  rivalSpreadQ1: 800,
  rivalSpreadHard: 1200,
  rivalSpreadNormal: 1000,
  answerPlayer: 5800,
  answerHardExtra: 3000,
  answerRival: 1600,
  confirmDebounceMs: 200,
} as const

export type GoldfishResult = {
  coins: number
  correct: number
  wrong: number
  skipped: number
  good: number
  total: number
  grade?: MiniGrade
  medalId?: string
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

const QUIZ_SEEN_KEY = 'quizSeen'

function loadSeenIds(): string[] {
  try {
    const raw = localStorage.getItem(QUIZ_SEEN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveSeenIds(ids: string[]) {
  try {
    localStorage.setItem(QUIZ_SEEN_KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    /* private mode / quota */
  }
}

/**
 * Pick up to n from pool, preferring unseen; does not clear quizSeen mid-round.
 * Falls back to already-seen items in the same pool before returning short.
 */
function pickFromPool(pool: Q[], n: number, seen: Set<string>, exclude: Set<string>, rng: () => number): Q[] {
  const available = pool.filter((q) => !exclude.has(q.id))
  if (!available.length || n <= 0) return []
  const fresh = available.filter((q) => !seen.has(q.id))
  const rest = available.filter((q) => seen.has(q.id))
  const ordered = [...shuffle(fresh, rng), ...shuffle(rest, rng)]
  return ordered.slice(0, Math.min(n, ordered.length))
}

/**
 * Mini-1: 3 segments × 3 — 普通題 → 難題 → 地產題（沿用現有題庫）.
 * Ban 按揭／買樓／睇樓／供款／供樓 from every segment.
 */
function pickRoundSegments(rng: () => number, opts?: PickRoundOpts): Q[] {
  const seenList = loadSeenIds()
  const seen = new Set(seenList)
  const normals = BANK.questions.filter((q) => q.difficulty !== 'hard' && !isHomeTopicBanned(q))
  const hards = BANK.questions.filter((q) => q.difficulty === 'hard' && !isHomeTopicBanned(q))
  const devs = BANK.questions.filter((q) => q.category === 'developer' && !isHomeTopicBanned(q))
  const exclude = new Set<string>(opts?.excludeIds ?? [])
  const seg1 = pickFromPool(normals, 3, seen, exclude, rng)
  for (const q of seg1) exclude.add(q.id)
  const seg2 = pickFromPool(hards.length ? hards : normals, 3, seen, exclude, rng)
  for (const q of seg2) exclude.add(q.id)
  let seg3 = pickFromPool(devs.length ? devs : normals.filter((q) => q.category === 'developer'), 3, seen, exclude, rng)
  if (opts?.pinHomeFirst) {
    const home = simpleDeveloperPool()
    const pinned = pickFromPool(home, 1, seen, new Set(), rng)[0] ?? shuffle(home, rng)[0]
    if (pinned) {
      const rest = seg3.filter((q) => q.id !== pinned.id)
      seg3 = [pinned, ...rest].slice(0, 3)
      while (seg3.length < 3) {
        const more = pickFromPool(devs, 1, seen, new Set([...exclude, ...seg3.map((q) => q.id)]), rng)
        if (!more.length) break
        seg3.push(more[0]!)
      }
    }
  }
  const out = [...seg1, ...seg2, ...seg3].slice(0, 9)
  saveSeenIds([...seenList, ...out.map((q) => q.id)])
  return out
}

/** QA / Playwright: run 3-seg picker without Phaser. */
export function pickRoundForQa(rng: () => number = Math.random, opts?: PickRoundOpts): Q[] {
  return pickRoundSegments(rng, opts)
}

type ShuffledQ = Q & { displayChoices: string[]; correctIndex: number }

/** Shuffle ABCD; rebalance so no letter holds > half the round's answers. */
function shuffleRoundChoices(round: Q[], rng: () => number): ShuffledQ[] {
  const maxPerLetter = Math.ceil(round.length / 2)
  const counts = [0, 0, 0, 0]
  const out: ShuffledQ[] = []
  for (const q of round) {
    let best: ShuffledQ | null = null
    for (let attempt = 0; attempt < 24; attempt++) {
      const order = shuffle([0, 1, 2, 3], rng)
      const displayChoices = order.map((i) => q.choices[i] ?? '')
      const correctIndex = order.indexOf(q.answerIndex)
      if (correctIndex < 0) continue
      if (counts[correctIndex]! >= maxPerLetter && attempt < 20) continue
      best = { ...q, displayChoices, correctIndex }
      break
    }
    if (!best) {
      const order = shuffle([0, 1, 2, 3], rng)
      best = {
        ...q,
        displayChoices: order.map((i) => q.choices[i] ?? ''),
        correctIndex: Math.max(0, order.indexOf(q.answerIndex)),
      }
    }
    counts[best.correctIndex]!++
    out.push(best)
  }
  return out
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
  // quiz-home-1: stage 6 only — first open this play pins Q1 from simple developer pool.
  const stageNo = Number(scene.registry.get('stageNo') ?? 0)
  const pinHomeFirst = stageNo === 6 && !scene.registry.get('quizHomeFirstDone')
  if (pinHomeFirst) scene.registry.set('quizHomeFirstDone', true)
  // s8-4: stage 8 avoids questions already asked in this run's stage 6 quiz.
  const excludeIds =
    stageNo === 8
      ? ((scene.registry.get('runQuizIdsStage6') as string[] | undefined) ?? []).filter((id) => typeof id === 'string')
      : undefined
  const picked = pickRoundSegments(rng, { pinHomeFirst, excludeIds })
  if (stageNo === 6) scene.registry.set('runQuizIdsStage6', picked.map((q) => q.id))
  const round = shuffleRoundChoices(picked, rng)
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
  panel.fillStyle(0xc8902a, 1).fillRoundedRect(28, 28, GAME_W - 56, GAME_H - 56, 10)
  panel.fillStyle(0x142028, 1).fillRoundedRect(32, 32, GAME_W - 64, GAME_H - 64, 8)
  root.add(panel)

  const title = scene.add
    .text(GAME_W / 2, 48, '會員中心・金魚眼搶答', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#ffd76a',
      stroke: '#1a0c08',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
  const progress = scene.add
    .text(GAME_W / 2, 68, '', { fontFamily: FONT_UI, fontSize: '16px', color: '#9ec8e0' })
    .setOrigin(0.5)
  const prompt = scene.add
    .text(GAME_W / 2, 86, '', {
      fontFamily: FONT_UI,
      fontSize: '20px',
      color: '#fff6e0',
      align: 'center',
      wordWrap: { width: 560 },
    })
    .setOrigin(0.5, 0)
  const status = scene.add
    .text(GAME_W / 2, 168, '', { fontFamily: FONT_UI, fontSize: '16px', color: '#8ad0ff' })
    .setOrigin(0.5)
  const coinHud = scene.add
    .text(72, 48, twoP ? '倫0 琪0' : '幣 0', { fontFamily: FONT_UI, fontSize: '16px', color: '#ffe08a' })
    .setOrigin(0, 0.5)

  root.add([title, progress, prompt, status, coinHud])

  // Leave side gutters for red buzz buttons (unchanged positions).
  const choiceY0 = 196
  const choiceGap = 38
  const choiceH = 32
  const choiceW = GAME_W - 200
  const choiceBtns: Phaser.GameObjects.Container[] = []
  const choiceLabels: Phaser.GameObjects.Text[] = []
  for (let i = 0; i < 4; i++) {
    const y = choiceY0 + i * choiceGap
    const bg = scene.add.rectangle(GAME_W / 2, y, choiceW, choiceH, 0x243848, 1).setStrokeStyle(2, 0x6a90a8)
    const tx = scene.add
      .text(GAME_W / 2, y, '', { fontFamily: FONT_UI, fontSize: '18px', color: '#f0f6ff' })
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
    .text(GAME_W / 2, GAME_H - 22, '搶答：紅掣／攻擊｜揀答案：↑↓＋攻擊，或直接撳', {
      fontFamily: FONT_UI,
      fontSize: '14px',
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
  let cursor = 0
  let hardFlash: Phaser.GameObjects.Text | null = null
  /** After attack/Enter/Space/J buzz: must release, then wait ≥200ms before confirm. */
  let confirmNeedsRelease = false
  let confirmReadyAt = 0
  /** Block all answer confirms briefly after buzz (sticky keys / same-press). */
  let answerInputIgnoreUntil = 0
  let prevUp = false
  let prevDown = false
  let prevConfirm = false
  let keys: Phaser.Input.Keyboard.Key[] = []
  /** Wall-clock schedule: scene.time can freeze under storyIntro/minigame gates. */
  let pendingNextAt = 0
  let pendingRivalAt = 0
  let pendingRivalOk = false
  let hardFlashUntil = 0

  const refreshCoin = () => {
    coinHud.setText(twoP ? `倫${purse.boy} 琪${purse.girl}` : `幣 ${coins}`)
  }

  const setChoicesVisible = (on: boolean) => {
    for (const c of choiceBtns) c.setVisible(on)
  }

  const paintCursor = () => {
    for (let i = 0; i < 4; i++) {
      const bg = choiceBtns[i]!.list[0] as Phaser.GameObjects.Rectangle
      if (i === cursor) {
        bg.setFillStyle(0x3a5a70, 1)
        bg.setStrokeStyle(3, 0xffe080)
      } else {
        bg.setFillStyle(0x243848, 1)
        bg.setStrokeStyle(2, 0x6a90a8)
      }
    }
  }

  const paintChoices = (q: ShuffledQ) => {
    const letters = ['A', 'B', 'C', 'D']
    for (let i = 0; i < 4; i++) {
      choiceLabels[i]!.setText(`${letters[i]}  ${q.displayChoices[i] ?? ''}`)
    }
    cursor = 0
    paintCursor()
  }

  const resultNow = (): GoldfishResult => {
    const total = round.length
    const graded = gradeResult(correct, total, 'puzzle', false, 'goldfish')
    return {
      coins,
      correct,
      wrong,
      skipped,
      good: correct,
      total,
      grade: graded.grade,
      medalId: graded.medalId,
      purse: twoP ? { ...purse } : undefined,
    }
  }

  const finish = (r: GoldfishResult) => {
    if (killed) return
    killed = true
    cleanup()
    resolve(r)
  }

  const cleanup = () => {
    scene.input.keyboard?.off('keydown', onKeyDown)
    scene.input.keyboard?.off('keyup', onKeyUp)
    scene.input.off('pointerdown', onScenePointer)
    for (const k of keys) {
      try { k.destroy() } catch { /* ignore */ }
    }
    hardFlash?.destroy()
    hardFlash = null
    try {
      root.setVisible(false)
      root.setActive(false)
      // Defer destroy so the current WebGL render pass cannot hit a null texture.
      setTimeout(() => {
        try { root.destroy(true) } catch { /* ignore */ }
      }, 0)
    } catch {
      try { root.destroy(true) } catch { /* ignore */ }
    }
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

  const wallNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  const confirmHeld = () =>
    !!(keys[8]?.isDown || keys[9]?.isDown || keys[10]?.isDown || TouchInput.isDown('attack'))

  const armConfirmGate = () => {
    if (confirmHeld()) {
      confirmNeedsRelease = true
      confirmReadyAt = Number.POSITIVE_INFINITY
    } else {
      confirmNeedsRelease = false
      confirmReadyAt = wallNow() + QUIZ_TIMING.confirmDebounceMs
    }
  }

  const tickConfirmGate = () => {
    if (!confirmNeedsRelease) return
    if (!confirmHeld()) {
      confirmNeedsRelease = false
      confirmReadyAt = wallNow() + QUIZ_TIMING.confirmDebounceMs
    }
  }

  const releaseConfirmGate = () => {
    if (!confirmNeedsRelease) return
    confirmNeedsRelease = false
    confirmReadyAt = wallNow() + QUIZ_TIMING.confirmDebounceMs
  }

  const canConfirmNow = () => !confirmNeedsRelease && wallNow() >= confirmReadyAt

  const clearHardFlash = () => {
    hardFlash?.destroy()
    hardFlash = null
  }

  const showHardNotice = () => {
    clearHardFlash()
    hardFlash = scene.add
      .text(GAME_W / 2, GAME_H / 2 - 20, '難題！多 3 秒', {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: '#ffe040',
        stroke: '#1a1008',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI + 290)
    root.add(hardFlash)
    hardFlashUntil = wallNow() + 1000
  }

  const scheduleNext = (ms = 750) => {
    pendingNextAt = wallNow() + ms
  }

  const nextQuestion = () => {
    if (qi >= round.length) {
      phase = 'done'
      status.setText(`完！今局金幣 ${coins}`)
      pendingNextAt = 0
      const doneAt = wallNow() + 900
      const endTimer = setInterval(() => {
        if (killed) {
          clearInterval(endTimer)
          return
        }
        if (wallNow() >= doneAt) {
          clearInterval(endTimer)
          finish(resultNow())
        }
      }, 50)
      return
    }
    if (qi === 0 || qi === 3 || qi === 6) void showSegmentBanner(scene, (Math.floor(qi / 3) + 1) as 1 | 2 | 3)
    const q = round[qi]!
    phase = 'buzz'
    answering = null
    onlyWho = null
    lockedChoices = false
    cursor = 0
    clearHardFlash()
    setChoicesVisible(false)
    resetBuzzLooks()
    const segLabel = qi < 3 ? '普通題' : qi < 6 ? '難題' : '地產題'
    progress.setText(`第 ${qi + 1}／${round.length}　${segLabel}`)
    prompt.setText(q.prompt)
    status.setText(twoP ? '左右紅掣搶答！' : '撳右邊紅掣搶答！')
    paintChoices(q)
    buzzOpen = qi === 0 ? QUIZ_TIMING.buzzQ1 : QUIZ_TIMING.buzzOther
    const base = qi === 0 ? QUIZ_TIMING.rivalQ1 : q.difficulty === 'hard' ? QUIZ_TIMING.rivalHard : QUIZ_TIMING.rivalNormal
    const spread = qi === 0 ? QUIZ_TIMING.rivalSpreadQ1 : q.difficulty === 'hard' ? QUIZ_TIMING.rivalSpreadHard : QUIZ_TIMING.rivalSpreadNormal
    rivalBuzzAt = twoP ? 999999 : base + Math.floor(rng() * spread)
  }

  const beginAnswer = (who: Who | 'rival') => {
    phase = 'answer'
    answering = who
    const q = round[qi]!
    const hard = q.difficulty === 'hard'
    if (who === 'rival') {
      answerLeft = QUIZ_TIMING.answerRival
    } else {
      answerLeft = QUIZ_TIMING.answerPlayer + (hard ? QUIZ_TIMING.answerHardExtra : 0)
      armConfirmGate()
      answerInputIgnoreUntil = wallNow() + QUIZ_TIMING.confirmDebounceMs
      prevConfirm = true
      prevUp = true
      prevDown = true
      cursor = 0
      paintCursor()
      if (hard) showHardNotice()
    }
    setChoicesVisible(who !== 'rival')
    status.setText(who === 'rival' ? '對手搶到…' : who === 'girl' ? '琪寶寶快答！↑↓＋攻擊' : '倫寶快答！↑↓＋攻擊')
    if (who === 'rival') {
      const chance = hard ? 0.35 : 0.55
      pendingRivalOk = rng() < chance
      pendingRivalAt = wallNow() + 700 + Math.floor(rng() * 600)
    }
  }

  const resolveAnswer = (ok: boolean, who: Who | 'rival' | 'timeout') => {
    if (phase === 'resolve' || phase === 'done') return
    phase = 'resolve'
    lockedChoices = true
    setChoicesVisible(false)
    clearHardFlash()
    pendingRivalAt = 0
    const q = round[qi]!

    if (who === 'timeout') {
      const seat = answering === 'boy' || answering === 'girl' ? answering : undefined
      applyDelta(timeoutPenalty, seat)
      status.setText(`超時！${timeoutPenalty} 幣`)
      SFX.hurt()
      qi++
      scheduleNext(750)
      return
    }

    if (who === 'rival') {
      if (ok) status.setText('對手答啱咗！')
      else status.setText('對手都答錯…')
      qi++
      scheduleNext(750)
      return
    }

    const d = scoreFor(q, ok)
    applyDelta(d, who)
    if (ok) {
      correct++
      status.setText(`啱！+${d} 幣`)
      SFX.coin()
      qi++
      scheduleNext(750)
      return
    }

    wrong++
    status.setText(`錯…${d} 幣`)
    SFX.hurt()

    if (twoP && !onlyWho) {
      const other: Who = who === 'boy' ? 'girl' : 'boy'
      onlyWho = other
      answering = null
      phase = 'buzz'
      lockedChoices = false
      buzzOpen = QUIZ_TIMING.buzzRebound
      resetBuzzLooks()
      status.setText(`${other === 'girl' ? '琪寶寶' : '倫寶'}可以搶返！`)
      return
    }

    qi++
    scheduleNext(750)
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

  const pickChoice = (idx: number, opts?: { force?: boolean }) => {
    if (killed || phase !== 'answer' || lockedChoices) return
    if (answering !== 'boy' && answering !== 'girl') return
    if (!opts?.force && wallNow() < answerInputIgnoreUntil) return
    if (idx < 0 || idx > 3) return
    cursor = idx
    paintCursor()
    const q = round[qi]!
    resolveAnswer(idx === q.correctIndex, answering)
  }

  const confirmCursor = () => {
    if (killed || phase !== 'answer' || lockedChoices) return
    if (answering !== 'boy' && answering !== 'girl') return
    if (wallNow() < answerInputIgnoreUntil) return
    if (!canConfirmNow()) return
    pickChoice(cursor, { force: true })
  }

  p1Buzz.btn.on('pointerdown', () => tryBuzz('boy'))
  p2Buzz?.btn.on('pointerdown', () => tryBuzz('girl'))

  for (let i = 0; i < 4; i++) {
    const idx = i
    const bg = choiceBtns[i]!.list[0] as Phaser.GameObjects.Rectangle
    bg.on('pointerdown', () => {
      pickChoice(idx, { force: true })
    })
  }

  /** Camera-space point for scrollFactor-0 quiz UI. */
  const pointerUI = (pointer: Phaser.Input.Pointer) => {
    const cam = scene.cameras.main
    const z = cam?.zoom || 1
    return { x: pointer.x / z, y: pointer.y / z }
  }

  const onScenePointer = (pointer: Phaser.Input.Pointer) => {
    if (killed) return
    const { x, y } = pointerUI(pointer)
    if (phase === 'buzz') {
      const dx1 = x - p1Buzz.x
      const dy1 = y - p1Buzz.y
      if (dx1 * dx1 + dy1 * dy1 <= 48 * 48) {
        tryBuzz('boy')
        return
      }
      if (p2Buzz) {
        const dx2 = x - p2Buzz.x
        const dy2 = y - p2Buzz.y
        if (dx2 * dx2 + dy2 * dy2 <= 48 * 48) {
          tryBuzz('girl')
          return
        }
      }
      return
    }
    if (phase === 'answer' && (answering === 'boy' || answering === 'girl') && !lockedChoices) {
      const left = GAME_W / 2 - choiceW / 2
      const right = GAME_W / 2 + choiceW / 2
      if (x < left || x > right) return
      for (let i = 0; i < 4; i++) {
        const cy = choiceY0 + i * choiceGap
        if (Math.abs(y - cy) <= choiceH / 2 + 2) {
          pickChoice(i, { force: true })
          return
        }
      }
    }
  }
  scene.input.on('pointerdown', onScenePointer)

  const moveCursor = (dir: -1 | 1) => {
    if (phase !== 'answer' || lockedChoices) return
    if (answering !== 'boy' && answering !== 'girl') return
    cursor = (cursor + dir + 4) % 4
    paintCursor()
    SFX.blip(880)
  }

  const DIRECT: Record<string, number> = {
    KeyA: 0,
    KeyB: 1,
    KeyC: 2,
    KeyD: 3,
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
  }

  const onKeyDown = (ev: KeyboardEvent) => {
    if (killed || ev.repeat) return
    const code = ev.code
    if (code === 'Escape') {
      finish(resultNow())
      return
    }
    if (phase === 'buzz') {
      if (code === 'Enter' || code === 'Space' || code === 'KeyJ') tryBuzz('boy')
      else if (twoP && (code === 'ShiftLeft' || code === 'ShiftRight')) tryBuzz('girl')
      return
    }
    if (phase === 'answer' && (answering === 'boy' || answering === 'girl') && !lockedChoices) {
      tickConfirmGate()
      if (code === 'ArrowUp' || code === 'KeyW') moveCursor(-1)
      else if (code === 'ArrowDown' || code === 'KeyS') moveCursor(1)
      else if (code in DIRECT) pickChoice(DIRECT[code]!)
      else if (code === 'Enter' || code === 'Space' || code === 'KeyJ') confirmCursor()
    }
  }

  const onKeyUp = (ev: KeyboardEvent) => {
    if (killed) return
    if (ev.code !== 'Enter' && ev.code !== 'Space' && ev.code !== 'KeyJ') return
    releaseConfirmGate()
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
      kb.addKey('UP'),
      kb.addKey('DOWN'),
      kb.addKey('W'),
      kb.addKey('S'),
    ]
    kb.on('keydown', onKeyDown)
    kb.on('keyup', onKeyUp)
    // Phaser key objects also emit up — covers cases where KeyboardEvent keyup is missed.
    for (const idx of [8, 9, 10] as const) {
      keys[idx]?.on('up', () => releaseConfirmGate())
    }
  }

  /** Poll TouchInput / gamepad edges (keyboard uses keydown). */
  const onPad = () => {
    if (killed) return
    tickConfirmGate()

    const upNow = TouchInput.isDown('up')
    const downNow = TouchInput.isDown('down')
    const attackNow = TouchInput.isDown('attack')
    const attackEdge = TouchInput.justPressed('attack') || (attackNow && !prevConfirm)

    if (phase === 'buzz') {
      if (attackEdge) tryBuzz('boy')
    } else if (phase === 'answer' && (answering === 'boy' || answering === 'girl') && !lockedChoices) {
      if ((upNow && !prevUp) || TouchInput.justPressed('up')) moveCursor(-1)
      if ((downNow && !prevDown) || TouchInput.justPressed('down')) moveCursor(1)
      if (attackEdge && canConfirmNow()) confirmCursor()
    }

    prevUp = upNow
    prevDown = downNow
    prevConfirm = attackNow || confirmHeld()
  }

  // Wall-clock interval — GameScene may freeze scene.time while storyIntro/minigames run.
  const timer = setInterval(() => {
    if (killed) return
    if (hardFlashUntil && wallNow() >= hardFlashUntil) {
      hardFlashUntil = 0
      clearHardFlash()
    }
    if (pendingNextAt && wallNow() >= pendingNextAt) {
      pendingNextAt = 0
      if (!killed) nextQuestion()
      return
    }
    if (pendingRivalAt && wallNow() >= pendingRivalAt) {
      pendingRivalAt = 0
      if (!killed && phase === 'answer' && answering === 'rival') {
        resolveAnswer(pendingRivalOk, 'rival')
      }
      return
    }
    onPad()
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
          onlyWho = null
          qi++
          status.setText('冇人搶返 → 下一題')
          phase = 'resolve'
          scheduleNext(500)
          return
        }
        skipped++
        status.setText('冇人搶 → Skip')
        phase = 'resolve'
        qi++
        scheduleNext(500)
      }
    } else if (phase === 'answer' && (answering === 'boy' || answering === 'girl')) {
      answerLeft -= 50
      status.setText(`作答 ${Math.max(0, Math.ceil(answerLeft / 1000))}s`)
      if (answerLeft <= 0) resolveAnswer(false, 'timeout')
    }
  }, 50)

  const origDestroy = () => {
    clearInterval(timer)
    cleanup()
  }

  nextQuestion()
  refreshCoin()

  const api = {
    done,
    destroy: () => {
      if (killed) return
      killed = true
      origDestroy()
      resolve(resultNow())
    },
    /** QA-only snapshot (Playwright). */
    debug: () => ({
      phase,
      qi,
      answerLeft,
      buzzOpen,
      difficulty: round[qi]?.difficulty ?? null,
      cursor,
      confirmNeedsRelease,
      confirmReadyAt,
      answering,
      questionIds: round.map((q) => q.id),
      correctIndexes: round.map((q) => q.correctIndex),
      currentCorrectIndex: round[qi]?.correctIndex ?? null,
      hardSlot: round.findIndex((q) => q.difficulty === 'hard'),
      correct,
      wrong,
    }),
    /** QA: buzz as boy then answer by display index. */
    qaBuzzAndAnswer: (displayIndex: number) => {
      tryBuzz('boy')
      pickChoice(displayIndex, { force: true })
    },
  }
  return api as Mini<GoldfishResult> & {
    debug: () => Record<string, unknown>
    qaBuzzAndAnswer: (displayIndex: number) => void
  }
}
