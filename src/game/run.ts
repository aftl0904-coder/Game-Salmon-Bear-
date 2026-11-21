/** Main-run checkpoint and ephemeral side trips. Legacy progress/gear keys remain intact. */
import { activeCharm, clearCharm, setActiveCharm, type CharmId } from './charms'
import { activeGear, copyGear, emptyGear, persistStoredGear, storedGear, useGear, type GearLoadout, type Who } from './gear'
import { maxStage } from './progress'

const KEY = 'sake-kuma-run-v1'
type Mode = '1p' | '2p'
type Solo = 'boy' | 'girl'
type Registry = { set: (key: string, value: any) => unknown; get?: (key: string) => unknown }
type Amounts = Partial<Record<Who, number>>
export type Run = {
  version: 1
  runId: string
  startStage: 1 | 6
  lastCleared: number
  nextStage: number
  gear: GearLoadout
  /** Reserved for the separately approved growth-points PR. */
  growth: Record<string, number>
  eligible: boolean
  coins?: number
  purse?: Amounts
  hp?: Amounts
  friends: string[]
  charm: CharmId | null
  mode: Mode
  solo: Solo
  legacyModeUnknown?: boolean
  /** Main-run companion departure; absent in older saves means false. */
  puffLeft: boolean
}
type Checkpoint = { coins: number; purse: Amounts; hp: Amounts; friends: string[]; puffLeft?: boolean }
let main: Run | null | undefined
let context: 'none' | 'main' | 'side' = 'none'
let sideEligible = true
let storageOk = true
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
function growthOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, value_] of Object.entries(value)) {
    if (typeof value_ === 'number' && Number.isFinite(value_) && value_ > 0) out[key] = value_
  }
  return out
}
function nonzeroGear(gear: GearLoadout) {
  return [...Object.values(gear.boy), ...Object.values(gear.girl)].some((n) => n > 0)
}
function parseRun(value: unknown): Run | null {
  if (!value || typeof value !== 'object') return null
  const r = value as Partial<Run>
  if (r.version !== 1 || (r.startStage !== 1 && r.startStage !== 6) || !Number.isInteger(r.nextStage) || r.nextStage! < 1 || r.nextStage! > 11 || !Number.isInteger(r.lastCleared) || r.lastCleared! < 0 || r.lastCleared! > 10 || typeof r.eligible !== 'boolean' || !r.gear || typeof r.gear !== 'object') return null
  if (!r.gear.boy || typeof r.gear.boy !== 'object' || !r.gear.girl || typeof r.gear.girl !== 'object') return null
  for (const who of ['boy', 'girl'] as const) {
    for (const key of ['heart', 'sword', 'gun', 'armour', 'boots', 'charm'] as const) {
      const value = r.gear[who][key]
      if (!Number.isInteger(value) || value < 0 || value > 3) return null
    }
  }
  const gear = copyGear(r.gear)
  const coins = typeof r.coins === 'number' && Number.isFinite(r.coins) && r.coins >= 0 ? Math.floor(r.coins) : undefined
  const charm = r.charm && charmIds.includes(r.charm) ? r.charm : null
  return { version: 1, runId: typeof r.runId === 'string' && r.runId ? r.runId : 'legacy-run', startStage: r.startStage, lastCleared: r.lastCleared!, nextStage: r.nextStage!, gear, growth: growthOf(r.growth), eligible: r.eligible, coins, purse: numbers(r.purse), hp: numbers(r.hp), friends: Array.isArray(r.friends) ? r.friends.filter((x): x is string => typeof x === 'string') : [], charm, mode: r.mode === '2p' ? '2p' : '1p', solo: r.solo === 'girl' ? 'girl' : 'boy', legacyModeUnknown: r.legacyModeUnknown === true, puffLeft: r.puffLeft === true }
}
function save(syncGear = false) {
  if (!main) return
  if (transactionDepth) { dirty = true; syncLegacyGear ||= syncGear; return }
  try {
    if (localStorage.getItem(KEY) !== lastRaw) {
      storageOk = false
      storageWarning('另一個分頁已更新存檔；為免覆寫，請先重新整理。')
      return
    }
    const raw = JSON.stringify(main)
    localStorage.setItem(KEY, raw)
    lastRaw = raw
    if (syncGear && !persistStoredGear(main.gear)) {
      storageOk = false
      storageWarning('舊版裝備存檔更新失敗；請勿清除瀏覽器資料。')
      return
    }
    storageOk = true
    storageWarning(null)
  } catch {
    storageOk = false
    storageWarning('儲存失敗，關閉或重新整理會失去未保存進度。')
  }
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
/** Read once per page; only absent legacy runs migrate. Invalid existing JSON is never silently overwritten. */
export function getRun(): Run | null {
  if (main !== undefined) return main
  try {
    const raw = localStorage.getItem(KEY)
    lastRaw = raw
    if (raw !== null) {
      try { main = parseRun(JSON.parse(raw)) } catch { main = null }
      if (!main && raw !== '{"version":1,"noMain":true}') storageWarning('本局存檔損壞；舊裝備及通關紀錄仍保留。')
      return main
    }
    const gear = storedGear()
    const next = Math.min(6, Math.max(1, maxStage()))
    if (next === 1 && !nonzeroGear(gear)) return (main = null)
    main = { version: 1, runId: newRunId(), startStage: 1, lastCleared: next - 1, nextStage: next, gear, growth: {}, eligible: true, friends: [], charm: null, mode: '1p', solo: 'boy', legacyModeUnknown: true, puffLeft: false }
    save()
    return main
  } catch { storageOk = false; storageWarning('讀取存檔失敗，請檢查瀏覽器儲存設定。'); return (main = null) }
}
export function canSaveRun() { return storageOk }
export function isSideTrip() { return context === 'side' }
/** Side trips use the original party independently of the main-run flag. */
export function puffAway() { return context === 'main' && getRun()?.puffLeft === true }
export function scoreEligible() { return context === 'side' ? sideEligible : context === 'main' ? (main?.eligible ?? true) : true }
/** A fresh player with no old loadout can begin at baseline without a redundant choice. */
export function needsStartChoice() {
  return !!getRun() || nonzeroGear(storedGear())
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
/** Replace only the main run; progress, friends and ending flags are never cleared. */
export function startNewRun(stage: 1 | 6, carry: boolean, mode: Mode, solo: Solo, registry: Registry) {
  const existing = getRun()
  const previousGear = existing ? copyGear(existing.gear) : storedGear()
  const previousGrowth = existing ? growthOf(existing.growth) : {}
  const gear = carry ? previousGear : emptyGear()
  const growth = carry ? previousGrowth : {}
  main = { version: 1, runId: newRunId(), startStage: stage, lastCleared: 0, nextStage: stage, gear, growth, eligible: !nonzeroGear(gear) && !Object.values(growth).some((n) => n > 0), friends: [], charm: null, mode, solo, puffLeft: false }
  context = 'main'
  clearCharm()
  bindMainGear()
  clearRegistry(registry)
  registry.set('stageNo', stage)
  save()
}
/** Side trips may mutate gear only in memory, and never touch the saved main run. */
export function startSideTrip(registry: Registry) {
  const existing = getRun()
  // A side-only playthrough must not look like a legacy main run after reload.
  if (!existing && lastRaw === null) {
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
/** A clear-card checkpoint may be updated again after shop/sleep/gamble. */
export function saveClear(stage: number, state: Checkpoint) {
  const r = getRun()
  if (!r || context !== 'main' || (stage !== r.nextStage && stage !== r.lastCleared)) return
  if (stage === r.nextStage) { r.lastCleared = stage; r.nextStage = stage + 1 }
  r.gear = activeGear()
  r.coins = Math.max(0, Math.floor(state.coins))
  r.purse = numbers(state.purse)
  r.hp = numbers(state.hp)
  r.friends = [...state.friends]
  r.charm = activeCharm()
  // Committed in the same single run snapshot as the clear, never on a side trip.
  if (stage === 7 && state.puffLeft) r.puffLeft = true
  save()
}
