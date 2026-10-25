import Phaser from 'phaser'
import { burst, floatText, impactRing, scorePop, startIFrameBlink, JuiceManager } from './fx'
import {
  enablePixelSprite,
  setDiePoseVisual,
  setHurtPoseVisual,
  setIdlePose,
  setJumpPose,
  setRunPose,
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
  private girl!: Hero
  private pet!: Phaser.Physics.Arcade.Sprite
  private petShadow!: Phaser.GameObjects.Image
  private fan!: Phaser.GameObjects.Image
  private fanGlow!: Phaser.GameObjects.Arc
  private boyShadow!: Phaser.GameObjects.Image
  private girlShadow!: Phaser.GameObjects.Image
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
  private solidsLayer: Phaser.Tilemaps.TilemapLayer | null = null
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
  private clouds!: Phaser.GameObjects.TileSprite
  private mountFar!: Phaser.GameObjects.TileSprite
  private mountNear!: Phaser.GameObjects.TileSprite
  private villageBand?: Phaser.GameObjects.TileSprite
  /** Entity registry — players/enemies/projectiles live here, not in HUD. */
  private entities = new EntityManager()
  private debugOverlay!: DebugOverlay
  private juice!: JuiceManager

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
    // Round-1 feel: soft follow + world bounds. roundPixels must stay on for pixelArt.
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setRoundPixels(true)
    this.camTarget = this.add.zone((this.boy.x + this.girl.x) / 2, WORLD_H / 2, 1, 1)
    this.cameras.main.startFollow(this.camTarget, true, 0.18, 0.18)
    this.cameras.main.setDeadzone(110, 56)
  }

  private updateCameraFollow() {
    if (!this.camTarget || !this.boy || !this.girl) return
    const midX = (this.boy.x + this.girl.x) / 2
    this.camTarget.setPosition(
      Math.round(Phaser.Math.Clamp(midX, 480, WORLD_W - 480)),
      WORLD_H / 2,
    )
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
    if (!this.boy || !this.girl) return
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      boyHp: Math.max(0, this.boy.hp),
      girlHp: Math.max(0, this.girl.hp),
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
        heroes: [this.boy, this.girl],
        enemies: (this.enemies?.getChildren() ?? []) as Creep[],
        pet: this.pet,
      })
      return
    }
    if (!this.started) {
      this.debugOverlay.draw({
        heroes: [this.boy, this.girl],
        enemies: (this.enemies?.getChildren() ?? []) as Creep[],
        pet: this.pet,
      })
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) { this.stopUi(); this.scene.restart() }

    // Fixed logic step: combat timers first, then steer, then AI.
    tickCombatTimers(this.boy, dt)
    tickCombatTimers(this.girl, dt)
    this.boy.atkCd = Math.max(0, this.boy.atkCd - dt)
    this.girl.atkCd = Math.max(0, this.girl.atkCd - dt)

    this.moveBoy(dt)
    if (this.mode === '2p') this.moveGirl(dt)
    else this.aiGirl(dt)

    this.updatePet()
    this.updateEnemies(dt)
    this.entities.syncEnemiesFromGroup(this.enemies)
    this.syncFx()
    this.animateBg()
    this.checkFall()
    this.updateCheckpoint()

    this.boyGoal = !!this.physics.overlap(this.boy, this.goal)
    this.girlGoal = !!this.physics.overlap(this.girl, this.goal)

    this.tickStageBeats()

    // Altar climax: 2–3 barrel ambushers wake with clear telegraph before boss.
    if (!this.altarAmbushOn && Math.max(this.boy.x, this.girl.x) > WORLD_W - 980) {
      this.triggerAltarAmbush()
    }

    if (!this.bossOn && Math.max(this.boy.x, this.girl.x) > WORLD_W - 780) {
      this.bossOn = true
      this.spawnBoss(WORLD_W - 420, GROUND_Y)
      SFX.boss()
      this.emitScore('關底・醃鮭魚武者！合力奪回春蜜')
    }

    this.updateCameraFollow()

    const pct = Math.min(100, Math.floor((Math.max(this.boy.x, this.girl.x) / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.scorePts = this.liveScore()
    this.emitScore(
      `${this.mode === '1p' ? '單人' : '雙人'}　進度 ${pct}%　${sec}秒　春蜜 ${this.honeyGot}/3`,
    )
    this.emitHealth()
    this.checkWin()

    this.debugOverlay.draw({
      heroes: [this.boy, this.girl],
      enemies: this.enemies.getChildren() as Creep[],
      pet: this.pet,
    })
  }

  private liveScore() {
    return (
      calcScore({
        timeSec: (this.time.now - this.startedAt) / 1000,
        honey: this.honeyGot,
        hpBoy: Math.max(0, this.boy.hp),
        hpGirl: Math.max(0, this.girl.hp),
        deaths: this.deaths,
      }) + this.killBonus
    )
  }

  /** flat → platforms → ambush → altar — one readable story beat each. */
  private tickStageBeats() {
    const lead = Math.max(this.boy.x, this.girl.x)
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
    const lead = Math.max(this.boy.x, this.girl.x)
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

  private applyHeroPose(h: Hero, grounded: boolean, vx: number) {
    if (h.hp <= 0 || h.pose === 'die') {
      setDiePoseVisual(h, h.baseScale, h.facing)
      return
    }
    if (h.pose === 'hurt' || h.hurtLock > 0) {
      if (h.hurtLock <= 0) {
        h.pose = grounded ? 'idle' : 'jump'
        h.clearTint()
        // fall through to idle/run/jump posing below
      } else {
        h.pose = 'hurt'
        setHurtPoseVisual(h, h.baseScale, h.facing)
        return
      }
    }
    // Attack squash tween owns scale/angle briefly — avoid fighting input feedback.
    if (h.atkCd > 120) {
      if (!grounded) h.pose = 'jump'
      else if (Math.abs(vx) > 12) h.pose = 'run'
      else h.pose = 'idle'
      return
    }
    if (!grounded) {
      h.pose = 'jump'
      setJumpPose(h, h.baseScale, h.facing)
      return
    }
    if (Math.abs(vx) > 12) {
      h.pose = 'run'
      h.walkPhase += Math.abs(vx) * 0.0005
      setRunPose(h, h.baseScale, h.walkPhase)
      return
    }
    h.pose = 'idle'
    setIdlePose(h, h.baseScale, this.time.now)
  }

  /** Snap actors + shadows onto the integer pixel grid after motion/FX. */
  private snapPixelArt() {
    const enemies = (this.enemies?.getChildren() ?? []) as Creep[]
    snapWorldActors({
      heroes: [this.boy, this.girl],
      pet: this.pet,
      enemies,
      shadows: [this.boyShadow, this.girlShadow, this.petShadow],
      shadowSources: [
        { x: this.boy.x, y: this.boy.y, oy: 4 },
        { x: this.girl.x, y: this.girl.y, oy: 4 },
        { x: this.pet.x, y: this.pet.y, oy: 4 },
      ],
      extras: [this.fan, this.fanGlow],
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
    this.steerHero(
      this.girl, dt, !!this.cursors.left?.isDown, !!this.cursors.right?.isDown,
      this.p2JumpJust(), this.p2JumpHeld(), GIRL_SPEED,
      this.p2AttackJust(), () => this.fanSlash(this.girl),
      this.p2LaneUpHeld(), this.p2LaneDownHeld(),
    )
  }

  private aiGirl(dt: number) {
    const g = this.girl
    if (g.hurtLock > 0 || g.pose === 'die' || !g.alive) {
      this.applyHeroPose(g, true, 0)
      return
    }
    const dx = this.boy.x - 56 - g.x
    this.steerHero(
      g, dt, dx < -20, dx > 20, false, false, GIRL_SPEED * 0.9, false, () => {},
      this.boy.lane < g.lane, this.boy.lane > g.lane,
    )
    if (g.atkCd <= 0) {
      const near = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && Math.abs(e.x - g.x) < 78 && sameLane(g, e)
      })
      if (near) this.fanSlash(g)
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

  private fireSalmon(h: Hero) {
    h.atkCd = 220
    h.pose = 'idle'
    SFX.swing()
    // Attack juice without rotation/non-uniform scale — those shear NEAREST columns.
    this.tweens.killTweensOf(h)
    h.setAngle(0)
    h.setScale(h.baseScale)
    const shot = this.shots.create(h.x + h.facing * 36, h.y - 36, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.5).setDepth(actorDepth('shot', h.lane)).setFlipX(h.facing < 0)
    enablePixelSprite(shot)
    ;(shot.body as Phaser.Physics.Arcade.Body).allowGravity = false
    shot.setVelocityX(h.facing * 560)
    shot.setData('lane', h.lane)
    shot.setData('fromY', h.y)
    this.spawnAttackHitbox(h, 1, 72, 48, 150)
    this.smashBreakablesInFront(h)
    this.entities.add(shot, 'projectile')
    this.time.delayedCall(850, () => shot.destroy())
  }

  private fanSlash(h: Hero) {
    h.atkCd = 240
    SFX.swing()
    burst(this, h.x + h.facing * 44, h.y - 28, 0xffc0d0, 8)
    this.fanGlow.setAlpha(0.6)
    this.tweens.add({ targets: this.fanGlow, alpha: 0.15, duration: 160 })
    h.setAngle(0)
    h.setScale(h.baseScale)
    this.spawnAttackHitbox(h, 2, 84, 56, 150)
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
    box.setAlpha(0).setDepth(actorDepth('hitbox', h.lane))
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
    if (this.petJetting || this.girl.hp <= 0) return
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
    const jet = this.honeys.create(this.pet.x + dir * 16, this.pet.y - 20, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(1.55).setDepth(actorDepth('shot', this.girl.lane))
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
    else pe.contactCd = 700
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
    this.hazardHit(h, { knockX: h.facing * -180, knockY: -480, label: '尖刺' })
  }
  private hazardHit(h: Hero, opts: { knockX: number; knockY: number; label?: string } = { knockX: 0, knockY: -480 }) {
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
    for (const h of [this.boy, this.girl]) {
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
    const leadX = Math.max(this.boy.x, this.girl.x)
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

  /** 噗噗 AI: trail 琪寶寶 beside/behind — never stacked in her/倫寶 feet. */
  private updatePet() {
    const g = this.girl
    const awayFromBoy = Math.sign(g.x - this.boy.x) || -g.facing
    const side = awayFromBoy !== 0 ? awayFromBoy : -g.facing
    const followX = g.x + side * 70
    const followY = laneY(g.lane)
    const dx = followX - this.pet.x
    const dy = followY - this.pet.y
    const speed = this.petJetting ? 220 : 340
    const dist = Math.hypot(dx, dy)
    if (dist > 6) {
      const nx = dx / dist
      const ny = dy / dist
      const step = Math.min(dist, (speed * this.game.loop.delta) / 1000)
      this.pet.setPosition(this.pet.x + nx * step, this.pet.y + ny * step)
    } else {
      this.pet.setPosition(followX, followY)
    }
    this.pet.setVelocity(0, 0)
    this.pet.setFlipX(g.facing < 0)
    this.pet.setScale(1)
    this.pet.setAlpha(this.petJetting ? 1 : 0.85)
    this.pet.setVisible(true)
    this.pet.setActive(true)
    this.pet.setDepth(actorDepth('pet', g.lane))
    this.pet.setData('lane', g.lane)
  }

  private syncFx() {
    this.boyShadow.setPosition(this.boy.x, laneY(this.boy.lane) + 4)
    this.petShadow.setPosition(this.pet.x, laneY(this.girl.lane) + 4)
    this.girlShadow.setPosition(this.girl.x, laneY(this.girl.lane) + 4)
    this.fan.setPosition(this.girl.x - this.girl.facing * 22, this.girl.y - 52)
    this.fan.setFlipX(this.girl.facing < 0)
    this.fan.setDepth(actorDepth('fan', this.girl.lane))
    this.fanGlow.setPosition(this.fan.x, this.fan.y)
    this.fanGlow.setDepth(actorDepth('fan', this.girl.lane) - 0.1)
    this.boyShadow.setDepth(DEPTH.SHADOW)
    this.girlShadow.setDepth(DEPTH.SHADOW)
    this.petShadow.setDepth(DEPTH.SHADOW)
  }

  private animateBg() {
    if (!this.water) return
    const sx = this.cameras.main.scrollX
    const t = this.time.now
    snapTilePosition(this.water, sx * 0.45 + t * 0.025)
    snapTilePosition(this.waterMid, sx * 0.5 + t * 0.032)
    snapTilePosition(this.waterFoam, sx * 0.55 + t * 0.04)
    snapTilePosition(this.clouds, sx * 0.08 + t * 0.005)
    snapTilePosition(this.mountFar, sx * 0.12)
    snapTilePosition(this.villageBand, sx * 0.18)
    snapTilePosition(this.mountNear, sx * 0.28)
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
    const g = this.add.graphics().setDepth(DEPTH.SKY)
    g.fillStyle(0x6ab4e0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0xa8d8f5, 1)
    g.fillRect(0, 0, WORLD_W, 150)
    g.fillStyle(0xffe8b0, 0.5)
    g.fillRect(0, 160, WORLD_W, 200)
    g.fillStyle(0xfff6d0, 0.55)
    g.fillCircle(160, 70, 78)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(160, 70, 30)

    // Parallax bands stacked without Y overlap so different scroll rates cannot
    // shear a shared horizontal cut through hills / village / water.
    if (this.textures.exists('bg-sky')) {
      const sky = this.add
        .tileSprite(480, 96, 960, 192, 'bg-sky')
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY_BAND)
        .setAlpha(0.5)
      enablePixelSprite(sky)
    }

    this.clouds = this.add
      .tileSprite(480, 48, 960, 64, 'bg-cloud')
      .setScrollFactor(0)
      .setDepth(DEPTH.CLOUD)
      .setAlpha(0.82)
    enablePixelSprite(this.clouds)
    this.mountFar = this.add
      .tileSprite(480, 200, 960, 128, 'bg-mount-far')
      .setScrollFactor(0)
      .setDepth(DEPTH.MOUNT_FAR)
      .setAlpha(0.92)
    enablePixelSprite(this.mountFar)
    if (this.textures.exists('bg-village')) {
      this.villageBand = this.add
        .tileSprite(480, 268, 960, 64, 'bg-village')
        .setScrollFactor(0)
        .setDepth(DEPTH.VILLAGE)
        .setAlpha(0.85)
      enablePixelSprite(this.villageBand)
    }
    this.mountNear = this.add
      .tileSprite(480, 332, 960, 64, 'bg-mount-near')
      .setScrollFactor(0)
      .setDepth(DEPTH.MOUNT_NEAR)
    enablePixelSprite(this.mountNear)

    for (let x = 140; x < WORLD_W; x += 220) {
      this.placeDecor(x, 'prop-tree3d', 1.15 + ((x / 220) % 3) * 0.08, 1.15)
    }
    for (let x = 380; x < WORLD_W; x += 680) {
      this.placeDecor(x, 'prop-torii', 1.12, 1.7)
      this.placeDecor(x + 140, 'prop-house3d', 1.2, 1.35)
      if (x + 300 < WORLD_W) this.placeDecor(x + 300, 'prop-house3d', 1.0, 1.15, true)
      if (this.textures.exists('prop-shrine')) this.placeDecor(x + 60, 'prop-shrine', 1.1, 0.85)
    }
    for (let x = 240; x < WORLD_W; x += 320) {
      if (this.textures.exists('prop-banner')) this.placeDecor(x, 'prop-banner', 1.35, 0.5)
    }
    for (let x = 70; x < WORLD_W; x += 160) {
      this.placeDecor(x, 'prop-lantern3d', 1.25, 0.5)
    }
    for (let x = 500; x < WORLD_W; x += 520) {
      if (this.textures.exists('prop-honey-stack')) this.placeDecor(x + 40, 'prop-honey-stack', 1.2, 0.85)
      if (this.textures.exists('prop-bush')) this.placeDecor(x - 50, 'prop-bush', 1.3, 0.7)
    }
    for (let x = 200; x < WORLD_W; x += 290) {
      if (this.textures.exists('fg-rock')) {
        this.add.image(x, GROUND_Y + 5, 'shad').setDepth(DEPTH.PROP_SHADOW).setAlpha(0.4).setScale(0.65, 0.45)
        const rock = this.add.image(x, GROUND_Y + 2, 'fg-rock').setOrigin(0.5, 1).setDepth(DEPTH.PROP_FG).setScale(1.3)
        enablePixelSprite(rock)
      }
      if (this.textures.exists('fg-reed')) {
        const reed = this.add.image(x + 40, GROUND_Y + 2, 'fg-reed').setOrigin(0.5, 1).setDepth(DEPTH.PROP_FG).setScale(1.2)
        enablePixelSprite(reed)
      }
    }
    if (this.textures.exists('prop-bridge')) {
      for (const bx of [520, 920, 1860, 2740]) {
        this.add.image(bx, GROUND_Y + 7, 'shad').setDepth(DEPTH.PROP_SHADOW).setAlpha(0.45).setScale(1.9, 0.5)
        const br = this.add.image(bx, GROUND_Y + 2, 'prop-bridge').setOrigin(0.5, 1).setDepth(DEPTH.PROP).setScale(1.6)
        enablePixelSprite(br)
      }
    }

    // Water stack: deep → mid → foam, integer heights matching POT textures.
    this.water = this.add
      .tileSprite(480, 520, 960, 64, 'water-deep')
      .setScrollFactor(0)
      .setDepth(DEPTH.WATER_DEEP)
    enablePixelSprite(this.water)
    if (this.textures.exists('water-mid')) {
      this.waterMid = this.add
        .tileSprite(480, 500, 960, 32, 'water-mid')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_MID)
        .setAlpha(0.75)
      enablePixelSprite(this.waterMid)
    }
    if (this.textures.exists('water-foam')) {
      this.waterFoam = this.add
        .tileSprite(480, 488, 960, 16, 'water-foam')
        .setScrollFactor(0)
        .setDepth(DEPTH.WATER_FOAM)
        .setAlpha(0.9)
      enablePixelSprite(this.waterFoam)
    }
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pots = this.physics.add.group()
    this.coinPickups = this.physics.add.group()
    this.honeyPickups = this.physics.add.group()
    this.levelMap = createRound1Tilemap(this, this.pots, this.hazards)
    this.solidsLayer = (this.levelMap?.solids as Phaser.Tilemaps.TilemapLayer | null) ?? null

    const banks: Array<[number, number]> = [
      [0, 480], [560, 280], [960, 300], [1400, 340],
      [1880, 280], [2300, 320], [2760, 300], [3200, 600],
    ]
    for (const [x, w] of banks) this.bank(x, LANE_FLOOR_Y, w)

    this.woodPlat(420, 300, 3)
    this.woodPlat(720, 240, 3)
    this.woodPlat(1100, 280, 3)
    this.woodPlat(1280, 200, 2)
    this.woodPlat(1680, 250, 4)
    this.woodPlat(2100, 220, 3)
    this.woodPlat(2480, 260, 3)
    this.woodPlat(2900, 210, 3)
    this.stonePlat(900, 160, 2)
    this.stonePlat(1900, 150, 2)
    this.stonePlat(2600, 170, 2)
    // Mid platforms with real clearance — never GROUND_Y-8 (body jam / sticking).
    this.woodPlat(500, GROUND_Y - 96, 2)
    this.woodPlat(860, GROUND_Y - 96, 2)
    this.woodPlat(1820, GROUND_Y - 88, 3)
    this.woodPlat(2680, GROUND_Y - 88, 3)

    this.spikes(540, 3)
    this.spikes(1840, 3)
    this.spikes(2700, 3)

    // First pot near spawn so early smash juice lands in the opening seconds.
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
    this.spawnCoin(760, 240 - 36)
    this.spawnCoin(1720, 250 - 36)

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

    // Readable stage-beat signs — prop band, never pierce heroes or mountain BG.
    const signs: Array<[number, string]> = [
      [180, '平地・溪流'],
      [780, '平台帶'],
      [1750, '伏兵區'],
      [3000, '祭壇前'],
    ]
    for (const [sx, label] of signs) {
      this.add
        .text(sx, GROUND_Y - 96, label, {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '13px',
          color: '#3a2818',
          backgroundColor: '#f0e0b8cc',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.SIGN)
        .setAlpha(0.9)
    }
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
    const midY = laneY(LANE_DEFAULT)
    this.boy = Player.spawn(this, 250, midY, {
      role: 'boy', texture: 'art-salmon', graceUntil: grace, scale: 2, speed: BOY_SPEED,
    })
    this.girl = Player.spawn(this, 330, midY, {
      role: 'girl', texture: 'art-girl', graceUntil: grace, scale: 2, speed: GIRL_SPEED,
    })
    this.boy.snapToLane(LANE_DEFAULT, 250)
    this.girl.snapToLane(LANE_DEFAULT, 330)
    this.entities.add(this.boy, 'player')
    this.entities.add(this.girl, 'player')
    // Spawn 噗噗 beside 琪寶寶 (not between her and 倫寶).
    this.pet = this.physics.add.sprite(400, midY, 'art-bear')
    this.pet.setOrigin(0.5, 1)
    this.pet.setScale(1).setAlpha(0.85).setDepth(actorDepth('pet', LANE_DEFAULT)).setVisible(true)
    enablePixelSprite(this.pet)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.pet.setData('lane', LANE_DEFAULT)
    this.entities.add(this.pet, 'pet')
    const fanKey = this.textures.exists('fan3d') ? 'fan3d' : 'prop-fan'
    this.fan = this.add.image(330, midY - 52, fanKey).setDepth(actorDepth('fan', LANE_DEFAULT)).setScale(1.6)
    enablePixelSprite(this.fan)
    this.fanGlow = this.add.circle(330, midY - 52, 12, 0x88ddff, 0.2).setDepth(actorDepth('fan', LANE_DEFAULT) - 0.1)
    this.fan.setAngle(0)
    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.boyShadow = this.add.image(250, midY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.55).setScale(1.2, 0.75)
    this.girlShadow = this.add.image(330, midY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.55).setScale(1.15, 0.75)
    this.petShadow = this.add.image(400, midY + 4, shad).setDepth(DEPTH.SHADOW).setAlpha(0.35).setScale(0.55, 0.45)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.attackHitboxes = this.physics.add.group()
    this.shots = this.physics.add.group()
    this.honeys = this.physics.add.group()
    this.placeEnemies()

    this.physics.add.collider(this.boy, this.ground)
    this.physics.add.collider(this.girl, this.ground)
    this.physics.add.collider(this.enemies, this.ground)
    if (this.solidsLayer) {
      this.physics.add.collider(this.boy, this.solidsLayer)
      this.physics.add.collider(this.girl, this.solidsLayer)
      this.physics.add.collider(this.enemies, this.solidsLayer)
    }

    this.physics.add.overlap(this.shots, this.pots, (shot, pot) => {
      ;(shot as Phaser.Physics.Arcade.Sprite).destroy()
      this.breakPot(pot as Breakable)
    })
    // Hitboxes → overlap
    for (const hero of [this.boy, this.girl]) {
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
      const fromLane = (j.getData('lane') as number | undefined) ?? this.girl.lane
      const fromY = (j.getData('fromY') as number | undefined) ?? this.girl.y
      if (!sameLane({ lane: fromLane, y: fromY }, e)) return
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - this.girl.x) || 1, { lane: fromLane, y: fromY })
    })
    // Enemy body ↔ player hurtbox
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as PatrolEnemy))
    this.physics.add.overlap(this.girl, this.enemies, (_g, e) => this.hurtHero(this.girl, e as PatrolEnemy))
    this.physics.add.overlap(this.boy, this.hazards, () => this.spike(this.boy))
    this.physics.add.overlap(this.girl, this.hazards, () => this.spike(this.girl))
    this.physics.add.overlap(this.boy, this.hazards, (_b, hz) => {
      const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
      if (kind === 'lava') this.hazardHit(this.boy, { knockX: this.boy.facing * -220, knockY: -520, label: '熔岩' })
      else this.spike(this.boy)
    })
    this.physics.add.overlap(this.girl, this.hazards, (_g, hz) => {
      const kind = (hz as Phaser.Physics.Arcade.Sprite).getData('hazardKind') as string | undefined
      if (kind === 'lava') this.hazardHit(this.girl, { knockX: this.girl.facing * -220, knockY: -520, label: '熔岩' })
      else this.spike(this.girl)
    })
    // (hazards also wired below if duplicated — dedupe later)
    this.physics.add.overlap(this.boy, this.coinPickups, (_b, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.coinPickups, (_g, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))

    this.physics.add.overlap(this.boy, this.honeyPickups, (_b, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.honeyPickups, (_g, h) => this.takeHoneyPickup(h as Phaser.Physics.Arcade.Sprite))
  }


  private showIntro() {
    const box = this.add
      .text(
        480,
        200,
        '第１關・奪回春蜜\n倫寶・鮭魚槍　｜　琪寶寶・電風扇×１.５速\n上／中／下三線　｜　ＷＳ／↑↓換線　｜　Ｋ／２跳躍\n同線先打得到　｜　噗噗跟琪寶寶線\n琪寶寶受傷 → 噗噗噴蜜\n\n按空白鍵或點擊畫面開始',
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
      .setDepth(60)

    this.boy.setVelocity(0, 0)
    this.girl.setVelocity(0, 0)

    const go = () => {
      if (this.started) return
      this.started = true
      this.startedAt = this.time.now
      box.destroy()
      this.emitScore(
        this.mode === '1p'
          ? '單人：ＷＳ換線　Ｋ跳　Ｊ攻擊｜琪寶寶＋噗噗同行｜Ｒ回選單'
          : '雙人：ＷＳ／↑↓換線　Ｋ／２跳｜噗噗跟線｜Ｒ回選單',
      )
    }
    this.time.delayedCall(180, () => {
      this.input.keyboard?.once('keydown', go)
      this.input.once('pointerdown', go)
    })
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
        timeSec, honey: this.honeyGot, hpBoy: this.boy.hp, hpGirl: this.girl.hp, deaths: this.deaths,
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
    this.girl.setVelocity(0, 0)
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
      this.girl.awaitingContinue = true
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
      this.girl.awaitingContinue = false
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
    for (const h of [this.boy, this.girl]) {
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
    const t = this.ground.create(x, surfaceY, tex) as Phaser.Physics.Arcade.Sprite
    t.setOrigin(0.5, 0)
    t.refreshBody()
    t.setDepth(DEPTH.GROUND)
    enablePixelSprite(t)
    return t
  }

  private bank(x: number, surfaceY: number, w: number) {
    const tex = this.textures.exists('blk-grass') ? 'blk-grass' : 'til-grass'
    for (let i = x; i < x + w; i += 36) this.placeSurfaceTile(i + 18, surfaceY, tex)
  }

  private woodPlat(x: number, surfaceY: number, n: number) {
    const tex = this.textures.exists('blk-wood') ? 'blk-wood' : 'til-wood'
    for (let i = 0; i < n; i++) this.placeSurfaceTile(x + i * 36 + 18, surfaceY, tex)
  }

  private stonePlat(x: number, surfaceY: number, n: number) {
    const tex = this.textures.exists('blk-stone') ? 'blk-stone' : 'til-wood'
    for (let i = 0; i < n; i++) this.placeSurfaceTile(x + i * 34 + 17, surfaceY, tex)
  }

  private spikes(x: number, n: number) {
    const tex = this.textures.exists('blk-spike') ? 'blk-spike' : 'til-spike'
    for (let i = 0; i < n; i++) {
      const s = this.hazards.create(x + i * 26 + 12, LANE_FLOOR_Y + 8, tex) as Phaser.Physics.Arcade.Sprite
      s.setOrigin(0.5, 0)
      s.refreshBody()
      s.setDepth(DEPTH.HAZARD)
      enablePixelSprite(s)
    }
  }

  private placeEnemies() {
    const opener = this.mkEnemy(450, GROUND_Y, 'blocker', undefined, 'fish', 1)
    opener.earlyAggro = true
    opener.detectRadius = 360
    opener.aggroRadius = 300
    this.mkEnemy(1500, GROUND_Y, 'blocker', undefined, 'fish', 0)
    this.mkEnemy(1050, GROUND_Y, 'chaser', undefined, 'fish', 2)
    this.mkEnemy(1980, GROUND_Y, 'chaser', undefined, 'fish', 1)
    this.mkEnemy(740, 240, 'ambusher', undefined, 'barrel', 0)
    this.mkEnemy(1750, 250, 'ambusher', undefined, 'barrel', 0)
    this.mkEnemy(1180, GROUND_Y, 'guardian', 1200, 'barrel', 2)
    this.mkEnemy(2080, GROUND_Y, 'guardian', 2050, 'fish', 0)
    this.mkEnemy(2960, GROUND_Y, 'guardian', 3000, 'barrel', 1)
    this.mkEnemy(2680, GROUND_Y, 'interrupter', undefined, 'barrel', 2)
    const a1 = this.mkEnemy(2920, 210, 'ambusher', undefined, 'barrel', 0)
    const a2 = this.mkEnemy(3320, GROUND_Y, 'ambusher', undefined, 'barrel', 1)
    const a3 = this.mkEnemy(3520, GROUND_Y, 'ambusher', undefined, 'barrel', 2)
    for (const a of [a1, a2, a3]) a.altarAmbush = true
  }

  /** Wake altar-front barrel ambushers with clear red telegraph. */
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
      impactRing(this, e.x, e.y - 20, 0xff5533, 16)
      floatText(this, e.x, e.y - 48, '伏兵！', '#ff4422')
      e.setFsm('CHASE')
      e.think = 160
      // Force a readable windup telegraph before the first lunge.
      this.time.delayedCall(180 + Math.random() * 120, () => {
        if (!e.active || e.fsm === 'DEAD' || e.fsm === 'HURT') return
        e.setFsm('ATTACK')
        e.atkPhase = 'windup'
        e.windup = 320
        e.hitThis = false
        e.setVelocityX(0)
        e.setTint(0xff1111)
        impactRing(this, e.x, e.y - 18, 0xff4422, 12)
      })
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
            kindT === 'ambush' ? 0xff4422 : 0xffaa66,
            kindT === 'ambush' ? 14 : 10,
          )
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
