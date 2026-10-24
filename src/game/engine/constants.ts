/** Shared stage / physics constants (Goemon-style floor plane). */

export const WORLD_W = 3800
export const WORLD_H = 540

/** Shared walk surface — heroes & enemies share this Y (feet origin). */
export const GROUND_Y = 400

export const MAX_HP = 10
export const BOY_SPEED = 275
export const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)
export const JUMP_V = -780
/** Coyote time after leaving floor (~100ms). */
export const COYOTE_MS = 100
/** Jump input buffer (~100ms). */
export const JUMP_BUF_MS = 100
export const HURT_LOCK_MS = 260
/** Player hurt i-frames (1.5s blink). */
export const HURT_IFRAME_MS = 1500
export const FALL_Y = 530
export const COINS_START = 5

/** Minimum platform height above ground to avoid body jam in narrow gaps. */
export const MIN_PLATFORM_CLEARANCE = 64

export const RUN_ACCEL = 2600
export const RUN_FRICTION = 2200
export const AIR_ACCEL_MUL = 0.7

/** Goemon one-blade juice — short freeze + shake + white flash. */
export const HITFREEZE_MS = 70
export const HIT_SHAKE_MS = 120
export const HIT_SHAKE_INTENSITY = 0.02
export const HEAVY_HITFREEZE_MS = 95
export const HEAVY_HIT_SHAKE_MS = 160
export const HEAVY_HIT_SHAKE_INTENSITY = 0.028
/** Enemy attack telegraph floor (fair, readable). */
export const WINDUP_FLOOR_MS = 260
export const WINDUP_ALTAR_MS = 300
/** Arcade score pops. */
export const SCORE_HIT = 50
export const SCORE_KILL = 150
export const SCORE_BOSS_KILL = 800
export const SCORE_BREAK = 80
