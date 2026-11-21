// Post-ART-20 integration QA: ordinary seeded menu entry; later position injection
// and enemy isolation are explicitly NOT a playthrough. No game code/HP/win injection.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const out = 'docs/qa-c2s2'; fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] })
const gear = {heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const names = ['entrance-far','backstage-far','arena-far','net-static','number-plate-blank','sign-blank']
const reports = []
for (const kind of (process.env.QA_KIND ? [process.env.QA_KIND] : ['desktop-2p','mobile-1p'])) {
  const mobile = kind.startsWith('mobile')
  const ctx = await browser.newContext(mobile ? {...devices['Pixel 7 landscape']} : {viewport:{width:1280,height:720}})
  const page = await ctx.newPage(), cdp = mobile ? await ctx.newCDPSession(page) : null
  const report = {kind, description:'Seeded stage-6-complete save and normal menu entry; subsequent A–E positions injected and enemies isolated. Short automated check, not a full playthrough or physical device.', checks:[], network:[], errors:[], passed:false}
  page.on('pageerror', e => report.errors.push('pageerror: '+e.message))
  page.on('console', m => { if(m.type()==='error') report.errors.push('console: '+m.text()) })
  page.on('requestfailed', r => report.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', r => { if(r.url().includes('/art/stage7/') || r.status() >= 400) report.network.push({url:r.url(),status:r.status(),type:r.headers()['content-type']}) })
  await ctx.addInitScript(({gear, mobile}) => {
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({maxStage:7}))
    localStorage.setItem('sake-kuma-run-v1', JSON.stringify({version:1,runId:'qa-art20',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:mobile?'1p':'2p',solo:'boy',puffLeft:false}))
  }, {gear, mobile})
  const active = key => page.waitForFunction(k=>window.__SAKE_GAME__?.scene.isActive(k),key,{timeout:30000})
  const state = () => page.evaluate(() => { const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,intro:!!s?.storyIntro,x1:s?.boy?.x,x2:s?.girl?.x,vy:s?.boy?.body?.velocity.y,attackCd:s?.boy?.atkCd} })
  const tap = async(x,y) => {const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(350)}
  const touch = async(type,points=[]) => {const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x:b.x+b.width*x/640,y:b.y+b.height*y/360,id}))})}
  const statics = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o=>o.getData?.('stage7-static')).map(o=>({name:o.name,type:o.type,x:o.x,y:o.y,body:!!o.body,texture:o.texture?.key??null,depth:o.depth,scaleX:o.scaleX,scaleY:o.scaleY})))
  try {
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/?c2=1')
    if (mobile) {
      await active('logo');await page.waitForTimeout(1000);await tap(242,330);await active('difficulty');await page.waitForTimeout(700);await tap(320,190);await active('menu');await page.waitForTimeout(1000)
      assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('menu').stageSel),7)
      await tap(148,334);await active('worldmap')
      for(let i=0;i<10;i++){if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('play')))break;await page.waitForTimeout(1000);await tap(320,180)}
    } else {
      await page.waitForTimeout(4000)
      for(let i=0;i<35;i++){const s=await state();console.log('entry',kind,i,JSON.stringify(s));if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1200)}
    }
    await active('play');await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:30000})
    let before=await state();assert.equal(before.stage,7);assert.equal(before.mode,mobile?'1p':'2p');report.checks.push({name:'normal stage-7 entry via menu with seeded save; no position injection',state:before})
    await page.screenshot({path:`${out}/art20-${kind}-normal-entry.png`})
    if (mobile) {
      await touch('touchStart',[[92,324]]);await page.waitForTimeout(800);let after=await state();await touch('touchEnd');assert.ok(after.x1-before.x1>15);report.checks.push({name:'normal entry touch right',dx:after.x1-before.x1})
      await page.waitForTimeout(400);await touch('touchStart',[[584,320]]);let minVy=0;for(let i=0;i<8;i++){await page.waitForTimeout(65);minVy=Math.min(minVy,(await state()).vy)}await touch('touchEnd');assert.ok(minVy< -80);report.checks.push({name:'normal entry touch jump',minVy})
      await page.waitForTimeout(600);await touch('touchStart',[[532,312]]);await page.waitForTimeout(100);after=await state();await touch('touchEnd');assert.ok(after.attackCd>0);report.checks.push({name:'normal entry touch attack',attackCd:after.attackCd})
    } else {
      await page.keyboard.down('d');await page.keyboard.down('ArrowRight');await page.waitForTimeout(700);await page.keyboard.up('d');await page.keyboard.up('ArrowRight');let after=await state();assert.ok(after.x1-before.x1>10 && after.x2-before.x2>10);report.checks.push({name:'normal entry both players move by keyboard',dx1:after.x1-before.x1,dx2:after.x2-before.x2})
    }
    const textures = await page.evaluate(names=>{const t=window.__SAKE_GAME__.textures;return Object.fromEntries(names.map(n=>{const key='s7-'+n;if(!t.exists(key))return [n,null];const f=t.get(key).get();return [n,{width:f.width,height:f.height}]}))},names)
    const expected = {'entrance-far':[640,360],'backstage-far':[640,360],'arena-far':[640,360],'net-static':[104,68],'number-plate-blank':[20,13],'sign-blank':[158,89]}
    for(const n of names){assert.deepEqual([textures[n]?.width,textures[n]?.height],expected[n]);const r=report.network.find(x=>x.url.includes(`/art/stage7/${n}.png`));assert.equal(r?.status,200,`HTTP ${n}`);assert.ok(r.type.startsWith('image/png'))}
    report.checks.push({name:'six actual PNG responses and Phaser textures',textures})
    const orig = await statics();assert.equal(orig.length,28);assert.ok(orig.every(x=>!x.body));assert.equal(orig.filter(x=>x.name.endsWith('-cage')&&x.type==='Graphics').length,7);assert.equal(orig.filter(x=>x.texture==='s7-net-static').length,2);assert.equal(orig.filter(x=>x.texture==='s7-number-plate-blank').length,7);assert.equal(orig.filter(x=>x.texture==='s7-sign-blank').length,1)
    const decor = [{x:300,kind:'cage'},{x:690,kind:'cage'},{x:960,kind:'cage'},{x:1320,kind:'cage'},{x:1710,kind:'cage'},{x:2150,kind:'chain'},{x:2580,kind:'net'},{x:3000,kind:'chain'},{x:3300,kind:'cage'},{x:3670,kind:'net'},{x:4050,kind:'cage'},{x:4410,kind:'chain'}]
    decor.forEach((d,i)=>assert.equal(orig.find(o=>o.name===`stage7-static-${i}-${d.kind}`)?.x,d.x))
    // Everything after here is injected inspection: isolate enemies and place players.
    await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const o of s.enemies.getChildren())o.setActive(false)})
    for (const [seg,x] of [['A',350],['B',1300],['C',2500],['D',3800],['E',4600]]) {
      await page.evaluate(x=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const h of [s.boy,s.girl])if(h){h.setPosition(x,285);h.body.reset(x,285);h.setVelocity(0,0)}s.cameras.main.centerOn(x,180)},x)
      await page.waitForTimeout(1000)
      const v = await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {cx:s.cameras.main.scrollX+320,visible:Object.fromEntries(Object.entries(s.exhibitFar).map(([k,o])=>[k,!!o?.visible])),playerX:s.boy.x}})
      const expectedVisible = {A:seg==='A',D:seg==='D',E:seg==='E'};assert.deepEqual(v.visible,expectedVisible,`segment ${seg}: ${JSON.stringify(v)}`)
      await page.screenshot({path:`${out}/art20-${kind}-injected-${seg}.png`})
      report.checks.push({name:`${seg} backdrop (injected position, threats isolated)`,...v})
      if(seg==='B') {
        // Move before entering E: that segment can start a real boss intro which locks input.
        before=await state()
        if(mobile){await touch('touchStart',[[92,324]]);await page.waitForTimeout(1100);await touch('touchEnd')}
        else {await page.keyboard.down('d');await page.keyboard.down('ArrowRight');await page.waitForTimeout(1100);await page.keyboard.up('d');await page.keyboard.up('ArrowRight')}
        const after=await state(), dx1=after.x1-before.x1, dx2=mobile?null:after.x2-before.x2
        assert.ok(dx1>15 && dx1<250,`actual P1 movement ${dx1}`);if(!mobile)assert.ok(dx2>15 && dx2<250,`actual P2 movement ${dx2}`)
        const end=await statics();assert.deepEqual(end,orig);report.checks.push({name:'all fixed objects coordinates/count/type/depth/no body unchanged after injected-position player movement',dx1,dx2,count:orig.length,before:orig,after:end})
      }
    }
    assert.equal(report.network.filter(x=>x.status>=400).length,0);assert.deepEqual(report.errors,[]);report.passed=true
  } catch(e) {report.failure=e.stack||String(e);report.failureState=await state().catch(()=>null);await page.screenshot({path:`${out}/art20-${kind}-failure.png`,timeout:5000}).catch(()=>{})}
  fs.writeFileSync(`${out}/art20-${kind}.json`,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({kind,passed:report.passed,checks:report.checks.map(x=>x.name),failure:report.failure,networkErrors:report.network.filter(x=>x.status>=400),errors:report.errors}))
  reports.push(report);await ctx.close()
}
await browser.close();if(reports.some(r=>!r.passed))process.exitCode=1
