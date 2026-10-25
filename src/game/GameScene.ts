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
import { SFX, startBgm, unlockAudio } from './audio'
import { calcScore, saveScore } from './score'
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
import { TouchInput } from './touchInput'
import { playStoryIntro } from './storyIntro'
import {
  WORLD_W,
  WORLD_H,
  GROUND_Y,
  LANE_DEFAULT,
  LANE_FLOOR_Y,
  LANE_Y,
  MAX_HP,
  BOY_SPEED,
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
  COINS_PER_HP,
  SWORD_HIT_W,
  SWORD_HIT_H,
  SWORD_HIT_MS,
  PET_FOLLOW_BEHIND,
  ACTOR_DISPLAY_SCALE,
  HERO_SIZE_MUL,
  GIRL_SCALE_MUL,
  PET_HEIGHT_FRAC,
  PROJ_DISPLAY_SCALE,
  PROP_DISPLAY_SCALE,
  SCENERY_DISPLAY_SCALE,
  BG_PALE_TINT,
  BG_MOUNT_TINT,
  BG_MOUNT_ALPHA,
  BG_MID_TINT,
  BG_NEAR_TINT,
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
  private petShadow: Phaser.GameObjects.Image | null = null
  /** 琪寶寶長劍（電風扇已 bake 喺角色背脊，唔再用獨立 fan sprite） */
  private sword: Phaser.GameObjects.Image | null = null
  /** 刺刺魚小彈 */
  private enemyShots!: Phaser.Physics.Arcade.Group
  private boyShadow!: Phaser.GameObjects.Image
  private girlShadow: Phaser.GameObjects.Image | null = null
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
  private keyW!: Phaser.Input.Keyboard.Key
  private keyA!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  /** SNES face: F=Y atk, G=B jump, T=X special, H=A unused */
  private keyF!: Phaser.Input.Keyboard.Key
  private keyG!: Phaser.Input.Keyboard.Key
  private keyT!: Phaser.Input.Keyboard.Key
  private keyH!: Phaser.Input.Keyboard.Key // A unused
  /** Legacy jump／special aliases */
  private keyK!: Phaser.Input.Keyboard.Key
  private keyU!: Phaser.Input.Keyboard.Key
  /** 2P SNES: ,=Y . =B ; =X / =A */
  private keyComma!: Phaser.Input.Keyboard.Key
  private keyPeriod!: Phaser.Input.Keyboard.Key
  private keySemicolon!: Phaser.Input.Keyboard.Key
  private keySlash!: Phaser.Input.Keyboard.Key // A unused
  private keyNP1!: Phaser.Input.Keyboard.Key
  private keyNP2!: Phaser.Input.Keyboard.Key
  private keyNP4!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private keyEnter!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyC!: Phaser.Input.Keyboard.Key
  private keyRShift!: Phaser.Input.Keyboard.Key // 2P Start
  private keyDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebugAlt!: Phaser.Input.Keyboard.Key
  private physicsDebug = false
  /** Honey special charges (max 1). */
  private specialCharges = 0
  private pad1: Phaser.Input.Gamepad.Gamepad | null = null
  private pad2: Phaser.Input.Gamepad.Gamepad | null = null
  /** Synced from UIScene for smoke / continue path. */
  banner!: Phaser.GameObjects.Text
  continueBox!: Phaser.GameObjects.Text
  private ended = false
  awaitingContinue = false
  started = false
  private startedAt = 0
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

  constructor() {
    // Scene key 'play' kept for smoke / MainMenu startMode compat.
    super('play')
  }

  create() {
    this.mode = (this.registry.get('playMode') as '1p' | '2p') || '2p'
    this.ended = false
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
    this.coinStock = COINS_START
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
    // Scene instances survive restart — reset debug before any frame can
    // hit World.postUpdate with a destroyed/null debugGraphic.
    this.resetPhysicsDebug(false)

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(350, 40, 100, 140)

    unlockAudio()
    startBgm()

    this.drawWorld()
    this.buildLevel()
    this.spawnCast()
    this.wirePhysics()
    this.setupCameraFollow()
    this.bindKeys()
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
    this.events.once('shutdown', this.onSceneShutdown, this)
  }

  private setupCameraFollow() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setRoundPixels(true)
    const startX = this.girl ? (this.boy.x + this.girl.x) / 2 : this.boy.x
    this.camTarget = this.add.zone(startX, WORLD_H / 2, 1, 1)
    this.cameras.main.startFollow(this.camTarget, true, 0.18, 0.18)
    this.cameras.main.setDeadzone(this.girl ? 90 : 120, 56)
  }

  /** 雙人：鏡頭跟中點；兩人可左右分邊，但唔准單獨行出畫面。 */
  private updateCameraFollow() {
    if (!this.camTarget || !this.boy) return
    if (this.girl && this.girl.active) {
      this.clampDuoToCamera()
      const midX = (this.boy.x + this.girl.x) / 2
      this.camTarget.setPosition(
        Math.round(Phaser.Math.Clamp(midX, 480, WORLD_W - 480)),
        WORLD_H / 2,
      )
    } else {
      this.camTarget.setPosition(
        Math.round(Phaser.Math.Clamp(this.boy.x, 480, WORLD_W - 480)),
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
    const right = cam.scrollX + cam.width - pad
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

  private onSceneShutdown() {
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
    this.scene.launch('UIScene', { mode: this.mode })
    this.events.once('shutdown', this.stopUi, this)
  }

  private stopUi() {
    if (this.scene.isActive('UIScene') || this.scene.isSleeping('UIScene')) {
      this.scene.stop('UIScene')
    }
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
    // 過場黑畫面至少 1 秒，再回選單
    const play = this
    try {
      play.cameras.main.fadeOut(1000, 0, 0, 0)
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
    }, 1000)
  }

  private emitHealth() {
    if (!this.boy) return
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      boyHp: Math.max(0, this.boy.hp),
      girlHp: Math.max(0, this.girl?.hp ?? 0),
      maxHp: MAX_HP,
    })
  }

  private emitScore(info?: string) {
    EventBus.emit(GameEvents.SCORE_UPDATED, {
      score: this.scorePts,
      coins: this.coinStock,
      special: this.specialCharges,
      honey: this.honeyGot,
      ...(info !== undefined ? { info } : {}),
    })
  }

  /** Fill 絕招 MP from eating／拾取蜂蜜（max 1 charge）. */
  private grantHoneySpecial(x: number, y: number, label = true) {
    this.honeyGot = Math.min(3, this.honeyGot + 1)
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
      else if (
        this.registry.get('winScreenShown') &&
        (Phaser.Input.Keyboard.JustDown(this.keyR) ||
          Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
          Phaser.Input.Keyboard.JustDown(this.keySpace) ||
          TouchInput.justPressed('start') ||
          TouchInput.justPressed('attack'))
      ) {
        this.goMenu()
      } else if (Phaser.Input.Keyboard.JustDown(this.keyR) || TouchInput.justPressed('start')) {
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

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) { this.stopUi(); this.scene.restart() }

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
    this.updateEnemies(dt)
    this.cullSalmonShots()
    this.entities.syncEnemiesFromGroup(this.enemies)
    this.syncFx()
    this.animateBg()
    this.tickAmbientCritters(dt)
    this.checkFall()
    this.updateCheckpoint()

    this.boyGoal = !!this.physics.overlap(this.boy, this.goal)
    this.girlGoal = this.mode === '1p' ? true : !!(this.girl && this.physics.overlap(this.girl, this.goal))

    this.tickStageBeats()

    // Altar climax: 2–3 barrel ambushers wake with clear telegraph before boss.
    if (!this.altarAmbushOn && this.leadX() > WORLD_W - 980) {
      this.triggerAltarAmbush()
    }

    if (!this.bossOn && this.leadX() > WORLD_W - 780) {
      this.bossOn = true
      this.spawnBoss(WORLD_W - 420, GROUND_Y)
      SFX.boss()
      this.emitScore('關底・三角傀儡武者！奪回蜂蜜與鮭供')
    }

    this.updateCameraFollow()

    const pct = Math.min(100, Math.floor((this.leadX() / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.scorePts = this.liveScore()
    this.emitScore(
      `${this.mode === '1p' ? '單人' : '雙人'}　進度 ${pct}%　${sec}秒　蜂蜜 ${this.honeyGot}/3`,
    )
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
    const beats: Array<{ x: number; title: string }> = [
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
      floatText(this, this.cameras.main.scrollX + 480, 100, b.title, '#ffe08a', {
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
    const lead = this.leadX()
    if (lead > this.checkpointX + 200) this.checkpointX = lead
  }

  private coinJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyC) ||
      TouchInput.justPressed('start')
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
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, true)
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
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true)
    this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C, true)
    this.keyRShift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, true)
    void this.keyH
    void this.keySlash
    void this.keyRShift
    this.keyDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1, true)
    this.keyPhysicsDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK, true)
    this.keyPhysicsDebugAlt = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2, true)

    this.input.gamepad?.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
      if (!this.pad1) this.pad1 = pad
      else if (!this.pad2) this.pad2 = pad
    })
    if (this.input.gamepad?.pad1) this.pad1 = this.input.gamepad.pad1
    if (this.input.gamepad?.pad2) this.pad2 = this.input.gamepad.pad2
  }

  private padPrev: Record<string, boolean> = {}
  private padFaceJust(pad: Phaser.Input.Gamepad.Gamepad | null, i: number) {
    if (!pad) return false
    const b = pad.buttons[i]
    const down = !!(b && ((b as { pressed?: boolean }).pressed || (b as { value?: number }).value! > 0.5))
    const key = `${pad.index}:${i}`
    const was = !!this.padPrev[key]
    this.padPrev[key] = down
    return down && !was
  }
  private padAxis(pad: Phaser.Input.Gamepad.Gamepad | null, horiz: boolean) {
    if (!pad) return 0
    if (horiz) {
      if (pad.left) return -1
      if (pad.right) return 1
      return pad.leftStick?.x ?? 0
    }
    if (pad.up) return -1
    if (pad.down) return 1
    return pad.leftStick?.y ?? 0
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
  private p1LaneUpHeld() {
    return this.keyW.isDown || this.padAxis(this.pad1, false) < -0.45 || TouchInput.isDown('up')
  }
  private p1LaneDownHeld() {
    return this.keyS.isDown || this.padAxis(this.pad1, false) > 0.45 || TouchInput.isDown('down')
  }
  private p1SpecialJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyT) ||
      Phaser.Input.Keyboard.JustDown(this.keyU) ||
      this.padFaceJust(this.pad1, 2) ||
      TouchInput.justPressed('special')
    )
  }
  private p2AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyComma) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP1) ||
      this.padFaceJust(this.pad2 ?? this.pad1, 3)
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
  private p2LaneUpHeld() {
    return !!this.cursors.up?.isDown || this.padAxis(this.pad2, false) < -0.45
  }
  private p2LaneDownHeld() {
    return !!this.cursors.down?.isDown || this.padAxis(this.pad2, false) > 0.45
  }
  private p2SpecialJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keySemicolon) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP4) ||
      this.padFaceJust(this.pad2, 2)
    )
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
    laneUpJust = false,
    laneDownJust = false,
  ) {
    h.moveSpeed = speed
    h.updatePlayer(dt, {
      left, right, jumpJust, jumpHeld, attackJust, laneUpJust, laneDownJust,
      onJump: () => SFX.jump(), onAttack: doAttack, now: this.time.now,
    })
    if (h.justLandedFlag) {
      this.juice.landDust(h.x, h.y)
      h.clearJustLanded()
    }
    const body = h.body as Phaser.Physics.Arcade.Body
    if ((body.blocked.down || body.touching.down) && Math.abs(body.velocity.x) > 40 && h.alive) {
      this.juice.runDust(h.x, h.y, dt, true)
    }
  }

  /** Snap actors + shadows onto the integer pixel grid after motion/FX. */
  private snapPixelArt() {
    const enemies = (this.enemies?.getChildren() ?? []) as Creep[]
    snapWorldActors({
      heroes: [this.boy, this.girl].filter(Boolean) as Hero[],
      pet: this.pet ?? undefined,
      enemies,
      shadows: [this.boyShadow, this.girlShadow, this.petShadow].filter(Boolean) as Phaser.GameObjects.Image[],
      shadowSources: [
        { x: this.boy.x, y: this.boy.y, oy: 4 },
        ...(this.girl ? [{ x: this.girl.x, y: this.girl.y, oy: 4 }] : []),
        ...(this.pet ? [{ x: this.pet.x, y: this.pet.y, oy: 4 }] : []),
      ],
      extras: [this.sword].filter((o): o is Phaser.GameObjects.Image => !!o),
    })
  }

  private moveBoy(dt: number) {
    const ax = this.padAxis(this.pad1, true)
    const left = this.keyA.isDown || ax < -0.45 || TouchInput.isDown('left')
    const right = this.keyD.isDown || ax > 0.45 || TouchInput.isDown('right')
    const spd = this.boy.role === 'girl' ? GIRL_SPEED : BOY_SPEED
    this.steerHero(
      this.boy, dt, left, right,
      this.p1JumpJust(), this.p1JumpHeld(), spd,
      this.p1AttackJust(),
      () => (this.boy.role === 'girl' ? this.swordSlash(this.boy) : this.fireSalmon(this.boy)),
      this.p1LaneUpHeld(), this.p1LaneDownHeld(),
    )
    if (this.p1SpecialJust()) this.fireHoneySpecial(this.boy)
  }

  private moveGirl(dt: number) {
    const g = this.girl
    if (!g) return
    const ax = this.padAxis(this.pad2, true)
    const left = !!this.cursors.left?.isDown || ax < -0.45
    const right = !!this.cursors.right?.isDown || ax > 0.45
    this.steerHero(
      g, dt, left, right,
      this.p2JumpJust(), this.p2JumpHeld(), GIRL_SPEED,
      this.p2AttackJust(), () => this.swordSlash(g),
      this.p2LaneUpHeld(), this.p2LaneDownHeld(),
    )
    if (this.p2SpecialJust()) this.fireHoneySpecial(g)
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
    this.specialCharges -= 1
    this.emitScore()
    freezeActors(this, this.combatActors(), ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    const jet = this.honeys.create(h.x, h.y - 28, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(1.7 * PROJ_DISPLAY_SCALE).setDepth(actorDepth('shot', h.lane, h.y))
    enableActorSprite(jet)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    const ang = Phaser.Math.Angle.Between(h.x, h.y - 28, best.x, best.y - 20)
    const spd = 620
    jet.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd)
    jet.setData('lane', best.lane)
    jet.setData('fromY', best.y)
    jet.setData('homing', best)
    this.entities.add(jet, 'projectile')
    floatText(this, h.x, h.y - 48, '絕招！', '#66ddff')
    burst(this, h.x, h.y - 28, 0x66ccff, 10)
    this.emitScore('絕招！蜂蜜 MP 清空')
    this.time.delayedCall(900, () => {
      if (jet.active) jet.destroy()
    })
  }

  private tryAutoHealFromCoins() {
    while (this.coinStock >= COINS_PER_HP) {
      this.coinStock -= COINS_PER_HP
      if (this.boy?.alive) this.boy.hp = Math.min(MAX_HP, this.boy.hp + 1)
      if (this.girl?.alive) this.girl.hp = Math.min(MAX_HP, this.girl.hp + 1)
      floatText(this, this.boy.x, this.boy.y - 56, '10幣→雙方+1HP', '#7dffb0')
      SFX.continue()
      this.refreshHearts()
    }
    this.refreshCoins()
  }


  /** Melee/range smash for pots & chests in facing cone. */
  private smashBreakablesInFront(h: Hero) {
    this.pots.getChildren().forEach((o) => {
      const pot = o as Breakable
      if (!pot.active) return
      if (hitBreakable(h, pot)) this.breakPot(pot)
    })
  }

  private fireSalmon(h: Hero) {
    h.atkCd = SALMON_SHOT_COOLDOWN_MS
    h.pose = 'idle'
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
    const shot = this.shots.create(muzzleX, muzzleY, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.5 * PROJ_DISPLAY_SCALE).setDepth(actorDepth('shot', h.lane, h.y)).setFlipX(h.facing < 0)
    enableActorSprite(shot)
    ;(shot.body as Phaser.Physics.Arcade.Body).allowGravity = false
    shot.setVelocityX(h.facing * SALMON_SHOT_SPEED)
    shot.setData('lane', h.lane)
    shot.setData('fromY', h.y)
    shot.setData('originX', muzzleX)
    shot.setData('maxRange', SALMON_SHOT_RANGE)
    burst(this, muzzleX, muzzleY, 0xffaa66, 5)
    this.smashBreakablesInFront(h)
    this.entities.add(shot, 'projectile')
    const maxMs = Math.ceil((SALMON_SHOT_RANGE / SALMON_SHOT_SPEED) * 1000) + 80
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
      scale: h.baseScale * 0.95,
    }
  }

  /** 噗噗 display scale so height ≈ half 琪寶寶. */
  private petScaleForGirl(g: Hero) {
    const pet = this.pet
    if (!pet) return ACTOR_DISPLAY_SCALE * 0.5
    const girlH = Math.max(40, g.displayHeight || 64)
    const frameH = Math.max(1, pet.frame?.height || pet.height || 64)
    return (girlH * PET_HEIGHT_FRAC) / frameH
  }

  /** 琪寶寶劍撃 — 近戰主力 */
  private swordSlash(h: Hero) {
    h.atkCd = SWORD_COOLDOWN_MS
    freezeActors(this, this.combatActors(), ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    const grip = this.girlSwordAnchor(h, true)
    burst(this, grip.x + h.facing * 24, grip.y, 0xe8f0ff, 10)
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
        duration: 110,
        yoyo: true,
        onComplete: () => {
          if (!this.sword) return
          this.sword.setAngle(h.facing > 0 ? -18 : 18)
        },
      })
    }
    this.spawnAttackHitbox(h, PLAYER_ATTACK_DMG, SWORD_HIT_W, SWORD_HIT_H, SWORD_HIT_MS)
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
    this.tweens.add({
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
    const heavy = dmg >= 2 || pe.kind === 'boss'
    const result = pe.receiveHit(dmg, dir)
    floatText(this, pe.x, pe.y - 40, heavy ? '重擊！' : '！')
    SFX.hit()
    // Hit confirm: freeze all characters 0.2s; do NOT pause world (ammo free).
    freezeActors(this, this.combatActors(), HIT_CONFIRM_FREEZE_MS)
    this.juice.shakeDamage()
    burst(this, pe.x, pe.y - 18, 0xffe8a0, heavy ? 8 : 6)
    impactRing(this, pe.x, pe.y - 12, heavy ? 0xffcc66 : 0xffe8a0, 8)
    this.addScorePop(pe.x, pe.y - 56, SCORE_HIT)
    if (result.killed) {
      SFX.kill()
      burst(this, pe.x, pe.y - 16, 0xff6688, 14)
      impactRing(this, pe.x, pe.y - 16, 0xff6688, 14)
      const bonus = pe.kind === 'boss' ? SCORE_BOSS_KILL : SCORE_KILL
      this.addScorePop(pe.x, pe.y - 72, bonus)
      if (pe.kind === 'boss') this.emitScore('武者倒下！搶回樹頂蜂巢！')
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
    const knockMul = pe.species === 'barrel' ? 0.4 : pe.species === 'elephant' ? 1.15 : 1
    const hpLeft = applyDamage(h, {
      amount: ENEMY_ATTACK_DMG,
      knockbackX: away * Math.round(340 * knockMul),
      knockbackY: -Math.round(320 * Math.max(0.45, knockMul)),
      now: this.time.now,
    })
    applyHurtPose(h, -away)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
    this.time.delayedCall(160, () => {
      if (h.pose !== 'die' && h.hurtLock <= 0) h.clearTint()
    })
    SFX.hurt()
    freezeActors(this, [h], PLAYER_HURT_FREEZE_MS)
    freezeActors(this, this.combatActors().filter((a) => a !== h), HIT_CONFIRM_FREEZE_MS)
    if (pe.species === 'elephant' && typeof pe.grantDominate === 'function') {
      pe.grantDominate(this.time.now, ELEPHANT_DOMINATE_MS)
    }
    burst(this, h.x, h.y - 24, 0xff4466, 8)
    floatText(
      this,
      h.x,
      h.y - 40,
      pe.species === 'barrel' ? `輕傷 -${ENEMY_ATTACK_DMG}` : `-${ENEMY_ATTACK_DMG}`,
      pe.species === 'barrel' ? '#ffaa77' : '#ff6677',
    )
    this.juice.shakeDamage()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (hpLeft <= 0) this.knockOut(h)
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
      amount: 1,
      knockbackX: opts.knockX,
      knockbackY: opts.knockY,
      iframeMs: HURT_IFRAME_MS,
      now: this.time.now,
    })
    applyHurtPose(h, -h.facing)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
    SFX.spike()
    burst(this, h.x, h.y - 16, 0xff6633, 10)
    if (opts.label) floatText(this, h.x, h.y - 36, opts.label, '#ff8866')
    this.juice.shakeDamage()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts?.()
    if (hpLeft <= 0) this.knockOut(h)
  }
  private checkFall() {
    const heroes = [this.boy, this.girl].filter((h): h is Hero => !!h)
    for (const h of heroes) {
      if (h.y > FALL_Y) {
        if (this.ended || !this.started || !canTakeDamage(h, this.time.now)) continue
        const hpLeft = applyDamage(h, {
          amount: 1,
          knockbackX: 0,
          knockbackY: -200,
          now: this.time.now,
        })
        h.snapToLane(h.lane, Math.max(80, h.x - 80))
        h.setVelocity(0, -200)
        applyHurtPose(h, -h.facing)
        startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
        SFX.spike()
        if (h.role === 'girl') this.summonBearAssist()
        this.refreshHearts()
        if (hpLeft <= 0) this.knockOut(h)
      }
    }
  }

  /**
   * Death path. Root-cause fix: previous guard was `if (h.hp <= 0 || !h.alive) return`,
   * so callers that already set hp to 0 never entered die/continue — soft-lock mockup feel.
   */
  private knockOut(h: Hero) {
    if (!h.alive || h.pose === 'die') return
    SFX.die()
    beginDeathPose(h)
    this.tweens.add({
      targets: h,
      angle: h.facing * 95,
      scaleX: h.baseScale * 1.15,
      scaleY: h.baseScale * 0.45,
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
    })
    this.prevLeadX = leadX
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
    const speed = this.petJetting ? 260 : 360
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
    this.boyShadow.setPosition(this.boy.x, laneY(this.boy.lane) + 4)
    this.boyShadow.setDepth(DEPTH.SHADOW)
    const g = this.girlHero()
    if (!g) return
    if (this.girl) {
      this.girlShadow?.setPosition(g.x, laneY(g.lane) + 4)
      this.girlShadow?.setDepth(DEPTH.SHADOW)
    }
    if (this.pet && this.petShadow) {
      this.petShadow.setPosition(this.pet.x, laneY(g.lane) + 4)
      this.petShadow.setDepth(DEPTH.SHADOW)
      const ps = this.petScaleForGirl(g)
      this.petShadow.setScale(Math.max(0.45, ps * 1.1), 0.4)
    }
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

  private animateBg() {
    if (!this.water) return
    const sx = this.cameras.main.scrollX
    const t = this.time.now
    // Stronger flow so the creek reads as a moving river.
    snapTilePosition(this.water, sx * 0.35 + t * 0.085)
    snapTilePosition(this.waterMid, sx * 0.4 + t * 0.11)
    snapTilePosition(this.waterFoam, sx * 0.48 + t * 0.14)
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
    const img = this.add
      .image(x, y, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.VILLAGE)
      .setScale(scale)
      .setFlipX(flip)
    this.styleBgPale(img, BG_MID_TINT)
    img.setData('baseX', x)
    img.setData('parallax', 0.14)
    enablePixelSprite(img)
    this.bgMounts.push(img)
  }

  /** World-space campsite props — foggy roadside scenery (not playfield-sharp). */
  private placeCampProp(x: number, key: string, scale: number, flip = false) {
    if (!this.textures.exists(key)) return
    const img = this.add
      .image(x, GROUND_Y - 2, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP)
      .setScale(scale * SCENERY_DISPLAY_SCALE)
      .setFlipX(flip)
    this.styleBgPale(img, BG_NEAR_TINT)
    enablePixelSprite(img)
  }

  /** Picnic table + tent + fire — roadside campsite beats. */
  private placeCampsite(x: number) {
    this.placeCampProp(x - 40, 'prop-tent', 1.35)
    this.placeCampProp(x, 'prop-picnic-table', 1.25)
    this.placeCampProp(x + 30, 'prop-campfire', 1.15)
    this.placeCampProp(x + 12, 'prop-picnic', 1.2)
    if (this.textures.exists('prop-shrine')) {
      this.placeCampProp(x - 64, 'prop-shrine', 1.1)
    }
  }

  /**
   * Sky critters: many bees + a few butterflies & birds.
   * Decorative only — no physics / damage.
   */
  private spawnAmbientCritters() {
    this.ambientCritters = []
    // Bees dominate the sky traffic
    for (let i = 0; i < 10; i++) this.spawnOneCritter('bee', true)
    for (let i = 0; i < 3; i++) this.spawnOneCritter('butterfly', true)
    for (let i = 0; i < 2; i++) this.spawnOneCritter('bird', true)
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
    const scale =
      kind === 'bird'
        ? Phaser.Math.FloatBetween(0.85, 1.25)
        : kind === 'butterfly'
          ? Phaser.Math.FloatBetween(1.0, 1.45)
          : Phaser.Math.FloatBetween(1.15, 1.65)
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
        if (!c.getData('baseScale')) c.setData('baseScale', Math.abs(c.scaleX))
        const flap = 1 + Math.sin(t * 0.018 + phase) * 0.1
        c.setScale((c.getData('baseScale') as number) * flap)
      }
      if (c.x < -70 || c.x > 1040) {
        c.destroy()
        this.ambientCritters.splice(i, 1)
        this.respawnAmbientKind(kind)
      }
    }
  }

  private drawWorld() {
    // Prefer generated wallpaper 貼圖 (pretty Flash/phone look) over hand-built mountains.
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x6ab4e0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)

    this.bgClouds = []
    this.bgMounts = []

    if (this.textures.exists('bg-wallpaper')) {
      // Full pretty wallpaper 貼圖 — covers sky/mountains; road stays separate.
      this.add
        .image(480, 200, 'bg-wallpaper')
        .setScrollFactor(0.025, 0)
        .setDepth(DEPTH.SKY_BAND)
        .setDisplaySize(1200, 480)
        .setAlpha(1)
      this.placeCampsite(stageX(520))
      this.placeCampsite(stageX(2100))
      this.placeCampsite(stageX(4200))
      this.spawnAmbientCritters()
    } else {
      g.fillStyle(0xa8d8f5, 1)
      g.fillRect(0, 0, WORLD_W, 160)
      this.placeSparseLandmarks()
    }

    // Background creek band — taller + layered so it reads as a flowing river.
    const bank = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.WATER_DEEP - 1)
    bank.fillStyle(0x5a7a48, 0.55)
    bank.fillRect(0, 455, 960, 18)
    bank.fillStyle(0x3a5a38, 0.4)
    bank.fillRect(0, 468, 960, 10)

    this.water = this.add
      .tileSprite(480, 505, 960, 72, 'water-deep')
      .setScrollFactor(0)
      .setDepth(DEPTH.WATER_DEEP)
      .setAlpha(0.95)
    this.water.setPosition(480, 505)
    enablePixelSprite(this.water)
    if (this.textures.exists('water-mid')) {
      this.waterMid = this.add
        .tileSprite(480, 492, 960, 36, 'water-mid')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_MID)
        .setAlpha(0.7)
      this.waterMid.setPosition(480, 492)
      enablePixelSprite(this.waterMid)
    }
    if (this.textures.exists('water-foam')) {
      this.waterFoam = this.add
        .tileSprite(480, 468, 960, 22, 'water-foam')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_FOAM)
        .setAlpha(0.95)
      this.waterFoam.setPosition(480, 468)
      enablePixelSprite(this.waterFoam)
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
      { key: 'lm-cloud-1', x: 120, y: 52, s: 1.35, p: 0.05 },
      { key: 'lm-cloud-2', x: 340, y: 38, s: 1.15, flip: true, p: 0.07 },
      { key: 'lm-cloud-3', x: 560, y: 60, s: 1.25, p: 0.06 },
      { key: 'lm-cloud-1', x: 780, y: 44, s: 1.05, flip: true, p: 0.08 },
      { key: 'lm-cloud-2', x: 980, y: 56, s: 1.4, p: 0.05 },
      { key: 'lm-cloud-3', x: 1180, y: 36, s: 1.2, flip: true, p: 0.09 },
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
      { key: 'lm-mount-2', x: 210, y: 268, s: 1.6 * 2.4, p: 0.02, d: DEPTH.MOUNT_FAR, a: BG_MOUNT_ALPHA * 0.85 },
      { key: 'lm-mount-1', x: 520, y: 278, s: 1.4 * 2.4, flip: true, p: 0.03, d: DEPTH.MOUNT_FAR, a: BG_MOUNT_ALPHA * 0.9 },
      { key: 'lm-mount-4', x: 820, y: 298, s: 1.5 * 2.3, p: 0.05, d: DEPTH.MOUNT_NEAR, a: BG_MOUNT_ALPHA },
      { key: 'lm-mount-3', x: 1120, y: 308, s: 1.3 * 2.3, flip: true, p: 0.06, d: DEPTH.MOUNT_NEAR, a: BG_MOUNT_ALPHA * 1.05 },
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

    this.placeCampsite(stageX(520))
    this.placeCampsite(stageX(2100))
    this.placeCampsite(stageX(4200))
    this.placeCampsite(stageX(6000))

    this.placeBgDecor(stageX(900), 'prop-owl', 1.15)
    this.placeBgDecor(stageX(3400), 'prop-owl', 1.1, true)

    this.spawnAmbientCritters()
    if (this.textures.exists('prop-torii')) {
      const arch = this.add
        .image(400, 300, 'prop-torii')
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(DEPTH.VILLAGE)
        .setScale(1.15)
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

    this.layGroundRibbon(LANE_FLOOR_Y)

    // Sparse spikes + 榴槤 traps（踩到 −1HP）+ honey jars along shorter stage.
    for (const x of [920, 2720, 4800].map(stageX)) {
      this.spikes(x, 3)
    }
    for (const x of [1180, 2100, 3320, 4200, 5400, 6400].map(stageX)) {
      this.placeDurian(x)
    }
    for (const x of [640, 1600, 2800, 4200, 5600, 6800].map(stageX)) {
      this.spawnHoneyJar(x, laneY(LANE_DEFAULT) - 36)
    }

    // Exactly 1 sushi on a random road lane — eat for +2 HP.
    {
      const sx = Phaser.Math.Between(500, WORLD_W - 400)
      const sl = clampLane(Phaser.Math.Between(0, 4)) as LaneId
      this.spawnSushi(sx, laneY(sl) - 20)
    }

    const shadKey = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.add.image(WORLD_W - 140, GROUND_Y + 7, shadKey).setDepth(DEPTH.PROP_SHADOW).setAlpha(0.55).setScale(1.7 * PROP_DISPLAY_SCALE, 0.7)
    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 10, 'goal3d')
    this.goal.setOrigin(0.5, 1)
    this.goal.setImmovable(true).setScale(1.25 * PROP_DISPLAY_SCALE).setDepth(DEPTH.BREAKABLE)
    enablePixelSprite(this.goal)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.add
      .text(WORLD_W - 140, GROUND_Y - 140, '樹頂・蜂巢', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)
  }

  private spawnHoneyJar(x: number, y: number) {
    const key = this.textures.exists('prop-honey-stack')
      ? 'prop-honey-stack'
      : this.textures.exists('fx-honey')
        ? 'fx-honey'
        : 'coin'
    const jar = this.honeyPickups.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    jar.setScale((key === 'coin' ? 1.6 : 1.25) * PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(jar)
    ;(jar.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.tweens.add({ targets: jar, y: y - 8, yoyo: true, repeat: -1, duration: 640 })
  }

  private spawnSushi(x: number, y: number) {
    const key = this.textures.exists('pickup-sushi') ? 'pickup-sushi' : 'coin'
    const s = this.sushiPickups.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    s.setScale(1.6 * PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(s)
    ;(s.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.tweens.add({ targets: s, y: y - 6, yoyo: true, repeat: -1, duration: 700 })
  }

  private takeSushi(h: Hero, item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active || !h.alive) return
    item.disableBody(true, true)
    const before = h.hp
    h.hp = Math.min(MAX_HP, h.hp + 2)
    const gained = h.hp - before
    SFX.coin()
    burst(this, item.x, item.y, 0xff8899, 10)
    if (gained > 0) {
      floatText(this, h.x, h.y - 56, '+2HP', '#ff6688', {
        size: 26,
        rise: 28,
        dur: 2500,
      })
      this.emitHealth()
    } else {
      floatText(this, h.x, h.y - 48, 'HP已滿', '#aaaaaa', { size: 18, dur: 900 })
    }
  }

  private spawnCoin(x: number, y: number) {
    const c = this.coinPickups.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite
    c.setScale(1.55 * PROP_DISPLAY_SCALE).setDepth(DEPTH.PICKUP)
    enablePixelSprite(c)
    ;(c.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.tweens.add({ targets: c, y: y - 6, yoyo: true, repeat: -1, duration: 520 })
  }

  private spawnCast() {
    const grace = this.time.now + 1400
    const soloCast = (this.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
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
        role: 'girl', texture: 'art-girl', graceUntil: grace, scale: GIRL_SCALE_MUL, speed: GIRL_SPEED,
      })
      this.boy.snapToLane(lane, x)
      this.entities.add(this.boy, 'player')
      this.boyShadow = this.add
        .image(x, y + 4, shad)
        .setDepth(DEPTH.SHADOW)
        .setAlpha(0.55)
        .setScale(0.55 * HERO_SIZE_MUL, 0.32)
      this.attachGirlGear(this.boy, lane)
      return
    }

    const boyLane = LANE_DEFAULT
    const boyY = laneY(boyLane)
    const boyX = 220
    this.boy = Player.spawn(this, boyX, boyY, {
      role: 'boy', texture: 'art-salmon', graceUntil: grace, scale: 1, speed: BOY_SPEED,
    })
    this.boy.snapToLane(boyLane, boyX)
    this.entities.add(this.boy, 'player')
    this.boyShadow = this.add
      .image(boyX, boyY + 4, shad)
      .setDepth(DEPTH.SHADOW)
      .setAlpha(0.55)
      .setScale(0.55 * HERO_SIZE_MUL, 0.32)

    if (this.mode !== '2p') return

    const girlLane = clampLane(LANE_DEFAULT + 1)
    const girlY = laneY(girlLane)
    const girlX = 380
    this.girl = Player.spawn(this, girlX, girlY, {
      role: 'girl', texture: 'art-girl', graceUntil: grace, scale: GIRL_SCALE_MUL, speed: GIRL_SPEED,
    })
    this.girl.snapToLane(girlLane, girlX)
    this.entities.add(this.girl, 'player')
    this.girlShadow = this.add
      .image(girlX, girlY + 4, shad)
      .setDepth(DEPTH.SHADOW)
      .setAlpha(0.55)
      .setScale(0.55 * HERO_SIZE_MUL, 0.32)
    this.attachGirlGear(this.girl, girlLane)
  }

  /** 琪寶寶 sword／噗噗 — 電風扇已 stamp 喺 art-girl 背脊. */
  private attachGirlGear(g: Hero, lane: LaneId) {
    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    const petStartX = g.x - PET_FOLLOW_BEHIND
    this.pet = this.physics.add.sprite(petStartX, g.y, 'art-bear')
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
    const swordKey = this.textures.exists('prop-sword') ? 'prop-sword' : 'fx-salmon-shot'
    const grip = this.girlSwordAnchor(g, false)
    this.sword = this.add
      .image(grip.x, grip.y, swordKey)
      .setOrigin(0.12, 0.55)
      .setDepth(actorDepth('hitbox', lane, g.y) + 0.2)
      .setScale(grip.scale)
      .setAngle(-18)
    enableActorSprite(this.sword)
    const ps = this.petScaleForGirl(g)
    this.petShadow = this.add
      .image(petStartX, g.y + 4, shad)
      .setDepth(DEPTH.SHADOW)
      .setAlpha(0.35)
      .setScale(Math.max(0.45, ps * 1.1), 0.4)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.attackHitboxes = this.physics.add.group()
    this.shots = this.physics.add.group()
    this.enemyShots = this.physics.add.group()
    this.honeys = this.physics.add.group()
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
      this.physics.add.overlap(hero.attackHitbox, this.enemies, (_a, enemy) => {
        const e = enemy as PatrolEnemy
        if (!hero.isMeleeActive() || !e.active || e.isDead) return
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
      s.destroy()
      this.damageEnemy(e, PLAYER_ATTACK_DMG, Math.sign(e.x - this.boy.x) || 1)
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      const g = this.girl
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - (g?.x ?? this.boy.x)) || 1)
    })
    // Enemy body ↔ player hurtbox
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as PatrolEnemy))
    this.physics.add.overlap(this.boy, this.hazards, (_b, hz) => {
      const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
      if (kind === 'lava') this.hazardHit(this.boy, { knockX: this.boy.facing * -220, knockY: -600, label: '熔岩' })
      else if (kind === 'durian') this.durian(this.boy)
      else this.spike(this.boy)
    })
    this.physics.add.overlap(this.boy, this.coinPickups, (_b, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.honeyPickups, (_b, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.sushiPickups, (_b, s) => this.takeSushi(this.boy, s as Phaser.Physics.Arcade.Sprite))
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
      this.physics.add.overlap(g, this.coinPickups, (_g, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.honeyPickups, (_g, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.sushiPickups, (_g, s) => this.takeSushi(g, s as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.enemyShots, (_g, s) => this.hitByFishBullet(g, s as Phaser.Physics.Arcade.Sprite))
    }
  }

  /** 刺刺魚小彈 — 低傷 + 短 freeze */
  private spawnFishBullet(e: PatrolEnemy, dir: 1 | -1) {
    const key = this.textures.exists('fx-fish-bullet') ? 'fx-fish-bullet' : 'coin'
    const x = e.x + dir * 28
    const y = e.y - 36
    const shot = this.enemyShots.create(x, y, key) as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.4 * PROJ_DISPLAY_SCALE).setDepth(actorDepth('shot', e.lane, e.y)).setFlipX(dir < 0)
    enableActorSprite(shot)
    const body = shot.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(10, 6)
    shot.setVelocityX(dir * 260)
    shot.setData('lane', e.lane)
    shot.setData('dmg', FISH_BULLET_DMG)
    this.entities.add(shot, 'projectile')
    this.time.delayedCall(1400, () => {
      if (shot.active) shot.destroy()
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
    const dmg = (shot.getData('dmg') as number) || FISH_BULLET_DMG
    const hpLeft = applyDamage(h, {
      amount: dmg,
      knockbackX: away * 180,
      knockbackY: -160,
      now: this.time.now,
    })
    applyHurtPose(h, -away)
    freezeActors(this, [h], FISH_BULLET_FREEZE_MS)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
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

    const handle = playStoryIntro({
      scene: this,
      onDone: () => {
        if (this.started) return
        this.started = true
        this.startedAt = this.time.now
        this.emitScore(
          this.mode === '1p'
            ? '單人：ＷＳ換線　Ｇ跳　Ｆ鮭槍　Ｔ絕招（食蜂蜜）｜Ｒ回選單'
            : '雙人：Ｆ／，攻擊　Ｇ／．跳　Ｔ／；絕招｜食蜂蜜充藍條',
        )
      },
    })
    this.events.once('shutdown', () => handle.destroy())
  }

  private breakPot(pot: Breakable) {
    if (!pot.active) return
    const loot: LootKind = pot.loot ?? (pot.breakKind === 'chest' ? 'coin' : 'honey')
    const x = pot.x, y = pot.y
    const facing = Math.sign(this.boy.x - x) || 1
    SFX.kill()
    // Same hit language as enemy smash: freeze + shake + white flash + lean
    const debrisColor = pot.breakKind === 'chest' ? 0xc48a48 : 0xffc050
    this.juice.solidHit(x, y, false, pot as Phaser.Physics.Arcade.Sprite, -facing)
    this.juice.breakDebris(x, y, debrisColor)
    impactRing(this, x, y, debrisColor, 12)
    floatText(this, x, y - 18, pot.breakKind === 'chest' ? '寶箱破！' : '壺破！', '#ffe8a0')
    this.addScorePop(x, y - 48, SCORE_BREAK)
    this.time.delayedCall(70, () => {
      if (pot.active) pot.disableBody(true, true)
    })
    if (loot === 'honey') {
      this.grantHoneySpecial(x, y)
    } else {
      this.spawnCoin?.(x, y - 10)
      floatText(this, x, y - 36, '＋1幣', '#ffe08a')
    }
  }

  private takeHoneyPickup(item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active) return
    item.disableBody(true, true)
    this.grantHoneySpecial(item.x, item.y)
    SFX.kill(); burst(this, item.x, item.y, 0xffc050, 12)
  }

  private takeCoin(coin: Phaser.Physics.Arcade.Sprite) {
    if (!coin.active) return
    coin.disableBody(true, true)
    this.coinStock += 1
    SFX.coin()
    burst(this, coin.x, coin.y, 0xffe08a, 8)
    floatText(this, coin.x, coin.y - 16, '＋1幣', '#ffe08a')
    this.tryAutoHealFromCoins()
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
    this.win()
  }

  /**
   * Stage clear → full-screen joy cutscene (not stuck on gameplay cam).
   * 倫寶＋琪寶寶＋噗噗 hug, 「第２關・待續」, button → character select.
   */
  private win() {
    if (this.registry.get('winScreenShown')) return
    this.registry.set('winScreenShown', true)
    this.ended = true
    this.awaitingContinue = false
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

    SFX.win()
    this.cameras.main.stopFollow()
    this.cameras.main.setScroll(0, 0)
    this.cameras.main.fadeIn(280, 255, 236, 180)

    // scrollFactor 0 + screen center (NOT world X) — stage end cam was hiding the old overlay.
    const overlay = this.add.container(480, 270).setDepth(DEPTH.UI + 120).setScrollFactor(0)

    const sky = this.add.rectangle(0, 0, 960, 540, 0x7ec8f0, 1).setOrigin(0.5)
    overlay.add(sky)
    const wash = this.add.rectangle(0, 80, 960, 380, 0xffe8b0, 0.55).setOrigin(0.5)
    overlay.add(wash)

    for (let i = 0; i < 36; i++) {
      const colors = [0xffe08a, 0xff8899, 0x66ddff, 0xa8f070, 0xffcc44, 0xff66aa, 0xffffff]
      const d = this.add.circle(
        Phaser.Math.Between(-460, 460),
        Phaser.Math.Between(-250, 250),
        Phaser.Math.Between(3, 8),
        colors[i % colors.length]!,
        0.95,
      )
      overlay.add(d)
      this.tweens.add({
        targets: d,
        y: d.y + Phaser.Math.Between(50, 140),
        alpha: 0.3,
        duration: 1200 + (i % 6) * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }

    const panel = this.add.rectangle(0, 8, 640, 380, 0xfff8ec, 0.98).setStrokeStyle(6, 0xe8a040)
    overlay.add(panel)

    const title = this.add
      .text(0, -150, '◆ 第１關　通關！◆', {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '38px',
        color: '#c44828',
        stroke: '#ffe8a0',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
    overlay.add(title)

    // Always show both characters + bear hugging together.
    const hugY = 8
    const boy = this.add.image(-78, hugY, 'art-salmon').setScale(1.55).setOrigin(0.5, 1)
    const girl = this.add.image(78, hugY, 'art-girl').setScale(1.55).setOrigin(0.5, 1)
    const bear = this.add.image(0, hugY + 10, 'art-bear').setScale(1.75).setOrigin(0.5, 1)
    enableActorSprite(boy)
    enableActorSprite(girl)
    enableActorSprite(bear)
    overlay.add([boy, girl, bear])
    this.tweens.add({
      targets: [boy, girl, bear],
      y: '-=12',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
    this.tweens.add({ targets: boy, angle: -8, duration: 480, yoyo: true, repeat: -1 })
    this.tweens.add({ targets: girl, angle: 8, duration: 480, yoyo: true, repeat: -1 })
    this.tweens.add({ targets: bear, scale: 1.85, duration: 560, yoyo: true, repeat: -1 })

    overlay.add(
      this.add
        .text(0, 95, '倫寶・琪寶寶・噗噗　開心擁抱！', {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '20px',
          color: '#5a3020',
        })
        .setOrigin(0.5),
    )

    overlay.add(
      this.add
        .text(0, 132, '第２關　・　待續', {
          fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
          fontSize: '26px',
          color: '#1a6088',
          backgroundColor: '#d8f0ff',
          padding: { x: 18, y: 8 },
        })
        .setOrigin(0.5),
    )

    const btnBg = this.add
      .rectangle(0, 182, 320, 56, 0xe07a4f, 1)
      .setStrokeStyle(3, 0xffe08a)
    const btnTx = this.add
      .text(0, 182, '回角色選擇', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '24px',
        color: '#fff8e0',
        stroke: '#4a2010',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    overlay.add([btnBg, btnTx])
    // Hit target after container add — more reliable than pre-add interactive.
    btnBg.setInteractive({ useHandCursor: true })
    btnTx.setInteractive({ useHandCursor: true })
    // Click anywhere on the lower third of the panel as fallback.
    const hitPad = this.add
      .rectangle(0, 182, 640, 90, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
    overlay.add(hitPad)
    let left = false
    const toSelect = () => {
      if (left || this.registry.get('leavingToMenu')) return
      left = true
      btnBg.disableInteractive()
      btnTx.disableInteractive()
      hitPad.disableInteractive()
      this.input.keyboard?.off('keydown-ENTER', toSelect)
      this.input.keyboard?.off('keydown-SPACE', toSelect)
      this.input.keyboard?.off('keydown-R', toSelect)
      // Clear sticky key state so cast select does not see Enter still down.
      this.keyEnter?.reset()
      this.keySpace?.reset()
      this.keyR?.reset()
      this.goMenu()
    }
    btnBg.on('pointerover', () => btnBg.setFillStyle(0xf09060))
    btnBg.on('pointerout', () => btnBg.setFillStyle(0xe07a4f))
    btnBg.on('pointerup', toSelect)
    btnTx.on('pointerup', toSelect)
    hitPad.on('pointerup', toSelect)
    this.input.keyboard?.on('keydown-ENTER', toSelect)
    this.input.keyboard?.on('keydown-SPACE', toSelect)
    this.input.keyboard?.on('keydown-R', toSelect)
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ENTER', toSelect)
      this.input.keyboard?.off('keydown-SPACE', toSelect)
      this.input.keyboard?.off('keydown-R', toSelect)
    })
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
        `按 Enter／空白／Ｃ　投幣\n按Ｒ　回選單`
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
        message: `${msg}\n◆ 幣已用盡 ◆\n按Ｒ鍵回選單`,
        canContinue: false,
        win: false,
      })
    }
  }

  /** Public for smoke / continue path — spends one coin and respawns on mid lane. */
  insertCoinContinue() {
    if (!this.awaitingContinue || this.coinStock <= 0) return
    this.coinStock -= 1
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
    const tex = this.textures.exists('blk-grass') ? 'blk-grass' : 'til-grass'
    const stride = this.textures.exists(tex) ? this.textures.get(tex).get().width : 32
    for (let x = 0; x < WORLD_W + stride; x += stride) {
      this.placeSurfaceTile(x, surfaceY, tex)
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
    s.setScale(1.15 * PROP_DISPLAY_SCALE)
    s.refreshBody()
    s.setDepth(DEPTH.HAZARD)
    s.setData('hazardKind', 'durian')
    enablePixelSprite(s)
  }

  /**
   * 分段出場：開場冇怪 → 行一段先出第一波 → 清完先解鎖右手邊後續波。
   * unlockX = 玩家 leadX 達到才啟用（inactive 直到解鎖）。
   */
  private placeEnemies() {
    // Wave 1 — elephant early; unlock after short walk. X scaled −25% stage.
    const w1 = [
      this.mkEnemy(stageX(780), GROUND_Y, 'blocker', undefined, 'fish', 1),
      this.mkEnemy(stageX(860), GROUND_Y, 'chaser', undefined, 'elephant', 3),
      this.mkEnemy(stageX(940), GROUND_Y, 'chaser', undefined, 'fish', 0),
      this.mkEnemy(stageX(1020), GROUND_Y, 'blocker', undefined, 'fish', 4),
      this.mkEnemy(stageX(1100), GROUND_Y, 'chaser', undefined, 'elephant', 2),
      this.mkEnemy(stageX(1180), GROUND_Y, 'chaser', undefined, 'fish', 3),
    ]
    for (const e of w1) this.deferEnemy(e, stageX(620), 'wave1')

    const later: Array<[number, EnemyKind, EnemySpecies | undefined, LaneId, number]> = [
      [1280, 'chaser', 'fish', 2, 1100],
      [1500, 'blocker', 'elephant', 4, 1100],
      [1180, 'ambusher', 'barrel', 0, 1100],
      [1380, 'chaser', 'fish', 1, 1200],
      [1750, 'ambusher', 'barrel', 0, 1550],
      [1980, 'chaser', 'elephant', 1, 1700],
      [2080, 'guardian', 'elephant', 2, 1850],
      [2200, 'ambusher', 'barrel', 3, 1950],
      [2400, 'interrupter', 'barrel', 1, 2100],
      [2680, 'guardian', 'elephant', 3, 2400],
      [2900, 'chaser', 'fish', 4, 2600],
      [3100, 'chaser', 'fish', 0, 2800],
      [3300, 'blocker', 'elephant', 2, 2900],
      [3500, 'ambusher', 'barrel', 4, 3100],
      [3650, 'chaser', 'fish', 2, 3300],
      [3800, 'chaser', 'elephant', 1, 3400],
      [4100, 'guardian', 'elephant', 3, 3700],
      [4400, 'interrupter', 'barrel', 0, 4000],
      [4550, 'ambusher', 'barrel', 2, 4150],
      [4700, 'chaser', 'fish', 2, 4300],
      [5000, 'blocker', 'elephant', 4, 4600],
      [5300, 'ambusher', 'barrel', 1, 4900],
      [5450, 'chaser', 'fish', 0, 5050],
      [5600, 'guardian', 'elephant', 2, 5200],
      [5900, 'chaser', 'fish', 3, 5500],
      [6200, 'blocker', 'elephant', 0, 5800],
    ]
    for (const [x, kind, sp, lane, unlock] of later) {
      const xx = stageX(x)
      const e = this.mkEnemy(xx, GROUND_Y, kind, kind === 'guardian' ? xx : undefined, sp, lane)
      this.deferEnemy(e, stageX(unlock), 'later')
    }
    const a1 = this.mkEnemy(WORLD_W - stageX(880), GROUND_Y, 'ambusher', undefined, 'barrel', 0)
    const a2 = this.mkEnemy(WORLD_W - stageX(480), GROUND_Y, 'ambusher', undefined, 'barrel', 1)
    const a3 = this.mkEnemy(WORLD_W - stageX(280), GROUND_Y, 'ambusher', undefined, 'barrel', 2)
    const a4 = this.mkEnemy(WORLD_W - stageX(680), GROUND_Y, 'ambusher', undefined, 'elephant', 4)
    const a5 = this.mkEnemy(WORLD_W - stageX(580), GROUND_Y, 'ambusher', undefined, 'fish', 3)
    for (const a of [a1, a2, a3, a4, a5]) {
      a.altarAmbush = true
      this.deferEnemy(a, WORLD_W - stageX(1200), 'altar')
    }
  }

  private deferEnemy(e: PatrolEnemy, unlockX: number, wave: string) {
    e.setData('unlockX', unlockX)
    e.setData('wave', wave)
    e.setActive(false)
    e.setVisible(false)
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
      return e.active && e.fsm !== 'DEAD' && e.fsm !== 'HURT'
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
    let stagger = 0
    this.enemies.getChildren().forEach((o) => {
      const e = o as PatrolEnemy
      if (e.active || e.fsm === 'DEAD') return
      const unlock = (e.getData('unlockX') as number) ?? 0
      const wave = e.getData('wave') as string
      if (lead < unlock) return
      if (wave !== 'wave1' && (wave1Alive || wave1Pending)) return
      // 開始 10 秒後：左右兩邊都可走入；之前淨係右邊。
      const fromLeft = allowLeft && stagger % 2 === 1
      const enterX = fromLeft
        ? Math.max(24, cam.scrollX - 48 - stagger * 36)
        : Math.min(WORLD_W - 24, cam.scrollX + cam.width + 48 + stagger * 72)
      stagger += 1
      e.setPosition(enterX, laneY(e.lane))
      e.homeX = enterX
      e.patrolMin = enterX - 40
      e.patrolMax = enterX + 40
      e.setActive(true)
      e.setVisible(true)
      const body = e.body as Phaser.Physics.Arcade.Body
      body.enable = true
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
      if (wave === 'wave1' && !this.registry.get('wave1Announced')) {
        this.registry.set('wave1Announced', true)
        floatText(this, cam.scrollX + 480, 120, '傀儡來襲！', '#ff6644')
      }
    })
  }

  /** Wake altar ambushers — they already enter from the right; just harden chase. */
  private triggerAltarAmbush() {
    this.altarAmbushOn = true
    SFX.boss()
    this.cameras.main.flash(160, 255, 120, 80)
    this.emitScore('蜂巢伏兵！疾風桶突襲')
    floatText(this, this.cameras.main.scrollX + 480, 120, '蜂巢伏兵！', '#ff6644')
    this.enemies.getChildren().forEach((o) => {
      const e = o as PatrolEnemy
      if (!e.active || !e.altarAmbush || e.fsm === 'DEAD') return
      e.setTint(0xff2222)
      e.setFsm('CHASE')
      e.setVelocityX(-ENEMY_SPEED)
      impactRing(this, e.x, e.y - 20, 0xff5533, 16)
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
          if (pe.species === 'fish') this.spawnFishBullet(pe, dir)
        },
      },
    })
    this.entities.add(e, 'enemy')
    return e
  }

  private spawnBoss(x: number, y: number) {
    this.mkEnemy(x, y, 'boss', undefined, undefined, LANE_DEFAULT)
  }
}
