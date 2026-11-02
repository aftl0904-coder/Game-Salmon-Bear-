/** 連擊特殊招 (combo special) tuning — v1 is deliberately weak until Alan has played it. */

/** Meter gained per confirmed hit (0..1 scale, so ~20 melee hits or ~34 shot hits fill it). */
export const COMBO_GAIN_MELEE = 0.05
export const COMBO_GAIN_SHOT = 0.03
/** No hit for this long → the meter starts draining. */
export const COMBO_IDLE_MS = 2000
export const COMBO_DECAY_PER_SEC = 0.12
/** Hold attack this long with a full meter to fire. */
export const COMBO_HOLD_MS = 500

/** 琪寶寶: 360° spin. */
export const SPIN_MS = 1500
export const SPIN_PULSE_MS = 250
export const SPIN_DMG = 2
export const SPIN_W = 150
export const SPIN_H = 84

/** 倫寶: five-round burst. */
export const RAPID_SHOTS = 5
export const RAPID_GAP_MS = 110
/** Roe power → damage = max(1, round(3 × power)). */
export const RAPID_POWER = 0.7
export const RAPID_RANGE_MUL = 1

/** Head stomp. */
export const STOMP_DMG = 2
export const STOMP_BOSS_DMG = 1
export const STOMP_COOLDOWN_MS = 350
/** Contact damage is off for this long after a stomp so the landing never costs a heart. */
export const STOMP_SAFE_MS = 350
