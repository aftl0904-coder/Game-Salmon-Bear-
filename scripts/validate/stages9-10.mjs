#!/usr/bin/env node
// 第9、10關設計稿合約（同 stage8.mjs 一樣用第8–10關基準）。只驗數據；runtime 另測。
import { readFileSync } from 'node:fs'
const errors = []
const CFG = {
  9: { id: 'ST-09', bossKey: 'warden', boss: 'warden', species: ['s9guard', 's9lockbot', 's8drone', 's8tube', 's7shield', 's7charge', 'robotarm'], warn: ['slamWarnMs', 'keyThrowWarnMs', 'gateDropWarnMs'], weak: 'keysDroppedMs' },
  10: { id: 'ST-10', bossKey: 'leon', boss: 'leon', species: ['s10guard', 's9guard', 's9lockbot', 's8drone', 's8tube', 's8cabinet', 's7shield', 's7charge', 'robotarm'], warn: ['chargeWarnMs', 'shieldBashWarnMs', 'callGuardsWarnMs'], weak: 'chargeTiredMs' },
}
for (const [n, c] of Object.entries(CFG)) {
  const check = (v, m) => { if (!v) errors.push(`stage${n}: ${m}`) }
  const L = JSON.parse(readFileSync(new URL(`../../data/levels/stage${n}.json`, import.meta.url)))
  check(L.id === c.id && L.worldW === 5700, 'identity / worldW')
  const seg = L.segments || []
  check(seg.map(s => s.id).join('') === 'ABCDE', 'segments A–E')
  seg.forEach((s, i) => check(s.x0 === (i ? seg[i - 1].x1 : 0), `segment ${s.id} continuous`))
  const E = L.enemies || []
  check(E.length >= 18 && E.length <= 22, `enemies 18–22 (${E.length})`)
  check(E.filter(e => e.mid).length <= 3, 'mid ≤3')
  const S = new Set(c.species)
  for (const e of E) {
    check(S.has(e.species), `species ${e.species}@${e.x}`)
    check(e.unlockX <= e.x - 200, `unlockX ≤ x−200 @${e.x}`)
    if (e.species === 'robotarm') check(e.unlockX <= e.x - 380, `robotarm unlock ≤ x−380 @${e.x}`)
    for (const p of L.pits || []) check(e.x < p.x - 40 || e.x > p.x + p.w + 40, `enemy ${e.x} near pit ${p.x}`)
    for (const z of L.safeZones || []) check(e.x < z.x0 || e.x > z.x1, `enemy ${e.x} in safe zone`)
  }
  check(new Set(E.map(e => e.unlockX)).size === E.length, 'unique unlockX')
  let prev = 0
  for (const x of [...L.checkpoints, L.boss.triggerX]) { check(x - prev <= 1500, `checkpoint gap ${prev}→${x}`); prev = x }
  for (const p of L.pits) {
    const helped = (L.movingPlatforms || []).some(m => m.x - m.range <= p.x + p.w && m.x + m.w + m.range >= p.x)
    check(p.w <= 96 || helped, `pit ${p.x} >96 needs platform`)
  }
  check(L.coins.length >= 15 && L.coins.length <= 25, 'coins 15–25')
  check(L.honey.length >= 3 && L.honey.length <= 4, 'honey 3–4')
  check(L.breakables.filter(b => b.loot === 'power').length === 2, 'two power pots')
  for (const g of L.slidingGates || []) check(g.warnMs >= 800 && g.periodMs > g.warnMs + g.closedMs, `gate ${g.id} warn/safe gap`)
  for (const f of L.floodZones || []) check(f.warnMs >= 800 && f.periodMs > f.warnMs + f.highMs, `flood ${f.x0} warn/safe gap`)
  const b = L[c.bossKey] || {}
  check(L.boss.kind === c.boss, 'boss kind')
  check(b.hp >= 36 && b.hp <= 66, `boss hp ${b.hp}`)
  for (const k of c.warn) check(b[k] >= 800, `boss ${k} ≥800`)
  check(b[c.weak] >= 1500 && b.weakBase === 3 && b.capWeak === 5 && b.capNormal === 2, 'boss weak window')
  for (const s of L.signs || []) check([...s.text].length <= 20, `sign ≤20: ${s.text}`)
}
if (errors.length) { console.error('stage9/10 FAIL\n - ' + errors.join('\n - ')); process.exit(1) }
console.log('stage9.json / stage10.json: OK (data only; runtime QA separate)')
