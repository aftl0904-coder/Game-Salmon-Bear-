/** Shared stage / physics constants — 超任 SNES weight (Goemon / classic platformer). */

/** Doubled stage length (Pack polish — longer run, more enemies). */
export const WORLD_W = 7600
export const WORLD_H = 540

/** Shared mid-lane walk surface (feet origin). Lowered for more playable ground (Pack3). */
export const GROUND_Y = 428

/** Pack2/3: heroes have 7 HP; 1 enemy hit = −1. */
export const MAX_HP = 7
/** 噗噗反擊半傷 */
export const BEAR_ASSIST_DMG = 1
/** 10 金幣自動換 +1 HP（雙方） */
export const COINS_PER_HP = 10
export const BOY_SPEED = 280
export const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)
/** 敵人接近／追擊速度 = 倫寶 × 0.3（慢行進攻） */
export const ENEMY_SPEED = Math.round(BOY_SPEED * 0.3)
/** 每隔幾秒隨機定住一個敵人（ms 範圍） */
export const ENEMY_STAGGER_EVERY_MIN_MS = 3000
export const ENEMY_STAGGER_EVERY_MAX_MS = 4000
/** 每次定敵時長隨機 0.5–1.0s */
export const ENEMY_STAGGER_HOLD_MIN_MS = 500
export const ENEMY_STAGGER_HOLD_MAX_MS = 1000
/** @deprecated use HOLD_MIN/MAX */
export const ENEMY_STAGGER_HOLD_MS = 700

/** 出招 commit：只凍角色 0.1s（子彈繼續飛） */
export const ATTACK_COMMIT_FREEZE_MS = 100
/** 命中 confirm：全員角色再凍 0.2s */
export const HIT_CONFIRM_FREEZE_MS = 200

/** 主角攻擊傷害（槍／劍） */
export const PLAYER_ATTACK_DMG = 3
/** 敵人攻擊傷害 */
export const ENEMY_ATTACK_DMG = 1

/**
 * World Arcade gravity (px/s²).
 * Higher than floaty 1500 — apex ~0.28s, peak ~97px with JUMP_V.
 */
export const GRAVITY_Y = 2600

/**
 * Jump impulse (px/s). Snappy rise; pair with JUMP_CUT + FALL_GRAVITY_MUL.
 * h = v² / (2g) ≈ 710² / 5200 ≈ 97px — slight hang vs raw -700.
 */
export const JUMP_V = -710

/** Variable jump: multiply rising vy once when jump is released. */
export const JUMP_CUT = 0.5

/**
 * Extra body gravity while falling (added on top of world GRAVITY_Y).
 * Total fall accel ≈ GRAVITY_Y * FALL_GRAVITY_MUL — soft hang, still SNES-weight.
 */
export const FALL_GRAVITY_MUL = 1.28

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
export const WINDUP_FLOOR_MS = 300
export const WINDUP_ALTAR_MS = 340
/** Contact bump cooldown after player-enemy body overlap (ms). */
export const CONTACT_CD_MS = 650
/** Arcade score pops. */
export const SCORE_HIT = 50
export const SCORE_KILL = 150
export const SCORE_BOSS_KILL = 800
export const SCORE_BREAK = 80

/** 倫寶鮭魚槍最大飛行距離（px）— 遠程有上限，與琪寶寶劍近戰平衡 */
export const SALMON_SHOT_RANGE = 260
/** 鮭彈飛行速度（0.7× 原 520） */
export const SALMON_SHOT_SPEED = Math.round(520 * 0.7)
/** 鮭魚槍射速：0.7× 原再射速度 → CD = 400 / 0.7 */
export const SALMON_SHOT_COOLDOWN_MS = Math.round(400 / 0.7)
/** 琪寶寶劍撃 hitbox 寬／高／持續 */
export const SWORD_HIT_W = 120
export const SWORD_HIT_H = 58
export const SWORD_HIT_MS = 160
/** 噗噗跟在琪寶寶身後的水平距離 */
export const PET_FOLLOW_BEHIND = 78
