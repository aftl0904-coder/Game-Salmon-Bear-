// Injected fixtures and direct scene methods, never a natural level clear.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out=process.env.QA_OUT??'docs/qa-first-release-growth/combat-20261104',base=process.env.QA_BASE_URL??'http://127.0.0.1:47952/'
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let passed=false,result={scope:'Injected 2P allocation, purchases, checkpoint, health/death and scene calls; not a natural clear'}
try {
 await page.goto(base);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:45000})
 await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__,z={hp:0,atk:0,def:0,stam:0,sp:0};game.registry.set('difficulty','normal');game.registry.set('stageRound',1);if(!r.startNewRun(1,false,'2p','boy',game.registry,{sourceId:null,allocations:{boy:{...z,hp:2},girl:{...z,stam:1}}}))throw Error('start');for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key);game.scene.start('play')})
 await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'),null,{timeout:45000});await page.waitForTimeout(3500);await page.keyboard.press('Enter');await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s?.started&&!s.storyIntro&&s.girl},{},{timeout:45000})
 result.data=await page.evaluate(async()=>{
  const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts'),growth=await import('/src/game/growth.ts'),s=window.__SAKE_GAME__.scene.getScene('play')
  g.buy('boy','heart');g.buy('boy','boots');g.buy('girl','boots');s.initHeroStats();const equipped={hp:s.boy.hp,max:s.heroMaxHp(s.boy),stam:s.heroStamMax('boy'),girlStam:s.heroStamMax('girl')}
  s.boy.hp=7;s.drinkCoffee();const coffee=s.boy.hp;s.fullHeal();const full=s.boy.hp
  const initialGrowth=JSON.stringify(r.getRun().growth);const saved=r.saveClear(1,{coins:5,purse:{boy:3,girl:2},hp:{boy:4,girl:5},friends:[]},'C');r.resumeMain(s.registry);s.initHeroStats();s.applyCarriedHp();const carried={boy:s.boy.hp,girl:s.girl.hp,growth:r.combatGrowth('boy')}
  s.boy.hp=0;s.knockOut(s.boy);const afterDeath={boyGear:g.gearOf('boy'),girlGear:g.gearOf('girl'),growth:r.combatGrowth('boy')};s.awaitingContinue=true;s.coinStock=1;s.purse={boy:1,girl:0};s.insertCoinContinue();const revive={hp:s.boy.hp,max:s.heroMaxHp(s.boy),stam:s.boy.stam,girlStam:s.heroStamMax('girl')}
  s.honeyGot=3;s.deaths=1;const rank=s.clearRank(999,6)
  const beforeSide=localStorage.getItem('sake-kuma-run-v1');r.startSideTrip(s.registry);const side={growth:r.combatGrowth('boy'),max:s.heroMaxHp(s.boy),unchanged:beforeSide===localStorage.getItem('sake-kuma-run-v1')};r.resumeMain(s.registry);const resumed={growth:r.combatGrowth('boy'),max:s.heroMaxHp(s.boy)}
  const caps=growth.combatGrowthEffects({hp:999,atk:999,def:999,stam:999,sp:999})
  return {equipped,coffee,full,saved,carried,afterDeath,revive,rank,side,resumed,caps,initialGrowth}
 })
 const x=result.data;assert.deepEqual(x.equipped,{hp:9,max:9,stam:1.25,girlStam:1.375});assert.equal(x.coffee,8);assert.equal(x.full,9);assert.equal(x.saved,true);assert.equal(x.carried.boy,4);assert.equal(x.carried.girl,5);assert.equal(x.afterDeath.boyGear.heart,0);assert.equal(x.afterDeath.boyGear.boots,0);assert.equal(x.afterDeath.girlGear.boots,1);assert.equal(x.afterDeath.growth.hp,2);assert.deepEqual(x.revive,{hp:8,max:8,stam:1,girlStam:1.375});assert.notEqual(x.rank,'S');assert.equal(x.side.max,6);assert.ok(x.side.unchanged);assert.equal(x.resumed.growth.hp,2);assert.equal(x.resumed.max,8);assert.deepEqual(x.caps,{extraHearts:5,attackBonus:3,extraIframesMs:600,staminaMultiplier:2,staminaRecoverMultiplier:1.3,specialBonus:3});assert.deepEqual(errors,[]);passed=true;console.log('PASS',JSON.stringify(x,null,2));await page.screenshot({path:`${out}/desktop-lifecycle.png`,scale:'css'})
}catch(e){result.error=e.stack??String(e);console.error('FAIL',result.error);await page.screenshot({path:`${out}/desktop-lifecycle-failure.png`,scale:'css'}).catch(()=>{})}
finally{result.passed=passed;result.errors=errors;fs.writeFileSync(`${out}/lifecycle.json`,JSON.stringify(result,null,2)+'\n');await browser.close()};if(!passed)process.exitCode=1
