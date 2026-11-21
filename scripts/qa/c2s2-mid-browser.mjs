// NOT RUN as part of this checkpoint. Requires a separately started production preview.
// QA_URL=http://127.0.0.1:47417/ QA_KIND=desktop-2p node scripts/qa/c2s2-mid-browser.mjs
// QA_URL=http://127.0.0.1:47417/ QA_KIND=mobile-1p node scripts/qa/c2s2-mid-browser.mjs
// Seeded normal menu entry; subsequent camera/player positions are injected and enemies
// isolated. Screenshots need HUMAN review, especially backgrounds versus real pits/actors.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const out = 'docs/qa-c2s2'
const kind = process.env.QA_KIND || 'desktop-2p'
if (!['desktop-2p','mobile-1p'].includes(kind)) throw new Error('QA_KIND must be desktop-2p or mobile-1p')
const mobile = kind === 'mobile-1p'
fs.mkdirSync(out,{recursive:true})
const report = {kind,description:'Seeded stage-6-clear save, normal entry; then injected camera and player positions and isolated enemies. Not natural play, a physical phone, or visual acceptance.',checks:[],errors:[],network:[],passed:false}
const gear = {heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const spans = [['A',0,855],['B',855,1995],['C',1995,3135],['D',3135,4560],['E',4560,5700]]
const browser = await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const ctx = await browser.newContext(mobile ? {...devices['Pixel 7 landscape']} : {viewport:{width:1280,height:720}})
const page = await ctx.newPage()
const cdp = mobile ? await ctx.newCDPSession(page) : null
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message))
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
page.on('requestfailed',r=>report.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
page.on('response',r=>{if(r.url().includes('/art/stage7/') || r.status()>=400)report.network.push({url:r.url(),status:r.status(),type:r.headers()['content-type']})})
await ctx.addInitScript(({gear,mobile})=>{
  localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}))
  localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-mid',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:mobile?'1p':'2p',solo:'boy',puffLeft:false}))
},{gear,mobile})
const active = key=>page.waitForFunction(k=>window.__SAKE_GAME__?.scene.isActive(k),key,{timeout:30000})
const state = ()=>page.evaluate(()=>{const g=window.__SAKE_GAME__,s=g?.scene.getScene('play');return {active:g?.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,intro:!!s?.storyIntro,x1:s?.boy?.x,x2:s?.girl?.x}})
const tap = async(x,y)=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(350)}
const touch = async(type,points=[])=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x:b.x+b.width*x/640,y:b.y+b.height*y/360,id}))})}
const statics = ()=>page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o=>o.getData?.('stage7-static')).map(o=>({name:o.name,type:o.type,x:o.x,y:o.y,body:!!o.body,texture:o.texture?.key??null,depth:o.depth,scaleX:o.scaleX,scaleY:o.scaleY})))
try {
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/')
  if(mobile){
    await active('logo');await page.waitForTimeout(1000);await tap(242,330);await active('difficulty');await page.waitForTimeout(700);await tap(320,190);await active('menu');await page.waitForTimeout(1000)
    assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('menu').stageSel),7)
    await tap(148,334);await active('worldmap')
    for(let i=0;i<10;i++){if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('play')))break;await page.waitForTimeout(1000);await tap(320,180)}
  }else{
    await page.waitForTimeout(4000)
    for(let i=0;i<35;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1200)}
  }
  await active('play');await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:30000})
  const start=await state();assert.equal(start.stage,7);assert.equal(start.mode,mobile?'1p':'2p')
  const textures=await page.evaluate(()=>Object.fromEntries(['corridor-mid','training-mid'].map(n=>{const t=window.__SAKE_GAME__.textures.get('s7-'+n);return [n,{width:t.get().width,height:t.get().height}]})))
  assert.deepEqual(textures,{'corridor-mid':{width:560,height:360},'training-mid':{width:318,height:360}})
  for(const name of Object.keys(textures)){const r=report.network.find(x=>x.url.includes(`/art/stage7/${name}.png`));assert.equal(r?.status,200);assert.ok(r.type.startsWith('image/png'))}
  const initialStatics=await statics();assert.equal(initialStatics.length,28);assert.ok(initialStatics.every(o=>!o.body))
  report.checks.push({name:'normal stage-7 seeded entry, textures and static baseline',start,textures,staticCount:initialStatics.length})
  // Everything below uses injected state; no timer, chain, collision or victory override.
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const o of s.enemies.getChildren())o.setActive(false);s.cameras.main.stopFollow()})
  // Camera-only positions: all boundaries, actual texture-repeat seams, both pits.
  const cases=[['A-B',855],['B-C',1995],['C-D',3135],['D-E',4560],['B-repeat',1415],['C-repeat',2631],['pit-1',2348],['pit-2',2812]]
  for(const [name,cx] of cases){
    if(name.startsWith('pit')) await page.evaluate(cx=>{const s=window.__SAKE_GAME__.scene.getScene('play');const x=cx===2348?2292:2752;for(const [i,h] of [s.boy,s.girl].entries())if(h){h.setPosition(x-i*24,285);h.body.reset(x-i*24,285);h.setVelocity(0,0)}},cx)
    await page.evaluate(cx=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.cameras.main.setScroll(cx-320,0)},cx)
    await page.waitForTimeout(300)
    const actual=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');const entry=(o,mid)=>!o?null:({visible:o.visible,depth:o.depth,body:!!o.body,x:o.x,y:o.y,width:o.width,height:o.height,tileX:mid?o.tilePositionX:null,crop:mid?null:{x:o._crop.x,width:o._crop.width}});return {scroll:s.cameras.main.scrollX,items:{A:entry(s.exhibitFar.A,false),B:entry(s.exhibitMid.B,true),C:entry(s.exhibitMid.C,true),D:entry(s.exhibitFar.D,false),E:entry(s.exhibitFar.E,false)}}})
    const left=Math.round(actual.scroll);let total=0
    for(const [id,x0,x1] of spans){const a=Math.max(x0,left),b=Math.min(x1,left+640),o=actual.items[id];assert.ok(o,`missing ${id}`);assert.equal(o.visible,b>a,`${name} ${id} visibility`);assert.equal(o.body,false);if(b<=a)continue;const x=a-left,w=b-a;assert.equal(x,total,`${name} gap`);if(id==='B'||id==='C'){assert.equal(o.x,x);assert.equal(o.width,w);assert.equal(o.y,45);assert.equal(o.height,240);assert.equal(o.tileX,a-x0);assert.equal(o.depth,3)}else{assert.equal(o.crop.x,x);assert.equal(o.crop.width,w);assert.equal(o.depth,2)}total+=w}
    assert.equal(total,640,`${name} viewport cover`)
    await page.screenshot({path:`${out}/mid-${kind}-${name}-injected.png`})
    report.checks.push({name:`injected ${name}: viewport/display-object properties, screenshot requires review`,actual})
  }
  // Inject both actors in B, resume real camera follow and briefly move with actual input.
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const h of [s.boy,s.girl])if(h){h.setPosition(1300,285);h.body.reset(1300,285);h.setVelocity(0,0)}s.camTarget.setPosition(1300,180);s.cameras.main.centerOn(1300,180);s.cameras.main.startFollow(s.camTarget,true,0.1,0.1)})
  await page.waitForTimeout(500);const before=await state()
  if(mobile){await touch('touchStart',[[92,324]]);await page.waitForTimeout(900);await touch('touchEnd')}
  else{await page.keyboard.down('d');await page.keyboard.down('ArrowRight');await page.waitForTimeout(900);await page.keyboard.up('d');await page.keyboard.up('ArrowRight')}
  const after=await state();assert.ok(after.x1-before.x1>10);if(!mobile)assert.ok(after.x2-before.x2>10)
  assert.deepEqual(await statics(),initialStatics)
  await page.screenshot({path:`${out}/mid-${kind}-B-actors-injected.png`})
  report.checks.push({name:'input movement after B-position injection; static objects unchanged; screenshot requires review',before,after})
  assert.equal(report.network.filter(x=>x.status>=400).length,0);assert.deepEqual(report.errors,[])
  report.passed=true // Automated structural assertions only, not visual or gameplay acceptance.
}catch(e){report.failure=e.stack||String(e);report.failureState=await state().catch(()=>null);await page.screenshot({path:`${out}/mid-${kind}-failure.png`,timeout:5000}).catch(()=>{})}
finally{fs.writeFileSync(`${out}/mid-${kind}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({kind,passed:report.passed,checks:report.checks.length,failure:report.failure,errors:report.errors}));await ctx.close();await browser.close()}
if(!report.passed)process.exitCode=1
