// Desktop regression: state injection only reaches the relevant test point;
// gameplay and menus are operated with the keyboard.
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const OUT=process.env.QA_OUT??'docs/qa-stage4'; const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47313/'
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const ctx=await browser.newContext({viewport:{width:1280,height:720}}); const page=await ctx.newPage(); const errors=[], report={errors}
page.on('pageerror',e=>errors.push(e.stack??e.message))
const key=async k=>{await page.keyboard.press(k);await page.waitForTimeout(300)}
const state=()=>page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {x:s.boy.x,y:s.boy.y,hp:s.boy.hp,maxHp:s.heroMaxHp(s.boy),modal:s.clearModal,selected:s.clearBtns[s.clearSel]?.id,purse:s.purse.boy,camX:s.cameras.main.scrollX,scenes:window.__SAKE_GAME__.scene.getScenes(true).map(v=>v.scene.key)}})
try {
 await page.goto(BASE);await page.waitForFunction(()=>!!window.__SAKE_GAME__);await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
 await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',4);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);g.registry.set('carryPurse',{boy:100,girl:0});g.registry.set('carryCoins',100);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
 await page.waitForTimeout(3500);await key('Enter');await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:15000})
 let a=await state();await page.keyboard.down('d');await page.waitForTimeout(600);await page.keyboard.up('d');let z=await state();assert.ok(z.x>a.x+20,'desktop D moves hero')
 a=await state();await page.keyboard.down('g');await page.waitForTimeout(300);z=await state();await page.keyboard.up('g');assert.ok(z.y<a.y-10,'desktop G jumps')
 await page.screenshot({path:`${OUT}/desktop-01-stage4.png`})
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.cameras.main.setBounds(3160,0,640,360);s.boy.hp=2;s.win()})
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').tallyDone,null,{timeout:15000});z=await state();assert.equal(z.camX,0);assert.equal(z.selected,'next')
 await page.screenshot({path:`${OUT}/desktop-02-clear.png`})
 const select=async id=>{for(let i=0;i<8 && (await state()).selected!==id;i++)await key('ArrowLeft');assert.equal((await state()).selected,id)}
 await select('shop');await key('Enter');assert.ok((await state()).modal,'keyboard opens shop');await key('Escape');await page.waitForTimeout(300);assert.ok(!(await state()).modal,'keyboard exits shop')
 await select('sleep');await key('Enter');assert.ok((await state()).modal,'keyboard opens sleep');const coins=(await state()).purse;await key('Enter');await page.waitForTimeout(350);z=await state();assert.equal(z.hp,z.maxHp);assert.equal(coins-z.purse,12)
 await select('gamble');await key('Enter');assert.ok((await state()).modal,'keyboard opens gamble');await key('Escape');await page.waitForTimeout(350);assert.ok(!(await state()).modal,'keyboard exits gamble')
 await select('next');await key('Enter');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('worldmap'),null,{timeout:10000});await page.screenshot({path:`${OUT}/desktop-03-map.png`})
 await key('Enter');await key('Enter');await key('Enter');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('bike')||window.__SAKE_GAME__.scene.isActive('play'),null,{timeout:12000})
 if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('bike'))){await key('Enter');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('play'),null,{timeout:12000})}
 assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.registry.get('stageNo')),5);assert.deepEqual(errors,[]);report.passed=true;report.actions=['move','jump','clear','shop-exit','sleep','gamble-exit','worldmap','bike-to-stage5'];console.log('desktop',JSON.stringify(report))
}catch(e){report.passed=false;report.error=e.stack??String(e);console.error(report.error);await page.screenshot({path:`${OUT}/desktop-failure.png`}).catch(()=>{})}
finally{fs.writeFileSync(`${OUT}/desktop.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
