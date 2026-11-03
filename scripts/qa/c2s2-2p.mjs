import { chromium } from 'playwright'
import fs from 'node:fs'
const out='docs/qa-c2s2';fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const ctx=await browser.newContext({viewport:{width:1280,height:720}})
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
await ctx.addInitScript(({gear})=>{
 localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}))
 localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-2p',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:'2p',solo:'boy',puffLeft:false}))
},{gear})
const page=await ctx.newPage(),log={description:'2P keyboard bot from normal menu, stage-6-cleared checkpoint; no teleport, HP edit or forced win',samples:[],errors:[],passed:false}
page.on('pageerror',e=>log.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')log.errors.push('console: '+m.text())})
await page.goto('http://127.0.0.1:47418/?c2=1');await page.waitForTimeout(4000)
const state=()=>page.evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(a=>a.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,ended:s?.ended,continued:s?.awaitingContinue,intro:!!s?.storyIntro,x1:s?.boy&&Math.round(s.boy.x),x2:s?.girl&&Math.round(s.girl.x),hp1:s?.boy?.hp,hp2:s?.girl?.hp,phase:s?.queen?.qphase,win:g.registry.get('winScreenShown')===true}})
for(let i=0;i<25;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1200)}
let s=await state();if(s.mode!=='2p'||s.stage!==7||!s.started){log.failure='normal entry did not start 2P stage 7';log.final=s;fs.writeFileSync(`${out}/2p-bot.json`,JSON.stringify(log,null,2));await browser.close();process.exit(1)}
let held=false,last=0,loops=0;const start=Date.now();
while(Date.now()-start<180000){
 loops++;s=await state()
 if(s.win){log.passed=true;break}
 if(s.active.includes('play')&&s.started&&!s.ended&&!s.intro){
  if(!held){await page.keyboard.down('d');await page.keyboard.down('ArrowRight');held=true}
  await page.keyboard.press('f');await page.keyboard.press(',');if(loops%3===0){await page.keyboard.press('g');await page.keyboard.press('.')}
  if(loops%24===0){await page.keyboard.press('t');await page.keyboard.press(';')}
 }else{if(held){await page.keyboard.up('d');await page.keyboard.up('ArrowRight');held=false} await page.keyboard.press(s.continued?'Space':'Enter')}
 if(Date.now()-last>10000){last=Date.now();log.samples.push({elapsed:Math.round((last-start)/1000),...s});fs.writeFileSync(`${out}/2p-bot.json`,JSON.stringify(log,null,2)+'\n');console.log('2p',Math.round((last-start)/1000),JSON.stringify(s))}
 await page.waitForTimeout(300)
}
if(held){await page.keyboard.up('d');await page.keyboard.up('ArrowRight')}
log.durationSec=Math.round((Date.now()-start)/1000);log.final=await state();await page.screenshot({path:`${out}/2p-bot-final.png`});fs.writeFileSync(`${out}/2p-bot.json`,JSON.stringify(log,null,2)+'\n');console.log('2p result',JSON.stringify({passed:log.passed,final:log.final,errors:log.errors}));await browser.close()
