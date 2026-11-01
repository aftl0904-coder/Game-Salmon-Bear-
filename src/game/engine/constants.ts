/** Shared stage / physics constants — 超任 SNES weight (Goemon / classic platformer). */
import charactersPack from '../../../data/characters.json'
import { GAME_W, GAME_H } from '../display'

export { GAME_W, GAME_H }

/**
 * Native render size is 640×360 (see display.ts).
 * Layout units from the 960×540 era multiply by LAYOUT_SCALE (= 640/960).
 */
export const LAYOUT_SCALE = GAME_W / 960
/** Helper: map a legacy 960×540 layout value into native coords. */
export function L(n: number) {
  return Math.round(n * LAYOUT_SCALE)
}

/**
 * Stage length — previous 7600 shortened −25%, then × LAYOUT_SCALE.
 * Spawn X positions should use `sx()` / STAGE_LEN_MUL.
 */
export const BASE_WORLD_W = L(5700)
/** Live binding: a stage JSON may set `worldW` (see GameScene.create) to run longer than the shared default. */
export let WORLD_W = BASE_WORLD_W
export function setWorldW(w: number) {
  WORLD_W = Math.round(w)
}
export const WORLD_H = GAME_H
/** Multiply legacy absolute stage X coords by this (WORLD_W design / 7600), then layout scale. */
export const STAGE_LEN_MUL = 0.75 * LAYOUT_SCALE
export function sx(x: number) {
  return Math.round(x * STAGE_LEN_MUL)
}

/** Shared mid-lane walk surface (feet origin). Lowered for more playable ground (Pack3). */
export const GROUND_Y = L(428)

/** Heroes HP (每人少 1 心 vs 舊 7). 1 enemy hit = −1. */
export const MAX_HP = 6
/** Combat: hits connect on same lane OR ±1 adjacent lane. */
export const LANE_HIT_TOL = 1
/**
 * Absolute display scales (bible stage 3).
 * PNGs + procedural actors are nearest-fit to target heights; bake is NEAREST ×1
 * so sprites run at scale ≈ 1 (no mid-body shear under Phaser safeAuto).
 * @see docs/bible/visual-style.md
 */
export const ACTOR_DISPLAY_SCALE = 1
/** Heroes match bible 72px — no extra shrink. */
export const HERO_SIZE_MUL = 1
/** 琪寶寶 same target height as 倫寶 (72px). */
export const GIRL_SCALE_MUL = 1
/** 噗噗 bible 56px / hero 72px. */
export const PET_HEIGHT_FRAC = 56 / 72
/** Projectiles / ammo — art already sized; keep native. */
export const PROJ_DISPLAY_SCALE = 1
/** Held weapons (sword, trunk, clubs). */
export const WEAPON_DISPLAY_SCALE = 1
/**
 * World interactables (honey / sushi / coin / durian / goal) —
 * boot nearest-fits oversized paints to bible item heights.
 */
export const PROP_DISPLAY_SCALE = 1
/** Roadside scenery — native after prop outline bake. */
export const SCENERY_DISPLAY_SCALE = 1
/** Pale BG tint (opaque sprites — colour shift only, not transparency). */
export const BG_PALE_TINT = 0xd8e6f0
/** Washed fog green for distant mountains (paired with BG_MOUNT_ALPHA). */
export const BG_MOUNT_TINT = 0xc5d8cc
/** Mountain fog alpha — lower = farther / hazier. */
export const BG_MOUNT_ALPHA = 0.38
/** Mid BG trees/houses pale (opaque). */
export const BG_MID_TINT = 0xc5d8c8
/** Near roadside scenery pale (opaque). */
export const BG_NEAR_TINT = 0xd2e0d4
/** 噗噗反擊半傷 */
export const BEAR_ASSIST_DMG = 1
/** 10 金幣自動換 +1 HP（雙方） */
export const COINS_PER_HP = 10
/** Player move speeds — from data/characters.json (P-01 / P-02). */
const _p01 = charactersPack.characters.find((c) => c.id === 'P-01')!
const _p02 = charactersPack.characters.find((c) => c.id === 'P-02')!
export const BOY_SPEED = _p01.moveSpeed
export const GIRL_SPEED = _p02.moveSpeed
/** 敵人接近／追擊速度 = 倫寶 × 0.3（跟主角一齊慢） */
export const ENEMY_SPEED = Math.round(BOY_SPEED * 0.3)
/** Shared bake / outline — NEAREST ×1 + 1px ink (no soft AA). */
export const BAKE_RES_FACTOR = 1
export const OUTLINE_WIDTH = 1
export const OUTLINE_INK: [number, number, number] = [18, 14, 12]
/** @deprecated soft AA removed in visual unify stage 3 */
export const SOFT_AA_FACTOR = 1
/** Bible target display heights (640×360) — data/assets.json. */
export const TARGET_H_HERO = 72
export const TARGET_H_PET = 56
export const TARGET_H_ENEMY_S = 40
export const TARGET_H_ENEMY_M = 56
export const TARGET_H_ENEMY_L = 72
export const TARGET_H_ITEM = 24
/** 每隔幾秒隨機定住一個敵人（ms 範圍） */
export const ENEMY_STAGGER_EVERY_MIN_MS = 3000
export const ENEMY_STAGGER_EVERY_MAX_MS = 4000
/** 每次定敵時長隨機 0.5–1.0s */
export const ENEMY_STAGGER_HOLD_MIN_MS = 500
export const ENEMY_STAGGER_HOLD_MAX_MS = 1000
/** @deprecated use HOLD_MIN/MAX */
export const ENEMY_STAGGER_HOLD_MS = 700

/** 出招 commit：0 = 唔停（2026-10-26 手感：每次出招停 0.1s 太黏，射擊連跳會斷） */
export const ATTACK_COMMIT_FREEZE_MS = 0
/** 命中 confirm（hit-stop）：約 4 格畫面，夠「實」又唔拖 */
export const HIT_CONFIRM_FREEZE_MS = 70
/** 主角被打：本人 freeze */
export const PLAYER_HURT_FREEZE_MS = 200
/** 大象蓄力鼻擊 */
export const ELEPHANT_WINDUP_MS = 500
/** 大象打中後短暫「霸體」——別人打唔入 */
export const ELEPHANT_DOMINATE_MS = 1200
/** 刺刺魚小彈傷害（低） */
export const FISH_BULLET_DMG = 1
/** 刺刺魚彈命中 freeze */
export const FISH_BULLET_FREEZE_MS = 180
/** 噗噗可愛 pose 停頓 */
export const BEAR_POSE_MS = 1000

/** 主角攻擊傷害（槍／劍） */
export const PLAYER_ATTACK_DMG = 3
/** 敵人攻擊傷害 */
export const ENEMY_ATTACK_DMG = 1

/**
 * World Arcade gravity (px/s²) — scaled with LAYOUT_SCALE so apex height stays ~screen-relative.
 */
export const GRAVITY_Y = Math.round(2600 * LAYOUT_SCALE)

/**
 * Jump impulse (px/s). Scaled with layout; apex ≈ same fraction of GAME_H as before.
 */
export const JUMP_V = Math.round(-880 * LAYOUT_SCALE)

/** Variable jump: multiply rising vy once when jump is released. */
export const JUMP_CUT = 0.5

/**
 * Extra body gravity while falling (added on top of world GRAVITY_Y).
 * Total fall accel ≈ GRAVITY_Y * FALL_GRAVITY_MUL — soft hang, still SNES-weight.
 */
export const FALL_GRAVITY_MUL = 1.28

/** Terminal fall speed (Arcade maxVelocity.y). */
export const MAX_FALL = Math.round(980 * LAYOUT_SCALE)

/** Coyote time after leaving floor (~100ms). */
export const COYOTE_MS = 100
/** Jump input buffer (~100ms). */
export const JUMP_BUF_MS = 100
export const HURT_LOCK_MS = 260
/** Player hurt i-frames (1.5s blink). */
export const HURT_IFRAME_MS = 1500
export const FALL_Y = L(530)
export const COINS_START = 5

/** Minimum platform height above ground to avoid body jam in narrow gaps. */
export const MIN_PLATFORM_CLEARANCE = L(64)

/** Ground accel/friction — snappy start/stop, not ice-skate. */
export const RUN_ACCEL = Math.round(3400 * LAYOUT_SCALE)
export const RUN_FRICTION = Math.round(3000 * LAYOUT_SCALE)
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
export const SALMON_SHOT_RANGE = Math.round(260 * 0.75 * LAYOUT_SCALE)
/** 鮭彈飛行速度（0.7× 原 520），layout-scaled */
export const SALMON_SHOT_SPEED = Math.round(520 * 0.7 * LAYOUT_SCALE)
/**
 * 攻擊頻率 −20%：CD ÷0.8 again on top of prior pack.
 * 鮭魚槍基底：400/0.7；劍撃基底：220
 */
export const SALMON_SHOT_COOLDOWN_MS = Math.round(400 / 0.7 / 0.8 / 0.8)
export const SWORD_COOLDOWN_MS = Math.round(220 / 0.8 / 0.8)
/**
 * 琪寶寶劍撃 hitbox 寬／高／持續 — fixed px, deliberately NOT tied to
 * WEAPON_DISPLAY_SCALE (sprite display scale). Commit 20d7079 bumped
 * WEAPON_DISPLAY_SCALE 0.37→1 for the art, which silently dragged this
 * hit-detection box along for the ride: Lv1 reach went ~44px → ~120px
 * (Cursor 3427f4e playtest: Lv1 ≈110px, Lv3 ≈190px, Lv3 重劍 ≈230px —
 * at points level with or past 倫寶's Lv3 gun range of 182px, which
 * breaks the ranged-vs-melee archetype). SWORD_HIT_W is one body-width
 * (~44px) again so Lv1/Lv2/Lv3/重劍 (44/59/75/97px) all stay well under
 * the gun's 130–291px range at every matching tier.
 */
export const SWORD_HIT_W = 44
/** Tall for ±1 lane reach — unrelated to horizontal reach, left as-is. */
export const SWORD_HIT_H = 96
export const SWORD_HIT_MS = 160
/** 噗噗跟在琪寶寶身後的水平距離 */
export const PET_FOLLOW_BEHIND = Math.round((36 + 42 * ACTOR_DISPLAY_SCALE * HERO_SIZE_MUL) * LAYOUT_SCALE)
