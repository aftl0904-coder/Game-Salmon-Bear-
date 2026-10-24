import Phaser from 'phaser'
import { burst, floatText, hitstop, startIFrameBlink, JuiceManager } from './fx'
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
  MAX_HP,
  BOY_SPEED,
  GIRL_SPEED,
  HURT_LOCK_MS,
  HURT_IFRAME_MS,
  FALL_Y,
  COINS_START,
  snapToGroundPlane,
  applyDamage,
  applyHurtPose,
  beginDeathPose,
  canTakeDamage,
  reviveActor,
  tickCombatTimers,
  EntityManager,
  DebugOverlay,
} from './engine'
import {
  createRound1Tilemap,
  hitBreakable,
  type Breakable,
  type LevelMapHandle,
  type LootKind,
} from './levelMap'

export { GROUND_Y }

/** Heroes are Player entities (accel/coyote/melee/i-frames). */
type Hero = Player

/**
 * Round 1 — 溪流小路
 * P1 倫寶：WASD + J/K/U/I（Ａ／Ｂ／Ｘ／Ｙ）
 * P2 琪寶寶：方向鍵 + 數字鍵 1/2/4/5（Ａ／Ｂ／Ｘ／Ｙ）
 * 噗噗（Pooh）：AI only，始終跟隨琪寶寶；受傷時噴蜂蜜噴流
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
  private honeyGot = 0
  private petJetting = false
  private scorePts = 0
  private deaths = 0
  coinStock = COINS_START
  private prevLeadX = 0
  private checkpointX = 110
  private water!: Phaser.GameObjects.TileSprite
  private clouds!: Phaser.GameObjects.TileSprite
  private mountFar!: Phaser.GameObjects.TileSprite
  private mountNear!: Phaser.GameObjects.TileSprite
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
    this.boyGoal = false
    this.girlGoal = false
    this.honeyGot = 0
    this.petJetting = false
    this.scorePts = 0
    this.deaths = 0
    this.coinStock = COINS_START
    this.prevLeadX = 120
    this.checkpointX = 110
    this.startedAt = this.time.now
    this.entities.clear()

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
    this.physics.world.drawDebug = this.physicsDebug
    this.launchUi()
    this.showIntro()
    this.emitHealth()
    this.emitScore()
    this.events.once('shutdown', this.onSceneShutdown, this)
  }

  private setupCameraFollow() {
    this.camTarget = this.add.zone((this.boy.x + this.girl.x) / 2, WORLD_H / 2, 1, 1)
    this.cameras.main.startFollow(this.camTarget, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(110, 56)
  }

  private updateCameraFollow() {
    if (!this.camTarget || !this.boy || !this.girl) return
    const midX = (this.boy.x + this.girl.x) / 2
    this.camTarget.setPosition(Phaser.Math.Clamp(midX, 480, WORLD_W - 480), WORLD_H / 2)
  }

  private onSceneShutdown() {
    if (typeof (this as any).stopUi === 'function') (this as any).stopUi()
    this.time.removeAllEvents()
    this.tweens.killAll()
    this.input.keyboard?.removeAllListeners()
    this.input.removeAllListeners()
    this.entities.destroy()
    this.debugOverlay?.destroy()
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
    this.physicsDebug = !this.physicsDebug
    const world = this.physics.world
    world.drawDebug = this.physicsDebug
    world.defaults.debugShowBody = this.physicsDebug
    world.defaults.debugShowVelocity = this.physicsDebug
    if (this.physicsDebug) {
      if (!world.debugGraphic || !world.debugGraphic.active) {
        world.createDebugGraphic()
      } else {
        world.debugGraphic.setVisible(true)
      }
    } else if (world.debugGraphic) {
      world.debugGraphic?.clear()
      world.debugGraphic.setVisible(false)
    }
    for (const body of world.bodies) {
      body.debugShowBody = this.physicsDebug
      body.debugShowVelocity = this.physicsDebug
    }
    for (const body of world.staticBodies) {
      body.debugShowBody = this.physicsDebug
    }
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
      this.physics.world.drawDebug = on
      this.physicsDebug = on
      if (!on) this.physics.world.debugGraphic?.clear()
      else if (!this.physics.world.debugGraphic) this.physics.world.createDebugGraphic()
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
    return calcScore({
      timeSec: (this.time.now - this.startedAt) / 1000,
      honey: this.honeyGot,
      hpBoy: Math.max(0, this.boy.hp),
      hpGirl: Math.max(0, this.girl.hp),
      deaths: this.deaths,
    })
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
    void this.keyS
  }

  private p1AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyJ) ||
      Phaser.Input.Keyboard.JustDown(this.keyU) ||
      Phaser.Input.Keyboard.JustDown(this.keyI)
    )
  }
  private p1JumpJust() {
    return Phaser.Input.Keyboard.JustDown(this.keyW) || Phaser.Input.Keyboard.JustDown(this.keyK)
  }
  private p1JumpHeld() {
    return this.keyW.isDown || this.keyK.isDown
  }
  private p2AttackJust() {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyNP1) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP4) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP5)
    )
  }
  private p2JumpJust() {
    return Phaser.Input.Keyboard.JustDown(this.cursors.up!) || Phaser.Input.Keyboard.JustDown(this.keyNP2)
  }
  private p2JumpHeld() {
    return !!(this.cursors.up?.isDown || this.keyNP2.isDown)
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
  ) {
    h.moveSpeed = speed
    h.updatePlayer(dt, {
      left,
      right,
      jumpJust,
      jumpHeld,
      attackJust,
      onJump: () => SFX.jump(),
      onAttack: doAttack,
      now: this.time.now,
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
      h.setAngle(h.facing * 90)
      h.setScale(h.baseScale * 1.05, h.baseScale * 0.7)
      return
    }
    if (h.pose === 'hurt' || h.hurtLock > 0) {
      if (h.hurtLock <= 0) {
        h.pose = grounded ? 'idle' : 'jump'
        h.clearTint()
        // fall through to idle/run/jump posing below
      } else {
        h.pose = 'hurt'
        h.setAngle(h.facing * -22)
        h.setScale(h.baseScale * 1.1, h.baseScale * 0.86)
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
      h.setScale(h.baseScale * 0.94, h.baseScale * 1.08)
      h.setAngle(h.facing * -8)
      return
    }
    if (Math.abs(vx) > 12) {
      h.pose = 'run'
      h.walkPhase += Math.abs(vx) * 0.0005
      const bob = Math.sin(h.walkPhase) * 0.05
      h.setScale(h.baseScale * (1 + bob * 0.35), h.baseScale * (1 - bob))
      h.setAngle(Math.sin(h.walkPhase) * 5 * h.facing)
      return
    }
    h.pose = 'idle'
    const breathe = Math.sin(this.time.now / 380) * 0.02
    h.setScale(h.baseScale * (1 + breathe), h.baseScale * (1 - breathe))
    h.setAngle(0)
  }

  private moveBoy(dt: number) {
    this.steerHero(
      this.boy, dt, this.keyA.isDown, this.keyD.isDown,
      this.p1JumpJust(), this.p1JumpHeld(), BOY_SPEED,
      this.p1AttackJust(), () => this.fireSalmon(this.boy),
    )
  }

  private moveGirl(dt: number) {
    this.steerHero(
      this.girl, dt, !!this.cursors.left?.isDown, !!this.cursors.right?.isDown,
      this.p2JumpJust(), this.p2JumpHeld(), GIRL_SPEED,
      this.p2AttackJust(), () => this.fanSlash(this.girl),
    )
  }

  private aiGirl(dt: number) {
    const g = this.girl
    if (g.hurtLock > 0 || g.pose === 'die' || !g.alive) {
      this.applyHeroPose(g, true, 0)
      return
    }
    const dx = this.boy.x - 56 - g.x
    const body = g.body as Phaser.Physics.Arcade.Body
    const wantJump = body.blocked.down && this.boy.y < g.y - 40
    this.steerHero(
      g, dt, dx < -20, dx > 20, wantJump, wantJump, GIRL_SPEED * 0.9, false, () => {},
    )
    if (g.atkCd <= 0) {
      const near = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && Math.abs(e.x - g.x) < 78 && Math.abs(e.y - g.y) < 50
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
    h.atkCd = 200
    SFX.swing()
    this.tweens.add({
      targets: h, scaleX: h.baseScale * 1.12, scaleY: h.baseScale * 0.9,
      angle: h.facing * 6, yoyo: true, duration: 70,
    })
    const shot = this.shots.create(h.x + h.facing * 32, h.y - 36, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.5).setDepth(11).setFlipX(h.facing < 0)
    ;(shot.body as Phaser.Physics.Arcade.Body).allowGravity = false
    shot.setVelocityX(h.facing * 560)
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
    this.tweens.add({
      targets: h, scaleX: h.baseScale * 1.14, scaleY: h.baseScale * 0.88,
      angle: h.facing * 10, yoyo: true, duration: 80,
    })
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
    box.setAlpha(0).setDepth(12)
    const body = box.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(w, ht)
    box.setData('dmg', dmg)
    box.setData('dir', h.facing)
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
    jet.setScale(1.55).setDepth(11)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    jet.setVelocityX(dir * 480)
    this.entities.add(jet, 'projectile')
    burst(this, this.pet.x, this.pet.y, 0xffc050, 14)
    floatText(this, this.pet.x, this.pet.y - 36, '蜂蜜噴流', '#ffcc44')
    this.time.delayedCall(700, () => jet.destroy())
  }

  private damageEnemy(e: Creep | PatrolEnemy, dmg: number, dir: number) {
    const pe = e as PatrolEnemy
    if (pe.isDead || pe.fsm === 'DEAD') return
    const result = pe.receiveHit(dmg, dir)
    burst(this, pe.x, pe.y - 20, 0xffe8a0, 8)
    floatText(this, pe.x, pe.y - 40, '！')
    SFX.hit()
    if (dmg >= 2 || pe.kind === 'boss') this.juice.play('heavy', pe.x, pe.y)
    else { hitstop(this, 50); this.cameras.main.shake(100, 0.01) }
    if (result.killed) {
      SFX.kill()
      burst(this, pe.x, pe.y - 16, 0xff6688, 12)
      if (pe.kind === 'boss') this.emitScore('武者倒下！兩人一起站上祭壇')
    }
  }

  private hurtHero(h: Hero, e: Creep | PatrolEnemy) {
    if (this.ended || !this.started) return
    if (!canTakeDamage(h, this.time.now)) return
    if (!enemyCanHurt(e as Creep)) return
    const pe = e as PatrolEnemy
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
        // Snap back onto the shared ground plane (same Y as enemies).
        snapToGroundPlane(h, Math.max(80, h.x - 80), GROUND_Y)
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
        floatBang: (x, y) => floatText(this, x, y, '！', '#ff3333'),
      })
    })
    this.prevLeadX = leadX
  }

  /** 噗噗 AI: always trail 琪寶寶 (never player-controlled) */
  private updatePet() {
    const g = this.girl
    const followX = g.x - g.facing * 52
    const followY = g.y
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
    this.pet.setVisible(true)
    this.pet.setActive(true)
    this.pet.setDepth(g.depth - 0.1)
  }

  private syncFx() {
    this.boyShadow.setPosition(this.boy.x, this.boy.y + 4)
    this.petShadow.setPosition(this.pet.x, this.pet.y + 42)
    this.girlShadow.setPosition(this.girl.x, this.girl.y + 4)
    this.fan.setPosition(this.girl.x - this.girl.facing * 28, this.girl.y - 36)
    this.fan.setFlipX(this.girl.facing < 0)
    this.fanGlow.setPosition(this.fan.x, this.fan.y)
  }

  private animateBg() {
    const sx = this.cameras.main.scrollX
    this.water.tilePositionX = sx * 0.45 + this.time.now * 0.025
    this.clouds.tilePositionX = sx * 0.08 + this.time.now * 0.005
    if (this.mountFar) this.mountFar.tilePositionX = sx * 0.12
    if (this.mountNear) this.mountNear.tilePositionX = sx * 0.28
  }

  private drawWorld() {
    const g = this.add.graphics().setDepth(-45)
    g.fillStyle(0x7ec8f0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0xb8e4ff, 1)
    g.fillRect(0, 0, WORLD_W, 140)
    g.fillStyle(0xffe8b0, 0.45)
    g.fillRect(0, 170, WORLD_W, 180)
    g.fillStyle(0xfff6d0, 0.55)
    g.fillCircle(160, 70, 70)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(160, 70, 28)

    this.clouds = this.add.tileSprite(480, 58, 960, 56, 'bg-cloud').setScrollFactor(0).setDepth(-40).setAlpha(0.8)
    this.mountFar = this.add.tileSprite(480, 250, 960, 80, 'bg-mount-far').setScrollFactor(0).setDepth(-35).setAlpha(0.9)
    this.mountNear = this.add.tileSprite(480, 310, 960, 70, 'bg-mount-near').setScrollFactor(0).setDepth(-30)

    for (let x = 160; x < WORLD_W; x += 260) {
      this.add.image(x + 8, GROUND_Y + 6, 'shad').setDepth(2).setAlpha(0.55).setScale(1.1, 0.8)
      this.add.image(x, GROUND_Y, 'prop-tree3d').setOrigin(0.5, 1).setDepth(3).setScale(1.2)
    }
    for (let x = 400; x < WORLD_W; x += 700) {
      this.add.image(x + 30, GROUND_Y + 6, 'shad').setDepth(2).setAlpha(0.5).setScale(1.6, 0.7)
      this.add.image(x, GROUND_Y, 'prop-torii').setOrigin(0.5, 1).setDepth(3).setScale(1.1)
      this.add.image(x + 130, GROUND_Y + 4, 'shad').setDepth(2).setAlpha(0.45).setScale(1.3, 0.7)
      this.add.image(x + 130, GROUND_Y, 'prop-house3d').setOrigin(0.5, 1).setDepth(3).setScale(1.2)
      if (x + 280 < WORLD_W) {
        this.add.image(x + 280, GROUND_Y + 4, 'shad').setDepth(2).setAlpha(0.4).setScale(1.1, 0.65)
        this.add.image(x + 280, GROUND_Y, 'prop-house3d').setOrigin(0.5, 1).setDepth(3).setScale(1.0).setFlipX(true)
      }
    }
    for (let x = 80; x < WORLD_W; x += 180) {
      this.add.image(x, GROUND_Y + 4, 'shad').setDepth(2).setAlpha(0.35).setScale(0.55, 0.55)
      this.add.image(x, GROUND_Y, 'prop-lantern3d').setOrigin(0.5, 1).setDepth(3.5).setScale(1.2)
    }

    this.water = this.add.tileSprite(480, 518, 960, 48, 'water-deep').setScrollFactor(0).setDepth(1)
    if (this.textures.exists('water-foam')) {
      this.add.tileSprite(480, 496, 960, 12, 'water-foam').setScrollFactor(0).setDepth(2).setAlpha(0.85)
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
    for (const [x, w] of banks) this.bank(x, GROUND_Y, w)

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

    for (const x of [320, 1200, 2050, 3000]) {
      const pot = this.pots.create(x, GROUND_Y - 40, 'pot3d') as Phaser.Physics.Arcade.Sprite
      pot.setScale(1.45).setDepth(4)
      ;(pot.body as Phaser.Physics.Arcade.Body).allowGravity = false
      this.tweens.add({ targets: pot, y: pot.y - 6, yoyo: true, repeat: -1, duration: 700 })
      this.spawnCoin(x + 60, GROUND_Y - 40)
    }
    this.spawnCoin(760, 240 - 36)
    this.spawnCoin(1720, 250 - 36)

    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 50, 'goal3d')
    this.goal.setImmovable(true).setScale(1.35).setDepth(4)
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
      .setDepth(8)
  }

  private spawnCoin(x: number, y: number) {
    const c = this.coinPickups.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite
    c.setScale(1.55).setDepth(5)
    ;(c.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.tweens.add({ targets: c, y: y - 6, yoyo: true, repeat: -1, duration: 520 })
  }

  private spawnCast() {
    const grace = this.time.now + 1400
    this.boy = Player.spawn(this, 110, GROUND_Y, {
      role: 'boy', texture: 'art-salmon', graceUntil: grace, scale: 1.85, speed: BOY_SPEED,
    })
    this.girl = Player.spawn(this, 190, GROUND_Y, {
      role: 'girl', texture: 'art-girl', graceUntil: grace, scale: 1.8, speed: GIRL_SPEED,
    })
    this.entities.add(this.boy, 'player')
    this.entities.add(this.girl, 'player')

    this.pet = this.physics.add.sprite(140, GROUND_Y, 'art-bear')
    this.pet.setOrigin(0.5, 1)
    this.pet.setScale(1.7).setDepth(9).setVisible(true)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.entities.add(this.pet, 'pet')

    const fanKey = this.textures.exists('fan3d') ? 'fan3d' : 'prop-fan'
    this.fan = this.add.image(190, GROUND_Y - 36, fanKey).setDepth(10).setScale(1.55)
    this.fanGlow = this.add.circle(190, GROUND_Y - 36, 15, 0x88ddff, 0.2).setDepth(9)
    this.tweens.add({ targets: this.fan, angle: { from: -28, to: 28 }, duration: 80, yoyo: true, repeat: -1 })

    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.boyShadow = this.add.image(110, GROUND_Y + 4, shad).setDepth(5).setAlpha(0.55).setScale(1.2, 0.75)
    this.girlShadow = this.add.image(190, GROUND_Y + 4, shad).setDepth(5).setAlpha(0.55).setScale(1.15, 0.75)
    this.petShadow = this.add.image(148, GROUND_Y + 4, shad).setDepth(5).setAlpha(0.45).setScale(1.0, 0.65)
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
        this.damageEnemy(e, hero.role === 'girl' ? 2 : 1, hero.facing)
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
      this.damageEnemy(e, 1, Math.sign(e.x - this.boy.x) || 1)
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as PatrolEnemy
      if (!e.active || e.isDead) return
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - this.girl.x) || 1)
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
        '第１關・奪回春蜜\n倫寶・鮭魚槍　｜　琪寶寶・電風扇×１.５速\n噗噗（ＡＩ）始終跟隨琪寶寶\n琪寶寶受傷 → 噗噗噴蜜\n角色可重疊、互不推擠\n\n按空白鍵或點擊畫面開始',
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
          ? '單人：倫寶ＪＫＵＩ｜琪寶寶＋噗噗同行｜Ｒ回選單'
          : '雙人：倫寶ＪＫＵＩ　琪寶寶數字鍵｜噗噗跟隨｜Ｒ回選單',
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
    pot.disableBody(true, true)
    SFX.kill()
    this.juice.breakDebris(x, y, pot.breakKind === 'chest' ? 0xc48a48 : 0xffc050)
    floatText(this, x, y - 18, pot.breakKind === 'chest' ? '寶箱破！' : '壺破！', '#ffe8a0')
    if (loot === 'honey') {
      this.honeyGot = Math.min(3, this.honeyGot + 1)
      floatText(this, x, y - 36, '春蜜＋１', '#ffcc44')
    } else {
      this.spawnCoin?.(x, y - 10)
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
    floatText(this, coin.x, coin.y - 16, '金幣＋１', '#ffe08a')
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
    this.cameras.main.flash(280, 255, 230, 160)
    EventBus.emit(GameEvents.GAME_OVER, { active: true, message: msg, canContinue: false, win: true })
  }

  private lose(msg: string) {
    this.ended = true
    this.deaths += 1
    SFX.lose()
    if (this.coinStock > 0) {
      this.awaitingContinue = true
      this.boy.awaitingContinue = true
      this.girl.awaitingContinue = true
      const msgText = `${msg}\n\n投幣續關（剩餘 ${this.coinStock}）\n按 Enter／空白鍵／Ｃ　投幣\n按Ｒ鍵回選單`
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
        message: `${msg}\n幣已用盡\n按Ｒ鍵回選單`,
        canContinue: false,
        win: false,
      })
    }
  }

  /** Public for smoke / continue path — spends one coin and respawns on shared ground plane. */
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
      reviveActor(h, cx + (h.role === 'girl' ? 60 : 0), GROUND_Y, this.time.now, 2000)
      snapToGroundPlane(h, h.x, GROUND_Y)
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
    t.setDepth(3)
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
      const s = this.hazards.create(x + i * 26 + 12, GROUND_Y + 8, tex) as Phaser.Physics.Arcade.Sprite
      s.setOrigin(0.5, 0)
      s.refreshBody()
      s.setDepth(2)
    }
  }

  private placeEnemies() {
    // Round 1: 2 visual species — 醃魚雜兵 (fish chase) + 木桶武者 (barrel hop/lunge)
    this.mkEnemy(620, GROUND_Y, 'blocker', undefined, 'fish')
    this.mkEnemy(1500, GROUND_Y, 'blocker', undefined, 'fish')
    this.mkEnemy(1050, GROUND_Y, 'chaser', undefined, 'fish')
    this.mkEnemy(1980, GROUND_Y, 'chaser', undefined, 'fish')
    this.mkEnemy(740, 240, 'ambusher', undefined, 'barrel')
    this.mkEnemy(1750, 250, 'ambusher', undefined, 'barrel')
    this.mkEnemy(1180, GROUND_Y, 'guardian', 1200, 'barrel')
    this.mkEnemy(2080, GROUND_Y, 'guardian', 2050, 'fish')
    this.mkEnemy(2960, GROUND_Y, 'guardian', 3000, 'barrel')
    this.mkEnemy(2680, GROUND_Y, 'interrupter', undefined, 'barrel')
  }

  private mkEnemy(
    x: number,
    y: number,
    kind: EnemyKind,
    guardX?: number,
    species?: EnemySpecies,
  ): PatrolEnemy {
    const e = PatrolEnemy.spawn(this, this.enemies, x, y, kind, {
      guardX,
      species,
      ground: this.ground,
      hooks: {
        spawnCoin: (cx, cy) => this.spawnCoin(cx, cy),
        floatBang: (bx, by) => floatText(this, bx, by, '！', '#ff3333'),
      },
    })
    this.entities.add(e, 'enemy')
    return e
  }

  private spawnBoss(x: number, y: number) {
    const e = this.mkEnemy(x, y, 'boss')
    if (e.label) {
      e.label.setText('醃鮭魚武者・壹')
      e.label.setStyle({ backgroundColor: '#701828', fontSize: '15px' })
    }
  }
}
