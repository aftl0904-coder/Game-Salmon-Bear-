import Phaser from 'phaser'

/** Internal render size (16:9) — replaces prior 480×270. */
export const GAME_W = 640
export const GAME_H = 360

/**
 * HD render factor. Game logic / level data / physics stay in the 640×360 world space;
 * the canvas backing buffer is RENDER_SCALE× larger and every scene camera is zoomed by
 * RENDER_SCALE (see hd.ts), so gameplay numbers are untouched while art can be drawn at
 * RENDER_SCALE× detail (texture scale 1/RENDER_SCALE).
 */
export const RENDER_SCALE = 2
export const CANVAS_W = GAME_W * RENDER_SCALE
export const CANVAS_H = GAME_H * RENDER_SCALE

/**
 * Base Phaser config. Scenes / physics merged in main.ts.
 * CSS scale is owned by fitCanvas / applyIntegerZoom (Scale.NONE).
 */
export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  parent: 'game-root',
  pixelArt: true, // 最近鄰取樣
  roundPixels: true, // 位置取整，避免半像素
  antialias: false,
  backgroundColor: '#1a1420',
  scale: { mode: Phaser.Scale.NONE }, // 縮放由 fitCanvas 處理
}
