/** Shared stage / physics constants (Goemon-style floor plane). */

export const WORLD_W = 3800
export const WORLD_H = 540

/** Shared walk surface — heroes & enemies share this Y (feet origin). */
export const GROUND_Y = 400

export const MAX_HP = 10
export const BOY_SPEED = 275
export const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)
export const JUMP_V = -780
export const COYOTE_MS = 110
export const JUMP_BUF_MS = 120
export const HURT_LOCK_MS = 260
export const HURT_IFRAME_MS = 900
export const FALL_Y = 530
export const COINS_START = 5

/** Minimum platform height above ground to avoid body jam in narrow gaps. */
export const MIN_PLATFORM_CLEARANCE = 64
