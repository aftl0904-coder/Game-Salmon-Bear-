import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { burst, floatText, hitstop } from './fx'
import { SFX, startBgm, unlockAudio } from './audio'

const WORLD_W = 4600
const WORLD_H = 540
const GROUND_Y = 470
const MAX_HP = 3

type Fighter = Phaser.Physics.Arcade.Sprite & {
  hp: number
  maxHp: number
  facing: 1 | -1
  attackCd: number
  hurtCd: number
  role: 'salmon' | 'bear'
  graceUntil: number
  baseScale: number
  walkPhase: number
  wasGrounded: boolean
  stepAcc: number
  shadow: Phaser.GameObjects.Image
  animLockUntil: number
}

type Creep = Phaser.Physics.Arcade.Sprite & {
  hp: number
  windup: number
  attackCd: number
  swingHit: boolean
  isBoss?: boolean
  isElite?: boolean
}

/**
 * 鮭鮭熊 — 第一關・溪流小路（偏硬・約 3 分鐘）
 * P1 鮭男 WASD / F・空白
 * P2 熊女 ←→↑ / L・Enter（控笑臉熊）
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
  private waterDeep!: Phaser.GameObjects.TileSprite
  private waterMid!: Phaser.GameObjects.TileSprite
  private waterFoam!: Phaser.GameObjects.TileSprite
  private mountFar!: Phaser.GameObjects.TileSprite
  private mountNear!: Phaser.GameObjects.TileSprite
  private cloudLayer!: Phaser.GameObjects.TileSprite
  private girlShadow!: Phaser.GameObjects.Image
  private audioReady = false
  private girlWalk = 0

  constructor() {
    super('play')
  }

  preload() {
    registerTiles(this)
    registerWorldArt(this)
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
    this.audioReady = false
    this.girlWalk = 0

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.fadeIn(500, 20, 40, 70)

    // browser needs a gesture before audio
    const armAudio = () => {
      if (this.audioReady) return
      this.audioReady = true
      unlockAudio()
      startBgm()
    }
    this.input.keyboard?.on('keydown', armAudio)
    this.input.on('pointerdown', armAudio)

    this.drawBackdrop()
    this.buildLevel()

    // short grace — harder
    const grace = this.time.now + 1200
    this.salmon = this.spawnFighter(90, GROUND_Y - 40, 'art-salmon', 'salmon', grace)
    this.bear = this.spawnFighter(160, GROUND_Y - 40, 'art-bear', 'bear', grace)

    this.girlShadow = this.add
      .image(130, GROUND_Y + 18, 'shadow-blob')
      .setDepth(5)
      .setAlpha(0.55)
      .setScale(0.85, 0.7)
    this.girl = this.add.image(130, GROUND_Y - 40, 'art-girl').setDepth(7).setScale(1.2)

    this.goal = this.physics.add.sprite(WORLD_W - 140, GROUND_Y - 78, 'til-goal')
    this.goal.setImmovable(true)
    this.goal.setScale(1.55)
    this.goal.setDepth(4)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).allowGravity = false
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setSize(22, 36)
    ;(this.goal.body as Phaser.Physics.Arcade.Body).setOffset(10, 42)
    // stable soft glow (no alpha flicker)
    const goalGlow = this.add
      .circle(WORLD_W - 140, GROUND_Y - 50, 28, 0xffe08a, 0.12)
      .setDepth(3)
    this.tweens.add({
      targets: goalGlow,
      scale: 1.15,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    })
    this.add
      .text(WORLD_W - 140, GROUND_Y - 165, '祭壇', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0',
        padding: { x: 7, y: 3 },
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
        color: '#f7e7c0',
        backgroundColor: '#1a1020ee',
        padding: { x: 24, y: 16 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false)

    this.hint.setText('按任意鍵開始（音樂）　｜　HARD　｜　兩人到祭壇　｜　R 重來')

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
      235,
    )
    this.controlFighter(
      this.bear,
      this.keys.left,
      this.keys.right,
      this.keys.up,
      this.keys.l,
      this.keys.enter,
      195,
    )

    const gx = this.bear.x - this.bear.facing * 30
    this.girl.x = Phaser.Math.Linear(this.girl.x, gx, 0.22)
    const girlMoving = Math.abs(this.bear.body!.velocity.x) > 20
    if (girlMoving) this.girlWalk += dt * 0.014
    const girlBob = girlMoving ? Math.sin(this.girlWalk) * 2 : 0
    this.girl.y = this.bear.y - 8 + girlBob
    this.girl.setFlipX(this.bear.facing < 0)
    this.girl.setDepth(7)
    this.girl.setScale(1.2)
    this.girlShadow.setPosition(this.girl.x, this.girl.y + 34)
    this.girlShadow.setVisible(Math.abs(this.bear.body!.velocity.y) < 40)

    this.placeShadow(this.salmon)
    this.placeShadow(this.bear)

    const midX = (this.salmon.x + this.bear.x) / 2
    this.cameras.main.centerOn(
      Phaser.Math.Clamp(midX, 480, WORLD_W - 480),
      WORLD_H / 2,
    )

    this.updateEnemies(dt)
    this.animateDecor(dt)

    this.salmon.attackCd = Math.max(0, this.salmon.attackCd - dt)
    this.bear.attackCd = Math.max(0, this.bear.attackCd - dt)
    this.salmon.hurtCd = Math.max(0, this.salmon.hurtCd - dt)
    this.bear.hurtCd = Math.max(0, this.bear.hurtCd - dt)

    if (!this.physics.overlap(this.salmon, this.goal)) this.salmonAtGoal = false
    if (!this.physics.overlap(this.bear, this.goal)) this.bearAtGoal = false

    if (!this.bossSpawned && Math.max(this.salmon.x, this.bear.x) > WORLD_W - 980) {
      this.bossSpawned = true
      this.spawnBoss(WORLD_W - 560, GROUND_Y - 55)
      SFX.boss()
      this.hint.setText('關底・醃鮭魚武者！看紅光再閃——別硬鋼')
      this.cameras.main.flash(180, 180, 40, 40)
      this.time.delayedCall(4500, () => {
        if (!this.ended) this.hint.setText('')
      })
    }

    const pct = Math.min(
      100,
      Math.floor((Math.max(this.salmon.x, this.bear.x) / (WORLD_W - 200)) * 100),
    )
    const sec = ((this.time.now - this.startedAt) / 1000).toFixed(0)
    this.progressText.setText(`進度 ${pct}%　｜　${sec}s　｜　HARD`)

    this.refreshHud()
  }

  private animateDecor(_dt: number) {
    // smooth scroll — constant speeds, no alpha flicker
    this.waterDeep.tilePositionX += 0.22
    this.waterMid.tilePositionX += 0.55
    this.waterFoam.tilePositionX += 0.9
    this.cloudLayer.tilePositionX += 0.06
    // slight parallax vs camera
    const camX = this.cameras.main.scrollX
    this.mountFar.tilePositionX = camX * 0.15
    this.mountNear.tilePositionX = camX * 0.35
  }

  private placeShadow(f: Fighter) {
    const body = f.body as Phaser.Physics.Arcade.Body
    const airborne = !body.blocked.down
    f.shadow.setPosition(f.x, f.y + (f.role === 'bear' ? 38 : 36))
    f.shadow.setVisible(true)
    // stable size; only shrink a little when airborne (no flicker)
    const sc = airborne ? 0.55 : f.role === 'bear' ? 1.05 : 0.9
    f.shadow.setScale(sc, airborne ? 0.45 : 0.65)
    f.shadow.setAlpha(airborne ? 0.28 : 0.5)
  }

  private buildHud() {
    this.add.image(480, 30, 'ui-scroll').setScrollFactor(0).setDepth(30).setScale(1.12)
    this.add
      .text(480, 28, '第一關・溪流小路', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '19px',
        color: '#2a1a10',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31)

    this.hudLeft = this.add.container(16, 60).setScrollFactor(0).setDepth(30)
    this.hudRight = this.add.container(790, 60).setScrollFactor(0).setDepth(30)

    this.hudLeft.add(
      this.add
        .text(0, 0, 'P1 鮭男', {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '16px',
          color: '#ffe28a',
          stroke: '#1a1020',
          strokeThickness: 5,
        })
        .setOrigin(0, 0),
    )
    this.hudRight.add(
      this.add
        .text(0, 0, 'P2 熊女', {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '16px',
          color: '#ffe28a',
          stroke: '#1a1020',
          strokeThickness: 5,
        })
        .setOrigin(0, 0),
    )

    for (let i = 0; i < MAX_HP; i++) {
      const h = this.add.image(10 + i * 20, 30, 'heart-full').setOrigin(0.5).setScale(1.15)
      this.heartImgsL.push(h)
      this.hudLeft.add(h)
    }
    for (let i = 0; i < MAX_HP; i++) {
      const h = this.add.image(10 + i * 20, 30, 'heart-full').setOrigin(0.5).setScale(1.15)
      this.heartImgsR.push(h)
      this.hudRight.add(h)
    }

    this.progressText = this.add
      .text(480, 56, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#2a1a10',
        backgroundColor: '#f7e7c0cc',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)

    this.hint = this.add
      .text(480, 504, '', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020bb',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
  }

  private refreshHud() {
    for (let i = 0; i < MAX_HP; i++) {
      this.heartImgsL[i]?.setTexture(i < this.salmon.hp ? 'heart-full' : 'heart-empty')
      this.heartImgsR[i]?.setTexture(i < this.bear.hp ? 'heart-full' : 'heart-empty')
    }
  }

  private drawBackdrop() {
    // --- layer -40: sky ---
    const sky = this.add.graphics().setDepth(-40)
    sky.fillGradientStyle(0x6eb8e0, 0x6eb8e0, 0xb8daf0, 0xb8daf0, 1)
    sky.fillRect(0, 0, WORLD_W, 280)
    sky.fillStyle(0xffe6b8, 0.4)
    sky.fillRect(0, 220, WORLD_W, 160)
    sky.fillStyle(0xd8f0a8, 0.25)
    sky.fillRect(0, 320, WORLD_W, 100)

    // sun (stable, no flicker)
    sky.fillStyle(0xfff3c8, 0.5)
    sky.fillCircle(160, 78, 70)
    sky.fillStyle(0xffe89a, 0.85)
    sky.fillCircle(160, 78, 36)
    sky.fillStyle(0xfffaf0, 1)
    sky.fillCircle(160, 78, 18)

    // --- layer -35: far mountains (scroll parallax) ---
    this.mountFar = this.add
      .tileSprite(WORLD_W / 2, 300, WORLD_W, 80, 'bg-mount-far')
      .setDepth(-35)
      .setAlpha(0.85)

    // --- layer -32: clouds ---
    this.cloudLayer = this.add
      .tileSprite(WORLD_W / 2, 70, WORLD_W, 56, 'bg-cloud')
      .setDepth(-32)
      .setAlpha(0.75)

    // --- layer -28: near hills ---
    this.mountNear = this.add
      .tileSprite(WORLD_W / 2, 360, WORLD_W, 70, 'bg-mount-near')
      .setDepth(-28)

    // --- layer -22: mid props (shrines, houses) ---
    const mid = this.add.graphics().setDepth(-22)
    for (let x = 320; x < WORLD_W; x += 780) {
      mid.fillStyle(0xb85040, 1)
      mid.fillRect(x, 268, 9, 72)
      mid.fillRect(x + 50, 268, 9, 72)
      mid.fillRect(x - 8, 262, 76, 11)
      mid.fillRect(x - 12, 256, 84, 8)
      mid.fillStyle(0xd8a878, 1)
      mid.fillRect(x + 90, 290, 34, 52)
      mid.fillStyle(0xc07040, 1)
      mid.fillTriangle(x + 90, 290, x + 107, 262, x + 124, 290)
      // window
      mid.fillStyle(0xffe8a0, 0.7)
      mid.fillRect(x + 100, 308, 10, 10)
      // tree cluster
      mid.fillStyle(0x5a3a20, 1)
      mid.fillRect(x + 160, 310, 7, 30)
      mid.fillStyle(0x3d8a48, 1)
      mid.fillCircle(x + 163, 300, 16)
      mid.fillStyle(0x62b860, 1)
      mid.fillCircle(x + 170, 294, 11)
    }

    // soft mist — fixed alpha (was flickering like a shadow)
    this.add
      .rectangle(WORLD_W / 2, 420, WORLD_W, 36, 0xffffff, 0.06)
      .setDepth(-12)

    // --- water stack ---
    this.waterDeep = this.add
      .tileSprite(WORLD_W / 2, 508, WORLD_W, 48, 'water-deep')
      .setDepth(0)
    this.waterMid = this.add
      .tileSprite(WORLD_W / 2, 498, WORLD_W, 28, 'water-mid')
      .setDepth(1)
      .setAlpha(0.9)
    this.waterFoam = this.add
      .tileSprite(WORLD_W / 2, 484, WORLD_W, 12, 'water-foam')
      .setDepth(2)
      .setAlpha(0.85)
  }

  private buildLevel() {
    this.ground = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()

    // tighter banks — harder gaps
    const segments = [
      { x: 0, w: 480 },
      { x: 600, w: 340 },
      { x: 1060, w: 300 },
      { x: 1500, w: 400 },
      { x: 2060, w: 280 },
      { x: 2500, w: 360 },
      { x: 3020, w: 340 },
      { x: 3520, w: 300 },
      { x: 4000, w: 600 },
    ]
    for (const seg of segments) this.grassBank(seg.x, GROUND_Y, seg.w)

    // shorter / higher bridges
    this.woodBridge(480, GROUND_Y - 10, 4)
    this.woodBridge(940, GROUND_Y - 10, 4)
    this.woodBridge(1360, GROUND_Y - 48, 5)
    this.woodBridge(1900, GROUND_Y - 10, 5)
    this.woodBridge(2340, GROUND_Y - 10, 5)
    this.woodBridge(2860, GROUND_Y - 28, 5)
    this.woodBridge(3360, GROUND_Y - 10, 5)
    this.woodBridge(3820, GROUND_Y - 10, 6)

    // precision platforms
    this.woodBridge(700, 330, 2)
    this.woodBridge(1180, 290, 2)
    this.woodBridge(1680, 260, 3)
    this.woodBridge(2200, 300, 2)
    this.woodBridge(2700, 280, 3)
    this.woodBridge(3200, 300, 2)
    this.woodBridge(3700, 290, 3)

    // more spike pits
    this.spikePit(500, 7)
    this.spikePit(960, 7)
    this.spikePit(1380, 6)
    this.spikePit(1920, 8)
    this.spikePit(2360, 8)
    this.spikePit(2880, 7)
    this.spikePit(3380, 7)
    this.spikePit(3840, 7)

    this.add.image(260, GROUND_Y - 54, 'sign-salmon').setDepth(4).setScale(1.5)

    // mid-layer bushes / rocks on banks
    for (let x = 60; x < WORLD_W; x += 140) {
      if ((x / 140) % 3 !== 1) {
        this.add
          .image(x, GROUND_Y - 22, 'prop-bush')
          .setDepth(3.5)
          .setScale(1.1 + ((x / 140) % 2) * 0.15)
          .setFlipX(x % 280 > 140)
      }
      if ((x / 140) % 4 === 0) {
        this.add
          .image(x + 40, GROUND_Y + 8, 'fg-rock')
          .setDepth(2.5)
          .setScale(1.2)
          .setAlpha(0.95)
      }
    }

    // foreground reeds (in front of characters a bit — depth 10)
    for (let x = 100; x < WORLD_W; x += 220) {
      this.add
        .image(x, GROUND_Y + 22, 'fg-reed')
        .setDepth(10)
        .setScale(1.3)
        .setAlpha(0.92)
      this.add
        .image(x + 18, GROUND_Y + 26, 'fg-reed')
        .setDepth(10)
        .setScale(1.1)
        .setFlipX(true)
        .setAlpha(0.85)
    }

    // bank edge foam hint where grass meets water
    for (let x = 0; x < WORLD_W; x += 64) {
      this.add
        .image(x + 32, GROUND_Y + 22, 'water-foam')
        .setDepth(2.2)
        .setAlpha(0.35)
        .setScale(1, 0.6)
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
      const tile = this.ground.create(
        startX + i * 32 + 16,
        y,
        'til-wood',
      ) as Phaser.Physics.Arcade.Sprite
      tile.refreshBody()
      tile.setDepth(3)
    }
  }

  private spikePit(startX: number, count: number) {
    for (let i = 0; i < count; i++) {
      const s = this.hazards.create(
        startX + i * 24 + 12,
        GROUND_Y + 30,
        'til-spike',
      ) as Phaser.Physics.Arcade.Sprite
      s.refreshBody()
      s.setDepth(2)
    }
  }

  private placeEnemies() {
    const spots = [
      640, 780, 980, 1140, 1280, 1560, 1720, 1880, 2140, 2300, 2480, 2660, 2840,
      3100, 3280, 3480, 3660, 3900,
    ]
    for (const x of spots) this.spawnEnemy(x, GROUND_Y - 40, false, false)
    // elites
    this.spawnEnemy(1600, GROUND_Y - 40, false, true)
    this.spawnEnemy(2600, GROUND_Y - 40, false, true)
    this.spawnEnemy(3600, GROUND_Y - 40, false, true)
    // high platforms
    this.spawnEnemy(720, 290, false, false)
    this.spawnEnemy(1720, 220, false, true)
    this.spawnEnemy(2740, 240, false, false)
    this.spawnEnemy(3740, 250, false, true)
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
      let speed = e.isBoss ? 95 : e.isElite ? 78 : 62
      if (dist < 520) {
        e.setVelocityX(dir * speed)
        e.setFlipX(dir > 0)
      } else e.setVelocityX(0)

      const range = e.isBoss ? 78 : 56
      if (dist < range && e.windup <= 0 && e.attackCd <= 0) {
        e.setTint(0xff4444)
        e.windup = e.isBoss ? 380 : 320
        e.attackCd = e.isBoss ? 1100 : e.isElite ? 1050 : 1150
        e.swingHit = false
        this.time.delayedCall(220, () => {
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

    const grounded = body.blocked.down
    if (!f.wasGrounded && grounded) {
      SFX.land()
      burst(this, f.x, f.y + 22, 0xcbb896, 3)
    }
    f.wasGrounded = grounded

    // calm motion: fixed scale (no flickering shadow), tiny Y bob only
    const animLocked = this.time.now < f.animLockUntil
    if (!animLocked) {
      f.setScale(f.baseScale)
      if (grounded && Math.abs(vx) > 10) {
        f.walkPhase += Math.abs(vx) * 0.0005
        f.stepAcc += Math.abs(vx) * 0.02
        if (f.stepAcc > 28) {
          f.stepAcc = 0
          SFX.step()
        }
        // offset via angle only 1° — almost invisible, avoids shadow wobble
        f.setAngle(Math.sin(f.walkPhase) * 1.2 * f.facing)
      } else if (!grounded) {
        f.setAngle(f.facing * -4)
        f.stepAcc = 0
      } else {
        f.setAngle(0)
        f.stepAcc = 0
      }
    }

    if (Phaser.Input.Keyboard.JustDown(jump) && grounded) {
      f.setVelocityY(f.role === 'bear' ? -575 : -615)
      burst(this, f.x, f.y + 20, 0xd4b896, 4)
      SFX.jump()
    }

    if (
      f.attackCd <= 0 &&
      (Phaser.Input.Keyboard.JustDown(atkA) || Phaser.Input.Keyboard.JustDown(atkB))
    ) {
      this.doAttack(f)
    }
  }

  private doAttack(f: Fighter) {
    f.attackCd = f.role === 'salmon' ? 340 : 460
    const reach = f.role === 'salmon' ? 74 : 58
    const dmg = f.role === 'salmon' ? 1 : 2
    const key = f.role === 'salmon' ? 'fx-salmon' : 'fx-hit'
    SFX.swing()
    const fx = this.add.image(f.x + f.facing * reach, f.y - 4, key).setDepth(9)
    this.tweens.add({
      targets: fx,
      alpha: 0,
      x: fx.x + f.facing * 30,
      duration: 200,
      onComplete: () => fx.destroy(),
    })

    f.animLockUntil = this.time.now + 120
    this.tweens.add({
      targets: f,
      scaleY: f.baseScale * 0.92,
      scaleX: f.baseScale * 1.08,
      angle: f.facing * 5,
      yoyo: true,
      duration: 90,
      onComplete: () => {
        if (f.active) f.setScale(f.baseScale)
      },
    })

    let hitAny = false
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Creep
      if (!e.active) return
      const dx = e.x - f.x
      const dy = Math.abs(e.y - f.y)
      if (Math.sign(dx) === f.facing && Math.abs(dx) < reach + 30 && dy < 50) {
        hitAny = true
        e.hp -= dmg
        e.setVelocityX(f.facing * 260)
        e.setVelocityY(-220)
        e.setTint(0xffffff)
        this.time.delayedCall(70, () => {
          if (e.active) e.clearTint()
        })
        burst(this, e.x, e.y, f.role === 'salmon' ? 0xff9a60 : 0xfff2c0, 10)
        floatText(this, e.x, e.y - 36, '！')
        SFX.hit()
        if (e.hp <= 0) {
          burst(this, e.x, e.y, 0xff6688, 14)
          SFX.kill()
          e.disableBody(true, true)
          if (e.isBoss) {
            this.hint.setText('武者倒下！兩人一起站上祭壇')
            this.cameras.main.flash(220, 255, 220, 120)
          }
        }
      }
    })
    if (hitAny) {
      hitstop(this, 50)
      this.cameras.main.shake(70, 0.005)
    }
  }

  private hurtPlayer(f: Fighter, e: Creep) {
    if (this.ended) return
    if (this.time.now < f.graceUntil) return
    if (f.hurtCd > 0) return
    if (e.windup <= 0 || e.windup > 240) return
    if (e.swingHit) return
    e.swingHit = true

    const dmg = e.isBoss ? 2 : e.isElite ? 2 : 1
    f.hp -= dmg
    f.hurtCd = 850
    f.setVelocityX(Math.sign(f.x - e.x) * 300 || -300)
    f.setVelocityY(-280)
    f.setTint(0xff3333)
    this.time.delayedCall(150, () => f.clearTint())
    burst(this, f.x, f.y, 0xff4466, 8)
    floatText(this, f.x, f.y - 30, `-${dmg}`, '#ff6677')
    SFX.hurt()
    this.cameras.main.shake(100, 0.01)
    this.refreshHud()
    if (f.hp <= 0) this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private spikeHurt(f: Fighter) {
    if (this.ended || f.hurtCd > 0 || this.time.now < f.graceUntil) return
    f.hp -= 2
    f.hurtCd = 1000
    f.setVelocityY(-460)
    f.setVelocityX(f.facing * -180)
    f.setTint(0xff3333)
    this.time.delayedCall(150, () => f.clearTint())
    burst(this, f.x, f.y + 10, 0xddeeff, 10)
    floatText(this, f.x, f.y - 28, '-2', '#aaccff')
    SFX.spike()
    this.cameras.main.shake(120, 0.012)
    this.refreshHud()
    if (f.hp <= 0) this.lose(f.role === 'salmon' ? '鮭男倒下了…' : '熊女倒下了…')
  }

  private checkWin() {
    if (this.ended) return
    if (this.bossSpawned) {
      const bossAlive = this.enemies.getChildren().some((o) => {
        const e = o as Creep
        return e.active && e.isBoss
      })
      if (bossAlive) return
    }
    if (this.salmonAtGoal && this.bearAtGoal) {
      const sec = ((this.time.now - this.startedAt) / 1000).toFixed(1)
      burst(this, this.goal.x, this.goal.y - 40, 0xffe08a, 20)
      this.win(`溪流小路 クリア！\nHARD　用時 ${sec} 秒\n按 R 再挑戰`)
    }
  }

  private win(msg: string) {
    this.ended = true
    this.salmon.setVelocity(0, 0)
    this.bear.setVelocity(0, 0)
    SFX.win()
    this.cameras.main.flash(300, 255, 240, 180)
    this.banner.setText(msg).setVisible(true)
  }

  private lose(msg: string) {
    this.ended = true
    SFX.lose()
    this.cameras.main.shake(200, 0.02)
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
    s.hp = MAX_HP
    s.maxHp = MAX_HP
    s.facing = 1
    s.attackCd = 0
    s.hurtCd = 0
    s.graceUntil = graceUntil
    s.baseScale = role === 'bear' ? 1.42 : 1.38
    s.walkPhase = 0
    s.wasGrounded = true
    s.stepAcc = 0
    s.animLockUntil = 0
    s.shadow = this.add
      .image(x, y + 36, 'shadow-blob')
      .setDepth(5)
      .setAlpha(0.5)
      .setScale(role === 'bear' ? 1.05 : 0.9, 0.65)
    s.setCollideWorldBounds(true)
    s.setBounce(0)
    s.setDragX(1500)
    s.setDepth(8)
    s.setScale(s.baseScale)
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

  private spawnEnemy(x: number, y: number, isBoss: boolean, isElite: boolean) {
    const e = this.enemies.create(x, y, 'art-enemy') as Creep
    e.isBoss = isBoss
    e.isElite = isElite
    e.hp = isBoss ? 20 : isElite ? 6 : 4
    e.windup = 0
    e.attackCd = Phaser.Math.Between(500, 1200)
    e.swingHit = false
    e.setCollideWorldBounds(true)
    e.setBounce(0)
    e.setDepth(6)
    e.setScale(isBoss ? 2.6 : isElite ? 1.85 : 1.55)
    if (isElite && !isBoss) e.setTint(0xff8866)
    if (isBoss) e.setTint(0xffaa77)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.setSize(isBoss ? 30 : 22, isBoss ? 30 : 22)
    body.setOffset(12, 12)
    return e
  }

  private spawnBoss(x: number, y: number) {
    const b = this.spawnEnemy(x, y, true, false)
    const label = this.add
      .text(x, y - 80, '醃鮭魚武者', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '17px',
        color: '#ffe8c8',
        backgroundColor: '#701828',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(12)
    this.tweens.add({
      targets: label,
      y: y - 90,
      yoyo: true,
      repeat: -1,
      duration: 600,
    })
    return b
  }
}
