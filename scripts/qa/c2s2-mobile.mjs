// Playwright mobile emulation. Seeded checkpoint; pure touch input after page load.
// Later static-decor comparison injects position and disables threats; not a playthrough.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out='docs/qa-c2s2';fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const ctx=await browser.newContext({...devices['Pixel 7 landscape']})
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
await ctx.addInitScript(({gear})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-mobile',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:100},hp:{boy:5},friends:[],charm:null,mode:'1p',solo:'boy',puffLeft:false}))},{gear})
const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),report={description:'Simulated mobile, seeded stage-6 checkpoint; entry and controls via touch only; injected position/threat isolation for static decor, not full playthrough; not a physical phone',checks:[],errors:[],passed:false}
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(350)}
const touch=async(type,points=[])=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x:b.x+b.width*x/640,y:b.y+b.height*y/360,id}))})}
const active=key=>page.waitForFunction(k=>window.__SAKE_GAME__?.scene.isActive(k),key,{timeout:30000})
const state=()=>page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {stage:s.stageNo,mode:s.mode,started:s.started,intro:!!s.storyIntro,x:s.boy.x,vy:s.boy.body.velocity.y,attackCd:s.boy.atkCd,hp:s.boy.hp}})
const staticInfo=()=>page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o=>o.getData?.('stage7-static')).map(o=>({name:o.name,type:o.type,x:o.x,y:o.y,body:!!o.body})))
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:47417/?c2=1');await active('logo');await page.waitForTimeout(1000);await tap(242,330);await active('difficulty');await page.waitForTimeout(700);await tap(320,190);await active('menu');await page.waitForTimeout(1000)
 const menu=await page.evaluate(()=>({stage:window.__SAKE_GAME__.scene.getScene('menu').stageSel}));assert.equal(menu.stage,7);await tap(148,334);await active('worldmap')
 for(let i=0;i<10;i++){if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('play')))break;await page.waitForTimeout(1000);await tap(320,180)}
 await active('play');await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:30000});let before=await state();assert.equal(before.stage,7);assert.equal(before.mode,'1p');report.checks.push({name:'normal entry to stage 7 using touch only',menu,initial:before});await page.screenshot({path:`${out}/mobile-current-entry.png`})
 await touch('touchStart',[[92,324]]);await page.waitForTimeout(800);let after=await state();await touch('touchEnd');assert.ok(after.x-before.x>15,`touch right dx ${after.x-before.x}`);report.checks.push({name:'touch right moves player',dx:after.x-before.x})
 await page.waitForTimeout(500);await touch('touchStart',[[584,320]]);let minVy=0;for(let i=0;i<8;i++){await page.waitForTimeout(65);minVy=Math.min(minVy,(await state()).vy)}await touch('touchEnd');assert.ok(minVy< -80,`jump velocity ${minVy}`);report.checks.push({name:'touch jump',minVy})
 await page.waitForTimeout(800);await touch('touchStart',[[532,312]]);await page.waitForTimeout(100);after=await state();await touch('touchEnd');assert.ok(after.attackCd>0,`attack cooldown ${after.attackCd}`);report.checks.push({name:'touch attack',attackCd:after.attackCd})
 // Injection only for isolated 1P static scenery comparison; actual movement via touch.
 const decorBefore=await staticInfo();assert.equal(decorBefore.length,20);assert.ok(decorBefore.every(x=>!x.body))
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const o of [...s.enemies.getChildren()])o.setActive(false);s.boy.setPosition(1300,285);s.boy.body.reset(1300,285);s.boy.grace=0;s.cameras.main.centerOn(1400,180)});await page.waitForTimeout(400)
 await touch('touchStart',[[92,324]]);await page.waitForTimeout(1100);await touch('touchEnd');await page.waitForTimeout(300);const decorAfter=await staticInfo();assert.deepEqual(decorAfter,decorBefore);report.checks.push({name:'1P static scenery count/coordinates unchanged under touch movement (injected position)',count:decorBefore.length,before:decorBefore,after:decorAfter});await page.screenshot({path:`${out}/mobile-current-static.png`})
 assert.deepEqual(report.errors,[]);report.passed=true
}catch(e){report.failure=e.stack??String(e);console.error(report.failure);await page.screenshot({path:`${out}/mobile-current-failure.png`}).catch(()=>{})}
fs.writeFileSync(`${out}/mobile-current.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(x=>x.name),failure:report.failure,errors:report.errors}));await browser.close();if(!report.passed)process.exitCode=1
