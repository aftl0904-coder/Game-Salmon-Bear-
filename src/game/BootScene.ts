import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { createHeroAnims, markHd, preloadHeroAnims, REPLACED_STILLS } from './heroAnims'
import { createFxAnims, preloadFxAnims } from './fxAnims'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'
import { preloadRound1Map } from './levelMap'
import {
  bakePixelTexture,
  bakeFixedSizeTexture,
  hardenTextureAlpha,
  sealTextureSeamsX,
  thickenSpriteOutline,
  nearestFitTextureHeight,
  registerWalkCycle,
  registerIdleBreath,
  registerEnemyCombatFrames,
  setActorNearestFilter,
  WALK_FRAMES,
} from './pixelSnap'
import { OBJECT_CATALOG, allCatalogTextureKeys } from './data/objectCatalog'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { applyEnemyPlaceholderTextures, ENEMY_SHEET_MAP } from './enemyPlaceholders'
import { applyArtOverrides, preloadArtOverrides } from './artOverrides'
import { loadCustomSkins, preloadCustomConfig } from './customSkins'
import {
  BAKE_RES_FACTOR,
  OUTLINE_WIDTH,
  OUTLINE_INK,
  TARGET_H_ENEMY_L,
  TARGET_H_ENEMY_M,
  TARGET_H_ITEM,
} from './engine/constants'
import { buildStampLabel } from './version'
import {
  LOADING_BOOT_IMAGES,
  allLoadingHeadSpecs,
  bakeQHead,
} from './loadingHeads'

const HD_PROP_RES = 2

const RAY_COLORS = [0xffd76a, 0xff9ec4, 0x8fd3ff, 0xb9f27c] as const
const FINISH_ANIM_MAX_MS = 800
const HEAD_JUMP_MS = 300
const HEAD_FADE_MS = 400
/** Boot-pack weight in the honey bar (rest of assets fill the remainder). */
const BOOT_WEIGHT = 0.12

type HeadBob = {
  img: Phaser.GameObjects.Image
  baseY: number
  amp: number
  phase: number
  speed: number
}

/** Boot — fancy loading (sunburst + Q-heads + honey jar), then bake + studio. */
export class BootScene extends Phaser.Scene {
  private sunburst!: Phaser.GameObjects.Container
  private honeyFill!: Phaser.GameObjects.Rectangle
  private honeyMaskGfx!: Phaser.GameObjects.Graphics
  private jarH = 56
  private jarW = 40
  private progressText!: Phaser.GameObjects.Text
  private heads: HeadBob[] = []
  private headsRoot: Phaser.GameObjects.Container | null = null
  private loadProgress = 0
  private phase: 'boot' | 'rest' | 'finish' | 'done' = 'boot'
  private finishing = false
  private stampLabel = ''

  constructor() {
    super('boot')
  }

  preload() {
    this.cameras.main.setBackgroundColor('#1a1020')
    this.buildLoadingChrome()
    this.queueBootPack()
    this.load.on('progress', (p: number) => {
      if (this.phase !== 'boot') return
      this.setProgress(BOOT_WEIGHT * p)
    })
  }

  create() {
    this.phase = 'rest'
    this.buildHeadPile()
    this.publishLoadingHook()
    this.queueRestAssets()
    this.load.on('progress', (p: number) => {
      if (this.phase !== 'rest') return
      this.setProgress(BOOT_WEIGHT + (1 - BOOT_WEIGHT) * p)
    })
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.onAssetsReady())
    this.load.start()
  }

  update(t: number, _dt: number) {
    // Absolute clock → steady 6°/sec even when frame dt jitters under load.
    if (this.sunburst) this.sunburst.angle = (t / 1000) * 6
    const now = t / 1000
    for (const h of this.heads) {
      h.img.y = h.baseY + Math.sin(now * h.speed + h.phase) * h.amp
    }
    this.publishLoadingHook()
  }

  // ── Loading UI ──────────────────────────────────────────────────────────

  private buildLoadingChrome() {
    const width = GAME_W
    const height = GAME_H
    const cx = width / 2
    const cy = Math.round(height * 0.38)

    this.sunburst = this.add.container(cx, cy)
    const rays = this.add.graphics()
    const R = Math.hypot(width, height)
    const wedge = (Math.PI * 2) / 12
    for (let i = 0; i < 12; i++) {
      const a0 = i * wedge - Math.PI / 2
      const a1 = a0 + wedge
      rays.fillStyle(RAY_COLORS[i % RAY_COLORS.length], 1)
      rays.beginPath()
      rays.moveTo(0, 0)
      rays.lineTo(Math.cos(a0) * R, Math.sin(a0) * R)
      rays.lineTo(Math.cos(a1) * R, Math.sin(a1) * R)
      rays.closePath()
      rays.fillPath()
    }
    this.sunburst.add(rays)
    // Soft centre wash so heads read clearly.
    const wash = this.add.graphics()
    wash.fillStyle(0xfff6d8, 0.35)
    wash.fillCircle(0, 0, 90)
    this.sunburst.add(wash)
    this.sunburst.setDepth(0)

    this.add
      .text(cx, 28, '鮭鮭熊', {
        fontFamily: FONT_TITLE,
        fontSize: '28px',
        color: '#ffe08a',
        stroke: '#3a2010',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.add
      .text(cx, 52, '百畝樹林野餐　｜　奪回蜂蜜與朋友', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#fff6e0',
        stroke: '#2a1810',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.buildHoneyJar(cx, height - 52)
    this.progressText = this.add
      .text(cx, height - 18, '載入中… 0%', {
        fontFamily: FONT_UI,
        fontSize: '18px',
        color: '#fff8e8',
        stroke: '#2a1810',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30)

    this.stampLabel = buildStampLabel()
    this.add
      .text(width - 6, height - 6, this.stampLabel, {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#1a1008',
        strokeThickness: 3,
      })
      .setOrigin(1, 1)
      .setDepth(40)
  }

  private buildHoneyJar(cx: number, cy: number) {
    this.jarW = 56
    this.jarH = 70
    const jarX = cx
    const jarY = cy
    const pad = 5
    const innerW = this.jarW - pad * 2
    const innerH = this.jarH - pad * 2 - 4
    const fillBottom = jarY + this.jarH / 2 - pad

    // Glass jar back (empty).
    const body = this.add.graphics().setDepth(25)
    body.fillStyle(0xfff6d0, 0.22)
    body.fillRoundedRect(jarX - this.jarW / 2, jarY - this.jarH / 2, this.jarW, this.jarH, 10)
    body.lineStyle(3, 0xe0b86a, 1)
    body.strokeRoundedRect(jarX - this.jarW / 2, jarY - this.jarH / 2, this.jarW, this.jarH, 10)
    // Lid
    body.fillStyle(0xc48a28, 1)
    body.fillRoundedRect(jarX - this.jarW / 2 - 5, jarY - this.jarH / 2 - 10, this.jarW + 10, 14, 4)
    body.lineStyle(2, 0x5a3810, 1)
    body.strokeRoundedRect(jarX - this.jarW / 2 - 5, jarY - this.jarH / 2 - 10, this.jarW + 10, 14, 4)

    // Honey fill grows upward from the jar floor.
    this.honeyFill = this.add
      .rectangle(jarX, fillBottom, innerW, 2, 0xf0a820)
      .setOrigin(0.5, 1)
      .setDepth(26)
    // Highlight stripe on honey surface (redrawn via height only; stripe is a child feel via second rect).
    const honeyTop = this.add
      .rectangle(jarX, fillBottom - 1, innerW, 3, 0xffe08a)
      .setOrigin(0.5, 1)
      .setDepth(27)
    ;(this as unknown as { honeyTop: Phaser.GameObjects.Rectangle }).honeyTop = honeyTop

    this.honeyMaskGfx = this.add.graphics().setVisible(false)
    this.honeyMaskGfx.fillStyle(0xffffff, 1)
    this.honeyMaskGfx.fillRoundedRect(
      jarX - this.jarW / 2 + pad,
      jarY - this.jarH / 2 + pad + 4,
      innerW,
      innerH,
      8,
    )
    const mask = this.honeyMaskGfx.createGeometryMask()
    this.honeyFill.setMask(mask)
    honeyTop.setMask(mask)

    this.events.once('heads-ready', () => {
      if (!this.textures.exists('load-jar')) return
      this.add
        .image(jarX + this.jarW / 2 + 20, jarY, 'load-jar')
        .setDisplaySize(24, 28)
        .setDepth(28)
    })
  }

  private setProgress(p: number) {
    this.loadProgress = Phaser.Math.Clamp(p, 0, 1)
    const pct = Math.round(this.loadProgress * 100)
    this.progressText?.setText(`載入中… ${pct}%`)
    if (this.honeyFill) {
      const pad = 5
      const innerH = this.jarH - pad * 2 - 4
      const h = Math.max(2, innerH * this.loadProgress)
      this.honeyFill.height = h
      const honeyTop = (this as unknown as { honeyTop?: Phaser.GameObjects.Rectangle }).honeyTop
      if (honeyTop) honeyTop.y = this.honeyFill.y - h + 3
    }
    this.publishLoadingHook()
  }

  private buildHeadPile() {
    const specs = allLoadingHeadSpecs()
    for (const s of specs) bakeQHead(this, s.src, s.out, s.size)

    const width = GAME_W
    const height = GAME_H
    const cx = width / 2
    const cy = Math.round(height * 0.42)
    this.headsRoot = this.add.container(0, 0).setDepth(10)
    this.heads = []

    // Friends ring behind (pile).
    const friends = specs.filter((s) => !['lunbo', 'kibobo', 'pupu'].includes(s.id))
    const n = friends.length
    friends.forEach((s, i) => {
      if (!this.textures.exists(s.out)) return
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2
      const rx = 110 + (i % 3) * 8
      const ry = 48 + (i % 2) * 10
      const x = cx + Math.cos(ang) * rx * 0.55
      const y = cy + Math.sin(ang) * ry * 0.9 + 10
      const img = this.add.image(x, y, s.out).setOrigin(0.5, 1).setDepth(10 + i)
      img.setDisplaySize(s.size, s.size)
      this.headsRoot!.add(img)
      this.heads.push({
        img,
        baseY: y,
        amp: 2 + (i % 3),
        phase: i * 0.7,
        speed: 2.2 + (i % 4) * 0.35,
      })
    })

    // Cast front & largest.
    const castPos = [
      { id: 'lunbo', x: cx - 52, y: cy + 36 },
      { id: 'pupu', x: cx, y: cy + 44 },
      { id: 'kibobo', x: cx + 52, y: cy + 36 },
    ]
    castPos.forEach((p, i) => {
      const s = specs.find((x) => x.id === p.id)
      if (!s || !this.textures.exists(s.out)) return
      const img = this.add.image(p.x, p.y, s.out).setOrigin(0.5, 1).setDepth(40 + i)
      img.setDisplaySize(88, 88)
      this.headsRoot!.add(img)
      this.heads.push({
        img,
        baseY: p.y,
        amp: 3 + i,
        phase: i * 1.1,
        speed: 2.6 + i * 0.2,
      })
    })

    this.events.emit('heads-ready')
  }

  // ── Asset packs ─────────────────────────────────────────────────────────

  private queueBootPack() {
    for (const { key, url } of LOADING_BOOT_IMAGES) {
      this.load.image(key, url)
    }
  }

  private queueRestAssets() {
    // Cel coin (salmon emblem) — overrides procedural paint after registers.
    this.load.image('coin-cel', '/art/coin.png')
    // Pixel wallpaper (640×360 ≤64c)
    this.load.image('bg-wallpaper', '/art/bg-wallpaper-px.png')
    this.load.image('bg-sky-wallpaper', '/art/bg-sky-wallpaper.jpg')
    // Stage 7: far plates from C2 32-bit q128 (G+S); see art/stage7/manifest.json / art-src/c2-32bit-test/.
    for (const name of [
      'entrance-far',
      'corridor-mid',
      'training-mid',
      'backstage-far',
      'arena-far',
      'net-static',
      'number-plate-blank',
      'sign-blank',
    ]) {
      this.load.image(`s7-${name}`, `/art/stage7/${name}.png`)
    }
    for (const meta of Object.values(ENEMY_SHEET_MAP)) {
      this.load.image(`enemy-sheet-${meta.id}`, `/art/enemies/${meta.id}.png`)
    }
    for (let v = 0; v < 4; v++) {
      this.load.image(`tile-ground-${v}`, `/art/tiles/ground-${v}.png`)
    }
    this.load.image('tile-ground-top', '/art/tiles/ground-top.png')
    this.load.image('bg-bush-strip', '/art/tiles/bush-strip.png')
    for (const f of ['shadow-soft', 'glow-round', 'vignette'] as const) {
      this.load.image(`fx-${f}`, `/art/fx/${f}.png`)
    }
    this.load.image('gacha-machine', '/art/props/gacha-machine.png')
    this.load.spritesheet('gacha-capsules', '/art/props/gacha-capsules.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    for (const id of ['omamori', 'speed', 'power', 'stamina', 'luck'] as const) {
      this.load.image(`charm-${id}`, `/art/items/charm-${id}.png`)
    }
    // Friend full sprites already in boot pack; cage + remaining only.
    this.load.image('friend-cage', '/art/friends/cage.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')
    preloadArtOverrides(this)
    preloadHeroAnims(this)
    preloadFxAnims(this)
    preloadRound1Map(this)
    preloadCustomConfig(this)
  }

  private onAssetsReady() {
    if (this.finishing) return
    this.finishing = true
    this.phase = 'finish'
    this.setProgress(1)

    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    registerIsoArt(this)
    registerUiArt(this)
    const swapped = applyEnemyPlaceholderTextures(this)
    this.registry.set('enemyPlaceholders', swapped)
    this.registry.set('artOverrides', applyArtOverrides(this))
    createHeroAnims(this)
    for (const key of this.textures.getTextureKeys()) {
      if (
        key.startsWith('friend-') ||
        key === 'gacha-machine' ||
        key.startsWith('tile-ground-') ||
        key === 'bg-bush-strip'
      ) {
        markHd(this.textures.get(key), HD_PROP_RES)
      }
    }
    createFxAnims(this)
    this.applyCelCoinTexture()
    this.bakeCastTextures()
    this.thickenPropOutlines()
    this.hardenSeamTiles()
    this.auditObjectCatalog()

    this.registry.set('gameConfig', {
      round: 1,
      stageId: 'creek-path',
      stageTitle: '第一關・百畝樹林',
      stageSub: '奪回蜂蜜・野餐之路',
      cast: ['倫寶', '琪寶寶', '噗噗'] as const,
      maxHp: 6,
      coinsStart: 5,
    })

    // Finish anim only — no artificial load padding. Cap at +0.8s.
    const jumpMs = HEAD_JUMP_MS
    const fadeMs = Math.min(HEAD_FADE_MS, FINISH_ANIM_MAX_MS - jumpMs)
    for (const h of this.heads) {
      this.tweens.add({
        targets: h.img,
        y: h.baseY - 18,
        duration: jumpMs * 0.45,
        yoyo: true,
        ease: 'Quad.out',
      })
    }
    this.time.delayedCall(jumpMs, () => {
      const fadeTargets = [
        this.sunburst,
        this.headsRoot,
        this.honeyFill,
        this.progressText,
      ].filter(Boolean) as Phaser.GameObjects.GameObject[]
      this.tweens.add({
        targets: fadeTargets,
        alpha: 0,
        duration: fadeMs,
        onComplete: () => {
          this.phase = 'done'
          this.publishLoadingHook()
          loadCustomSkins(this, () => this.scene.start('studio'))
        },
      })
    })
  }

  private publishLoadingHook() {
    ;(window as unknown as { __SAKE_LOADING__: unknown }).__SAKE_LOADING__ = {
      phase: this.phase,
      progress: this.loadProgress,
      pct: Math.round(this.loadProgress * 100),
      headCount: this.heads.length,
      castNames: ['倫寶', '琪寶寶', '噗噗'],
      friendNames: allLoadingHeadSpecs()
        .filter((s) => !['lunbo', 'kibobo', 'pupu'].includes(s.id))
        .map((s) => s.name),
      rayCount: 12,
      stamp: this.stampLabel || buildStampLabel(),
      sunburstAngle: this.sunburst?.angle ?? 0,
    }
  }

  /** Prefer cel PNG coin over procedural koban paint (heroes + coin share style). */
  private applyCelCoinTexture() {
    if (!this.textures.exists('coin-cel')) return
    const src = this.textures.get('coin-cel').getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const w = (src as { width: number }).width | 0
    const h = (src as { height: number }).height | 0
    if (w < 4 || h < 4) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(src as CanvasImageSource, 0, 0)
    if (this.textures.exists('coin')) this.textures.remove('coin')
    this.textures.addCanvas('coin', canvas)
  }

  /**
   * Shared resolution + outer border for cast / weapons / props.
   * NEAREST bake ×1 + 1px ink — no soft AA (bible stage 3).
   */
  private bakeCastTextures() {
    const fitH: Record<string, number> = {
      'art-enemy-barrel': TARGET_H_ENEMY_M,
      'art-enemy-elephant': TARGET_H_ENEMY_L,
      'prop-honey-stack': TARGET_H_ITEM + 4,
      'prop-honey-pot': TARGET_H_ITEM,
      'hazard-durian': TARGET_H_ITEM + 4,
    }
    for (const [key, h] of Object.entries(fitH)) {
      if (this.textures.exists(key)) nearestFitTextureHeight(this, key, h)
    }

    const actors = [
      'art-salmon',
      'art-girl',
      'art-bear',
      'art-enemy',
      'art-enemy-barrel',
      'art-enemy-elephant',
    ] as const
    const playObjects = [
      ...actors,
      'prop-sword',
      'prop-enemy-knife',
      'prop-enemy-spear',
      'prop-enemy-club',
      'prop-enemy-trunk',
      'fx-salmon-shot',
      'fx-fish-bullet',
      'fx-honey',
      'fx-elephant-trunk-0',
      'fx-elephant-trunk-1',
      'fan3d',
      'prop-fan',
      'prop-honey-stack',
      'prop-honey-pot',
      'hazard-durian',
      'pickup-sushi',
      'pickup-sushi-tamago',
      'pickup-sushi-ebi',
      'pickup-sushi-deluxe',
      'goal3d',
      'pot3d',
      'chest3d',
      'crate3d',
      'coin',
      'prop-tent',
      'prop-picnic-table',
      'prop-campfire',
      'prop-picnic',
      'prop-shrine',
      'blk-spike',
    ] as const

    for (const key of playObjects) {
      if (!this.textures.exists(key)) continue
      if (REPLACED_STILLS.has(key)) continue
      const hdRes = this.textures.get(key).source[0]?.resolution ?? 1
      bakePixelTexture(this, key, BAKE_RES_FACTOR)
      thickenSpriteOutline(this, key, OUTLINE_WIDTH * hdRes, OUTLINE_INK)
      markHd(this.textures.get(key), hdRes)
      setActorNearestFilter(this, key)
    }

    registerWalkCycle(this, 'art-salmon', WALK_FRAMES)
    registerWalkCycle(this, 'art-girl', WALK_FRAMES)
    registerIdleBreath(this, 'art-salmon')
    registerIdleBreath(this, 'art-girl')
    registerIdleBreath(this, 'art-bear')
    registerWalkCycle(this, 'art-bear', WALK_FRAMES)
    registerEnemyCombatFrames(this, 'art-enemy')
    registerEnemyCombatFrames(this, 'art-enemy-barrel')
    registerEnemyCombatFrames(this, 'art-enemy-elephant')

    for (const key of actors) setActorNearestFilter(this, key)

    bakeFixedSizeTexture(this, 'art-salmon', 'hud-face-boy', 16)
    bakeFixedSizeTexture(this, 'art-girl', 'hud-face-girl', 16)
    bakeFixedSizeTexture(this, 'coin', 'hud-coin', 12)
  }

  private thickenPropOutlines() {
    for (const key of [
      'prop-tree3d',
      'prop-house3d',
      'prop-torii',
      'prop-bridge',
      'prop-banner',
      'prop-lantern3d',
      'prop-owl',
      'lm-mount-1',
      'lm-mount-2',
      'lm-mount-3',
      'lm-mount-4',
      'lm-cloud-1',
      'lm-cloud-2',
      'lm-cloud-3',
      'lm-river',
    ]) {
      if (!this.textures.exists(key)) continue
      const hdRes = this.textures.get(key).source[0]?.resolution ?? 1
      thickenSpriteOutline(this, key, OUTLINE_WIDTH * hdRes, OUTLINE_INK)
      if (hdRes > 1) markHd(this.textures.get(key), hdRes)
      setActorNearestFilter(this, key)
    }
  }

  private hardenSeamTiles() {
    for (const key of [
      'water-deep',
      'water-mid',
      'water-foam',
      'blk-grass',
      'til-grass',
      'blk-wood',
      'til-wood',
      'blk-stone',
      'blk-spike',
      'til-spike',
      'bg-horizon',
      'bg-sky',
    ]) {
      hardenTextureAlpha(this, key, 80)
      sealTextureSeamsX(this, key)
    }
  }

  private auditObjectCatalog() {
    const missing: string[] = []
    for (const key of allCatalogTextureKeys()) {
      if (!this.textures.exists(key)) missing.push(key)
    }
    this.registry.set('objectCatalog', {
      count: OBJECT_CATALOG.length,
      missing,
      ids: OBJECT_CATALOG.map((e) => e.id),
    })
    if (missing.length) {
      console.warn('[objectCatalog] missing textures after bake:', missing)
    }
  }
}
