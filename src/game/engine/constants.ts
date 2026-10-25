/** Shared stage / physics constants — 超任 SNES weight (Goemon / classic platformer). */

export const WORLD_W = 3800
export const WORLD_H = 540

/** Shared mid-lane walk surface (feet origin). Side-view dual uses LANE_Y[3]. */
export const GROUND_Y = 400

export const MAX_HP = 10
export const BOY_SPEED = 280
export const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)

/**
 * World Arcade gravity (px/s²).
 * Higher than floaty 1500 — apex ~0.27s, peak ~94px with JUMP_V.
 */
export const GRAVITY_Y = 2600

/**
 * Jump impulse (px/s). Snappy rise; pair with JUMP_CUT + FALL_GRAVITY_MUL.
 * h = v² / (2g) ≈ 700² / 5200 ≈ 94px.
 */
export const JUMP_V = -700

/** Variable jump: multiply rising vy once when jump is released. */
export const JUMP_CUT = 0.48

/**
 * Extra body gravity while falling (added on top of world GRAVITY_Y).
 * Total fall accel ≈ GRAVITY_Y * FALL_GRAVITY_MUL.
 */
export const FALL_GRAVITY_MUL = 1.35

/** Terminal fall speed (Arcade maxVelocity.y). */
export const MAX_FALL = 980

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

/** Ground accel/friction — snappy start/stop, not ice-skate. */
export const RUN_ACCEL = 3400
export const RUN_FRICTION = 3000
export const AIR_ACCEL_MUL = 0.65

/** Goemon one-blade juice — short freeze + shake + white flash. */
export const HITFREEZE_MS = 75
export const HIT_SHAKE_MS = 130
/** ~0.008 × 960 ≈ 8px — integer shake steps under roundPixels (avoids subpixel tear). */
export const HIT_SHAKE_INTENSITY = 0.008
export const HEAVY_HITFREEZE_MS = 100
export const HEAVY_HIT_SHAKE_MS = 170
/** ~0.012 × 960 ≈ 12px whole-pixel heavy shake. */
export const HEAVY_HIT_SHAKE_INTENSITY = 0.012
/** Enemy attack telegraph floor (fair, readable). */
export const WINDUP_FLOOR_MS = 280
export const WINDUP_ALTAR_MS = 320
/** Contact bump cooldown after player-enemy body overlap (ms). */
export const CONTACT_CD_MS = 650
/** Arcade score pops. */
export const SCORE_HIT = 50
export const SCORE_KILL = 150
export const SCORE_BOSS_KILL = 800
export const SCORE_BREAK = 80
