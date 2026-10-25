import Phaser from 'phaser'

/** Internal render size (16:9) — replaces prior 480×270. */
export const GAME_W = 640
export const GAME_H = 360

/**
 * Base Phaser config. Scenes / physics merged in main.ts.
 * CSS scale is owned by fitCanvas / applyIntegerZoom (Scale.NONE).
 */
export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-root',
  pixelArt: true, // 最近鄰取樣
  roundPixels: true, // 位置取整，避免半像素
  antialias: false,
  backgroundColor: '#1a1420',
  scale: { mode: Phaser.Scale.NONE }, // 縮放由 fitCanvas 處理
}
