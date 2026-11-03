// Automated visual QA. Stage and starting position are injected; no manual play.
// Dark = actual dark-zone overlap. Not every stage has a dark-zone pit or a plank.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const mode=process.env.QA_MODE??'mobile', out=process.env.QA_OUT??'docs/qa-pit-visibility'
const base=process.env.QA_BASE_URL??'http://127.0.0.1:47318/'
const stageFilter=Number(process.env.QA_STAGE??0)
assert.ok(['mobile','desktop'].includes(mode));fs.mkdirSync(out,{recursive:true})
const cases=[
  {stage:1,x:672,kind:'normal'}, {stage:1,x:1872,kind:'fixed-plank'}, {stage:1,x:5116,kind:'moving-plank'},
  {stage:2,x:700,kind:'normal'}, {stage:2,x:1980,kind:'moving-plank'},
  {stage:3,x:1040,kind:'night'}, {stage:3,x:2560,kind:'night-moving-plank'}, {stage:3,x:2860,kind:'night-slippery'},
  {stage:4,x:1040,kind:'night'}, {stage:4,x:760,kind:'night-real-step'},
  {stage:5,x:2760,kind:'normal'}, {stage:5,x:1980,kind:'dark-plank'}, {stage:5,x:620,kind:'real-step'},
  {stage:6,x:1880,kind:'normal'}, {stage:6,x:1150,kind:'fixed-plank'}, {stage:6,x:3350,kind:'dark'}, {stage:6,x:4000,kind:'dark'}
].filter(c=>!stageFilter||c.stage===stageFilter)
const report={mode,base,setup:'stage and hero position injected; enemies isolated; screenshot camera fixed on pit',cases:[],errors:[]}
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
try {
  for (const stage of [...new Set(cases.map(c=>c.stage))]) {
    const context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
    const page=await context.newPage(), errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const cdp=mode==='mobile'?await context.newCDPSession(page):null
    const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*x/640,y:b.y+b.height*y/360,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
    try {
      await page.goto(base)
      await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000})
      await page.waitForTimeout(800)
      await page.evaluate(stage=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',stage);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')},stage)
      await page.waitForTimeout(3500)
      if(mode==='mobile')await tap(615,14);else await page.keyboard.press('Enter')
      await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:15000})
      const expected=JSON.parse(fs.readFileSync(`data/levels/stage${stage}.json`,'utf8'))
      const live=await page.evaluate(()=>({pits:window.__SAKE_TERRAIN__.terrainPits(),solids:window.__SAKE_TERRAIN__.terrainSolids().filter(s=>s.kind==='ground')}))
      assert.deepEqual(live.pits,expected.pits.map(p=>({x0:p.x,x1:p.x+p.w})),`stage ${stage} pit collision data unchanged`)
      for(const pit of live.pits){
        assert.ok(live.solids.some(s=>s.x1===pit.x0),`stage ${stage} ground ends at ${pit.x0}`)
        assert.ok(live.solids.some(s=>s.x0===pit.x1),`stage ${stage} ground resumes at ${pit.x1}`)
      }
      for (const c of cases.filter(c=>c.stage===stage)) {
        const p=expected.pits.find(p=>p.x===c.x);assert.ok(p)
        await page.evaluate(({stage,p})=>{
          const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy,t=window.__SAKE_TERRAIN__
          s.coffeeDone=true;s.lastCheckpointX=10000;s.s2Pending=[]
          if(stage===4){s.bossOn=false;s.bossFight=false;if(s.s4world?.bus)s.s4world.bus.state='done'}
          for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}
          const x=p.x-50, y=t.terrainSolids().filter(q=>x>q.x0&&x<q.x1).reduce((v,q)=>Math.min(v,q.top),285)
          h.setPosition(x,y);h.body.reset(x,y);h.laneJumping=false;h.jumpConsumed=false;h.prevFeetY=y;h.hp=99;h.graceUntil=s.time.now+60000
          s.cameras.main.stopFollow();s.cameras.main.centerOn(p.x+p.w/2,180)
        },{stage,p})
        await page.waitForTimeout(c.kind.includes('dark')?2200:800)
        const state=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {dark:s.s3world?.dark??0,hero:{x:s.boy.x,y:s.boy.y},scrollX:s.cameras.main.scrollX,zoom:s.cameras.main.zoom,solids:window.__SAKE_TERRAIN__.terrainSolids().filter(q=>q.kind!=='ground').map(q=>({x0:q.x0,x1:q.x1,top:q.top,kind:q.kind}))}})
        assert.ok(Math.abs(state.hero.x-(p.x-50))<20,`stage ${stage} hero stays by the photographed pit`)
        if(c.kind.includes('dark'))assert.ok(state.dark>(stage===6?.5:.7),`stage ${stage} true dark overlay active: ${state.dark}`)
        const image=`${mode}-s${stage}-${c.kind}-${c.x}.png`
        await page.screenshot({path:`${out}/${image}`,scale:'css'})
        const item={...c,width:p.w,image,...state,passed:true};report.cases.push(item)
        console.log('PASS',mode,stage,c.kind,c.x,'dark=',state.dark.toFixed(3))
      }
    } catch(e) {
      report.cases.push({stage,passed:false,error:e.stack??String(e)})
      await page.screenshot({path:`${out}/${mode}-s${stage}-failure.png`,scale:'css'}).catch(()=>{})
      console.error('FAIL',mode,stage,e.stack??e)
    } finally { report.errors.push(...errors.map(message=>({stage,message})));await context.close() }
  }
} finally {
  await browser.close()
  report.passed=report.cases.length===cases.length && report.cases.every(c=>c.passed) && !report.errors.length
  fs.writeFileSync(`${out}/${mode}.json`,JSON.stringify(report,null,2)+'\n')
}
if(!report.passed)process.exitCode=1
