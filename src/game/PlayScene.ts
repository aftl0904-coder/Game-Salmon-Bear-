import Phaser from 'phaser'
import { burst, floatText, hitstop } from './fx'
import { SFX, startBgm, unlockAudio } from './audio'

const WORLD_W = 4200
const WORLD_H = 540
const GROUND_Y = 468
const MAX_HP = 3

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
  boss?: boolean
  elite?: boolean
}

/**
 * Round 1 — 溪流小路
 * P1 鮭男：WASD + F/空白 鮭魚槍
 * P2 熊女：←→↑ + L/Enter 扇擊（更快）；寵物熊跟隨；熊女受傷 → 蜂蜜噴流
 * 1P：熊女 AI 跟隨鮭男
 */
export class PlayScene extends Phaser.Scene {
  private mode: '1p' | '2p' = '2p'
  private boy!: Hero
  private girl!: Hero
  private pet!: Phaser.Physics.Arcade.Sprite
  private fan!: Phaser.GameObjects.Image
  private boyShadow!: Phaser.GameObjects.Image
  private girlShadow!: Phaser.GameObjects.Image
  private petShadow!: Phaser.GameObjects.Image
  private ground!: Phaser.Physics.Arcade.StaticGroup
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private shots!: Phaser.Physics.Arcade.Group
  private honeys!: Phaser.Physics.Arcade.Group
  private pots!: Phaser.Physics.Arcade.Group
  private goal!: Phaser.Physics.Arcade.Sprite
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private heartsL: Phaser.GameObjects.Image[] = []
  private heartsR: Phaser.GameObjects.Image[] = []
  private banner!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private progress!: Phaser.GameObjects.Text
  private ended = false
  private startedAt = 0
  private boyGoal = false
  private girlGoal = false
  private bossOn = false
  private honeyGot = 0
  private water!: Phaser.GameObjects.TileSprite
  private clouds!: Phaser.GameObjects.TileSprite

  constructor() {
    super('play')
  }

  create() {
    this.mode = (this.registry.get('playMode') as '1p' | '2p') || '2p'
    this.ended = false
    this.bossOn = false
    this.boyGoal = false
    this.girlGoal = false
    this.honeyGot = 0
    this.startedAt = this.time.now
    this.heartsL = []
    this.heartsR = []

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(400, 20, 30, 50)

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
        fontSize: '28px',
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
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
        this.scene.start('menu')
      }
      return
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.scene.restart()

    this.controlHero(
      this.boy,
      this.keys.a,
      this.keys.d,
      this.keys.w,
      this.keys.f,
      this.keys.space,
      230,
      true,
    )

    if (this.mode === '2p') {
      this.controlHero(
        this.girl,
        this.keys.left,
        this.keys.right,
        this.keys.up,
        this.keys.l,
        this.keys.enter,
        290, // fan boost — faster than boy
        false,
      )
    } else {
      this.aiGirl(dt)
    }

    this.followPet()
    this.updateEnemies(dt)
    this.syncShadows()
    this.animateWater()

    this.boy.atkCd = Math.max(0, this.boy.atkCd - dt)
    this.girl.atkCd = Math.max(0, this.girl.atkCd - dt)
    this.boy.hurtCd = Math.max(0, this.boy.hurtCd - dt)
    this.girl.hurtCd = Math.max(0, this.girl.hurtCd - dt)

    this.boyGoal = this.physics.overlap(this.boy, this.goal)
    this.girlGoal = this.physics.overlap(this.girl, this.goal)

    if (!this.bossOn && Math.max(this.boy.x, this.girl.x) > WORLD_W - 900) {
      this.bossOn = true
      this.spawnBoss(WORLD_W - 520, GROUND_Y - 50)
      SFX.boss()
      this.hint.setText('關底・醃鮭魚武者！奪回春蜜')
    }

    const mid = (this.boy.x + this.girl.x) / 2
    this.cameras.main.centerOn(Phaser.Math.Clamp(mid, 480, WORLD_W - 480), WORLD_H / 2)

    const pct = Math.min(100, Math.floor((Math.max(this.boy.x, this.girl.x) / (WORLD_W - 160)) * 100))
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.progress.setText(
      `${this.mode.toUpperCase()}　進度 ${pct}%　｜　${sec}s　｜　春蜜 ${this.honeyGot}/3`,
    )
    this.refreshHearts()
    this.checkWin()
  }

  // —— setup ——
  private drawWorld() {
    const sky = this.add.graphics().setDepth(-40)
    sky.fillStyle(0x5eb0d8, 1)
    sky.fillRect(0, 0, WORLD_W, WORLD_H)
    sky.fillStyle(0x8ecae6, 1)
    sky.fillRect(0, 0, WORLD_W, 160)
    sky.fillStyle(0xffe2b0, 0.35)
    sky.fillRect(0, 240, WORLD_W, 160)
    sky.fillStyle(0xfff0c0, 0.55)
    sky.fillCircle(160, 80, 55)
    sky.fillStyle(0xffe08a, 0.9)
    sky.fillCircle(160, 80, 28)

    for (let x = 0; x < WORLD_W; x += 220) {
      sky.fillStyle(0x5e9a68, 1)
      sky.fillEllipse(x + 110, 340, 260, 120)
      sky.fillStyle(0x7fbf74, 1)
      sky.fillEllipse(x + 40, 360, 180, 90)
    }
    for (let x = 400; x < WORLD_W; x += 850) {
      sky.fillStyle(0xc45c48, 1)
      sky.fillRect(x, 270, 10, 70)
      sky.fillRect(x + 48, 270, 10, 70)
      sky.fillRect(x - 8, 264, 74, 10)
    }

    this.clouds = this.add
      .tileSprite(480, 70, 960, 56, 'bg-cloud')
      .setScrollFactor(0)
      .setDepth(-32)
      .setAlpha(0.75)

    this.water = this.add
      .tileSprite(480, 508, 960, 48, 'water-deep')
      .setScrollFactor(0)
      .setDepth(1)

    if (this.textures.exists('water-foam')) {
      this.add
        .tileSprite(480, 486, 960, 12, 'water-foam')
        .setScrollFactor(0)
        .setDepth(2)
        .setAlpha(0.8)
    }
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pots = this.physics.add.group()

    const banks = [
      [0, 500],
      [620, 360],
      [1100, 340],
      [1560, 420],
      [2120, 300],
      [2560, 380],
      [3080, 360],
      [3580, 620],
    ] as const
    for (const [x, w] of banks) this.bank(x, GROUND_Y, w)

    this.bridge(500, GROUND_Y - 8, 4)
    this.bridge(980, GROUND_Y - 8, 4)
    this.bridge(1440, GROUND_Y - 40, 4)
    this.bridge(1980, GROUND_Y - 8, 5)
    this.bridge(2440, GROUND_Y - 8, 5)
    this.bridge(2940, GROUND_Y - 20, 5)
    this.bridge(3440, GROUND_Y - 8, 5)

    this.bridge(740, 330, 2)
    this.bridge(1260, 300, 2)
    this.bridge(1800, 270, 3)
    this.bridge(2700, 290, 3)

    this.spikes(520, 6)
    this.spikes(1000, 6)
    this.spikes(2000, 7)
    this.spikes(2460, 7)
    this.spikes(3460, 6)

    // honey pots to collect (春蜜碎片)
    for (const x of [400, 1400, 2400, 3200]) {
      const pot = this.pots.create(x, GROUND_Y - 50, 'prop-honey-pot') as Phaser.Physics.Arcade.Sprite
      pot.setScale(1.4)
      pot.setDepth(4)
      ;(pot.body as Phaser.Physics.Arcade.Body).allowGravity = false
      this.tweens.add({ targets: pot, y: pot.y - 6, yoyo: true, repeat: -1, duration: 700 })
    }

    if (this.textures.exists('sign-salmon')) {
      this.add.image(260, GROUND_Y - 50, 'sign-salmon').setDepth(3).setScale(1.4)
    }
    for (let x = 80; x < WORLD_W; x += 160) {
      if (this.textures.exists('prop-bush')) {
        this.add.image(x, GROUND_Y - 20, 'prop-bush').setDepth(3).setScale(1.1)
      }
    }
    for (let x = 120; x < WORLD_W; x += 240) {
      if (this.textures.exists('fg-reed')) {
        this.add.image(x, GROUND_Y + 24, 'fg-reed').setDepth(12).setScale(1.2)
      }
    }

    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 70, 'til-goal')
    this.goal.setImmovable(true)
    this.goal.setScale(1.5)
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
    this.boy = this.mkHero(90, GROUND_Y - 40, 'art-salmon', 'boy', grace)
    this.girl = this.mkHero(170, GROUND_Y - 40, 'art-girl', 'girl', grace)

    this.pet = this.physics.add.sprite(140, GROUND_Y - 40, 'art-bear')
    this.pet.setScale(1.25)
    this.pet.setDepth(7)
    this.pet.setCollideWorldBounds(true)
    this.pet.setDragX(1400)
    ;(this.pet.body as Phaser.Physics.Arcade.Body).setSize(24, 30)

    this.fan = this.add.image(170, GROUND_Y - 55, 'prop-fan').setDepth(9).setScale(1.5)
    this.tweens.add({
      targets: this.fan,
      angle: { from: -18, to: 18 },
      yoyo: true,
      repeat: -1,
      duration: 180,
    })

    this.boyShadow = this.add.image(90, GROUND_Y + 10, 'shadow-blob').setDepth(5).setAlpha(0.45).setScale(0.9, 0.6)
    this.girlShadow = this.add.image(170, GROUND_Y + 10, 'shadow-blob').setDepth(5).setAlpha(0.45).setScale(0.85, 0.6)
    this.petShadow = this.add.image(140, GROUND_Y + 10, 'shadow-blob').setDepth(5).setAlpha(0.4).setScale(1, 0.6)
  }

  private wirePhysics() {
    this.enemies = this.physics.add.group()
    this.shots = this.physics.add.group()
    this.honeys = this.physics.add.group()
    this.placeEnemies()

    this.physics.add.collider(this.boy, this.ground)
    this.physics.add.collider(this.girl, this.ground)
    this.physics.add.collider(this.pet, this.ground)
    this.physics.add.collider(this.enemies, this.ground)
    this.physics.add.collider(this.boy, this.girl)

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
      this.damageEnemy(e, 2, Math.sign(e.x - this.girl.x) || 1)
    })
    this.physics.add.overlap(this.boy, this.enemies, (_b, e) => this.hurtHero(this.boy, e as Creep))
    this.physics.add.overlap(this.girl, this.enemies, (_g, e) => this.hurtHero(this.girl, e as Creep))
    this.physics.add.overlap(this.boy, this.hazards, () => this.spike(this.boy))
    this.physics.add.overlap(this.girl, this.hazards, () => this.spike(this.girl))
    this.physics.add.overlap(this.boy, this.pots, (_b, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
    this.physics.add.overlap(this.girl, this.pots, (_g, p) => this.takeHoney(p as Phaser.Physics.Arcade.Sprite))
  }

  private bindKeys() {
    const kb = this.input.keyboard!
    this.keys = {
      w: kb.addKey('W'),
      a: kb.addKey('A'),
      d: kb.addKey('D'),
      f: kb.addKey('F'),
      space: kb.addKey('SPACE'),
      left: kb.addKey('LEFT'),
      right: kb.addKey('RIGHT'),
      up: kb.addKey('UP'),
      l: kb.addKey('L'),
      enter: kb.addKey('ENTER'),
      r: kb.addKey('R'),
    }
  }

  private buildHud() {
    this.add.image(480, 28, 'ui-scroll').setScrollFactor(0).setDepth(30).setScale(1.1)
    this.add
      .text(480, 26, '第一關・溪流小路', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '18px',
        color: '#2a1a10',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31)

    const left = this.add.container(16, 56).setScrollFactor(0).setDepth(30)
    const right = this.add.container(780, 56).setScrollFactor(0).setDepth(30)
    left.add(
      this.add.text(0, 0, 'P1 鮭男', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#ffe08a',
        stroke: '#1a1020',
        strokeThickness: 4,
      }),
    )
    right.add(
      this.add.text(0, 0, 'P2 熊女', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#ffe08a',
        stroke: '#1a1020',
        strokeThickness: 4,
      }),
    )
    for (let i = 0; i < MAX_HP; i++) {
      const a = this.add.image(12 + i * 18, 28, 'heart-full').setScale(1.1)
      const b = this.add.image(12 + i * 18, 28, 'heart-full').setScale(1.1)
      this.heartsL.push(a)
      this.heartsR.push(b)
      left.add(a)
      right.add(b)
    }

    this.progress = this.add
      .text(480, 54, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0cc',
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)

    this.hint = this.add
      .text(480, 508, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020bb',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
  }

  private showIntro() {
    const box = this.add
      .text(
        480,
        200,
        '故事：醃漬軍偷走五罐祭典蜜。\n第 1 關——奪回【春蜜】！\n鮭男射鮭槍，熊女扇風快跑；\n熊女受傷時，笑臉熊噴蜂蜜反擊。\n\n按任意鍵開始',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '16px',
          color: '#f7e7c0',
          backgroundColor: '#1a1020ee',
          padding: { x: 18, y: 14 },
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)

    this.physics.world.pause()
    const go = () => {
      box.destroy()
      this.physics.world.resume()
      this.hint.setText(
        this.mode === '1p'
          ? '1P：控鮭男｜熊女自動跟隨｜收集蜂蜜罐｜兩人到祭壇'
          : '2P：鮭男 WASD+F｜熊女 ←→↑+L（更快）｜R 回選單',
      )
      this.input.keyboard?.off('keydown', go)
      this.input.off('pointerdown', go)
    }
    this.time.delayedCall(200, () => {
      this.input.keyboard?.once('keydown', go)
      this.input.once('pointerdown', go)
    })
  }

  // —— control ——
  private controlHero(
    h: Hero,
    left: Phaser.Input.Keyboard.Key,
    right: Phaser.Input.Keyboard.Key,
    jump: Phaser.Input.Keyboard.Key,
    atkA: Phaser.Input.Keyboard.Key,
    atkB: Phaser.Input.Keyboard.Key,
    speed: number,
    isBoy: boolean,
  ) {
    const body = h.body as Phaser.Physics.Arcade.Body
    let vx = 0
    if (left.isDown) vx -= speed
    if (right.isDown) vx += speed
    h.setVelocityX(vx)
    if (vx) h.facing = vx > 0 ? 1 : -1
    h.setFlipX(h.facing < 0)

    if (Phaser.Input.Keyboard.JustDown(jump) && body.blocked.down) {
      h.setVelocityY(isBoy ? -600 : -580)
      SFX.jump()
    }
    if (h.atkCd <= 0 && (Phaser.Input.Keyboard.JustDown(atkA) || Phaser.Input.Keyboard.JustDown(atkB))) {
      if (isBoy) this.fireSalmon(h)
      else this.fanSlash(h)
    }
  }

  private aiGirl(_dt: number) {
    const g = this.girl
    const targetX = this.boy.x - 50
    const dx = targetX - g.x
    const speed = 270
    if (Math.abs(dx) > 18) {
      g.setVelocityX(Math.sign(dx) * speed)
      g.facing = Math.sign(dx) as 1 | -1
      g.setFlipX(g.facing < 0)
    } else g.setVelocityX(0)

    const body = g.body as Phaser.Physics.Arcade.Body
    // jump if boy is higher
    if (body.blocked.down && this.boy.y < g.y - 40) {
      g.setVelocityY(-580)
    }
    // auto fan if enemy near
    if (g.atkCd <= 0) {
      const near = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && Math.abs(e.x - g.x) < 70 && Math.abs(e.y - g.y) < 50
      })
      if (near) this.fanSlash(g)
    }
  }

  private followPet() {
    const tx = this.girl.x - this.girl.facing * 36
    const dx = tx - this.pet.x
    this.pet.setVelocityX(Phaser.Math.Clamp(dx * 6, -260, 260))
    if (Math.abs(dx) > 8) this.pet.setFlipX(dx < 0)
    // fan behind girl
    this.fan.setPosition(this.girl.x - this.girl.facing * 22, this.girl.y - 10)
    this.fan.setFlipX(this.girl.facing < 0)
  }

  private syncShadows() {
    this.boyShadow.setPosition(this.boy.x, this.boy.y + 34)
    this.girlShadow.setPosition(this.girl.x, this.girl.y + 34)
    this.petShadow.setPosition(this.pet.x, this.pet.y + 32)
  }

  private animateWater() {
    this.water.tilePositionX = this.cameras.main.scrollX * 0.4 + this.time.now * 0.02
    this.clouds.tilePositionX = this.cameras.main.scrollX * 0.1 + this.time.now * 0.004
  }

  private fireSalmon(h: Hero) {
    h.atkCd = 320
    SFX.swing()
    const shot = this.shots.create(h.x + h.facing * 28, h.y - 4, 'fx-salmon-shot') as Phaser.Physics.Arcade.Sprite
    shot.setScale(1.3)
    shot.setDepth(11)
    shot.setFlipX(h.facing < 0)
    ;(shot.body as Phaser.Physics.Arcade.Body).allowGravity = false
    shot.setVelocityX(h.facing * 480)
    this.time.delayedCall(900, () => shot.destroy())
  }

  private fanSlash(h: Hero) {
    h.atkCd = 400
    SFX.swing()
    burst(this, h.x + h.facing * 40, h.y, 0xffc0d0, 8)
    this.enemies.getChildren().forEach((o) => {
      const e = o as Creep
      if (!e.active) return
      const dx = e.x - h.x
      if (Math.sign(dx) === h.facing && Math.abs(dx) < 70 && Math.abs(e.y - h.y) < 46) {
        this.damageEnemy(e, 2, h.facing)
      }
    })
  }

  private honeyJet() {
    // pet bear counter when girl is hurt
    SFX.hit()
    floatText(this, this.pet.x, this.pet.y - 40, '蜂蜜！', '#ffcc44')
    const dir = this.girl.facing
    const jet = this.honeys.create(this.pet.x + dir * 20, this.pet.y, 'fx-honey') as Phaser.Physics.Arcade.Sprite
    jet.setScale(1.4)
    jet.setDepth(11)
    ;(jet.body as Phaser.Physics.Arcade.Body).allowGravity = false
    jet.setVelocityX(dir * 420)
    burst(this, this.pet.x, this.pet.y, 0xffc050, 12)
    this.time.delayedCall(700, () => jet.destroy())
  }

  private damageEnemy(e: Creep, dmg: number, dir: number) {
    e.hp -= dmg
    e.setVelocityX(dir * 220)
    e.setVelocityY(-180)
    e.setTint(0xffffff)
    this.time.delayedCall(70, () => e.active && e.clearTint())
    burst(this, e.x, e.y, 0xffe8a0, 8)
    floatText(this, e.x, e.y - 30, '！')
    SFX.hit()
    hitstop(this, 40)
    this.cameras.main.shake(50, 0.004)
    if (e.hp <= 0) {
      SFX.kill()
      burst(this, e.x, e.y, 0xff6688, 12)
      e.disableBody(true, true)
      if (e.boss) this.hint.setText('武者倒下！兩人站上祭壇取回春蜜')
    }
  }

  private hurtHero(h: Hero, e: Creep) {
    if (this.ended || this.time.now < h.grace || h.hurtCd > 0) return
    if (e.windup <= 0 || e.windup > 240 || e.hitThis) return
    e.hitThis = true
    const dmg = e.boss || e.elite ? 2 : 1
    h.hp -= dmg
    h.hurtCd = 900
    h.setVelocityX(Math.sign(h.x - e.x) * 280 || -280)
    h.setVelocityY(-260)
    h.setTint(0xff4444)
    this.time.delayedCall(140, () => h.clearTint())
    SFX.hurt()
    burst(this, h.x, h.y, 0xff4466, 8)
    floatText(this, h.x, h.y - 28, `-${dmg}`, '#ff6677')
    if (h.role === 'girl') this.honeyJet()
    this.refreshHearts()
    if (h.hp <= 0) this.lose(h.role === 'boy' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private spike(h: Hero) {
    if (this.ended || h.hurtCd > 0 || this.time.now < h.grace) return
    h.hp -= 2
    h.hurtCd = 1000
    h.setVelocityY(-440)
    h.setVelocityX(h.facing * -160)
    SFX.spike()
    if (h.role === 'girl') this.honeyJet()
    this.refreshHearts()
    if (h.hp <= 0) this.lose(h.role === 'boy' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private takeHoney(pot: Phaser.Physics.Arcade.Sprite) {
    if (!pot.active) return
    pot.disableBody(true, true)
    this.honeyGot = Math.min(3, this.honeyGot + 1)
    SFX.kill()
    burst(this, pot.x, pot.y, 0xffc050, 14)
    floatText(this, pot.x, pot.y - 20, '春蜜+1', '#ffcc44')
  }

  private updateEnemies(dt: number) {
    this.enemies.getChildren().forEach((o) => {
      const e = o as Creep
      if (!e.active) return
      e.atkCd = Math.max(0, e.atkCd - dt)
      e.windup = Math.max(0, e.windup - dt)
      const t =
        Phaser.Math.Distance.Between(e.x, e.y, this.boy.x, this.boy.y) <
        Phaser.Math.Distance.Between(e.x, e.y, this.girl.x, this.girl.y)
          ? this.boy
          : this.girl
      const dist = Phaser.Math.Distance.Between(e.x, e.y, t.x, t.y)
      const dir = Math.sign(t.x - e.x) || 1
      const spd = e.boss ? 90 : e.elite ? 72 : 58
      e.setVelocityX(dist < 480 ? dir * spd : 0)
      e.setFlipX(dir > 0)
      if (dist < (e.boss ? 74 : 54) && e.windup <= 0 && e.atkCd <= 0) {
        e.setTint(0xff5555)
        e.windup = 340
        e.atkCd = e.boss ? 1100 : 1200
        e.hitThis = false
        this.time.delayedCall(220, () => e.active && e.clearTint())
      }
    })
  }

  private checkWin() {
    if (this.ended) return
    if (this.bossOn) {
      const alive = this.enemies.getChildren().some((o) => (o as Creep).active && (o as Creep).boss)
      if (alive) return
    }
    if (this.boyGoal && this.girlGoal) {
      const sec = ((this.time.now - this.startedAt) / 1000).toFixed(1)
      this.win(`春蜜奪回！\n溪流小路 CLEAR\n用時 ${sec}s　蜜罐 ${this.honeyGot}/3\n按 R 回選單`)
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
    this.banner.setText(`${msg}\n按 R 回選單`).setVisible(true)
  }

  private refreshHearts() {
    for (let i = 0; i < MAX_HP; i++) {
      this.heartsL[i]?.setTexture(i < this.boy.hp ? 'heart-full' : 'heart-empty')
      this.heartsR[i]?.setTexture(i < this.girl.hp ? 'heart-full' : 'heart-empty')
    }
  }

  // —— helpers ——
  private mkHero(x: number, y: number, tex: string, role: 'boy' | 'girl', grace: number): Hero {
    const s = this.physics.add.sprite(x, y, tex) as Hero
    s.role = role
    s.hp = MAX_HP
    s.facing = 1
    s.atkCd = 0
    s.hurtCd = 0
    s.grace = grace
    s.setCollideWorldBounds(true)
    s.setDragX(1500)
    s.setDepth(8)
    s.setScale(role === 'girl' ? 1.35 : 1.4)
    const body = s.body as Phaser.Physics.Arcade.Body
    body.setSize(22, 36)
    body.setOffset(role === 'girl' ? 20 : 24, role === 'girl' ? 28 : 26)
    return s
  }

  private bank(x: number, y: number, w: number) {
    for (let i = x; i < x + w; i += 32) {
      const t = this.ground.create(i + 16, y, 'til-grass') as Phaser.Physics.Arcade.Sprite
      t.refreshBody()
      t.setDepth(3)
    }
  }

  private bridge(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const t = this.ground.create(x + i * 32 + 16, y, 'til-wood') as Phaser.Physics.Arcade.Sprite
      t.refreshBody()
      t.setDepth(3)
    }
  }

  private spikes(x: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.hazards.create(x + i * 24 + 12, GROUND_Y + 28, 'til-spike') as Phaser.Physics.Arcade.Sprite
      s.refreshBody()
      s.setDepth(2)
    }
  }

  private placeEnemies() {
    for (const x of [700, 900, 1200, 1600, 1900, 2300, 2600, 2900, 3300, 3600]) {
      this.mkEnemy(x, GROUND_Y - 40, false, false)
    }
    this.mkEnemy(1500, GROUND_Y - 40, false, true)
    this.mkEnemy(2800, GROUND_Y - 40, false, true)
    this.mkEnemy(760, 290, false, false)
    this.mkEnemy(1840, 230, false, true)
  }

  private mkEnemy(x: number, y: number, boss: boolean, elite: boolean) {
    const e = this.enemies.create(x, y, 'art-enemy') as Creep
    e.hp = boss ? 18 : elite ? 6 : 4
    e.windup = 0
    e.atkCd = Phaser.Math.Between(600, 1200)
    e.hitThis = false
    e.boss = boss
    e.elite = elite
    e.setCollideWorldBounds(true)
    e.setDepth(6)
    e.setScale(boss ? 2.5 : elite ? 1.8 : 1.5)
    if (elite && !boss) e.setTint(0xff8866)
    if (boss) e.setTint(0xffaa77)
    ;(e.body as Phaser.Physics.Arcade.Body).setSize(22, 22)
    return e
  }

  private spawnBoss(x: number, y: number) {
    this.mkEnemy(x, y, true, false)
    this.add
      .text(x, y - 80, '醃鮭魚武者', {
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
