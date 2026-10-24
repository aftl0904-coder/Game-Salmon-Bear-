import Phaser from 'phaser'
import { burst, floatText, hitstop } from './fx'
import { SFX, startBgm, unlockAudio } from './audio'
import { buildStageHud } from './hud'
import { calcScore, saveScore } from './score'

const WORLD_W = 3800
const WORLD_H = 540
/** Main walkable bank — raised so cast is not jammed at the bottom */
const GROUND_Y = 400
const MAX_HP = 3
const BOY_SPEED = 230
const GIRL_SPEED = Math.round(BOY_SPEED * 1.5)
const FALL_Y = 530

type Hero = Phaser.Physics.Arcade.Sprite & {
  hp: number
  facing: 1 | -1
  atkCd: number
  hurtCd: number
  grace: number
  role: 'boy' | 'girl'
}

type Creep = Phaser.Physics.Arcade.Sprite & {
  hp: number
  windup: number
  atkCd: number
  hitThis: boolean
  state: 'patrol' | 'chase' | 'windup' | 'recover'
  patrolDir: 1 | -1
  patrolMin: number
  patrolMax: number
  boss?: boolean
  elite?: boolean
  think: number
}

/**
 * Round 1 — 溪流小路
 * P1 鮭男：WASD + J/K/U/I（Ａ／Ｂ／Ｘ／Ｙ）
 * P2 熊女：方向鍵 + 數字鍵 1/2/4/5（Ａ／Ｂ／Ｘ／Ｙ）
 * 角色可重疊；熊女受傷時笑臉熊從畫面外衝入噴蜜
 */
export class PlayScene extends Phaser.Scene {
  private mode: '1p' | '2p' = '2p'
  private boy!: Hero
  private girl!: Hero
  private pet!: Phaser.Physics.Arcade.Sprite
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
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private hudInfo!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private ended = false
  private started = false
  private startedAt = 0
  private boyGoal = false
  private girlGoal = false
  private bossOn = false
  private honeyGot = 0
  private petActive = false
  private scorePts = 0
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
    this.started = false
    this.bossOn = false
    this.boyGoal = false
    this.girlGoal = false
    this.honeyGot = 0
    this.petActive = false
    this.scorePts = 0
    this.startedAt = this.time.now
    this.heartsL = []
    this.heartsR = []

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(350, 20, 40, 60)

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
        fontSize: '26px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020ee',
        padding: { x: 20, y: 14 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false)
  }

  update(_t: number, dt: number) {
    if (this.ended) {
      if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.scene.start('menu')
      return
    }
    if (!this.started) return

    if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.scene.restart()

    this.moveBoy()
    if (this.mode === '2p') this.moveGirl()
    else this.aiGirl()

    this.updatePet()
    this.updateEnemies(dt)
    this.syncFx()
    this.animateBg()
    this.checkFall()

    this.boy.atkCd = Math.max(0, this.boy.atkCd - dt)
    this.girl.atkCd = Math.max(0, this.girl.atkCd - dt)
    this.boy.hurtCd = Math.max(0, this.boy.hurtCd - dt)
    this.girl.hurtCd = Math.max(0, this.girl.hurtCd - dt)

    this.boyGoal = !!this.physics.overlap(this.boy, this.goal)
    this.girlGoal = !!this.physics.overlap(this.girl, this.goal)

    if (!this.bossOn && Math.max(this.boy.x, this.girl.x) > WORLD_W - 780) {
      this.bossOn = true
      this.spawnBoss(WORLD_W - 420, GROUND_Y - 52)
      SFX.boss()
      this.hudInfo.setText('關底・醃鮭魚武者！合力奪回春蜜')
    }

    const mid = (this.boy.x + this.girl.x) / 2
    this.cameras.main.centerOn(Phaser.Math.Clamp(mid, 480, WORLD_W - 480), WORLD_H / 2)

    const pct = Math.min(100, Math.floor((Math.max(this.boy.x, this.girl.x) / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.hudInfo.setText(
      `${this.mode === '1p' ? '單人' : '雙人'}　進度 ${pct}%　${sec}秒　春蜜 ${this.honeyGot}/3　分數 ${this.liveScore()}`,
    )
    this.refreshHearts()
    this.checkWin()
  }

  private liveScore() {
    const timeSec = (this.time.now - this.startedAt) / 1000
    return calcScore({
      timeSec,
      honey: this.honeyGot,
      hpBoy: Math.max(0, this.boy.hp),
      hpGirl: Math.max(0, this.girl.hp),
      deaths: 0,
    })
  }

  // ——— input ———
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
    void this.keyS
  }

  private p1AttackJust(): boolean {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyJ) ||
      Phaser.Input.Keyboard.JustDown(this.keyU) ||
      Phaser.Input.Keyboard.JustDown(this.keyI)
    )
  }

  private p1JumpJust(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keyW) || Phaser.Input.Keyboard.JustDown(this.keyK)
  }

  private p2AttackJust(): boolean {
    return (
      Phaser.Input.Keyboard.JustDown(this.keyNP1) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP4) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP5)
    )
  }

  private p2JumpJust(): boolean {
    return (
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keyNP2)
    )
  }

  private moveBoy() {
    const h = this.boy
    const body = h.body as Phaser.Physics.Arcade.Body
    let vx = 0
    if (this.keyA.isDown) vx -= BOY_SPEED
    if (this.keyD.isDown) vx += BOY_SPEED
    h.setVelocityX(vx)
    if (vx !== 0) {
      h.facing = vx > 0 ? 1 : -1
      h.setFlipX(h.facing < 0)
    }
    if (this.p1JumpJust() && body.blocked.down) {
      h.setVelocityY(-640)
      SFX.jump()
    }
    if (h.atkCd <= 0 && this.p1AttackJust()) this.fireSalmon(h)
  }

  private moveGirl() {
    const h = this.girl
    const body = h.body as Phaser.Physics.Arcade.Body
    let vx = 0
    if (this.cursors.left?.isDown) vx -= GIRL_SPEED
    if (this.cursors.right?.isDown) vx += GIRL_SPEED
    h.setVelocityX(vx)
    if (vx !== 0) {
      h.facing = vx > 0 ? 1 : -1
      h.setFlipX(h.facing < 0)
    }
    if (this.p2JumpJust() && body.blocked.down) {
      h.setVelocityY(-620)
      SFX.jump()
    }
    if (h.atkCd <= 0 && this.p2AttackJust()) this.fanSlash(h)
  }

  private aiGirl() {
    const g = this.girl
    const target = this.boy.x - 56
    const dx = target - g.x
    if (Math.abs(dx) > 20) {
      g.setVelocityX(Math.sign(dx) * GIRL_SPEED * 0.9)
      g.facing = (Math.sign(dx) || 1) as 1 | -1
      g.setFlipX(g.facing < 0)
    } else g.setVelocityX(0)
    const body = g.body as Phaser.Physics.Arcade.Body
    if (body.blocked.down && this.boy.y < g.y - 40) g.setVelocityY(-620)
    if (g.atkCd <= 0) {
      const near = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && Math.abs(e.x - g.x) < 78 && Math.abs(e.y - g.y) < 50
      })
      if (near) this.fanSlash(g)
    }
  }

  // ——— combat ———
  private fireSalmon(h: Hero) {
    h.atkCd = 280
    SFX.swing()
    const shot = this.shots.create(
      h.x + h.facing * 32,
      h.y - 8,
      'fx-salmon-shot',
    ) as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.5)
    shot.setDepth(11)
    shot.setFlipX(h.facing < 0)
    const b = shot.body as Phaser.Physics.Arcade.Body
    b.allowGravity = false
    shot.setVelocityX(h.facing * 540)
    this.time.delayedCall(900, () => shot.destroy())
  }

  private fanSlash(h: Hero) {
    h.atkCd = 340
    SFX.swing()
    burst(this, h.x + h.facing * 44, h.y, 0xffc0d0, 8)
    this.fanGlow.setAlpha(0.6)
    this.tweens.add({ targets: this.fanGlow, alpha: 0.15, duration: 180 })
    this.enemies.getChildren().forEach((o) => {
      const e = o as Creep
      if (!e.active) return
      const dx = e.x - h.x
      if (Math.sign(dx) === h.facing && Math.abs(dx) < 80 && Math.abs(e.y - h.y) < 52) {
        this.damageEnemy(e, 2, h.facing)
      }
    })
  }

  private summonBearAssist() {
    if (this.petActive) return
    this.petActive = true
    const cam = this.cameras.main
    const fromLeft = this.girl.facing > 0
    const startX = fromLeft ? cam.scrollX - 90 : cam.scrollX + cam.width + 90
    this.pet.setPosition(startX, this.girl.y)
    this.pet.setVisible(true)
    this.pet.setActive(true)
    this.pet.setFlipX(!fromLeft)
    SFX.hit()
    floatText(this, this.girl.x, this.girl.y - 50, '熊來了！', '#ffcc44')

    this.tweens.add({
      targets: this.pet,
      x: this.girl.x - this.girl.facing * 40,
      duration: 280,
      ease: 'Cubic.out',
      onComplete: () => {
        this.honeyJet(this.girl.facing)
        this.time.delayedCall(480, () => {
          const leaveX = fromLeft ? cam.scrollX + cam.width + 110 : cam.scrollX - 110
          this.tweens.add({
            targets: this.pet,
            x: leaveX,
            duration: 380,
            onComplete: () => {
              this.pet.setVisible(false)
              this.petActive = false
            },
          })
        })
      },
    })
  }

  private honeyJet(dir: number) {
    const jet = this.honeys.create(this.pet.x + dir * 16, this.pet.y, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(1.55)
    jet.setDepth(11)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    jet.setVelocityX(dir * 480)
    burst(this, this.pet.x, this.pet.y, 0xffc050, 14)
    floatText(this, this.pet.x, this.pet.y - 36, '蜂蜜噴流', '#ffcc44')
    this.time.delayedCall(700, () => jet.destroy())
  }

  private damageEnemy(e: Creep, dmg: number, dir: number) {
    e.hp -= dmg
    e.setVelocityX(dir * 220)
    e.setVelocityY(-180)
    e.setTint(0xffffff)
    e.state = 'recover'
    e.think = 320
    this.time.delayedCall(70, () => e.active && e.clearTint())
    burst(this, e.x, e.y, 0xffe8a0, 8)
    floatText(this, e.x, e.y - 28, '！')
    SFX.hit()
    hitstop(this, 30)
    this.cameras.main.shake(35, 0.0025)
    if (e.hp <= 0) {
      SFX.kill()
      burst(this, e.x, e.y, 0xff6688, 12)
      e.disableBody(true, true)
      if (e.boss) this.hudInfo.setText('武者倒下！兩人一起站上祭壇')
    }
  }

  private hurtHero(h: Hero, e: Creep) {
    if (this.ended || !this.started || this.time.now < h.grace || h.hurtCd > 0) return
    if (e.state !== 'windup' || e.hitThis) return
    if (e.windup > 240) return
    e.hitThis = true
    const dmg = e.boss ? 1 : 1
    h.hp -= dmg
    h.hurtCd = 1100
    h.setVelocityX((Math.sign(h.x - e.x) || -1) * 280)
    h.setVelocityY(-260)
    h.setTint(0xff4444)
    this.time.delayedCall(140, () => h.clearTint())
    SFX.hurt()
    burst(this, h.x, h.y, 0xff4466, 8)
    floatText(this, h.x, h.y - 28, `-${dmg}`, '#ff6677')
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (h.hp <= 0) this.lose(h.role === 'boy' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private spike(h: Hero) {
    if (this.ended || !this.started || h.hurtCd > 0 || this.time.now < h.grace) return
    h.hp -= 1
    h.hurtCd = 1200
    h.setVelocityY(-460)
    h.setVelocityX(h.facing * -160)
    SFX.spike()
    if (h.role === 'girl') this.summonBearAssist()
    this.refreshHearts()
    if (h.hp <= 0) this.lose(h.role === 'boy' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private checkFall() {
    for (const h of [this.boy, this.girl]) {
      if (h.y > FALL_Y) {
        if (this.ended || !this.started || h.hurtCd > 0) continue
        h.hp -= 1
        h.hurtCd = 900
        h.setPosition(Math.max(80, h.x - 80), GROUND_Y - 80)
        h.setVelocity(0, -200)
        SFX.spike()
        if (h.role === 'girl') this.summonBearAssist()
        this.refreshHearts()
        if (h.hp <= 0) this.lose(h.role === 'boy' ? '鮭男掉進溪谷…' : '熊女掉進溪谷…')
      }
    }
  }

  // ——— enemy AI (forgiving) ———
  private updateEnemies(dt: number) {
    this.enemies.getChildren().forEach((o) => {
      const e = o as Creep
      if (!e.active) return
      e.think = Math.max(0, e.think - dt)
      e.atkCd = Math.max(0, e.atkCd - dt)
      e.windup = Math.max(0, e.windup - dt)

      const target =
        Phaser.Math.Distance.Between(e.x, e.y, this.boy.x, this.boy.y) <
        Phaser.Math.Distance.Between(e.x, e.y, this.girl.x, this.girl.y)
          ? this.boy
          : this.girl
      const dist = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y)
      const dir = (Math.sign(target.x - e.x) || 1) as 1 | -1
      const aggro = e.boss ? 460 : e.elite ? 340 : 280
      const melee = e.boss ? 64 : 48
      const spd = e.boss ? 78 : e.elite ? 62 : 48

      if (e.state === 'recover') {
        e.setVelocityX(0)
        if (e.think <= 0) e.state = 'chase'
        return
      }

      if (e.state === 'windup') {
        e.setVelocityX(0)
        e.setTint(0xff5555)
        if (e.windup <= 0) {
          e.clearTint()
          e.state = 'recover'
          e.think = 420
          e.atkCd = e.boss ? 1200 : 1300
        }
        return
      }

      if (dist < melee && e.atkCd <= 0) {
        e.state = 'windup'
        e.windup = 480
        e.hitThis = false
        e.setVelocityX(0)
        e.setTint(0xff5555)
        floatText(this, e.x, e.y - 36, '！', '#ff3333')
        return
      }

      if (dist < aggro) {
        e.state = 'chase'
        e.setVelocityX(dir * spd)
        e.setFlipX(dir > 0)
      } else {
        e.state = 'patrol'
        if (e.x < e.patrolMin) e.patrolDir = 1
        if (e.x > e.patrolMax) e.patrolDir = -1
        e.setVelocityX(e.patrolDir * spd * 0.4)
        e.setFlipX(e.patrolDir > 0)
      }
    })
  }

  private updatePet() {
    if (!this.petActive) this.pet.setVelocity(0, 0)
  }

  private syncFx() {
    this.boyShadow.setPosition(this.boy.x, this.boy.y + 42)
    this.girlShadow.setPosition(this.girl.x, this.girl.y + 42)
    this.fan.setPosition(this.girl.x - this.girl.facing * 28, this.girl.y - 10)
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

  // ——— world ———
  private drawWorld() {
    const g = this.add.graphics().setDepth(-45)
    g.fillStyle(0x6eb8e0, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0xa8d4f0, 1)
    g.fillRect(0, 0, WORLD_W, 130)
    g.fillStyle(0xffe6c0, 0.35)
    g.fillRect(0, 180, WORLD_W, 160)
    g.fillStyle(0xfff3c8, 0.45)
    g.fillCircle(140, 64, 64)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(140, 64, 24)

    this.clouds = this.add
      .tileSprite(480, 58, 960, 56, 'bg-cloud')
      .setScrollFactor(0)
      .setDepth(-40)
      .setAlpha(0.8)

    this.mountFar = this.add
      .tileSprite(480, 250, 960, 80, 'bg-mount-far')
      .setScrollFactor(0)
      .setDepth(-35)
      .setAlpha(0.9)

    this.mountNear = this.add
      .tileSprite(480, 310, 960, 70, 'bg-mount-near')
      .setScrollFactor(0)
      .setDepth(-30)

    // faux-3D riverside props with contact shadows
    for (let x = 160; x < WORLD_W; x += 260) {
      this.add.image(x + 8, GROUND_Y + 6, 'shad').setDepth(2).setAlpha(0.55).setScale(1.1, 0.8)
      this.add.image(x, GROUND_Y - 36, 'prop-tree3d').setDepth(3).setScale(1.15)
    }
    for (let x = 400; x < WORLD_W; x += 700) {
      this.add.image(x + 30, GROUND_Y + 6, 'shad').setDepth(2).setAlpha(0.5).setScale(1.6, 0.7)
      this.add.image(x, GROUND_Y - 40, 'prop-torii').setDepth(3).setScale(1.05)
      this.add.image(x + 120, GROUND_Y + 4, 'shad').setDepth(2).setAlpha(0.45).setScale(1.2, 0.7)
      this.add.image(x + 120, GROUND_Y - 28, 'prop-house3d').setDepth(3).setScale(1.1)
    }
    for (let x = 80; x < WORLD_W; x += 190) {
      this.add.image(x, GROUND_Y + 4, 'shad').setDepth(2).setAlpha(0.35).setScale(0.55, 0.55)
      this.add.image(x, GROUND_Y - 16, 'prop-lantern3d').setDepth(3.5).setScale(1.15)
    }

    this.water = this.add
      .tileSprite(480, 518, 960, 48, 'water-deep')
      .setScrollFactor(0)
      .setDepth(1)
    if (this.textures.exists('water-foam')) {
      this.add.tileSprite(480, 496, 960, 12, 'water-foam').setScrollFactor(0).setDepth(2).setAlpha(0.85)
    }
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pots = this.physics.add.group()

    // multi-tier banks — ground raised, gaps = death pits
    const banks: Array<[number, number]> = [
      [0, 480],
      [560, 280],
      [960, 300],
      [1400, 340],
      [1880, 280],
      [2300, 320],
      [2760, 300],
      [3200, 600],
    ]
    for (const [x, w] of banks) this.bank(x, GROUND_Y, w)

    // mid platforms (vertical play space)
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

    // bridges over pits (fewer spikes — easier)
    this.woodPlat(500, GROUND_Y - 8, 2)
    this.woodPlat(860, GROUND_Y - 8, 2)
    this.woodPlat(1820, GROUND_Y - 8, 3)
    this.woodPlat(2680, GROUND_Y - 8, 3)

    this.spikes(540, 3)
    this.spikes(1840, 3)
    this.spikes(2700, 3)

    for (const x of [320, 1200, 2050, 3000]) {
      const pot = this.pots.create(x, GROUND_Y - 52, 'pot3d') as Phaser.Physics.Arcade.Sprite
      pot.setScale(1.45)
      pot.setDepth(4)
      ;(pot.body as Phaser.Physics.Arcade.Body).allowGravity = false
      this.tweens.add({ targets: pot, y: pot.y - 6, yoyo: true, repeat: -1, duration: 700 })
    }

    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 70, 'goal3d')
    this.goal.setImmovable(true)
    this.goal.setScale(1.35)
    this.goal.setDepth(4)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.add
      .text(WORLD_W - 140, GROUND_Y - 150, '祭壇・春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(8)
  }

  private spawnCast() {
    const grace = this.time.now + 1400
    this.boy = this.mkHero(110, GROUND_Y - 48, 'art-salmon', 'boy', grace, 1.85)
    this.girl = this.mkHero(190, GROUND_Y - 48, 'art-girl', 'girl', grace, 1.8)

    this.pet = this.physics.add.sprite(-220, GROUND_Y - 44, 'art-bear')
    this.pet.setScale(1.7)
    this.pet.setDepth(9)
    this.pet.setVisible(false)
    this.pet.setCollideWorldBounds(false)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).allowGravity = false

    const fanKey = this.textures.exists('fan3d') ? 'fan3d' : 'prop-fan'
    this.fan = this.add.image(190, GROUND_Y - 56, fanKey).setDepth(10).setScale(1.55)
    this.fanGlow = this.add.circle(190, GROUND_Y - 56, 15, 0x88ddff, 0.2).setDepth(9)
    this.tweens.add({
      targets: this.fan,
      angle: { from: -28, to: 28 },
      duration: 80,
      yoyo: true,
      repeat: -1,
    })

    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    this.boyShadow = this.add.image(110, GROUND_Y + 4, shad).setDepth(5).setAlpha(0.55).setScale(1.2, 0.75)
    this.girlShadow = this.add.image(190, GROUND_Y + 4, shad).setDepth(5).setAlpha(0.55).setScale(1.15, 0.75)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.shots = this.physics.add.group()
    this.honeys = this.physics.add.group()
    this.placeEnemies()

    this.physics.add.collider(this.boy, this.ground)
    this.physics.add.collider(this.girl, this.ground)
    this.physics.add.collider(this.enemies, this.ground)
    // NO boy↔girl collider — characters may overlap

    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      const s = shot as Phaser.Physics.Arcade.Sprite
      const e = enemy as Creep
      if (!e.active) return
      s.destroy()
      this.damageEnemy(e, 1, Math.sign(e.x - this.boy.x) || 1)
    })
    this.physics.add.overlap(this.honeys, this.enemies, (jet, enemy) => {
      const j = jet as Phaser.Physics.Arcade.Sprite
      const e = enemy as Creep
      if (!e.active) return
      j.destroy()
      this.damageEnemy(e, 3, Math.sign(e.x - this.girl.x) || 1)
    })
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as Creep))
    this.physics.add.overlap(this.girl, this.enemies, (_g, e) => this.hurtHero(this.girl, e as Creep))
    this.physics.add.overlap(this.boy, this.hazards, () => this.spike(this.boy))
    this.physics.add.overlap(this.girl, this.hazards, () => this.spike(this.girl))
    this.physics.add.overlap(this.boy, this.pots, (_b, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.pots, (_g, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
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
  }

  private showIntro() {
    const box = this.add
      .text(
        480,
        210,
        '第１關・奪回春蜜\n鮭男・鮭魚槍　｜　熊女・電風扇×１.５速\n熊女受傷 → 笑臉熊從畫面外衝入噴蜜\n角色可重疊、互不推擠\n\n按空白鍵或點擊畫面開始',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '15px',
          color: '#f7e7c0',
          backgroundColor: '#1a1020ee',
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
          ? '單人：鮭男射擊Ｊ／Ｋ／Ｕ／Ｉ｜熊女同行｜Ｒ回選單'
          : '雙人：鮭男ＪＫＵＩ　熊女數字鍵１２４５　｜　Ｒ回選單',
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
        timeSec,
        honey: this.honeyGot,
        hpBoy: this.boy.hp,
        hpGirl: this.girl.hp,
        deaths: 0,
      })
      saveScore({
        score: this.scorePts,
        timeSec,
        honey: this.honeyGot,
        mode: this.mode,
        at: Date.now(),
      })
      this.win(
        `春蜜奪回！\n溪流小路　通關\n${timeSec.toFixed(1)}秒　蜜罐 ${this.honeyGot}/3\n得分 ${this.scorePts}\n按Ｒ鍵回選單`,
      )
    }
  }

  private win(msg: string) {
    this.ended = true
    this.boy.setVelocity(0, 0)
    this.girl.setVelocity(0, 0)
    SFX.win()
    this.cameras.main.flash(280, 255, 230, 160)
    this.banner.setText(msg).setVisible(true)
  }

  private lose(msg: string) {
    this.ended = true
    SFX.lose()
    this.banner.setText(`${msg}\n按Ｒ鍵回選單`).setVisible(true)
  }

  private refreshHearts() {
    for (let i = 0; i < 3; i++) {
      this.heartsL[i]?.setTexture(i < this.boy.hp ? 'heart-full' : 'heart-empty')
      this.heartsR[i]?.setTexture(i < this.girl.hp ? 'heart-full' : 'heart-empty')
    }
  }

  private mkHero(
    x: number,
    y: number,
    tex: string,
    role: 'boy' | 'girl',
    grace: number,
    scale: number,
  ): Hero {
    const s = this.physics.add.sprite(x, y, tex) as Hero
    s.role = role
    s.hp = MAX_HP
    s.facing = 1
    s.atkCd = 0
    s.hurtCd = 0
    s.grace = grace
    s.setCollideWorldBounds(true)
    s.setDragX(900)
    s.setDepth(8)
    s.setScale(scale)
    const body = s.body as Phaser.Physics.Arcade.Body
    body.setSize(22, 36)
    body.setOffset(role === 'girl' ? 20 : 24, role === 'girl' ? 28 : 26)
    return s
  }

  private bank(x: number, y: number, w: number) {
    const tex = this.textures.exists('blk-grass') ? 'blk-grass' : 'til-grass'
    for (let i = x; i < x + w; i += 36) {
      const t = this.ground.create(i + 18, y, tex) as Phaser.Physics.Arcade.Sprite
      t.refreshBody()
      t.setDepth(3)
    }
  }

  private woodPlat(x: number, y: number, n: number) {
    const tex = this.textures.exists('blk-wood') ? 'blk-wood' : 'til-wood'
    for (let i = 0; i < n; i++) {
      const t = this.ground.create(x + i * 36 + 18, y, tex) as Phaser.Physics.Arcade.Sprite
      t.refreshBody()
      t.setDepth(3)
    }
  }

  private stonePlat(x: number, y: number, n: number) {
    const tex = this.textures.exists('blk-stone') ? 'blk-stone' : 'til-wood'
    for (let i = 0; i < n; i++) {
      const t = this.ground.create(x + i * 34 + 17, y, tex) as Phaser.Physics.Arcade.Sprite
      t.refreshBody()
      t.setDepth(3)
    }
  }

  private spikes(x: number, n: number) {
    const tex = this.textures.exists('blk-spike') ? 'blk-spike' : 'til-spike'
    for (let i = 0; i < n; i++) {
      const s = this.hazards.create(x + i * 26 + 12, GROUND_Y + 22, tex) as Phaser.Physics.Arcade.Sprite
      s.refreshBody()
      s.setDepth(2)
    }
  }

  private placeEnemies() {
    // fewer / slower pack — easier than prior pass
    const spots = [640, 1050, 1520, 2000, 2450, 2950]
    for (const x of spots) this.mkEnemy(x, GROUND_Y - 44, false, false)
    this.mkEnemy(1750, 210, false, true)
    this.mkEnemy(740, 200, false, false)
  }

  private mkEnemy(x: number, y: number, boss: boolean, elite: boolean) {
    const e = this.enemies.create(x, y, 'art-enemy') as Creep
    e.hp = boss ? 8 : elite ? 3 : 2
    e.windup = 0
    e.atkCd = Phaser.Math.Between(500, 1100)
    e.hitThis = false
    e.state = 'patrol'
    e.patrolDir = Math.random() > 0.5 ? 1 : -1
    e.patrolMin = x - 60
    e.patrolMax = x + 60
    e.think = 0
    e.boss = boss
    e.elite = elite
    e.setCollideWorldBounds(true)
    e.setDepth(6)
    e.setScale(boss ? 2.5 : elite ? 1.85 : 1.7)
    if (elite && !boss) e.setTint(0xff8866)
    if (boss) e.setTint(0xffaa77)
    ;(e.body as Phaser.Physics.Arcade.Body).setSize(20, 20)
    return e
  }

  private spawnBoss(x: number, y: number) {
    this.mkEnemy(x, y, true, false)
    this.add
      .text(x, y - 88, '醃鮭魚武者', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#ffe8c8',
        backgroundColor: '#701828',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(12)
  }
}
