#!/usr/bin/env node
// Stage 7 approved data contract; runtime/collision/playthrough still need separate QA.
import { readFileSync } from 'node:fs'
const errors=[]
const check=(v,message)=>{if(!v)errors.push(message)}
const level=JSON.parse(readFileSync(new URL('../../data/levels/stage7.json',import.meta.url)))
const bosses=JSON.parse(readFileSync(new URL('../../data/bosses.json',import.meta.url)))
check(level.id==='ST-07'&&level.worldW===5700,'stage identity/world width')
const segments=level.segments||[]
check(segments.length===5&&segments.map(s=>s.id).join('')==='ABCDE','five ordered segments')
for(let i=0;i<segments.length;i++)check(segments[i].x0===(i?segments[i-1].x1:0)&&segments[i].x1>segments[i].x0,`segment ${i} must be continuous`)
check(segments.at(-1)?.x1===level.worldW,'segments cover world')
check(JSON.stringify(level.pits)===JSON.stringify([{x:2320,w:56},{x:2780,w:64}]),'two approved C pits')
const TYPES=new Set(['s7charge','s7hop','s7shield','s7can'])
const enemies=level.enemies||[]
check(enemies.length<=18,'density ≤ prior 15 + 20% (≤18)')
check(enemies.every(e=>TYPES.has(e.species)),'only Stage-7 behavior species')
// No two consecutive same type along spawn order (x ascending).
const ordered=[...enemies].sort((a,b)=>a.x-b.x)
for(let i=1;i<ordered.length;i++)check(ordered[i].species!==ordered[i-1].species,`no consecutive same type at x=${ordered[i].x}`)
for(const segment of segments){
  const inSeg=enemies.filter(e=>e.x>=segment.x0&&e.x<segment.x1)
  const kinds=new Set(inSeg.map(e=>e.species))
  // 2026-11-24 relayout: A = one-at-a-time teaching, E = boss arena only (no minor enemies); variety rule applies to B–D
  if(['B','C','D'].includes(segment.id))check(kinds.size>=3,`${segment.id}: ≥3 behavior types (got ${[...kinds].join(',')||'none'})`)
  if(segment.id==='A')check(kinds.size>=2,`A: ≥2 teaching types (got ${[...kinds].join(',')||'none'})`)
  if(segment.id==='E')check(inSeg.length===0,`E: boss arena should have no minor enemies (got ${inSeg.length})`)
  for(const e of inSeg)check(Number.isFinite(e.unlockX)&&e.unlockX<=e.x,'enemy unlock before position')
}
const t=level.trainer||{}
for(const [key,value] of Object.entries({hp:55,phase2At:0.66,phase3Below:0.3,phase3Rate:1.3,summonPerCycle:1,summonMaxAlive:2,chainWarnMs:800,chainLifeMs:1500,chainWidth:108}))check(t[key]===value,`trainer ${key} must be ${value}`)
check(level.boss?.kind==='trainer'&&level.boss.arenaX1-level.boss.arenaX0>t.chainWidth+32,'boss arena and safe space')
check((level.staticDecor||[]).length>0&&(level.staticDecor||[]).every(o=>['cage','chain','net','price'].includes(o.kind)&&o.x>=0&&o.x<level.worldW),'static decor types and positions')
const card=bosses.bosses?.trainer
const approved={
  name:'馴獸師',
  title:'展銷中心嘅訓練官・被鞭所控',
  lines:['佢本來係照顧動物嘅飼養員。','三角組織俾咗佢一條鞭，話「聽話先有得賣」。','揮得耐咗，佢已經聽唔到動物喊。'],
  why:'呢度啲產品化蜜僵同鎖鏈，全部係佢訓練出嚟。',
}
check(card?.name===approved.name&&card?.title===approved.title&&card?.why===approved.why&&JSON.stringify(card?.lines)===JSON.stringify(approved.lines),'trainer card matches Claude/Alan authorized verbatim copy')
if(errors.length){console.error('stage7.json / trainer: FAIL\n - '+errors.join('\n - '));process.exitCode=1}else console.log('stage7.json / trainer: OK (data only; runtime QA separate)')
