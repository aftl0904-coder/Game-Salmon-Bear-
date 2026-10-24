import Phaser from 'phaser'

type Fighter = Phaser.Physics.Arcade.Sprite & {
  hp: number
  maxHp: number
  facing: 1 | -1
  attackCd: number
  hurtCd: number
  role: 'salmon' | 'bear'
}

type Creep = Phaser.Physics.Arcade.Sprite & {
  hp: number
  windup: number
  attackCd: number
}

/**
 * 鮭鮭熊 — 約 30 秒可通關的雙人小關
 * P1 鮭男: WASD 移動 / 空白或 F 攻擊
 * P2 熊女: 方向鍵移動 / L 或 Enter 攻擊
 */
export class PlayScene extends Phaser.Scene {
  private salmon!: Fighter
  private bear!: Fighter
  private enemies!: Phaser.Physics.Arcade.Group
  private ground!: Phaser.Physics.Arcade.StaticGroup
  private goal!: Phaser.Physics.Arcade.Sprite
  private keys!: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
    f: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    l: Phaser.Input.Keyboard.Key
    enter: Phaser.Input.Keyboard.Key
    r: Phaser.Input.Keyboard.Key
  }
  private hud!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private ended = false
  private startedAt = 0
  private salmonAtGoal = false
  private bearAtGoal = false

  constructor() {
    super('play')
  }

  preload() {
    // solid pixel blocks
    this.makeBlock('px-salmon', 28, 36, 0xe07a4f)
    this.makeBlock('px-bear', 34, 40, 0xb07a3a)
    this.makeBlock('px-enemy', 30, 30, 0x6b3a4a)
    this.makeBlock('px-ground', 48, 48, 0x6b4a2e)
    this.makeBlock('px-grass', 48, 12, 0x4d8a4a)
    this.makeBlock('px-goal', 24, 64, 0xd4a017)
    this.makeBlock('px-hit', 18, 10, 0xffe8a0)
    this.makeBlock('px-water', 22, 14, 0x3a9ad9)
  }

  create() {
    this.ended = false
    this.salmonAtGoal = false
    this.bearAtGoal = false
    this.startedAt = this.time.now
    this.cameras.main.setBackgroundColor('#6eb7d6')

    // sky wash
    this.add.rectangle(480, 270, 960, 540, 0x6eb7d6).setDepth(-10)
    this.add.rectangle(480, 420, 960, 240, 0xf2d7a4, 0.35).setDepth(-9)

    this.ground = this.physics.add.staticGroup()
    // floor
    for (let x = 24; x < 960; x += 48) {
      const tile = this.ground.create(x, 516, 'px-ground') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
      this.add.image(x, 486, 'px-grass').setDepth(1)
    }
    // platforms
    this.plat(180, 380, 3)
    this.plat(420, 300, 2)
    this.plat(680, 360, 3)
    this.plat(820, 260, 2)

    this.salmon = this.spawnFighter(80, 430, 'px-salmon', 'salmon')
    this.bear = this.spawnFighter(140, 430, 'px-bear', 'bear')

    this.goal = this.physics.add.sprite(900, 220, 'px-goal')
    this.goal.setImmovable(true)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.add
      .text(900, 170, '祭壇', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)

    this.enemies = this.physics.add.group()
    this.spawnEnemy(320, 450)
    this.spawnEnemy(560, 450)
    this.spawnEnemy(700, 320)
    this.spawnEnemy(820, 220)

    this.physics.add.collider(this.salmon, this.ground)
    this.physics.add.collider(this.bear, this.ground)
    this.physics.add.collider(this.enemies, this.ground)
    this.physics.add.collider(this.salmon, this.bear)

    this.physics.add.overlap(this.salmon, this.goal, () => {
      this.salmonAtGoal = true
      this.checkWin()
    })
    this.physics.add.overlap(this.bear, this.goal, () => {
      this.bearAtGoal = true
      this.checkWin()
    })

    this.physics.add.overlap(this.salmon, this.enemies, (_s, e) => {
      this.hurtPlayer(this.salmon, e as Creep)
    })
    this.physics.add.overlap(this.bear, this.enemies, (_s, e) => {
      this.hurtPlayer(this.bear, e as Creep)
    })

    const kb = this.input.keyboard!
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      f: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      l: kb.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      enter: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    }

    this.add
      .text(480, 18, '鮭鮭熊 — 雙人小關（約 30 秒）', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '20px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)

    this.hud = this.add
      .text(16, 48, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8cc',
        padding: { x: 8, y: 6 },
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(20)

    this.add
      .text(
        16,
        500,
        'P1 鮭男 WASD+F/空白　｜　P2 熊女 ←→↑ + L/Enter　｜　兩人到祭壇　｜　R 重來',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '12px',
          color: '#f3e6c8',
          backgroundColor: '#2a1a10aa',
          padding: { x: 8, y: 4 },
        },
      )
      .setScrollFactor(0)
      .setDepth(20)

    this.banner = this.add
      .text(480, 270, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '36px',
        color: '#f3e6c8',
        backgroundColor: '#2a1a10cc',
        padding: { x: 20, y: 12 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false)

    this.refreshHud()
  }

  update(_t: number, dt: number) {
    if (this.ended) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.scene.restart()
      return
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.scene.restart()

    this.controlFighter(
      this.salmon,
      this.keys.a,
      this.keys.d,
      this.keys.w,
      this.keys.f,
      this.keys.space,
      220,
    )
    this.controlFighter(
      this.bear,
      this.keys.left,
      this.keys.right,
      this.keys.up,
      this.keys.l,
      this.keys.enter,
      180,
    )

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      e.attackCd = Math.max(0, e.attackCd - dt)
      e.windup = Math.max(0, e.windup - dt)
      // slow patrol toward nearest player
      const target =
        Phaser.Math.Distance.Between(e.x, e.y, this.salmon.x, this.salmon.y) <
        Phaser.Math.Distance.Between(e.x, e.y, this.bear.x, this.bear.y)
          ? this.salmon
          : this.bear
      const dir = Math.sign(target.x - e.x) || 1
      e.setVelocityX(dir * 55)
      e.setFlipX(dir < 0)
      if (e.windup <= 0 && e.attackCd <= 0) {
        // telegraph then bite window via tint
        e.setTint(0xff6666)
        e.windup = 420
        e.attackCd = 1400
        this.time.delayedCall(280, () => {
          if (!e.active) return
          e.clearTint()
        })
      }
    })

    this.salmon.attackCd = Math.max(0, this.salmon.attackCd - dt)
    this.bear.attackCd = Math.max(0, this.bear.attackCd - dt)
    this.salmon.hurtCd = Math.max(0, this.salmon.hurtCd - dt)
    this.bear.hurtCd = Math.max(0, this.bear.hurtCd - dt)

    // goal flags reset if leave
    if (!this.physics.overlap(this.salmon, this.goal)) this.salmonAtGoal = false
    if (!this.physics.overlap(this.bear, this.goal)) this.bearAtGoal = false

    this.refreshHud()
  }

  private controlFighter(
    f: Fighter,
    left: Phaser.Input.Keyboard.Key,
    right: Phaser.Input.Keyboard.Key,
    jump: Phaser.Input.Keyboard.Key,
    atkA: Phaser.Input.Keyboard.Key,
    atkB: Phaser.Input.Keyboard.Key,
    speed: number,
  ) {
    const body = f.body as Phaser.Physics.Arcade.Body
    let vx = 0
    if (left.isDown) vx -= speed
    if (right.isDown) vx += speed
    f.setVelocityX(vx)
    if (vx !== 0) f.facing = vx > 0 ? 1 : -1
    f.setFlipX(f.facing < 0)

    if ((jump.isDown || Phaser.Input.Keyboard.JustDown(jump)) && body.blocked.down) {
      f.setVelocityY(f.role === 'bear' ? -520 : -560)
    }

    if (
      f.attackCd <= 0 &&
      (Phaser.Input.Keyboard.JustDown(atkA) || Phaser.Input.Keyboard.JustDown(atkB))
    ) {
      this.doAttack(f)
    }
  }

  private doAttack(f: Fighter) {
    f.attackCd = f.role === 'salmon' ? 380 : 520
    const reach = f.role === 'salmon' ? 54 : 42
    const dmg = f.role === 'salmon' ? 1 : 2
    const key = f.role === 'salmon' ? 'px-water' : 'px-hit'
    const fx = this.add.image(f.x + f.facing * reach, f.y - 4, key).setDepth(5)
    this.tweens.add({
      targets: fx,
      alpha: 0,
      x: fx.x + f.facing * 20,
      duration: 180,
      onComplete: () => fx.destroy(),
    })

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      const dx = e.x - f.x
      const dy = Math.abs(e.y - f.y)
      if (Math.sign(dx) === f.facing && Math.abs(dx) < reach + 20 && dy < 36) {
        e.hp -= dmg
        e.setVelocityX(f.facing * 220)
        e.setVelocityY(-180)
        e.setTint(0xffffff)
        this.time.delayedCall(80, () => {
          if (e.active) e.clearTint()
        })
        if (e.hp <= 0) {
          e.disableBody(true, true)
        }
      }
    })
  }

  private hurtPlayer(f: Fighter, e: Creep) {
    if (this.ended || f.hurtCd > 0 || e.windup > 200) return
    // only hurt during bite window after telegraph started
    if (e.attackCd > 1000) {
      f.hp -= 1
      f.hurtCd = 900
      f.setVelocityX(Math.sign(f.x - e.x) * 260 || -260)
      f.setVelocityY(-240)
      f.setTint(0xff4444)
      this.time.delayedCall(120, () => f.clearTint())
      this.refreshHud()
      if (f.hp <= 0) this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '熊女倒下了…')
    }
  }

  private checkWin() {
    if (this.ended) return
    if (this.salmonAtGoal && this.bearAtGoal) {
      const sec = ((this.time.now - this.startedAt) / 1000).toFixed(1)
      this.win(`抵達祭壇！\n用時 ${sec} 秒\n按 R 再玩`)
    }
  }

  private win(msg: string) {
    this.ended = true
    this.salmon.setVelocity(0, 0)
    this.bear.setVelocity(0, 0)
    this.banner.setText(msg).setVisible(true)
  }

  private lose(msg: string) {
    this.ended = true
    this.banner.setText(`${msg}\n按 R 重來`).setVisible(true)
  }

  private refreshHud() {
    const hearts = (n: number, max: number) =>
      '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, max - n))
    const sGoal = this.salmonAtGoal ? ' ✓' : ''
    const bGoal = this.bearAtGoal ? ' ✓' : ''
    this.hud.setText(
      `P1 鮭男 ${hearts(this.salmon.hp, this.salmon.maxHp)}${sGoal}\n` +
        `P2 熊女 ${hearts(this.bear.hp, this.bear.maxHp)}${bGoal}\n` +
        `目標：兩人一起站上祭壇`,
    )
  }

  private spawnFighter(x: number, y: number, tex: string, role: 'salmon' | 'bear'): Fighter {
    const s = this.physics.add.sprite(x, y, tex) as Fighter
    s.role = role
    s.hp = 3
    s.maxHp = 3
    s.facing = 1
    s.attackCd = 0
    s.hurtCd = 0
    s.setCollideWorldBounds(true)
    s.setBounce(0)
    s.setDragX(1200)
    const body = s.body as Phaser.Physics.Arcade.Body
    body.setSize(role === 'bear' ? 28 : 22, role === 'bear' ? 34 : 30)
    return s
  }

  private spawnEnemy(x: number, y: number) {
    const e = this.enemies.create(x, y, 'px-enemy') as Creep
    e.hp = 3
    e.windup = 0
    e.attackCd = Phaser.Math.Between(400, 900)
    e.setCollideWorldBounds(true)
    e.setBounce(0)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.setSize(26, 26)
  }

  private plat(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const px = x + i * 48
      const tile = this.ground.create(px, y, 'px-ground') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
      this.add.image(px, y - 30, 'px-grass').setDepth(1)
    }
  }

  private makeBlock(key: string, w: number, h: number, color: number) {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(color, 1)
    g.fillRect(0, 0, w, h)
    // pixel edge
    g.lineStyle(2, 0x1a1010, 0.85)
    g.strokeRect(1, 1, w - 2, h - 2)
    g.generateTexture(key, w, h)
    g.destroy()
  }
}
