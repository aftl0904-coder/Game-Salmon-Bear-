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
}

export type ScorePayload = {
  score: number
  coins?: number
  /** Honey special MP charges (0–1). */
  special?: number
  /** Stage honey collected (quest count). */
  honey?: number
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
