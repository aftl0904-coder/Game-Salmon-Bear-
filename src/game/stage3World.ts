import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'
import { SFX } from './audio'
import { floatText, burst } from './fx'

/**
 * 月影夜市 mechanics (no enemies here):
 *  - darkness: inside dark zones the screen goes black except around heroes and lit lanterns
 *  - lanterns: hit them (sword or roe) to light them for 8 s; the intro row blows out one by one
 *  - slippery ground: hot-spring floor keeps sliding when you turn or stop
 *  - steam vents: puffs that hide the view (no damage)
 *  - 3-second egg: grab 「最後一隻龍蝦」 with attack in time → power ×1.5 for 10 s
 */

type Lantern = { x: number; y: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc; litUntil: number; startLit: boolean }

export type Stage3Ctx = {
  scene: Phaser.Scene
  floorY: number
  heroes: () => Player[]
  /** Active roe shots (to light lanterns from range). */
  shots: () => Phaser.GameObjects.GameObject[]
  onPower: () => void
}

export type Stage3Data = {
  darkZones?: Array<{ x0: number; x1: number; startLit?: boolean }>
  lanterns?: Array<{ x: number }>
  slippery?: Array<{ x0: number; x1: number }>
  steamVents?: Array<{ x: number; periodMs: number }>
  easterEgg?: { x: number; kind: string; windowMs: number }
}

const LIT_MS = 8000
const W = 640
const H = 360

export class Stage3World {
  private ctx: Stage3Ctx
  private d: Stage3Data
  private lanterns: Lantern[] = []
  private canvas: HTMLCanvasElement
  private c2d: CanvasRenderingContext2D
  private tex: Phaser.Textures.CanvasTexture | null
  private overlay: Phaser.GameObjects.Image | null
  private dark = 0
  private vents: Array<{ x: number; period: number; t: number }> = []
  private egg: { x: number; state: 'idle' | 'open' | 'done'; until: number; ui: Phaser.GameObjects.GameObject[] } | null = null

  constructor(ctx: Stage3Ctx, d: Stage3Data) {
    this.ctx = ctx
    this.d = d
    const s = ctx.scene
    // Darkness layer: a canvas redrawn each frame with holes punched around the light sources.
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.c2d = this.canvas.getContext('2d')!
    const key = 's3-dark'
    if (s.textures.exists(key)) s.textures.remove(key)
    this.tex = s.textures.addCanvas(key, this.canvas)
    this.overlay = this.tex ? s.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.FX + 5).setAlpha(1) : null
    // Lanterns hang on a string from the stall awnings.
    for (const l of d.lanterns ?? []) {
      const y = ctx.floorY - 74
      const zone = (d.darkZones ?? []).find((z) => l.x >= z.x0 && l.x <= z.x1)
      const startLit = !!zone?.startLit || !zone
      const str = s.add.graphics().setDepth(DEPTH.PROP - 1)
      str.fillStyle(0x2a1a14, 1).fillRect(l.x, 30, 1, y - 44)
      const key2 = s.textures.exists('prop-break-lantern') ? 'prop-break-lantern' : 'prop-lantern3d'
      const img = s.add.image(l.x, y, key2).setOrigin(0.5, 0.5).setDepth(DEPTH.PROP)
      const glow = s.add.circle(l.x, y, 26, 0xff9a40, 0.22).setDepth(DEPTH.PROP - 1).setBlendMode(Phaser.BlendModes.ADD)
      s.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 1300 + (l.x % 7) * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.lanterns.push({ x: l.x, y, img, glow, litUntil: startLit ? Number.POSITIVE_INFINITY : 0, startLit })
    }
    for (const v of d.steamVents ?? []) this.vents.push({ x: v.x, period: v.periodMs, t: (v.x * 13) % v.periodMs })
    if (d.easterEgg) this.egg = { x: d.easterEgg.x, state: 'idle', until: 0, ui: [] }
  }

  private inZone(list: Array<{ x0: number; x1: number }> | undefined, x: number) {
    return (list ?? []).some((z) => x >= z.x0 && x <= z.x1)
  }

  /** Movement smoothing on the hot-spring floor (call after the hero's own update). */
  slip(h: Player, dt: number) {
    const body = h.body as Phaser.Physics.Arcade.Body | null
    if (!body) return
    const on = this.inZone(this.d.slippery, h.x)
    const prev = (h.getData('slipVx') as number | undefined) ?? body.velocity.x
    if (on) {
      const k = Math.min(1, (dt / 1000) * (h.laneJumping ? 1.6 : 2.6))
      const v = prev + (body.velocity.x - prev) * k
      body.velocity.x = v
      h.setData('slipVx', v)
    } else {
      h.setData('slipVx', body.velocity.x)
    }
  }

  private light(l: Lantern) {
    const now = this.ctx.scene.time.now
    if (l.litUntil > now) return
    l.litUntil = now + LIT_MS
    SFX.sparkle()
    burst(this.ctx.scene, l.x, l.y, 0xffc070, 8)
  }

  update(dt: number) {
    const s = this.ctx.scene
    const now = s.time.now
    const cam = s.cameras.main
    const heroes = this.ctx.heroes()
    const lead = heroes.reduce((m, h) => Math.max(m, h.x), 0)

    // ── Lanterns: intro row blows out as you arrive; hits relight ──
    let i = 0
    for (const l of this.lanterns) {
      if (l.startLit && l.litUntil === Number.POSITIVE_INFINITY && this.inZone(this.d.darkZones, l.x) && lead > l.x - 170) {
        l.litUntil = now + 250 + i * 450
        i++
      }
      for (const h of heroes) {
        if (h.isMeleeActive?.() && Math.abs(h.x + h.facing * 24 - l.x) < 30 && h.y - 90 < l.y) this.light(l)
      }
      for (const o of this.ctx.shots()) {
        const sp = o as Phaser.Physics.Arcade.Sprite
        if (sp.active && Math.abs(sp.x - l.x) < 12 && Math.abs(sp.y - l.y) < 26) {
          sp.destroy()
          this.light(l)
        }
      }
      const lit = l.litUntil > now
      const fading = lit && l.litUntil - now < 1200 && Math.floor(now / 120) % 2 === 0
      l.img.setTint(lit ? (fading ? 0xb08060 : 0xffffff) : 0x403848)
      l.glow.setVisible(lit && !fading)
    }

    // ── Darkness ──
    const inDark = this.inZone(this.d.darkZones, lead) && !this.inZone((this.d.darkZones ?? []).filter((z) => z.startLit), lead - 400)
    const target = inDark ? 0.9 : 0
    this.dark += (target - this.dark) * Math.min(1, (dt / 1000) * 2.5)
    if (this.overlay && this.tex) {
      this.overlay.setVisible(this.dark > 0.02)
      if (this.dark > 0.02) {
        const c = this.c2d
        c.globalCompositeOperation = 'source-over'
        c.clearRect(0, 0, W, H)
        c.fillStyle = `rgba(4,4,14,${this.dark.toFixed(3)})`
        c.fillRect(0, 0, W, H)
        c.globalCompositeOperation = 'destination-out'
        const hole = (x: number, y: number, r: number) => {
          const g = c.createRadialGradient(x, y, r * 0.25, x, y, r)
          g.addColorStop(0, 'rgba(0,0,0,1)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          c.fillStyle = g
          c.beginPath()
          c.arc(x, y, r, 0, Math.PI * 2)
          c.fill()
        }
        for (const h of heroes) hole(h.x - cam.scrollX, h.y - 24 - cam.scrollY, 92 + Math.sin(now / 180) * 3)
        for (const l of this.lanterns) if (l.litUntil > now) hole(l.x - cam.scrollX, l.y - cam.scrollY + 30, 150)
        this.tex.refresh()
      }
    }

    // ── Steam vents: puffs rising from the hot spring ──
    for (const v of this.vents) {
      v.t += dt
      if (v.t >= v.period) {
        v.t = 0
        for (let k = 0; k < 7; k++) {
          const p = s.add
            .circle(v.x + Phaser.Math.Between(-10, 10), this.ctx.floorY - 4, Phaser.Math.Between(8, 16), 0xf0f0ff, 0.55)
            .setDepth(DEPTH.FX - 1)
          s.tweens.add({
            targets: p,
            y: p.y - Phaser.Math.Between(70, 130),
            x: p.x + Phaser.Math.Between(-24, 24),
            scale: 2.2,
            alpha: 0,
            delay: k * 90,
            duration: 1400,
            onComplete: () => p.destroy(),
          })
        }
      }
    }

    // ── 3-second egg: 最後一隻龍蝦 ──
    const e = this.egg
    if (e && e.state === 'idle' && lead > e.x - 40 && lead < e.x + 80) {
      e.state = 'open'
      e.until = now + (this.d.easterEgg?.windowMs ?? 3000)
      SFX.siren()
      const box = s.add
        .text(e.x, this.ctx.floorY - 120, '最後一隻龍蝦！3 秒內撳「攻」', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffe08a',
          backgroundColor: '#3a1408dd',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.FX + 6)
      const bar = s.add.rectangle(e.x - 60, this.ctx.floorY - 104, 120, 4, 0xff6a3a).setOrigin(0, 0.5).setDepth(DEPTH.FX + 6)
      e.ui = [box, bar]
    }
    if (e && e.state === 'open') {
      const left = Math.max(0, e.until - now)
      const bar = e.ui[1] as Phaser.GameObjects.Rectangle
      bar.width = 120 * (left / (this.d.easterEgg?.windowMs ?? 3000))
      // A fresh attack = the hero's attack cooldown jumping up this frame.
      const press = heroes.some((h) => {
        const prev = (h.getData('eggCd') as number | undefined) ?? h.atkCd
        h.setData('eggCd', h.atkCd)
        return h.atkCd > prev + 30
      })
      if (press && left > 0) {
        e.state = 'done'
        e.ui.forEach((o) => o.destroy())
        SFX.powerUp()
        floatText(s, lead, this.ctx.floorY - 100, '搶到！攻擊 ×1.5', '#ffd040', { size: 16, dur: 1600 })
        this.ctx.onPower()
      } else if (left <= 0) {
        e.state = 'done'
        e.ui.forEach((o) => o.destroy())
        floatText(s, lead, this.ctx.floorY - 100, '俾人搶咗……', '#c0b0a0', { size: 12, dur: 1200 })
      }
    }
  }

  destroy() {
    this.overlay?.destroy()
    this.lanterns = []
  }
}
