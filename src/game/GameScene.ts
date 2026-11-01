/** User QA handoff: see /QA_HANDOFF_GATE.md (Visual/Feel/Fun ≥7.5; overall ~8.0+ before user fine-feel). */
import Phaser from 'phaser'
import { burst, floatText, impactRing, scorePop, startIFrameBlink, JuiceManager, freezeActors, isActorFrozen } from './fx'
import {
  enablePixelSprite,
  enableActorSprite,
  snapCameraScroll,
  snapTilePosition,
  snapWorldActors,
} from './pixelSnap'
import { SFX, playSong, stopBgm, unlockAudio } from './audio'
import { calcScore, saveScore, loadScores } from './score'
import { unlockStage, markFriendSaved } from './progress'
import { ensureFriendArt, friendTex, FRIENDS, isFriendId } from './friends'
import { bonusHearts, damageCut, dropOnDeath, gearById, iframeMul, jumpMul, knockMul, specialPower, speedMul, stamMax, stamRecoverMul, weaponFloor, type Who } from './gear'
import { difficultyAtkMul, difficultyHpMul, getDifficulty } from './difficulty'
import { activeCharm, hasPrayCharge, resetPrayCharge, usePrayCharge } from './charms'
import { buzz, HAPTIC } from './phone'
import { pourGame, showTutorial, stirCoffee, tiltGame, timingGame } from './minigames'
import stallsRaw from '../../data/stalls.json'
import { openShop } from './shop'
import { hasBossCard, playBossCard } from './bossCard'
import {
  type Creep,
  type EnemyKind,
  type EnemySpecies,
  enemyCanHurt,
  tickEnemy,
} from './enemyAi'
import { PatrolEnemy } from './enemies'
import { EventBus, GameEvents } from './EventBus'
import { Player } from './Player'
import { animTex, hasAnimSet } from './heroAnims'
import { hasFx, playFx } from './fxAnims'
import { TouchInput } from './touchInput'
import { p2Pad, padDir, btn as padBtn } from './gamepadBridge'
import { playCutscene } from './cutscene'
import stage1Raw from '../../data/levels/stage1.json'
import stage2Raw from '../../data/levels/stage2.json'
import stage3Raw from '../../data/levels/stage3.json'
import stage4Raw from '../../data/levels/stage4.json'
import stage5Raw from '../../data/levels/stage5.json'
import { Stage3World, type Stage3Data } from './stage3World'
import { Stage4World, type Stage4Data } from './stage4World'
import { Stage5World, type Stage5Data } from './stage5World'
import { MirrorOwl, OwlDecoy, OwlCrate, LobsterGuard, StallKeeper, MarketStall, MirrorShade, type OwlHooks } from './enemies/Stage3Enemies'
import { BeeSoldier, HoneySquirrel, MiniBee, HoneyEgg, QueenBee, type Stage2Hooks } from './enemies/Stage2Enemies'
import { HoneyZombie, TaxiMonster, ClockPunch, MudMane, type MudHooks } from './enemies/Stage4Enemies'
import { TriBoss, type TriHooks } from './enemies/Stage5Enemies'
import { Stage2World } from './stage2World'
import {
  setTerrain,
  groundTopBelow,
  pitDeathY,
  supportTopAt,
  terrainEnabled,
  wallClampX,
  terrainPits,
  type Solid,
} from './engine/terrain'
import {
  WORLD_W,
  WORLD_H,
  GAME_W,
  GAME_H,
  L,
  GROUND_Y,
  LANE_DEFAULT,
  LANE_FLOOR_Y,
  LANE_Y,
  MAX_HP,
  GIRL_SPEED,
  HURT_LOCK_MS,
  HURT_IFRAME_MS,
  FALL_Y,
  COINS_START,
  SCORE_HIT,
  SCORE_KILL,
  SCORE_BOSS_KILL,
  SCORE_BREAK,
  SALMON_SHOT_RANGE,
  SALMON_SHOT_SPEED,
  SALMON_SHOT_COOLDOWN_MS,
  SWORD_COOLDOWN_MS,
  ENEMY_SPEED,
  ENEMY_STAGGER_EVERY_MIN_MS,
  ENEMY_STAGGER_EVERY_MAX_MS,
  ENEMY_STAGGER_HOLD_MIN_MS,
  ENEMY_STAGGER_HOLD_MAX_MS,
  ATTACK_COMMIT_FREEZE_MS,
  HIT_CONFIRM_FREEZE_MS,
  PLAYER_HURT_FREEZE_MS,
  ELEPHANT_DOMINATE_MS,
  FISH_BULLET_DMG,
  FISH_BULLET_FREEZE_MS,
  BEAR_POSE_MS,
  PLAYER_ATTACK_DMG,
  ENEMY_ATTACK_DMG,
  BEAR_ASSIST_DMG,
  SWORD_HIT_W,
  SWORD_HIT_H,
  SWORD_HIT_MS,
  PET_FOLLOW_BEHIND,
  GIRL_SCALE_MUL,
  PROJ_DISPLAY_SCALE,
  PROP_DISPLAY_SCALE,
  BG_PALE_TINT,
  BG_MOUNT_TINT,
  BG_MOUNT_ALPHA,
  BG_MID_TINT,
  sx as stageX,
  clampLane,
  laneY,
  sameLane,
  actorDepth,
  DEPTH,
  applyDamage,
  applyHurtPose,
  beginDeathPose,
  canTakeDamage,
  reviveActor,
  tickCombatTimers,
  EntityManager,
  DebugOverlay,
  DEBUG_MODE,
  type LaneId,
} from './engine'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { PLAYER } from './config/playerData'
import { CAMERA, tutorialSign } from './config/gameData'
import { assertIntegerScale, isDebugQuery } from './assertIntegerScale'
import { addGroundShadow, addContactShadowBand, type GroundShadow } from './shadow'
import { addStageLighting, addPointLights } from './lighting'
import { ENVIRONMENT, environmentById } from './config/gameData'
import {
  createRound1Tilemap,
  hitBreakable,
  type Breakable,
  type LevelMapHandle,
  type LootKind,
} from './levelMap'

export { GROUND_Y, LANE_Y }

/** Heroes are Player entities (accel/coyote/melee/i-frames). */
type Hero = Player

/** data/levels/stage1.json — level layout (pits, steps, planks, hazards, enemies). */
type Stage1 = {
  pits: Array<{ x: number; w: number }>
  steps: Array<{ x: number; w: number; h: number }>
  platforms: Array<{ x: number; w: number; h: number }>
  spikes: Array<{ x: number; n: number }>
  durians: number[]
  honey: Array<{ x: number; h: number }>
  checkpoints: number[]
  enemies: Array<{ x: number; species: string; kind?: string; unlockX: number; elite?: boolean }>
  altarAmbush: Array<{ x: number; species: string }>
  altarTriggerX: number
  movingPlatforms?: Array<{ x: number; w: number; h: number; range: number; periodMs: number }>
  crushers?: Array<{ x: number; restH: number; warnMs: number; downMs: number; stayMs: number; upMs: number; idleMs: number }>
  breakables?: Array<{ x: number; kind: 'lantern' | 'pot' | 'hive'; loot: LootKind }>
  /** 噗噗's picnic friends locked in honey-crate cages (docs/bible/friends.md). h = perch height. */
  friends?: Array<{ x: number; id: string; h?: number }>
  decor?: { back: Array<{ x: number; kind: string }>; hang?: Array<{ x: number; kind: string }> }
  /** Floating coin trails (h = height above floor). */
  coins?: Array<{ x: number; h: number }>
  /** Hidden rewards on hard-to-reach perches. */
  secrets?: Array<{ x: number; h: number; kind: 'sushi' | 'coins' }>
  /** Stage 2 (蜜樹丘) extras. */
  theme?: 'forest' | 'tree' | 'market' | 'depot' | 'tower'
  name?: string
  shelves?: Array<{ x: number; w: number; h: number }>
  windVents?: Array<{ x: number; lift: number }>
  drips?: Array<{ x: number; periodMs: number }>
  boss?: { kind: 'queen' | 'mirrorowl' | 'mudmane' | 'triboss'; triggerX: number; arenaX0: number; arenaX1: number }
  /** Stage 3 (月影夜市) extras — see stage3World.ts. */
  darkZones?: Stage3Data['darkZones']
  lanterns?: Stage3Data['lanterns']
  slippery?: Stage3Data['slippery']
  sticky?: Stage3Data['sticky']
  bouncy?: Stage3Data['bouncy']
  steamVents?: Stage3Data['steamVents']
  easterEgg?: Stage3Data['easterEgg']
  stalls?: Array<{ x: number }>
  /** Stage 4 (鹽霧工地) extras — see stage4World.ts. */
  bulldozers?: Stage4Data['bulldozers']
  busEvent?: Stage4Data['busEvent']
  fog?: Stage4Data['fog']
  /** Stage 5 (△畝大廈) extras — see stage5World.ts. */
  conveyors?: Stage5Data['conveyors']
  hotSprings?: Stage5Data['hotSprings']
}
/** Weapon level (金鮭): 1–3, lose one on every hit taken. */
const WEAPON_MAX_LV = 3
/** 耐力: a full bar is 1. A sword swing costs a fifth, a roe shot a seventh. */
const STAM_SWORD = 0.2
const STAM_SHOT = 0.14
const STAM_RECOVER = 0.55
const STAM_REST_MS = 380
/** The stage that ends the story — only its clear screen offers the credits. */
const FINAL_STAGE = 5
type ClearAction = 'shop' | 'next' | 'credits' | 'menu'
type Stall = { keeper: string; food: string; sign: string; game: 'stir' | 'pour' | 'timing' | 'tilt'; greet: string }
const STALLS = (stallsRaw as unknown as { stalls: Record<string, Stall> }).stalls
type ClearButton = { id: ClearAction; bg: Phaser.GameObjects.Rectangle; tx: Phaser.GameObjects.Text; on: boolean }
type Mover = { solid: Solid; baseX: number; w: number; range: number; periodMs: number; img: Phaser.GameObjects.TileSprite | null; posts: Phaser.GameObjects.Graphics }
type CrusherState = 'idle' | 'warn' | 'down' | 'stay' | 'up'
type Crusher = {
  spr: Phaser.GameObjects.Image
  x: number
  restBottom: number
  floor: number
  state: CrusherState
  t: number
  cfg: { warnMs: number; downMs: number; stayMs: number; upMs: number; idleMs: number }
}
const STAGES: Record<number, Stage1> = {
  1: stage1Raw as unknown as Stage1,
  2: stage2Raw as unknown as Stage1,
  3: stage3Raw as unknown as Stage1,
  4: stage4Raw as unknown as Stage1,
  5: stage5Raw as unknown as Stage1,
}
/** Current stage layout — picked in create() from registry `stageNo`. */
let ST: Stage1 = STAGES[1]!

/**
 * 4-tier sushi healing (Alan: 玉子25% / 蝦50% / 三文魚75% / 極上壽司船100%).
 * pct is a fraction of the hero's effective max HP (MAX_HP + gear bonus hearts).
 */
type SushiTier = 'tamago' | 'ebi' | 'salmon' | 'deluxe'
const SUSHI_TIERS: Record<SushiTier, { tex: string; pct: number; label: string }> = {
  tamago: { tex: 'pickup-sushi-tamago', pct: 0.25, label: '玉子壽司' },
  ebi: { tex: 'pickup-sushi-ebi', pct: 0.5, label: '蝦壽司' },
  salmon: { tex: 'pickup-sushi', pct: 0.75, label: '三文魚壽司' },
  deluxe: { tex: 'pickup-sushi-deluxe', pct: 1, label: '極上壽司船' },
}

/**
 * Round 1 — 溪流小路（側視 上／中／下 三線）
 * P1：A/D 左右・W/S 換線・J/K/U/I；P2：←→・↑↓換線・數字鍵
 * 噗噗跟琪寶寶線；攻擊／受傷僅同線命中
 */
export class GameScene extends Phaser.Scene {
  private mode: '1p' | '2p' = '2p'
  private boy!: Hero
  /** 2P only — null in 1P（單人只有倫寶） */
  private girl: Hero | null = null
  private pet: Phaser.Physics.Arcade.Sprite | null = null
  private petShadow: GroundShadow | null = null
  /** 琪寶寶長劍（電風扇已 bake 喺角色背脊，唔再用獨立 fan sprite） */
  private sword: Phaser.GameObjects.Image | null = null
  /** 刺刺魚小彈 */
  private enemyShots!: Phaser.Physics.Arcade.Group
  private boyShadow!: GroundShadow
  private girlShadow: GroundShadow | null = null
  /** Soft margin inside camera for duo same-screen walls (2P). */
  private static readonly CAM_EDGE_PAD = 48
  private ground!: Phaser.Physics.Arcade.StaticGroup
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  /** Player melee attack hitboxes (overlap ↔ enemies). Solids use collider. */
  private attackHitboxes!: Phaser.Physics.Arcade.Group
  private shots!: Phaser.Physics.Arcade.Group
  private honeys!: Phaser.Physics.Arcade.Group
  private pots!: Phaser.Physics.Arcade.Group
  private coinPickups!: Phaser.Physics.Arcade.Group
  private honeyPickups!: Phaser.Physics.Arcade.Group
  private sushiPickups!: Phaser.Physics.Arcade.Group
  private goal!: Phaser.Physics.Arcade.Sprite
  private levelMap: LevelMapHandle | null = null
  private camTarget!: Phaser.GameObjects.Zone
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  /** SNES face: F=Y atk, G=B jump, T=X special, H=A → weapon-switch (倫寶雙槍) */
  private keyF!: Phaser.Input.Keyboard.Key
  private keyG!: Phaser.Input.Keyboard.Key
  private keyT!: Phaser.Input.Keyboard.Key
  private keyH!: Phaser.Input.Keyboard.Key
  /** Legacy jump／special aliases */
  private keyK!: Phaser.Input.Keyboard.Key
  private keyU!: Phaser.Input.Keyboard.Key
  /** 2P SNES: ,=Y . =B ; =X / =A → weapon-switch (琪寶寶快劍/重劍) */
  private keyComma!: Phaser.Input.Keyboard.Key
  private keyPeriod!: Phaser.Input.Keyboard.Key
  private keySemicolon!: Phaser.Input.Keyboard.Key
  private keySlash!: Phaser.Input.Keyboard.Key
  private keyNP1!: Phaser.Input.Keyboard.Key
  private keyNP2!: Phaser.Input.Keyboard.Key
  private keyNP4!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private keyEnter!: Phaser.Input.Keyboard.Key
  private keyEsc!: Phaser.Input.Keyboard.Key
  private keyP!: Phaser.Input.Keyboard.Key
  private pauseReadyAt = 0
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyC!: Phaser.Input.Keyboard.Key
  private keyRShift!: Phaser.Input.Keyboard.Key // 2P Start
  private keyDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebugAlt!: Phaser.Input.Keyboard.Key
  private physicsDebug = false
  /** 御守 charm: O key / shake-the-phone / tap the icon → one blessing per stage. */
  private keyO!: Phaser.Input.Keyboard.Key
  private prayIcon: Phaser.GameObjects.Image | null = null
  private shakeHandler: ((e: DeviceMotionEvent) => void) | null = null
  private lastShakeAt = 0
  /** Honey special charges (max 1). */
  private specialCharges = 0
  /** Player 1's controller is read through TouchInput (gamepadBridge) — kept null here. */
  private pad1: Gamepad | null = null
  /** Player 2 = the second connected controller, refreshed every frame. */
  private pad2: Gamepad | null = null
  /** Synced from UIScene for smoke / continue path. */
  banner!: Phaser.GameObjects.Text
  continueBox!: Phaser.GameObjects.Text
  private ended = false
  awaitingContinue = false
  started = false
  private startedAt = 0
  private storyIntro: { destroy: () => void } | null = null
  private boyGoal = false
  private girlGoal = false
  private bossOn = false
  private altarAmbushOn = false
  private honeyGot = 0
  private petJetting = false
  private scorePts = 0
  private killBonus = 0
  private deaths = 0
  coinStock = COINS_START
  private prevLeadX = 0
  private checkpointX = 110
  /** Stage beat index: 0 flat → 1 platforms → 2 ambush → 3 altar */
  private stageBeat = 0
  private water!: Phaser.GameObjects.TileSprite
  private waterMid?: Phaser.GameObjects.TileSprite
  private waterFoam?: Phaser.GameObjects.TileSprite
  /** Sparse parallax landmarks (not tiled mountain/village bands). */
  private bgClouds: Phaser.GameObjects.Image[] = []
  private bgMounts: Phaser.GameObjects.Image[] = []
  /** Decorative sky critters (bees / butterflies / birds) — no physics / no damage. */
  private ambientCritters: Phaser.GameObjects.Image[] = []
  /** Entity registry — players/enemies/projectiles live here, not in HUD. */
  private entities = new EntityManager()
  private debugOverlay!: DebugOverlay
  private juice!: JuiceManager
  /** Countdown until next random enemy stagger-freeze. */
  private enemyStaggerCd = 0
  /** 1 = 百畝樹林, 2 = 蜜樹丘. */
  stageNo = 1
  private tree = false
  private s2world: Stage2World | null = null
  private s2Pending: Array<{ x: number; species: string; unlockX: number; elite?: boolean }> = []
  private queen: QueenBee | MirrorOwl | MudMane | TriBoss | null = null
  /** 月影夜市 (stage 3). */
  private market = false
  private s3world: Stage3World | null = null
  /** 鹽霧工地 (stage 4). */
  private depot = false
  private s4world: Stage4World | null = null
  /** △畝大廈 (stage 5, final). */
  private tower = false
  private s5world: Stage5World | null = null
  private hotSpringsDone = new Set<number>()
  /** 龍蝦 power-up: attack ×1.5 until this time. */
  private powerUntil = 0
  private stalls: MarketStall[] = []
  private marketFar: { market: Phaser.GameObjects.Image | null; spring: Phaser.GameObjects.Image | null } = { market: null, spring: null }
  private towerFar: { hq: Phaser.GameObjects.Image | null; roof: Phaser.GameObjects.Image | null } = { hq: null, roof: null }
  private bossFight = false
  /** One 極上壽司船 (100% heal) dropped at the arena entrance per boss — never twice (continue/retry). */
  private bossSushiSpawned = false
  /** Friends freed by hand this run (clear card + perfect ending). */
  private friendsSaved: string[] = []
  /** The stir-the-coffee minigame runs at the first cart of each stage only. */
  private coffeeDone = false
  /** Each hero keeps their own coins (docs/bible/minigames-shop.md §2). */
  private purse: Record<Who, number> = { boy: 0, girl: 0 }
  private bossBar: { fill: Phaser.GameObjects.Rectangle; root: Phaser.GameObjects.Container; w: number } | null = null

  constructor() {
    // Scene key 'play' kept for smoke / MainMenu startMode compat.
    super('play')
  }

  create() {
    this.mode = (this.registry.get('playMode') as '1p' | '2p') || '2p'
    const sn = (this.registry.get('stageNo') as number) || 1
    this.stageNo = STAGES[sn] ? sn : 1
    ST = STAGES[this.stageNo]!
    this.tree = ST.theme === 'tree'
    this.market = ST.theme === 'market'
    this.depot = ST.theme === 'depot'
    this.tower = ST.theme === 'tower'
    this.s3world?.destroy()
    this.s3world = null
    this.s4world?.destroy()
    this.s4world = null
    this.s5world?.destroy()
    this.s5world = null
    this.hotSpringsDone = new Set()
    this.powerUntil = 0
    this.stalls = []
    this.marketFar = { market: null, spring: null }
    this.towerFar = { hq: null, roof: null }
    this.s2world?.destroy()
    this.s2world = null
    this.duskWash = null
    this.s2Pending = []
    this.queen = null
    this.bossFight = false
    this.friendsSaved = []
    this.coffeeDone = false
    this.bossBar = null
    this.clearCardAction = null
    this.clearCardMove = null
    this.clearBtns = []
    this.clearSel = 0
    this.ended = false
    this.outroOn = false
    this.awaitingContinue = false
    this.started = false
    this.bossOn = false
    this.altarAmbushOn = false
    this.boyGoal = false
    this.girlGoal = false
    this.honeyGot = 0
    this.petJetting = false
    this.scorePts = 0
    this.killBonus = 0
    this.deaths = 0
    const carry = this.registry.get('carryCoins') as number | undefined
    this.coinStock = typeof carry === 'number' ? carry : COINS_START
    const carryPurse = this.registry.get('carryPurse') as Record<Who, number> | undefined
    this.purse = carryPurse ? { ...carryPurse } : { boy: this.coinStock, girl: this.mode === '2p' ? this.coinStock : 0 }
    this.registry.set('carryPurse', undefined)
    this.registry.set('carryCoins', undefined)
    this.prevLeadX = 260
    this.checkpointX = 250
    this.stageBeat = 0
    this.startedAt = this.time.now
    this.registry.set('wave1Announced', false)
    this.registry.set('winScreenShown', false)
    this.registry.set('leavingToMenu', false)
    this.entities.clear()
    this.ambientCritters = []
    this.specialCharges = 0
    resetPrayCharge()
    // Scene instances survive restart — reset debug before any frame can
    // hit World.postUpdate with a destroyed/null debugGraphic.
    this.resetPhysicsDebug(false)

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(300, 40, 100, 140)

    unlockAudio()
    playSong(this.tower ? 'stage5' : this.depot ? 'stage4' : this.market ? 'stage3' : this.tree ? 'stage2' : 'stage1')

    this.drawWorld()
    this.buildLevel()
    this.spawnCast()
    if (this.registry.get('cheat')) {
      for (const h of [this.boy, this.girl]) h?.setData('wlv', WEAPON_MAX_LV)
      this.specialCharges = 1
    }
    this.applyStageLighting()
    this.wirePhysics()
    this.setupCameraFollow()
    this.bindKeys()
    if (isDebugQuery() || DEBUG_MODE) {
      this.time.delayedCall(400, () => {
        const bad = assertIntegerScale(this)
        ;(
          window as unknown as { __SAKE_PIXEL_SCALE__: typeof bad }
        ).__SAKE_PIXEL_SCALE__ = bad
      })
    }
    this.debugOverlay = new DebugOverlay(this)
    this.juice = new JuiceManager(this)
    // Snap AFTER Arcade step — update() runs before worldstep, so in-update
    // snaps get overwritten by fractional velocity before render.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.snapPixelArt, this)
    this.cameras.main.on(
      Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE,
      this.onCameraFollowUpdate,
      this,
    )
    this.launchUi()
    this.showIntro()
    this.emitHealth()
    this.emitScore()
    this.setupPrayerCharm()
    this.events.once('shutdown', this.onSceneShutdown, this)
  }

  private setupCameraFollow() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setRoundPixels(true)
    const startX = this.girl ? (this.boy.x + this.girl.x) / 2 : this.boy.x
    this.camTarget = this.add.zone(startX, WORLD_H / 2, 1, 1)
    // data/camera.json — deadzone + smoothing (no combat rule change)
    const sm = CAMERA.vertical.smoothing
    this.cameras.main.startFollow(this.camTarget, true, sm, sm)
    this.cameras.main.setDeadzone(CAMERA.deadZonePx.x, CAMERA.deadZonePx.y)
    this.registry.set('cameraJson', CAMERA)
  }

  /** 雙人：鏡頭跟中點；兩人可左右分邊，但唔准單獨行出畫面。 */
  private updateCameraFollow() {
    if (!this.camTarget || !this.boy) return
    const ahead = CAMERA.lookAheadPx
    if (this.girl && this.girl.active) {
      this.clampDuoToCamera()
      const midX = (this.boy.x + this.girl.x) / 2
      this.camTarget.setPosition(
        Math.round(Phaser.Math.Clamp(midX, GAME_W / 2, WORLD_W - GAME_W / 2)),
        WORLD_H / 2,
      )
    } else {
      const face = this.boy.facing || 1
      const targetX = this.boy.x + face * ahead
      this.camTarget.setPosition(
        // Clamp to half the 640px view (was 480 from the 960px era — hid the last 160px and the goal).
        Math.round(Phaser.Math.Clamp(targetX, GAME_W / 2, WORLD_W - GAME_W / 2)),
        WORLD_H / 2,
      )
    }
  }

  /** Keep both heroes inside the current screen; camera only advances with the pair mid. */
  private clampDuoToCamera() {
    const g = this.girl
    if (!g || !g.active) return
    const cam = this.cameras.main
    const pad = GameScene.CAM_EDGE_PAD
    const left = cam.scrollX + pad
    const right = cam.scrollX + cam.displayWidth - pad
    for (const h of [this.boy, g]) {
      if (h.x < left) {
        h.x = left
        const b = h.body as Phaser.Physics.Arcade.Body
        if (b.velocity.x < 0) b.velocity.x = 0
      } else if (h.x > right) {
        h.x = right
        const b = h.body as Phaser.Physics.Arcade.Body
        if (b.velocity.x > 0) b.velocity.x = 0
      }
    }
  }

  /** All living heroes + enemies — for actor-only freeze (ammo keeps flying). */
  private combatActors(): Phaser.Physics.Arcade.Sprite[] {
    const list: Phaser.Physics.Arcade.Sprite[] = [this.boy]
    if (this.girl?.active) list.push(this.girl)
    for (const o of this.enemies?.getChildren() ?? []) {
      const e = o as PatrolEnemy
      if (e.active && e.fsm !== 'DEAD') list.push(e)
    }
    return list
  }

  private leadX() {
    return this.girl?.active ? Math.max(this.boy.x, this.girl.x) : this.boy.x
  }

  private onCameraFollowUpdate() {
    snapCameraScroll(this.cameras.main)
    this.animateBg()
  }

  /**
   * 御守: one blessing per stage. Keyboard (O) and a tappable corner icon always
   * work; a phone shake fires the same thing when the device exposes motion and
   * (iOS) permission was already granted — see GachaScene's requestPermission() call.
   */
  private setupPrayerCharm() {
    if (activeCharm() !== 'omamori') return
    if (this.textures.exists('charm-omamori')) {
      this.prayIcon = this.add
        .image(GAME_W - 22, 44, 'charm-omamori')
        .setScrollFactor(0)
        .setDepth(DEPTH.UI)
        .setScale(0.7)
        .setVisible(hasPrayCharge())
        .setInteractive({ useHandCursor: true })
      this.prayIcon.on('pointerdown', () => this.tryPray())
      this.tweens.add({ targets: this.prayIcon, scale: { from: 0.65, to: 0.78 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.shakeHandler = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity
        if (!acc) return
        const mag = Math.abs(acc.x ?? 0) + Math.abs(acc.y ?? 0) + Math.abs(acc.z ?? 0)
        if (mag > 38 && this.time.now - this.lastShakeAt > 1200) {
          this.lastShakeAt = this.time.now
          this.tryPray()
        }
      }
      window.addEventListener('devicemotion', this.shakeHandler)
    }
  }

  /** Consumes the charge (if any) and blesses both heroes: full stamina + a brief invincibility flash. */
  private tryPray() {
    if (!usePrayCharge()) return
    SFX.sparkle()
    for (const h of [this.boy, this.girl]) {
      if (!h?.alive) continue
      h.stam = stamMax(h.role as Who)
      h.hurtCd = Math.max(h.hurtCd, 1500)
      startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, 1500)
      burst(this, h.x, h.y - 20, 0xffe08a, 10)
      floatText(this, h.x, h.y - 32, '祝福！', '#ffe08a')
    }
  }

  private onSceneShutdown() {
    if (this.shakeHandler) {
      window.removeEventListener('devicemotion', this.shakeHandler)
      this.shakeHandler = null
    }
    this.prayIcon = null
    // Must clear drawDebug before Phaser destroys the Graphics — otherwise
    // World.postUpdate still calls debugGraphic.clear() on undefined.
    this.resetPhysicsDebug(false)
    if (typeof (this as any).stopUi === 'function') (this as any).stopUi()
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.snapPixelArt, this)
    this.cameras?.main?.off(
      Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE,
      this.onCameraFollowUpdate,
      this,
    )
    this.time.removeAllEvents()
    this.tweens.killAll()
    // Do NOT keyboard.removeAllListeners() — KeyboardPlugin is shared across
    // scenes; nuking it mid-transition can drop the menu's fresh key binds
    // (Enter on clear screen then never reaches cast select).
    this.input?.removeAllListeners()
    this.entities.destroy()
    this.debugOverlay?.destroy()
  }

  /**
   * Keep Arcade World.drawDebug in sync with a live debugGraphic.
   * Phaser World.postUpdate does `this.debugGraphic.clear()` with no null check
   * whenever drawDebug is true — a stale flag after scene restart soft-crashes play.
   */
  private resetPhysicsDebug(on: boolean) {
    this.physicsDebug = on
    // Shutdown can run after Arcade World is already destroyed.
    const world = this.physics?.world
    if (!world) return
    world.defaults.debugShowBody = on
    world.defaults.debugShowVelocity = on
    if (on) {
      if (!world.debugGraphic || !world.debugGraphic.active) {
        world.createDebugGraphic()
      } else {
        world.debugGraphic.setVisible(true)
      }
      world.drawDebug = true
      for (const body of world.bodies) {
        body.debugShowBody = true
        body.debugShowVelocity = true
      }
      for (const body of world.staticBodies) {
        body.debugShowBody = true
      }
    } else {
      // Disable flag first so postUpdate cannot race a destroyed graphic.
      world.drawDebug = false
      const g = world.debugGraphic
      if (g) {
        try {
          if (g.active) g.clear()
          g.setVisible(false)
        } catch {
          /* graphic already torn down with the scene display list */
        }
      }
    }
  }

  private launchUi() {
    if (this.scene.isActive('UIScene') || this.scene.isSleeping('UIScene')) {
      this.scene.stop('UIScene')
    }
    const titles: Record<number, string> = { 1: '第一關・百畝樹林', 2: '第二關・蜜樹丘', 3: '第三關・月影夜市', 4: '第四關・鹽霧工地', 5: '第五關・△畝大廈' }
    this.scene.launch('UIScene', { mode: this.mode, stageTitle: titles[this.stageNo] ?? titles[1] })
    this.events.once('shutdown', this.stopUi, this)
  }

  private stopUi() {
    if (this.scene.isActive('UIScene') || this.scene.isSleeping('UIScene')) {
      this.scene.stop('UIScene')
    }
  }

  /**
   * Clear "just pressed" on every pause-trigger key and hold the pause gate briefly.
   * Any overlay a player dismisses with Enter / Esc / P / R (a tutorial, a minigame, a boss
   * card, a cutscene) must not let that same keypress also open the pause menu the instant
   * control returns — update() skips the pausePressed check while storyIntro is set, so the
   * JustDown flag survives to the very next frame and fires openPause() unless cleared here.
   */
  private resetPauseKeys() {
    for (const k of [this.keyEnter, this.keyEsc, this.keyP, this.keyR, this.keyF, this.keyG, this.keySpace]) k?.reset()
    this.pauseReadyAt = Math.max(this.pauseReadyAt, this.time.now + 250)
  }

  private openPause() {
    if (this.scene.isActive('pause')) return
    const resetKeys = () => this.resetPauseKeys()
    this.scene.pause()
    this.scene.launch('pause', {
      mode: this.mode,
      honey: this.honeyGot,
      onResume: () => {
        this.scene.resume()
        resetKeys()
      },
      onRestart: () => {
        this.scene.resume()
        this.stopUi()
        this.scene.restart()
      },
      onMenu: () => {
        this.scene.resume()
        this.goMenu()
      },
    })
  }

  /** After the last stage: staff roll, then the menu. */
  private goCredits() {
    if (this.registry.get('leavingToMenu')) return
    this.registry.set('leavingToMenu', true)
    this.stopUi()
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.time.delayedCall(420, () => {
      this.registry.set('leavingToMenu', false)
      this.scene.start('worldmap', { from: this.stageNo, to: Math.min(FINAL_STAGE, this.stageNo + 1), next: 'credits' })
    })
  }

  private goMenu() {
    // Guard: Enter/Space can fire both keydown listener + JustDown in the same frame.
    if (this.registry.get('leavingToMenu')) return
    this.registry.set('leavingToMenu', true)
    try {
      if (this.physics?.world) this.physics.resume()
    } catch {
      /* world may already be torn down */
    }
    this.registry.set('winScreenShown', false)
    this.stopUi()
    // 過場黑幕 0.3s 淡出 → 選單淡入
    const play = this
    try {
      play.cameras.main.fadeOut(300, 0, 0, 0)
    } catch {
      /* camera may be gone */
    }
    window.setTimeout(() => {
      try {
        if (play.sys?.isActive()) {
          play.scene.start('menu')
        } else {
          play.game.scene.stop('UIScene')
          play.game.scene.stop('play')
          play.game.scene.start('menu')
        }
      } finally {
        play.game.registry.set('leavingToMenu', false)
      }
    }, 300)
  }

  private emitHealth() {
    if (!this.boy) return
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      boyHp: Math.max(0, this.boy.hp),
      girlHp: Math.max(0, this.girl?.hp ?? 0),
      maxHp: MAX_HP + Math.max(bonusHearts('boy'), bonusHearts('girl')),
      stamL: this.boy.stam / stamMax(this.boy.role as Who),
      stamR: this.girl ? this.girl.stam / stamMax(this.girl.role as Who) : 1,
    })
  }

  /**
   * 耐力 (Alan, 2026-10-27): mashing attack was a free win, so each swing spends stamina and
   * it only comes back when you stop. It never locks you out — a tired swing still lands,
   * it just does half damage — so a panicking player is never left standing still.
   */
  private tickStamina(dt: number) {
    const now = this.time.now
    for (const h of [this.boy, this.girl]) {
      if (!h) continue
      const who = h.role as Who
      const max = stamMax(who)
      // Still swinging (within STAM_REST_MS of the last attack) → no regen at all, so a
      // mash-attack flurry visibly runs the bar down instead of coasting on partial
      // recovery between hits (Alan, 2026-10-27: "唔好一味係咁咁攻擊就好似保命符").
      const resting = now - h.lastAtkAt > STAM_REST_MS
      const rate = resting ? STAM_RECOVER * stamRecoverMul(who) : 0
      h.stam = Phaser.Math.Clamp(h.stam + (rate * dt) / 1000, 0, max)
    }
    this.emitHealth()
  }

  /** Spend stamina for one attack; false means the hero is winded (half damage). */
  private spendStamina(h: Hero, cost: number) {
    h.lastAtkAt = this.time.now
    if (h.stam < cost) {
      h.stam = Math.max(0, h.stam - cost * 0.4)
      if (this.time.now - (h.getData('windedAt') as number | undefined ?? 0) > 900) {
        h.setData('windedAt', this.time.now)
        floatText(this, h.x, h.y - 64, '冇氣！', '#8ad0ff', { size: 12, dur: 700 })
        SFX.land()
      }
      return false
    }
    h.stam -= cost
    return true
  }

  private emitScore(info?: string) {
    const wl = (h: Hero | null | undefined) => (h ? ((h.getData('wlv') as number | undefined) ?? 1) : 1)
    const wm = (h: Hero | null | undefined): 'normal' | 'heavy' =>
      h ? ((h.getData('wmode') as 'normal' | 'heavy' | undefined) ?? 'normal') : 'normal'
    const wmLabel = (h: Hero | null | undefined): string => {
      const mode = wm(h)
      if (!h) return mode === 'heavy' ? '重擊' : '連射'
      return h.role === 'girl' ? (mode === 'heavy' ? '重劍' : '快劍') : mode === 'heavy' ? '重擊' : '連射'
    }
    EventBus.emit(GameEvents.SCORE_UPDATED, {
      score: this.scorePts,
      coins: this.purse[(this.boy?.role as Who) ?? 'boy'] ?? this.coinStock,
      special: this.specialCharges,
      honey: this.honeyGot,
      progress: this.boy ? Math.min(1, this.leadX() / (WORLD_W - 160)) : 0,
      timeSec: this.started ? Math.floor((this.time.now - this.startedAt) / 1000) : 0,
      wlvL: wl(this.boy),
      wlvR: wl(this.girl),
      wmodeL: wm(this.boy),
      wmodeR: wm(this.girl),
      wmodeLabelL: wmLabel(this.boy),
      wmodeLabelR: wmLabel(this.girl),
      ...(info !== undefined ? { info } : {}),
    })
  }

  /** Fill 絕招 MP from eating／拾取蜂蜜（max 1 charge）. */
  private grantHoneySpecial(x: number, y: number, label = true) {
    this.honeyGot = Math.min(3, this.honeyGot + 1)
    buzz(HAPTIC.honey)
    if (this.specialCharges < 1) {
      this.specialCharges = 1
      if (label) floatText(this, x, y - 36, '絕招就緒！撳Ｔ', '#66ccff')
    } else if (label) {
      floatText(this, x, y - 18, '蜂蜜＋１', '#ffcc44')
    }
    this.emitScore()
  }

  /** Toggle Arcade Physics body/velocity debug in real time (~ / F2). */
  private togglePhysicsDebug() {
    this.resetPhysicsDebug(!this.physicsDebug)
  }

  playHurtPose(h: Hero, dir: number = -1) {
    // Drive hurt lock via fixed dt tick — no competing delayedCall zeroing timers.
    applyHurtPose(h, dir)
    h.hurtCd = Math.max(h.hurtCd, HURT_LOCK_MS + 80)
  }

  beginDie(h: Hero, msg: string) {
    beginDeathPose(h)
    this.refreshHearts()
    this.lose(msg)
  }

  update(_t: number, dt: number) {
    this.pad2 = this.mode === '2p' ? p2Pad() : null
    if (Phaser.Input.Keyboard.JustDown(this.keyDebug)) {
      const on = this.debugOverlay.toggle()
      this.resetPhysicsDebug(on)
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keyPhysicsDebug) ||
      Phaser.Input.Keyboard.JustDown(this.keyPhysicsDebugAlt)
    ) {
      this.togglePhysicsDebug()
    }

    if (this.ended) {
      if (this.awaitingContinue && this.coinJust()) this.insertCoinContinue()
      else if (this.registry.get('winScreenShown')) {
        // The clear card owns Enter / Space / R / clicks; touch buttons map onto the same action.
        if (TouchInput.justPressed('left')) this.clearCardMove?.(-1)
        if (TouchInput.justPressed('right')) this.clearCardMove?.(1)
        if (TouchInput.justPressed('start') || TouchInput.justPressed('attack') || TouchInput.justPressed('jump')) this.clearCardAction?.()
      } else if (Phaser.Input.Keyboard.JustDown(this.keyR) || TouchInput.justPressed('start') || TouchInput.justPressed('menu')) {
        this.goMenu()
      }
      this.debugOverlay.draw({
        heroes: [this.boy, this.girl].filter(Boolean) as Hero[],
        enemies: (this.enemies?.getChildren() ?? []) as Creep[],
        pet: this.pet ?? undefined,
        zoneSigns: this.zoneSignData(),
      })
      return
    }
    if (!this.started) {
      this.debugOverlay.draw({
        heroes: [this.boy, this.girl].filter(Boolean) as Hero[],
        enemies: (this.enemies?.getChildren() ?? []) as Creep[],
        pet: this.pet ?? undefined,
        zoneSigns: this.zoneSignData(),
      })
      return
    }

    if (this.storyIntro) return

    if (hasPrayCharge() && Phaser.Input.Keyboard.JustDown(this.keyO)) this.tryPray()
    this.prayIcon?.setVisible(hasPrayCharge())

    // Start / Enter / Esc / P → pause menu (restart and back-to-menu live there now;
    // R no longer restarts instantly — it sits right next to F and T).
    const pausePressed =
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keyEsc) ||
      Phaser.Input.Keyboard.JustDown(this.keyP) ||
      Phaser.Input.Keyboard.JustDown(this.keyR) ||
      TouchInput.justPressed('start') ||
      this.padFaceJust(this.pad2, 9)
    if (pausePressed && this.time.now >= this.pauseReadyAt) {
      this.openPause()
      return
    }

    // Fixed logic step: combat timers first, then steer, then AI.
    tickCombatTimers(this.boy, dt)
    this.boy.atkCd = Math.max(0, this.boy.atkCd - dt)
    if (this.girl) {
      tickCombatTimers(this.girl, dt)
      this.girl.atkCd = Math.max(0, this.girl.atkCd - dt)
    }

    if (!isActorFrozen(this.boy, this.time.now)) this.moveBoy(dt)
    else this.boy.setVelocity(0, 0)
    if (this.mode === '2p' && this.girl) {
      if (!isActorFrozen(this.girl, this.time.now)) this.moveGirl(dt)
      else this.girl.setVelocity(0, 0)
    }

    this.updatePet()
    this.activateDeferredEnemies()
    this.tickEnemyStagger(dt)
    this.tickStamina(dt)
    this.updateEnemies(dt)
    this.cullSalmonShots()
    this.entities.syncEnemiesFromGroup(this.enemies)
    this.syncFx()
    this.animateBg()
    this.tickAmbientCritters(dt)
    this.tickMovers()
    this.tickCrushers(dt)
    if (this.tree) this.tickStage2(dt)
    if (this.market) this.tickStage3(dt)
    if (this.depot) this.tickStage4(dt)
    if (this.tower) this.tickStage5(dt)
    this.checkFall()
    this.updateCheckpoint()

    this.boyGoal = !!this.physics.overlap(this.boy, this.goal)
    this.girlGoal = this.mode === '1p' ? true : !!(this.girl && this.physics.overlap(this.girl, this.goal))

    this.tickStageBeats()

    // Altar climax: 2–3 barrel ambushers wake with clear telegraph before boss.
    if (!this.altarAmbushOn && this.leadX() > ST.altarTriggerX) {
      this.triggerAltarAmbush()
    }

    // Stage 1 has no boss (design bible): beat the altar ambush, then the honey tree opens.
    if (!this.bossOn && this.altarAmbushOn) {
      const ambushLeft = this.enemies.getChildren().some((o) => {
        const e = o as PatrolEnemy
        // Deferred (not yet walked in) ambushers count as still to beat.
        return e.altarAmbush && e.fsm !== 'DEAD'
      })
      if (!ambushLeft) {
        this.bossOn = true
        SFX.powerUp()
        playSong('stage1')
        this.cameras.main.flash(200, 255, 230, 150)
        floatText(this, this.cameras.main.scrollX + GAME_W / 2, 90, '伏兵退散！去蜂巢樹！', '#ffe08a', { size: 18, dur: 2200 })
        this.emitScore('伏兵退散！去蜂巢樹拎第一罐真蜂蜜')
      }
    }

    this.updateCameraFollow()

    this.scorePts = this.liveScore()
    // Journey / time / honey / weapon go to the HUD as numbers; text `info` is only for real messages.
    this.emitScore()
    this.emitHealth()
    this.checkWin()

    this.debugOverlay.draw({
      heroes: [this.boy, this.girl].filter(Boolean) as Hero[],
      enemies: this.enemies.getChildren() as Creep[],
      pet: this.pet ?? undefined,
      zoneSigns: this.zoneSignData(),
    })
  }

  /** F1-only zone markers — never drawn in normal player view. */
  private zoneSignData(): Array<{ x: number; y: number; label: string }> {
    // DEBUG_MODE=false → 「平地・溪流」「平台帶」 never shown (F1 overlay also gated).
    if (!DEBUG_MODE) return []
    return [
      { x: 180, y: GROUND_Y - 96, label: '平地・溪流' },
      { x: 780, y: GROUND_Y - 96, label: '平台帶' },
      { x: 1750, y: GROUND_Y - 96, label: '伏兵區' },
      { x: 3000, y: GROUND_Y - 96, label: '蜂巢前' },
    ]
  }

  private liveScore() {
    return (
      calcScore({
        timeSec: (this.time.now - this.startedAt) / 1000,
        honey: this.honeyGot,
        hpBoy: Math.max(0, this.boy.hp),
        hpGirl: Math.max(0, this.girl?.hp ?? 0),
        deaths: this.deaths,
      }) + this.killBonus
    )
  }

  /** flat → platforms → ambush → altar — one readable story beat each. */
  private tickStageBeats() {
    const lead = this.leadX()
    const beats: Array<{ x: number; title: string }> = this.tower
      ? [
          { x: 640, title: '大堂・蜜流輸送帶' },
          { x: 1600, title: '停電樓層・熄燈' },
          { x: 2560, title: '天台工地・推土機' },
        ]
      : this.depot
      ? [
          { x: 640, title: '鋼架工地・推土機' },
          { x: 1480, title: '寫字樓走廊' },
          { x: 2420, title: '安靜嘅班車' },
        ]
      : this.market
      ? [
          { x: 640, title: '無人攤檔街' },
          { x: 1480, title: '暗巷・熄燈' },
          { x: 2380, title: '溪橋・溫泉' },
        ]
      : this.tree
      ? [
          { x: 640, title: '蜜僵松鼠群' },
          { x: 1440, title: '滴蜜長廊' },
          { x: 2320, title: '樹心・松鼠潮' },
        ]
      : [
          { x: 720, title: '木橋・平台帶' },
          { x: 1680, title: '伏兵出現！' },
          { x: 2880, title: '森林深處・決戰' },
        ]
    const next = this.stageBeat
    if (next < beats.length && lead >= beats[next].x) {
      this.stageBeat = next + 1
      const b = beats[next]
      SFX.boss()
      this.cameras.main.flash(120, 255, 220, 140)
      floatText(this, this.cameras.main.scrollX + GAME_W / 2, L(100), b.title, '#ffe08a', {
        size: 28,
        rise: 24,
        dur: 900,
      })
      this.emitScore(b.title)
    }
  }

  private addScorePop(x: number, y: number, pts: number) {
    this.killBonus += pts
    scorePop(this, x, y, pts)
    this.scorePts = this.liveScore()
    this.emitScore()
  }

  private updateCheckpoint() {
    // Fixed checkpoints from stage1.json (continue revives at checkpointX − 40).
    this.tickCheckpoints()
    this.checkpointX = this.lastCheckpointX + 40
  }

  private coinJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyC) ||
      TouchInput.justPressed('start') ||
      this.padFaceJust(this.pad2, 9)
    )
  }

  private bindKeys() {
    const kb = this.input.keyboard!
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.G,
      Phaser.Input.Keyboard.KeyCodes.T,
      Phaser.Input.Keyboard.KeyCodes.H,
      Phaser.Input.Keyboard.KeyCodes.J,
      Phaser.Input.Keyboard.KeyCodes.K,
      Phaser.Input.Keyboard.KeyCodes.U,
      Phaser.Input.Keyboard.KeyCodes.I,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.COMMA,
      Phaser.Input.Keyboard.KeyCodes.PERIOD,
      Phaser.Input.Keyboard.KeyCodes.SEMICOLON,
      Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
      Phaser.Input.Keyboard.KeyCodes.C,
      Phaser.Input.Keyboard.KeyCodes.F1,
      Phaser.Input.Keyboard.KeyCodes.F2,
      Phaser.Input.Keyboard.KeyCodes.BACKTICK,
    ])
    this.cursors = kb.createCursorKeys()
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, true)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, true)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, true)
    this.keyF = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F, true)
    this.keyG = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G, true)
    this.keyT = kb.addKey(Phaser.Input.Keyboard.KeyCodes.T, true)
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H, true)
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K, true)
    this.keyU = kb.addKey(Phaser.Input.Keyboard.KeyCodes.U, true)
    this.keyComma = kb.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA, true)
    this.keyPeriod = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD, true)
    this.keySemicolon = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SEMICOLON, true)
    this.keySlash = kb.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH, true)
    this.keyNP1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE, true)
    this.keyNP2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO, true)
    this.keyNP4 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR, true)
    this.keyR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R, true)
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, true)
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true)
    this.keyP = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P, true)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true)
    this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C, true)
    this.keyRShift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, true)
    this.keyO = kb.addKey(Phaser.Input.Keyboard.KeyCodes.O, true)
    void this.keyRShift
    this.keyDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1, true)
    this.keyPhysicsDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK, true)
    this.keyPhysicsDebugAlt = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2, true)

    this.pad1 = null
    this.pad2 = p2Pad()
  }

  private padPrev: Record<string, boolean> = {}
  private padFaceJust(pad: Gamepad | null, i: number) {
    if (!pad) return false
    const down = padBtn(pad, i)
    const key = `${pad.index}:${i}`
    const was = !!this.padPrev[key]
    this.padPrev[key] = down
    return down && !was
  }
  private padAxis(pad: Gamepad | null, horiz: boolean) {
    return padDir(pad, horiz)
  }

  /** Y = attack (F / , / legacy J) */
  /** P1 attack = F only（超任 Y）；J 唔再用。 */
  private p1AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyF) ||
      this.padFaceJust(this.pad1, 3) ||
      TouchInput.justPressed('attack')
    )
  }
  /** B = jump (G / legacy K) */
  private p1JumpJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyG) ||
      Phaser.Input.Keyboard.JustDown(this.keyK) ||
      this.padFaceJust(this.pad1, 0) ||
      TouchInput.justPressed('jump')
    )
  }
  private p1JumpHeld() {
    return (
      this.keyG.isDown ||
      this.keyK.isDown ||
      !!(this.pad1?.buttons[0]?.pressed) ||
      TouchInput.isDown('jump')
    )
  }
  /** Stage 1: S / pad↓ / touch crouch — no lane swap. (Arrow↓ is P2.) */
  private p1CrouchHeld() {
    return (
      this.keyS.isDown ||
      this.padAxis(this.pad1, false) > 0.45 ||
      TouchInput.isDown('down') ||
      TouchInput.isDown('crouch')
    )
  }
  private p1SpecialJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyT) ||
      Phaser.Input.Keyboard.JustDown(this.keyU) ||
      this.padFaceJust(this.pad1, 2) ||
      TouchInput.justPressed('special')
    )
  }
  /**
   * Weapon-mode switch (倫寶 雙槍切換 / 琪寶寶 快劍↔重劍), Alan: use the free 4th action
   * key (H sits unused next to F/G/T) + gamepad LT (index 6, NOT R1 — index 5 is
   * already special, see gamepadBridge.ts; Cursor's device pass caught the earlier
   * wrong naming), touch button for phone.
   * Bug fix (code-review pass before handing off to Cursor for device testing): P1's
   * gamepad is NEVER read via `this.pad1` directly — see its field comment, it's kept
   * hardcoded null by design, P1's real controller input flows through TouchInput
   * (gamepadBridge.ts), same as p1Attack/Jump/SpecialJust below. The original version
   * of this method checked `this.padFaceJust(this.pad1, 5)`, which is permanently dead
   * code (always false) — it silently never fired on a real gamepad, and happened to
   * also collide with gamepadBridge's own index-5 "special" mapping if it had worked.
   * Fixed to go through TouchInput like every other P1 action; gamepadBridge.ts now
   * maps index 6 (free — 0/1/2/3/4/5 are jump/attack/special, 8/9 are start) to it,
   * and mountTouchControls has a matching on-screen button for phone play. Confirmed
   * working on simulated gamepad/phone by Cursor's round-2 device-testing pass.
   */
  private p1WeaponSwitchJust() {
    return Phaser.Input.Keyboard.JustDown(this.keyH) || TouchInput.justPressed('weaponSwitch')
  }
  private p2AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyComma) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP1) ||
      this.padFaceJust(this.pad2, 1) ||
      this.padFaceJust(this.pad2, 2)
    )
  }
  private p2JumpJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyPeriod) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP2) ||
      this.padFaceJust(this.pad2, 0)
    )
  }
  private p2JumpHeld() {
    return this.keyPeriod.isDown || this.keyNP2.isDown || !!(this.pad2?.buttons[0]?.pressed)
  }
  private p2CrouchHeld() {
    return !!this.cursors.down?.isDown || this.padAxis(this.pad2, false) > 0.45
  }
  private p2SpecialJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keySemicolon) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP4) ||
      this.padFaceJust(this.pad2, 3) ||
      this.padFaceJust(this.pad2, 4) ||
      this.padFaceJust(this.pad2, 5)
    )
  }
  /**
   * Weapon-switch for P2 (快劍↔重劍 stance switch) — the free 4th action key
   * (slash sits unused next to comma/period/semicolon). pad2's indices 4/5
   * (L1/R1) are already alt-bindings for special, so pad index 6 (LT, NOT R1)
   * stands in as P2's shoulder button for this until Alan wants a real pad remap.
   */
  private p2WeaponSwitchJust() {
    return Phaser.Input.Keyboard.JustDown(this.keySlash) || this.padFaceJust(this.pad2, 6)
  }

  private steerHero(
    h: Hero,
    dt: number,
    left: boolean,
    right: boolean,
    jumpJust: boolean,
    jumpHeld: boolean,
    speed: number,
    attackJust: boolean,
    doAttack: () => void,
    crouchHeld = false,
  ) {
    h.moveSpeed = speed
    h.updatePlayer(dt, {
      left, right, jumpJust, jumpHeld, attackJust, crouchHeld,
      onJump: () => SFX.jump(), onAttack: doAttack, now: this.time.now,
    })
    this.s3world?.slip(h, dt)
    this.s5world?.push(h, dt)
    if (h.justLandedFlag) {
      if (hasFx(this, 'land-dust')) playFx(this, 'land-dust', h.x, h.y + 1, { originY: 1, depth: h.depth - 0.1 })
      else this.juice.landDust(h.x, h.y)
      h.clearJustLanded()
    }
    const body = h.body as Phaser.Physics.Arcade.Body
    if ((body.blocked.down || body.touching.down) && Math.abs(body.velocity.x) > 40 && h.alive) {
      this.juice.runDust(h.x, h.y, dt, true)
    }
    // Footsteps on the walk-cycle beat (frames 1 and 3), surface from what is under the feet.
    if (!h.laneJumping && h.alive && Math.abs(body.velocity.x) > 40 && h.anims?.currentFrame) {
      const fi = h.anims.currentFrame.index
      if (fi !== h.getData('stepFrame') && (fi === 1 || fi === 3)) {
        const top = supportTopAt(h.x, h.y, 4, 10)
        const surface = top !== null && top < LANE_FLOOR_Y - 2 ? 'wood' : 'grass'
        SFX.stepOn(surface)
      }
      h.setData('stepFrame', fi)
    }
  }

  /** Snap actors onto the integer pixel grid after motion/FX. Ground ellipses self-update. */
  private snapPixelArt() {
    const enemies = (this.enemies?.getChildren() ?? []) as Creep[]
    snapWorldActors({
      heroes: [this.boy, this.girl].filter(Boolean) as Hero[],
      pet: this.pet ?? undefined,
      enemies,
      shadows: [],
      shadowSources: [],
      extras: [this.sword].filter((o): o is Phaser.GameObjects.Image => !!o),
    })
  }

  /** Feet contact Y for ground-shadow (lane floor; jump lift fades the ellipse). */
  private groundYFor(target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite): number {
    const lane =
      typeof (target as Hero).lane === 'number'
        ? (target as Hero).lane
        : (target.getData('lane') as LaneId | undefined)
    if (terrainEnabled()) {
      const top = groundTopBelow(target.x, target.y)
      if (top !== null) return top
      return GAME_H + 40 // over a pit: shadow drops out of view
    }
    if (lane !== undefined && lane !== null) return laneY(clampLane(lane))
    return GROUND_Y
  }

  private moveBoy(dt: number) {
    const ax = this.padAxis(this.pad1, true)
    const left = this.keyA.isDown || ax < -0.45 || TouchInput.isDown('left')
    const right = this.keyD.isDown || ax > 0.45 || TouchInput.isDown('right')
    const spd =
      (this.boy.role === 'girl' ? GIRL_SPEED : PLAYER.moveSpeed) *
      (this.s2world?.speedMul(this.boy) ?? 1) *
      speedMul()
    this.steerHero(
      this.boy, dt, left, right,
      this.p1JumpJust(), this.p1JumpHeld(), spd,
      this.p1AttackJust(),
      () => (this.boy.role === 'girl' ? this.swordSlash(this.boy) : this.fireSalmon(this.boy)),
      this.p1CrouchHeld(),
    )
    if (this.p1SpecialJust()) this.fireHoneySpecial(this.boy)
    if (this.p1WeaponSwitchJust()) this.toggleWeaponMode(this.boy)
  }

  private moveGirl(dt: number) {
    const g = this.girl
    if (!g) return
    const ax = this.padAxis(this.pad2, true)
    const left = !!this.cursors.left?.isDown || ax < -0.45
    const right = !!this.cursors.right?.isDown || ax > 0.45
    this.steerHero(
      g, dt, left, right,
      this.p2JumpJust(), this.p2JumpHeld(), GIRL_SPEED * (this.s2world?.speedMul(g) ?? 1) * speedMul(),
      this.p2AttackJust(), () => this.swordSlash(g),
      this.p2CrouchHeld(),
    )
    if (this.p2SpecialJust()) this.fireHoneySpecial(g)
    if (this.p2WeaponSwitchJust()) this.toggleWeaponMode(g)
  }

  /**
   * Honey special (T / ; / pad X): needs 1 MP charge from eating蜂蜜.
   * P1 attack = F（超任 Y）／J（舊鍵）both fire salmon — intentional aliases.
   */
  private fireHoneySpecial(h: Hero) {
    if (!h.alive) return
    if (this.specialCharges <= 0) {
      floatText(this, h.x, h.y - 40, '需要蜂蜜！', '#88aacc')
      SFX.land()
      return
    }
    let best: PatrolEnemy | null = null
    let bestD = Infinity
    for (const o of this.enemies.getChildren()) {
      const e = o as PatrolEnemy
      if (!e.active || e.fsm === 'DEAD') continue
      const d = Phaser.Math.Distance.Between(h.x, h.y, e.x, e.y)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    if (!best) {
      floatText(this, h.x, h.y - 40, '無目標', '#aaaaaa')
      return
    }
    // 秘技 (menu code): unlimited 絕招.
    if (!this.registry.get('cheat')) this.specialCharges -= 1
    this.emitScore()
    freezeActors(this, this.combatActors(), ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    const jet = this.honeys.create(h.x, h.y - 28, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(2 * PROJ_DISPLAY_SCALE).setDepth(actorDepth('shot', h.lane, h.y))
    enableActorSprite(jet)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    const ang = Phaser.Math.Angle.Between(h.x, h.y - 28, best.x, best.y - 20)
    const spd = 620
    jet.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
    jet.setData('lane', best.lane)
    jet.setData('fromY', best.y)
    jet.setData('homing', best)
    jet.setData('by', h.role as Who)
    this.entities.add(jet, 'projectile')
    const ultName = h.role === 'girl' ? '蜜光斬' : '鮭魚瀑布'
    floatText(this, h.x, h.y - 48, ultName, '#66ddff')
    burst(this, h.x, h.y - 28, 0x66ccff, 10)
    this.playUltimateFx(h)
    this.emitScore(`${ultName}！蜂蜜 MP 清空`)
    this.time.delayedCall(900, () => {
      if (jet.active) jet.destroy()
    })
  }

  /**
   * ART-16 絕招 FX (docs/cursor/ART-REQUEST-16-ultimate-fx.md): full-screen flourish
   * layered on top of the unchanged single-target homing shot above — a short
   * role-tinted charge-aura pulse at the hero, then the named full-screen sweep
   * (倫寶 鮭魚瀑布 / 琪寶寶 蜜光斬) across the screen. Pure visual juice: targeting and
   * damage still come from the homing `jet` fired just above, not from this sweep —
   * turning it into real multi-enemy AoE is a balance call Alan hasn't scoped yet.
   */
  private playUltimateFx(h: Hero) {
    const girl = h.role === 'girl'
    const auraTint = girl ? 0xffd060 : 0xff8a5a // 蜜糖金 / 鮭魚粉橙 (shared B&W sheet, tinted per hero)
    if (hasFx(this, 'charge-aura')) {
      // Cursor's round-2 device pass: at scale 0.7 the 128×128 sheet (~90px) was 2-3×
      // the hero's own height and rendered on top (default depth), so it completely
      // blotted the character out instead of reading as a ring around them. Shrunk to
      // roughly hero-height and dropped just behind the sprite.
      const hgt = Math.max(16, h.displayHeight || 32)
      const aura = playFx(this, 'charge-aura', h.x, h.y - hgt * 0.3, { scale: (hgt * 1.3) / 128, depth: h.depth - 1, alpha: 0.85 })
      if (aura) aura.setBlendMode(Phaser.BlendModes.ADD).setTint(auraTint)
    }
    const sweepName = girl ? 'ult-honey-slash' : 'ult-salmon-wave'
    if (hasFx(this, sweepName)) {
      const sweepY = this.cameras.main.scrollY + GAME_H / 2
      const dir = h.facing < 0 ? -1 : 1
      this.time.delayedCall(90, () => {
        // Cursor's round-2 pass: pixel-checked the sliced sheet directly (not just the
        // report's single screenshot) — the 6-frame burst only fills roughly the left
        // half of its own 320px cell and shrinks in place rather than crossing the
        // frame, so a single centered sprite left half the screen untouched (likely the
        // "flat rectangle" they saw was just empty frame against the stage background)
        // and read as a static flourish at ~0.3s, not a sweep. Slowed the clip to 14fps
        // (fx.json, ~0.43s — see slice_ult_fx.py) and tween it edge-to-edge in the
        // hero's facing direction so the existing art actually travels; still pure
        // visual (see class comment) — no new art, no damage change.
        const midX = this.cameras.main.scrollX + GAME_W / 2
        const sweep = playFx(this, sweepName, midX - dir * GAME_W * 0.4, sweepY, {
          flipX: h.facing < 0,
          scale: 2,
          depth: DEPTH.FX + 10,
          alpha: 0.95,
        })
        if (sweep) {
          sweep.setBlendMode(Phaser.BlendModes.ADD)
          this.tweens.add({ targets: sweep, x: midX + dir * GAME_W * 0.4, duration: 420, ease: 'Sine.easeOut' })
          sweep.once('destroy', () => this.tweens.killTweensOf(sweep))
        }
      })
    }
  }

  /** Melee/range smash for pots & chests in facing cone. */
  private smashBreakablesInFront(h: Hero) {
    this.pots.getChildren().forEach((o) => {
      const pot = o as Breakable
      if (!pot.active) return
      if (hitBreakable(h, pot)) this.breakPot(pot)
    })
  }

  /**
   * Weapon-mode toggle, shared by both roles (mode travels with the Hero via
   * setData, same convention as 'wlv'): 倫寶 'heavy' = single big-power roe
   * instead of the lv-based spread; 琪寶寶 'heavy' = slower, bigger, harder sword
   * strike instead of the 3-hit combo. Confirmed scope: just the switch + its
   * two concrete effects — no new art, no separate HUD icon yet.
   */
  private toggleWeaponMode(h: Hero) {
    const cur = (h.getData('wmode') as 'normal' | 'heavy' | undefined) ?? 'normal'
    const next = cur === 'normal' ? 'heavy' : 'normal'
    h.setData('wmode', next)
    SFX.blip(next === 'heavy' ? 320 : 520)
    // Same colour pair as the persistent HUD badge (cyan = normal, gold = heavy),
    // consistent across both heroes — Cursor playtest flagged the old mismatched tints.
    const label = h.role === 'girl' ? (next === 'heavy' ? '重劍' : '快劍') : next === 'heavy' ? '重擊鮭' : '連射鮭'
    floatText(this, h.x, h.y - 60, label, next === 'heavy' ? '#ffb060' : '#8ad8ff', { size: 16, dur: 900 })
  }

  private fireSalmon(h: Hero) {
    const freshShot = this.spendStamina(h, STAM_SHOT)
    const heavy = (h.getData('wmode') as 'normal' | 'heavy' | undefined) === 'heavy'
    h.atkCd = Math.round((freshShot ? SALMON_SHOT_COOLDOWN_MS : Math.round(SALMON_SHOT_COOLDOWN_MS * 1.6)) * (heavy ? 1.8 : 1))
    h.pose = 'idle'
    h.playAction(h.crouching ? 'shoot-crouch' : 'shoot')
    // Commit freeze actors only — salmon shot keeps flying (Pack2 G).
    freezeActors(this, this.combatActors(), ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    this.tweens.killTweensOf(h)
    h.setAngle(0)
    h.setScale(h.baseScale)
    // Muzzle at torso — scaled to hero display size.
    const hgt = Math.max(16, h.displayHeight || 32)
    const muzzleX = h.x + h.facing * hgt * 0.55
    const muzzleY = h.y - hgt * 0.55
    // 金鮭 levels: Lv1 one roe · Lv2 two (up/down) · Lv3 three-way fan, range ×1.4.
    const lv = this.weaponLv(h)
    const range = lv >= 3 ? Math.round(SALMON_SHOT_RANGE * 1.4) : SALMON_SHOT_RANGE
    if (heavy) {
      // 重擊鮭 (heavy mode): one slow, heavy roe instead of the lv spread — trades
      // rate of fire for a bigger single hit (range ×1.6, power ×2.2).
      this.spawnRoe(h, muzzleX, muzzleY, 0, Math.round(range * 1.6), freshShot ? 2.2 : 1.1)
      burst(this, muzzleX, muzzleY, 0xff8040, 10)
    } else {
      const pattern: Array<{ dy: number; vy: number }> =
        lv >= 3
          ? [{ dy: 0, vy: -42 }, { dy: 0, vy: 0 }, { dy: 0, vy: 42 }]
          : lv === 2
            ? [{ dy: -5, vy: 0 }, { dy: 5, vy: 0 }]
            : [{ dy: 0, vy: 0 }]
      for (const p of pattern) this.spawnRoe(h, muzzleX, muzzleY + p.dy, p.vy, range, freshShot ? 1 : 0.5)
      burst(this, muzzleX, muzzleY, lv >= 2 ? 0xffd040 : 0xffaa66, 4 + lv * 2)
    }
    playFx(this, 'muzzle-flash', muzzleX + h.facing * 6, muzzleY, { flipX: h.facing < 0, depth: h.depth + 1 })
    this.smashBreakablesInFront(h)
  }

  private spawnRoe(h: Hero, x: number, y: number, vy: number, range: number, power = 1) {
    const shot = this.shots.create(x, y, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    // Heavy-mode roe (power > 1) reads bigger too, not just harder-hitting.
    // Alan: ammo read a bit chunky — trimmed base scale 2 → 1.7 (Cursor/Alan feedback).
    shot.setScale(1.7 * PROJ_DISPLAY_SCALE * (power < 1 ? 0.8 : power > 1 ? 1.4 : 1)).setDepth(actorDepth('shot', h.lane, h.y)).setFlipX(h.facing < 0)
    shot.setData('power', power)
    if (power < 1) shot.setTint(0x9ab0c8)
    else if (power > 1) shot.setTint(0xffa060)
    enableActorSprite(shot)
    ;(shot.body as Phaser.Physics.Arcade.Body).allowGravity = false
    shot.setVelocity(h.facing * SALMON_SHOT_SPEED, vy)
    shot.setData('lane', h.lane)
    shot.setData('fromY', h.y)
    shot.setData('originX', x)
    shot.setData('maxRange', range)
    this.entities.add(shot, 'projectile')
    const maxMs = Math.ceil((range / SALMON_SHOT_SPEED) * 1000) + 80
    this.time.delayedCall(maxMs, () => {
      if (shot.active) shot.destroy()
    })
  }

  /** Sword from hand at chest height, close to the body. */
  private girlSwordAnchor(h: Hero, swinging = false) {
    const hgt = Math.max(24, h.displayHeight || 64)
    return {
      x: h.x + h.facing * (swinging ? hgt * 0.18 : hgt * 0.12),
      y: h.y - hgt * 0.58,
      scale: h.baseScale,
    }
  }

  /** 噗噗 at bible height (56px bake) → integer scale 1. */
  private petScaleForGirl(_g: Hero) {
    return 1
  }

  /** 琪寶寶劍撃 — 近戰主力 */
  private swordSlash(h: Hero) {
    const fresh = this.spendStamina(h, STAM_SWORD)
    const heavy = (h.getData('wmode') as 'normal' | 'heavy' | undefined) === 'heavy'
    h.atkCd = Math.round((fresh ? SWORD_COOLDOWN_MS : Math.round(SWORD_COOLDOWN_MS * 1.6)) * (heavy ? 1.9 : 1))
    freezeActors(this, this.combatActors(), ATTACK_COMMIT_FREEZE_MS)
    // 3-hit combo: presses within 0.6s chain slash1 → slash2 → slash3.
    // 重劍 (heavy) skips the combo chain — every swing is the big slash3 strike.
    const lastAt = (h.getData('slashAt') as number | undefined) ?? -9999
    const step = heavy ? 3 : this.time.now - lastAt < 600 ? (((h.getData('slashN') as number | undefined) ?? 0) % 3) + 1 : 1
    h.setData('slashAt', this.time.now)
    h.setData('slashN', step)
    h.playAction(`slash${step}`)
    SFX.swing()
    const grip = this.girlSwordAnchor(h, true)
    burst(this, grip.x + h.facing * 24, grip.y, heavy ? 0xffa060 : 0xe8f0ff, heavy ? 16 : 10)
    h.setAngle(0)
    h.setScale(h.baseScale)
    if (this.sword) {
      this.sword.setVisible(true)
      this.sword.setAlpha(1)
      this.sword.setOrigin(h.facing < 0 ? 0.88 : 0.12, 0.55)
      this.sword.setPosition(grip.x, grip.y)
      this.sword.setScale(grip.scale)
      this.tweens.add({
        targets: this.sword,
        angle: h.facing > 0 ? 70 : -70,
        duration: heavy ? 180 : 110,
        yoyo: true,
        onComplete: () => {
          if (!this.sword) return
          this.sword.setAngle(h.facing > 0 ? -18 : 18)
        },
      })
    }
    // 金鮭 levels: Lv2 reach ×1.35 · Lv3 reach ×1.7 and +1 damage.
    // 重劍 stacks its own ×1.3 reach / ×1.8 damage on top of the weapon-level bonus.
    const lv = this.weaponLv(h)
    const reach = (lv >= 3 ? 1.7 : lv === 2 ? 1.35 : 1) * (heavy ? 1.3 : 1)
    if (lv >= 2) burst(this, grip.x + h.facing * SWORD_HIT_W * reach * 0.6, grip.y, 0xffe070, 4 + lv * 2)
    const swordDmg = Math.max(1, Math.round((PLAYER_ATTACK_DMG + (lv >= 3 ? 1 : 0)) * (fresh ? 1 : 0.5) * (heavy ? 1.8 : 1)))
    this.spawnAttackHitbox(h, swordDmg, Math.round(SWORD_HIT_W * reach), SWORD_HIT_H, SWORD_HIT_MS)
    // Sword trail: one arc per combo step, longer with the weapon level.
    const arc = (`slash-arc-${step}` as 'slash-arc-1' | 'slash-arc-2' | 'slash-arc-3')
    playFx(this, arc, h.x + h.facing * (22 + 10 * reach), h.y - 36, {
      flipX: h.facing < 0,
      scale: (reach > 1.5 ? 1.25 : reach > 1.2 ? 1.1 : 1) * (heavy ? 1.2 : 1),
      depth: h.depth + 1,
      alpha: 0.92,
    })
    this.smashBreakablesInFront(h)
  }

  /** Melee attack hitbox — overlap with enemies (not a solid collider). */
  private spawnAttackHitbox(h: Hero, dmg: number, w: number, ht: number, lifeMs: number) {
    const key = this.textures.exists('fx-salmon-shot') ? 'fx-salmon-shot' : 'coin'
    const box = this.attackHitboxes.create(
      h.x + h.facing * (w * 0.45),
      h.y - 40,
      key,
    ) as Phaser.Physics.Arcade.Sprite
    box.setAlpha(0).setDepth(actorDepth('hitbox', h.lane, h.y))
    const body = box.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(w, ht)
    box.setData('dmg', dmg)
    box.setData('dir', h.facing)
    box.setData('lane', h.lane)
    box.setData('fromY', h.y)
    box.setData('hitSet', new Set<string>())
    this.time.delayedCall(lifeMs, () => {
      if (box.active) box.destroy()
    })
  }

  /** 噗噗：可愛 pose hold 1s，再短衝半傷. */
  private summonBearAssist() {
    const g = this.girlHero()
    if (!g || !this.pet || this.petJetting || g.hp <= 0) return
    const pet = this.pet
    this.petJetting = true
    SFX.swing()
    floatText(this, pet.x, pet.y - 50, '噗噗～！', '#ffcc44')
    this.tweens.killTweensOf(pet)
    pet.setAngle(0)
    const basePet = this.petScaleForGirl(g)
    const petAnimated = pet.texture.key === animTex('pupu')
    if (petAnimated) pet.anims.play('pupu-cute-pose')
    else this.tweens.add({
      targets: pet,
      angle: { from: -14, to: 14 },
      scaleX: basePet * 1.12,
      scaleY: basePet * 0.9,
      duration: 220,
      yoyo: true,
      repeat: Math.max(1, Math.floor(BEAR_POSE_MS / 440)),
      ease: 'Sine.inOut',
    })
    this.time.delayedCall(BEAR_POSE_MS, () => {
      if (!this.girlHero() || !this.pet) {
        this.petJetting = false
        return
      }
      pet.setAngle(0)
      pet.setScale(this.petScaleForGirl(g))
      if (petAnimated) pet.anims.play('pupu-tackle')
      const frontX = g.x + g.facing * 52
      const frontY = laneY(g.lane)
      this.tweens.add({
        targets: pet,
        x: frontX,
        y: frontY,
        duration: 140,
        ease: 'Cubic.out',
        onComplete: () => {
          if (!this.girlHero() || !this.pet) {
            this.petJetting = false
            return
          }
          let best: PatrolEnemy | null = null
          let bestD = Infinity
          for (const o of this.enemies.getChildren()) {
            const e = o as PatrolEnemy
            if (!e.active || e.fsm === 'DEAD') continue
            const adj =
              e.lane !== undefined && g.lane !== undefined
                ? Math.abs(e.lane - g.lane) <= 1
                : false
            const d = Phaser.Math.Distance.Between(frontX, frontY, e.x, e.y)
            const score = adj ? d : d + 400
            if (score < bestD) {
              bestD = score
              best = e
            }
          }
          if (best && bestD < 220) {
            const dir = (Math.sign(best.x - pet.x) || g.facing) as 1 | -1
            this.damageEnemy(best, BEAR_ASSIST_DMG, dir, { lane: g.lane, y: g.y })
            burst(this, best.x, best.y - 20, 0xffc050, 12)
            floatText(this, best.x, best.y - 44, '半傷！', '#ffe08a')
          } else {
            burst(this, frontX, frontY - 16, 0xffc050, 8)
          }
          this.time.delayedCall(180, () => {
            this.petJetting = false
          })
        },
      })
    })
  }

  private damageEnemy(e: Creep | PatrolEnemy, dmg: number, dir: number, _from?: { lane?: number; y: number }) {
    const pe = e as PatrolEnemy
    if (pe.isDead || pe.fsm === 'DEAD') return
    void _from
    // 霸鼻象打中人後短暫霸體：其他人打唔入，佢仲可以打人
    if (typeof pe.isDominating === 'function' && pe.isDominating(this.time.now)) {
      floatText(this, pe.x, pe.y - 48, '霸體！', '#ffe08a', { size: 16, dur: 500 })
      return
    }
    // 機械豬 front armour: hits on its face clang off unless the slam left it open.
    if (pe.species === 'elephant' && this.time.now >= (pe.vulnerableUntil ?? 0)) {
      const face = pe.flipX ? -1 : 1
      if (dir === -face) {
        floatText(this, pe.x, pe.y - 52, '鐵甲！打背脊', '#cfd8e0', { size: 12, dur: 600 })
        burst(this, pe.x + face * 14, pe.y - 30, 0xe8f0ff, 5)
        playFx(this, 'armour-clank', pe.x + face * 22, pe.y - 30, { flipX: face < 0 })
        SFX.hit()
        return
      }
    }
    // 龍蝦兵 claws / 油甘魚攤主 behind the counter.
    const guarded = pe as unknown as { blocks?: (d: number) => boolean; hiding?: () => boolean }
    if (typeof guarded.blocks === 'function' && guarded.blocks(dir)) {
      floatText(this, pe.x, pe.y - 52, '叮！跳過頭打背脊', '#ffd0c0', { size: 12, dur: 600 })
      burst(this, pe.x - dir * 14, pe.y - 30, 0xffe0d0, 5)
      SFX.hit()
      return
    }
    if (typeof guarded.hiding === 'function' && guarded.hiding()) {
      floatText(this, pe.x, pe.y - 48, '躲埋咗！打爛個檔', '#ffe08a', { size: 12, dur: 600 })
      return
    }
    if (this.time.now < this.powerUntil) dmg = Math.ceil(dmg * 1.5)
    const heavy = dmg >= 2 || pe.kind === 'boss'
    const result = pe.receiveHit(dmg, dir)
    floatText(this, pe.x, pe.y - 40, heavy ? '重擊！' : '！')
    SFX.hit()
    // Hit confirm: freeze all characters 0.2s; do NOT pause world (ammo free).
    freezeActors(this, this.combatActors(), HIT_CONFIRM_FREEZE_MS)
    this.juice.shakeDamage()
    const midY = pe.y - Math.max(16, pe.displayHeight * 0.45)
    if (hasFx(this, 'hit-spark')) playFx(this, 'hit-spark', pe.x - dir * 6, midY, { scale: heavy ? 1.5 : 1 })
    else burst(this, pe.x, pe.y - 18, 0xffe8a0, heavy ? 8 : 6)
    impactRing(this, pe.x, pe.y - 12, heavy ? 0xffcc66 : 0xffe8a0, 8)
    this.addScorePop(pe.x, pe.y - 56, SCORE_HIT)
    if (result.killed) {
      SFX.kill()
      // 紅魚's own death frames already burst into smoke; the others get a puff.
      if (pe.species !== 'fish') this.time.delayedCall(120, () => playFx(this, 'enemy-poof', pe.x, midY + 6))
      burst(this, pe.x, pe.y - 16, 0xff6688, 14)
      impactRing(this, pe.x, pe.y - 16, 0xff6688, 14)
      const bonus = pe.kind === 'boss' ? SCORE_BOSS_KILL : SCORE_KILL
      this.addScorePop(pe.x, pe.y - 72, bonus)
      if (pe.kind === 'boss')
        this.emitScore(this.tower ? '大佬醒返喇！' : this.depot ? '泥鬃醒返喇！' : this.market ? '鏡鴞醒返喇！' : this.tree ? '女王蜂醒返喇！' : '武者倒下！搶回樹頂蜂巢！')
    }
  }

  /**
   * Per-species attack-damage multiplier — previously every species dealt the exact
   * same flat ENEMY_ATTACK_DMG regardless of how tanky/fast it is (HP already varied
   * 1–3, bosses 36–48, but damage didn't). Fast/fragile hits softer, slow/tanky and
   * telegraphed charges hit harder, bosses hardest. Tuned to feel internally
   * consistent — not a substitute for an actual playtest pass.
   */
  private speciesAtkMul(pe: PatrolEnemy): number {
    if (pe.kind === 'boss') return 1.8
    // Stage-1 cast (PatrolEnemy) is differentiated via pe.species — fish/barrel/elephant.
    if (pe.species === 'barrel') return 0.6 // 疾風桶：快但脆，衝擊感較輕（原有 comment 已講明）
    if (pe.species === 'elephant') return 1.4 // 霸鼻象：慢重坦克，撞到好痛
    if (pe.species === 'fish') return 1
    // Stage2-5 cast (AnimEnemy/Enemy subclasses) all share a generic species marker
    // ('stage2' etc., not a real per-species string), so differentiate by the Phaser
    // texture key each subclass loads instead — plain runtime string data, so it
    // survives a production minify pass (unlike constructor/class names).
    switch (pe.texture.key) {
      case 'anim-beesoldier':
        return 0.7 // 蜂兵：1hp 快速俯衝，脆皮
      case 'anim-minibee':
      case 'anim-egg':
        return 0.5 // 小蜜蜂／假蜜蛋：孵出嘅雜兵，更脆
      case 'anim-squirrel':
      case 'anim-lobster':
        return 1.1 // 蜜僵松鼠／龍蝦守衛：較硬淨
      case 'anim-mirrorowl':
      case 'anim-mirrorshade':
        return 0.6 // 分身／鏡影：1hp，單隻打少啲
      case 'stage4-honeyzombie':
        return 0.9 // 蜜僵：基本慢速殭屍
      case 'stage4-taximonster':
        return 1.5 // 的士怪：車頭燈預警後高速衝刺，命中要痛
      default:
        return 1
    }
  }

  private hurtHero(h: Hero, e: Creep | PatrolEnemy) {
    if (this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) return
    if (!enemyCanHurt(e as Creep)) return
    const pe = e as PatrolEnemy
    if (!sameLane(h, pe)) return
    if (pe.species === 'elephant' && pe.fsm === 'ATTACK' && (pe.atkPhase === 'strike' || pe.atkPhase === 'charge')) {
      const reach = Math.max(56, pe.displayWidth) * 1.5
      const face = pe.flipX ? -1 : 1
      const dx = h.x - pe.x
      if (Math.sign(dx) !== face || Math.abs(dx) > reach) return
    }
    if (pe.fsm === 'ATTACK') pe.hitThis = true
    else pe.contactCd = 650
    const away = (Math.sign(h.x - e.x) || -1) as 1 | -1
    // 疾風桶：攻擊力偏弱（較細 knock）；仍扣 1 格，但衝擊感明顯較輕。
    const speciesKnock = pe.species === 'barrel' ? 0.4 : pe.species === 'elephant' ? 1.15 : 1
    const gearKnock = knockMul(h.role as Who)
    const rawDmg = Math.max(1, Math.round(ENEMY_ATTACK_DMG * this.speciesAtkMul(pe) * difficultyAtkMul(getDifficulty())))
    const dmg = this.incoming(h, rawDmg)
    const hpLeft = applyDamage(h, {
      amount: dmg,
      knockbackX: this.safeKnockX(h, away * Math.round(340 * speciesKnock * gearKnock)),
      knockbackY: -Math.round(320 * Math.max(0.45, speciesKnock) * gearKnock),
      iframeMs: this.iframes(h),
      now: this.time.now,
    })
    applyHurtPose(h, -away)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, this.iframes(h))
    this.time.delayedCall(160, () => {
      if (h.pose !== 'die' && h.hurtLock <= 0) h.clearTint()
    })
    SFX.hurt()
    freezeActors(this, [h], PLAYER_HURT_FREEZE_MS)
    freezeActors(this, this.combatActors().filter((a) => a !== h), HIT_CONFIRM_FREEZE_MS)
    this.dropWeaponLv(h)
    if (pe.species === 'elephant' && typeof pe.grantDominate === 'function') {
      pe.grantDominate(this.time.now, ELEPHANT_DOMINATE_MS)
    }
    burst(this, h.x, h.y - 24, 0xff4466, 8)
    floatText(
      this,
      h.x,
      h.y - 40,
      pe.species === 'barrel' ? `輕傷 -${dmg}` : `-${dmg}`,
      pe.species === 'barrel' ? '#ffaa77' : '#ff6677',
    )
    this.juice.shakeDamage()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (hpLeft <= 0) this.knockOut(h)
  }

  /** Knockback never throws a hero into a pit: zero the push if a pit edge lies that way. */
  private safeKnockX(h: Hero, kx: number) {
    if (!kx || !terrainEnabled()) return kx
    const dir = Math.sign(kx)
    const reach = 80
    for (const p of terrainPits()) {
      const near = dir > 0 ? p.x0 >= h.x - 4 && p.x0 <= h.x + reach : p.x1 <= h.x + 4 && p.x1 >= h.x - reach
      if (near) return 0
    }
    return kx
  }

  private spike(h: Hero) {
    this.hazardHit(h, { knockX: h.facing * -180, knockY: -560, label: '尖刺' })
  }
  private durian(h: Hero) {
    this.hazardHit(h, {
      knockX: h.facing * -160,
      knockY: -480,
      label: '榴槤！腳痛！',
    })
  }
  private hazardHit(h: Hero, opts: { knockX: number; knockY: number; label?: string } = { knockX: 0, knockY: -560 }) {
    if (this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) return
    const hpLeft = applyDamage(h, {
      amount: this.incoming(h, 1),
      knockbackX: this.safeKnockX(h, opts.knockX * knockMul(h.role as Who)),
      knockbackY: opts.knockY,
      iframeMs: this.iframes(h),
      now: this.time.now,
    })
    applyHurtPose(h, -h.facing)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, this.iframes(h))
    SFX.spike()
    burst(this, h.x, h.y - 16, 0xff6633, 10)
    if (opts.label) floatText(this, h.x, h.y - 36, opts.label, '#ff8866')
    this.dropWeaponLv(h)
    this.juice.shakeDamage()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts?.()
    if (hpLeft <= 0) this.knockOut(h)
  }
  private checkFall() {
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h)
    const deathY = terrainEnabled() ? pitDeathY() : FALL_Y
    for (const h of heroes) {
      if (h.y > deathY) {
        if (this.ended || !this.started) continue
        const respawnX = this.respawnXFor(h.x)
        if (!canTakeDamage(h, this.time.now)) {
          // Still in i-frames: no damage, but never leave the hero falling forever.
          h.snapToLane(h.lane, respawnX)
          continue
        }
        const hpLeft = applyDamage(h, {
          amount: 1,
          knockbackX: 0,
          knockbackY: 0,
          now: this.time.now,
        })
        h.snapToLane(h.lane, respawnX)
        h.setVelocity(0, 0)
        floatText(this, h.x, h.y - 56, '跌落坑！', '#ff8866')
        this.dropWeaponLv(h)
        applyHurtPose(h, -h.facing)
        startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, this.iframes(h))
        SFX.spike()
        if (h.role === 'girl') this.summonBearAssist()
        this.refreshHearts()
        if (hpLeft <= 0) this.knockOut(h)
      }
    }
  }

  /**
   * Pit fall respawn: on base floor just before the pit that was missed (nearest pit within 80px,
   * knockback can carry the hero past its edge). Never further back than the last checkpoint passed.
   */
  private respawnXFor(fallX: number): number {
    const onBase = (x: number) => supportTopAt(x, LANE_FLOOR_Y, 8) !== null && wallClampX(x, LANE_FLOOR_Y, 1, 8) === null
    let best: { x0: number; x1: number } | null = null
    for (const p of terrainPits()) {
      const d = fallX < p.x0 ? p.x0 - fallX : fallX > p.x1 ? fallX - p.x1 : 0
      if (d <= 80 && (!best || d < (fallX < best.x0 ? best.x0 - fallX : fallX > best.x1 ? fallX - best.x1 : 0))) best = p
    }
    const from = best ? best.x0 - 70 : fallX - 40
    for (let x = from; x > from - 420; x -= 6) {
      if (x < this.lastCheckpointX - 10) break
      if (onBase(x)) return x
    }
    const cp = this.lastCheckpointX
    return onBase(cp) ? cp : 220
  }

  /**
   * Death path. Root-cause fix: previous guard was `if (h.hp <= 0 || !h.alive) return`,
   * so callers that already set hp to 0 never entered die/continue — soft-lock mockup feel.
   */
  private knockOut(h: Hero) {
    if (!h.alive || h.pose === 'die') return
    SFX.die()
    const lost = dropOnDeath(h.role as Who)
    if (lost) {
      floatText(this, h.x, h.y - 100, `跌咗：${gearById(lost.id).name} Lv${lost.from} → Lv${lost.from - 1}`, '#ff9a8a', { size: 13, dur: 2000 })
    }
    beginDeathPose(h)
    this.tweens.add({
      targets: h,
      angle: h.facing * 95,
      alpha: 0.35,
      duration: 520,
      ease: 'Cubic.in',
      onComplete: () => {
        h.setVelocity(0, 0)
        this.lose(h.role === 'boy' ? '倫寶倒下了…' : '琪寶寶倒下了…')
      },
    })
    this.refreshHearts()
  }

  private updateEnemies(dt: number) {
    const leadX = this.leadX()
    this.enemies.getChildren().forEach((o) => {
      tickEnemy(o as Creep, {
        dt,
        boy: this.boy,
        girl: this.girl,
        leadX,
        prevLeadX: this.prevLeadX,
        floatBang: (x, y, msg) => floatText(this, x, y, msg ?? '！', '#ff3333'),
      })
      this.keepEnemyOnTerrain(o as PatrolEnemy, dt)
      ;(o as unknown as { syncEliteMarker?: () => void }).syncEliteMarker?.()
    })
    this.prevLeadX = leadX
  }

  /** Enemies walk the base floor only: stop at pit edges and at raised-step walls. */
  private keepEnemyOnTerrain(e: PatrolEnemy, dt: number) {
    if (!terrainEnabled() || !e.active || !e.body) return
    if ((e as unknown as { flying?: boolean }).flying) return
    const body = e.body as Phaser.Physics.Arcade.Body
    const vx = body.velocity.x
    const dir = Math.sign(vx)
    if (!dir) return
    const half = Math.max(8, Math.round((e.displayWidth || 32) * 0.3))
    const nx = e.x + (vx * dt) / 1000
    const lead = nx + dir * half
    const blocked =
      supportTopAt(lead, LANE_FLOOR_Y, 1) === null || wallClampX(nx, LANE_FLOOR_Y, dir, half) !== null
    if (blocked) e.setVelocityX(0)
  }

  /** Active 琪寶寶 — 2P girl or 1P solo girl (stored in boy slot). */
  private girlHero(): Hero | null {
    if (this.girl) return this.girl
    if (this.boy?.role === 'girl') return this.boy
    return null
  }

  /** 噗噗：跟在琪寶寶身後（2P 或 1P 琪寶寶）。 */
  private updatePet() {
    const g = this.girlHero()
    const pet = this.pet
    if (!g || !pet) return
    let followX = g.x - g.facing * PET_FOLLOW_BEHIND
    if (this.girl && Math.abs(followX - this.boy.x) < 56) {
      followX = g.x - g.facing * (PET_FOLLOW_BEHIND + 40)
    }
    const followY = laneY(g.lane)
    const dx = followX - pet.x
    const dy = followY - pet.y
    // −20% with cast move pack (was 260 / 360).
    const speed = this.petJetting ? Math.round(260 * 0.8) : Math.round(360 * 0.8)
    const dist = Math.hypot(dx, dy)
    if (dist > 6) {
      const nx = dx / dist
      const ny = dy / dist
      const step = Math.min(dist, (speed * this.game.loop.delta) / 1000)
      pet.setPosition(pet.x + nx * step, pet.y + ny * step)
    } else {
      pet.setPosition(followX, followY)
    }
    pet.setVelocity(0, 0)
    if (pet.texture.key === animTex('pupu') && !this.petJetting) {
      const want = dist > 6 ? 'pupu-walk' : 'pupu-idle'
      if (pet.anims.currentAnim?.key !== want) pet.anims.play(want)
    }
    pet.setFlipX(g.facing < 0)
    if (!this.petJetting) pet.setScale(this.petScaleForGirl(g))
    pet.setAngle(0)
    pet.setAlpha(this.petJetting ? 1 : 0.85)
    pet.setVisible(true)
    pet.setActive(true)
    pet.setDepth(actorDepth('pet', g.lane, pet.y))
    pet.setData('lane', g.lane)
  }

  private syncFx() {
    // Ground shadows (ellipse) self-update via addGroundShadow.
    const g = this.girlHero()
    if (!g) return
    if (this.sword) {
      const swing = g.atkCd > 80
      const grip = this.girlSwordAnchor(g, swing)
      this.sword.setVisible(true)
      this.sword.setAlpha(1)
      this.sword.setOrigin(g.facing < 0 ? 0.88 : 0.12, 0.55)
      this.sword.setPosition(grip.x, grip.y)
      this.sword.setFlipX(g.facing < 0)
      this.sword.setScale(grip.scale)
      if (!swing) this.sword.setAngle(g.facing > 0 ? -18 : 18)
      this.sword.setDepth(actorDepth('hitbox', g.lane, g.y) + 0.2)
    }
  }

  /** Cull salmon shots past max range (distance balance). */
  private cullSalmonShots() {
    this.shots?.getChildren().forEach((o) => {
      const s = o as Phaser.Physics.Arcade.Sprite
      if (!s.active) return
      const origin = s.getData('originX') as number | undefined
      const maxR = (s.getData('maxRange') as number | undefined) ?? SALMON_SHOT_RANGE
      if (origin != null && Math.abs(s.x - origin) >= maxR) s.destroy()
    })
  }

  private bushStrip: Phaser.GameObjects.TileSprite | null = null

  private animateBg() {
    if (this.duskWash) {
      // 森林深處: the light drops as the path nears the altar.
      const k = Phaser.Math.Clamp((this.cameras.main.scrollX - 1600) / 1600, 0, 1)
      this.duskWash.setAlpha(k * 0.26)
    }
    if (this.bushStrip) this.bushStrip.tilePositionX = Math.round(this.cameras.main.scrollX * 0.5)
    if (this.farTrunks) this.farTrunks.tilePositionX = Math.round(this.cameras.main.scrollX * 0.25)
    if (!this.water) return
    const sx = this.cameras.main.scrollX
    const t = this.time.now
    // River current — layered speeds for depth (foam fastest).
    snapTilePosition(this.water, sx * 0.28 + t * 0.12)
    snapTilePosition(this.waterMid, sx * 0.38 + t * 0.17)
    snapTilePosition(this.waterFoam, sx * 0.5 + t * 0.24)
    // Soft vertical bob on mid water so the surface breathes.
    if (this.waterMid) {
      this.waterMid.y = 490 + Math.sin(t * 0.0022) * 1.5
    }
    if (this.waterFoam) {
      this.waterFoam.y = 466 + Math.sin(t * 0.0031 + 1.2) * 1.2
    }
    // Discrete landmarks stay in the sky band (scrollFactor 0).
    // Clouds soft-wrap; mountains drift slowly without re-tiling into a band.
    for (let i = 0; i < this.bgClouds.length; i++) {
      const c = this.bgClouds[i]
      const base = (c.getData('baseX') as number) ?? c.x
      const rate = (c.getData('parallax') as number) ?? 0.08
      let x = base - sx * rate + Math.sin(t * 0.00035 + i) * 6
      x = ((x % 1200) + 1200) % 1200 - 80
      c.x = Math.round(x)
    }
    for (let i = 0; i < this.bgMounts.length; i++) {
      const m = this.bgMounts[i]
      const base = (m.getData('baseX') as number) ?? m.x
      const rate = (m.getData('parallax') as number) ?? 0.12
      m.x = Math.round(base - sx * rate)
    }
  }

  /** Pale BG — colour-shift; mountains may also use fog alpha for distance. */
  private styleBgPale(img: Phaser.GameObjects.Image, tint: number = BG_MID_TINT, alpha = 1) {
    img.setAlpha(alpha).setTint(tint)
  }

  /**
   * Mid/far decor (trees/houses) — soft foggy backdrop behind the road.
   * Keep near original gameplay scale; only mountains are enlarged.
   */
  private placeBgDecor(x: number, key: string, scale: number, flip = false) {
    if (!this.textures.exists(key)) return
    const y = GROUND_Y - 40
    const s = Math.max(1, Math.min(3, Math.round(scale)))
    const img = this.add
      .image(x, y, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.VILLAGE)
      .setScale(s)
      .setFlipX(flip)
    this.styleBgPale(img, BG_MID_TINT)
    img.setData('baseX', x)
    img.setData('parallax', 0.14)
    enablePixelSprite(img)
    this.bgMounts.push(img)
  }

  /**
   * Sky critters: many bees + a few butterflies & birds.
   * Decorative only — no physics / damage.
   */
  private spawnAmbientCritters() {
    this.ambientCritters = []
    // Bees dominate the sky traffic
    // 4 decorative bees (was 10) — less sky clutter now that bees use real art.
    for (let i = 0; i < 4; i++) this.spawnOneCritter('bee', true)
    // Butterflies / birds were procedural purple blocks — off until real art exists.
  }

  private spawnOneCritter(kind: 'bee' | 'butterfly' | 'bird', initial = false) {
    const key =
      kind === 'butterfly'
        ? 'fx-ambient-butterfly'
        : kind === 'bird'
          ? 'fx-ambient-bird'
          : 'fx-ambient-bee'
    if (!this.textures.exists(key)) {
      if (kind !== 'bee' && this.textures.exists('fx-ambient-bee')) {
        this.spawnOneCritter('bee', initial)
      }
      return
    }
    const fromLeft = Math.random() < 0.5
    const yMin = kind === 'bird' ? 18 : kind === 'butterfly' ? 40 : 28
    const yMax = kind === 'bird' ? 70 : kind === 'butterfly' ? 130 : 120
    const scale = 1
    const critter = this.add
      .image(fromLeft ? -40 : 1000, Phaser.Math.Between(yMin, yMax), key)
      .setScrollFactor(0)
      .setDepth(DEPTH.SKY + (kind === 'bird' ? 1 : 2))
      .setScale(scale)
      .setAlpha(kind === 'bird' ? 0.72 : 0.92)
      .setTint(kind === 'bee' ? BG_PALE_TINT : 0xffffff)
    const speed =
      kind === 'bird'
        ? Phaser.Math.FloatBetween(90, 140)
        : kind === 'butterfly'
          ? Phaser.Math.FloatBetween(35, 60)
          : Phaser.Math.FloatBetween(55, 100)
    const vx = fromLeft ? speed : -speed
    critter.setData('kind', kind)
    critter.setData('vx', vx)
    critter.setData('phase', Math.random() * Math.PI * 2)
    critter.setData(
      'amp',
      kind === 'bird'
        ? Phaser.Math.FloatBetween(3, 8)
        : kind === 'butterfly'
          ? Phaser.Math.FloatBetween(10, 22)
          : Phaser.Math.FloatBetween(6, 14),
    )
    critter.setData('baseY', critter.y)
    critter.setData('wobble', kind === 'butterfly' ? 0.012 : kind === 'bird' ? 0.003 : 0.005)
    enablePixelSprite(critter)
    this.ambientCritters.push(critter)
  }

  private respawnAmbientKind(kind: 'bee' | 'butterfly' | 'bird') {
    const delay =
      kind === 'bee'
        ? Phaser.Math.Between(200, 900)
        : kind === 'butterfly'
          ? Phaser.Math.Between(1200, 3200)
          : Phaser.Math.Between(1800, 4500)
    this.time.delayedCall(delay, () => {
      if (!this.sys.isActive()) return
      this.spawnOneCritter(kind, false)
    })
  }

  private tickAmbientCritters(dt: number) {
    const t = this.time.now
    for (let i = this.ambientCritters.length - 1; i >= 0; i--) {
      const c = this.ambientCritters[i]!
      const kind = (c.getData('kind') as 'bee' | 'butterfly' | 'bird') || 'bee'
      const vx = (c.getData('vx') as number) || 60
      const phase = (c.getData('phase') as number) || 0
      const amp = (c.getData('amp') as number) || 8
      const baseY = (c.getData('baseY') as number) || c.y
      const wobble = (c.getData('wobble') as number) || 0.005
      c.x += (vx * dt) / 1000
      c.y = baseY + Math.sin(t * wobble + phase) * amp
      c.setFlipX(vx < 0)
      if (kind === 'butterfly') {
        // Angle-only flap — keep integer scale (no fractional setScale).
        c.setAngle(Math.sin(t * 0.018 + phase) * 8)
      }
      if (c.x < -70 || c.x > 1040) {
        c.destroy()
        this.ambientCritters.splice(i, 1)
        this.respawnAmbientKind(kind)
      }
    }
  }

  /** Multiply veil + optional WebGL point lights from data/environment.json (ST-01 default). */
  private applyStageLighting() {
    const stageId = (this.registry.get('stageId') as string) || 'ST-01'
    const env = environmentById(stageId) ?? environmentById('ST-01')
    if (!env?.lighting) return
    const lit = env.lighting as {
      lightX?: number
      lightY?: number
      shadeColor?: string
      pointLights?: { x: number; y: number; radius: number; color: number; intensity: number }[]
    }
    // Prefer top-level environment.lighting[] overlay when present.
    const overlay =
      ENVIRONMENT.lighting?.find((l) => l.id === env.id) ??
      (lit.lightX != null && lit.lightY != null && lit.shadeColor
        ? { id: env.id, lightX: lit.lightX, lightY: lit.lightY, shadeColor: lit.shadeColor }
        : null)
    if (overlay) {
      addStageLighting(this, overlay)
    }
    const sprites: Phaser.GameObjects.GameObject[] = []
    if (this.boy) sprites.push(this.boy)
    if (this.girl) sprites.push(this.girl)
    if (this.pet) sprites.push(this.pet)
    // On scene.restart this still points at last run's destroyed group (enemies are re-made later in wirePhysics).
    const enemyList = this.enemies?.children ? this.enemies.getChildren() : []
    for (const e of enemyList) sprites.push(e as Phaser.GameObjects.GameObject)
    if (lit.pointLights?.length) {
      addPointLights(this, sprites, lit.pointLights)
    }
  }

  private drawWorld() {
    if (this.tree) {
      this.drawTreeWorld()
      return
    }
    if (this.market) {
      this.drawMarketWorld()
      return
    }
    if (this.depot) {
      this.drawDepotWorld()
      return
    }
    if (this.tower) {
      this.drawTowerWorld()
      return
    }
    // Prefer generated wallpaper 貼圖 (pretty Flash/phone look) over hand-built mountains.
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    // Soft sky under wallpaper — warm daylight, not heavy blue
    g.fillStyle(0x9ec8e0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0xe8d8b8, 0.35)
    g.fillRect(0, 120, WORLD_W, 200)

    this.bgClouds = []
    this.bgMounts = []

    if (this.textures.exists('bg-wallpaper')) {
      // Far upper wallpaper — pixel nearest (640×360 ≤64c).
      const roadTop = GROUND_Y - 80
      void roadTop
      // Far layer is fixed (SNES-style distant backdrop): parallax drift used to
      // expose the painting's right edge late in the stage. Bottom sits on the floor.
      const bg = this.add
        .image(GAME_W / 2, LANE_FLOOR_Y + 6, 'bg-wallpaper')
        .setOrigin(0.5, 1)
        .setScrollFactor(0, 0)
        .setDepth(DEPTH.SKY_BAND)
        .setScale(1)
        .setAlpha(1)
        // Warmer grade: the painting read cold/misty next to the warm cast and HUD.
        .setTint(0xfff0d6)
      bg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
      this.addForestAtmosphere()
      // Mid layer: bushes along the walk line, half-speed parallax for depth.
      if (this.textures.exists('bg-bush-strip')) {
        const bh = this.textures.get('bg-bush-strip').get().height
        this.bushStrip = this.add
          .tileSprite(0, LANE_FLOOR_Y + 4 - bh, GAME_W, bh, 'bg-bush-strip')
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(DEPTH.SKY_BAND + 2)
        enablePixelSprite(this.bushStrip as unknown as Phaser.GameObjects.Image)
      }
      // Legacy procedural tent/campfire retired — Cursor scenery lives in stage1.json "decor".
      this.spawnAmbientCritters()
    } else {
      g.fillStyle(0xa8d8f5, 1)
      g.fillRect(0, 0, WORLD_W, 160)
      this.placeSparseLandmarks()
    }

    this.buildGroundTiles()
    this.buildRiverBand()
  }

  /** Stage 1 atmosphere: sun shafts, pollen, drifting leaves, and a dusk wash that deepens toward the altar. */
  private duskWash: Phaser.GameObjects.Rectangle | null = null
  private addForestAtmosphere() {
    for (let i = 0; i < 3; i++) {
      const sx = 120 + i * 200
      const shaft = this.add.graphics().setScrollFactor(0.12, 0).setDepth(DEPTH.SKY_BAND + 1).setBlendMode(Phaser.BlendModes.ADD)
      shaft.fillStyle(0xfff0b0, 0.07)
      shaft.fillPoints(
        [new Phaser.Math.Vector2(sx, 0), new Phaser.Math.Vector2(sx + 34, 0), new Phaser.Math.Vector2(sx + 110, LANE_FLOOR_Y), new Phaser.Math.Vector2(sx + 44, LANE_FLOOR_Y)],
        true,
      )
      this.tweens.add({ targets: shaft, alpha: { from: 0.45, to: 1 }, duration: 2800 + i * 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    for (let i = 0; i < 14; i++) {
      const m = this.add
        .circle(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(70, LANE_FLOOR_Y - 20), 1, 0xfff4c0, 0.8)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 3)
      this.tweens.add({
        targets: m,
        y: m.y - Phaser.Math.Between(16, 50),
        alpha: { from: 0, to: 0.8 },
        duration: Phaser.Math.Between(2800, 4800),
        delay: i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    // Leaves: fall diagonally with a flutter, then loop back to the top.
    const cols = [0x8ab040, 0xc8a038, 0xd87830, 0x6a9a3a]
    for (let i = 0; i < 9; i++) {
      const leaf = this.add
        .rectangle(Phaser.Math.Between(0, GAME_W), -10, 3, 2, cols[i % cols.length]!)
        .setScrollFactor(0)
        .setDepth(DEPTH.FX - 12)
      const fall = () => {
        leaf.setPosition(Phaser.Math.Between(-20, GAME_W), Phaser.Math.Between(-40, -8))
        this.tweens.add({
          targets: leaf,
          y: LANE_FLOOR_Y + 6,
          x: leaf.x + Phaser.Math.Between(-90, 40),
          angle: Phaser.Math.Between(-360, 360),
          duration: Phaser.Math.Between(5200, 8200),
          delay: Phaser.Math.Between(0, 4000),
          ease: 'Sine.inOut',
          onComplete: fall,
        })
      }
      fall()
    }
    this.duskWash = this.add.rectangle(0, 0, GAME_W, LANE_FLOOR_Y + 8, 0x3a1a20, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SKY_BAND + 3)
  }

  /** Stage 3 · 月影夜市: night street painting → hot springs, stall row strip, moonlit haze. */
  private drawMarketWorld() {
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x0a0a18, 1).fillRect(0, 0, WORLD_W, WORLD_H)
    this.bgClouds = []
    this.bgMounts = []
    const far = (key: string) =>
      this.textures.exists(key) ? this.add.image(GAME_W / 2, GAME_H / 2, key).setScrollFactor(0).setDepth(DEPTH.SKY_BAND).setTint(0xc8c8e0) : null
    this.marketFar = { market: far('story-market-far'), spring: far('story-hotspring-far') }
    this.marketFar.spring?.setAlpha(0)
    if (this.textures.exists('s3-market-mid')) {
      const bh = this.textures.get('s3-market-mid').get().height
      this.bushStrip = this.add
        .tileSprite(0, LANE_FLOOR_Y + 4 - bh, GAME_W, bh, 's3-market-mid')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 2)
        .setTint(0x8078a0)
      enablePixelSprite(this.bushStrip as unknown as Phaser.GameObjects.Image)
    }
    // Lantern-string glow dots + drifting mist.
    for (let i = 0; i < 12; i++) {
      const d = this.add
        .circle(30 + i * 52 + ((i * 17) % 20), 60 + ((i * 29) % 30), 2, 0xffa050, 0.85)
        .setScrollFactor(0.3, 0)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: d, alpha: { from: 0.35, to: 0.95 }, duration: 900 + i * 130, yoyo: true, repeat: -1 })
    }
    for (let i = 0; i < 6; i++) {
      const m = this.add
        .ellipse(Phaser.Math.Between(0, GAME_W), LANE_FLOOR_Y - Phaser.Math.Between(4, 40), 160, 26, 0xd0d0f0, 0.06)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 3)
      this.tweens.add({ targets: m, x: m.x + 120, duration: 9000 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    // Hot-spring pools behind the slippery stretch; moon bridge deck at the boss arena.
    for (const z of ST.slippery ?? []) {
      for (let x = z.x0 + 60; x < z.x1 - 40; x += 240) {
        if (!this.textures.exists('s3-hotspring-rock')) break
        // A pool drawn across a pit reads as solid rock and the player falls through it.
        const halfW = this.textures.get('s3-hotspring-rock').get().width / 2
        if (terrainPits().some((p) => x + halfW > p.x0 - 8 && x - halfW < p.x1 + 8)) continue
        // Sit the pool into the paving, not on top of it, and let a little steam-light pool around it.
        const pool = this.add.image(x, LANE_FLOOR_Y + 7, 's3-hotspring-rock').setOrigin(0.5, 1).setDepth(DEPTH.PROP - 4).setTint(0xa0a8c8)
        enablePixelSprite(pool)
        const sheen = this.add.ellipse(x, LANE_FLOOR_Y + 3, pool.width * 0.9, 12, 0x8ad0ff, 0.14).setDepth(DEPTH.PROP - 3).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: sheen, alpha: { from: 0.08, to: 0.2 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
    }
    const b = ST.boss
    if (b && this.textures.exists('s3-wood-bridge')) {
      const w = this.textures.get('s3-wood-bridge').get().width
      for (let x = b.arenaX0 + w / 2 - 20; x < b.arenaX1 + w / 2; x += w - 8) {
        const br = this.add.image(x, LANE_FLOOR_Y + 14, 's3-wood-bridge').setOrigin(0.5, 1).setDepth(DEPTH.PROP - 3).setTint(0x9a8a90)
        enablePixelSprite(br)
      }
    }
    this.buildGroundTiles()
  }

  /**
   * Stage 4 · 鹽霧工地: a dark, rainy construction site at night. No Cursor art batch has
   * landed for this stage's backdrop yet, so cranes/scaffolding are simple procedural
   * silhouettes (same placeholder spirit as Stage4Enemies.ts) — swap for painted art later.
   * The drizzle itself is drawn by Stage4World (ST.fog), not here.
   */
  private drawDepotWorld() {
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x161c22, 1).fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0x2c363e, 0.5).fillRect(0, 90, WORLD_W, 230)
    this.bgClouds = []
    this.bgMounts = []
    for (let i = 0; i < 9; i++) {
      const x = 160 + i * 460
      const cg = this.add.graphics().setScrollFactor(0.35, 0).setDepth(DEPTH.SKY_BAND).setAlpha(0.55)
      cg.fillStyle(0x10141a, 1)
      cg.fillRect(x, 50, 6, 180)
      cg.fillRect(x - 76, 48, 160, 5)
      cg.fillRect(x + 66, 48, 5, 42)
      cg.lineStyle(2, 0x10141a, 1)
      cg.lineBetween(x - 70, 48, x, 150)
      cg.lineBetween(x + 70, 48, x, 150)
    }
    // Amber warning lights dotted along the skyline — mood only, bulldozer warnings are separate.
    for (let i = 0; i < 7; i++) {
      const d = this.add
        .circle(90 + i * 560, 170 + ((i * 37) % 26), 3, 0xffb020, 0.7)
        .setScrollFactor(0.5, 0)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: d, alpha: { from: 0.25, to: 0.85 }, duration: 700 + i * 110, yoyo: true, repeat: -1 })
    }
    this.buildGroundTiles()
  }

  /**
   * Stage 5 · △畝大廈: the final "mixed mechanics" tower interior — lobby → hex corridor →
   * blacked-out floor → rooftop. Cursor's batch-13 delivered the two far-backdrop paintings
   * (hq-far: the honeycomb-piped office interior, rooftop-far: the sunset vista at the boss
   * arena) — crossfaded in tickStage5 as the camera nears the boss gate, same pattern as
   * drawMarketWorld's market→hotspring crossfade. The procedural pillars/floor-sign glow
   * stay layered on top for depth texture.
   */
  private drawTowerWorld() {
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x1a1e26, 1).fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0x262c36, 0.5).fillRect(0, 80, WORLD_W, 240)
    this.bgClouds = []
    this.bgMounts = []
    const far = (key: string) => (this.textures.exists(key) ? this.add.image(GAME_W / 2, GAME_H / 2, key).setScrollFactor(0).setDepth(DEPTH.SKY_BAND) : null)
    this.towerFar = { hq: far('story-hq-far'), roof: far('story-rooftop-far') }
    this.towerFar.roof?.setAlpha(0)
    for (let i = 0; i < 10; i++) {
      const x = 120 + i * 420
      const cg = this.add.graphics().setScrollFactor(0.3, 0).setDepth(DEPTH.SKY_BAND).setAlpha(0.6)
      cg.fillStyle(0x12151a, 1).fillRect(x, 40, 10, 220)
      cg.fillStyle(0x323a46, 0.8).fillRect(x + 2, 44, 2, 212)
    }
    const alarmX = ST.boss?.triggerX ?? 99999
    for (let i = 0; i < 8; i++) {
      const x = 90 + i * 480
      const near5 = x > alarmX - 400
      const d = this.add
        .rectangle(x, 150 + ((i * 41) % 24), 14, 6, near5 ? 0xff4444 : 0x8ac8ff, 0.8)
        .setScrollFactor(0.45, 0)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: d, alpha: { from: 0.3, to: 0.9 }, duration: near5 ? 420 : 900 + i * 100, yoyo: true, repeat: -1 })
    }
    this.buildGroundTiles()
  }

  /** Stage 2 · inside the honey tree: painted hollow, bark pillars, light shafts, pollen, canopy ceiling. */
  private treePillars: Phaser.GameObjects.Image[] = []
  private drawTreeWorld() {
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x140a06, 1).fillRect(0, 0, WORLD_W, WORLD_H)
    this.bgClouds = []
    this.bgMounts = []
    this.treePillars = []
    if (this.textures.exists('story-canopy-far')) {
      this.add.image(GAME_W / 2, GAME_H / 2, 'story-canopy-far').setScrollFactor(0).setDepth(DEPTH.SKY_BAND)
    }
    // Bark pillars + honeycomb panels at 0.6× scroll — the trunk's inner wall sliding past.
    for (let i = 0; i < 16; i++) {
      const x = 60 + i * 210 + ((i * 53) % 70)
      const key = i % 3 === 1 ? 's2-honeycomb-wall' : 's2-bark-wall'
      if (!this.textures.exists(key)) continue
      const img = this.add
        .image(x, LANE_FLOOR_Y + 4, key)
        .setOrigin(0.5, 1)
        .setScrollFactor(0.6, 1)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setTint(key === 's2-bark-wall' ? 0x7a5a40 : 0x9a7040)
        .setAlpha(0.95)
      if (key === 's2-bark-wall') img.setScale(1, 1.25)
      enablePixelSprite(img)
      this.treePillars.push(img)
    }
    // Leafy mid band along the walk line, half-speed parallax (replaces stage 1's bushes).
    if (this.textures.exists('s2-canopy-mid')) {
      const bh = this.textures.get('s2-canopy-mid').get().height
      this.bushStrip = this.add
        .tileSprite(0, LANE_FLOOR_Y + 6 - bh, GAME_W, bh, 's2-canopy-mid')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 2)
        .setTint(0x9a8a5a)
      enablePixelSprite(this.bushStrip as unknown as Phaser.GameObjects.Image)
    }
    // Light shafts from the canopy: additive, slowly breathing.
    for (let i = 0; i < 4; i++) {
      const sx = 90 + i * 160
      const shaft = this.add.graphics().setScrollFactor(0.15, 0).setDepth(DEPTH.SKY_BAND + 3).setBlendMode(Phaser.BlendModes.ADD)
      shaft.fillStyle(0xffd070, 0.09)
      shaft.fillPoints(
        [new Phaser.Math.Vector2(sx, 30), new Phaser.Math.Vector2(sx + 26, 30), new Phaser.Math.Vector2(sx + 86, LANE_FLOOR_Y), new Phaser.Math.Vector2(sx + 30, LANE_FLOOR_Y)],
        true,
      )
      this.tweens.add({ targets: shaft, alpha: { from: 0.5, to: 1 }, duration: 2400 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    // Pollen / honey motes drifting through the shafts.
    for (let i = 0; i < 22; i++) {
      const m = this.add
        .circle(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(60, LANE_FLOOR_Y - 10), 1, 0xffe090, 0.8)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 3)
      this.tweens.add({
        targets: m,
        y: m.y - Phaser.Math.Between(20, 60),
        x: m.x + Phaser.Math.Between(-20, 20),
        alpha: { from: 0, to: 0.85 },
        duration: Phaser.Math.Between(2600, 4600),
        delay: i * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    // Canopy ceiling: vine lattice under the HUD band, drips form beneath it.
    if (this.textures.exists('s2-vine-lattice')) {
      const lh = this.textures.get('s2-vine-lattice').get().height
      const lat = this.add.tileSprite(0, 28, WORLD_W, lh, 's2-vine-lattice').setOrigin(0, 0).setDepth(DEPTH.PROP - 3).setTint(0xc0b080)
      enablePixelSprite(lat as unknown as Phaser.GameObjects.Image)
    }
    this.buildGroundTiles()
  }

  /**
   * 16px ground tiles (≥4 variants) filling ~20% of screen height under feet.
   * Top of first row aligns with GROUND_Y (character feet).
   */
  private buildGroundTiles() {
    const TS = 16
    const bandH = Math.round(GAME_H * 0.2)
    const rows = Math.max(4, Math.ceil(bandH / TS))
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col * TS < WORLD_W + TS; col++) {
        const v = (col + row * 3) % 4
        const key = `tile-ground-${v}`
        if (!this.textures.exists(key)) continue
        const x = col * TS + TS / 2
        const y = GROUND_Y + row * TS + TS / 2
        const t = this.add
          .image(Math.round(x), Math.round(y), key)
          .setDepth(DEPTH.GROUND)
          .setOrigin(0.5)
        if (this.tree) t.setTint(0x8a5a3a)
        if (this.market) t.setTint(0x6a6a88)
        if (this.depot) t.setTint(0x585e62)
      }
    }
    // 2px contact shadow where feet meet the ground band
    addContactShadowBand(this, 0, GROUND_Y, WORLD_W, DEPTH.GROUND + 1)
  }

  /** Layered creek under the road — flowing water + foam + sparkle. */
  private buildRiverBand() {
    const bank = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.WATER_DEEP - 1)
    bank.fillStyle(0x4a6a40, 0.7)
    bank.fillRect(0, L(448), GAME_W, L(14))
    bank.fillStyle(0x2e4a2c, 0.55)
    bank.fillRect(0, L(458), GAME_W, L(12))
    // Wet stone lip
    bank.fillStyle(0x6a7a68, 0.35)
    bank.fillRect(0, L(462), GAME_W, L(4))

    this.water = this.add
      .tileSprite(GAME_W / 2, L(508), GAME_W, L(78), 'water-deep')
      .setScrollFactor(0)
      .setDepth(DEPTH.WATER_DEEP)
      .setAlpha(1)
    this.water.setPosition(480, 508)
    enablePixelSprite(this.water)
    if (this.textures.exists('water-mid')) {
      this.waterMid = this.add
        .tileSprite(GAME_W / 2, L(490), GAME_W, L(42), 'water-mid')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_MID)
        .setAlpha(0.82)
      this.waterMid.setPosition(480, 490)
      enablePixelSprite(this.waterMid)
    }
    if (this.textures.exists('water-foam')) {
      this.waterFoam = this.add
        .tileSprite(GAME_W / 2, L(466), GAME_W, L(26), 'water-foam')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_FOAM)
        .setAlpha(0.9)
      this.waterFoam.setPosition(480, 466)
      enablePixelSprite(this.waterFoam)
    }
    // Sun sparkles drifting on the current
    for (let i = 0; i < 10; i++) {
      const sp = this.add
        .circle(
          Phaser.Math.Between(40, 920),
          Phaser.Math.Between(L(478), L(530)),
          Phaser.Math.FloatBetween(1.2, 2.4),
          0xe8f8ff,
          Phaser.Math.FloatBetween(0.35, 0.75),
        )
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_FOAM + 1)
      this.tweens.add({
        targets: sp,
        x: sp.x + Phaser.Math.Between(80, 180),
        alpha: { from: 0.15, to: 0.85 },
        duration: Phaser.Math.Between(1600, 2800),
        yoyo: true,
        repeat: -1,
        delay: i * 120,
        ease: 'Sine.inOut',
        onYoyo: () => {
          if (sp.x > 980) sp.x = -20
        },
      })
    }
  }

  /**
   * Curated sparse BG — quality over quantity.
   * Budget: 4 mountains, 6 clouds, 1 house, 1 torii, few trees, 1 bridge + little river.
   * Each landmark is an independent volumetric sprite (not a repeating tile strip).
   */
  private placeSparseLandmarks() {
    // --- 6 clouds (3 unique textures × flip/scale) ---
    const cloudSpecs: Array<{ key: string; x: number; y: number; s: number; flip?: boolean; p: number }> = [
      { key: 'lm-cloud-1', x: 120, y: 52, s: 1, p: 0.05 },
      { key: 'lm-cloud-2', x: 340, y: 38, s: 1, flip: true, p: 0.07 },
      { key: 'lm-cloud-3', x: 560, y: 60, s: 1, p: 0.06 },
      { key: 'lm-cloud-1', x: 780, y: 44, s: 1, flip: true, p: 0.08 },
      { key: 'lm-cloud-2', x: 980, y: 56, s: 1, p: 0.05 },
      { key: 'lm-cloud-3', x: 1180, y: 36, s: 1, flip: true, p: 0.09 },
    ]
    for (const c of cloudSpecs) {
      if (!this.textures.exists(c.key)) continue
      const img = this.add
        .image(c.x, c.y, c.key)
        .setScrollFactor(0)
        .setDepth(DEPTH.CLOUD)
        .setScale(c.s)
        .setFlipX(!!c.flip)
      this.styleBgPale(img, BG_PALE_TINT)
      img.setData('baseX', c.x)
      img.setData('parallax', c.p)
      enablePixelSprite(img)
      this.bgClouds.push(img)
    }

    // Far mountains — fog alpha + slow parallax so they read farther behind the road.
    const mountSpecs: Array<{ key: string; x: number; y: number; s: number; flip?: boolean; p: number; d: number; a: number }> = [
      { key: 'lm-mount-2', x: 210, y: 268, s: 3, p: 0.02, d: DEPTH.MOUNT_FAR, a: BG_MOUNT_ALPHA * 0.85 },
      { key: 'lm-mount-1', x: 520, y: 278, s: 3, flip: true, p: 0.03, d: DEPTH.MOUNT_FAR, a: BG_MOUNT_ALPHA * 0.9 },
      { key: 'lm-mount-4', x: 820, y: 298, s: 3, p: 0.05, d: DEPTH.MOUNT_NEAR, a: BG_MOUNT_ALPHA },
      { key: 'lm-mount-3', x: 1120, y: 308, s: 3, flip: true, p: 0.06, d: DEPTH.MOUNT_NEAR, a: BG_MOUNT_ALPHA * 1.05 },
    ]
    for (const m of mountSpecs) {
      if (!this.textures.exists(m.key)) continue
      const img = this.add
        .image(m.x, m.y, m.key)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(m.d)
        .setScale(m.s)
        .setFlipX(!!m.flip)
      this.styleBgPale(img, BG_MOUNT_TINT, Math.min(0.55, m.a))
      img.setData('baseX', m.x)
      img.setData('parallax', m.p)
      enablePixelSprite(img)
      this.bgMounts.push(img)
    }

    // Forest + cottages — positions scaled to shorter stage; pale vs brown-yellow road.
    this.placeBgDecor(stageX(180), 'prop-tree3d', 1.1)
    this.placeBgDecor(stageX(700), 'prop-tree3d', 1.0, true)
    this.placeBgDecor(stageX(1400), 'prop-tree3d', 1.15)
    this.placeBgDecor(stageX(1100), 'prop-house3d', 1.35)
    this.placeBgDecor(stageX(2500), 'prop-tree3d', 1.05)
    this.placeBgDecor(stageX(3800), 'prop-tree3d', 1.1, true)
    this.placeBgDecor(stageX(5200), 'prop-house3d', 1.3)
    this.placeBgDecor(stageX(6400), 'prop-tree3d', 1.2)

    // Legacy procedural tent/campfire retired — Cursor scenery lives in stage1.json "decor".

    this.placeBgDecor(stageX(900), 'prop-owl', 1.15)
    this.placeBgDecor(stageX(3400), 'prop-owl', 1.1, true)

    this.spawnAmbientCritters()
    if (this.textures.exists('prop-torii')) {
      const arch = this.add
        .image(400, 300, 'prop-torii')
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(DEPTH.VILLAGE)
        .setScale(1)
      this.styleBgPale(arch, BG_MID_TINT)
      arch.setData('baseX', 400)
      arch.setData('parallax', 0.1)
      enablePixelSprite(arch)
      this.bgMounts.push(arch)
    }
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pots = this.physics.add.group()
    this.coinPickups = this.physics.add.group()
    this.honeyPickups = this.physics.add.group()
    this.sushiPickups = this.physics.add.group()
    this.levelMap = createRound1Tilemap(this, this.pots, this.hazards)
    if (this.levelMap?.solids) {
      this.levelMap.solids.setCollisionByExclusion([-1])
      this.levelMap.solids.setVisible(false)
      this.levelMap.solids.setActive(false)
    }
    // Hide tilemap hazard layer + clear map lava/red boxes / map pots clutter.
    this.levelMap?.hazards?.setVisible(false).setActive(false)
    this.hazards.clear(true, true)
    this.pots.clear(true, true)

    // data/levels/stage1.json — pits / steps / planks / hazards / honey / checkpoints.
    this.buildTerrainFromJson()
    this.layGroundRibbon(LANE_FLOOR_Y)
    this.drawTerrainFeatures()
    this.placeDecor()

    for (const sp of ST.spikes) this.spikes(sp.x, sp.n)
    for (const x of ST.durians) this.placeDurian(x)
    // Gear bought at the friends' stall: jump height, extra hearts, weapon floor.
    for (const h of [this.boy, this.girl]) {
      if (!h) continue
      const who = h.role as Who
      h.jumpMul = jumpMul()
      const extra = bonusHearts(who)
      if (extra > 0) h.hp = Math.min(MAX_HP + extra, h.hp + extra)
      h.stam = stamMax(who)
      h.setData('wlv', Math.max(this.weaponLv(h), weaponFloor(who)))
    }
    for (const h of ST.honey) this.spawnHoneyJar(h.x, LANE_FLOOR_Y - h.h)
    this.placeCheckpoints()
    for (const c of ST.coins ?? []) this.spawnCoin(c.x, LANE_FLOOR_Y - c.h)

    // Goemon-style loot holders + ceiling crushers (data/levels/stage1.json).
    this.powerPickups = this.physics.add.group()
    this.placeBreakables()
    this.placeFriends()
    this.placeCrushers()
    // Secret perches: a reward floating where only a careful climb reaches.
    for (const sc of ST.secrets ?? []) {
      const y = LANE_FLOOR_Y - sc.h
      if (sc.kind === 'sushi') this.spawnSushi(sc.x, y)
      else for (let i = -1; i <= 1; i++) this.spawnCoin(sc.x + i * 12, y - Math.abs(i) * -4)
    }
    if (this.tree || this.tower) {
      this.s2world = new Stage2World(
        {
          scene: this,
          floorY: LANE_FLOOR_Y,
          ceilY: 56,
          heroes: () => [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive),
          hurt: (h, dir, label) => this.hazardHit(h, { knockX: dir * 220, knockY: -380, label }),
        },
        ST.windVents ?? [],
        ST.drips ?? [],
      )
    }

    if (this.market || this.tower) {
      this.s3world = new Stage3World(
        {
          scene: this,
          floorY: LANE_FLOOR_Y,
          heroes: () => [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive),
          shots: () => this.shots.getChildren(),
          onPower: () => {
            this.powerUntil = this.time.now + 10000
            for (const h of [this.boy, this.girl]) if (h) burst(this, h.x, h.y - 30, 0xff6a3a, 10)
          },
        },
        ST,
      )
    }

    if (this.depot || this.tower) {
      this.s4world = new Stage4World(
        {
          scene: this,
          floorY: LANE_FLOOR_Y,
          heroes: () => [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive),
          hurt: (h, dir, label) => this.hazardHit(h, { knockX: dir * 220, knockY: -380, label }),
        },
        ST,
      )
    }

    if (this.tower) {
      this.s5world = new Stage5World({ scene: this, floorY: LANE_FLOOR_Y }, ST)
    }

    if (this.tree || this.market || this.depot || this.tower) {
      // Stages 2+ end when the boss falls — keep an inert goal far off-world so overlap checks stay valid.
      this.goal = this.physics.add.sprite(WORLD_W + 400, GROUND_Y - 10, 'goal3d').setVisible(false)
      ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
      this.goal.disableBody(false, true)
      return
    }
    const shadKey = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.add.image(WORLD_W - 140, GROUND_Y + 7, shadKey).setDepth(DEPTH.PROP_SHADOW).setAlpha(0.55).setScale(2 * PROP_DISPLAY_SCALE, 1)
    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 10, 'goal3d')
    this.goal.setOrigin(0.5, 1)
    this.goal.setImmovable(true).setScale(PROP_DISPLAY_SCALE).setDepth(DEPTH.BREAKABLE)
    enablePixelSprite(this.goal)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.add
      .text(WORLD_W - 140, GROUND_Y - 226, '樹頂・蜂巢', {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)
  }

  /** Solids for engine/terrain from stage JSON: base floor minus pits, steps, one-way planks. */
  private buildTerrainFromJson() {
    const floor = LANE_FLOOR_Y
    const pits = ST.pits.map((p) => ({ x0: p.x, x1: p.x + p.w })).sort((a, b) => a.x0 - b.x0)
    const solids: Solid[] = []
    let cur = 0
    for (const p of pits) {
      if (p.x0 > cur) solids.push({ x0: cur, x1: p.x0, top: floor, oneWay: false, kind: 'ground' })
      cur = Math.max(cur, p.x1)
    }
    if (cur < WORLD_W) solids.push({ x0: cur, x1: WORLD_W, top: floor, oneWay: false, kind: 'ground' })
    for (const st of ST.steps) {
      solids.push({ x0: st.x, x1: st.x + st.w, top: floor - st.h, oneWay: false, kind: 'step' })
    }
    for (const pl of [...ST.platforms, ...(ST.shelves ?? [])]) {
      solids.push({ x0: pl.x, x1: pl.x + pl.w, top: floor - pl.h, oneWay: true, kind: 'platform' })
    }
    // Moving planks: the Solid object is shared with engine/terrain, so moving x0/x1 moves the floor.
    this.movers = []
    for (const mp of ST.movingPlatforms ?? []) {
      const solid: Solid = { x0: mp.x, x1: mp.x + mp.w, top: floor - mp.h, oneWay: true, kind: 'platform' }
      solids.push(solid)
      const mvTex = this.tree && this.textures.exists('s2-bark-platform') ? 's2-bark-platform' : 'blk-wood'
      const mvH = mvTex === 'blk-wood' ? 8 : this.textures.get(mvTex).get().height
      const img = this.textures.exists(mvTex)
        ? this.add.tileSprite(mp.x, floor - mp.h, mp.w, mvH, mvTex).setOrigin(0, 0).setDepth(DEPTH.GROUND + 3)
        : null
      if (img) enablePixelSprite(img as unknown as Phaser.GameObjects.Image)
      const posts = this.add.graphics().setDepth(DEPTH.GROUND + 3)
      this.movers.push({ solid, baseX: mp.x, w: mp.w, range: mp.range, periodMs: mp.periodMs, img, posts })
    }
    setTerrain(solids, pits, floor)
  }

  /** Pit holes, raised steps and wooden planks (visual only — collision is engine/terrain). */
  private drawTerrainFeatures() {
    const floor = LANE_FLOOR_Y
    const g = this.add.graphics().setDepth(DEPTH.GROUND + 2)
    for (const p of ST.pits) {
      // Dark drop with a lighter dirt lip on both edges.
      g.fillStyle(0x140c12, 1).fillRect(p.x, floor, p.w, GAME_H - floor)
      g.fillStyle(0x2a1a14, 1).fillRect(p.x, floor, p.w, 6)
      g.fillStyle(0x5a3a22, 1).fillRect(p.x, floor, 2, GAME_H - floor).fillRect(p.x + p.w - 2, floor, 2, GAME_H - floor)
    }
    for (const st of ST.steps) {
      const top = floor - st.h
      // Earth body + grass lip (same tile as the ground ribbon); 1px dark outline.
      const stepTex = this.tree && this.textures.exists('s2-bark-ground')
        ? 's2-bark-ground'
        : this.market && this.textures.exists('s3-market-ground') ? 's3-market-ground' : 'tile-ground-top'
      if (this.textures.exists(stepTex)) {
        const body = this.add.tileSprite(st.x, top, st.w, st.h + 8, stepTex).setOrigin(0, 0).setDepth(DEPTH.GROUND + 3)
        enablePixelSprite(body as unknown as Phaser.GameObjects.Image)
      } else {
        g.fillStyle(0x6b4428, 1).fillRect(st.x, top, st.w, st.h)
      }
      g.fillStyle(0x12100c, 1)
        .fillRect(st.x - 1, top - 1, st.w + 2, 1)
        .fillRect(st.x - 1, top, 1, st.h)
        .fillRect(st.x + st.w, top, 1, st.h)
    }
    const barkPlank = this.tree && this.textures.exists('s2-bark-platform')
    const woodTex = barkPlank ? 's2-bark-platform' : this.textures.exists('blk-wood') ? 'blk-wood' : null
    const plankH = barkPlank ? this.textures.get('s2-bark-platform').get().height : 8
    for (const pl of ST.platforms) {
      const top = floor - pl.h
      if (woodTex) {
        const plank = this.add.tileSprite(pl.x, top, pl.w, plankH, woodTex).setOrigin(0, 0).setDepth(DEPTH.GROUND + 3)
        enablePixelSprite(plank as unknown as Phaser.GameObjects.Image)
      } else {
        g.fillStyle(0x8a5a30, 1).fillRect(pl.x, top, pl.w, 8)
      }
      if (barkPlank) {
        // Branch: vines tie it up to the canopy.
        g.fillStyle(0x3a5a22, 1).fillRect(pl.x + 6, 30, 2, top - 30).fillRect(pl.x + pl.w - 8, 30, 2, top - 30)
        g.fillStyle(0x6a9a3a, 1).fillRect(pl.x + 6, 30, 1, top - 30).fillRect(pl.x + pl.w - 8, 30, 1, top - 30)
      } else {
        g.fillStyle(0x12100c, 1).fillRect(pl.x - 1, top - 1, pl.w + 2, 1).fillRect(pl.x - 1, top + 8, pl.w + 2, 1)
        // Rope posts so the plank reads as hanging, not floating.
        g.fillStyle(0x3a2616, 1).fillRect(pl.x + 3, top + 8, 2, 10).fillRect(pl.x + pl.w - 5, top + 8, 2, 10)
      }
    }
    // Bracket fungus shelves on the trunk wall (stage 2) — only reachable by gliding.
    for (const sh of ST.shelves ?? []) {
      const top = floor - sh.h
      if (this.textures.exists('s2-mushroom-shelf')) {
        const img = this.add.image(sh.x + sh.w / 2, top - 2, 's2-mushroom-shelf').setOrigin(0.5, 0).setDepth(DEPTH.GROUND + 3)
        enablePixelSprite(img)
      } else {
        g.fillStyle(0xc88a50, 1).fillRect(sh.x, top, sh.w, 6)
      }
    }
  }

  private farTrunks: Phaser.GameObjects.TileSprite | null = null

  /** Scenery from stage JSON (behind actors) + auto-spaced foreground grass (in front). */
  private placeDecor() {
    // Far tree line between the painted backdrop and the bush strip, slow parallax.
    this.farTrunks = null
    if (!this.tree && !this.market && this.textures.exists('deco-far-trunks')) {
      const th = this.textures.get('deco-far-trunks').get().height
      this.farTrunks = this.add
        .tileSprite(0, LANE_FLOOR_Y - th + 2, GAME_W, th, 'deco-far-trunks')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setAlpha(0.38)
      enablePixelSprite(this.farTrunks as unknown as Phaser.GameObjects.Image)
    }
    for (const d of ST.decor?.back ?? []) {
      const key = d.kind === 'picnic' ? 'cs-picnic' : d.kind.startsWith('s2-') || d.kind.startsWith('s3-') ? d.kind : `deco-${d.kind}`
      if (!this.textures.exists(key)) continue
      const top = groundTopBelow(d.x, LANE_FLOOR_Y - 60, 6) ?? LANE_FLOOR_Y
      const img = this.add.image(d.x, top + 2, key).setOrigin(0.5, 1).setDepth(DEPTH.PROP - 2)
      if (key === 's2-honeycomb-wall') img.setAlpha(0.9).setTint(0xd0a060)
      if (key === 's2-triangle-mark') img.setY(top - 30)
      if (key === 's3-wok-stall') {
        img.setTint(0x9a90b0)
        this.add.circle(d.x, top - 30, 34, 0xff8a30, 0.12).setDepth(DEPTH.PROP - 3).setBlendMode(Phaser.BlendModes.ADD)
      }
      enablePixelSprite(img)
      if (d.kind === 'billboard') {
        // The 地產 front company's sign — first hint of the plot.
        this.add
          .text(d.x, top - 50, '△畝發展\n即將動工', { fontFamily: FONT_UI, fontSize: '11px', color: '#c8281c', align: 'center', lineSpacing: 2 })
          .setOrigin(0.5)
          .setDepth(DEPTH.PROP - 1)
      } else if (d.kind === 'sign-post') {
        this.add.text(d.x, top - 27, '→', { fontFamily: FONT_UI, fontSize: '10px', color: '#3a2414' }).setOrigin(0.5).setDepth(DEPTH.PROP - 1)
      }
    }
    // Vines hanging from the canopy (stage 2), swaying a little.
    for (const d of ST.decor?.hang ?? []) {
      if (!this.textures.exists(d.kind)) continue
      const v = this.add.image(d.x, 30, d.kind).setOrigin(0.5, 0).setDepth(DEPTH.PROP - 2)
      enablePixelSprite(v)
      this.tweens.add({ targets: v, angle: { from: -2, to: 2 }, duration: 2200 + (d.x % 7) * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    // Foreground grass tufts pass in front of the cast (depth above actors, below FX).
    const kinds = this.market ? [] : this.tree ? ['deco-fern-b'] : ['deco-grass-a', 'deco-fern-b', 'deco-grass-c']
    let i = 0
    for (let x = 110; x < WORLD_W - 60; x += 190 + ((x * 7) % 70)) {
      const key = kinds[i++ % kinds.length]!
      if (!this.textures.exists(key)) continue
      const w = this.textures.get(key).get().width
      if (terrainPits().some((p) => x + w / 2 > p.x0 - 4 && x - w / 2 < p.x1 + 4)) continue
      const top = groundTopBelow(x, LANE_FLOOR_Y - 60, 6) ?? LANE_FLOOR_Y
      const g = this.add.image(x, top + 4, key).setOrigin(0.5, 1).setDepth(DEPTH.FX - 10)
      if (this.tree) g.setTint(0x8a8050)
      enablePixelSprite(g)
    }
  }

  private checkpointXs: number[] = []
  private lastCheckpointX = 220

  /** Checkpoints are 咖啡媽媽's coffee cart: respawn point + one cup (+1 HP) the first time. */
  private checkpointMamas: Phaser.GameObjects.Image[] = []
  private placeCheckpoints() {
    this.checkpointXs = ST.checkpoints.slice().sort((a, b) => a - b)
    this.lastCheckpointX = 220
    this.checkpointMamas = []
    for (const x of this.checkpointXs) {
      const top = groundTopBelow(x, LANE_FLOOR_Y - 60, 8) ?? LANE_FLOOR_Y
      const isStall = x === this.checkpointXs[0]
      const st = this.stall()
      if (isStall) {
        if (this.textures.exists('cs-cart')) {
          const cart = this.add.image(x + 30, top + 1, 'cs-cart').setOrigin(0.5, 1).setDepth(DEPTH.PROP)
          // Until Cursor's own keepers land, each stage tints the cart to its own stall.
          if (this.stageNo === 2) cart.setTint(0xffd9a0)
          if (this.stageNo === 3) cart.setTint(0xd8c0ff)
          enablePixelSprite(cart)
        }
        if (this.textures.exists('cs-mama')) {
          const mama = this.add.image(x - 8, top + 1, 'cs-mama').setOrigin(0.5, 1).setDepth(DEPTH.PROP + 1).setFlipX(true)
          if (this.stageNo === 2) mama.setTint(0xcfe4ff)
          if (this.stageNo === 3) mama.setTint(0xffd0c0)
          enablePixelSprite(mama)
          this.checkpointMamas.push(mama)
          this.tweens.add({ targets: mama, scaleY: { from: 1, to: 1.02 }, duration: 900, yoyo: true, repeat: -1 })
        }
      } else {
        // Plain save point: a lantern on a post, no keeper, no minigame.
        const key = this.textures.exists('deco-lantern') ? 'deco-lantern' : 'coin'
        const lamp = this.add.image(x + 10, top + 1, key).setOrigin(0.5, 1).setDepth(DEPTH.PROP)
        enablePixelSprite(lamp)
        this.add.circle(x + 10, top - 26, 18, 0xffc070, 0.18).setDepth(DEPTH.PROP - 1).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: lamp, angle: { from: -3, to: 3 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      }
      this.add
        .text(x + (isStall ? 30 : 10), top - 74, isStall ? st.sign : '存檔點', { fontFamily: FONT_UI, fontSize: '11px', color: '#2a1a10', backgroundColor: '#f7e7c0', padding: { x: 3, y: 1 } })
        .setOrigin(0.5)
        .setDepth(DEPTH.SIGN)
    }
  }

  /** This stage's food stall (data/stalls.json). */
  private stall(): Stall {
    return STALLS[String(this.stageNo)] ?? STALLS['1']!
  }

  /** Reached a checkpoint → falls respawn here. */
  private tickCheckpoints() {
    const lead = this.leadX()
    for (const x of this.checkpointXs) {
      if (lead >= x && x > this.lastCheckpointX) {
        this.lastCheckpointX = x
        floatText(this, x, LANE_FLOOR_Y - 92, `${this.stall().keeper}：${this.stall().greet}`, '#ffe08a', { size: 12, dur: 2200 })
        SFX.coin()
        const i = this.checkpointXs.indexOf(x)
        const mama = this.checkpointMamas[i]
        if (mama && this.textures.exists('cs-mama-offer')) mama.setTexture('cs-mama-offer')
        // Only the first checkpoint is the stall; later ones just save and heal.
        if (this.coffeeDone || x !== this.checkpointXs[0]) {
          this.drinkCoffee()
          return
        }
        this.coffeeDone = true
        this.physics.pause()
        for (const h of [this.boy, this.girl]) h?.setVelocity(0, 0)
        void this.runCoffeeStall()
        return
      }
    }
  }

  /** The stage's stall: how-to pages, then its own minigame. Skipping still feeds you. */
  private async runCoffeeStall() {
    const st = this.stall()
    const gate = { destroy: () => undefined }
    // Tracks whichever gate object is the current lock (gate, then the minigame's own
    // gate once one starts) so `after()` below clears the right one and never leaves
    // storyIntro stuck — a stuck storyIntro blocks all input permanently.
    let activeGate: { destroy: () => void } = gate
    this.storyIntro = gate
    const pages =
      st.game === 'pour'
        ? [
            { title: `${st.keeper}：倒${st.food}`, lines: ['撳住倒漿落個模度，', '啱啱滿就放手。'], tip: '倒多咗會瀉，倒少咗唔夠分。' },
            { title: '一共三底', lines: ['每底都倒到啱啱滿，', '就全中。'], tip: '每底啱啱好都係金幣，用嚟買裝備。' },
          ]
        : st.game === 'timing'
          ? [
              { title: `${st.keeper}：睇火候`, lines: ['指針會喺條紅綠紅嘅條度來回，', '入到綠色嗰下撳落去。'], tip: '愈後面綠色愈窄，要睇準啲。' },
              { title: '一共四次', lines: ['每次啱都有金幣。'], tip: '金幣喺過關之後嘅小朋友檔口買裝備。' },
            ]
          : st.game === 'tilt'
            ? [
                { title: `${st.keeper}：傾斜電話`, lines: ['方向鍵／WASD 郁個波，', '揈佢入綠色窿。'], tip: '電話：揈郁電話本身嚟揈個波。' },
                { title: '小心黑窿', lines: ['跌落黑窿就輸咗嗰次，', '時間到都係輸。'], tip: '一共四次，入窿有金幣。' },
              ]
            : [
                { title: `${st.keeper}：攪勻杯${st.food}`, lines: ['用手指喺杯上面打圈，', '攪到個奶泡散晒為止。'], tip: '電腦：方向鍵順時針轉圈（↑→↓←）' },
                { title: '見到方糖就撳！', lines: ['攪緊嘅時候會彈出方糖，', '1.5 秒之內撳中就加分。'], tip: '每粒方糖都係一個金幣。' },
                { title: '最後吹凍佢', lines: ['對住電話吹氣，杯嘢就凍得快。', '吹唔到？撳住畫面都得。'], tip: `飲完回 1 格血。` },
              ]
    const choice = await showTutorial(this, `stall-${st.game}`, pages)
    if (this.ended || !this.scene.isActive()) return
    const after = (coins: number, pts: number) => {
      if (this.storyIntro === activeGate) this.storyIntro = null
      if (this.ended || !this.scene.isActive()) return
      this.physics.resume()
      this.resetPauseKeys()
      this.drinkCoffee()
      if (pts > 0) {
        this.killBonus += pts
        this.addScorePop(this.boy.x, this.boy.y - 80, pts)
      }
      if (coins > 0) this.addCoins(this.boy.role as Who, coins)
    }
    if (choice === 'skip') {
      after(0, 0)
      return
    }
    if (st.game === 'pour') {
      const mini = pourGame(this)
      this.storyIntro = activeGate = mini
      void mini.done.then((r) => after(r.good * 2, r.good * 150))
      return
    }
    if (st.game === 'timing') {
      const mini = timingGame(this, `${st.keeper}：${st.food}出爐`, '出爐')
      this.storyIntro = activeGate = mini
      void mini.done.then((r) => after(r.good * 2, r.good * 120))
      return
    }
    if (st.game === 'tilt') {
      const mini = tiltGame(this)
      this.storyIntro = activeGate = mini
      void mini.done.then((r) => after(r.good * 2, r.good * 120))
      return
    }
    const mini = stirCoffee(this)
    this.storyIntro = activeGate = mini
    void mini.done.then((r) => after(r.sugar + (r.stirred >= 1 ? 2 : 0), r.sugar * 100 + (r.stirred >= 1 ? 200 : 0)))
  }

  /**
   * 小朋友檔口 — opens from the stage-clear screen, so shopping happens between stages
   * rather than interrupting a run (Alan, 2026-10-27).
   */
  private openGearShop(onClose?: () => void) {
    const heroes: Who[] = this.girl ? ['boy', 'girl'] : [(this.boy.role as Who) ?? 'boy']
    const shop = openShop(this, {
      purse: (w) => this.purseOf(w),
      pay: (w, d) => this.addCoins(w, d),
      friends: () => this.friendsSaved,
      heroes,
      stage: this.stageNo,
    })
    void shop.done.then(() => {
      if (this.ended && !this.clearOverlay) return
      // Gear bought just now takes effect on the next stage (and now, if play resumes).
      for (const h of [this.boy, this.girl]) {
        if (!h) continue
        const w = h.role as Who
        h.jumpMul = jumpMul()
        h.setData('wlv', Math.max(this.weaponLv(h), weaponFloor(w)))
      }
      this.refreshHearts()
      this.refreshCoins()
      onClose?.()
    })
  }

  /** 咖啡媽媽's cup: +1 HP for everyone still standing. */
  private drinkCoffee() {
    let healed = false
    for (const h of [this.boy, this.girl]) {
      if (h?.alive && h.hp < MAX_HP + bonusHearts(h.role as Who)) {
        h.hp += 1
        healed = true
        floatText(this, h.x, h.y - 70, '+1HP', '#7dffb0', { size: 14 })
      }
    }
    if (healed) {
      SFX.sparkle()
      this.emitHealth()
    }
  }

  private spawnHoneyJar(x: number, y: number) {
    // Real-honey jar (matches the cutscenes' 真蜂蜜) — legacy honey stack as fallback.
    const key = this.textures.exists('cs-jar-real')
      ? 'cs-jar-real'
      : this.textures.exists('prop-honey-stack')
      ? 'prop-honey-stack'
      : this.textures.exists('fx-honey')
        ? 'fx-honey'
        : 'coin'
    const jar = this.honeyPickups.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    jar.setScale(PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(jar)
    ;(jar.body as Phaser.Physics.Arcade.Body).allowGravity = false
    addGroundShadow(this, jar, () => y, 0.55)
    this.tweens.add({ targets: jar, y: y - 8, yoyo: true, repeat: -1, duration: 640 })
  }

  private spawnSushi(x: number, y: number, tier: SushiTier = 'salmon') {
    const def = SUSHI_TIERS[tier]
    const key = this.textures.exists(def.tex) ? def.tex : this.textures.exists('pickup-sushi') ? 'pickup-sushi' : 'coin'
    const s = this.sushiPickups.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    s.setData('sushiTier', tier)
    s.setScale(PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(s)
    ;(s.body as Phaser.Physics.Arcade.Body).allowGravity = false
    addGroundShadow(this, s, () => y, 0.5)
    this.tweens.add({ targets: s, y: y - 6, yoyo: true, repeat: -1, duration: 700 })
  }

  private takeSushi(h: Hero, item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active || !h.alive) return
    item.disableBody(true, true)
    const tier = (item.getData('sushiTier') as SushiTier | undefined) ?? 'salmon'
    const def = SUSHI_TIERS[tier]
    const effMax = MAX_HP + bonusHearts(h.role as Who)
    const heal = Math.max(1, Math.round(effMax * def.pct))
    const before = h.hp
    h.hp = Math.min(effMax, h.hp + heal)
    const gained = h.hp - before
    SFX.coin()
    burst(this, item.x, item.y, 0xff8899, 10)
    if (gained > 0) {
      floatText(this, h.x, h.y - 56, `${def.label} +${gained}`, '#ff6688', {
        size: 24,
        rise: 28,
        dur: 2500,
      })
      this.emitHealth()
    } else {
      floatText(this, h.x, h.y - 48, 'HP已滿', '#aaaaaa', { size: 18, dur: 900 })
    }
  }

  private spawnCoin(x: number, y: number) {
    const spin = hasFx(this, 'coin-spin')
    const c = this.coinPickups.create(x, y, spin ? 'fxa-coin-spin' : 'coin') as Phaser.Physics.Arcade.Sprite
    if (spin) c.play('fxa-coin-spin')
    c.setScale(PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(c)
    ;(c.body as Phaser.Physics.Arcade.Body).allowGravity = false
    addGroundShadow(this, c, () => y, 0.45)
    this.tweens.add({ targets: c, y: y - 6, yoyo: true, repeat: -1, duration: 520 })
  }

  private spawnCast() {
    const grace = this.time.now + 1400
    const soloCast = (this.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
    this.girl = null
    this.pet = null
    this.sword = null
    this.girlShadow = null
    this.petShadow = null

    // 1P girl: P1 drives 琪寶寶（stored in boy slot for shared P1 controls）.
    if (this.mode === '1p' && soloCast === 'girl') {
      const lane = LANE_DEFAULT
      const y = laneY(lane)
      const x = 220
      this.boy = Player.spawn(this, x, y, {
        role: 'girl', texture: 'art-girl', animSet: 'kibobo', graceUntil: grace, scale: GIRL_SCALE_MUL, speed: GIRL_SPEED,
      })
      this.boy.snapToLane(lane, x)
      this.entities.add(this.boy, 'player')
      this.boyShadow = addGroundShadow(this, this.boy, (t) => this.groundYFor(t))
      this.attachGirlGear(this.boy, lane)
      return
    }

    const boyLane = LANE_DEFAULT
    const boyY = laneY(boyLane)
    const boyX = 220
    this.boy = Player.spawn(this, boyX, boyY, {
      role: 'boy', texture: 'art-salmon', animSet: 'lunbo', graceUntil: grace, scale: 1, speed: PLAYER.moveSpeed,
    })
    this.boy.snapToLane(boyLane, boyX)
    this.entities.add(this.boy, 'player')
    this.boyShadow = addGroundShadow(this, this.boy, (t) => this.groundYFor(t))

    if (this.mode !== '2p') return

    const girlLane = clampLane(LANE_DEFAULT + 1)
    const girlY = laneY(girlLane)
    const girlX = 380
    this.girl = Player.spawn(this, girlX, girlY, {
      role: 'girl', texture: 'art-girl', animSet: 'kibobo', graceUntil: grace, scale: GIRL_SCALE_MUL, speed: GIRL_SPEED,
    })
    this.girl.snapToLane(girlLane, girlX)
    this.entities.add(this.girl, 'player')
    this.girlShadow = addGroundShadow(this, this.girl, (t) => this.groundYFor(t))
    this.attachGirlGear(this.girl, girlLane)
  }

  /** 琪寶寶 sword／噗噗 — 電風扇已 stamp 喺 art-girl 背脊. */
  private attachGirlGear(g: Hero, lane: LaneId) {
    const petStartX = g.x - PET_FOLLOW_BEHIND
    const petAnim = hasAnimSet(this, 'pupu')
    this.pet = this.physics.add.sprite(petStartX, g.y, petAnim ? animTex('pupu') : 'art-bear')
    if (petAnim) this.pet.anims.play('pupu-idle')
    this.pet.setOrigin(0.5, 1)
    enableActorSprite(this.pet)
    this.pet
      .setScale(this.petScaleForGirl(g))
      .setAlpha(0.85)
      .setDepth(actorDepth('pet', lane, g.y))
      .setVisible(true)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.pet.setData('lane', lane)
    this.entities.add(this.pet, 'pet')
    this.petShadow = addGroundShadow(this, this.pet, (t) => this.groundYFor(t), 0.85)
    // Animated 琪寶寶 carries her sword + fan in the frames — no separate prop sprite.
    if (g.animSet) {
      this.sword = null
      return
    }
    const swordKey = this.textures.exists('prop-sword') ? 'prop-sword' : 'fx-salmon-shot'
    const grip = this.girlSwordAnchor(g, false)
    this.sword = this.add
      .image(grip.x, grip.y, swordKey)
      .setOrigin(0.12, 0.55)
      .setDepth(actorDepth('hitbox', lane, g.y) + 0.2)
      .setScale(grip.scale)
      .setAngle(-18)
    enableActorSprite(this.sword)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.attackHitboxes = this.physics.add.group()
    this.shots = this.physics.add.group()
    this.enemyShots = this.physics.add.group()
    this.honeys = this.physics.add.group()
    if (this.market) this.placeStalls()
    this.placeEnemies()

    this.physics.add.collider(this.boy, this.ground)
    if (this.girl) this.physics.add.collider(this.girl, this.ground)
    this.physics.add.collider(this.enemies, this.ground)
    // No solidsLayer colliders — platforms removed (lane combat, not platformer).

    this.physics.add.overlap(this.shots, this.pots, (shot, pot) => {
      ;(shot as Phaser.Physics.Arcade.Sprite).destroy()
      this.breakPot(pot as Breakable)
    })
    // Hitboxes → overlap
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h)
    for (const hero of heroes) {
      this.physics.add.overlap(hero.attackHitbox, this.enemies, (hitbox, enemy) => {
        const e = enemy as PatrolEnemy
        if (!hero.isMeleeActive() || !e.active || e.isDead) return
        // Dedup per swing (hitSet is reset in Hero.startMelee): without this, an enemy
        // that cancels its own knockback (e.g. 打卡鐘怪) sits inside the box and gets
        // re-hit on every physics step for as long as the overlap holds — each hit
        // re-extends the post-hit freeze window, which can never expire because the
        // frozen hero's own update (and so the hitbox's timeout) stops advancing while
        // frozen, softlocking movement. One hit per swing per target closes the loop.
        const box = hitbox as Phaser.Physics.Arcade.Image
        const hitSet = (box.getData('hitSet') as Set<string> | undefined) ?? new Set<string>()
        box.setData('hitSet', hitSet)
        const key = (e as { entityId?: string }).entityId ?? `${e.x.toFixed(0)}:${e.y.toFixed(0)}`
        if (hitSet.has(key)) return
        hitSet.add(key)
        this.damageEnemy(e, PLAYER_ATTACK_DMG, hero.facing, hero)
      })
      this.physics.add.overlap(hero.attackHitbox, this.pots, (_a, pot) => {
        if (!hero.isMeleeActive()) return
        this.breakPot(pot as Breakable)
      })
    }
    this.physics.add.overlap(this.attackHitboxes, this.enemies, (hit, enemy) => {
      const box = hit as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      const hitSet = (box.getData('hitSet') as Set<string> | undefined) ?? new Set<string>()
      box.setData('hitSet', hitSet)
      const key = (e as { entityId?: string }).entityId ?? `${e.x.toFixed(0)}:${e.y.toFixed(0)}`
      if (hitSet.has(key)) return
      hitSet.add(key)
      const dmg = (box.getData('dmg') as number) || 1
      const dir = (box.getData('dir') as number) || 1
      this.damageEnemy(e, dmg, dir)
    })
    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      const s = shot as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      playFx(this, 'roe-splash', s.x, s.y)
      s.destroy()
      const pw = (s.getData('power') as number | undefined) ?? 1
      this.damageEnemy(e, Math.max(1, Math.round(PLAYER_ATTACK_DMG * pw)), Math.sign(e.x - this.boy.x) || 1)
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      const g = this.girl
      j.destroy()
      const caster = (j.getData('by') as Who | undefined) ?? ((g?.role ?? this.boy.role) as Who)
      this.damageEnemy(e, specialPower(caster), Math.sign(e.x - (g?.x ?? this.boy.x)) || 1)
    })
    // Enemy body ↔ player hurtbox
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as PatrolEnemy))
    this.physics.add.overlap(this.boy, this.hazards, (_b, hz) => {
      const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
      if (kind === 'lava') this.hazardHit(this.boy, { knockX: this.boy.facing * -220, knockY: -600, label: '熔岩' })
      else if (kind === 'durian') this.durian(this.boy)
      else this.spike(this.boy)
    })
    this.physics.add.overlap(this.boy, this.coinPickups, (_b, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite, this.boy))
    this.physics.add.overlap(this.boy, this.honeyPickups, (_b, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.sushiPickups, (_b, s) => this.takeSushi(this.boy, s as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.powerPickups, (_b, p) => this.takePowerUp(this.boy, p as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.enemyShots, (_b, s) => this.hitByFishBullet(this.boy, s as Phaser.Physics.Arcade.Sprite))
    if (this.girl) {
      const g = this.girl
      this.physics.add.overlap(g, this.enemies, (_g, e) => this.hurtHero(g, e as PatrolEnemy))
      this.physics.add.overlap(g, this.hazards, (_g, hz) => {
        const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
        if (kind === 'lava') this.hazardHit(g, { knockX: g.facing * -220, knockY: -600, label: '熔岩' })
        else if (kind === 'durian') this.durian(g)
        else this.spike(g)
      })
      this.physics.add.overlap(g, this.coinPickups, (_g, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite, g))
      this.physics.add.overlap(g, this.honeyPickups, (_g, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.sushiPickups, (_g, s) => this.takeSushi(g, s as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.powerPickups, (_g, p) => this.takePowerUp(g, p as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.enemyShots, (_g, s) => this.hitByFishBullet(g, s as Phaser.Physics.Arcade.Sprite))
    }
  }

  /** 刺刺魚小彈 — 低傷 + 短 freeze */
  /**
   * 帽仔兵 rock — alternates LOW (knee height, jump it) and HIGH (chest height,
   * crouch under it). Straight throw with a slight drop so it reads as thrown.
   */
  private spawnRock(e: PatrolEnemy, dir: 1 | -1) {
    const key = this.textures.exists('fx-rock') ? 'fx-rock' : 'coin'
    const n = ((e.getData('throwN') as number) || 0) + 1
    e.setData('throwN', n)
    const high = n % 2 === 0
    const feet = e.y
    const y = feet - (high ? 19 : 7)
    const shot = this.enemyShots.create(e.x + dir * 18, y, key) as Phaser.Physics.Arcade.Sprite
    shot.setDepth(actorDepth('shot', e.lane, e.y))
    enableActorSprite(shot)
    const body = shot.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(8, 8)
    shot.setVelocity(dir * 170, 0)
    shot.setData('lane', e.lane)
    shot.setData('dmg', 1)
    this.tweens.add({ targets: shot, angle: dir * 360, duration: 500, repeat: -1 })
    this.markShot(shot, high ? 0xff9a50 : 0xffd060)
    floatText(this, e.x, e.y - 64, high ? '高！蹲' : '低！跳', '#ffe08a', { size: 11, dur: 600 })
    this.entities.add(shot, 'projectile')
    this.time.delayedCall(1800, () => {
      if (shot.active) shot.destroy()
    })
  }

  /**
   * Enemy projectiles are only ~9 px, which reads as a speck on a phone: give each one a
   * pulsing halo, a short trail and a bigger sprite so it is never missed.
   */
  private markShot(shot: Phaser.Physics.Arcade.Sprite, color = 0xffd060) {
    shot.setScale(1.7)
    const halo = this.add.circle(shot.x, shot.y, 11, color, 0.6).setDepth(shot.depth - 0.1).setBlendMode(Phaser.BlendModes.ADD)
    const core = this.add.circle(shot.x, shot.y, 3, 0xffffff, 0.9).setDepth(shot.depth + 0.1).setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: halo, scale: { from: 0.9, to: 1.6 }, alpha: { from: 0.7, to: 0.25 }, duration: 240, yoyo: true, repeat: -1 })
    let t = 0
    const follow = (_tm: number, dt: number) => {
      if (!shot.active) return
      halo.setPosition(shot.x, shot.y)
      core.setPosition(shot.x, shot.y)
      t += dt
      if (t > 60) {
        t = 0
        const dot = this.add.circle(shot.x, shot.y, 3, color, 0.5).setDepth(shot.depth - 0.2).setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({ targets: dot, alpha: 0, scale: 0.3, duration: 220, onComplete: () => dot.destroy() })
      }
    }
    this.events.on('update', follow)
    shot.once('destroy', () => {
      this.events.off('update', follow)
      halo.destroy()
      core.destroy()
    })
  }

  private hitByFishBullet(h: Hero, shot: Phaser.Physics.Arcade.Sprite) {
    if (!shot.active || this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) {
      shot.destroy()
      return
    }
    const lane = shot.getData('lane') as number | undefined
    // ±1 lane still hits (同上下差一行)
    if (lane !== undefined && h.lane !== undefined && Math.abs(lane - h.lane) > 1) return
    shot.destroy()
    const away = (Math.sign(h.x - shot.x) || -1) as 1 | -1
    const dmg = this.incoming(h, (shot.getData('dmg') as number) || FISH_BULLET_DMG)
    const hpLeft = applyDamage(h, {
      amount: dmg,
      knockbackX: this.safeKnockX(h, away * 180),
      knockbackY: -160,
      now: this.time.now,
    })
    applyHurtPose(h, -away)
    freezeActors(this, [h], FISH_BULLET_FREEZE_MS)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, this.iframes(h))
    SFX.hurt()
    burst(this, h.x, h.y - 20, 0xffaa66, 5)
    floatText(this, h.x, h.y - 36, `-${dmg}`, '#ffaa66', { size: 16, dur: 700 })
    this.refreshHearts()
    if (h.role === 'girl') this.summonBearAssist()
    if (hpLeft <= 0) this.knockOut(h)
  }


  /**
   * After cast select: 3 story acts (7s each, A/攻 skips act).
   * Every transition ≥1s black; after last act → 2s black → gameplay.
   */
  private showIntro() {
    this.boy.setVelocity(0, 0)
    this.girl?.setVelocity(0, 0)
    this.pet?.setVelocity(0, 0)

    // HUD lives in its own scene above us — hide it while the cutscene plays.
    this.time.delayedCall(0, () => {
      if (this.scene.isActive('UIScene') && !this.started) this.scene.setVisible(false, 'UIScene')
    })
    const handle = playCutscene(this, this.tower ? 'C8' : this.depot ? 'C7' : this.market ? 'C5' : this.tree ? 'C3' : 'C1', () => {
        playSong(this.tower ? 'stage5' : this.depot ? 'stage4' : this.market ? 'stage3' : this.tree ? 'stage2' : 'stage1')
        if (this.scene.get('UIScene')) this.scene.setVisible(true, 'UIScene')
        if (this.started) return
        this.started = true
        this.startedAt = this.time.now
        this.pauseReadyAt = this.time.now + 1200
        this.resetPauseKeys()
        this.storyIntro = null
        this.emitScore(
          this.mode === '1p'
            ? '單人：ＡＤ左右　Ｓ蹲　Ｇ跳　Ｆ攻　Ｔ絕招　Ｈ切換｜Enter暫停'
            : '雙人：←→／Ｓ蹲　Ｇ／．跳　Ｆ／，攻　Ｔ／；絕招　Ｈ／／切換',
        )
        // data/signs.json SG-02 — display-only tutorial (no combat change)
        const tip = this.tree || this.market || this.depot || this.tower ? null : tutorialSign()
        if (this.market) floatText(this, this.boy.x + 120, LANE_FLOOR_Y - 120, '燈熄咗？打燈籠著返佢！', '#ffe08a', { size: 12, rise: 10, dur: 3200 })
        if (this.tree) floatText(this, this.boy.x + 120, LANE_FLOOR_Y - 120, '踩入風口會彈高！', '#ffe08a', { size: 12, rise: 10, dur: 3200 })
        if (this.depot) floatText(this, this.boy.x + 120, LANE_FLOOR_Y - 120, '黃燈閃完會衝推土機！跳上平台！', '#ffe08a', { size: 12, rise: 10, dur: 3200 })
        if (this.tower) floatText(this, this.boy.x + 120, LANE_FLOOR_Y - 120, '輸送帶會推住你行，小心方向！', '#ffe08a', { size: 12, rise: 10, dur: 3200 })
        if (tip && 'text' in tip && tip.text) {
          const ms = 'showMs' in tip && typeof tip.showMs === 'number' ? tip.showMs : 3000
          floatText(this, this.boy.x, this.boy.y - 56, tip.text, '#ffe08a', {
            size: 12,
            rise: 10,
            dur: ms,
          })
          this.registry.set('activeSignId', tip.id)
          this.registry.set('activeSignText', tip.text)
        }
    })
    this.storyIntro = handle
    this.events.once('shutdown', () => handle.destroy())
  }

  // ── Goemon-style stage mechanics ─────────────────────────────────────────

  private powerPickups!: Phaser.Physics.Arcade.Group
  private movers: Mover[] = []
  private crushers: Crusher[] = []
  private crusherChains: Phaser.GameObjects.Graphics | null = null

  /** Paper lanterns / clay pots from stage JSON; break with any attack. */
  private placeBreakables() {
    const spr_vines: Array<{ g: Phaser.GameObjects.Graphics; x: number }> = []
    for (const b of ST.breakables ?? []) {
      const hive = b.kind === 'hive' && this.textures.exists('s2-hive')
      const tex = hive
        ? 's2-hive'
        : b.kind === 'lantern'
          ? (this.textures.exists('prop-break-lantern') ? 'prop-break-lantern' : 'prop-lantern3d')
          : (this.textures.exists('prop-break-pot') ? 'prop-break-pot' : 'pot3d')
      const ground = groundTopBelow(b.x, LANE_FLOOR_Y - 60, 6) ?? LANE_FLOOR_Y
      // Hives hang from a vine at chest height (roe and sword both reach), the rest sit on the floor.
      const top = hive ? ground - 16 : ground
      if (hive) {
        const vine = this.add.graphics().setDepth(DEPTH.BREAKABLE - 1)
        vine.fillStyle(0x3a5a22, 1).fillRect(b.x - 1, 30, 2, top - 40 - 30)
        vine.fillStyle(0x6a9a3a, 1).fillRect(b.x - 1, 30, 1, top - 40 - 30)
        spr_vines.push({ g: vine, x: b.x })
      }
      const spr = this.pots.create(b.x, top, tex) as Breakable
      spr.setOrigin(0.5, 1).setDepth(DEPTH.BREAKABLE)
      spr.breakKind = b.kind
      spr.loot = b.loot
      enablePixelSprite(spr)
      const body = spr.body as Phaser.Physics.Arcade.Body
      body.allowGravity = false
      body.setImmovable(true)
      // Lanterns sway a touch so they read as paper, not stone.
      if (b.kind === 'lantern') {
        spr.setData('baseY', top)
        this.tweens.add({ targets: spr, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 900 + (b.x % 5) * 80, ease: 'Sine.inOut' })
      }
      if (hive) {
        this.tweens.add({ targets: spr, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 1300 + (b.x % 5) * 90, ease: 'Sine.inOut' })
        const vine = spr_vines[spr_vines.length - 1]
        spr.once('destroy', () => vine?.g.destroy())
        spr.setData('vine', vine?.g)
      }
      addGroundShadow(this, spr, () => ground, 0.45)
    }
  }

  /** Honey-crate cages: a friend sits behind the bars; two hits open it. */
  private placeFriends() {
    if (!ST.friends?.length) return
    ensureFriendArt(this)
    for (const f of ST.friends) {
      if (!isFriendId(f.id)) continue
      const ground = groundTopBelow(f.x, LANE_FLOOR_Y - (f.h ?? 0) - 6, 8) ?? LANE_FLOOR_Y
      const pal = this.add.sprite(f.x, ground - 3, friendTex(f.id)).setOrigin(0.5, 1).setDepth(DEPTH.BREAKABLE - 1).setTint(0xb0a8a0)
      enablePixelSprite(pal)
      // A sad little sway behind the bars.
      this.tweens.add({ targets: pal, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      const cage = this.pots.create(f.x, ground, 'friend-cage') as Breakable
      cage.setOrigin(0.5, 1).setDepth(DEPTH.BREAKABLE)
      cage.breakKind = 'cage'
      cage.loot = 'coin'
      cage.setData('friend', f.id)
      cage.setData('pal', pal)
      cage.setData('hits', 0)
      enablePixelSprite(cage)
      const body = cage.body as Phaser.Physics.Arcade.Body
      body.allowGravity = false
      body.setImmovable(true)
      addGroundShadow(this, cage, () => ground, 0.45)
      // Calls for help when the heroes come near (once).
      cage.setData('called', false)
    }
  }

  /** Cage hit: first one cracks it, the second frees the friend. Returns true when it opened. */
  private hitCage(cage: Breakable): boolean {
    const now = this.time.now
    if (now - ((cage.getData('lastHit') as number) || 0) < 260) return false
    cage.setData('lastHit', now)
    const hits = ((cage.getData('hits') as number) || 0) + 1
    cage.setData('hits', hits)
    if (hits < 2) {
      SFX.hit()
      cage.setTint(0xd8b080)
      this.tweens.add({ targets: cage, x: cage.x + 2, duration: 40, yoyo: true, repeat: 2 })
      burst(this, cage.x, cage.y - 24, 0xc48a48, 5)
      floatText(this, cage.x, cage.y - 56, '再打一下！', '#ffe08a', { size: 11, dur: 600 })
      return false
    }
    return true
  }

  private freeFriend(cage: Breakable) {
    const id = cage.getData('friend') as string
    const pal = cage.getData('pal') as Phaser.GameObjects.Sprite | undefined
    const look = isFriendId(id) ? FRIENDS[id] : null
    if (!pal || !look) return
    if (!this.friendsSaved.includes(id)) this.friendsSaved.push(id)
    markFriendSaved(id)
    this.tweens.killTweensOf(pal)
    pal.setAngle(0).clearTint().setDepth(DEPTH.BREAKABLE + 2)
    SFX.sparkle()
    burst(this, pal.x, pal.y - 20, 0xffe890, 12)
    floatText(this, pal.x, pal.y - 60, `救到 ${look.name}！`, '#ffd0e0', { size: 14, dur: 1400 })
    this.addScorePop(pal.x, pal.y - 80, 500)
    this.killBonus += 500
    const floor = pal.y
    // Two happy hops, then off to wait at the next coffee cart.
    this.tweens.add({
      targets: pal,
      y: floor - 14,
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.out',
      onComplete: () => {
        const next = this.checkpointXs.find((x) => x > pal.x + 40)
        const destX = next !== undefined ? next + 56 + this.friendsSaved.length * 6 : pal.x + 420
        this.tweens.add({ targets: pal, angle: { from: -6, to: 6 }, duration: 160, yoyo: true, repeat: -1 })
        this.tweens.add({
          targets: pal,
          x: destX,
          duration: Math.abs(destX - pal.x) * 9,
          onComplete: () => {
            this.tweens.killTweensOf(pal)
            pal.setAngle(0)
            if (next === undefined) {
              this.tweens.add({ targets: pal, alpha: 0, duration: 300, onComplete: () => pal.destroy() })
              return
            }
            const top = groundTopBelow(destX, LANE_FLOOR_Y - 60, 8) ?? LANE_FLOOR_Y
            pal.setY(top + 1).setDepth(DEPTH.PROP + 2)
            // Waves (little hops) at the cart while you pass.
            this.tweens.add({ targets: pal, y: top - 5, duration: 220, yoyo: true, repeat: -1, repeatDelay: 900, ease: 'Quad.out' })
          },
        })
      },
    })
  }

  private breakPot(pot: Breakable) {
    if (!pot.active || pot.getData('broken')) return
    if (pot.breakKind === 'cage') {
      if (!this.hitCage(pot)) return
      pot.setData('broken', true)
      SFX.kill()
      this.juice.breakDebris(pot.x, pot.y - 20, 0xc48a48)
      impactRing(this, pot.x, pot.y - 20, 0xffc040, 14)
      this.time.delayedCall(70, () => pot.active && pot.disableBody(true, true))
      this.freeFriend(pot)
      return
    }
    pot.setData('broken', true)
    const loot: LootKind = pot.loot ?? (pot.breakKind === 'chest' ? 'coin' : 'honey')
    const x = pot.x
    const midY = pot.y - pot.displayHeight * 0.5
    const facing = Math.sign(this.boy.x - x) || 1
    const isLantern = pot.breakKind === 'lantern'
    if (isLantern) SFX.paperTear()
    else if (pot.breakKind === 'pot') SFX.potShatter()
    else SFX.kill()
    const debrisColor = isLantern ? 0xd8382a : pot.breakKind === 'pot' ? 0xa45c32 : pot.breakKind === 'hive' ? 0xe8a030 : 0xc48a48
    this.juice.solidHit(x, midY, false, pot as Phaser.Physics.Arcade.Sprite, -facing)
    this.juice.breakDebris(x, midY, debrisColor)
    impactRing(this, x, midY, debrisColor, 12)
    if (isLantern) burst(this, x, midY, 0xffd27a, 8) // candle sparks
    if (pot.breakKind === 'lantern' || pot.breakKind === 'pot') {
      playFx(this, isLantern ? 'lantern-break' : 'pot-break', x, pot.y, { originY: 1, depth: DEPTH.BREAKABLE + 1 })
    }
    if (pot.breakKind === 'hive') {
      // The shell drops to the floor and stays; the vine snaps back up.
      if (this.textures.exists('s2-hive-broken')) {
        const shell = this.add.image(x, pot.y - 20, 's2-hive-broken').setOrigin(0.5, 1).setDepth(DEPTH.BREAKABLE)
        this.tweens.add({ targets: shell, y: LANE_FLOOR_Y + 1, duration: 320, ease: 'Bounce.out' })
      }
      const vine = pot.getData('vine') as Phaser.GameObjects.Graphics | undefined
      if (vine) this.tweens.add({ targets: vine, scaleY: 0.6, alpha: 0.7, duration: 200 })
      burst(this, x, midY, 0xffc040, 10)
    }
    this.addScorePop(x, midY - 30, SCORE_BREAK)
    this.time.delayedCall(70, () => {
      if (pot.active) pot.disableBody(true, true)
    })
    const dropY = pot.breakKind === 'hive' ? LANE_FLOOR_Y - 4 : pot.y - 12
    if (loot === 'honey') this.grantHoneySpecial(x, midY)
    else if (loot === 'power') this.spawnPowerUp(x, dropY)
    else if (loot === 'food') {
      // Ordinary breakable drop: mostly the weak/common tamago, sometimes the better ebi.
      const tier: SushiTier = Math.random() < 0.35 ? 'ebi' : 'tamago'
      this.spawnSushi(x, dropY, tier)
      floatText(this, x, midY - 20, '壽司！', '#ff99aa')
    } else {
      this.spawnCoin?.(x, dropY)
      floatText(this, x, midY - 20, '＋1幣', '#ffe08a')
    }
  }

  /** 金鮭 pops out with a little hop, then bobs until taken. */
  private spawnPowerUp(x: number, y: number) {
    const key = this.textures.exists('pickup-power') ? 'pickup-power' : 'coin'
    const p = this.powerPickups.create(x, y - 18, key) as Phaser.Physics.Arcade.Sprite
    p.setDepth(DEPTH.PICKUP)
    enablePixelSprite(p)
    ;(p.body as Phaser.Physics.Arcade.Body).allowGravity = false
    addGroundShadow(this, p, () => y + 10, 0.5)
    floatText(this, x, y - 40, '金鮭！', '#ffd040', { size: 16 })
    this.tweens.add({
      targets: p,
      y,
      duration: 260,
      ease: 'Bounce.out',
      onComplete: () => {
        if (p.active) this.tweens.add({ targets: p, y: y - 5, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.inOut' })
      },
    })
    // Shine every second so it's never missed.
    const shine = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!p.active) return shine.remove()
        burst(this, p.x, p.y, 0xfff0a0, 3)
      },
    })
  }

  private weaponLv(h: Hero): number {
    return Math.max(weaponFloor(h.role as Who), (h.getData('wlv') as number | undefined) ?? 1)
  }

  /** Damage this hero actually takes: armour cuts it, never below 1. */
  private incoming(h: Hero, amount: number) {
    return Math.max(1, amount - damageCut(h.role as Who))
  }

  /** i-frames after a hit: the charm stretches them. */
  private iframes(h: Hero) {
    return Math.round(HURT_IFRAME_MS * iframeMul(h.role as Who))
  }

  private takePowerUp(h: Hero, item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active || !h.alive) return
    item.disableBody(true, true)
    const before = this.weaponLv(h)
    const lv = Math.min(WEAPON_MAX_LV, before + 1)
    h.setData('wlv', lv)
    SFX.powerUp()
    playFx(this, 'power-up', h.x, h.y - 34)
    impactRing(this, h.x, h.y - 30, 0xffd040, 18)
    burst(this, h.x, h.y - 30, 0xffe890, 14)
    if (lv > before) {
      floatText(this, h.x, h.y - 70, `武器升級 Lv${lv}`, '#ffd040', { size: 18, rise: 24, dur: 1600 })
    } else {
      // Already max → bank it as score.
      this.addScorePop(h.x, h.y - 70, SCORE_BREAK * 2)
      floatText(this, h.x, h.y - 70, '武器 MAX', '#ffd040', { size: 16 })
    }
    this.flashWeaponTint(h)
  }

  /** Lose one weapon level on any damage (Goemon rule). */
  private dropWeaponLv(h: Hero) {
    const lv = this.weaponLv(h)
    if (lv <= weaponFloor(h.role as Who)) return
    h.setData('wlv', lv - 1)
    SFX.powerDown()
    floatText(this, h.x, h.y - 84, `武器 Lv${lv - 1}`, '#c8a060', { size: 14, dur: 1000 })
  }

  private flashWeaponTint(h: Hero) {
    h.setTint(0xffe070)
    this.time.delayedCall(90, () => {
      if (h.active && h.hurtLock <= 0) h.clearTint()
    })
  }

  /** Moving planks: sine slide; heroes standing on them ride along. */
  private tickMovers() {
    if (!this.movers.length) return
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive)
    for (const m of this.movers) {
      const x0 = Math.round(m.baseX + m.range * Math.sin((this.time.now / m.periodMs) * Math.PI * 2))
      const dx = x0 - m.solid.x0
      if (dx !== 0) {
        for (const h of heroes) {
          const onIt = !h.laneJumping && Math.abs(h.y - m.solid.top) <= 3 && h.x >= m.solid.x0 - 4 && h.x <= m.solid.x1 + 4
          if (onIt) h.x += dx
        }
      }
      m.solid.x0 = x0
      m.solid.x1 = x0 + m.w
      const top = m.solid.top
      if (m.img) m.img.x = x0
      m.posts.clear()
      if (!m.img) m.posts.fillStyle(0x8a5a30, 1).fillRect(x0, top, m.w, 8)
      m.posts
        .fillStyle(0x12100c, 1)
        .fillRect(x0 - 1, top - 1, m.w + 2, 1)
        .fillRect(x0 - 1, top + 8, m.w + 2, 1)
        // Little gears under the plank so the motion reads as mechanical.
        .fillStyle(0x6a6460, 1)
        .fillRect(x0 + 4, top + 9, 4, 4)
        .fillRect(x0 + m.w - 8, top + 9, 4, 4)
    }
  }

  private placeCrushers() {
    this.crushers = []
    const list = ST.crushers ?? []
    if (!list.length) return
    this.crusherChains = this.add.graphics().setDepth(DEPTH.BREAKABLE - 1)
    const key = this.textures.exists('hazard-crusher') ? 'hazard-crusher' : 'coin'
    for (const c of list) {
      const floor = LANE_FLOOR_Y
      const restBottom = floor - c.restH
      const spr = this.add.image(c.x, restBottom, key).setOrigin(0.5, 1).setDepth(DEPTH.BREAKABLE)
      enablePixelSprite(spr)
      this.crushers.push({ spr, x: c.x, restBottom, floor, state: 'idle', t: c.idleMs, cfg: c })
      // Warning stripe on the floor under it.
      this.add.rectangle(c.x, floor + 1, spr.displayWidth + 4, 2, 0xb03020, 0.7).setOrigin(0.5, 0).setDepth(DEPTH.GROUND + 4)
    }
  }

  private tickCrushers(dt: number) {
    if (!this.crushers.length) return
    const g = this.crusherChains
    g?.clear()
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive)
    const cam = this.cameras.main
    for (const c of this.crushers) {
      c.t -= dt
      const cfg = c.cfg
      const onScreen = c.x > cam.scrollX - 80 && c.x < cam.scrollX + GAME_W + 80
      if (c.t <= 0) {
        if (c.state === 'idle') {
          c.state = 'warn'
          c.t = cfg.warnMs
          if (onScreen) SFX.chain()
        } else if (c.state === 'warn') {
          c.state = 'down'
          c.t = cfg.downMs
        } else if (c.state === 'down') {
          c.state = 'stay'
          c.t = cfg.stayMs
          if (onScreen) {
            SFX.slam()
            this.cameras.main.shake(90, 0.004)
            burst(this, c.x - 10, c.floor - 2, 0xc8b090, 6)
            burst(this, c.x + 10, c.floor - 2, 0xc8b090, 6)
          }
        } else if (c.state === 'stay') {
          c.state = 'up'
          c.t = cfg.upMs
        } else {
          c.state = 'idle'
          c.t = cfg.idleMs
        }
      }
      // Position from state progress.
      let bottom = c.restBottom
      let shakeX = 0
      if (c.state === 'warn') shakeX = Math.floor(this.time.now / 40) % 2 === 0 ? -1 : 1
      else if (c.state === 'down') {
        const k = 1 - Math.max(0, c.t) / cfg.downMs
        bottom = c.restBottom + (c.floor - c.restBottom) * k * k
      } else if (c.state === 'stay') bottom = c.floor
      else if (c.state === 'up') {
        const k = 1 - Math.max(0, c.t) / cfg.upMs
        bottom = c.floor - (c.floor - c.restBottom) * k
      }
      c.spr.setPosition(c.x + shakeX, Math.round(bottom))
      // Chain up to the canopy.
      const topY = Math.round(bottom - c.spr.displayHeight)
      if (g) {
        for (let y = topY - 2; y > c.floor - 220; y -= 4) {
          g.fillStyle(0x5a544e, 1).fillRect(c.x - 1 + shakeX, y - 2, 3, 2)
          g.fillStyle(0x8a847c, 1).fillRect(c.x - 1 + shakeX, y - 2, 1, 1)
        }
      }
      // Hurts only while falling / resting on the floor.
      if (c.state === 'down' || c.state === 'stay') {
        const halfW = c.spr.displayWidth * 0.5 - 2
        for (const h of heroes) {
          const headY = h.y - Math.max(24, h.displayHeight * 0.85)
          if (Math.abs(h.x - c.x) < halfW + 4 && bottom > headY && h.y > bottom - c.spr.displayHeight) {
            this.hazardHit(h, { knockX: (Math.sign(h.x - c.x) || -1) * 260, knockY: -420, label: '尖刺塊！' })
          }
        }
      }
    }
  }

  private takeHoneyPickup(item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active) return
    item.disableBody(true, true)
    this.grantHoneySpecial(item.x, item.y)
    playFx(this, 'honey-sparkle', item.x, item.y)
    SFX.kill(); burst(this, item.x, item.y, 0xffc050, 12)
  }

  private takeCoin(coin: Phaser.Physics.Arcade.Sprite, by?: Hero | null) {
    if (!coin.active) return
    coin.disableBody(true, true)
    this.addCoins(by?.role as Who | undefined, 1)
    SFX.coin()
    burst(this, coin.x, coin.y, 0xffe08a, 8)
    floatText(this, coin.x, coin.y - 16, '＋1幣', '#ffe08a')
  }

  /** Coins land in one hero's purse; the shared stock is what 投幣續關 spends. */
  addCoins(who: Who | undefined, n: number) {
    const w: Who = who ?? (this.boy?.role as Who) ?? 'boy'
    this.purse[w] = Math.max(0, (this.purse[w] ?? 0) + n)
    this.coinStock = Math.max(0, this.coinStock + n)
    this.refreshCoins()
  }

  /** What this hero can spend at the friends' stall. */
  purseOf(who: Who) {
    return this.purse[who] ?? 0
  }

  private checkWin() {
    if (this.ended || !this.started) return
    if (!this.bossOn) return
    const bossAlive = this.enemies.getChildren().some((o) => {
      const e = o as Creep
      return e.active && e.boss
    })
    if (bossAlive) return
    // 1P: solo hero on goal. 2P: both on goal.
    if (!(this.boyGoal && this.girlGoal)) return
    const timeSec = (this.time.now - this.startedAt) / 1000
    this.scorePts = calcScore({
      timeSec, honey: this.honeyGot, hpBoy: this.boy.hp, hpGirl: this.girl?.hp ?? 0, deaths: this.deaths,
    })
    saveScore({ score: this.scorePts, timeSec, honey: this.honeyGot, mode: this.mode, at: Date.now() })
    this.playOutro()
  }

  /** C2 (first real honey → 噗噗's ear twitches → note to 蜜樹丘), then the clear card. */
  private outroOn = false
  private clearAt = 0
  private playOutro() {
    if (this.outroOn) return
    this.outroOn = true
    this.clearAt = this.time.now
    this.ended = true
    this.physics.pause()
    stopBgm()
    SFX.win()
    if (this.scene.isActive('UIScene')) this.scene.setVisible(false, 'UIScene')
    this.time.delayedCall(1800, () => {
      this.storyIntro = playCutscene(this, this.tower ? 'C11' : this.depot ? 'C9' : this.market ? 'C6' : this.tree ? 'C4' : 'C2', () => {
        this.storyIntro = null
        if (this.scene.get('UIScene')) this.scene.setVisible(true, 'UIScene')
        this.win()
      })
    })
  }

  /**
   * Stage clear → full-screen joy cutscene (not stuck on gameplay cam).
   * 倫寶＋琪寶寶＋噗噗 hug, 「第２關・待續」, button → character select.
   */
  private clearCardAction: (() => void) | null = null

  /** Highlight the chosen clear-screen button. */
  private drawClearSel() {
    this.clearBtns.forEach((b, i) => {
      const on = i === this.clearSel && b.on
      b.bg.setFillStyle(on ? 0x6a3a18 : 0x4a2a14)
      b.bg.setStrokeStyle(2, on ? 0xffd76a : b.on ? 0xc8902a : 0x6a5a40)
      b.tx.setColor(on ? '#fff6e0' : b.on ? '#ffe9a8' : '#8a7a60')
    })
  }
  private clearOverlay: Phaser.GameObjects.Container | null = null
  private clearBtns: ClearButton[] = []
  private clearSel = 0
  private clearCardMove: ((d: number) => void) | null = null
  private tallyDone = false
  private finishTally: (() => void) | null = null

  /** Clear rank from the run: S = all honey, no continue, little damage. */
  private clearRank(hpLeft: number, hpMax: number): 'S' | 'A' | 'B' | 'C' {
    if (this.honeyGot >= 3 && this.deaths === 0 && hpLeft >= hpMax - 2) return 'S'
    if (this.honeyGot >= 2 && this.deaths <= 1) return 'A'
    if (this.deaths <= 2) return 'B'
    return 'C'
  }

  /**
   * SNES-style clear screen: lacquered panel, the cast celebrating (win frames),
   * a score tally that counts up line by line, then a rank stamp.
   */
  private buildClearCard() {
    const overlay = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(DEPTH.UI + 120).setScrollFactor(0)
    this.clearOverlay = overlay
    this.tallyDone = false
    const W = GAME_W
    const H = GAME_H
    // Backdrop: the stage's own painting, darkened, with drifting gold motes.
    const bgKey = this.market ? 'story-credits-bg' : this.tree ? 'story-canopy-far' : this.textures.exists('story-cover') ? 'story-cover' : null
    overlay.add(this.add.rectangle(0, 0, W, H, 0x120a06, 1))
    if (bgKey && this.textures.exists(bgKey)) overlay.add(this.add.image(0, 0, bgKey).setAlpha(0.35))
    for (let i = 0; i < 24; i++) {
      const m = this.add.circle(Phaser.Math.Between(-W / 2, W / 2), Phaser.Math.Between(-H / 2, H / 2), 1, 0xffe08a, 0.8)
      overlay.add(m)
      this.tweens.add({ targets: m, y: m.y - 40, alpha: { from: 0.1, to: 0.9 }, duration: 1800 + i * 90, yoyo: true, repeat: -1 })
    }
    const lacquer = (x: number, y: number, w: number, h: number) => {
      const g = this.add.graphics()
      g.fillStyle(0x000000, 0.4).fillRect(x + 3, y + 3, w, h)
      g.fillStyle(0xc8902a, 1).fillRect(x - 2, y - 2, w + 4, h + 4)
      g.fillStyle(0x6a4a18, 1).fillRect(x - 1, y - 1, w + 2, h + 2)
      g.fillStyle(0x1c120c, 0.96).fillRect(x, y, w, h)
      g.fillStyle(0x3a2616, 1).fillRect(x, y, w, 3)
      g.fillStyle(0xffe08a, 1)
      for (const [cx, cy] of [[x + 3, y + 4], [x + w - 5, y + 4], [x + 3, y + h - 5], [x + w - 5, y + h - 5]] as const) g.fillRect(cx, cy, 2, 2)
      overlay.add(g)
    }
    // Title
    const title = this.add
      .text(0, -H / 2 + 34, `${['', '第一關', '第二關', '第三關', '第四關', '第五關'][this.stageNo] ?? '第一關'}　通關！`, {
        fontFamily: FONT_TITLE,
        fontSize: '28px',
        color: '#ffd76a',
        stroke: '#3a1408',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScale(0.4)
    overlay.add(title)
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.out' })
    // Cast panel (left)
    lacquer(-W / 2 + 26, -H / 2 + 64, 250, 214)
    const castY = -H / 2 + 230
    const actor = (x: number, set: 'lunbo' | 'kibobo' | 'pupu', anim: string, fallback: string, flip = false) => {
      const ok = hasAnimSet(this, set)
      const sp = this.add.sprite(x, castY, ok ? animTex(set) : fallback).setOrigin(0.5, 1).setFlipX(flip)
      if (ok && this.anims.exists(`${set}-${anim}`)) sp.play({ key: `${set}-${anim}`, repeat: -1, repeatDelay: 500 })
      enableActorSprite(sp)
      overlay.add(sp)
      return sp
    }
    actor(-W / 2 + 90, 'lunbo', 'win', 'art-salmon')
    const kb = actor(-W / 2 + 160, 'kibobo', 'win', 'art-girl')
    const pu = actor(-W / 2 + 222, 'pupu', this.stageNo === 2 ? 'cute-pose' : 'idle', 'art-bear', true)
    if (this.stageNo === 1) pu.setTint(0x9a9aa4)
    this.tweens.add({ targets: pu, y: castY - 10, duration: 300, yoyo: true, repeat: -1, repeatDelay: 700, ease: 'Quad.out' })
    void kb
    overlay.add(
      this.add
        .text(
          -W / 2 + 151,
          castY + 18,
          // docs/bible/stages-3-5.md's own Pupu-recovery beats (顏色回復到X成 at each
          // stage), stage 5's line reusing the exact wording from the boss-defeat
          // floatText at line ~5398 ('噗噗醒咗一半，衝出嚟同主角合體！') rather than
          // inventing new story text — this panel was blank on stage 4/5 before
          // (Cursor's round-2 device pass caught it), same class of bug as the
          // earlier stage-5 title fix.
          ['', '第一罐真蜂蜜！噗噗隻耳郁咗', '第二罐真蜂蜜！噗噗識跳喇', '第三罐真蜂蜜！噗噗識行路', '第四罐真蜂蜜！噗噗識揮手', '第五罐真蜂蜜！噗噗醒咗一半，同你哋合體咗'][
            this.stageNo
          ] ?? '', {
          fontFamily: FONT_UI,
          fontSize: '10px',
          color: '#ffe9a8',
        })
        .setOrigin(0.5),
    )
    // Tally panel (right)
    const px = 14
    const py = -H / 2 + 64
    const pw = W / 2 - 40
    lacquer(px, py, pw, 214)
    const timeSec = Math.max(0, ((this.clearAt || this.time.now) - this.startedAt) / 1000)
    const hpLeft = Math.max(0, this.boy.hp) + Math.max(0, this.girl?.hp ?? 0)
    const hpMax = MAX_HP * (this.girl ? 2 : 1)
    const timeBonus = Math.max(0, 1800 - Math.floor(timeSec * 4))
    const rows: Array<{ label: string; detail: string; pts: number }> = [
      { label: '基本分', detail: '', pts: 1000 },
      { label: '時間', detail: `${Math.floor(timeSec / 60)}:${String(Math.floor(timeSec % 60)).padStart(2, '0')}`, pts: timeBonus },
      { label: '真蜂蜜', detail: `${this.honeyGot} / 3`, pts: this.honeyGot * 300 },
      { label: '剩餘生命', detail: `♥ ${hpLeft}`, pts: hpLeft * 150 },
      { label: '擊倒', detail: '', pts: this.killBonus },
      ...(ST.friends?.length
        ? [{ label: '小朋友', detail: `${this.friendsSaved.length} / ${ST.friends.length}`, pts: this.friendsSaved.length * 400 }]
        : []),
      { label: '續關', detail: `× ${this.deaths}`, pts: -this.deaths * 200 },
    ]
    const total = Math.max(0, rows.reduce((a, r) => a + r.pts, 0))
    const rowH = rows.length > 6 ? 19 : 22
    const best = loadScores()[0]
    const record = !!best && best.score <= total
    const rowTexts: Phaser.GameObjects.Text[] = []
    rows.forEach((r, i) => {
      const y = py + 18 + i * rowH
      const l = this.add.text(px + 14, y, r.label, { fontFamily: FONT_UI, fontSize: '11px', color: '#e8d8b0' }).setAlpha(0)
      const d = this.add.text(px + 104, y, r.detail, { fontFamily: FONT_UI, fontSize: '11px', color: '#a89878' }).setAlpha(0)
      const v = this.add
        .text(px + pw - 14, y, '0', { fontFamily: FONT_UI, fontSize: '11px', color: r.pts < 0 ? '#ff8a6a' : '#ffe9a8' })
        .setOrigin(1, 0)
        .setAlpha(0)
      overlay.add([l, d, v])
      rowTexts.push(l, d, v)
    })
    const lineY = py + 18 + rows.length * rowH + 2
    const line = this.add.rectangle(px + 14, lineY, pw - 28, 1, 0xc8902a).setOrigin(0).setAlpha(0)
    const totL = this.add.text(px + 14, lineY + 8, '合計', { fontFamily: FONT_UI, fontSize: '14px', color: '#ffd76a' }).setAlpha(0)
    const totV = this.add
      .text(px + pw - 14, lineY + 6, '0', { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 3 })
      .setOrigin(1, 0)
      .setAlpha(0)
    const rank = this.clearRank(hpLeft, hpMax)
    const rankCol = { S: '#ffd040', A: '#ff8a5a', B: '#8ad0ff', C: '#c0b0a0' }[rank]
    const stamp = this.add
      .text(px + 64, lineY + 38, rank, { fontFamily: FONT_TITLE, fontSize: '34px', color: rankCol, stroke: '#2a0e04', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAngle(-12)
      .setAlpha(0)
    const rec = this.add
      .text(px + pw - 70, lineY + 40, '★ 新紀錄！★', { fontFamily: FONT_UI, fontSize: '11px', color: '#ff6a8a', stroke: '#1a0608', strokeThickness: 3 })
      .setOrigin(0.5)
      .setAlpha(0)
    const rankL = this.add.text(px + 14, lineY + 32, '評級', { fontFamily: FONT_UI, fontSize: '11px', color: '#e8d8b0' }).setAlpha(0)
    rowTexts.push(rankL)
    overlay.add([line, totL, totV, stamp, rec, rankL])

    // Buttons (bottom): shop · next stage · menu. 片尾 only after the last stage.
    const btnY = H / 2 - 28
    const defs: Array<{ id: ClearAction; label: string; on: boolean }> = [
      { id: 'shop', label: '小朋友檔口 ◎', on: true },
      this.stageNo >= FINAL_STAGE
        ? { id: 'credits', label: '片尾字幕 ▶', on: true }
        : { id: 'next', label: STAGES[this.stageNo + 1] ? `前往第${'一二三四五'[this.stageNo]}關 ▶` : `第${'一二三四五'[this.stageNo]}關　製作中`, on: !!STAGES[this.stageNo + 1] },
      { id: 'menu', label: '返主選單', on: true },
    ]
    const gap = 8
    const widths = defs.map((d) => Math.max(104, d.label.length * 13 + 20))
    const rowW = widths.reduce((a, b) => a + b, 0) + gap * (defs.length - 1)
    let bx = -rowW / 2
    const buttons: ClearButton[] = []
    defs.forEach((d, i) => {
      const w = widths[i]!
      const cx = bx + w / 2
      bx += w + gap
      const bg = this.add.rectangle(cx, btnY, w, 26, 0x4a2a14, 1).setStrokeStyle(2, d.on ? 0xc8902a : 0x6a5a40)
      const tx = this.add
        .text(cx, btnY, d.label, { fontFamily: FONT_UI, fontSize: '12px', color: d.on ? '#ffe9a8' : '#8a7a60' })
        .setOrigin(0.5)
      overlay.add([bg, tx])
      bg.setAlpha(0.4)
      tx.setAlpha(0.4)
      if (d.on) bg.setInteractive({ useHandCursor: true })
      buttons.push({ id: d.id, bg, tx, on: d.on })
    })
    this.clearBtns = buttons
    this.clearSel = Math.max(0, buttons.findIndex((b) => b.id !== 'shop' && b.on))

    // ── Tally sequence (a press skips to the end) ──
    const timers: Phaser.Time.TimerEvent[] = []
    const showAll = () => {
      for (const t of timers) t.remove(false)
      rowTexts.forEach((t) => t.setAlpha(1))
      rows.forEach((r, i) => rowTexts[i * 3 + 2]!.setText(`${r.pts < 0 ? '−' : ''}${Math.abs(r.pts)}`))
      line.setAlpha(1)
      totL.setAlpha(1)
      totV.setAlpha(1).setText(String(total))
      stamp.setAlpha(1).setScale(1)
      if (record) {
        rec.setAlpha(1)
        this.tweens.add({ targets: rec, alpha: 0.3, duration: 300, yoyo: true, repeat: -1 })
      }
      for (const b of this.clearBtns) {
        b.bg.setAlpha(1)
        b.tx.setAlpha(1)
      }
      this.drawClearSel()
      this.tallyDone = true
    }
    this.finishTally = showAll
    let t0 = 700
    rows.forEach((r, i) => {
      timers.push(
        this.time.delayedCall(t0, () => {
          rowTexts.slice(i * 3, i * 3 + 3).forEach((t) => t.setAlpha(1))
          const v = rowTexts[i * 3 + 2]!
          const o = { n: 0 }
          this.tweens.add({
            targets: o,
            n: Math.abs(r.pts),
            duration: Math.min(500, 120 + Math.abs(r.pts) / 4),
            onUpdate: () => {
              v.setText(`${r.pts < 0 ? '−' : ''}${Math.round(o.n)}`)
              if (this.time.now % 3 < 1) SFX.tick()
            },
          })
          SFX.tick()
        }),
      )
      t0 += 380
    })
    timers.push(
      this.time.delayedCall(t0, () => {
        line.setAlpha(1)
        totL.setAlpha(1)
        totV.setAlpha(1)
        const o = { n: 0 }
        this.tweens.add({ targets: o, n: total, duration: 700, onUpdate: () => totV.setText(String(Math.round(o.n))) })
        SFX.coin()
      }),
    )
    timers.push(
      this.time.delayedCall(t0 + 900, () => {
        rankL.setAlpha(1)
        stamp.setAlpha(1).setScale(2.6)
        this.tweens.add({ targets: stamp, scale: 1, duration: 220, ease: 'Quad.in', onComplete: () => this.cameras.main.shake(160, 0.006) })
        SFX.stamp()
      }),
    )
    timers.push(this.time.delayedCall(t0 + 1300, showAll))
  }

  private win() {
    if (this.registry.get('winScreenShown')) return
    this.registry.set('winScreenShown', true)
    unlockStage(this.stageNo + 1)
    this.ended = true
    this.awaitingContinue = false
    // Drop story intro if still open so it never covers the clear card.
    this.storyIntro?.destroy()
    this.storyIntro = null
    this.physics.pause()
    this.boy.setVelocity(0, 0)
    this.girl?.setVelocity(0, 0)
    this.boy.setVisible(false)
    this.girl?.setVisible(false)
    this.pet?.setVisible(false)
    this.boyShadow?.setVisible(false)
    this.girlShadow?.setVisible(false)
    this.petShadow?.setVisible(false)
    this.sword?.setVisible(false)
    this.enemies?.setVisible(false)
    // Hide in-game HUD so only the clear screen shows.
    if (this.scene.isActive('UIScene')) this.scene.stop('UIScene')
    EventBus.emit(GameEvents.GAME_OVER, { active: false })

    stopBgm()
    SFX.continue()
    this.time.delayedCall(600, () => playSong('victory'))
    this.cameras.main.stopFollow()
    this.cameras.main.setScroll(0, 0)
    this.cameras.main.fadeIn(280, 255, 236, 180)

    this.buildClearCard()
    const overlay = this.clearOverlay!
    let left = false

    const leaveBy = (id: ClearAction) => {
      if (left || this.registry.get('leavingToMenu')) return
      if (id === 'shop') {
        // The stall sits on top of the clear card; the card is still there behind it.
        this.openGearShop(() => this.drawClearSel())
        return
      }
      left = true
      for (const b of this.clearBtns) b.bg.disableInteractive()
      offKeys()
      this.resetPauseKeys()
      if (id === 'menu') this.goMenu()
      else if (id === 'credits') this.goCredits()
      else this.goNextStage()
    }
    /** Enter / Start: finish the tally first, then run the highlighted button. */
    const activate = () => {
      if (!this.tallyDone) {
        this.finishTally?.()
        return
      }
      const b = this.clearBtns[this.clearSel]
      if (b?.on) leaveBy(b.id)
    }
    const move = (d: number) => {
      if (!this.tallyDone || !this.clearBtns.length) return
      for (let i = 0; i < this.clearBtns.length; i++) {
        this.clearSel = (this.clearSel + d + this.clearBtns.length) % this.clearBtns.length
        if (this.clearBtns[this.clearSel]?.on) break
      }
      SFX.blip(520)
      this.drawClearSel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) move(-1)
      else if (['ArrowRight', 'KeyD'].includes(e.code)) move(1)
      else if (['Enter', 'Space', 'KeyF', 'KeyJ', 'KeyK', 'KeyR'].includes(e.code)) activate()
    }
    const offKeys = () => this.input.keyboard?.off('keydown', onKey)
    this.input.keyboard?.on('keydown', onKey)
    this.events.once('shutdown', offKeys)
    this.clearCardAction = activate
    this.clearCardMove = move
    this.clearBtns.forEach((b, i) => {
      if (!b.on) return
      b.bg.on('pointerover', () => {
        this.clearSel = i
        this.drawClearSel()
      })
      b.bg.on('pointerup', () => {
        this.clearSel = i
        leaveBy(b.id)
      })
      b.tx.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.clearSel = i
        leaveBy(b.id)
      })
    })
    overlay.add(
      this.add
        .text(0, GAME_H / 2 - 8, '←→ 揀　Enter／攻擊　確定', { fontFamily: FONT_UI, fontSize: '9px', color: '#a08a70' })
        .setOrigin(0.5),
    )
    const toMenu = () => {
      if (left) return
      left = true
      this.goMenu()
    }
    this.input.keyboard?.once('keydown-ESC', toMenu)
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', toMenu))
  }

  private lose(msg: string) {
    this.ended = true
    this.deaths += 1
    SFX.lose()
    if (this.coinStock > 0) {
      this.awaitingContinue = true
      this.boy.awaitingContinue = true
      if (this.girl) this.girl.awaitingContinue = true
      const msgText =
        `${msg}\n\n◆ 投幣續關 ◆\n剩餘幣 ×${this.coinStock}\n` +
        `Enter／Ｃ／手掣 Start／點呢度　投幣\nＲ　回選單`
      EventBus.emit(GameEvents.GAME_OVER, {
        active: true,
        message: msgText,
        canContinue: true,
        win: false,
      })
    } else {
      this.awaitingContinue = false
      this.boy.awaitingContinue = false
      if (this.girl) this.girl.awaitingContinue = false
      EventBus.emit(GameEvents.GAME_OVER, {
        active: true,
        message: `${msg}\n◆ 幣已用盡 ◆\nＲ／手掣 Start／點呢度　回選單`,
        canContinue: false,
        win: false,
      })
    }
  }

  /** Public for smoke / continue path — spends one coin and respawns on mid lane. */
  insertCoinContinue() {
    if (!this.awaitingContinue || this.coinStock <= 0) return
    this.coinStock -= 1
    const w: Who = (this.purse.girl ?? 0) > (this.purse.boy ?? 0) ? 'girl' : 'boy'
    this.purse[w] = Math.max(0, (this.purse[w] ?? 0) - 1)
    this.refreshCoins()
    SFX.coin()
    SFX.continue()
    this.awaitingContinue = false
    this.ended = false
    EventBus.emit(GameEvents.GAME_OVER, { active: false })

    const cx = Phaser.Math.Clamp(this.checkpointX - 40, 100, WORLD_W - 200)
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h)
    for (const h of heroes) {
      h.awaitingContinue = false
      h.lane = LANE_DEFAULT
      reviveActor(h, cx + (h.role === 'girl' ? 60 : 0), laneY(LANE_DEFAULT), this.time.now, 2000)
      h.snapToLane(LANE_DEFAULT, h.x)
    }
    this.emitHealth()
    floatText(this, this.boy.x, this.boy.y - 50, '續關！', '#ffe08a')
    this.emitScore('投幣續關！短暫無敵　繼續奪蜜')
    this.cameras.main.flash(200, 255, 220, 100)
  }

  private refreshCoins() {
    this.emitScore()
  }

  private refreshHearts() {
    this.emitHealth()
  }


  private placeSurfaceTile(x: number, surfaceY: number, tex: string) {
    const t = this.ground.create(Math.round(x), Math.round(surfaceY), tex) as Phaser.Physics.Arcade.Sprite
    t.setOrigin(0, 0)
    t.setScale(1)
    t.setAngle(0)
    t.refreshBody()
    t.setDepth(DEPTH.GROUND)
    enablePixelSprite(t)
    return t
  }

  /** Full-width ground: left-origin tiles on integer stride — no mid-gap 斷開. */
  private layGroundRibbon(surfaceY: number) {
    const tex = this.tree && this.textures.exists('s2-bark-ground')
      ? 's2-bark-ground'
      : this.market && this.textures.exists('s3-market-ground')
        ? 's3-market-ground'
        : this.textures.exists('tile-ground-top')
        ? 'tile-ground-top'
        : this.textures.exists('blk-grass') ? 'blk-grass' : 'til-grass'
    const stride = this.textures.exists(tex) ? this.textures.get(tex).get().width : 32
    const pits = terrainPits()
    for (let x = 0; x < WORLD_W + stride; x += stride) {
      // Cut the ribbon at pits: one cropped copy of the tile per piece left between pits
      // (a wide tile can hold a whole pit — the ground after it must still be drawn).
      let segs: Array<[number, number]> = [[x, x + stride]]
      for (const p of pits) {
        segs = segs.flatMap(([a0, a1]): Array<[number, number]> => {
          if (p.x1 <= a0 || p.x0 >= a1) return [[a0, a1]]
          const out: Array<[number, number]> = []
          if (p.x0 > a0) out.push([a0, p.x0])
          if (p.x1 < a1) out.push([p.x1, a1])
          return out
        })
      }
      for (const [x0, x1] of segs) {
        if (x1 - x0 < 1) continue
        const t = this.placeSurfaceTile(x, surfaceY, tex)
        if (x0 !== x || x1 !== x + stride) {
          t.setCrop(x0 - x, 0, x1 - x0, t.height)
          const b = t.body as Phaser.Physics.Arcade.StaticBody
          b.setSize(x1 - x0, t.height, false)
          b.setOffset(x0 - x, 0)
        }
      }
    }
  }

  private spikes(x: number, n: number) {
    const tex = this.textures.exists('blk-spike') ? 'blk-spike' : 'til-spike'
    const stride = this.textures.exists(tex) ? this.textures.get(tex).get().width : 24
    for (let i = 0; i < n; i++) {
      const s = this.hazards.create(
        Math.round(x + i * stride + stride / 2),
        Math.round(LANE_FLOOR_Y + 4),
        tex,
      ) as Phaser.Physics.Arcade.Sprite
      s.setOrigin(0.5, 0)
      s.setScale(1)
      s.setAngle(0)
      s.refreshBody()
      s.setDepth(DEPTH.HAZARD)
      s.setData('hazardKind', 'spike')
      enablePixelSprite(s)
    }
  }

  /** 榴槤陷阱 — 主角踩到會拮腳，減 1 格生命 */
  private placeDurian(x: number) {
    const tex = this.textures.exists('hazard-durian') ? 'hazard-durian' : 'blk-spike'
    const s = this.hazards.create(
      Math.round(x),
      Math.round(LANE_FLOOR_Y + 2),
      tex,
    ) as Phaser.Physics.Arcade.Sprite
    s.setOrigin(0.5, 1)
    s.setScale(PROP_DISPLAY_SCALE)
    s.refreshBody()
    // Fair hitbox: only the spiky core (≈55% wide, lower half) — grazing the edge doesn't count.
    {
      const b = s.body as Phaser.Physics.Arcade.StaticBody
      const w = Math.round(s.displayWidth * 0.55)
      const h = Math.round(s.displayHeight * 0.5)
      b.setSize(w, h)
      b.setOffset((s.displayWidth - w) / 2, s.displayHeight - h)
    }
    s.setDepth(DEPTH.HAZARD)
    s.setData('hazardKind', 'durian')
    enablePixelSprite(s)
  }

  /**
   * 分段出場：開場冇怪 → 行一段先出第一波 → 清完先解鎖右手邊後續波。
   * unlockX = 玩家 leadX 達到才啟用（inactive 直到解鎖）。
   */
  private placeEnemies() {
    // data/levels/stage1.json — each enemy walks in from the screen edge once lead ≥ unlockX.
    // 單打少啲怪，雙打多啲 (Alan, 2026-10-27): one hero drops every 4th enemy past the first
    // wave; two heroes get an extra copy of every 3rd, a little behind it.
    const solo = this.mode === '1p'
    const place = (en: Stage1['enemies'][number], dx = 0) => {
      if (['bee', 'squirrel', 'lobster', 'stallkeeper', 'mirrorshade', 'honeyzombie', 'taximonster', 'clockpunch'].includes(en.species)) {
        this.s2Pending.push({ x: en.x + dx, species: en.species, unlockX: en.unlockX, elite: en.elite })
        return
      }
      const kind = (en.kind ?? 'chaser') as EnemyKind
      const sp = en.species as EnemySpecies
      const guard = kind === 'guardian' ? en.x + dx : undefined
      const e = this.mkEnemy(en.x + dx, GROUND_Y, kind, guard, sp, 0)
      if (en.elite) {
        e.markElite()
        e.setData('spdMul', ((e.getData('spdMul') as number) ?? 1) * 1.15)
      }
      this.deferEnemy(e, en.unlockX, en.unlockX <= 400 ? 'wave1' : 'later')
    }
    let n = 0
    for (const en of ST.enemies) {
      n++
      // Never thin out the first wave — that is the stage teaching you.
      if (solo && en.unlockX > 400 && n % 4 === 0) continue
      place(en)
      if (!solo && n % 3 === 0) place(en, 58)
    }
    for (const en of ST.altarAmbush) {
      const a = this.mkEnemy(en.x, GROUND_Y, 'ambusher', undefined, en.species as EnemySpecies, 0)
      a.altarAmbush = true
      this.deferEnemy(a, ST.altarTriggerX - 120, 'altar')
    }
  }

  private deferEnemy(e: PatrolEnemy, unlockX: number, wave: string) {
    e.setData('unlockX', unlockX)
    e.setData('wave', wave)
    e.setActive(false)
    e.setVisible(false)
    e.setAlpha(1)
    // Weapon is a separate Image — must hide with the body or it floats alone / looks "missing".
    e.weapon?.setVisible(false)
    e.weapon?.setActive(false)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.enable = false
  }

  /** Every 3–4s, briefly freeze one live enemy (others keep walking in). */
  private tickEnemyStagger(dt: number) {
    this.enemyStaggerCd -= dt
    if (this.enemyStaggerCd > 0) return
    this.enemyStaggerCd = Phaser.Math.Between(ENEMY_STAGGER_EVERY_MIN_MS, ENEMY_STAGGER_EVERY_MAX_MS)
    const live = this.enemies.getChildren().filter((o) => {
      const e = o as PatrolEnemy
      return e instanceof PatrolEnemy && e.active && e.fsm !== 'DEAD' && e.fsm !== 'HURT'
    }) as PatrolEnemy[]
    if (!live.length) return
    const pick = live[Phaser.Math.Between(0, live.length - 1)]
    pick.staggerUntil = this.time.now + Phaser.Math.Between(ENEMY_STAGGER_HOLD_MIN_MS, ENEMY_STAGGER_HOLD_MAX_MS)
    pick.setVelocityX(0)
    pick.setTint(0xaaccff)
  }

  private activateDeferredEnemies() {
    const lead = this.leadX()
    const cam = this.cameras.main
    const elapsed = this.started ? this.time.now - this.startedAt : 0
    const allowLeft = elapsed >= 10_000
    const wave1Alive = this.enemies.getChildren().some((o) => {
      const e = o as PatrolEnemy
      return e.active && e.getData('wave') === 'wave1' && e.fsm !== 'DEAD'
    })
    const wave1Pending = this.enemies.getChildren().some((o) => {
      const e = o as PatrolEnemy
      return !e.active && e.getData('wave') === 'wave1' && e.fsm !== 'DEAD'
    })
    // Don't soft-lock later waves forever if wave1 stalls off-screen — open after 12s.
    const wave1GateOpen = !(wave1Alive || wave1Pending) || elapsed >= 12_000
    let stagger = 0
    this.enemies.getChildren().forEach((o) => {
      const e = o as PatrolEnemy
      if (!(e instanceof PatrolEnemy)) return
      if (e.active || e.fsm === 'DEAD') return
      const unlock = (e.getData('unlockX') as number) ?? 0
      const wave = e.getData('wave') as string
      if (lead < unlock) return
      if (wave !== 'wave1' && !wave1GateOpen) return
      // 開始 10 秒後：左右兩邊都可走入；之前淨係右邊。
      // Altar ambushers always come from the honey tree side — the moving-plank pit sits behind the hero.
      const fromLeft = allowLeft && stagger % 2 === 1 && wave !== 'altar'
      let enterX = fromLeft
        ? Math.max(24, cam.scrollX - 48 - stagger * 36)
        : wave === 'altar'
          ? WORLD_W - 30 - (stagger % 4) * 46
          : Math.min(WORLD_W - 24, cam.scrollX + cam.displayWidth + 48 + stagger * 140)
      stagger += 1
      if (terrainEnabled()) enterX = this.nearestBaseFloorX(enterX, fromLeft ? 1 : -1)
      const enterY = laneY(e.lane)
      e.setPosition(enterX, enterY)
      e.homeX = enterX
      e.homeY = enterY
      e.desiredLane = e.lane
      e.laneSliding = false
      e.patrolMin = enterX - 40
      e.patrolMax = enterX + 40
      e.setActive(true)
      e.setVisible(true)
      e.setAlpha(1)
      e.clearTint()
      e.setScale(e.baseScale || 1)
      e.setDepth(actorDepth('enemy', e.lane, enterY))
      e.weapon?.setVisible(true)
      e.weapon?.setActive(true)
      e.weapon?.setAlpha(1)
      const body = e.body as Phaser.Physics.Arcade.Body
      body.enable = true
      body.allowGravity = false
      body.velocity.y = 0
      e.earlyAggro = true
      e.detectRadius = 1200
      e.aggroRadius = 1200
      e.setFsm('CHASE')
      if (fromLeft) {
        e.setFlipX(false)
        e.setVelocityX(ENEMY_SPEED)
        e.patrolDir = 1
      } else {
        e.setFlipX(true)
        e.setVelocityX(-ENEMY_SPEED)
        e.patrolDir = -1
      }
      // Pull weapon onto body immediately (was left at spawn X → "invisible" fights).
      e.syncWeaponPublic()
      if (wave === 'wave1' && !this.registry.get('wave1Announced')) {
        this.registry.set('wave1Announced', true)
        floatText(this, cam.scrollX + GAME_W / 2, L(120), '傀儡來襲！', '#ff6644')
      }
    })
  }

  /** Closest x (stepping inward) whose base floor exists — enemies never spawn over pits / in steps. */
  private nearestBaseFloorX(x: number, inwardDir: number): number {
    for (let i = 0; i < 80; i++) {
      const xx = x + inwardDir * i * 8
      if (supportTopAt(xx, LANE_FLOOR_Y, 20) !== null) return xx
    }
    return x
  }

  /** Wake altar ambushers — they already enter from the right; just harden chase. */
  private triggerAltarAmbush() {
    this.altarAmbushOn = true
    this.showWarning()
    // Stage 1 has no boss: the card explains who sent the ambush, then play resumes.
    this.physics.pause()
    for (const h of [this.boy, this.girl]) h?.setVelocity(0, 0)
    const card = playBossCard(this, 'altar', () => {
      if (this.storyIntro === card) this.storyIntro = null
      if (this.ended || !this.scene.isActive()) return
      this.physics.resume()
      this.resetPauseKeys()
      this.pauseReadyAt = this.time.now + 800
    })
    this.storyIntro = card
    SFX.boss()
    playSong('ambush')
    this.cameras.main.flash(160, 255, 120, 80)
    this.emitScore('蜂巢伏兵！疾風桶突襲')
    floatText(this, this.cameras.main.scrollX + GAME_W / 2, L(120), '蜂巢伏兵！', '#ff6644')
    this.enemies.getChildren().forEach((o) => {
      const e = o as PatrolEnemy
      if (!e.active || !e.altarAmbush || e.fsm === 'DEAD') return
      e.setTint(0xff2222)
      e.setFsm('CHASE')
      e.setVelocityX(-ENEMY_SPEED)
      impactRing(this, e.x, e.y - 20, 0xff5533, 16)
    })
  }

  /** SNES boss alarm: red bands, scrolling WARNING, siren. Calls onDone after ~2.2 s. */
  private showWarning(onDone?: () => void) {
    const root = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 200)
    const tint = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0)
    root.add(tint)
    this.tweens.add({ targets: tint, fillAlpha: 0.22, duration: 270, yoyo: true, repeat: 3 })
    for (const y of [GAME_H / 2 - 34, GAME_H / 2 + 22]) {
      const band = this.add.rectangle(0, y, GAME_W, 12, 0xc81818, 0.92).setOrigin(0)
      root.add(band)
      for (let i = 0; i < 12; i++) {
        const t = this.add
          .text(i * 70, y + 6, '▲ WARNING ', { fontFamily: FONT_UI, fontSize: '9px', color: '#ffe0e0' })
          .setOrigin(0, 0.5)
        root.add(t)
        this.tweens.add({ targets: t, x: t.x - 70, duration: 600, repeat: -1 })
      }
    }
    const big = this.add
      .text(GAME_W / 2, GAME_H / 2 - 6, 'WARNING', {
        fontFamily: FONT_TITLE,
        fontSize: '34px',
        color: '#ff3a2a',
        stroke: '#2a0606',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
    root.add(big)
    this.tweens.add({ targets: big, alpha: 0.25, duration: 180, yoyo: true, repeat: 5 })
    SFX.siren()
    this.cameras.main.shake(300, 0.004)
    this.time.delayedCall(2200, () => {
      root.destroy(true)
      onDone?.()
    })
  }

  // ── Stage 2 · 蜜樹丘 ─────────────────────────────────────────────────────

  private tickStage2(dt: number) {
    this.s2world?.update(dt)
    const lead = this.leadX()
    const cam = this.cameras.main
    let k = 0
    // Bees / squirrels walk (or fly) in from the right edge once the lead passes unlockX.
    this.s2Pending = this.s2Pending.filter((p) => {
      if (this.bossFight) return false
      if (lead < p.unlockX) return true
      let x = Math.min(WORLD_W - 24, Math.max(p.x, cam.scrollX + cam.displayWidth + 24 + k * 38))
      k++
      if (p.species === 'squirrel' || p.species === 'lobster') x = this.nearestBaseFloorX(x, -1)
      if (p.species === 'stallkeeper') x = p.x
      this.spawnS2(p.species, x, p.elite)
      return false
    })
    const b = ST.boss
    if (b && !this.bossFight && lead >= b.triggerX) this.startQueenFight()
    if (this.bossFight && b) {
      for (const h of [this.boy, this.girl]) {
        if (!h) continue
        const x = Phaser.Math.Clamp(h.x, b.arenaX0 + 14, b.arenaX1 - 14)
        if (x !== h.x) {
          h.x = x
          ;(h.body as Phaser.Physics.Arcade.Body).velocity.x = 0
        }
      }
    }
    this.updateBossBar()
  }

  private s2Hooks(): Stage2Hooks {
    return {
      floorY: () => LANE_FLOOR_Y,
      spawnCoin: (cx, cy) => this.spawnCoin(cx, cy),
      spawnMiniBee: (x, y, dir) => {
        if (this.ended) return
        this.addS2Enemy(new MiniBee(this, x, y, dir, this.s2Hooks()))
      },
      spawnEgg: (x) => {
        if (this.ended) return
        const egg = this.addS2Enemy(new HoneyEgg(this, x, this.s2Hooks()))
        egg.y = -10
        this.tweens.add({ targets: egg, y: LANE_FLOOR_Y, duration: 420, ease: 'Bounce.out' })
      },
      spray: (x, _y, dir) => this.s2world?.spray(x, dir),
      bossEvent: (kind) => this.onQueenEvent(kind),
    }
  }

  private spawnS2(species: string, x: number, elite = false) {
    if (species === 'lobster') {
      const e = this.addS2Enemy(new LobsterGuard(this, x, this.s2Hooks())).setFlipX(true)
      if (elite) e.markElite()
      return
    }
    if (species === 'stallkeeper') {
      const k = new StallKeeper(this, x, this.s2Hooks(), { knife: (kx, ky, dir, high) => this.throwKnife(kx, ky, dir, high) })
      k.stall = this.stalls.find((st) => Math.abs(st.x - x) < 90) ?? null
      this.addS2Enemy(k).setFlipX(true)
      if (elite) k.markElite()
      return
    }
    if (species === 'mirrorshade') {
      const m = this.addS2Enemy(new MirrorShade(this, x, this.s2Hooks()))
      m.setFlipX(true)
      if (elite) m.markElite()
      m.onSplit = (fx) => {
        if (this.ended || this.bossFight) return
        const f = this.addS2Enemy(new MirrorShade(this, fx, this.s2Hooks(), true))
        f.setFlipX(m.flipX)
        playFx(this, 'enemy-poof', fx, LANE_FLOOR_Y - 20)
        floatText(this, m.x, m.y - 60, '分身！睇地下倒影', '#c8d0ff', { size: 11, dur: 900 })
      }
      return
    }
    if (species === 'honeyzombie') {
      const z = new HoneyZombie(this, x, this.s2Hooks())
      z.onSplatter = (sx) => this.honeySplat(sx)
      this.addS2Enemy(z).setFlipX(true)
      if (elite) z.markElite()
      return
    }
    if (species === 'taximonster') {
      const t = this.addS2Enemy(new TaxiMonster(this, x, this.s2Hooks())).setFlipX(true)
      if (elite) t.markElite()
      return
    }
    if (species === 'clockpunch') {
      const c = this.addS2Enemy(new ClockPunch(this, x, this.s2Hooks(), { burst: (bx, by) => this.clockBurst(bx, by) })).setFlipX(true)
      if (elite) c.markElite()
      return
    }
    const e = species === 'bee' ? new BeeSoldier(this, x, this.s2Hooks()) : new HoneySquirrel(this, x, this.s2Hooks())
    this.addS2Enemy(e)
    e.setFlipX(true)
    if (elite) e.markElite()
  }

  /** 蜜僵 hit: a decorative splat of fake honey underfoot — visual only, no sticky floor. */
  private honeySplat(x: number) {
    const y = LANE_FLOOR_Y + 2
    if (this.anims.exists('fxa-honey-puddle')) {
      const sp = this.add.sprite(x, y, 'fxa-honey-puddle').setOrigin(0.5, 1).setDepth(DEPTH.GROUND + 5)
      sp.play('fxa-honey-puddle')
      this.time.delayedCall(2600, () => sp.destroy())
      return
    }
    const splat = this.add.ellipse(x, y, 26, 7, 0xd8a040, 0.55).setDepth(DEPTH.GROUND + 5)
    this.tweens.add({ targets: splat, alpha: 0, delay: 1800, duration: 500, onComplete: () => splat.destroy() })
  }

  /** 打卡鐘怪 countdown finishes: a harmless radial burst of flying paperwork. */
  private clockBurst(x: number, y: number) {
    SFX.sparkle()
    this.cameras.main.flash(80, 255, 240, 210)
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const key = this.textures.exists('s4-paper') ? 's4-paper' : 'coin'
      const p = this.add.image(x, y, key).setDepth(DEPTH.FX - 1).setTint(0xf0e8d0).setScale(0.6)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * 46,
        y: y + Math.sin(a) * 46,
        angle: 240,
        alpha: 0,
        duration: 480,
        ease: 'Quad.out',
        onComplete: () => p.destroy(),
      })
    }
    floatText(this, x, y - 30, '文件飛散！', '#ffe9c0', { size: 11, dur: 700 })
  }

  // ── Stage 3 · 月影夜市 ───────────────────────────────────────────────────

  private tickStage3(dt: number) {
    this.s3world?.update(dt)
    // Market street → hot springs: the far painting cross-fades past the creek bridge.
    const cx = this.cameras.main.scrollX
    const k = Phaser.Math.Clamp((cx - 2080) / 260, 0, 1)
    this.marketFar.market?.setAlpha(1 - k)
    this.marketFar.spring?.setAlpha(k)
    if (this.bushStrip) this.bushStrip.setAlpha(1 - k)
    this.tickStage2(dt)
  }

  // ── Stage 4 · 鹽霧工地 ───────────────────────────────────────────────────

  private tickStage4(dt: number) {
    this.s4world?.update(dt)
    this.tickStage2(dt)
  }

  // ── Stage 5 · △畝大廈 ────────────────────────────────────────────────────
  // "混合" stage: reuses every earlier world wholesale (their per-hero call sites — slip(),
  // push(), the windVent lift — are already theme-agnostic) and only adds the conveyor belt
  // (Stage5World.push, wired into steerHero) and the one-shot hot-spring heal below.

  private tickStage5(dt: number) {
    this.s3world?.update(dt)
    this.s4world?.update(dt)
    this.s5world?.update(dt)
    this.tickHotSprings()
    // Office interior → rooftop sunset: the far painting crossfades on approach to the boss gate.
    const triggerX = ST.boss?.triggerX ?? 99999
    const cx = this.cameras.main.scrollX
    const k = Phaser.Math.Clamp((cx - (triggerX - 360)) / 260, 0, 1)
    this.towerFar.hq?.setAlpha(1 - k)
    this.towerFar.roof?.setAlpha(k)
    this.tickStage2(dt)
  }

  /** Boss-前温泉：一次性全回血，過咗就唔再觸發 (data/levels/stage5.json hotSprings). */
  private tickHotSprings() {
    for (const hs of ST.hotSprings ?? []) {
      if (this.hotSpringsDone.has(hs.x)) continue
      const near = [this.boy, this.girl].some((h) => h?.alive && Math.abs(h.x - hs.x) < 40)
      if (!near) continue
      this.hotSpringsDone.add(hs.x)
      this.fullHeal()
    }
  }

  private fullHeal() {
    for (const h of [this.boy, this.girl]) {
      if (!h) continue
      const who = h.role as Who
      h.hp = MAX_HP + bonusHearts(who)
      h.stam = stamMax(who)
      burst(this, h.x, h.y - 30, 0x5ad0ff, 14)
    }
    this.refreshHearts()
    SFX.sparkle()
    floatText(this, this.boy?.x ?? this.leadX(), LANE_FLOOR_Y - 140, '溫泉回復！全回血！', '#9ad8ff', { size: 14, dur: 1800 })
    this.cameras.main.flash(200, 150, 220, 255)
  }

  /** 泥鬃's nail-gun volley: alternates low (jump) / high (crouch), reusing 油甘魚's throw read. */
  private throwNail(x: number, feet: number, dir: 1 | -1, high: boolean) {
    if (this.ended) return
    const key = this.textures.exists('s4-nail') ? 's4-nail' : this.textures.exists('fx-rock') ? 'fx-rock' : 'coin'
    const shot = this.enemyShots.create(x, feet - (high ? 19 : 7), key) as Phaser.Physics.Arcade.Sprite
    shot.setDepth(DEPTH.FX - 2)
    enableActorSprite(shot)
    const body = shot.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(10, 6)
    shot.setVelocity(dir * 220, 0)
    shot.setData('lane', 0)
    shot.setData('dmg', 1)
    this.tweens.add({ targets: shot, angle: dir * 360, duration: 300, repeat: -1 })
    floatText(this, x, feet - 64, high ? '高！蹲' : '低！跳', '#ffb070', { size: 11, dur: 600 })
    this.entities.add(shot, 'projectile')
    this.time.delayedCall(1700, () => {
      if (shot.active) shot.destroy()
    })
  }

  /** 泥鬃's low mud wave ahead of a charge — purely telegraphs the charging body, no separate hit. */
  private mudWave(x0: number, x1: number, dir: 1 | -1) {
    SFX.siren()
    const y = LANE_FLOOR_Y + 3
    const wave = this.add.ellipse(dir > 0 ? x0 + 30 : x1 - 30, y, 70, 10, 0x4a3a28, 0.6).setDepth(DEPTH.GROUND + 4)
    this.tweens.add({ targets: wave, x: dir > 0 ? x1 - 30 : x0 + 30, alpha: 0, duration: 900, onComplete: () => wave.destroy() })
    this.cameras.main.shake(200, 0.003)
  }

  private mudHooks(): MudHooks {
    return {
      floorY: () => LANE_FLOOR_Y,
      mudWave: (x0, x1, dir) => this.mudWave(x0, x1, dir),
      spawnZombie: (x) => {
        if (this.ended || !this.bossFight) return
        const z = new HoneyZombie(this, x, this.s2Hooks())
        z.onSplatter = (sx) => this.honeySplat(sx)
        this.addS2Enemy(z)
      },
      nail: (x, y, dir, high) => this.throwNail(x, y, dir, high),
      bossEvent: (kind) => this.onQueenEvent(kind),
    }
  }

  /** △畝大佬's ceiling honey-rain (phase 1) — a handful of falling hazards, feather-rain style. */
  private honeyRain(x0: number, x1: number) {
    SFX.siren()
    const key = this.textures.exists('fx-honey') ? 'fx-honey' : 'coin'
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(x0 + 24, x1 - 24)
      const drop = this.enemyShots.create(x, 16, key) as Phaser.Physics.Arcade.Sprite
      drop.setDepth(DEPTH.FX - 2)
      enableActorSprite(drop)
      ;(drop.body as Phaser.Physics.Arcade.Body).allowGravity = false
      drop.setData('lane', 0)
      drop.setData('dmg', 1)
      drop.setVelocity(0, 0)
      this.entities.add(drop, 'projectile')
      this.time.delayedCall(Phaser.Math.Between(0, 320), () => drop.active && drop.setVelocity(0, 230))
      this.time.delayedCall(2800, () => drop.active && drop.destroy())
    }
  }

  /** △畝大佬's rooftop dozer: warning band, then a body sweeps the arena floor (jump it). */
  private dozerRun(x0: number, x1: number, dir: 1 | -1) {
    SFX.siren()
    const y = LANE_FLOOR_Y + 3
    const band = this.add.rectangle((x0 + x1) / 2, y, x1 - x0, 8, 0xff5030, 0.35).setDepth(DEPTH.GROUND + 4)
    floatText(this, dir > 0 ? x0 + 60 : x1 - 60, LANE_FLOOR_Y - 70, '推土機！跳！', '#ff9a6a', { size: 13, dur: 700 })
    this.tweens.add({ targets: band, alpha: 0, duration: 700, onComplete: () => band.destroy() })
    this.time.delayedCall(700, () => {
      if (this.ended || !this.bossFight) return
      this.cameras.main.shake(200, 0.004)
      const dozer = this.add.rectangle(dir > 0 ? x0 + 20 : x1 - 20, y - 12, 56, 26, 0x5a4a30, 0.9).setDepth(DEPTH.FX - 2)
      const hit = new Set<Hero>()
      this.tweens.add({
        targets: dozer,
        x: dir > 0 ? x1 - 20 : x0 + 20,
        duration: 1400,
        onUpdate: () => {
          for (const h of [this.boy, this.girl]) {
            if (!h || !h.alive || hit.has(h)) continue
            if (Math.abs(h.x - dozer.x) < 36 && h.y > LANE_FLOOR_Y - 22) {
              hit.add(h)
              this.hazardHit(h, { knockX: dir * 220, knockY: -320, label: '推土機 -1' })
            }
          }
        },
        onComplete: () => dozer.destroy(),
      })
    })
  }

  private triHooks(): TriHooks {
    return {
      floorY: () => LANE_FLOOR_Y,
      rain: (x0, x1) => this.honeyRain(x0, x1),
      spawnZombie: (x) => {
        if (this.ended || !this.bossFight) return
        const z = new HoneyZombie(this, x, this.s2Hooks())
        z.onSplatter = (sx) => this.honeySplat(sx)
        this.addS2Enemy(z)
      },
      bolt: (x, feet, dir, high, speed, lifeMs) => this.throwKnife(x, feet, dir, high, speed, lifeMs),
      dozerRun: (x0, x1, dir) => this.dozerRun(x0, x1, dir),
      replayQueen: (x) => this.s2Hooks().spawnEgg?.(x),
      replayOwl: (gapX) => this.owlHooks().feathers(gapX),
      bossEvent: (kind) => this.onQueenEvent(kind),
    }
  }

  /** 油甘魚攤主's kitchen knife: alternates low (jump) / high (crouch), spins. */
  private throwKnife(x: number, feet: number, dir: 1 | -1, high: boolean, speed = 180, lifeMs = 1900) {
    if (this.ended) return
    const key = this.textures.exists('s3-knife') ? 's3-knife' : this.textures.exists('fx-rock') ? 'fx-rock' : 'coin'
    const shot = this.enemyShots.create(x, feet - (high ? 19 : 7), key) as Phaser.Physics.Arcade.Sprite
    shot.setDepth(DEPTH.FX - 2)
    enableActorSprite(shot)
    const body = shot.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(10, 8)
    shot.setVelocity(dir * speed, 0)
    shot.setData('lane', 0)
    shot.setData('dmg', 1)
    this.tweens.add({ targets: shot, angle: dir * 360, duration: 360, repeat: -1 })
    floatText(this, x, feet - 64, high ? '高！蹲' : '低！跳', '#ffe08a', { size: 11, dur: 600 })
    this.entities.add(shot, 'projectile')
    this.time.delayedCall(lifeMs, () => {
      if (shot.active) shot.destroy()
    })
  }

  /** Stalls from stage3.json: breakable cover in front of each keeper. */
  private placeStalls() {
    this.stalls = []
    for (const st of ST.stalls ?? []) {
      const stall = new MarketStall(this, st.x, LANE_FLOOR_Y + 1)
      stall.setTint(0xb0a8c8)
      this.addS2Enemy(stall)
      stall.setDepth(DEPTH.PROP + 1)
      stall.onBroken = () => {
        SFX.kill()
        burst(this, stall.x, stall.y - 24, 0xd8a060, 12)
        floatText(this, stall.x, stall.y - 70, '個檔爛咗！', '#ffe08a', { size: 12, dur: 900 })
      }
      this.stalls.push(stall)
    }
  }

  private owlHooks(): OwlHooks {
    const b = ST.boss!
    return {
      floorY: () => LANE_FLOOR_Y,
      feathers: (gapX) => {
        // A row of feathers drifts down across the arena; walk into the gap.
        SFX.siren()
        for (let x = b.arenaX0 + 18; x < b.arenaX1 - 10; x += 26) {
          if (Math.abs(x - gapX) < 44) continue
          const key = this.textures.exists('s3-feather') ? 's3-feather' : 'coin'
          const f = this.enemyShots.create(x + Phaser.Math.Between(-4, 4), 40, key) as Phaser.Physics.Arcade.Sprite
          f.setDepth(DEPTH.FX - 2).setAngle(160)
          ;(f.body as Phaser.Physics.Arcade.Body).allowGravity = false
          ;(f.body as Phaser.Physics.Arcade.Body).setSize(8, 14)
          f.setVelocity(0, 0)
          f.setData('dmg', 1)
          this.entities.add(f, 'projectile')
          this.time.delayedCall(450 + Phaser.Math.Between(0, 120), () => f.active && f.setVelocity(0, 150))
          this.tweens.add({ targets: f, angle: { from: 150, to: 210 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
          this.time.delayedCall(2600, () => f.active && f.destroy())
        }
        // Gap marker on the bridge so the safe spot reads.
        const m = this.add.ellipse(gapX, LANE_FLOOR_Y + 2, 70, 8, 0xfff0a0, 0.35).setDepth(DEPTH.GROUND + 4)
        this.tweens.add({ targets: m, alpha: 0, delay: 1600, duration: 400, onComplete: () => m.destroy() })
      },
      reflect: (x) => {
        // Wrong owl: its mirror flashes moonlight back at the nearest hero.
        const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h && h.alive)
        const h = heroes.sort((a, c) => Math.abs(a.x - x) - Math.abs(c.x - x))[0]
        this.cameras.main.flash(120, 220, 230, 255)
        floatText(this, x, LANE_FLOOR_Y - 90, '假身！反光！', '#c8d0ff', { size: 13, dur: 900 })
        if (!h) return
        const beam = this.add.line(0, 0, x, LANE_FLOOR_Y - 40, h.x, h.y - 24, 0xe8f0ff, 0.8).setOrigin(0).setDepth(DEPTH.FX).setLineWidth(3)
        this.tweens.add({ targets: beam, alpha: 0, duration: 260, onComplete: () => beam.destroy() })
        this.hazardHit(h, { knockX: (Math.sign(h.x - x) || 1) * 200, knockY: -320, label: '反光 -1' })
      },
      spawnDecoy: (x) => {
        const d = new OwlDecoy(this, x, LANE_FLOOR_Y - 40, this.s2Hooks())
        this.addS2Enemy(d)
        playFx(this, 'enemy-poof', x, LANE_FLOOR_Y - 60)
        return d
      },
      spawnCrate: (x) => {
        const c = new OwlCrate(this, x, LANE_FLOOR_Y + 1)
        this.addS2Enemy(c)
        return c
      },
      bossEvent: (kind) => this.onQueenEvent(kind),
    }
  }

  private addS2Enemy<T extends Phaser.Physics.Arcade.Sprite & { flying: boolean }>(e: T): T {
    this.enemies.add(e)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setVelocityY(0)
    this.entities.add(e as unknown as PatrolEnemy, 'enemy')
    addGroundShadow(this, e, (t) => (e.flying ? LANE_FLOOR_Y : this.groundYFor(t)), e.flying ? 0.4 : 0.65)
    // Difficulty HP scaling — every stage2-5 FSM enemy funnels through here right
    // after its constructor sets hp = maxHp = N, so this is the single injection
    // point (duck-typed: the generic signature doesn't guarantee hp/maxHp fields).
    const scalable = e as unknown as { hp?: number; maxHp?: number }
    if (typeof scalable.hp === 'number' && typeof scalable.maxHp === 'number') {
      const mul = difficultyHpMul(getDifficulty())
      if (mul !== 1) {
        scalable.maxHp = Math.max(1, Math.round(scalable.maxHp * mul))
        scalable.hp = scalable.maxHp
      }
    }
    return e
  }

  private startQueenFight() {
    const b = ST.boss!
    this.bossFight = true
    this.s2Pending = []
    // Stragglers don't follow into the throne room: they scatter in a puff.
    for (const o of [...this.enemies.getChildren()]) {
      const e = o as Phaser.Physics.Arcade.Sprite
      if (!e.active) continue
      playFx(this, 'enemy-poof', e.x, e.y - 20)
      e.disableBody(true, true)
      this.time.delayedCall(0, () => e.destroy())
    }
    // The arena is exactly one screen: lock the camera on it.
    this.cameras.main.setBounds(b.arenaX0, 0, b.arenaX1 - b.arenaX0, WORLD_H)
    stopBgm()
    this.physics.pause()
    for (const h of [this.boy, this.girl]) h?.setVelocity(0, 0)
    if (this.scene.isActive('UIScene')) this.scene.setVisible(false, 'UIScene')
    // Block play while the alarm runs (storyIntro stops update), then the reveal cutscene.
    this.storyIntro = { destroy: () => undefined }
    const kind = b.kind as string
    this.showWarning(() => {
      if (this.ended) return
      if (hasBossCard(kind)) {
        const card = playBossCard(this, kind, () => this.queenReveal(b))
        this.storyIntro = card
      } else {
        this.queenReveal(b)
      }
    })
  }

  /** 月橋鏡鴞 / 蜜冠女王蜂 / 泥鬃 — shared across the boss-reveal UI. */
  private bossName(): string {
    return this.tower ? '△畝大佬' : this.depot ? '泥鬃' : this.market ? '月橋鏡鴞' : '蜜冠女王蜂'
  }

  private queenReveal(b: NonNullable<Stage1['boss']>) {
    if (this.ended) return
    const reveal = () => {
      this.storyIntro = null
      if (this.ended) return
      this.physics.resume()
      if (this.scene.get('UIScene')) this.scene.setVisible(true, 'UIScene')
      this.resetPauseKeys()
      this.pauseReadyAt = this.time.now + 1200
      playSong(this.tower ? 'boss5' : this.depot ? 'boss4' : this.market ? 'boss3' : 'boss2')
      SFX.boss()
      const q = this.tower
        ? new TriBoss(this, b.arenaX1 - 150, b.arenaX0, b.arenaX1, this.triHooks())
        : this.depot
          ? new MudMane(this, b.arenaX1 - 150, b.arenaX0, b.arenaX1, this.mudHooks())
          : this.market
            ? new MirrorOwl(this, b.arenaX1 - 150, b.arenaX0, b.arenaX1, this.s2Hooks(), this.owlHooks())
            : new QueenBee(this, b.arenaX1 - 150, b.arenaX0, b.arenaX1, this.s2Hooks())
      q.onDefeated = () => this.queenDefeated()
      this.addS2Enemy(q)
      q.setFlipX(true)
      this.queen = q
      this.buildBossBar()
      floatText(this, this.cameras.main.scrollX + GAME_W / 2, 90, this.bossName(), this.tower ? '#ff6a4a' : this.depot ? '#ffb060' : this.market ? '#d8e0ff' : '#ffcc44', { size: 22, dur: 1600 })
      // Last-chance full heal: one 極上壽司船 near the arena entrance, before the boss.
      if (!this.bossSushiSpawned) {
        this.bossSushiSpawned = true
        this.spawnSushi(b.arenaX0 + 40, LANE_FLOOR_Y, 'deluxe')
      }
    }
    if (this.depot) {
      // No dedicated reveal cutscene for 泥鬃 yet — his 來歷卡 (bossCard) already told the story.
      this.storyIntro = { destroy: () => undefined }
      this.time.delayedCall(260, reveal)
      return
    }
    const handle = playCutscene(this, this.tower ? 'C10' : this.market ? 'B3' : 'B2', reveal)
    this.storyIntro = handle
  }

  private buildBossBar() {
    const w = 220
    const root = this.add.container(GAME_W / 2, 50).setScrollFactor(0).setDepth(DEPTH.UI + 30)
    const g = this.add.graphics()
    g.fillStyle(0xc8902a, 1).fillRect(-w / 2 - 2, -4, w + 4, 10)
    g.fillStyle(0x1c120c, 1).fillRect(-w / 2 - 1, -3, w + 2, 8)
    const fill = this.add.rectangle(-w / 2, -2, w, 6, 0xffb020).setOrigin(0, 0)
    const label = this.add
      .text(0, -6, this.bossName(), { fontFamily: FONT_UI, fontSize: '10px', color: '#ffe08a', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5, 1)
    root.add([g, fill, label])
    this.bossBar = { root, fill, w }
  }

  private updateBossBar() {
    const bar = this.bossBar
    const q = this.queen
    if (!bar || !q) return
    const f = Phaser.Math.Clamp(q.hp / q.maxHp, 0, 1)
    bar.fill.width = Math.round(bar.w * f)
    bar.fill.setFillStyle(q.qphase === 3 ? 0xff6030 : q.qphase === 2 ? 0xffa020 : 0xffd040)
  }

  private onQueenEvent(kind: 'phase2' | 'phase3' | 'weak' | 'finale' | 'defeat') {
    const cx = this.cameras.main.scrollX + GAME_W / 2
    if (kind === 'phase2') {
      SFX.boss()
      this.cameras.main.flash(160, 255, 200, 90)
      floatText(
        this,
        cx,
        96,
        this.tower ? '大屏幕播舊 Boss 招式——留神！推土機嚟喇！' : this.depot ? '佢企上高台——蜜僵同釘槍嚟喇！' : this.market ? '分身！睇水面倒影搵真身' : '佢落地生蛋！快啲打爛啲蛋！',
        '#ffe08a',
        { size: 16, dur: 2000 },
      )
    } else if (kind === 'phase3') {
      SFX.boss()
      this.cameras.main.flash(160, 255, 140, 60)
      floatText(
        this,
        cx,
        96,
        this.tower ? '三角盾開咗！等盾裂先打佢！' : this.depot ? '落車肉搏——打佢披風上嘅蜜印！' : this.market ? '佢守住蜜箱——打爛個箱！' : '小心！假蜜噴射——跳開！',
        '#ff9a3a',
        { size: 16, dur: 2000 },
      )
    } else if (kind === 'weak' && this.queen) {
      SFX.sparkle()
      floatText(this, this.queen.x, this.queen.y - 110, this.tower ? '盾裂咗！而家打！' : this.depot ? '弱點！而家打！' : this.market ? '暈咗！而家打！' : '頭頂發光——而家打！', '#fff0a0', { size: 13, dur: 1400 })
    } else if (kind === 'finale' && this.queen) {
      SFX.sparkle()
      this.cameras.main.flash(200, 255, 220, 160)
      floatText(this, this.queen.x, this.queen.y - 130, '噗噗醒咗一半，衝出嚟同主角合體！', '#ffd76a', { size: 15, dur: 2000 })
    } else if (kind === 'defeat') {
      SFX.kill()
      this.cameras.main.flash(300, 255, 250, 220)
      this.cameras.main.shake(400, 0.008)
      if (this.queen) floatText(this, this.queen.x, this.queen.y - 120, this.tower ? '面具甩咗！' : this.depot ? '披風甩咗！' : this.market ? '鏡面裂咗！' : '皇冠跌咗！', '#ffe08a', { size: 18, dur: 1800 })
      // Her swarm and eggs fall with her.
      for (const o of [...this.enemies.getChildren()]) {
        const e = o as PatrolEnemy
        if (o === this.queen || !e.active || e.fsm === 'DEAD') continue
        e.receiveHit(99, 1)
      }
      this.bossBar?.root.destroy()
      this.bossBar = null
    }
  }

  private queenDefeated() {
    if (this.ended) return
    const timeSec = (this.time.now - this.startedAt) / 1000
    this.scorePts =
      calcScore({ timeSec, honey: this.honeyGot, hpBoy: this.boy.hp, hpGirl: this.girl?.hp ?? 0, deaths: this.deaths }) +
      this.killBonus
    saveScore({ score: this.scorePts, timeSec, honey: this.honeyGot, mode: this.mode, at: Date.now() })
    this.time.delayedCall(600, () => this.playOutro())
  }

  /** Stage 1 clear card → straight into 蜜樹丘 (coins carry over). */
  /** On to the next stage: the world map, with the bike leg between stages 1 and 2. */
  private goNextStage() {
    if (this.registry.get('leavingToMenu')) return
    const to = this.stageNo + 1
    if (!STAGES[to]) return
    this.registry.set('leavingToMenu', true)
    this.registry.set('stageNo', to)
    this.registry.set('carryCoins', this.coinStock)
    this.registry.set('carryPurse', { ...this.purse })
    this.registry.set('winScreenShown', false)
    try {
      this.physics.resume()
    } catch {
      /* world already torn down */
    }
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => {
      this.registry.set('leavingToMenu', false)
      this.stopUi()
      const from = this.stageNo
      // Alan: let the player pick which unlocked stage to go to here, instead of
      // always auto-advancing into `to`.
      if (from === 1) this.scene.start('worldmap', { from, to, next: 'bike', pick: true })
      else this.scene.start('worldmap', { from, to, next: 'play', stageNo: to, pick: true })
    })
  }

  private mkEnemy(
    x: number,
    y: number,
    kind: EnemyKind,
    guardX?: number,
    species?: EnemySpecies,
    lane?: LaneId,
  ): PatrolEnemy {
    const e = PatrolEnemy.spawn(this, this.enemies, x, y, kind, {
      guardX,
      species,
      ground: this.ground,
      lane: lane !== undefined ? clampLane(lane) : undefined,
      hooks: {
        spawnCoin: (cx, cy) => this.spawnCoin(cx, cy),
        floatBang: (bx, by, msg) => floatText(this, bx, by, msg ?? '！', '#ff3333'),
        telegraph: (en, kindT) => {
          impactRing(
            this,
            en.x,
            en.y - 18,
            kindT === 'ambush' ? 0xff4422 : 0xffcc66,
            kindT === 'ambush' ? 18 : 14,
          )
          en.setTint(kindT === 'ambush' ? 0xff2222 : 0xff8866)
        },
        spawnProjectile: (en, dir) => {
          const pe = en as PatrolEnemy
          if (pe.species === 'barrel') this.spawnRock(pe, dir)
        },
      },
    })
    this.entities.add(e, 'enemy')
    addGroundShadow(this, e, (t) => this.groundYFor(t), 0.65)
    try {
      if (this.lights?.active) {
        const pipe = e as unknown as { setPipeline?: (n: string) => void }
        pipe.setPipeline?.('Light2D')
      }
    } catch {
      /* Light2D unavailable */
    }
    return e
  }

}
