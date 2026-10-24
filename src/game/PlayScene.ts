import Phaser from 'phaser'
import { burst, floatText, hitstop } from './fx'
import { SFX, startBgm, unlockAudio } from './audio'
import { buildStageHud } from './hud'
import { calcScore, saveScore } from './score'
import { bindFootBody } from './footBody'
import {
  type Creep,
  type EnemyKind,
  type EnemySpecies,
  KIND_STATS,
  SPECIES_STATS,
  defaultSpecies,
  enemyCanHurt,
  tickEnemy,
} from './enemyAi'

const WORLD_W = 3800
const WORLD_H = 540
/** Shared walk surface — heroes & enemies (Goemon co-op floor) */
export const GROUND_Y = 400
const MAX_HP = 10
const BOY_SPEED = 275
const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)
const JUMP_V = -780
const COYOTE_MS = 110
const JUMP_BUF_MS = 120
const HURT_LOCK_MS = 260
const FALL_Y = 530
const COINS_START = 5

type HeroPose = 'idle' | 'run' | 'jump' | 'hurt' | 'die'

type Hero = Phaser.Physics.Arcade.Sprite & {
  hp: number
  facing: 1 | -1
  atkCd: number
  hurtCd: number
  hurtLock: number
  grace: number
  role: 'boy' | 'girl'
  baseScale: number
  coyote: number
  jumpBuf: number
  walkPhase: number
  wasGrounded: boolean
  pose: HeroPose
  alive: boolean
  awaitingContinue?: boolean
}

/**
 * Round 1 — 溪流小路
 * P1 倫寶：WASD + J/K/U/I（Ａ／Ｂ／Ｘ／Ｙ）
 * P2 琪寶寶：方向鍵 + 數字鍵 1/2/4/5（Ａ／Ｂ／Ｘ／Ｙ）
 * 笑臉熊：AI only，始終跟隨熊女；受傷時噴蜂蜜噴流
 */
export class PlayScene extends Phaser.Scene {
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
  private shots!: Phaser.Physics.Arcade.Group
  private honeys!: Phaser.Physics.Arcade.Group
  private pots!: Phaser.Physics.Arcade.Group
  private coinPickups!: Phaser.Physics.Arcade.Group
  private goal!: Phaser.Physics.Arcade.Sprite
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
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private coinText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private hudInfo!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  continueBox!: Phaser.GameObjects.Text
  private ended = false
  awaitingContinue = false
  private started = false
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

  constructor() {
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
    this.heartsL = []
    this.heartsR = []

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(350, 40, 100, 140)

    unlockAudio()
    startBgm()

    this.drawWorld()
    this.buildLevel()
    this.spawnCast()
    this.wirePhysics()
    this.bindKeys()
    this.buildHud()
    this.showIntro()

    this.banner = this.add
      .text(480, 270, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '24px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020ee',
        padding: { x: 20, y: 14 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false)
    this.continueBox = this.banner
  }

  playHurtPose(h: Hero, dir: number = -1) {
    h.pose = 'hurt'
    h.hurtLock = HURT_LOCK_MS
    h.hurtCd = 500
    h.facing = dir < 0 ? -1 : 1
    h.setFlipX(h.facing < 0)
    h.setTint(0xff4444)
    h.setAngle(h.facing * -22)
    h.setScale(h.baseScale * 1.1, h.baseScale * 0.86)
    this.time.delayedCall(HURT_LOCK_MS + 40, () => {
      if (h.pose === 'hurt') {
        h.pose = 'idle'
        h.clearTint()
        h.setAngle(0)
        h.setScale(h.baseScale)
      }
    })
  }

  beginDie(h: Hero, msg: string) {
    h.alive = false
    h.pose = 'die'
    h.hp = 0
    h.setVelocity(h.facing * -40, -80)
    h.setAngle(h.facing * 90)
    h.setTint(0x884444)
    this.refreshHearts()
    this.lose(msg)
  }

  update(_t: number, dt: number) {
    if (this.ended) {
      if (this.awaitingContinue && this.coinJust()) this.insertCoinContinue()
      else if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.scene.start('menu')
      return
    }
    if (!this.started) return

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.scene.restart()

    this.moveBoy(dt)
    if (this.mode === '2p') this.moveGirl(dt)
    else this.aiGirl(dt)

    this.updatePet()
    this.updateEnemies(dt)
    this.syncFx()
    this.animateBg()
    this.checkFall()
    this.updateCheckpoint()

    this.boy.atkCd = Math.max(0, this.boy.atkCd - dt)
    this.girl.atkCd = Math.max(0, this.girl.atkCd - dt)
    this.boy.hurtCd = Math.max(0, this.boy.hurtCd - dt)
    this.girl.hurtCd = Math.max(0, this.girl.hurtCd - dt)
    this.boy.hurtLock = Math.max(0, this.boy.hurtLock - dt)
    this.girl.hurtLock = Math.max(0, this.girl.hurtLock - dt)

    this.boyGoal = !!this.physics.overlap(this.boy, this.goal)
    this.girlGoal = !!this.physics.overlap(this.girl, this.goal)

    if (!this.bossOn && Math.max(this.boy.x, this.girl.x) > WORLD_W - 780) {
      this.bossOn = true
      this.spawnBoss(WORLD_W - 420, GROUND_Y)
      SFX.boss()
      this.hudInfo.setText('關底・醃鮭魚武者！合力奪回春蜜')
    }

    const mid = (this.boy.x + this.girl.x) / 2
    this.cameras.main.centerOn(Phaser.Math.Clamp(mid, 480, WORLD_W - 480), WORLD_H / 2)

    const pct = Math.min(100, Math.floor((Math.max(this.boy.x, this.girl.x) / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.scorePts = this.liveScore()
    this.hudInfo.setText(
      `${this.mode === '1p' ? '單人' : '雙人'}　進度 ${pct}%　${sec}秒　春蜜 ${this.honeyGot}/3`,
    )
    this.scoreText?.setText(`得分 ${this.scorePts}`)
    this.refreshHearts()
    this.checkWin()
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
    const body = h.body as Phaser.Physics.Arcade.Body
    const grounded = body.blocked.down || body.touching.down

    if (grounded) h.coyote = COYOTE_MS
    else h.coyote = Math.max(0, h.coyote - dt)

    if (jumpJust) h.jumpBuf = JUMP_BUF_MS
    else h.jumpBuf = Math.max(0, h.jumpBuf - dt)

    if (h.hurtLock > 0 || h.pose === 'die' || !h.alive) {
      this.applyHeroPose(h, grounded, 0)
      return
    }

    let vx = 0
    if (left) vx -= speed
    if (right) vx += speed
    h.setVelocityX(vx)
    if (vx !== 0) {
      h.facing = vx > 0 ? 1 : -1
      h.setFlipX(h.facing < 0)
    }

    if (h.jumpBuf > 0 && h.coyote > 0) {
      h.setVelocityY(JUMP_V)
      h.jumpBuf = 0
      h.coyote = 0
      SFX.jump()
    }

    if (!jumpHeld && body.velocity.y < -120) h.setVelocityY(body.velocity.y * 0.55)

    if (!h.wasGrounded && grounded) burst(this, h.x, h.y + 4, 0xcbb896, 3)
    h.wasGrounded = grounded

    if (h.atkCd <= 0 && attackJust) doAttack()
    this.applyHeroPose(h, grounded, vx)
  }

  private applyHeroPose(h: Hero, grounded: boolean, vx: number) {
    if (h.pose === 'die') {
      h.setAngle(h.facing * 90)
      h.setScale(h.baseScale * 1.05, h.baseScale * 0.7)
      return
    }
    if (h.pose === 'hurt' || h.hurtLock > 0) {
      h.pose = 'hurt'
      h.setAngle(h.facing * -22)
      h.setScale(h.baseScale * 1.1, h.baseScale * 0.86)
      if (h.hurtLock <= 0 && h.hurtCd < 700) {
        h.pose = grounded ? 'idle' : 'jump'
        h.clearTint()
      }
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
    this.enemies.getChildren().forEach((o) => {
      const e = o as Creep
      if (!e.active) return
      const dx = e.x - h.x
      if (Math.sign(dx) === h.facing && Math.abs(dx) < 84 && Math.abs(e.y - h.y) < 56) {
        this.damageEnemy(e, 2, h.facing)
      }
    })
  }

  private summonBearAssist() {
    if (this.petJetting || this.girl.hp <= 0) return
    this.petJetting = true
    SFX.hit()
    floatText(this, this.pet.x, this.pet.y - 50, '笑臉熊！', '#ffcc44')
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
    burst(this, this.pet.x, this.pet.y, 0xffc050, 14)
    floatText(this, this.pet.x, this.pet.y - 36, '蜂蜜噴流', '#ffcc44')
    this.time.delayedCall(700, () => jet.destroy())
  }

  private damageEnemy(e: Creep, dmg: number, dir: number) {
    if (e.state === 'die') return
    e.hp -= dmg
    e.setVelocityX(dir * 260)
    e.setVelocityY(-220)
    e.setTint(0xffffff)
    e.state = 'hurt'
    e.think = 280
    e.poseAngle = dir * -28
    const tint = KIND_STATS[e.kind].tint
    this.time.delayedCall(70, () => {
      if (!e.active || e.state === 'die') return
      e.clearTint()
      if (tint) e.setTint(tint)
    })
    burst(this, e.x, e.y - 20, 0xffe8a0, 8)
    floatText(this, e.x, e.y - 40, '！')
    SFX.hit()
    hitstop(this, 28)
    this.cameras.main.shake(30, 0.0022)
    if (e.hp <= 0) {
      e.state = 'die'
      e.poseAngle = dir * 85
      e.setAngle(e.poseAngle)
      e.setTint(0x884444)
      SFX.kill()
      burst(this, e.x, e.y - 16, 0xff6688, 12)
      e.setVelocity(dir * 80, -120)
      this.time.delayedCall(320, () => {
        e.label?.destroy()
        e.disableBody(true, true)
      })
      if (e.kind === 'boss') this.hudInfo.setText('武者倒下！兩人一起站上祭壇')
    }
  }

  private hurtHero(h: Hero, e: Creep) {
    if (this.ended || !this.started || this.time.now < h.grace || h.hurtCd > 0 || !h.alive) return
    if (!enemyCanHurt(e)) return
    e.hitThis = true
    h.hp -= 1
    h.hurtCd = 900
    h.hurtLock = HURT_LOCK_MS
    h.pose = 'hurt'
    const away = (Math.sign(h.x - e.x) || -1) as 1 | -1
    h.setVelocityX(away * 340)
    h.setVelocityY(-320)
    h.setTint(0xff4444)
    this.time.delayedCall(160, () => {
      if (h.pose !== 'die') h.clearTint()
    })
    SFX.hurt()
    burst(this, h.x, h.y - 24, 0xff4466, 8)
    floatText(this, h.x, h.y - 40, '-1', '#ff6677')
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (h.hp <= 0) this.knockOut(h)
  }

  private spike(h: Hero) {
    if (this.ended || !this.started || h.hurtCd > 0 || this.time.now < h.grace || !h.alive) return
    h.hp -= 1
    h.hurtCd = 1000
    h.hurtLock = HURT_LOCK_MS
    h.pose = 'hurt'
    h.setVelocityY(-480)
    h.setVelocityX(h.facing * -180)
    h.setTint(0xff4444)
    SFX.spike()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (h.hp <= 0) this.knockOut(h)
  }

  private checkFall() {
    for (const h of [this.boy, this.girl]) {
      if (h.y > FALL_Y) {
        if (this.ended || !this.started || h.hurtCd > 0 || !h.alive) continue
        h.hp -= 1
        h.hurtCd = 900
        h.hurtLock = HURT_LOCK_MS
        h.pose = 'hurt'
        h.setPosition(Math.max(80, h.x - 80), GROUND_Y)
        h.setVelocity(0, -200)
        SFX.spike()
        if (h.role === 'girl') this.summonBearAssist()
        this.refreshHearts()
        if (h.hp <= 0) this.knockOut(h)
      }
    }
  }

  private knockOut(h: Hero) {
    if (h.pose === 'die' || !h.alive) return
    h.alive = false
    h.pose = 'die'
    h.hp = 0
    h.hurtLock = 9999
    h.setVelocity(h.facing * -60, -140)
    h.setTint(0x884444)
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

  /** 笑臉熊 AI: always trail 熊女 (never player-controlled) */
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
    this.woodPlat(500, GROUND_Y - 8, 2)
    this.woodPlat(860, GROUND_Y - 8, 2)
    this.woodPlat(1820, GROUND_Y - 8, 3)
    this.woodPlat(2680, GROUND_Y - 8, 3)

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
    this.boy = this.mkHero(110, GROUND_Y, 'art-salmon', 'boy', grace, 1.85)
    this.girl = this.mkHero(190, GROUND_Y, 'art-girl', 'girl', grace, 1.8)

    this.pet = this.physics.add.sprite(148, GROUND_Y, 'art-bear')
    this.pet.setOrigin(0.5, 1)
    this.pet.setScale(1.7).setDepth(9).setVisible(true)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false

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
    this.shots = this.physics.add.group()
    this.honeys = this.physics.add.group()
    this.placeEnemies()

    this.physics.add.collider(this.boy, this.ground)
    this.physics.add.collider(this.girl, this.ground)
    this.physics.add.collider(this.enemies, this.ground)

    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      const s = shot as Phaser.Physics.Arcade.Sprite
      const e = enemy as Creep
      if (!e.active || e.state === 'die') return
      s.destroy()
      this.damageEnemy(e, 1, Math.sign(e.x - this.boy.x) || 1)
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as Creep
      if (!e.active || e.state === 'die') return
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - this.girl.x) || 1)
    })
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as Creep))
    this.physics.add.overlap(this.girl, this.enemies, (_g, e) => this.hurtHero(this.girl, e as Creep))
    this.physics.add.overlap(this.boy, this.hazards, () => this.spike(this.boy))
    this.physics.add.overlap(this.girl, this.hazards, () => this.spike(this.girl))
    this.physics.add.overlap(this.boy, this.pots, (_b, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.pots, (_g, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.boy, this.coinPickups, (_b, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.coinPickups, (_g, c) => this.takeCoin(c as Phaser.Physics.Arcade.Sprite))
  }

  private buildHud() {
    const hud = buildStageHud(this, {
      mode: this.mode,
      stageTitle: '第一關・溪流小路',
      stageSub: '奪回春蜜',
    })
    this.heartsL = hud.heartsL
    this.heartsR = hud.heartsR
    this.hudInfo = hud.info
    this.coinText = hud.coinText
    this.scoreText = hud.scoreText
    this.refreshCoins()
  }

  private showIntro() {
    const box = this.add
      .text(
        480,
        200,
        '第１關・奪回春蜜
倫寶・鮭魚槍　｜　琪寶寶・電風扇×１.５速
生命１０　投幣可續關
琪寶寶受傷 → 噗噗噴蜜
角色可重疊、互不推擠

按空白鍵或點擊畫面開始',
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
      this.hudInfo.setText(
        this.mode === '1p'
          ? '單人：鮭男ＪＫＵＩ｜熊女＋笑臉熊同行｜Ｒ回選單'
          : '雙人：鮭男ＪＫＵＩ　熊女數字鍵｜笑臉熊跟隨｜Ｒ回選單',
      )
    }
    this.time.delayedCall(180, () => {
      this.input.keyboard?.once('keydown', go)
      this.input.once('pointerdown', go)
    })
  }

  private takeHoney(pot: Phaser.Physics.Arcade.Sprite) {
    if (!pot.active) return
    pot.disableBody(true, true)
    this.honeyGot = Math.min(3, this.honeyGot + 1)
    SFX.kill()
    burst(this, pot.x, pot.y, 0xffc050, 12)
    floatText(this, pot.x, pot.y - 18, '春蜜＋１', '#ffcc44')
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
    this.banner.setText(msg).setVisible(true)
  }

  private lose(msg: string) {
    this.ended = true
    this.deaths += 1
    SFX.lose()
    if (this.coinStock > 0) {
      this.awaitingContinue = true
      this.boy.awaitingContinue = true
      this.girl.awaitingContinue = true
      this.banner
        .setText(`${msg}\n\n投幣續關（剩餘 ${this.coinStock}）\n按 Enter／空白鍵／Ｃ　投幣\n按Ｒ鍵回選單`)
        .setVisible(true)
    } else {
      this.awaitingContinue = false
      this.boy.awaitingContinue = false
      this.girl.awaitingContinue = false
      this.banner.setText(`${msg}\n幣已用盡\n按Ｒ鍵回選單`).setVisible(true)
    }
  }

  private insertCoinContinue() {
    if (!this.awaitingContinue || this.coinStock <= 0) return
    this.coinStock -= 1
    this.refreshCoins()
    SFX.coin()
    SFX.continue()
    this.awaitingContinue = false
    this.ended = false
    this.banner.setVisible(false)

    const cx = Phaser.Math.Clamp(this.checkpointX - 40, 100, WORLD_W - 200)
    for (const h of [this.boy, this.girl]) {
      h.hp = MAX_HP
      h.pose = 'idle'
      h.alive = true
      h.awaitingContinue = false
      h.hurtCd = 0
      h.hurtLock = 0
      h.grace = this.time.now + 2000
      h.clearTint()
      h.setAngle(0)
      h.setScale(h.baseScale)
      h.setPosition(cx + (h.role === 'girl' ? 60 : 0), GROUND_Y)
      h.setVelocity(0, 0)
      h.setActive(true)
      h.setVisible(true)
    }
    this.refreshHearts()
    floatText(this, this.boy.x, this.boy.y - 50, '續關！', '#ffe08a')
    this.hudInfo.setText('投幣續關！短暫無敵　繼續奪蜜')
    this.cameras.main.flash(200, 255, 220, 100)
  }

  private refreshCoins() {
    this.coinText?.setText(`×${this.coinStock}`)
  }

  private refreshHearts() {
    const full = this.textures.exists('pip-full') ? 'pip-full' : 'heart-full'
    const empty = this.textures.exists('pip-empty') ? 'pip-empty' : 'heart-empty'
    for (let i = 0; i < MAX_HP; i++) {
      this.heartsL[i]?.setTexture(i < this.boy.hp ? full : empty)
      this.heartsR[i]?.setTexture(i < this.girl.hp ? full : empty)
    }
  }

  private mkHero(
    x: number, y: number, tex: string, role: 'boy' | 'girl', grace: number, scale: number,
  ): Hero {
    const s = this.physics.add.sprite(x, y, tex) as Hero
    s.role = role
    s.hp = MAX_HP
    s.facing = 1
    s.atkCd = 0
    s.hurtCd = 0
    s.hurtLock = 0
    s.grace = grace
    s.baseScale = scale
    s.coyote = 0
    s.jumpBuf = 0
    s.walkPhase = 0
    s.wasGrounded = true
    s.pose = 'idle'
    s.alive = true
    s.awaitingContinue = false
    s.setCollideWorldBounds(true)
    s.setDragX(1400)
    s.setMaxVelocity(role === 'girl' ? GIRL_SPEED + 40 : BOY_SPEED + 40, 1200)
    s.setDepth(8)
    s.setScale(scale)
    bindFootBody(s, { bodyW: 22, bodyH: 36 })
    return s
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
  ) {
    const st = KIND_STATS[kind]
    const spKey = species ?? defaultSpecies(kind)
    const sp = SPECIES_STATS[spKey]
    const tex = this.textures.exists(sp.tex) ? sp.tex : 'art-enemy'
    const e = this.enemies.create(x, y, tex) as Creep
    e.kind = kind
    e.species = spKey
    e.hp = st.hp
    e.maxHp = st.hp
    e.windup = 0
    e.atkCd = Phaser.Math.Between(300, 800)
    e.hitThis = false
    e.state = 'patrol'
    e.patrolDir = Math.random() > 0.5 ? 1 : -1
    const span = kind === 'guardian' ? 90 : kind === 'ambusher' ? 48 : 70
    e.patrolMin = x - span
    e.patrolMax = x + span
    e.homeX = x
    e.homeY = y
    e.guardX = guardX ?? x
    e.think = 0
    e.detectT = 0
    e.hopCd = Phaser.Math.Between(200, 600)
    e.chargeDir = 1
    e.phase = 1
    e.baseScale = st.scale * sp.scaleMul
    e.poseAngle = 0
    e.boss = kind === 'boss'
    e.elite = kind === 'interrupter'
    e.setCollideWorldBounds(true)
    e.setDepth(6)
    e.setScale(e.baseScale)
    if (spKey === 'fish' && st.tint) e.setTint(st.tint)
    bindFootBody(e, {
      bodyW: spKey === 'barrel' ? 22 : 20,
      bodyH: spKey === 'barrel' ? 28 : 22,
    })
    const labelText = kind === 'boss' ? st.label : sp.label
    e.label = this.add
      .text(x, y - 44, labelText, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: kind === 'boss' ? '14px' : '11px',
        color: '#fff4e0',
        backgroundColor: spKey === 'barrel' ? '#3a2818cc' : '#301820cc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(12)
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
