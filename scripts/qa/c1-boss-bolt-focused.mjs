// Injected local scenario, not a full playthrough or a real mobile device.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out=process.env.QA_OUTPUT??'docs/qa-c1-boss/bolt-focused-20261104.json'
assert.ok(!fs.existsSync(out),`Refusing to overwrite ${out}`)
const results={setup:'Stage and initial hero position injected; ordinary projectile physics, normal HP and damage. TriBoss bolt hook versus the unchanged shared helper; desktop and emulated phone.',cases:[],errors:[]}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']})
try{for(const mode of ['desktop','mobile']){
  const context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}}), page=await context.newPage(), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto(process.env.QA_BASE_URL??'http://127.0.0.1:47327/')
    await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000})
    await page.waitForTimeout(700)
    await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',5);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
    await page.waitForTimeout(3500)
    if(mode==='mobile'){const cdp=await context.newCDPSession(page),box=await page.locator('canvas').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*615/640,y:box.y+box.height*14/360,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else await page.keyboard.press('Enter')
    await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:20000})
    await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.s2Pending=[];s.coffeeDone=true;for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}s.bossFight=true;s.boy.setPosition(3285,285);s.boy.body.reset(3285,285);s.boy.laneJumping=false;s.boy.jumpConsumed=false;s.boy.prevFeetY=285;s.cameras.main.setBounds(3100,0,700,360);s.cameras.main.centerOn(3400,180)})
    const comparisons=await page.evaluate(async()=>{
      const s=window.__SAKE_GAME__.scene.getScene('play'), rows=[]
      for(const dir of [-1,1])for(const high of [false,true]){
        s.triHooks().bolt(3600,285,dir,high,240,2600)
        const tri=s.enemyShots.getChildren().at(-1)
        s.throwKnife(3600,285,dir,high,240,2600)
        const reference=s.enemyShots.getChildren().at(-1)
        await new Promise(resolve=>s.events.once('postupdate',()=>s.events.once('postupdate',resolve)))
        const snap=shot=>{const v=shot.getData('triBoltVisual');return {x:shot.x,y:shot.y,angle:shot.angle,texture:shot.texture.key,visible:shot.visible,body:{width:shot.body.width,height:shot.body.height,offsetX:shot.body.offset.x,offsetY:shot.body.offset.y,vx:shot.body.velocity.x,vy:shot.body.velocity.y},damage:shot.getData('dmg'),lane:shot.getData('lane'),boss:shot.getData('boss')??false,display:{width:shot.displayWidth,height:shot.displayHeight},visual:v&&{x:v.x,y:v.y,angle:v.angle,width:v.displayWidth,height:v.displayHeight,visible:v.visible,texture:v.texture.key}}}
        const row={dir,high,tri:snap(tri),reference:snap(reference)}, visual=tri.getData('triBoltVisual')
        tri.destroy();reference.destroy();row.visualDestroyed=!visual.active;rows.push(row)
      }
      return rows
    })
    const before=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');window.__boltHits=[];const old=s.hitByFishBullet.bind(s);s.hitByFishBullet=(h,shot)=>{const row={t:s.time.now,hx:h.x,hpBefore:h.hp,shotX:shot.x,shotY:shot.y,bodyX:shot.body.center.x,bodyWidth:shot.body.width,damage:shot.getData('dmg'),tri:!!shot.getData('triBoltVisual')};const r=old(h,shot);row.hpAfter=h.hp;window.__boltHits.push(row);return r};s.triHooks().bolt(s.boy.x+95,285,-1,false,240,2600);return {hp:s.boy.hp,t:s.time.now,grace:s.boy.grace,hurtCd:s.boy.hurtCd}})
    await page.waitForFunction(()=>window.__boltHits?.length>0,null,{timeout:8000,polling:20})
    const after=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {hp:s.boy.hp,hits:window.__boltHits}})
    const row={mode,comparisons,before,after,pageErrors:errors};results.cases.push(row);console.log('CASE',mode,JSON.stringify(row))
    assert.ok(before.grace<=before.t&&before.hurtCd<=0,`${mode}: hero was invulnerable`)
    for(const v of comparisons){assert.deepEqual(v.tri.body,v.reference.body,`${mode}: collision box or velocity changed`);assert.equal(v.tri.damage,v.reference.damage);assert.equal(v.tri.lane,v.reference.lane);assert.equal(v.tri.boss,v.reference.boss);assert.equal(v.tri.texture,v.reference.texture);assert.equal(v.tri.visual.texture,v.reference.texture);assert.equal(v.tri.visible,false);assert.equal(v.tri.visual.visible,true);assert.equal(v.reference.visible,true);assert.equal(v.tri.visual.width,v.reference.display.width*1.6);assert.equal(v.tri.visual.height,v.reference.display.height*1.6);assert.ok(Math.abs(v.tri.visual.x-v.tri.x)<=1&&Math.abs(v.tri.visual.y-v.tri.y)<=1);assert.equal(v.tri.visual.angle,v.tri.angle);assert.ok(v.visualDestroyed)}
    assert.equal(before.hp-after.hp,1,`${mode}: expected normal 1 HP damage`)
    assert.ok(after.hits.some(h=>h.tri&&h.hpBefore-h.hpAfter===1&&h.bodyWidth===10),`${mode}: no real TriBoss knife collision`)
    assert.deepEqual(errors,[]);console.log('PASS',mode)
  }catch(e){results.errors.push({mode,message:String(e),stack:e.stack,pageErrors:errors});console.error('FAIL',mode,e.stack)}finally{await context.close()}
}}finally{fs.writeFileSync(out,JSON.stringify(results,null,2)+'\n',{flag:'wx'});await browser.close()}
if(results.errors.length)process.exitCode=1
