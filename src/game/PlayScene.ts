import Phaser from 'phaser'
import { registerAllSprites } from './pixelArt'

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
 * 鮭鮭熊 — 約 30 秒雙人小關
 * P1 鮭男: WASD / F・空白
 * P2 熊女(笑臉熊): ←→↑ / L・Enter
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
    d: Phaser.Input.Keyboard.Key
    f: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
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
    registerAllSprites(this)
  }

  create() {
    this.ended = false
    this.salmonAtGoal = false
    this.bearAtGoal = false
    this.startedAt = this.time.now

    this.drawBackdrop()

    this.ground = this.physics.add.staticGroup()
    for (let x = 16; x < 960; x += 32) {
      const tile = this.ground.create(x, 524, 'til-ground') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
    }
    // wooden platforms like concept riverside bridges
    this.platWood(160, 400, 4)
    this.platWood(400, 320, 3)
    this.platWood(620, 380, 4)
    this.platWood(780, 280, 3)
    this.platStone(300, 460, 2)

    // shallow river strip
    this.add
      .rectangle(480, 500, 960, 18, 0x3a8ec0, 0.55)
      .setDepth(2)
    for (let x = 40; x < 920; x += 70) {
      this.add
        .ellipse(x, 498, 28, 8, 0xa8d8f0, 0.45)
        .setDepth(3)
    }

    this.salmon = this.spawnFighter(70, 440, 'spr-salmon', 'salmon')
    this.bear = this.spawnFighter(130, 430, 'spr-bear', 'bear')

    this.goal = this.physics.add.sprite(900, 220, 'til-goal')
    this.goal.setImmovable(true)
    this.goal.setScale(1.4)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setSize(24, 36)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setOffset(6, 30)
    this.add
      .text(900, 155, '祭壇', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '13px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(8)

    this.enemies = this.physics.add.group()
    this.spawnEnemy(300, 450)
    this.spawnEnemy(520, 450)
    this.spawnEnemy(660, 340)
    this.spawnEnemy(800, 240)

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
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      f: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      l: kb.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      enter: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    }

    // stage name like concept banner
    this.add
      .text(480, 16, '第一關・溪流小路', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '18px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8',
        padding: { x: 14, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)

    this.hud = this.add
      .text(14, 44, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8dd',
        padding: { x: 8, y: 6 },
        lineSpacing: 5,
      })
      .setScrollFactor(0)
      .setDepth(20)

    this.add
      .text(
        14,
        508,
        'P1 鮭男 WASD+F/空白　｜　P2 笑臉熊 ←→↑ + L/Enter　｜　兩人到祭壇　｜　R 重來',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '11px',
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
        fontSize: '32px',
        color: '#f3e6c8',
        backgroundColor: '#2a1a10cc',
        padding: { x: 22, y: 14 },
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
      230,
    )
    this.controlFighter(
      this.bear,
      this.keys.left,
      this.keys.right,
      this.keys.up,
      this.keys.l,
      this.keys.enter,
      185,
    )

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      e.attackCd = Math.max(0, e.attackCd - dt)
      e.windup = Math.max(0, e.windup - dt)
      const target =
        Phaser.Math.Distance.Between(e.x, e.y, this.salmon.x, this.salmon.y) <
        Phaser.Math.Distance.Between(e.x, e.y, this.bear.x, this.bear.y)
          ? this.salmon
          : this.bear
      const dir = Math.sign(target.x - e.x) || 1
      e.setVelocityX(dir * 55)
      e.setFlipX(dir < 0)
      if (e.windup <= 0 && e.attackCd <= 0) {
        e.setTint(0xff6666)
        e.windup = 420
        e.attackCd = 1400
        this.time.delayedCall(280, () => {
          if (e.active) e.clearTint()
        })
      }
    })

    this.salmon.attackCd = Math.max(0, this.salmon.attackCd - dt)
    this.bear.attackCd = Math.max(0, this.bear.attackCd - dt)
    this.salmon.hurtCd = Math.max(0, this.salmon.hurtCd - dt)
    this.bear.hurtCd = Math.max(0, this.bear.hurtCd - dt)

    if (!this.physics.overlap(this.salmon, this.goal)) this.salmonAtGoal = false
    if (!this.physics.overlap(this.bear, this.goal)) this.bearAtGoal = false

    this.refreshHud()
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-10)
    // sky gradient bands
    g.fillStyle(0x6eb7d6, 1)
    g.fillRect(0, 0, 960, 540)
    g.fillStyle(0x8ec8e0, 1)
    g.fillRect(0, 0, 960, 120)
    g.fillStyle(0xf2d7a4, 0.45)
    g.fillRect(0, 300, 960, 220)

    // distant mountains
    g.fillStyle(0x7aa8b8, 1)
    g.fillTriangle(0, 320, 180, 160, 360, 320)
    g.fillTriangle(280, 320, 480, 140, 700, 320)
    g.fillTriangle(600, 320, 820, 180, 980, 320)
    g.fillStyle(0x9bc4c8, 1)
    g.fillTriangle(120, 320, 260, 200, 400, 320)
    g.fillTriangle(500, 320, 640, 190, 780, 320)

    // town silhouettes left
    g.fillStyle(0xc9a06a, 1)
    g.fillRect(40, 260, 36, 60)
    g.fillRect(90, 240, 40, 80)
    g.fillTriangle(40, 260, 58, 230, 76, 260)
    g.fillTriangle(90, 240, 110, 205, 130, 240)
    g.fillStyle(0xc45c48, 1)
    g.fillRect(200, 250, 10, 70)
    g.fillRect(250, 250, 10, 70)
    g.fillRect(195, 245, 70, 10)

    // trees
    for (const [tx, ty] of [
      [520, 300],
      [560, 310],
      [50, 310],
    ] as const) {
      g.fillStyle(0x6b4a2e, 1)
      g.fillRect(tx, ty, 8, 28)
      g.fillStyle(0x3d7a45, 1)
      g.fillCircle(tx + 4, ty - 4, 16)
    }

    // leaping salmon accents in sky/river vibe
    g.fillStyle(0xe07a4f, 0.7)
    g.fillEllipse(360, 470, 18, 8)
    g.fillEllipse(700, 485, 16, 7)
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

    if (Phaser.Input.Keyboard.JustDown(jump) && body.blocked.down) {
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
    const reach = f.role === 'salmon' ? 56 : 44
    const dmg = f.role === 'salmon' ? 1 : 2
    const key = f.role === 'salmon' ? 'fx-water' : 'fx-hit'
    const fx = this.add.image(f.x + f.facing * reach, f.y - 2, key).setDepth(5)
    this.tweens.add({
      targets: fx,
      alpha: 0,
      x: fx.x + f.facing * 22,
      duration: 180,
      onComplete: () => fx.destroy(),
    })

    // kind bear bounce when attacking
    if (f.role === 'bear') {
      this.tweens.add({
        targets: f,
        scaleY: 1.85,
        scaleX: 2.1,
        yoyo: true,
        duration: 80,
      })
    }

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      const dx = e.x - f.x
      const dy = Math.abs(e.y - f.y)
      if (Math.sign(dx) === f.facing && Math.abs(dx) < reach + 22 && dy < 40) {
        e.hp -= dmg
        e.setVelocityX(f.facing * 220)
        e.setVelocityY(-180)
        e.setTint(0xffffff)
        this.time.delayedCall(80, () => {
          if (e.active) e.clearTint()
        })
        if (e.hp <= 0) e.disableBody(true, true)
      }
    })
  }

  private hurtPlayer(f: Fighter, e: Creep) {
    if (this.ended || f.hurtCd > 0 || e.windup > 200) return
    if (e.attackCd > 1000) {
      f.hp -= 1
      f.hurtCd = 900
      f.setVelocityX(Math.sign(f.x - e.x) * 260 || -260)
      f.setVelocityY(-240)
      f.setTint(0xff4444)
      this.time.delayedCall(120, () => f.clearTint())
      this.refreshHud()
      if (f.hp <= 0) this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '笑臉熊倒下了…')
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
        `P2 笑臉熊 ${hearts(this.bear.hp, this.bear.maxHp)}${bGoal}\n` +
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
    s.setDepth(6)
    s.setScale(2)
    const body = s.body as Phaser.Physics.Arcade.Body
    if (role === 'bear') {
      body.setSize(22, 30)
      body.setOffset(9, 10)
      // idle friendly bob
      this.tweens.add({
        targets: s,
        scaleY: 2.06,
        scaleX: 1.96,
        yoyo: true,
        repeat: -1,
        duration: 700,
        ease: 'Sine.easeInOut',
      })
    } else {
      body.setSize(16, 28)
      body.setOffset(6, 8)
    }
    return s
  }

  private spawnEnemy(x: number, y: number) {
    const e = this.enemies.create(x, y, 'spr-enemy') as Creep
    e.hp = 3
    e.windup = 0
    e.attackCd = Phaser.Math.Between(400, 900)
    e.setCollideWorldBounds(true)
    e.setBounce(0)
    e.setDepth(5)
    e.setScale(2)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.setSize(18, 18)
    body.setOffset(5, 5)
  }

  private platWood(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const px = x + i * 32
      const tile = this.ground.create(px, y, 'til-wood') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
    }
  }

  private platStone(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const px = x + i * 32
      const tile = this.ground.create(px, y, 'til-stone') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
    }
  }
}
