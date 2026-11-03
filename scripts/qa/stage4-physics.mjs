// Targeted game-state setup for repeatable physical tests; all hero movement is
// performed through the real phone touch controls, not by setting velocities.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const OUT = process.env.QA_OUT ?? 'docs/qa-stage4'
const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47313/'
const ROLE = process.env.QA_ROLE ?? 'boy'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ ...devices['Pixel 7 landscape'] })
const page = await context.newPage(); const errors = []; const report = { role: ROLE, cases: [], errors }
page.on('pageerror', e => errors.push(e.stack ?? e.message))
const cdp = await context.newCDPSession(page)
const points = async (coords) => { const b = await page.locator('canvas').boundingBox(); return coords.map(([x, y], id) => ({ x: b.x + b.width*x/640, y: b.y + b.height*y/360, id })) }
const touchStart = async (coords) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: await points(coords) })
const touchEnd = async () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
const tap = async (x,y) => { await touchStart([[x,y]]); await touchEnd(); await page.waitForTimeout(300) }
try {
  await page.goto(BASE); await page.waitForFunction(() => !!window.__SAKE_GAME__)
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('logo'), null, {timeout:30000})
  await page.waitForTimeout(800)
  await page.evaluate((role) => { const g=window.__SAKE_GAME__; g.registry.set('stageNo',4);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast',role);g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play') },ROLE)
  await page.waitForTimeout(3500); await tap(615,14)
  await page.waitForFunction(() => { const s=window.__SAKE_GAME__.scene.getScene('play');return s.started && !s.storyIntro }, null, {timeout:15000})
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.lastCheckpointX=3100})
  const floor = await page.evaluate(() => window.__SAKE_TERRAIN__.terrainSolids().find(s => s.kind === 'ground').top)
  const terrain = await page.evaluate(() => ({pits: window.__SAKE_TERRAIN__.terrainPits(), solids: window.__SAKE_TERRAIN__.terrainSolids()}))
  assert.ok(!terrain.pits.some(p => p.x0 < 3800 && p.x1 > 3160), 'boss arena has continuous ground')
  assert.ok(terrain.solids.some(s => s.kind === 'platform' && s.x0 === 3690 && s.x1 === 3770 && s.top === floor-54), 'right refuge is a real solid platform')
  report.terrain = {floor,pits:terrain.pits,rightPlatform:terrain.solids.find(s=>s.kind==='platform' && s.x0===3690)}
  for (const [left,right] of [[760,808],[1040,1096],[2040,2104]]) {
    for (const dir of [1,-1]) {
      const spawn = dir===1 ? left-34 : right+34
      const target = dir===1 ? right+125 : left-125
      await page.evaluate(({spawn,target,floor}) => {
        const s=window.__SAKE_GAME__.scene.getScene('play');s.s2Pending=[]
        for(const e of [...s.enemies.getChildren()]) { e.disableBody?.(true,true);e.destroy() }
        const h=s.boy; h.setPosition(target,floor);h.body.reset(target,floor);h.hp=50;h.graceUntil=s.time.now+60000
        s.spawnS2('honeyzombie',spawn,false)
      },{spawn,target,floor})
      let crossed=false, leaped=false, maxLift=0; const speeds=[]; let sample
      for(let i=0;i<95;i++) {
        await page.waitForTimeout(100)
        sample=await page.evaluate(() => {const s=window.__SAKE_GAME__.scene.getScene('play');const e=s.enemies.getChildren().find(e=>e.species==='honeyzombie' && e.active);return e&&{x:e.x,y:e.y,vx:e.body.velocity.x,leaping:!!e.getData('leaping'),fsm:e.fsm}})
        if (!sample) break
        if (Math.abs(sample.vx)>1) speeds.push(Math.abs(sample.vx))
        leaped ||= sample.leaping; maxLift=Math.max(maxLift,floor-sample.y)
        if ((dir===1 && sample.x>right+4)||(dir===-1 && sample.x<left-4)) {crossed=true;break}
      }
      const data={pit:[left,right],dir,crossed,leaped,maxLift:Math.round(maxLift),last:sample}
      report.cases.push(data);console.log('pit-hop',JSON.stringify(data))
      assert.ok(crossed && leaped && maxLift>10, `zombie must visibly hop ${left}-${right} dir ${dir}`)
    }
  }
  await page.evaluate((floor)=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}s.s2Pending=[];s.boy.setPosition(650,floor);s.boy.body.reset(650,floor);s.spawnS2('honeyzombie',400,false)},floor)
  const velocities=[]
  for(let i=0;i<30;i++){await page.waitForTimeout(100);velocities.push(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').enemies.getChildren().find(e=>e.species==='honeyzombie'&&e.active)?.body.velocity.x??0))}
  report.pursuit={min:Math.min(...velocities),max:Math.max(...velocities)};console.log('pursuit',JSON.stringify(report.pursuit))
  assert.ok(report.pursuit.min>=24 && report.pursuit.max>40 && report.pursuit.max-report.pursuit.min>5,'zombie actively pursues at a varying faster speed')
  // Interrupt an existing shared pit-hop: the zombie must land safely, and a
  // lethal hit must not leave a tween moving a destroyed object.
  for(const dmg of [1,99]) {
    await page.evaluate((floor)=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}s.boy.setPosition(930,floor);s.boy.body.reset(930,floor);s.spawnS2('honeyzombie',726,false)},floor)
    await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').enemies.getChildren().some(e=>e.species==='honeyzombie'&&e.getData('leaping')),null,{timeout:10000})
    const result=await page.evaluate((dmg)=>{const s=window.__SAKE_GAME__.scene.getScene('play'),e=s.enemies.getChildren().find(e=>e.species==='honeyzombie'&&e.active);e.receiveHit(dmg,1);return{x:e.x,y:e.y,leaping:e.getData('leaping'),fsm:e.fsm,top:window.__SAKE_TERRAIN__.supportTopAt(e.x,e.y,1)}},dmg)
    report.cases.push({interruptedByDamage:dmg,...result});console.log('interrupted-hop',JSON.stringify({dmg,...result}))
    assert.ok(!result.leaping && result.top!==null && (dmg===99 ? result.fsm==='DEAD' : result.fsm==='HURT'),'hit must cancel hop and place zombie on safe ground')
    await page.waitForTimeout(450)
  }
  await page.evaluate((floor)=>{const s=window.__SAKE_GAME__.scene.getScene('play'); for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}s.s2Pending=[];s.bossFight=true;s.cameras.main.setBounds(3160,0,640,360);s.boy.setPosition(3715,floor);s.boy.body.reset(3715,floor);s.boy.hp=50;s.boy.graceUntil=s.time.now+60000;s.queenReveal({arenaX0:3160,arenaX1:3800})},floor)
  await page.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen,null,{timeout:10000})
  await page.evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;q.act='intro';q.t=-100000})
  await page.waitForTimeout(1000)
  await page.evaluate(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy,original=h.resolveLaneJumpLanding.bind(h);window.__landTrace=[];h.resolveLaneJumpLanding=(body)=>{const before={y:h.y,prev:h.prevFeetY,vy:body.velocity.y,hold:h.jumpHoldMs,jumping:h.laneJumping};original(body);if(before.jumping&&before.y<245)window.__landTrace.push({...before,afterY:h.y,afterJumping:h.laneJumping})}})
  const beforeJump=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;return{x:h.x,y:h.y,laneJumping:h.laneJumping,jumpConsumed:h.jumpConsumed,hurtLock:h.hurtLock,started:s.started,intro:!!s.storyIntro,paused:s.physics.world.isPaused,ui:s.scene.isActive('UIScene')}})
  const jumpTrace=[];await touchStart([[584,320]])
  for(let i=0;i<16;i++){await page.waitForTimeout(100);jumpTrace.push(await page.evaluate(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return{y:Math.round(h.y*10)/10,vy:Math.round(h.body.velocity.y),jumping:h.laneJumping}}))}
  await touchEnd();await page.waitForTimeout(400);report.beforeJump=beforeJump;report.jumpTrace=jumpTrace;report.landingTrace=await page.evaluate(()=>window.__landTrace);console.log('platform-jump-trace',JSON.stringify({beforeJump,jumpTrace,landingTrace:report.landingTrace}))
  let p=await page.evaluate(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return{x:h.x,y:h.y,jumping:h.laneJumping}})
  report.rightPlatform=p;console.log('right-platform',JSON.stringify(p))
  await page.screenshot({path:`${OUT}/touch-07-boss-platform-${ROLE}.png`,scale:'css'})
  assert.ok(Math.abs(p.y-(floor-54))<3,'hero must jump up and land on right platform')
  await page.evaluate((floor)=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy,q=s.queen;h.hp=50;h.graceUntil=0;h.hurtCd=0;q.go('charge');q.dirX=1;q.setPosition(3650,floor);q.body.reset(3650,floor)},floor)
  await page.waitForTimeout(1000)
  p=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;return{x:h.x,y:h.y,hp:h.hp}})
  report.refugeDuringCharge=p;assert.ok(p.hp===50 && Math.abs(p.y-(floor-54))<3,'platform protects from a passing charge')
  await touchStart([[12,324]]);await page.waitForTimeout(1500);await touchEnd();await page.waitForTimeout(700)
  p=await page.evaluate(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return{x:h.x,y:h.y}})
  assert.ok(p.x<3690 && Math.abs(p.y-floor)<4,'hero can walk off and land on floor')
  // Put player on the left step, jump over the stationary boss and land where
  // the old x3300–3340 pit used to be. This is a setup, not a full boss win.
  await page.evaluate((floor)=>{const s=window.__SAKE_GAME__.scene.getScene('play');const h=s.boy;h.setPosition(3280,floor-24);h.body.reset(3280,floor-24);h.laneJumping=false;const q=s.queen;q.setPosition(3320,floor);q.body.reset(3320,floor);q.act='intro';q.t=-100000},floor)
  await page.waitForTimeout(350);await touchStart([[92,324],[584,320]]);await page.waitForTimeout(1150);await touchEnd();await page.waitForTimeout(800)
  p=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;return{x:h.x,y:h.y,hp:h.hp,alive:h.alive}});report.overBoss=p;console.log('over-boss',JSON.stringify(p))
  assert.ok(p.x>3340 && p.alive && Math.abs(p.y-floor)<5,'jump over boss lands on floor rather than old pit')
  // Record the real state-machine callbacks; only the phase is set for repeatability.
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen;window.__nails=[];if(s.pet){s.pet.disableBody(true,true);s.pet=null}s.boy.grace=s.time.now+60000;const warn=q.mh.warnNail,nail=q.mh.nail;q.mh.warnNail=(x,hi)=>{window.__nails.push({kind:'warn',hi,t:s.time.now,wall:performance.now()});return warn(x,hi)};q.mh.nail=(x,y,dir,hi)=>{window.__nails.push({kind:'fire',hi,t:s.time.now,wall:performance.now()});return nail(x,y,dir,hi)};q.hp=Math.floor(q.maxHp*0.6);q.qphase=2;q.nailsThrown=0;q.nailCueShown=false;q.go('volley')})
  await page.waitForFunction(()=>window.__nails.filter(x=>x.kind==='fire').length===4,null,{timeout:15000})
  const nails=await page.evaluate(()=>window.__nails);report.nails=nails;console.log('nails',JSON.stringify(nails))
  const warns=nails.filter(x=>x.kind==='warn'),fires=nails.filter(x=>x.kind==='fire')
  assert.equal(warns.length,4);assert.equal(fires.length,4)
  for(let i=0;i<4;i++){assert.equal(warns[i].hi,fires[i].hi);assert.ok(fires[i].wall-warns[i].wall>=650,'each shot has visible advance warning');if(i)assert.ok(fires[i].wall-fires[i-1].wall>=650,'shots are spaced')}
  assert.deepEqual(errors,[],'no uncaught errors');report.passed=true
} catch(e){report.passed=false;report.error=e.stack ?? String(e);console.error(report.error);await page.screenshot({path:`${OUT}/physics-failure-${ROLE}.png`,scale:'css'}).catch(()=>{})}
finally {fs.writeFileSync(`${OUT}/physics-${ROLE}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
