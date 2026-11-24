#!/usr/bin/env node
// Stage 8（配方控制中心）設計稿合約：跟第8–10關基準（docs/gdd/stage8/design.md）。只驗數據；runtime 另測。
import { readFileSync } from 'node:fs'
const errors = []
const check = (v, m) => { if (!v) errors.push(m) }
const L = JSON.parse(readFileSync(new URL('../../data/levels/stage8.json', import.meta.url)))
check(L.id === 'ST-08' && L.worldW === 5700, 'stage identity / worldW 5700')
const seg = L.segments || []
check(seg.map(s => s.id).join('') === 'ABCDE', 'five ordered segments A–E')
seg.forEach((s, i) => check(s.x0 === (i ? seg[i - 1].x1 : 0) && s.x1 > s.x0, `segment ${s.id} continuous`))
check(seg.at(-1)?.x1 === L.worldW, 'segments cover world')
// 基準
const E = L.enemies || []
check(E.length >= 18 && E.length <= 22, `enemies 18–22 (got ${E.length})`)
check(E.filter(e => e.mid).length <= 3, 'mid-tier ≤ 3')
const SPECIES = new Set(['s8drone', 's8tube', 's8cabinet', 's7charge', 's7shield', 'robotarm'])
for (const e of E) {
  check(SPECIES.has(e.species), `unknown species ${e.species}@${e.x}`)
  check(Number.isFinite(e.unlockX) && e.unlockX <= e.x - 200, `unlockX ≤ x−200 @${e.x}`)
  if (e.species === 'robotarm') check(e.unlockX <= e.x - 380, `robotarm pops in at x: unlockX ≤ x−380 @${e.x}`)
}
const unlocks = E.map(e => e.unlockX)
check(new Set(unlocks).size === unlocks.length, 'no two enemies share an unlockX')
check(!E.some(e => e.x >= L.boss.arenaX0 - 40), 'no minor enemies in boss arena')
const cps = L.checkpoints || []
let prev = 0
for (const c of [...cps, L.boss.triggerX]) { check(c - prev <= 1500, `checkpoint gap ≤1500 (${prev}→${c})`); prev = c }
const pits = L.pits || []
const movers = L.movingPlatforms || []
for (const p of pits) {
  const helped = movers.some(m => m.x - (m.range || 0) <= p.x + p.w && m.x + m.w + (m.range || 0) >= p.x)
  check(p.w <= 96 || helped, `pit ${p.x} w${p.w}: >96 needs a platform`)
}
const coins = (L.coins || []).length, honey = (L.honey || []).length
check(coins >= 15 && coins <= 25, `coins 15–25 (got ${coins})`)
check(honey >= 3 && honey <= 4, `honey 3–4 (got ${honey})`)
check((L.breakables || []).filter(b => b.loot === 'power').length === 2, 'two power pots')
// 新機制
const valveIds = new Set((L.valves || []).map(v => v.id))
for (const p of L.pipeSprays || []) {
  check(p.warnMs >= 800, `pipe ${p.x} warn ≥800ms`)
  check(p.onMs > 0 && p.periodMs > p.warnMs + p.onMs, `pipe ${p.x} cycle has a safe gap`)
  if (p.valve) check(valveIds.has(p.valve), `pipe ${p.x} valve ${p.valve} exists`)
}
for (const v of L.valves || []) check(v.hits >= 1 && v.hits <= 3, `valve ${v.id} hits 1–3`)
// Boss
const r = L.researcher || {}
check(L.boss?.kind === 'researcher' && L.boss.triggerX >= L.boss.arenaX0 && L.boss.triggerX < L.boss.arenaX1, 'boss arena/trigger')
check(r.hp >= 36 && r.hp <= 60, `researcher hp 36–60 (got ${r.hp})`)
for (const k of ['swipeWarnMs', 'flaskWarnMs']) check(r[k] >= 800, `researcher ${k} ≥800`)
check(r.refillExposedMs >= 1500 && r.weakBase === 3 && r.capWeak === 5 && r.capNormal === 2, 'researcher weak window')
check(r.phase2At > r.phase3Below, 'researcher phases ordered')
for (const s of L.signs || []) check([...s.text].length <= 20, `sign ≤20字: ${s.text}`)
if (errors.length) { console.error('stage8.json FAIL\n - ' + errors.join('\n - ')); process.exit(1) }
console.log('stage8.json: OK (data only; runtime QA separate)')
