import Phaser from 'phaser'
import { HoneyZombie } from './Stage4Enemies'
import { type Stage2Hooks } from './Stage2Enemies'
import { type HeroRef } from '../enemyAi'

/** Placeholder costume only: the moving chain is attached to this enemy, not static scenery. */
export class ProductZombie extends HoneyZombie {
  private costume: Phaser.GameObjects.Graphics
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.setTint(0xc4a276)
    this.costume = scene.add.graphics()
    this.costume.lineStyle(2, 0xaaa6a0, 1).strokeRect(-12, -36, 24, 22)
    this.costume.lineBetween(-12, -27, 12, -27)
    this.costume.lineBetween(-4, -36, -4, -14)
    this.costume.lineBetween(4, -36, 4, -14)
    this.costume.fillStyle(0xffde88, 1).fillRect(-5, -17, 10, 5)
  }
  override tick(dt: number, ctx: { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }) {
    super.tick(dt, ctx)
    this.costume.setPosition(this.x, this.y).setDepth(this.depth + 1).setVisible(this.active && this.visible && this.fsm !== 'DEAD')
  }
  override destroy(fromScene?: boolean) {
    this.costume?.destroy()
    super.destroy(fromScene)
  }
}
