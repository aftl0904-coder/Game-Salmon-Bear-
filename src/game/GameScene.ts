/** User QA handoff: see /QA_HANDOFF_GATE.md (Visual/Feel/Fun ≥7.5; overall ~8.0+ before user fine-feel). */
import Phaser from 'phaser'
import { burst, floatText, impactRing, scorePop, startIFrameBlink, JuiceManager, hitstop } from './fx'
import {
  enablePixelSprite,
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
  ENEMY_SPEED,
  ENEMY_STAGGER_EVERY_MIN_MS,
  ENEMY_STAGGER_EVERY_MAX_MS,
  ENEMY_STAGGER_HOLD_MS,
  ATTACK_COMMIT_FREEZE_MS,
  SWORD_HIT_W,
  SWORD_HIT_H,
  SWORD_HIT_MS,
  PET_FOLLOW_BEHIND,
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
  /** Back fan = mobility FX only; sword = 琪寶寶武器（2P） */
  private fan: Phaser.GameObjects.Image | null = null
  private fanGlow: Phaser.GameObjects.Arc | null = null
  private sword: Phaser.GameObjects.Image | null = null
  private boyShadow!: Phaser.GameObjects.Image
  private girlShadow: Phaser.GameObjects.Image | null = null
  /** Max X gap between duo before camera/lead clamp (2P). */
  private static readonly MAX_PAIR_SEP = 360
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
  private goal!: Phaser.Physics.Arcade.Sprite
  private levelMap: LevelMapHandle | null = null
  private camTarget!: Phaser.GameObjects.Zone
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyW!: Phaser.Input.Keyboard.Key
  private keyA!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyJ!: Phaser.Input.Keyboard.Key
  private keyK!: Phaser.Input.Keyboard.Key
  private keyU!: Phaser.Input.Keyboard.Key
  private keyI!: Phaser.Input.Keyboard.Key
  private keyNP1!: Phaser.Input.Keyboard.Key
  private keyNP2!: Phaser.Input.Keyboard.Key
  private keyNP4!: Phaser.Input.Keyboard.Key
  private keyNP5!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private keyEnter!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private keyC!: Phaser.Input.Keyboard.Key
  private keyDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebug!: Phaser.Input.Keyboard.Key
  private keyPhysicsDebugAlt!: Phaser.Input.Keyboard.Key
  private physicsDebug = false
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
    this.entities.clear()
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

  /** 雙人：唔准一個角色把鏡頭／進度拉開；單人跟倫寶。 */
  private updateCameraFollow() {
    if (!this.camTarget || !this.boy) return
    if (this.girl && this.girl.active) {
      this.clampPairSeparation()
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

  private clampPairSeparation() {
    const g = this.girl
    if (!g || !g.active) return
    const maxSep = GameScene.MAX_PAIR_SEP
    const dx = this.boy.x - g.x
    if (Math.abs(dx) <= maxSep) return
    // Pull the one further ahead back onto the shared camera window.
    if (dx > maxSep) {
      this.boy.x = g.x + maxSep
      const b = this.boy.body as Phaser.Physics.Arcade.Body
      if (b.velocity.x > 0) b.velocity.x = 0
    } else {
      g.x = this.boy.x + maxSep
      const gb = g.body as Phaser.Physics.Arcade.Body
      if (gb.velocity.x > 0) gb.velocity.x = 0
    }
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
    this.cameras.main.off(
      Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE,
      this.onCameraFollowUpdate,
      this,
    )
    this.time.removeAllEvents()
    this.tweens.killAll()
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()
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
    this.stopUi()
    this.scene.start('menu')
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
      ...(info !== undefined ? { info } : {}),
    })
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
      else if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.goMenu()
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

    this.moveBoy(dt)
    if (this.mode === '2p' && this.girl) this.moveGirl(dt)

    this.updatePet()
    this.activateDeferredEnemies()
    this.tickEnemyStagger(dt)
    this.updateEnemies(dt)
    this.cullSalmonShots()
    this.entities.syncEnemiesFromGroup(this.enemies)
    this.syncFx()
    this.animateBg()
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
      this.emitScore('關底・三角傀儡武者！奪回春蜜與鮭供')
    }

    this.updateCameraFollow()

    const pct = Math.min(100, Math.floor((this.leadX() / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.scorePts = this.liveScore()
    this.emitScore(
      `${this.mode === '1p' ? '單人' : '雙人'}　進度 ${pct}%　${sec}秒　春蜜 ${this.honeyGot}/3`,
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
      { x: 3000, y: GROUND_Y - 96, label: '祭壇前' },
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
      { x: 2880, title: '祭壇前方・決戰' },
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
      Phaser.Input.Keyboard.JustDown(this.keyC)
    )
  }

  private bindKeys() {
    const kb = this.input.keyboard!
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.J,
      Phaser.Input.Keyboard.KeyCodes.K,
      Phaser.Input.Keyboard.KeyCodes.U,
      Phaser.Input.Keyboard.KeyCodes.I,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR,
      Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
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
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J, true)
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K, true)
    this.keyU = kb.addKey(Phaser.Input.Keyboard.KeyCodes.U, true)
    this.keyI = kb.addKey(Phaser.Input.Keyboard.KeyCodes.I, true)
    this.keyNP1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE, true)
    this.keyNP2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO, true)
    this.keyNP4 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR, true)
    this.keyNP5 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE, true)
    this.keyR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R, true)
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, true)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true)
    this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C, true)
    this.keyDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1, true)
    this.keyPhysicsDebug = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK, true)
    this.keyPhysicsDebugAlt = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2, true)
  }

  private p1AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyJ) ||
      Phaser.Input.Keyboard.JustDown(this.keyU) ||
      Phaser.Input.Keyboard.JustDown(this.keyI)
    )
  }
  private p1JumpJust() { return Phaser.Input.Keyboard.JustDown(this.keyK) }
  private p1JumpHeld() { return this.keyK.isDown }
  private p1LaneUpHeld() { return this.keyW.isDown }
  private p1LaneDownHeld() { return this.keyS.isDown }
  private p2AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyNP1) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP4) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP5)
    )
  }
  private p2JumpJust() { return Phaser.Input.Keyboard.JustDown(this.keyNP2) }
  private p2JumpHeld() { return this.keyNP2.isDown }
  private p2LaneUpHeld() { return !!this.cursors.up?.isDown }
  private p2LaneDownHeld() { return !!this.cursors.down?.isDown }

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
      extras: [this.fan, this.sword].filter(
        (o): o is Phaser.GameObjects.Image => !!o,
      ),
    })
  }

  private moveBoy(dt: number) {
    this.steerHero(
      this.boy, dt, this.keyA.isDown, this.keyD.isDown,
      this.p1JumpJust(), this.p1JumpHeld(), BOY_SPEED,
      this.p1AttackJust(), () => this.fireSalmon(this.boy),
      this.p1LaneUpHeld(), this.p1LaneDownHeld(),
    )
  }

  private moveGirl(dt: number) {
    const g = this.girl
    if (!g) return
    this.steerHero(
      g, dt, !!this.cursors.left?.isDown, !!this.cursors.right?.isDown,
      this.p2JumpJust(), this.p2JumpHeld(), GIRL_SPEED,
      this.p2AttackJust(), () => this.swordSlash(g),
      this.p2LaneUpHeld(), this.p2LaneDownHeld(),
    )
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
    // 2.5 shots / sec
    h.atkCd = SALMON_SHOT_COOLDOWN_MS
    h.pose = 'idle'
    hitstop(this, ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    this.tweens.killTweensOf(h)
    h.setAngle(0)
    h.setScale(h.baseScale)
    // Muzzle = salmon-gun tip on 2× baked feet-origin sprite (~52px forward, ~88px up).
    const muzzleX = h.x + h.facing * 52
    const muzzleY = h.y - 88
    const shot = this.shots.create(muzzleX, muzzleY, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.5).setDepth(actorDepth('shot', h.lane, h.y)).setFlipX(h.facing < 0)
    enablePixelSprite(shot)
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

  /** 琪寶寶劍撃 — 近戰主力 */
  private swordSlash(h: Hero) {
    h.atkCd = 220
    hitstop(this, ATTACK_COMMIT_FREEZE_MS)
    SFX.swing()
    burst(this, h.x + h.facing * 50, h.y - 28, 0xe8f0ff, 10)
    h.setAngle(0)
    h.setScale(h.baseScale)
    if (this.sword) {
      this.sword.setAlpha(1)
      this.tweens.add({
        targets: this.sword,
        angle: h.facing > 0 ? 55 : -55,
        x: h.x + h.facing * 42,
        duration: 90,
        yoyo: true,
        onComplete: () => {
          if (!this.sword) return
          this.sword.setAngle(h.facing > 0 ? -12 : 12)
        },
      })
    }
    this.spawnAttackHitbox(h, 2, SWORD_HIT_W, SWORD_HIT_H, SWORD_HIT_MS)
    this.smashBreakablesInFront(h)
  }

  /** Melee attack hitbox — overlap with enemies (not a solid collider). */
  private spawnAttackHitbox(h: Hero, dmg: number, w: number, ht: number, lifeMs: number) {
    const key = this.textures.exists('fx-salmon-shot') ? 'fx-salmon-shot' : 'coin'
    const box = this.attackHitboxes.create(
      h.x + h.facing * (w * 0.45),
      h.y - 28,
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

  private summonBearAssist() {
    if (!this.girl || !this.pet || this.petJetting || this.girl.hp <= 0) return
    this.petJetting = true
    SFX.hit()
    floatText(this, this.pet.x, this.pet.y - 50, '噗噗！', '#ffcc44')
    this.tweens.add({ targets: this.pet, scaleX: 1.9, scaleY: 1.5, yoyo: true, duration: 90 })
    this.honeyJet(this.girl.facing)
    this.time.delayedCall(520, () => {
      this.petJetting = false
    })
  }

  private honeyJet(dir: number) {
    if (!this.girl || !this.pet) return
    const jet = this.honeys.create(this.pet.x + dir * 16, this.pet.y - 20, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(1.55).setDepth(actorDepth('shot', this.girl.lane, this.girl.y))
    enablePixelSprite(jet)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    jet.setVelocityX(dir * 480)
    jet.setData('lane', this.girl.lane)
    jet.setData('fromY', this.girl.y)
    this.entities.add(jet, 'projectile')
    burst(this, this.pet.x, this.pet.y, 0xffc050, 14)
    floatText(this, this.pet.x, this.pet.y - 36, '蜂蜜噴流', '#ffcc44')
    this.time.delayedCall(700, () => jet.destroy())
  }

  private damageEnemy(e: Creep | PatrolEnemy, dmg: number, dir: number, from?: { lane?: number; y: number }) {
    const pe = e as PatrolEnemy
    if (pe.isDead || pe.fsm === 'DEAD') return
    if (from && !sameLane(from, pe)) return
    const heavy = dmg >= 2 || pe.kind === 'boss'
    const result = pe.receiveHit(dmg, dir)
    floatText(this, pe.x, pe.y - 40, heavy ? '重擊！' : '！')
    SFX.hit()
    // Goemon one-blade: hitstop + shake + white flash + knockback lean
    this.juice.solidHit(pe.x, pe.y - 18, heavy, pe, dir)
    this.addScorePop(pe.x, pe.y - 56, SCORE_HIT)
    if (result.killed) {
      SFX.kill()
      burst(this, pe.x, pe.y - 16, 0xff6688, 14)
      impactRing(this, pe.x, pe.y - 16, 0xff6688, 14)
      const bonus = pe.kind === 'boss' ? SCORE_BOSS_KILL : SCORE_KILL
      this.addScorePop(pe.x, pe.y - 72, bonus)
      if (pe.kind === 'boss') this.emitScore('武者倒下！兩人一起站上祭壇')
    }
  }

  private hurtHero(h: Hero, e: Creep | PatrolEnemy) {
    if (this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) return
    if (!enemyCanHurt(e as Creep)) return
    const pe = e as PatrolEnemy
    if (!sameLane(h, pe)) return
    if (pe.fsm === 'ATTACK') pe.hitThis = true
    else pe.contactCd = 650
    const away = (Math.sign(h.x - e.x) || -1) as 1 | -1
    const hpLeft = applyDamage(h, {
      amount: 1,
      knockbackX: away * 340,
      knockbackY: -320,
      now: this.time.now,
    })
    applyHurtPose(h, -away)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
    this.time.delayedCall(160, () => {
      if (h.pose !== 'die' && h.hurtLock <= 0) h.clearTint()
    })
    SFX.hurt()
    burst(this, h.x, h.y - 24, 0xff4466, 8)
    floatText(this, h.x, h.y - 40, '-1', '#ff6677')
    this.juice.shakeDamage()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    // Primary bugfix: knockOut must run when HP hits 0 (old guard was `hp <= 0 → return`).
    if (hpLeft <= 0) this.knockOut(h)
  }

  private spike(h: Hero) {
    this.hazardHit(h, { knockX: h.facing * -180, knockY: -560, label: '尖刺' })
  }
  private hazardHit(h: Hero, opts: { knockX: number; knockY: number; label?: string } = { knockX: 0, knockY: -560 }) {
    if (this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) return
    const hpLeft = applyDamage(h, { amount: 1, knockbackX: opts.knockX, knockbackY: opts.knockY, iframeMs: HURT_IFRAME_MS, now: this.time.now })
    applyHurtPose(h, -h.facing)
    startIFrameBlink(h as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, this, HURT_IFRAME_MS)
    SFX.spike(); burst(this, h.x, h.y - 16, 0xff6633, 10)
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

  /** 噗噗：永遠跟在琪寶寶身後（2P only）。 */
  private updatePet() {
    const g = this.girl
    const pet = this.pet
    if (!g || !pet) return
    let followX = g.x - g.facing * PET_FOLLOW_BEHIND
    if (Math.abs(followX - this.boy.x) < 56) {
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
    pet.setScale(1)
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
    const g = this.girl
    if (!g) return
    this.girlShadow?.setPosition(g.x, laneY(g.lane) + 4)
    this.girlShadow?.setDepth(DEPTH.SHADOW)
    if (this.pet && this.petShadow) {
      this.petShadow.setPosition(this.pet.x, laneY(g.lane) + 4)
      this.petShadow.setDepth(DEPTH.SHADOW)
    }
    if (this.fan && this.fanGlow) {
      this.fan.setPosition(g.x - g.facing * 48, g.y - 48)
      this.fan.setFlipX(g.facing < 0)
      this.fan.setScale(0.85)
      this.fan.setAngle(0)
      this.fan.setDepth(actorDepth('fan', g.lane, g.y))
      this.fanGlow.setPosition(this.fan.x, this.fan.y)
      this.fanGlow.setDepth(actorDepth('fan', g.lane, g.y) - 0.1)
      this.fanGlow.setAlpha(0.08)
    }
    if (this.sword) {
      const swing = g.atkCd > 80
      this.sword.setPosition(g.x + g.facing * (swing ? 40 : 26), g.y - 30)
      this.sword.setFlipX(g.facing < 0)
      this.sword.setScale(1.15)
      if (!swing) this.sword.setAngle(g.facing > 0 ? -12 : 12)
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
    snapTilePosition(this.water, sx * 0.45 + t * 0.025)
    snapTilePosition(this.waterMid, sx * 0.5 + t * 0.032)
    snapTilePosition(this.waterFoam, sx * 0.55 + t * 0.04)
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

  private placeDecor(x: number, key: string, scale: number, shadScale = 1, flip = false) {
    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    const sh = this.add
      .image(x + 4, GROUND_Y + 6, shad)
      .setDepth(DEPTH.PROP_SHADOW)
      .setAlpha(0.55)
      .setScale(shadScale * 1.05, shadScale * 0.65)
    enablePixelSprite(sh)
    if (!this.textures.exists(key)) return
    const img = this.add
      .image(x, GROUND_Y, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP)
      .setScale(scale)
      .setFlipX(flip)
    enablePixelSprite(img)
  }

  private drawWorld() {
    // Layer 0 — soft base only: gradient sky + sun + horizon wash (no tiled mountain strips).
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x6ab4e0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0xa8d8f5, 1)
    g.fillRect(0, 0, WORLD_W, 160)
    g.fillStyle(0xffe8b0, 0.42)
    g.fillRect(0, 170, WORLD_W, 180)
    g.fillStyle(0xfff6d0, 0.55)
    g.fillCircle(160, 70, 78)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(160, 70, 30)
    // Simple horizon line washes (not a busy mountain band).
    g.fillStyle(0xc8dce8, 0.35)
    g.fillRect(0, 248, WORLD_W, 10)
    g.fillStyle(0xb8c8a8, 0.28)
    g.fillRect(0, 256, WORLD_W, 18)

    if (this.textures.exists('bg-sky')) {
      const sky = this.add
        .tileSprite(480, 100, 960, 200, 'bg-sky')
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND)
        .setAlpha(0.4)
      enablePixelSprite(sky)
    }
    if (this.textures.exists('bg-horizon')) {
      const hz = this.add
        .tileSprite(480, 262, 960, 32, 'bg-horizon')
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND + 1)
        .setAlpha(0.55)
      enablePixelSprite(hz)
    }

    this.bgClouds = []
    this.bgMounts = []
    this.placeSparseLandmarks()

    // Water stack at stage foot — integer origin + width (multiple of 64) kills seams.
    this.water = this.add
      .tileSprite(480, 520, 960, 64, 'water-deep')
      .setScrollFactor(0)
      .setDepth(DEPTH.WATER_DEEP)
    this.water.setPosition(480, 520)
    enablePixelSprite(this.water)
    if (this.textures.exists('water-mid')) {
      this.waterMid = this.add
        .tileSprite(480, 500, 960, 32, 'water-mid')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_MID)
        .setAlpha(0.7)
      this.waterMid.setPosition(480, 500)
      enablePixelSprite(this.waterMid)
    }
    if (this.textures.exists('water-foam')) {
      this.waterFoam = this.add
        .tileSprite(480, 488, 960, 16, 'water-foam')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_FOAM)
        .setAlpha(0.85)
      this.waterFoam.setPosition(480, 488)
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
        .setAlpha(0.9)
        .setFlipX(!!c.flip)
      img.setData('baseX', c.x)
      img.setData('parallax', c.p)
      enablePixelSprite(img)
      this.bgClouds.push(img)
    }

    // --- 4 unique mountains (far→near), spaced so they never read as a tiled strip ---
    const mountSpecs: Array<{ key: string; x: number; y: number; s: number; flip?: boolean; p: number; d: number }> = [
      { key: 'lm-mount-2', x: 210, y: 270, s: 1.6, p: 0.07, d: DEPTH.MOUNT_FAR },
      { key: 'lm-mount-1', x: 520, y: 282, s: 1.4, flip: true, p: 0.09, d: DEPTH.MOUNT_FAR },
      { key: 'lm-mount-4', x: 820, y: 305, s: 1.5, p: 0.14, d: DEPTH.MOUNT_NEAR },
      { key: 'lm-mount-3', x: 1120, y: 318, s: 1.3, flip: true, p: 0.17, d: DEPTH.MOUNT_NEAR },
    ]
    for (const m of mountSpecs) {
      if (!this.textures.exists(m.key)) continue
      const img = this.add
        .image(m.x, m.y, m.key)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(m.d)
        .setScale(1)
        .setAlpha(0.82)
        .setFlipX(!!m.flip)
      img.setData('baseX', m.x)
      img.setData('parallax', m.p)
      enablePixelSprite(img)
      this.bgMounts.push(img)
    }

    // --- Ground landmarks (world-space, with contact shadows) ---
    // Few trees (4) — integer scales so safeAuto stays active.
    this.placeDecor(150, 'prop-tree3d', 1, 1.2)
    this.placeDecor(620, 'prop-tree3d', 1, 1.0, true)
    this.placeDecor(1320, 'prop-tree3d', 1, 1.15)
    this.placeDecor(2360, 'prop-tree3d', 1, 1.05)
    // Torii as mid-parallax landmark (NOT on walk path) — characters never clip beams.
    if (this.textures.exists('prop-torii')) {
      const torii = this.add
        .image(400, 300, 'prop-torii')
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(DEPTH.VILLAGE)
        .setScale(1)
        .setAlpha(0.92)
      torii.setData('baseX', 400)
      torii.setData('parallax', 0.12)
      enablePixelSprite(torii)
      this.bgMounts.push(torii)
    }
    // 1 house — clear of lane feet
    this.placeDecor(1050, 'prop-house3d', 1, 1.45)
    // No bridge prop — reads as a walkable plank and conflicts with lane combat.
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pots = this.physics.add.group()
    this.coinPickups = this.physics.add.group()
    this.honeyPickups = this.physics.add.group()
    this.levelMap = createRound1Tilemap(this, this.pots, this.hazards)
    // 三線橫版：唔要跳板／條條平台（會卡住角色）。跳躍只為過尖刺／越敵。
    if (this.levelMap?.solids) {
      this.levelMap.solids.setCollisionByExclusion([-1])
      this.levelMap.solids.setVisible(false)
      this.levelMap.solids.setActive(false)
    }

    // One continuous aligned ground ribbon — no gaps / 斷開 between banks.
    this.layGroundRibbon(LANE_FLOOR_Y)

    // Ground spike traps only — jump over these (or change lane).
    this.spikes(540, 3)
    this.spikes(1840, 3)
    this.spikes(2700, 3)

    const shadKey = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    for (const x of [380, 1200, 2050, 3000]) {
      this.add.image(x, GROUND_Y + 5, shadKey).setDepth(DEPTH.PROP_SHADOW).setAlpha(0.5).setScale(0.85, 0.55)
      const pot = this.pots.create(x, GROUND_Y - 40, 'pot3d') as Phaser.Physics.Arcade.Sprite
      pot.setScale(1.45).setDepth(DEPTH.BREAKABLE)
      enablePixelSprite(pot)
      ;(pot as Breakable).breakKind = 'pot'
      ;(pot as Breakable).loot = 'coin'
      ;(pot.body as Phaser.Physics.Arcade.Body).allowGravity = false
      this.tweens.add({ targets: pot, y: pot.y - 6, yoyo: true, repeat: -1, duration: 700 })
      this.spawnCoin(x + 60, GROUND_Y - 40)
    }

    this.add.image(WORLD_W - 140, GROUND_Y + 7, shadKey).setDepth(DEPTH.PROP_SHADOW).setAlpha(0.55).setScale(1.7, 0.7)
    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 50, 'goal3d')
    this.goal.setImmovable(true).setScale(1.35).setDepth(DEPTH.BREAKABLE)
    enablePixelSprite(this.goal)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.add
      .text(WORLD_W - 140, GROUND_Y - 130, '祭壇・春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)

    // Stage-beat zone labels are F1-only (DebugOverlay) — never in player view.
  }

  private spawnCoin(x: number, y: number) {
    const c = this.coinPickups.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite
    c.setScale(1.55).setDepth(DEPTH.PICKUP)
    enablePixelSprite(c)
    ;(c.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.tweens.add({ targets: c, y: y - 6, yoyo: true, repeat: -1, duration: 520 })
  }

  private spawnCast() {
    const grace = this.time.now + 1400
    const boyLane = LANE_DEFAULT
    const boyY = laneY(boyLane)
    const boyX = 220
    this.boy = Player.spawn(this, boyX, boyY, {
      role: 'boy', texture: 'art-salmon', graceUntil: grace, scale: 1, speed: BOY_SPEED,
    })
    this.boy.snapToLane(boyLane, boyX)
    this.entities.add(this.boy, 'player')
    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.boyShadow = this.add.image(boyX, boyY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.55).setScale(1, 0.75)

    // 單人：只有倫寶。雙人先刷琪寶寶＋噗噗。
    this.girl = null
    this.pet = null
    this.fan = null
    this.fanGlow = null
    this.sword = null
    this.girlShadow = null
    this.petShadow = null
    if (this.mode !== '2p') return

    const girlLane = clampLane(LANE_DEFAULT + 1)
    const girlY = laneY(girlLane)
    const girlX = 380
    this.girl = Player.spawn(this, girlX, girlY, {
      role: 'girl', texture: 'art-girl', graceUntil: grace, scale: 1, speed: GIRL_SPEED,
    })
    this.girl.snapToLane(girlLane, girlX)
    this.entities.add(this.girl, 'player')
    const petStartX = girlX - PET_FOLLOW_BEHIND
    this.pet = this.physics.add.sprite(petStartX, girlY, 'art-bear')
    this.pet.setOrigin(0.5, 1)
    this.pet.setScale(1).setAlpha(0.85).setDepth(actorDepth('pet', girlLane, girlY)).setVisible(true)
    enablePixelSprite(this.pet)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.pet.setData('lane', girlLane)
    this.entities.add(this.pet, 'pet')
    const fanKey = this.textures.exists('fan3d') ? 'fan3d' : 'prop-fan'
    this.fan = this.add.image(girlX - 48, girlY - 48, fanKey).setDepth(actorDepth('fan', girlLane, girlY)).setScale(0.85)
    enablePixelSprite(this.fan)
    this.fanGlow = this.add.circle(girlX - 48, girlY - 48, 6, 0x88ddff, 0.08).setDepth(actorDepth('fan', girlLane, girlY) - 0.1)
    this.fan.setAngle(0)
    const swordKey = this.textures.exists('prop-sword') ? 'prop-sword' : 'fx-salmon-shot'
    this.sword = this.add
      .image(girlX + 26, girlY - 30, swordKey)
      .setDepth(actorDepth('hitbox', girlLane, girlY) + 0.2)
      .setScale(1.15)
      .setAngle(-12)
    enablePixelSprite(this.sword)
    this.girlShadow = this.add.image(girlX, girlY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.55).setScale(1, 0.75)
    this.petShadow = this.add.image(petStartX, girlY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.35).setScale(1, 0.45)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.attackHitboxes = this.physics.add.group()
    this.shots = this.physics.add.group()
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
        this.damageEnemy(e, hero.role === 'girl' ? 2 : 1, hero.facing, hero)
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
      const fromLane = (box.getData('lane') as number | undefined) ?? LANE_DEFAULT
      const fromY = (box.getData('fromY') as number | undefined) ?? e.y
      if (!sameLane({ lane: fromLane, y: fromY }, e)) return
      hitSet.add(key)
      const dmg = (box.getData('dmg') as number) || 1
      const dir = (box.getData('dir') as number) || 1
      this.damageEnemy(e, dmg, dir, { lane: fromLane, y: fromY })
    })
    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      const s = shot as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      const fromLane = (s.getData('lane') as number | undefined) ?? this.boy.lane
      const fromY = (s.getData('fromY') as number | undefined) ?? this.boy.y
      if (!sameLane({ lane: fromLane, y: fromY }, e)) return
      s.destroy()
      this.damageEnemy(e, 1, Math.sign(e.x - this.boy.x) || 1, { lane: fromLane, y: fromY })
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      const g = this.girl
      const fromLane = (j.getData('lane') as number | undefined) ?? g?.lane ?? this.boy.lane
      const fromY = (j.getData('fromY') as number | undefined) ?? g?.y ?? this.boy.y
      if (!sameLane({ lane: fromLane, y: fromY }, e)) return
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - (g?.x ?? this.boy.x)) || 1, { lane: fromLane, y: fromY })
    })
    // Enemy body ↔ player hurtbox
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as PatrolEnemy))
    this.physics.add.overlap(this.boy, this.hazards, (_b, hz) => {
      const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
      if (kind === 'lava') this.hazardHit(this.boy, { knockX: this.boy.facing * -220, knockY: -600, label: '熔岩' })
      else this.spike(this.boy)
    })
    this.physics.add.overlap(this.boy, this.coinPickups, (_b, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.honeyPickups, (_b, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
    if (this.girl) {
      const g = this.girl
      this.physics.add.overlap(g, this.enemies, (_g, e) => this.hurtHero(g, e as PatrolEnemy))
      this.physics.add.overlap(g, this.hazards, (_g, hz) => {
        const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
        if (kind === 'lava') this.hazardHit(g, { knockX: g.facing * -220, knockY: -600, label: '熔岩' })
        else this.spike(g)
      })
      this.physics.add.overlap(g, this.coinPickups, (_g, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
      this.physics.add.overlap(g, this.honeyPickups, (_g, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
    }
  }


  private showIntro() {
    const box = this.add
      .text(
        480,
        200,
        '第１關・奪回春蜜與鮭供\n△三角組織雇來的傀儡擋路\n倫寶・鮭魚槍（有射程）｜琪寶寶・劍×１.５速\n噗噗跟在琪寶寶身後；她受傷才噴蜜反擊\n上／中／下三線　ＷＳ／↑↓換線　同線先打到\n\n按空白鍵／點擊　或稍候自動開始',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '15px',
          color: '#f7e7c0',
          backgroundColor: '#4a2a18ee',
          padding: { x: 16, y: 12 },
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.FX)

    this.boy.setVelocity(0, 0)
    this.girl?.setVelocity(0, 0)

    const go = () => {
      if (this.started) return
      this.started = true
      this.startedAt = this.time.now
      box.destroy()
      this.emitScore(
        this.mode === '1p'
          ? '單人：只有倫寶　ＷＳ換線　Ｋ跳　Ｊ鮭魚槍｜Ｒ回選單'
          : '雙人：ＷＳ／↑↓換線　Ｋ／２跳｜噗噗跟琪寶寶｜Ｒ回選單',
      )
    }
    this.time.delayedCall(120, () => {
      this.input.keyboard?.once('keydown', go)
      this.input.once('pointerdown', go)
    })
    // Auto-start so「載入後沒反應」不會卡在說明框。
    this.time.delayedCall(4200, go)
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
      this.honeyGot = Math.min(3, this.honeyGot + 1)
      floatText(this, x, y - 36, '春蜜＋１', '#ffcc44')
    } else {
      this.spawnCoin?.(x, y - 10)
      floatText(this, x, y - 36, '＋1幣', '#ffe08a')
    }
  }

  private takeHoneyPickup(item: Phaser.Physics.Arcade.Sprite) {
    if (!item.active) return
    item.disableBody(true, true)
    this.honeyGot = Math.min(3, this.honeyGot + 1)
    SFX.kill(); burst(this, item.x, item.y, 0xffc050, 12)
    floatText(this, item.x, item.y - 18, '春蜜＋１', '#ffcc44')
  }

  private takeCoin(coin: Phaser.Physics.Arcade.Sprite) {
    if (!coin.active) return
    coin.disableBody(true, true)
    this.coinStock += 1
    SFX.coin()
    burst(this, coin.x, coin.y, 0xffe08a, 8)
    floatText(this, coin.x, coin.y - 16, '＋1幣', '#ffe08a')
    this.refreshCoins()
  }

  private checkWin() {
    if (this.ended || !this.started) return
    if (this.bossOn) {
      const alive = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && e.boss
      })
      if (alive) return
    } else return
    if (this.boyGoal && this.girlGoal) {
      const timeSec = (this.time.now - this.startedAt) / 1000
      this.scorePts = calcScore({
        timeSec, honey: this.honeyGot, hpBoy: this.boy.hp, hpGirl: this.girl?.hp ?? 0, deaths: this.deaths,
      })
      saveScore({ score: this.scorePts, timeSec, honey: this.honeyGot, mode: this.mode, at: Date.now() })
      this.win(
        `春蜜奪回！\n溪流小路　通關\n${timeSec.toFixed(1)}秒　蜜罐 ${this.honeyGot}/3\n得分 ${this.scorePts}\n按Ｒ鍵回選單`,
      )
    }
  }

  private win(msg: string) {
    this.ended = true
    this.awaitingContinue = false
    this.boy.setVelocity(0, 0)
    this.girl?.setVelocity(0, 0)
    SFX.win()
    // Clear fanfare — multi-flash + ring of sparks
    this.cameras.main.flash(320, 255, 230, 160)
    this.time.delayedCall(180, () => this.cameras.main.flash(200, 255, 255, 200))
    this.time.delayedCall(360, () => this.cameras.main.shake(200, 0.012))
    burst(this, this.goal.x, this.goal.y - 40, 0xffe08a, 20)
    impactRing(this, this.goal.x, this.goal.y - 40, 0xffe08a, 18)
    floatText(this, this.cameras.main.scrollX + 480, 140, 'STAGE CLEAR', '#ffe08a', {
      size: 36,
      rise: 20,
      dur: 1400,
    })
    EventBus.emit(GameEvents.GAME_OVER, {
      active: true,
      message: `◆ 通關 ◆\n${msg}`,
      canContinue: false,
      win: true,
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
      enablePixelSprite(s)
    }
  }

  /**
   * 分段出場：開場冇怪 → 行一段先出第一波 → 清完先解鎖右手邊後續波。
   * unlockX = 玩家 leadX 達到才啟用（inactive 直到解鎖）。
   */
  private placeEnemies() {
    // Wave 1 — 開場走一陣（約 x≥620）先打，清咗先繼續。
    const w1 = [
      this.mkEnemy(780, GROUND_Y, 'blocker', undefined, 'fish', 1),
      this.mkEnemy(860, GROUND_Y, 'blocker', undefined, 'fish', 2),
      this.mkEnemy(940, GROUND_Y, 'chaser', undefined, 'fish', 0),
    ]
    for (const e of w1) this.deferEnemy(e, 620, 'wave1')

    // Wave 2+ — 全部更右，等 lead 推進先出。
    const later: Array<[number, EnemyKind, EnemySpecies | undefined, LaneId, number]> = [
      [1280, 'chaser', 'fish', 2, 1100],
      [1500, 'blocker', 'fish', 0, 1100],
      [1180, 'ambusher', 'barrel', 0, 1100],
      [1750, 'ambusher', 'barrel', 0, 1550],
      [1980, 'chaser', 'fish', 1, 1700],
      [2080, 'guardian', 'fish', 0, 1850],
      [2400, 'interrupter', 'barrel', 1, 2100],
      [2680, 'guardian', 'barrel', 1, 2400],
    ]
    for (const [x, kind, sp, lane, unlock] of later) {
      const e = this.mkEnemy(x, GROUND_Y, kind, kind === 'guardian' ? x : undefined, sp, lane)
      this.deferEnemy(e, unlock, 'later')
    }
    const a1 = this.mkEnemy(2920, GROUND_Y, 'ambusher', undefined, 'barrel', 0)
    const a2 = this.mkEnemy(3320, GROUND_Y, 'ambusher', undefined, 'barrel', 1)
    const a3 = this.mkEnemy(3520, GROUND_Y, 'ambusher', undefined, 'barrel', 2)
    for (const a of [a1, a2, a3]) {
      a.altarAmbush = true
      this.deferEnemy(a, WORLD_W - 1100, 'altar')
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
    pick.staggerUntil = this.time.now + ENEMY_STAGGER_HOLD_MS
    pick.setVelocityX(0)
    pick.setTint(0xaaccff)
  }

  private activateDeferredEnemies() {
    const lead = this.leadX()
    const cam = this.cameras.main
    // Gate wave2 until wave1 cleared.
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
      // 從畫面右邊外走入 — 唔憑空彈出。
      const enterX = Math.min(
        WORLD_W - 24,
        cam.scrollX + cam.width + 48 + stagger * 72,
      )
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
      e.setFlipX(true) // face left toward player
      e.setVelocityX(-ENEMY_SPEED)
      if (wave === 'wave1' && !this.registry.get('wave1Announced')) {
        this.registry.set('wave1Announced', true)
        floatText(this, cam.scrollX + 720, 120, '傀儡來襲！', '#ff6644')
      }
    })
  }

  /** Wake altar ambushers — they already enter from the right; just harden chase. */
  private triggerAltarAmbush() {
    this.altarAmbushOn = true
    SFX.boss()
    this.cameras.main.flash(160, 255, 120, 80)
    this.emitScore('祭壇伏兵！木桶武者突襲')
    floatText(this, this.cameras.main.scrollX + 480, 120, '祭壇伏兵！', '#ff6644')
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
          // Bigger / brighter windup ring so attack intent reads before the lunge.
          impactRing(
            this,
            en.x,
            en.y - 18,
            kindT === 'ambush' ? 0xff4422 : 0xffcc66,
            kindT === 'ambush' ? 18 : 14,
          )
          en.setTint(kindT === 'ambush' ? 0xff2222 : 0xff8866)
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
