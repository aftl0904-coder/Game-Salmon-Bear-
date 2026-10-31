import Phaser from 'phaser'

/** Per-role HP update (Player entity). */
export type PlayerHealthPayload = {
  role: 'boy' | 'girl'
  hp: number
  maxHp: number
  prevHp?: number
}

/** Aggregate HP update from GameScene. */
export type AggregateHealthPayload = {
  boyHp: number
  girlHp: number
  maxHp: number
  /** 耐力 0..1 per hero (GameScene.tickStamina). */
  stamL?: number
  stamR?: number
}

export type ScorePayload = {
  score: number
  coins?: number
  /** Honey special MP charges (0–1). */
  special?: number
  /** Stage honey collected (quest count). */
  honey?: number
  /** Journey 0–1 (lead hero x / stage length). */
  progress?: number
  timeSec?: number
  /** 金鮭 weapon level 1–3 per player. */
  wlvL?: number
  wlvR?: number
  /** R1 weapon-mode per player (倫寶 連射鮭/重擊鮭, 琪寶寶 快劍/重劍). */
  wmodeL?: 'normal' | 'heavy'
  wmodeR?: 'normal' | 'heavy'
  /** Short role-aware label for the HUD badge (e.g. '連射'/'重擊', '快劍'/'重劍'). */
  wmodeLabelL?: string
  wmodeLabelR?: string
  info?: string
  instant?: boolean
}

export type GameOverPayload = {
  active: boolean
  message?: string
  canContinue?: boolean
  win?: boolean
}

export type GameEventMap = {
  PLAYER_HEALTH_CHANGED: PlayerHealthPayload | AggregateHealthPayload
  SCORE_UPDATED: ScorePayload
  GAME_OVER: GameOverPayload
}

type EventKey = keyof GameEventMap

export const GameEvents = {
  PLAYER_HEALTH_CHANGED: 'PLAYER_HEALTH_CHANGED',
  SCORE_UPDATED: 'SCORE_UPDATED',
  GAME_OVER: 'GAME_OVER',
} as const satisfies { [K in EventKey]: K }

export const BusEvent = GameEvents

class TypedEventBus {
  private readonly ee = new Phaser.Events.EventEmitter()

  on<K extends EventKey>(event: K, fn: (payload: GameEventMap[K]) => void, context?: object) {
    this.ee.on(event, fn, context)
    return this
  }

  once<K extends EventKey>(event: K, fn: (payload: GameEventMap[K]) => void, context?: object) {
    this.ee.once(event, fn, context)
    return this
  }

  off<K extends EventKey>(event: K, fn?: (payload: GameEventMap[K]) => void, context?: object) {
    this.ee.off(event, fn, context)
    return this
  }

  emit<K extends EventKey>(event: K, payload: GameEventMap[K]) {
    this.ee.emit(event, payload)
    return this
  }

  removeAllListeners(event?: EventKey) {
    this.ee.removeAllListeners(event)
    return this
  }
}

export const EventBus = new TypedEventBus()

export function isAggregateHealth(
  p: PlayerHealthPayload | AggregateHealthPayload,
): p is AggregateHealthPayload {
  return 'boyHp' in p && 'girlHp' in p
}
