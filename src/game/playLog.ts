/**
 * Optional play session log — only when URL has `?log=1`.
 * localStorage only; never sent over the network.
 *
 * TSV columns (tab-separated):
 * t_ms  mode  diff  stage  event  hero  x  cause  dmg  hp_after  extra
 */
import { getDifficulty, type Difficulty } from './difficulty'

const KEY = 'sake-kuma-log-v1'
const MAX_ROWS = 5000

export type PlayLogEvent = 'hurt' | 'death' | 'continue' | 'clear' | 'fps'

export type PlayLogRow = {
  t_ms: number
  mode: '1P' | '2P'
  diff: Difficulty
  stage: number
  event: PlayLogEvent
  hero: 'boy' | 'girl' | '-'
  x: number | '-'
  cause: string
  dmg: number | '-'
  hp_after: number | '-'
  extra: string
}

let enabledCache: boolean | null = null
let sessionStartMs = 0

/** True only when `?log=1`. Cached for the page lifetime. */
export function playLogEnabled(): boolean {
  if (enabledCache !== null) return enabledCache
  try {
    enabledCache = new URLSearchParams(window.location.search).get('log') === '1'
  } catch {
    enabledCache = false
  }
  if (enabledCache && !sessionStartMs) sessionStartMs = performance.now()
  return enabledCache
}

function nowTms(): number {
  if (!sessionStartMs) sessionStartMs = performance.now()
  return Math.round(performance.now() - sessionStartMs)
}

function modeLabel(mode: '1p' | '2p'): '1P' | '2P' {
  return mode === '2p' ? '2P' : '1P'
}

function loadRows(): PlayLogRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PlayLogRow[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveRows(list: PlayLogRow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ROWS)))
  } catch {
    /* Quota / private mode — logging must never break play. */
  }
}

function push(row: PlayLogRow) {
  if (!playLogEnabled()) return
  const list = loadRows()
  list.push(row)
  saveRows(list)
}

export function loadPlayLog(): PlayLogRow[] {
  return loadRows()
}

export function clearPlayLog() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Last hurt cause per hero — used to fill death.cause. */
const lastHurtCause: Partial<Record<'boy' | 'girl', string>> = {}

export function recordHurt(opts: {
  stage: number
  mode: '1p' | '2p'
  hero: 'boy' | 'girl'
  x: number
  cause: string
  dmg: number
  hpAfter: number
}) {
  lastHurtCause[opts.hero] = opts.cause
  push({
    t_ms: nowTms(),
    mode: modeLabel(opts.mode),
    diff: getDifficulty(),
    stage: opts.stage,
    event: 'hurt',
    hero: opts.hero,
    x: Math.round(opts.x),
    cause: opts.cause,
    dmg: opts.dmg,
    hp_after: opts.hpAfter,
    extra: '-',
  })
}

export function recordDeath(opts: {
  stage: number
  mode: '1p' | '2p'
  hero: 'boy' | 'girl'
  x: number
}) {
  push({
    t_ms: nowTms(),
    mode: modeLabel(opts.mode),
    diff: getDifficulty(),
    stage: opts.stage,
    event: 'death',
    hero: opts.hero,
    x: Math.round(opts.x),
    cause: lastHurtCause[opts.hero] ?? '-',
    dmg: '-',
    hp_after: '-',
    extra: '-',
  })
}

export function recordContinue(opts: { stage: number; mode: '1p' | '2p' }) {
  push({
    t_ms: nowTms(),
    mode: modeLabel(opts.mode),
    diff: getDifficulty(),
    stage: opts.stage,
    event: 'continue',
    hero: '-',
    x: '-',
    cause: '-',
    dmg: '-',
    hp_after: '-',
    extra: '-',
  })
}

/** Stage clear + one fps row (avg / min 1s). */
export function recordClear(opts: {
  stage: number
  mode: '1p' | '2p'
  timeSec: number
  deaths: number
  fpsAvg: number
  fpsMin1s: number
}) {
  const base = {
    t_ms: nowTms(),
    mode: modeLabel(opts.mode),
    diff: getDifficulty(),
    stage: opts.stage,
    hero: '-' as const,
    x: '-' as const,
    cause: '-',
    dmg: '-' as const,
    hp_after: '-' as const,
  }
  push({
    ...base,
    event: 'clear',
    extra: `sec=${Math.round(opts.timeSec * 10) / 10};deaths=${opts.deaths}`,
  })
  push({
    ...base,
    t_ms: nowTms(),
    event: 'fps',
    extra: `avg=${opts.fpsAvg};min1s=${opts.fpsMin1s}`,
  })
}

const TSV_HEADER = 't_ms\tmode\tdiff\tstage\tevent\thero\tx\tcause\tdmg\thp_after\textra'

function cell(v: string | number): string {
  return String(v)
}

export function playLogToTsv(): string {
  const rows = loadRows().map((r) =>
    [
      r.t_ms,
      r.mode,
      r.diff,
      r.stage,
      r.event,
      r.hero,
      r.x,
      r.cause,
      r.dmg,
      r.hp_after,
      r.extra,
    ]
      .map(cell)
      .join('\t'),
  )
  return [TSV_HEADER, ...rows].join('\n')
}

export async function copyPlayLogTsv(): Promise<boolean> {
  const text = playLogToTsv()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// ── Per-stage FPS ────────────────────────────────────────────────────────────

let fpsFrames = 0
let fpsElapsedMs = 0
let fpsWindowMs = 0
let fpsWindowFrames = 0
let fpsMin1s = Number.POSITIVE_INFINITY
let fpsActive = false

export function resetStageFps() {
  fpsFrames = 0
  fpsElapsedMs = 0
  fpsWindowMs = 0
  fpsWindowFrames = 0
  fpsMin1s = Number.POSITIVE_INFINITY
  fpsActive = playLogEnabled()
}

export function tickStageFps(dtMs: number) {
  if (!fpsActive || !(dtMs > 0) || dtMs > 250) return
  fpsFrames += 1
  fpsElapsedMs += dtMs
  fpsWindowMs += dtMs
  fpsWindowFrames += 1
  if (fpsWindowMs >= 1000) {
    const winFps = (fpsWindowFrames * 1000) / fpsWindowMs
    if (winFps < fpsMin1s) fpsMin1s = winFps
    fpsWindowMs = 0
    fpsWindowFrames = 0
  }
}

export function stageFpsSnapshot(): { avg: number; min1s: number } {
  const avg = fpsElapsedMs > 0 ? (fpsFrames * 1000) / fpsElapsedMs : 0
  let min1s = Number.isFinite(fpsMin1s) ? fpsMin1s : avg
  if (fpsWindowMs > 200 && fpsWindowFrames > 0) {
    const partial = (fpsWindowFrames * 1000) / fpsWindowMs
    if (partial < min1s) min1s = partial
  }
  return {
    avg: Math.round(avg * 10) / 10,
    min1s: Math.round(min1s * 10) / 10,
  }
}
