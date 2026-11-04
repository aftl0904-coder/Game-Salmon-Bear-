/** Main-run checkpoint and ephemeral side trips. Legacy progress/gear keys remain intact. */
import { activeCharm, clearCharm, setActiveCharm, type CharmId } from './charms'
import { activeGear, copyGear, emptyGear, persistStoredGear, storedGear, useGear, type GearLoadout, type Who } from './gear'
import { advanceGrowthBook, createGrowthBook, isGrowthBook, migrateEmptyLegacyGrowth, startGrowthBranch, type GrowthBook, type GrowthRank } from './growth'
import { maxStage } from './progress'

const KEY = 'sake-kuma-run-v1'
type Mode = '1p' | '2p'
type Solo = 'boy' | 'girl'
type Registry = { set: (key: string, value: any) => unknown; get?: (key: string) => unknown }
type Amounts = Partial<Record<Who, number>>
export type Run = {
  version: 2
  runId: string
  startStage: 1 | 6
  lastCleared: number
  nextStage: number
  gear: GearLoadout
  growth: GrowthBook
  eligible: boolean
  coins?: number
  purse?: Amounts
  hp?: Amounts
  friends: string[]
  charm: CharmId | null
  mode: Mode
  solo: Solo
  legacyModeUnknown?: boolean
  /** Exact canonical v1 source, retained in the same atomic snapshot. */
  legacyRaw?: string
}
type Checkpoint = { coins: number; purse: Amounts; hp: Amounts; friends: string[] }
let main: Run | null | undefined
let context: 'none' | 'main' | 'side' = 'none'
let sideEligible = true
let storageOk = true
let blocked = false
let lastRaw: string | null = null
let transactionDepth = 0
let dirty = false
let syncLegacyGear = false
const charmIds: CharmId[] = ['omamori', 'speed', 'power', 'stamina', 'luck']
const newRunId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

function storageWarning(message: string | null) {
  if (typeof document === 'undefined') return
  let el = document.getElementById('save-warning')
  if (!message) { el?.remove(); return }
  if (!el) {
    el = document.createElement('div')
    el.id = 'save-warning'
    el.setAttribute('role', 'alert')
    Object.assign(el.style, { position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999', padding: '8px', background: '#641818', color: '#fff', textAlign: 'center', font: '14px sans-serif' })
    document.body.appendChild(el)
  }
  el.textContent = message
}

function numbers(value: unknown): Amounts | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const out: Amounts = {}
  for (const who of ['boy', 'girl'] as const) {
    const n = raw[who]
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[who] = Math.floor(n)
  }
  return out
}
function nonzeroGear(gear: GearLoadout) {
  return [...Object.values(gear.boy), ...Object.values(gear.girl)].some((n) => n > 0)
}
function parseRun(value: unknown, original: string): Run | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const r = value as Record<string, any>
  const keys = ['version', 'runId', 'startStage', 'lastCleared', 'nextStage', 'gear', 'growth', 'eligible', 'coins', 'purse', 'hp', 'friends', 'charm', 'mode', 'solo', 'legacyModeUnknown', 'legacyRaw']
  if (Object.keys(r).some(k => !keys.includes(k)) || (r.version !== 1 && r.version !== 2) || (r.startStage !== 1 && r.startStage !== 6) || !Number.isInteger(r.nextStage) || r.nextStage < r.startStage || r.nextStage > 11 || !Number.isInteger(r.lastCleared) || r.lastCleared < 0 || r.lastCleared > 10 || (r.lastCleared === 0 ? r.nextStage !== r.startStage : r.lastCleared !== r.nextStage - 1) || typeof r.eligible !== 'boolean' || !r.gear || typeof r.gear !== 'object' || Array.isArray(r.gear)) return null
  if (!r.gear.boy || typeof r.gear.boy !== 'object' || Array.isArray(r.gear.boy) || !r.gear.girl || typeof r.gear.girl !== 'object' || Array.isArray(r.gear.girl) || Object.keys(r.gear).some(k => !['boy', 'girl'].includes(k))) return null
  for (const who of ['boy', 'girl'] as const) {
    if (Object.keys(r.gear[who]).some(k => !['heart', 'sword', 'gun', 'armour', 'boots', 'charm'].includes(k))) return null
    for (const key of ['heart', 'sword', 'gun', 'armour', 'boots', 'charm'] as const) {
      const value = r.gear[who][key]
      if (!Number.isInteger(value) || value < 0 || value > 3) return null
    }
  }
  if (r.runId !== undefined && (typeof r.runId !== 'string' || !r.runId.trim() || r.runId.length > 128)) return null
  if (r.version === 2 && typeof r.runId !== 'string') return null
  if (r.mode !== undefined && r.mode !== '1p' && r.mode !== '2p') return null
  if (r.solo !== undefined && r.solo !== 'boy' && r.solo !== 'girl') return null
  if (r.legacyModeUnknown !== undefined && typeof r.legacyModeUnknown !== 'boolean') return null
  if (r.legacyRaw !== undefined && (r.version !== 2 || typeof r.legacyRaw !== 'string')) return null
  if (r.coins !== undefined && (!Number.isSafeInteger(r.coins) || r.coins < 0)) return null
  for (const field of ['purse', 'hp']) if (r[field] !== undefined && (!r[field] || typeof r[field] !== 'object' || Array.isArray(r[field]) || Object.keys(r[field]).some(k => !['boy', 'girl'].includes(k) || !Number.isSafeInteger(r[field][k]) || r[field][k] < 0))) return null
  if (r.friends !== undefined && (!Array.isArray(r.friends) || r.friends.some((x: unknown) => typeof x !== 'string'))) return null
  if (r.charm !== undefined && r.charm !== null && !charmIds.includes(r.charm)) return null
  const id = r.runId ?? newRunId()
  let growth: GrowthBook
  if (r.version === 1) {
    try { growth = migrateEmptyLegacyGrowth(id, r.startStage, r.nextStage, r.growth === undefined ? {} : r.growth) } catch { return null }
  } else {
    if (!isGrowthBook(r.growth)) return null
    growth = r.growth
    const active = growth.branches[growth.branches.length - 1]!
    if (active.id !== id || active.startStage !== r.startStage || active.nextStage !== r.nextStage) return null
  }
  const gear = copyGear(r.gear)
  return { version: 2, runId: id, startStage: r.startStage, lastCleared: r.lastCleared, nextStage: r.nextStage, gear, growth, eligible: r.eligible, coins: r.coins, purse: numbers(r.purse), hp: numbers(r.hp), friends: r.friends ? [...r.friends] : [], charm: r.charm ?? null, mode: r.mode ?? '1p', solo: r.solo ?? 'boy', legacyModeUnknown: r.legacyModeUnknown === true, ...(r.version === 1 ? { legacyRaw: original } : r.legacyRaw !== undefined ? { legacyRaw: r.legacyRaw } : {}) }
}
/** Single setItem for run, progress and ledger. The read/compare is not cross-tab CAS. */
function commit(candidate: Run, syncGear = false): boolean {
  if (blocked) return false
  try {
    if (localStorage.getItem(KEY) !== lastRaw) {
      storageOk = false
      storageWarning('另一個分頁已更新存檔；為免覆寫，請先重新整理。')
      return false
    }
    const raw = JSON.stringify(candidate)
    if (!parseRun(JSON.parse(raw), raw)) throw new Error('invalid candidate')
    localStorage.setItem(KEY, raw)
    lastRaw = raw
    main = candidate
    if (syncGear && !persistStoredGear(candidate.gear)) {
      storageOk = false
      storageWarning('本局已保存，但舊版裝備存檔更新失敗；請勿清除瀏覽器資料。')
      return false
    }
    storageOk = true
    storageWarning(null)
    return true
  } catch {
    storageOk = false
    storageWarning('儲存失敗，關閉或重新整理會失去未保存進度。')
    return false
  }
}
function save(syncGear = false): boolean {
  if (!main) return false
  if (transactionDepth) { dirty = true; syncLegacyGear ||= syncGear; return true }
  return commit(main, syncGear)
}
/** Commit a clear-card purchase and its coins/loadout as one run snapshot. */
export function runTransaction(action: () => void) {
  transactionDepth++
  try { action() } finally {
    transactionDepth--
    if (!transactionDepth && dirty) {
      const sync = syncLegacyGear
      dirty = false
      syncLegacyGear = false
      save(sync)
    }
  }
}
function bindMainGear() {
  if (!main) return
  useGear(main.gear, false, (gear) => {
    if (!main || context !== 'main') return
    main.gear = gear
    save(true)
  })
}
/** Read once; preserve and lock unknown or corrupt data. */
export function getRun(): Run | null {
  if (main !== undefined) return main
  try {
    const raw = localStorage.getItem(KEY)
    lastRaw = raw
    if (raw !== null) {
      if (raw === '{"version":1,"noMain":true}') return (main = null)
      let parsed: Run | null = null
      let version: unknown
      try { const data = JSON.parse(raw); version = data?.version; parsed = parseRun(data, raw) } catch { /* keep raw */ }
      if (!parsed) { blocked = true; storageOk = false; storageWarning('本局存檔損壞或格式未知；已保留原文，請勿清除瀏覽器資料。'); return (main = null) }
      if (version === 1 && !commit(parsed)) { blocked = true; return (main = null) }
      return (main = parsed)
    }
    const gear = storedGear()
    const next = Math.min(6, Math.max(1, maxStage()))
    if (next === 1 && !nonzeroGear(gear)) return (main = null)
    const id = newRunId()
    const candidate: Run = { version: 2, runId: id, startStage: 1, lastCleared: next - 1, nextStage: next, gear, growth: migrateEmptyLegacyGrowth(id, 1, next, {}), eligible: true, friends: [], charm: null, mode: '1p', solo: 'boy', legacyModeUnknown: true }
    if (!commit(candidate)) { blocked = true; return (main = null) }
    return (main = candidate)
  } catch { blocked = true; storageOk = false; storageWarning('讀取存檔失敗，請檢查瀏覽器儲存設定。'); return (main = null) }
}
export function canSaveRun() { return storageOk }
export function isSideTrip() { return context === 'side' }
export function scoreEligible() { return context === 'side' ? sideEligible : context === 'main' ? (main?.eligible ?? true) : true }
/** A fresh player with no old loadout can begin at baseline without a redundant choice. */
export function needsStartChoice() {
  return !!getRun() || blocked || nonzeroGear(storedGear())
}
/** Explain a destructive restart without claiming an unplayed stage was cleared. */
export function restartWarning(stage: 1 | 6): string | null {
  const r = getRun()
  if (!r || (r.lastCleared === 0 && r.nextStage === stage)) return null
  const progress = r.lastCleared > 0 ? `已打到第${r.lastCleared}關` : `目前停喺第${r.nextStage}關`
  return `會取代目前本局（${progress}）`
}
export function rememberCharm(charm: CharmId) {
  if (main && context === 'main') { main.charm = charm; save() }
}
/** Preserve extra continues earned in a transition minigame. */
export function saveTransitionCoins(stage: number, coins: number) {
  if (!main || context !== 'main' || main.nextStage !== stage) return
  main.coins = Math.max(0, Math.floor(coins))
  save()
}
export function iconFor(stage: number): '✅' | '⚪' | '🚫' {
  const r = getRun()
  if (r && stage === r.nextStage) return '✅'
  if (stage === 1 || stage === 6) return '⚪'
  return '🚫'
}
function clearRegistry(registry: Registry) {
  registry.set('carryCoins', undefined)
  registry.set('carryPurse', undefined)
  registry.set('carryHp', undefined)
  registry.set('runFriends', [])
}
/** Until archive selection UI exists, never replace a nonzero growth branch. */
export function startNewRun(stage: 1 | 6, carry: boolean, mode: Mode, solo: Solo, registry: Registry): boolean {
  const existing = getRun()
  if (blocked) { storageWarning('本局存檔損壞或格式未知；已保留原文，不能開新局。'); return false }
  if (existing && existing.growth.branches.some(b => b.heroes.boy.earned > 0 || b.heroes.girl.earned > 0)) {
    storageWarning('舊成長取回介面尚未完成，暫不能開新局；原有本局及成長已保留。')
    return false
  }
  const previousGear = existing ? copyGear(existing.gear) : storedGear()
  const gear = carry ? previousGear : emptyGear()
  const id = newRunId()
  const growth = existing ? startGrowthBranch(existing.growth, id, stage, null).book : createGrowthBook(id, stage)
  const candidate: Run = { version: 2, runId: id, startStage: stage, lastCleared: 0, nextStage: stage, gear, growth, eligible: !nonzeroGear(gear), friends: [], charm: null, mode, solo, ...(existing?.legacyRaw !== undefined ? { legacyRaw: existing.legacyRaw } : {}) }
  if (!commit(candidate)) return false
  context = 'main'
  clearCharm()
  bindMainGear()
  clearRegistry(registry)
  registry.set('stageNo', stage)
  return true
}
/** Side trips may mutate gear only in memory, and never touch the saved main run. */
export function startSideTrip(registry: Registry) {
  const existing = getRun()
  // A side-only playthrough must not look like a legacy main run after reload.
  if (!existing && lastRaw === null && !blocked) {
    try {
      if (localStorage.getItem(KEY) === null) {
        const sentinel = '{"version":1,"noMain":true}'
        localStorage.setItem(KEY, sentinel)
        lastRaw = sentinel
      }
    } catch { storageOk = false; storageWarning('儲存失敗，關閉或重新整理會失去未保存進度。') }
  }
  context = 'side'
  sideEligible = true
  useGear(emptyGear(), false)
  clearCharm()
  clearRegistry(registry)
}
/** Restore a checkpoint after a reload or side trip, without changing it. */
export function resumeMain(registry: Registry): Run | null {
  const r = getRun()
  if (!r) return null
  if (r.legacyModeUnknown) {
    const mode = registry.get?.('playMode')
    const solo = registry.get?.('soloCast')
    if (mode === '1p' || mode === '2p') {
      r.mode = mode
      r.solo = solo === 'girl' ? 'girl' : 'boy'
      r.legacyModeUnknown = false
      save()
    }
  }
  context = 'main'
  bindMainGear()
  if (r.charm) setActiveCharm(r.charm); else clearCharm()
  registry.set('stageNo', r.nextStage)
  registry.set('playMode', r.mode)
  registry.set('soloCast', r.solo)
  registry.set('carryCoins', r.coins)
  registry.set('carryPurse', r.purse ? { ...r.purse } : undefined)
  registry.set('carryHp', r.hp ? { ...r.hp } : undefined)
  registry.set('runFriends', [...r.friends])
  return r
}
/** Advance and award together; repeat only refreshes checkpoint state. */
export function saveClear(stage: number, state: Checkpoint, rank?: GrowthRank): boolean {
  const r = getRun()
  if (!r || context !== 'main' || (stage !== r.nextStage && stage !== r.lastCleared)) return false
  let growth = r.growth
  if (stage === r.nextStage) {
    if (!rank || !['S', 'A', 'B', 'C'].includes(rank)) { storageWarning('缺少過關評級；本局未推進，請保留存檔。'); storageOk = false; return false }
    try { growth = advanceGrowthBook(r.growth, stage, rank, 'main') } catch { storageWarning('成長帳本異常；本局未推進，請保留存檔。'); storageOk = false; return false }
  }
  const candidate: Run = { ...r, growth, lastCleared: stage === r.nextStage ? stage : r.lastCleared, nextStage: stage === r.nextStage ? stage + 1 : r.nextStage, gear: activeGear(), coins: Math.max(0, Math.floor(state.coins)), purse: numbers(state.purse), hp: numbers(state.hp), friends: [...state.friends], charm: activeCharm() }
  if (transactionDepth) { main = candidate; dirty = true; return true }
  return commit(candidate)
}
