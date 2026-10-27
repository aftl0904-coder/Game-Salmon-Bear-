import Phaser from 'phaser'

/**
 * 噗噗's picnic friends (docs/bible/friends.md): plush toys locked in honey-crate cages.
 * Until Cursor's sheets arrive (art-src/anim/friends/<id>, batch 06) each friend is a small
 * procedurally drawn plush in its own colours; the cage likewise.
 */

export type FriendId = 'huihui' | 'guard' | 'denim' | 'brownie' | 'snowcat' | 'shiba' | 'ginger' | 'fleecy' | 'gnome' | 'tigercub' | 'kuro'

type Look = { name: string; fur: number; shirt: number; hat?: number; tall?: boolean }

export const FRIENDS: Record<FriendId, Look> = {
  huihui: { name: '熊仔', fur: 0xb78e6a, shirt: 0xf0c0cc }, // 杏色 fur (was grey) per owner request; renamed from 灰灰
  guard: { name: '英國熊', fur: 0x9a6a40, shirt: 0xc8281c, hat: 0x141014, tall: true }, // renamed from 阿兵
  denim: { name: '小熊仔', fur: 0xd8b07a, shirt: 0x2c3e6a }, // renamed from 牛仔
  brownie: { name: '招積熊', fur: 0x8a5a30, shirt: 0x1c1c20 }, // renamed from 啡啡
  snowcat: { name: '北極熊', fur: 0xf4f0f0, shirt: 0xf4d8e0 }, // renamed from 雪糕; concept changed cat -> polar bear
  shiba: { name: '柴柴', fur: 0xd8904a, shirt: 0xf8f0e0 },
  ginger: { name: '薑餅', fur: 0xa86a38, shirt: 0x3a8a40, hat: 0xd02828 },
  fleecy: { name: '大pat熊', fur: 0x9a948c, shirt: 0xf8f6f0 }, // renamed from 毛毛
  gnome: { name: '聖誕伯伯', fur: 0xf0e8e0, shirt: 0xc82828, hat: 0xd83030, tall: true },
  tigercub: { name: '虎仔', fur: 0xe8902a, shirt: 0xfaf0e0, hat: 0x3a6ac8 }, // redesigned in ART-REQUEST-12 after the first delivery turned out to be Tigger
  kuro: { name: '喵仔', fur: 0x202026, shirt: 0x2a4a9a }, // renamed from 黑豆
}

export function friendTex(id: string) {
  return `friend-${id}`
}

/** Placeholder plush (32×40): round head with ears, chubby body, shirt, dot eyes. */
function drawFriend(scene: Phaser.Scene, id: FriendId) {
  const key = friendTex(id)
  if (scene.textures.exists(key)) return
  const f = FRIENDS[id]
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const W = 32
  const H = 40
  const out = 0x1a1210
  const cx = W / 2
  // outline pass then fill pass
  const blob = (dx: number, col: number) => {
    g.fillStyle(col, 1)
    g.fillCircle(cx - 8, 13 + dx * 0, 4 + dx)
    g.fillCircle(cx + 8, 13, 4 + dx)
    g.fillEllipse(cx, 30, 22 + dx * 2, 18 + dx * 2)
    g.fillCircle(cx, 19, 10 + dx)
    g.fillEllipse(cx - 6, 38, 8 + dx * 2, 5 + dx * 2)
    g.fillEllipse(cx + 6, 38, 8 + dx * 2, 5 + dx * 2)
  }
  blob(1, out)
  blob(0, f.fur)
  g.fillStyle(f.shirt, 1).fillRect(cx - 10, 27, 20, 7)
  g.fillStyle(0xffffff, 0.18).fillCircle(cx - 3, 15, 4)
  g.fillStyle(out, 1).fillRect(cx - 4, 18, 2, 2).fillRect(cx + 2, 18, 2, 2).fillRect(cx - 1, 22, 2, 1)
  if (f.hat !== undefined) {
    g.fillStyle(f.hat, 1)
    if (f.tall) g.fillRect(cx - 6, 1, 12, 11)
    else g.fillTriangle(cx - 7, 11, cx + 7, 11, cx + 2, 2)
  }
  g.generateTexture(key, W, H)
  g.destroy()
}

/** Placeholder honey-crate cage (40×46): wooden frame, bars, a honey △ padlock. */
function drawCage(scene: Phaser.Scene) {
  if (scene.textures.exists('friend-cage')) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const W = 40
  const H = 46
  g.fillStyle(0x1a1210, 1).fillRect(0, 0, W, 6).fillRect(0, H - 6, W, 6)
  g.fillStyle(0x8a5a30, 1).fillRect(1, 1, W - 2, 4).fillRect(1, H - 5, W - 2, 4)
  for (let x = 2; x < W; x += 7) {
    g.fillStyle(0x1a1210, 1).fillRect(x, 5, 4, H - 10)
    g.fillStyle(0xb07a40, 1).fillRect(x + 1, 5, 2, H - 10)
  }
  g.fillStyle(0x1a1210, 1).fillTriangle(W / 2 - 7, 30, W / 2 + 7, 30, W / 2, 18)
  g.fillStyle(0xffc030, 1).fillTriangle(W / 2 - 5, 29, W / 2 + 5, 29, W / 2, 20)
  g.generateTexture('friend-cage', W, H)
  g.destroy()
}

export function ensureFriendArt(scene: Phaser.Scene) {
  drawCage(scene)
  for (const id of Object.keys(FRIENDS) as FriendId[]) drawFriend(scene, id)
}

export function isFriendId(id: string): id is FriendId {
  return id in FRIENDS
}
