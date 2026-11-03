const KEY = 'sake-kuma-scores-v1'

export type ScoreRow = {
  score: number
  timeSec: number
  honey: number
  mode: '1p' | '2p'
  at: number
}

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ScoreRow[]
    if (!Array.isArray(list)) return []
    return list.filter((r) => r && Number.isFinite(r.score) && Number.isFinite(r.timeSec))
      .slice(0, 10).map((r) => ({ score: r.score, timeSec: r.timeSec, honey: Number.isFinite(r.honey) ? r.honey : 0, mode: r.mode === '2p' ? '2p' : '1p', at: Number.isFinite(r.at) ? r.at : 0 }))
  } catch {
    return []
  }
}

export function saveScore(row: ScoreRow) {
  const list = loadScores()
  list.push(row)
  list.sort((a, b) => b.score - a.score || a.timeSec - b.timeSec)
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)))
  } catch {
    /* Storage unavailable; the clear screen must still work. */
  }
}

export function calcScore(opts: {
  timeSec: number
  honey: number
  hpBoy: number
  hpGirl: number
  deaths: number
}) {
  const timeBonus = Math.max(0, 1800 - Math.floor(opts.timeSec * 4))
  const honeyBonus = opts.honey * 300
  const hpBonus = (opts.hpBoy + opts.hpGirl) * 150
  const deathPenalty = opts.deaths * 200
  return Math.max(0, 1000 + timeBonus + honeyBonus + hpBonus - deathPenalty)
}
