/**
 * 版本角落標示 (Alan, 2026-11-02): 封面右下角顯示版本號＋build時間，每次改版一眼睇到。
 *
 * 版本格式：{大改字母}{功能版本3位}.{小修版本3位} — 例： A001.001
 *  - 字母 (A/B/C…)：大改架構／核心玩法先進，好少郁
 *  - 中間3位：加咗新內容/新功能(新boss、新小遊戲、新機制) 就 +1，大改字母跳咗就歸零
 *  - 尾3位：細修（數值調校、bug fix、美術/文字換稿）就 +1，中間位跳咗就歸零
 *
 * 呢個常數每次有改版(merge PR)就手動update(Claude/Cursor commit嗰時一齊改)，
 * BUILD_TIME / BUILD_SHA 由 vite.config.ts `define` 注入。
 */
declare const __BUILD_TIME__: string
declare const __BUILD_SHA__: string

// A = Cursor 獨力開發嗰段（開荒到交 Claude 接手之前）。
// B = Claude 接手做plan/decide/review、Cursor執行呢個階段開始。
// B010.001 係由PR#59(2x解像度)數到依家main嘅實際進度（9個feature級改動+呢個版本角落本身
// 做第10個feature，35個patch級改動歸零跟住呢個新feature），唔係由頭computed，2026-11-02 一次性對齊。
export const VERSION = 'B010.002'

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD HH:mm in Asia/Hong_Kong. */
export function buildTimeHk(): string {
  try {
    const d = new Date(__BUILD_TIME__)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
  } catch {
    return __BUILD_TIME__
  }
}

/** 字串化做「YYYY-MM-DD HH:mm」，用緊玩家所在時區顯示。 */
export function buildTimeLabel(): string {
  try {
    const d = new Date(__BUILD_TIME__)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return __BUILD_TIME__
  }
}

export function buildSha(): string {
  try {
    const s = String(__BUILD_SHA__ || '').trim()
    return s || 'local'
  } catch {
    return 'local'
  }
}

/** Loading / title stamp: `v{YYYY-MM-DD HH:mm}（HK）· {sha7}` */
export function buildStampLabel(): string {
  return `v${buildTimeHk()}（HK）· ${buildSha()}`
}

export function versionLabel(): string {
  return `${VERSION} · ${buildTimeLabel()}`
}
