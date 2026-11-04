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
const enemies=level.enemies||[],expected={A:{guard:2},B:{guard:2,honeyzombie:2},C:{guard:2,robotarm:1},D:{guard:3,honeyzombie:3},E:{}}
for(const segment of segments){const actual={};for(const e of enemies.filter(e=>e.x>=segment.x0&&e.x<segment.x1)){actual[e.species]=(actual[e.species]||0)+1;if(e.species==='honeyzombie')check(e.product===true,'honey zombies use product skin');check(Number.isFinite(e.unlockX)&&e.unlockX<=e.x,'enemy unlock before position')}check(JSON.stringify(Object.entries(actual).sort())===JSON.stringify(Object.entries(expected[segment.id]||{}).sort()),`${segment.id}: enemy roster`)}
const t=level.trainer||{}
for(const [key,value] of Object.entries({hp:55,phase2At:0.66,phase3Below:0.3,phase3Rate:1.3,summonPerCycle:1,summonMaxAlive:2,chainWarnMs:800,chainLifeMs:1500,chainWidth:108}))check(t[key]===value,`trainer ${key} must be ${value}`)
check(level.boss?.kind==='trainer'&&level.boss.arenaX1-level.boss.arenaX0>t.chainWidth+32,'boss arena and safe space')
check((level.staticDecor||[]).length>0&&(level.staticDecor||[]).every(o=>['cage','chain','net'].includes(o.kind)&&o.x>=0&&o.x<level.worldW),'static decor types and positions')
const card=bosses.bosses?.trainer
check(card?.name==='馴獸師'&&card?.title==='森友展銷中心・馴獸師'&&card?.why==='小心鎖鏈同網，等有空檔先還擊！'&&JSON.stringify(card?.lines)===JSON.stringify(['光鮮展館嘅後面，排住一排又一排籠。','馴獸師守住呢度，唔想有人行近。','佢一聲令下，產品化蜜僵湧出嚟。']),'trainer card matches approved wording')
if(errors.length){console.error('stage7.json / trainer: FAIL\n - '+errors.join('\n - '));process.exitCode=1}else console.log('stage7.json / trainer: OK (data only; runtime QA separate)')
