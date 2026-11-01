import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { ANIM_SETS, animTex, hasAnimSet } from '../heroAnims'

/**
 * Stage 5 · △畝大廈 final boss: △畝大佬 (the man behind the triangle mask). No new jumping
 * mobs here — the bible calls for "精英" (elite) reskins of the first four stages' own
 * enemies instead (see GameScene.markElite), so this file only has the boss.
 *
 * Three phases, matching docs/bible/stages-3-5.md §5:
 *  1. 假蜜雨＋蜜僵門潮 — honey rain from the ceiling, zombies let in from both doors.
 *  2. 推土機軌道＋舊 Boss 投影 — a screen replays the first three bosses' signature attacks
 *     (reusing their real hazards via hooks, not a re-implementation) while a dozer sweeps
 *     the arena track.
 *  3. 三角盾＋主控電腦 — shielded except for brief "crack" windows; the last hit on the
 *     crack triggers a short 噗噗 team-up beat before he actually falls (see `die`).
 *
 * Art: Cursor's batch-13 (scripts/art/slice_triboss.py → public/art/anim/triboss.png),
 * registered as the 'triboss' anim set in heroAnims.ts. Falls back to a flat silhouette
 * texture if the art set isn't loaded for some reason (same spirit as the old placeholder).
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  draw(g)
  g.generateTexture(key, w, h)
  g.destroy()
}

export type TriHooks = {
  floorY: () => number
  /** Fake-honey rain across the arena — a handful of falling hazards from the ceiling. */
  rain: (x0: number, x1: number) => void
  spawnZombie: (x: number) => void
  /** "大屏幕投影" — replays 蜜冠女王蜂 / 月橋鏡鴞's own real attacks via their existing hooks. */
  replayQueen: (x: number) => void
  replayOwl: (gapX: number) => void
  /** Flat light bolt along the floor (high = crouch under, low = jump over). */
  bolt: (x: number, feet: number, dir: 1 | -1, high: boolean, speed: number, lifeMs: number) => void
  /** Damaging dozer run along the arena track (telegraphed first). */
  dozerRun: (x0: number, x1: number, dir: 1 | -1) => void
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'finale' | 'defeat') => void
}

type Act =
  | 'intro'
  | 'rainwarn'
  | 'rain'
  | 'doorL'
  | 'doorR'
  | 'rest1'
  | 'proj1'
  | 'proj2'
  | 'dozer'
  | 'rest2'
  | 'shield'
  | 'volley'
  | 'storm'
  | 'crack'

export class TriBoss extends Enemy {
  flying = false
  species = 'triboss'
  kind = 'boss'
  boss = true
  qphase: 1 | 2 | 3 = 1
  private act: Act = 'intro'
  private t = 0
  private dirX: 1 | -1 = -1
  private cycle = 0
  private volleyShots = 0
  private stormFired = 0
  arenaX0 = 0
  arenaX1 = 0
  private lastHitAt = 0
  private th: TriHooks
  private hasArt: boolean
  private animName = ''
  onDefeated?: () => void

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, th: TriHooks) {
    const hasArt = hasAnimSet(scene, 'triboss')
    if (!hasArt) {
      makeTexture(scene, 'stage5-triboss', 52, 64, (g) => {
        const out = 0x0e0a10
        // Suit + shoes.
        g.fillStyle(out, 1).fillEllipse(26, 58, 44, 10)
        g.fillStyle(0x201a28, 1).fillRoundedRect(8, 30, 36, 30, 6)
        g.fillStyle(0x16111c, 1).fillRect(8, 30, 36, 8)
        // Head + triangle mask.
        g.fillStyle(0x3a3240, 1).fillCircle(26, 20, 13)
        g.fillStyle(0xd82a2a, 1).fillTriangle(26, 8, 13, 28, 39, 28)
        g.fillStyle(out, 1).fillTriangle(26, 14, 19, 25, 33, 25)
        g.fillStyle(0xffd060, 1).fillCircle(26, 20, 2.4)
        // Tie — the one bright thread.
        g.fillStyle(0xffb020, 1).fillTriangle(26, 30, 22, 44, 30, 44)
      })
    }
    const idleStart = hasArt ? ANIM_SETS.triboss.anims.idle?.start ?? 0 : undefined
    super(scene, x, th.floorY(), hasArt ? animTex('triboss') : 'stage5-triboss', idleStart)
    this.hasArt = hasArt
    this.th = th
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 48
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    if (hasArt) {
      // Real art cell is taller than the old 52×64 placeholder — centre a similar hit
      // volume over his torso instead of the full suit+legs.
      const fw = this.frame.width
      const fh = this.frame.height
      body.setSize(44, 56)
      body.setOffset((fw - 44) / 2, fh - 56 - 6)
      this.playAnim('idle')
    } else {
      body.setSize(40, 48)
      body.setOffset(6, 10)
    }
  }

  /** Play `triboss-<name>` once per state change; no-ops to the placeholder tint path when there's no art. */
  private playAnim(name: string) {
    if (!this.hasArt) return
    if (this.animName === name) return
    const key = `triboss-${name}`
    if (!this.scene?.anims.exists(key)) return
    this.animName = name
    this.play(key)
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    return this.contactCd <= 0
  }

  receiveHit(_dmg: number, dir: number): EnemyHitResult {
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    // Phase 3: shielded except during the brief crack window.
    if (this.qphase === 3 && this.act !== 'crack') {
      this.scene.cameras.main.flash(60, 120, 160, 255)
      return { killed: false, hp: this.hp }
    }
    this.lastHitAt = now
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(1, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) this.updatePhase()
    return r
  }

  private openCrack() {
    this.clearTint()
    this.go('crack')
    this.th.bossEvent('weak')
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next: 1 | 2 | 3 = f <= 0.34 ? 3 : f <= 0.67 ? 2 : 1
    if (next !== this.qphase) {
      this.qphase = next
      this.th.bossEvent(next === 2 ? 'phase2' : 'phase3')
      this.go(next === 2 ? 'proj1' : 'shield')
    }
  }

  private go(a: Act) {
    this.act = a
    this.t = 0
    this.volleyShots = 0
    this.stormFired = 0
  }

  /** Safe lane for feather rain: never at the boss's feet, never on top of the target. */
  private safeGap(targetX: number) {
    const mid = (this.arenaX0 + this.arenaX1) / 2
    const cands = [this.arenaX0 + 90, mid - 80, mid + 80, this.arenaX1 - 260].filter((c) => Math.abs(c - this.x) > 120)
    const far = cands.filter((c) => Math.abs(c - targetX) >= 140)
    const pool = far.length ? far : cands
    return pool[Math.floor(Math.random() * pool.length)] ?? mid
  }

  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'intro'
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    if (this.hasArt) {
      // Mask cracks off, then he crumples — no silhouette bounce-tween needed, the
      // animation itself carries the fall.
      this.animName = ''
      this.playAnim('unmask')
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.animName = ''
        this.playAnim('defeat')
      })
    } else {
      this.clearTint()
      this.scene.tweens.add({ targets: this, y: this.th.floorY(), angle: 10, duration: 700, ease: 'Bounce.out' })
    }
    // 噗噗 half-wakes and charges in for the team-up finish before he's counted defeated.
    this.th.bossEvent('finale')
    this.scene.time.delayedCall(2200, () => {
      this.th.bossEvent('defeat')
      this.onDefeated?.()
    })
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.th.floorY()
    this.y = floor
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    this.setFlipX(tgt.x < this.x)
    switch (this.act) {
      case 'intro':
        this.playAnim('idle')
        if (this.t > 1200) this.go('rainwarn')
        break

      // ── Phase 1: 假蜜雨＋蜜僵門潮 ──
      case 'rainwarn':
        // Pointing-up telegraph; keep the amber tint too when there's no art to flash instead.
        this.playAnim('point')
        if (!this.hasArt) this.setTint(0xffd070)
        if (this.t > 600) {
          this.clearTint()
          this.th.rain(this.arenaX0, this.arenaX1)
          this.go('rain')
        }
        break
      case 'rain':
        this.playAnim('rain')
        if (this.t > 500 && this.t - dt <= 500) this.th.spawnZombie(this.arenaX0 + 30)
        if (this.t > 900 && this.t - dt <= 900) this.th.spawnZombie(this.arenaX1 - 30)
        if (this.t > 1800) this.go('rest1')
        break
      case 'rest1':
        this.playAnim('idle')
        if (this.t > 900) this.go('rainwarn')
        break

      // ── Phase 2: 推土機軌道＋舊 Boss 投影 ──
      case 'proj1':
        this.playAnim('point')
        if (this.t > 200 && this.t - dt <= 200) this.th.replayQueen(tgt.x)
        if (this.t > 1400) this.go('proj2')
        break
      case 'proj2':
        this.playAnim('point')
        if (this.t > 200 && this.t - dt <= 200) this.th.replayOwl(this.safeGap(tgt.x))
        if (this.t > 1600) this.go('dozer')
        break
      case 'dozer':
        this.playAnim('point')
        if (this.t > 100 && this.t - dt <= 100) {
          this.dirX = (Math.sign(tgt.x - this.x) || this.dirX) as 1 | -1
          this.th.dozerRun(this.arenaX0, this.arenaX1, this.dirX)
        }
        if (this.t > 1500) this.go('rest2')
        break
      case 'rest2':
        this.playAnim('idle')
        if (this.t > 1000) this.go('proj1')
        break

      // ── Phase 3: 三角盾＋主控電腦 ──
      case 'shield':
        this.playAnim('shield')
        if (!this.hasArt) this.setTint(0x6a7aff)
        if (this.t > 700) {
          this.clearTint()
          this.go(this.cycle % 2 === 0 ? 'volley' : 'storm')
        }
        break
      case 'volley': {
        this.playAnim('point')
        const dir: 1 | -1 = tgt.x < this.x ? -1 : 1
        if (this.volleyShots < 3 && this.t >= this.volleyShots * 520) {
          this.th.bolt(this.x + dir * 24, floor, dir, this.volleyShots === 1, 240, 2600)
          this.volleyShots++
        }
        if (this.t > 1900) this.openCrack()
        break
      }
      case 'storm':
        this.playAnim('rain')
        if (this.stormFired === 0 && this.t > 100) {
          this.stormFired = 1
          this.th.rain(this.arenaX0, this.arenaX1)
          this.th.replayOwl(this.safeGap(tgt.x))
        }
        if (this.stormFired === 1 && this.t > 900) {
          this.stormFired = 2
          this.th.replayQueen(tgt.x)
        }
        if (this.t > 2000) this.openCrack()
        break
      case 'crack':
        this.playAnim('hurt')
        if (!this.hasArt) this.setTint(0xffe060)
        if (this.t > 1400) {
          this.clearTint()
          this.cycle++
          this.go('shield')
        }
        break
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}
