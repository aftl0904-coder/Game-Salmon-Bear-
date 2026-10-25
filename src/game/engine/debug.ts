import Phaser from 'phaser'
import { isGrounded } from './collision'
import { enemyFsmLabel, type Creep } from '../enemyAi'

type DebugHero = Phaser.Physics.Arcade.Sprite & {
  pose?: string
  hp?: number
  facing?: number
  alive?: boolean
  role?: string
}

/**
 * Toggleable gameplay debug overlay (F1 or `).
 * Draws hitboxes, feet markers, velocity, and entity state text.
 */
export class DebugOverlay {
  enabled = false
  private gfx: Phaser.GameObjects.Graphics
  private labels: Phaser.GameObjects.Text[] = []
  private hint: Phaser.GameObjects.Text
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.gfx = scene.add.graphics().setDepth(90).setScrollFactor(1)
    this.hint = scene.add
      .text(8, 64, '', {
        fontFamily: 'Noto Sans TC, monospace, sans-serif',
        fontSize: '11px',
        color: '#a8ffc8',
        backgroundColor: '#102018cc',
        padding: { x: 6, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(91)
      .setVisible(false)
  }

  toggle() {
    this.enabled = !this.enabled
    this.hint.setVisible(this.enabled)
    if (!this.enabled) {
      this.gfx.clear()
      this.clearLabels()
    }
    return this.enabled
  }

  destroy() {
    this.gfx.destroy()
    this.hint.destroy()
    this.clearLabels()
  }

  private clearLabels() {
    for (const t of this.labels) t.destroy()
    this.labels = []
  }

  private label(x: number, y: number, msg: string, color = '#ffe08a') {
    const t = this.scene.add
      .text(x, y, msg, {
        fontFamily: 'Noto Sans TC, monospace, sans-serif',
        fontSize: '10px',
        color,
        backgroundColor: '#101820aa',
        padding: { x: 3, y: 1 },
      })
      .setDepth(91)
      .setOrigin(0.5, 1)
    this.labels.push(t)
  }

  draw(opts: {
    heroes: DebugHero[]
    enemies: Creep[]
    pet?: Phaser.Physics.Arcade.Sprite
  }) {
    if (!this.gfx?.active) return
    this.gfx.clear()
    this.clearLabels()
    if (!this.enabled) return

    this.hint.setText('DEBUG　F1 / ` 關閉　｜　綠=腳底　紅=身體　黃=敵人狀態')

    for (const h of opts.heroes) {
      if (!h?.active) continue
      this.drawBody(h, 0x44ff88, 0xff4466)
      const body = h.body as Phaser.Physics.Arcade.Body | undefined
      const vx = body?.velocity.x ?? 0
      const vy = body?.velocity.y ?? 0
      const g = body ? isGrounded(body) : false
      const lane = (h as { lane?: number }).lane
      this.label(
        h.x,
        h.y - 52,
        `${h.role ?? 'hero'} L${lane ?? '?'} ${h.pose ?? '?'} hp${h.hp ?? '?'} ${g ? 'G' : 'A'}\nv=(${vx.toFixed(0)},${vy.toFixed(0)})`,
        '#a8ffc8',
      )
    }

    if (opts.pet?.active) {
      this.drawBody(opts.pet, 0xffcc44, 0xffaa22)
      this.label(opts.pet.x, opts.pet.y - 48, 'pet follow', '#ffcc44')
    }

    for (const e of opts.enemies) {
      if (!e?.active) continue
      this.drawBody(e, 0xffee66, 0xff6644)
      const body = e.body as Phaser.Physics.Arcade.Body | undefined
      const vx = body?.velocity.x ?? 0
      const vy = body?.velocity.y ?? 0
      this.label(
        e.x,
        e.y - 58,
        `${e.kind}/${e.species} L${e.lane ?? '?'}\n${enemyFsmLabel(e)}/${e.state} hp${e.hp}/${e.maxHp}\nv=(${vx.toFixed(0)},${vy.toFixed(0)})`,
        '#ffe08a',
      )
    }
  }

  private drawBody(
    sprite: Phaser.Physics.Arcade.Sprite,
    footColor: number,
    boxColor: number,
  ) {
    const body = sprite.body as Phaser.Physics.Arcade.Body | null
    // feet cross
    this.gfx.lineStyle(2, footColor, 0.95)
    this.gfx.strokeCircle(sprite.x, sprite.y, 4)
    this.gfx.lineBetween(sprite.x - 10, sprite.y, sprite.x + 10, sprite.y)
    this.gfx.lineBetween(sprite.x, sprite.y - 8, sprite.x, sprite.y + 2)

    if (body) {
      this.gfx.lineStyle(1, boxColor, 0.85)
      this.gfx.strokeRect(body.x, body.y, body.width, body.height)
      // velocity vector
      this.gfx.lineStyle(2, 0x66ccff, 0.9)
      this.gfx.lineBetween(
        sprite.x,
        sprite.y - 20,
        sprite.x + body.velocity.x * 0.05,
        sprite.y - 20 + body.velocity.y * 0.05,
      )
    }
  }
}
