import Phaser from 'phaser'
import { registerTiles } from './tiles'

const WORLD_W = 4200
const WORLD_H = 540
const GROUND_Y = 470

type Fighter = Phaser.Physics.Arcade.Sprite & {
  hp: number
  maxHp: number
  facing: 1 | -1
  attackCd: number
  hurtCd: number
  role: 'salmon' | 'bear'
  graceUntil: number
}

type Creep = Phaser.Physics.Arcade.Sprite & {
  hp: number
  windup: number
  attackCd: number
  swingHit: boolean
  isBoss?: boolean
}

/**
 * 鮭鮭熊 — 第一關・溪流小路（約 3 分鐘）
 * P1 鮭男: WASD / F・空白
 * P2 熊女: ←→↑ / L・Enter（控笑臉熊；熊女跟在熊後方）
 */
export class PlayScene extends Phaser.Scene {
  private salmon!: Fighter
  private bear!: Fighter
  private girl!: Phaser.GameObjects.Image
  private enemies!: Phaser.Physics.Arcade.Group
  private ground!: Phaser.Physics.Arcade.StaticGroup
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private goal!: Phaser.Physics.Arcade.Sprite
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private hudLeft!: Phaser.GameObjects.Container
  private hudRight!: Phaser.GameObjects.Container
  private heartImgsL: Phaser.GameObjects.Image[] = []
  private heartImgsR: Phaser.GameObjects.Image[] = []
  private banner!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private ended = false
  private startedAt = 0
  private salmonAtGoal = false
  private bearAtGoal = false
  private bossSpawned = false
  private progressText!: Phaser.GameObjects.Text

  constructor() {
    super('play')
  }

  preload() {
    registerTiles(this)
    this.load.image('art-salmon', '/art/salmon-boy.png')
    this.load.image('art-girl', '/art/bear-girl.png')
    this.load.image('art-bear', '/art/kind-bear.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')
  }

  create() {
    this.ended = false
    this.salmonAtGoal = false
    this.bearAtGoal = false
    this.bossSpawned = false
    this.startedAt = this.time.now
    this.heartImgsL = []
    this.heartImgsR = []

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)

    this.drawBackdrop()
    this.buildLevel()

    const grace = this.time.now + 2800
    this.salmon = this.spawnFighter(90, GROUND_Y - 40, 'art-salmon', 'salmon', grace)
    this.bear = this.spawnFighter(160, GROUND_Y - 40, 'art-bear', 'bear', grace)

    this.girl = this.add.image(130, GROUND_Y - 40, 'art-girl').setDepth(7).setScale(1.15)
    // kind bob on bear
    this.tweens.add({
      targets: this.bear,
      scaleY: 1.42,
      scaleX: 1.34,
      yoyo: true,
      repeat: -1,
      duration: 750,
      ease: 'Sine.easeInOut',
    })

    this.goal = this.physics.add.sprite(WORLD_W - 120, GROUND_Y - 70, 'til-goal')
    this.goal.setImmovable(true)
    this.goal.setScale(1.5)
    this.goal.setDepth(4)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setSize(22, 36)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setOffset(8, 36)
    this.add
      .text(WORLD_W - 120, GROUND_Y - 150, '祭壇', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(8)

    this.enemies = this.physics.add.group()
    this.placeEnemies()

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
    this.physics.add.overlap(this.salmon, this.enemies, (_s, e) =>
      this.hurtPlayer(this.salmon, e as Creep),
    )
    this.physics.add.overlap(this.bear, this.enemies, (_s, e) =>
      this.hurtPlayer(this.bear, e as Creep),
    )
    this.physics.add.overlap(this.salmon, this.hazards, () => this.spikeHurt(this.salmon))
    this.physics.add.overlap(this.bear, this.hazards, () => this.spikeHurt(this.bear))

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

    this.buildHud()

    this.banner = this.add
      .text(480, 270, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '30px',
        color: '#f3e6c8',
        backgroundColor: '#2a1a10cc',
        padding: { x: 22, y: 14 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false)

    this.cameras.main.startFollow(this.salmon, true, 0.08, 0.08)
    this.cameras.main.setDeadzone(120, 80)

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
      240,
    )
    this.controlFighter(
      this.bear,
      this.keys.left,
      this.keys.right,
      this.keys.up,
      this.keys.l,
      this.keys.enter,
      200,
    )

    // girl follows behind bear (concept: 熊女 behind bear)
    const gx = this.bear.x - this.bear.facing * 28
    this.girl.x = Phaser.Math.Linear(this.girl.x, gx, 0.2)
    this.girl.y = this.bear.y - 6
    this.girl.setFlipX(this.bear.facing < 0)
    this.girl.setDepth(this.bear.depth - 1)

    // camera midpoint
    const midX = (this.salmon.x + this.bear.x) / 2
    this.cameras.main.centerOn(
      Phaser.Math.Clamp(midX, 480, WORLD_W - 480),
      WORLD_H / 2,
    )

    this.updateEnemies(dt)

    this.salmon.attackCd = Math.max(0, this.salmon.attackCd - dt)
    this.bear.attackCd = Math.max(0, this.bear.attackCd - dt)
    this.salmon.hurtCd = Math.max(0, this.salmon.hurtCd - dt)
    this.bear.hurtCd = Math.max(0, this.bear.hurtCd - dt)

    if (!this.physics.overlap(this.salmon, this.goal)) this.salmonAtGoal = false
    if (!this.physics.overlap(this.bear, this.goal)) this.bearAtGoal = false

    // boss gate near end
    if (!this.bossSpawned && Math.max(this.salmon.x, this.bear.x) > WORLD_W - 900) {
      this.bossSpawned = true
      this.spawnBoss(WORLD_W - 520, GROUND_Y - 50)
      this.hint.setText('關底出現了——醃鮭魚武者！一起打倒它再上祭壇')
      this.time.delayedCall(4000, () => {
        if (!this.ended) this.hint.setText('')
      })
    }

    const pct = Math.min(
      100,
      Math.floor((Math.max(this.salmon.x, this.bear.x) / (WORLD_W - 200)) * 100),
    )
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.progressText.setText(`進度 ${pct}%　｜　${sec}s`)

    this.refreshHud()
  }

  private buildHud() {
    // scroll banner
    const scroll = this.add.image(480, 28, 'ui-scroll').setScrollFactor(0).setDepth(30).setScale(1.15)
    this.add
      .text(480, 26, '第一關・溪流小路', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '18px',
        color: '#2a1a10',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31)

    this.hudLeft = this.add.container(16, 58).setScrollFactor(0).setDepth(30)
    this.hudRight = this.add.container(780, 58).setScrollFactor(0).setDepth(30)

    const lLabel = this.add
      .text(0, 0, 'P1 鮭男', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#f5d76e',
        stroke: '#2a1a10',
        strokeThickness: 4,
      })
      .setOrigin(0, 0)
    const rLabel = this.add
      .text(0, 0, 'P2 熊女', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#f5d76e',
        stroke: '#2a1a10',
        strokeThickness: 4,
      })
      .setOrigin(0, 0)
    this.hudLeft.add(lLabel)
    this.hudRight.add(rLabel)

    for (let i = 0; i < 4; i++) {
      const h = this.add.image(10 + i * 18, 28, 'heart-full').setOrigin(0.5)
      this.heartImgsL.push(h)
      this.hudLeft.add(h)
    }
    for (let i = 0; i < 4; i++) {
      const h = this.add.image(10 + i * 18, 28, 'heart-full').setOrigin(0.5)
      this.heartImgsR.push(h)
      this.hudRight.add(h)
    }

    this.progressText = this.add
      .text(480, 52, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#2a1a10',
        backgroundColor: '#f3e6c8aa',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)

    this.hint = this.add
      .text(480, 500, '兩人一起前進 → 避開刺坑 → 打倒關底 → 一起站上祭壇　｜　R 重來', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#f3e6c8',
        backgroundColor: '#2a1a10aa',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)

    void scroll
  }

  private refreshHud() {
    for (let i = 0; i < 4; i++) {
      this.heartImgsL[i]?.setTexture(i < this.salmon.hp ? 'heart-full' : 'heart-empty')
      this.heartImgsR[i]?.setTexture(i < this.bear.hp ? 'heart-full' : 'heart-empty')
    }
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-20)
    // sky
    g.fillStyle(0x5eb0d8, 1)
    g.fillRect(0, 0, WORLD_W, WORLD_H)
    g.fillStyle(0x8ecae6, 1)
    g.fillRect(0, 0, WORLD_W, 140)

    // clouds
    for (let x = 80; x < WORLD_W; x += 280) {
      g.fillStyle(0xffffff, 0.9)
      g.fillEllipse(x, 70 + (x % 60), 70, 28)
      g.fillEllipse(x + 40, 65, 50, 22)
    }

    // far hills
    for (let x = 0; x < WORLD_W; x += 220) {
      g.fillStyle(0x6fa86a, 1)
      g.fillEllipse(x + 110, 340, 260, 120)
      g.fillStyle(0x88c078, 1)
      g.fillEllipse(x + 40, 360, 180, 90)
    }

    // river band
    g.fillStyle(0x3a9ad0, 1)
    g.fillRect(0, 480, WORLD_W, 60)
    g.fillStyle(0x7ec8e8, 0.5)
    for (let x = 0; x < WORLD_W; x += 48) {
      g.fillEllipse(x + 20, 500, 30, 8)
    }
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()

    // continuous grassy banks with gaps for spikes
    const segments: Array<{ x: number; w: number; y?: number }> = [
      { x: 0, w: 520 },
      { x: 620, w: 400 },
      { x: 1120, w: 360 },
      { x: 1580, w: 480 },
      { x: 2180, w: 320 },
      { x: 2620, w: 420 },
      { x: 3160, w: 400 },
      { x: 3680, w: 520 },
    ]
    for (const seg of segments) {
      this.grassBank(seg.x, seg.y ?? GROUND_Y, seg.w)
    }

    // wooden bridges over gaps
    this.woodBridge(520, GROUND_Y - 8, 4)
    this.woodBridge(1020, GROUND_Y - 8, 4)
    this.woodBridge(1480, GROUND_Y - 40, 4)
    this.woodBridge(2060, GROUND_Y - 8, 5)
    this.woodBridge(2500, GROUND_Y - 8, 5)
    this.woodBridge(3040, GROUND_Y - 20, 5)
    this.woodBridge(3560, GROUND_Y - 8, 5)

    // high platforms
    this.woodBridge(740, 340, 3)
    this.woodBridge(1280, 300, 3)
    this.woodBridge(1800, 280, 4)
    this.woodBridge(2360, 320, 3)
    this.woodBridge(2880, 300, 4)
    this.woodBridge(3400, 310, 3)

    // spike pits in water gaps
    this.spikePit(540, 6)
    this.spikePit(1040, 6)
    this.spikePit(2080, 7)
    this.spikePit(2520, 7)
    this.spikePit(3580, 6)

    // salmon sign near start
    this.add.image(280, GROUND_Y - 50, 'sign-salmon').setDepth(3).setScale(1.4)

    // water tiles visual under bridges
    for (let x = 0; x < WORLD_W; x += 32) {
      this.add.image(x + 16, 508, 'til-water').setDepth(1).setAlpha(0.85)
    }
  }

  private grassBank(startX: number, y: number, width: number) {
    for (let x = startX; x < startX + width; x += 32) {
      const tile = this.ground.create(x + 16, y, 'til-grass') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
      tile.setDepth(2)
    }
  }

  private woodBridge(startX: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const tile = this.ground.create(startX + i * 32 + 16, y, 'til-wood') as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
      tile.setDepth(3)
    }
  }

  private spikePit(startX: number, count: number) {
    for (let i = 0; i < count; i++) {
      const s = this.hazards.create(
        startX + i * 24 + 12,
        GROUND_Y + 28,
        'til-spike',
      ) as Phaser.Physics.Arcade.Sprite
      s.refreshBody()
      s.setDepth(2)
    }
  }

  private placeEnemies() {
    const spots = [
      680, 900, 1200, 1350, 1700, 1950, 2280, 2450, 2750, 2950, 3300, 3500,
    ]
    for (const x of spots) {
      this.spawnEnemy(x, GROUND_Y - 40, false)
    }
    // a few on high platforms
    this.spawnEnemy(800, 300, false)
    this.spawnEnemy(1860, 240, false)
    this.spawnEnemy(2920, 260, false)
  }

  private updateEnemies(dt: number) {
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
      const dist = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y)
      const dir = Math.sign(target.x - e.x) || 1
      const speed = e.isBoss ? 70 : 48
      if (dist < 420) {
        e.setVelocityX(dir * speed)
        e.setFlipX(dir > 0) // art faces left by default-ish
      } else {
        e.setVelocityX(0)
      }

      if (dist < (e.isBoss ? 70 : 52) && e.windup <= 0 && e.attackCd <= 0) {
        e.setTint(0xff6666)
        e.windup = 480
        e.attackCd = e.isBoss ? 1600 : 1500
        e.swingHit = false
        this.time.delayedCall(300, () => {
          if (e.active) e.clearTint()
        })
      }
    })
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
      f.setVelocityY(f.role === 'bear' ? -560 : -600)
    }

    if (
      f.attackCd <= 0 &&
      (Phaser.Input.Keyboard.JustDown(atkA) || Phaser.Input.Keyboard.JustDown(atkB))
    ) {
      this.doAttack(f)
    }
  }

  private doAttack(f: Fighter) {
    f.attackCd = f.role === 'salmon' ? 360 : 480
    const reach = f.role === 'salmon' ? 70 : 56
    const dmg = f.role === 'salmon' ? 1 : 2
    const key = f.role === 'salmon' ? 'fx-salmon' : 'fx-hit'
    const fx = this.add.image(f.x + f.facing * reach, f.y - 4, key).setDepth(9)
    this.tweens.add({
      targets: fx,
      alpha: 0,
      x: fx.x + f.facing * 28,
      duration: 200,
      onComplete: () => fx.destroy(),
    })

    if (f.role === 'bear') {
      this.tweens.add({
        targets: f,
        scaleY: 1.2,
        scaleX: 1.5,
        yoyo: true,
        duration: 90,
      })
    }

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      const dx = e.x - f.x
      const dy = Math.abs(e.y - f.y)
      if (Math.sign(dx) === f.facing && Math.abs(dx) < reach + 28 && dy < 48) {
        e.hp -= dmg
        e.setVelocityX(f.facing * 240)
        e.setVelocityY(-200)
        e.setTint(0xffffff)
        this.time.delayedCall(80, () => {
          if (e.active) e.clearTint()
        })
        // bang mark
        const bang = this.add
          .text(e.x, e.y - 40, '！', {
            fontFamily: 'Noto Sans TC, sans-serif',
            fontSize: '22px',
            color: '#ff3333',
            stroke: '#fff',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(12)
        this.tweens.add({
          targets: bang,
          y: bang.y - 20,
          alpha: 0,
          duration: 400,
          onComplete: () => bang.destroy(),
        })
        if (e.hp <= 0) {
          e.disableBody(true, true)
          if (e.isBoss) {
            this.hint.setText('武者倒下了！兩人一起站上祭壇通關')
          }
        }
      }
    })
  }

  private hurtPlayer(f: Fighter, e: Creep) {
    if (this.ended) return
    if (this.time.now < f.graceUntil) return
    if (f.hurtCd > 0) return
    // only during bite window, once per swing
    if (e.windup <= 0 || e.windup > 280) return
    if (e.swingHit) return
    e.swingHit = true

    f.hp -= e.isBoss ? 2 : 1
    f.hurtCd = 1000
    f.setVelocityX(Math.sign(f.x - e.x) * 280 || -280)
    f.setVelocityY(-260)
    f.setTint(0xff4444)
    this.time.delayedCall(140, () => f.clearTint())
    this.refreshHud()
    if (f.hp <= 0) {
      this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '熊女倒下了…')
    }
  }

  private spikeHurt(f: Fighter) {
    if (this.ended || f.hurtCd > 0 || this.time.now < f.graceUntil) return
    f.hp -= 1
    f.hurtCd = 900
    f.setVelocityY(-420)
    f.setVelocityX(f.facing * -160)
    f.setTint(0xff4444)
    this.time.delayedCall(140, () => f.clearTint())
    this.refreshHud()
    if (f.hp <= 0) this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private checkWin() {
    if (this.ended) return
    // require boss defeated if spawned
    if (this.bossSpawned) {
      const bossAlive = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && e.isBoss
      })
      if (bossAlive) return
    }
    if (this.salmonAtGoal && this.bearAtGoal) {
      const sec = ((this.time.now - this.startedAt) / 1000).toFixed(1)
      this.win(`溪流小路 クリア！\n用時 ${sec} 秒\n按 R 再玩`)
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

  private spawnFighter(
    x: number,
    y: number,
    tex: string,
    role: 'salmon' | 'bear',
    graceUntil: number,
  ): Fighter {
    const s = this.physics.add.sprite(x, y, tex) as Fighter
    s.role = role
    s.hp = 4
    s.maxHp = 4
    s.facing = 1
    s.attackCd = 0
    s.hurtCd = 0
    s.graceUntil = graceUntil
    s.setCollideWorldBounds(true)
    s.setBounce(0)
    s.setDragX(1400)
    s.setDepth(8)
    s.setScale(role === 'bear' ? 1.38 : 1.35)
    const body = s.body as Phaser.Physics.Arcade.Body
    if (role === 'bear') {
      body.setSize(28, 36)
      body.setOffset(22, 28)
    } else {
      body.setSize(24, 40)
      body.setOffset(24, 24)
    }
    return s
  }

  private spawnEnemy(x: number, y: number, isBoss: boolean) {
    const e = this.enemies.create(x, y, 'art-enemy') as Creep
    e.hp = isBoss ? 14 : 3
    e.windup = 0
    e.attackCd = Phaser.Math.Between(800, 1600)
    e.swingHit = false
    e.isBoss = isBoss
    e.setCollideWorldBounds(true)
    e.setBounce(0)
    e.setDepth(6)
    e.setScale(isBoss ? 2.4 : 1.5)
    if (isBoss) e.setTint(0xffaa88)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.setSize(isBoss ? 28 : 22, isBoss ? 28 : 22)
    body.setOffset(14, 14)
    return e
  }

  private spawnBoss(x: number, y: number) {
    const b = this.spawnEnemy(x, y, true)
    this.add
      .text(x, y - 70, '醃鮭魚武者', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#f3e6c8',
        backgroundColor: '#6b2030',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(12)
    return b
  }
}
