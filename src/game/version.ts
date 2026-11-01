/**
 * 版本角落標示 (Alan, 2026-11-02): 封面右下角顯示版本號＋build時間，每次改版一眼睇到。
 *
 * 版本格式：{大改字母}{功能版本3位}.{小修版本3位} — 例： A001.001
 *  - 字母 (A/B/C…)：大改架構／核心玩法先進，好少郁
 *  - 中間3位：加咗新內容/新功能(新boss、新小遊戲、新機制) 就 +1，大改字母跳咗就歸零
 *  - 尾3位：細修（數值調校、bug fix、美術/文字換稿）就 +1，中間位跳咗就歸零
 *
 * 呢個常數每次有改版(merge PR)就手動update(Claude/Cursor commit嗰時一齊改)，
 * BUILD_TIME就唔使手動理，vite.config.ts嘅`define`會自動攞build嗰刻嘅時間戳入嚟。
 */
declare const __BUILD_TIME__: string

// A = Cursor 獨力開發嗰段（開荒到交 Claude 接手之前）。
// B = Claude 接手做plan/decide/review、Cursor執行呢個階段開始，由 B001.001 計。
export const VERSION = 'B001.001'

/** 字串化做「YYYY-MM-DD HH:mm」，用緊玩家所在時區顯示。 */
export function buildTimeLabel(): string {
  try {
    const d = new Date(__BUILD_TIME__)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return __BUILD_TIME__
  }
}

export function versionLabel(): string {
  return `${VERSION} · ${buildTimeLabel()}`
}
