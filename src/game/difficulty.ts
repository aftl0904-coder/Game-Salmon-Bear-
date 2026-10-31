/**
 * Difficulty picked on the new title-screen step (before character select).
 * Persisted in this browser like the other `sake-kuma-*` settings.
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'hell'

const KEY = 'sake-kuma-difficulty-v1'
/** Alan: 4 tiers — easy / median / hard / hell. */
const ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'hell']
const LABEL: Record<Difficulty, string> = { easy: '簡單', normal: '普通', hard: '挑戰', hell: '地獄' }

export function getDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'easy' || v === 'normal' || v === 'hard' || v === 'hell' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export function setDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(KEY, d)
  } catch {
    /* private mode — just doesn't persist across sessions */
  }
}

export function difficultyOrder(): Difficulty[] {
  return ORDER
}

export function difficultyLabel(d: Difficulty): string {
  return LABEL[d]
}

/** Enemy → hero contact/attack damage multiplier. */
export function difficultyAtkMul(d: Difficulty): number {
  return d === 'easy' ? 0.75 : d === 'hard' ? 1.3 : d === 'hell' ? 1.6 : 1
}

/** Enemy HP multiplier (applied once at spawn, then rounded, min 1). */
export function difficultyHpMul(d: Difficulty): number {
  return d === 'easy' ? 0.8 : d === 'hard' ? 1.3 : d === 'hell' ? 1.6 : 1
}
